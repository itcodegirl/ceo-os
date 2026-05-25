import { useCallback, useState } from 'react';
import { generateChiefOfStaffResponse, getChiefActionTitle } from '../lib/openai';
import { createChiefSession, saveChiefOutput } from '../lib/chiefRepository';
import { FEEDBACK_KIND } from '../lib/chiefFeedback';
import { buildCreateId } from '../lib/utils';

export function useChiefGeneration({
  isMountedRef,
  canGenerate,
  hasNotes,
  notesText,
  // (kind, text) — see src/lib/chiefFeedback.js for the kind taxonomy.
  // 'result' / 'error' messages are durable so transient hints can't paint
  // over them. The parent hook owns the actual state.
  pushFeedback,
  setLoadError,
  setResponses,
  trackTelemetry,
  // Optional. Called with the updated responses array after a successful
  // save so the parent can re-hydrate acceptance state against the current
  // target workspaces. Necessary because regenerating notes that touch
  // already-accepted items must keep those items marked accepted.
  onAfterResponseSaved,
}) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleAction = useCallback(async (actionKey) => {
    if (isGenerating) {
      return;
    }

    if (!canGenerate) {
      if (!hasNotes) {
        pushFeedback(FEEDBACK_KIND.info, 'Paste notes first so we can produce a relevant draft or recommendation.');
        trackTelemetry('generate_blocked_no_notes', { actionKey });
      }
      return;
    }

    setIsGenerating(true);
    pushFeedback(FEEDBACK_KIND.progress, 'Generating a new draft for your current notes.');
    setLoadError('');
    const correlationId = buildCreateId();
    trackTelemetry('generate_started', {
      actionKey,
      notesLength: notesText.length,
      correlationId,
    });

    try {
      const session = await createChiefSession({
        actionKey,
        notes: notesText,
      });

      const nextResponse = await generateChiefOfStaffResponse({
        actionKey,
        notes: notesText,
        correlationId,
      });

      if (!isMountedRef.current) {
        return;
      }

      if (!nextResponse.content) {
        pushFeedback(FEEDBACK_KIND.error, 'No output generated. Add more context and try again.');
        trackTelemetry('generate_completed_empty', {
          actionKey,
          source: nextResponse.source || 'unknown',
          correlationId: nextResponse.correlationId || correlationId,
          requestId: nextResponse.requestId || '',
        });
        return;
      }

      const savedOutput = await saveChiefOutput({
        sessionId: session.id,
        outputType: 'response',
        title: nextResponse.title || getChiefActionTitle(actionKey),
        content: nextResponse.content,
        structuredPayload: nextResponse.structuredPayload || {},
        source: nextResponse.source || 'proxy',
        fallbackReason: nextResponse.fallbackReason || '',
        errorCode: nextResponse.errorCode || '',
        errorMessage: nextResponse.errorMessage || '',
      });

      if (!isMountedRef.current) {
        return;
      }

      let updatedResponses = [];
      setResponses((current) => {
        updatedResponses = [savedOutput, ...current];
        return updatedResponses;
      });

      if (typeof onAfterResponseSaved === 'function') {
        try {
          await onAfterResponseSaved(updatedResponses);
        } catch (hydrationError) {
          if (import.meta.env.DEV) {
            console.warn('Chief acceptance hydration failed', hydrationError);
          }
        }
      }
      if (!isMountedRef.current) {
        return;
      }
      if (nextResponse.source === 'proxy') {
        pushFeedback(FEEDBACK_KIND.result, `Created: ${savedOutput.title}. Review and edit before sending.`);
      } else {
        pushFeedback(FEEDBACK_KIND.error, `AI unavailable. Saved local fallback: ${savedOutput.title}. Review before using.`);
      }

      trackTelemetry('generate_completed', {
        actionKey,
        source: nextResponse.source || 'unknown',
        correlationId: nextResponse.correlationId || correlationId,
        requestId: nextResponse.requestId || '',
        structuredCounts: {
          priorities: Array.isArray(nextResponse.structuredPayload?.priorities)
            ? nextResponse.structuredPayload.priorities.length
            : 0,
          opportunities: Array.isArray(nextResponse.structuredPayload?.opportunities)
            ? nextResponse.structuredPayload.opportunities.length
            : 0,
          contentItems: Array.isArray(nextResponse.structuredPayload?.contentItems)
            ? nextResponse.structuredPayload.contentItems.length
            : 0,
          tasks: Array.isArray(nextResponse.structuredPayload?.tasks)
            ? nextResponse.structuredPayload.tasks.length
            : 0,
        },
      });
    } catch (error) {
      if (!isMountedRef.current) {
        return;
      }

      pushFeedback(FEEDBACK_KIND.error, 'Unable to generate output right now. Try again in a moment.');
      setLoadError('Unable to generate chief output right now.');
      if (import.meta.env.DEV) {
        console.error('Chief workflow action failed', error);
      }
      trackTelemetry('generate_failed', {
        actionKey,
        correlationId,
      });
    } finally {
      if (isMountedRef.current) {
        setIsGenerating(false);
      }
    }
  }, [
    canGenerate,
    hasNotes,
    isMountedRef,
    isGenerating,
    notesText,
    onAfterResponseSaved,
    pushFeedback,
    setLoadError,
    setResponses,
    trackTelemetry,
  ]);

  return {
    isGenerating,
    handleAction,
  };
}
