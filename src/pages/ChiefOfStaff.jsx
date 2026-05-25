import { lazy, Suspense, useCallback, useMemo, useState } from "react";
import ChiefOutputPanel from "../components/chief/ChiefOutputPanel";
import ChiefOutputPicker from "../components/chief/ChiefOutputPicker";
import ChiefHistoryList from "../components/chief/ChiefHistoryList";
import { getChiefResponseId } from "../components/chief/chiefHistory";
import Button from "../components/ui/Button";
import ConfirmModal from "../components/ui/ConfirmModal";
import SourceStatusNotice from "../components/ui/SourceStatusNotice";
import { useChiefOfStaff } from "../hooks/useChiefOfStaff";
import { useMetaMode } from "../hooks/useMetaMode";
import { toPanelResult } from "../lib/chiefPanelResult";
import { buildSourceNotice } from "../lib/uiCopy";
import { MAX_NOTES_LENGTH } from "../../shared/chiefConfig.js";
import "../styles/chief-of-staff.css";

const ChiefTelemetryDiagnosticsPanel = lazy(() =>
  import("../components/chief/ChiefTelemetryDiagnosticsPanel")
);

export default function ChiefOfStaff() {
  const {
    notes,
    setNotes,
    responses,
    feedback,
    source,
    isLoading,
    loadError,
    isGenerating,
    isAcceptingAll,
    handleAction,
    acceptStructuredItem,
    acceptAllStructured,
    isStructuredItemAccepted,
    isStructuredItemAccepting,
    clearWorkspace,
    refreshWorkspace
  } = useChiefOfStaff();
  const isMetaMode = useMetaMode();
  const responseList = useMemo(() => (Array.isArray(responses) ? responses : []), [responses]);
  const latestResponseId = responseList.length ? getChiefResponseId(responseList[0], 0) : null;

  const [selectedActionKey, setSelectedActionKey] = useState("plan");
  const [selectedResponseId, setSelectedResponseId] = useState(null);
  const [trackedLatestId, setTrackedLatestId] = useState(latestResponseId);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // A new generation (or a workspace reload) puts a different output at the
  // front of the list; when that happens, snap the view back to the newest
  // one instead of whichever history entry was being inspected. Adjusting
  // state during render (rather than in an effect) keeps this synchronous
  // and avoids a flash of the stale selection.
  if (trackedLatestId !== latestResponseId) {
    setTrackedLatestId(latestResponseId);
    setSelectedResponseId(null);
  }

  const selectedResponse = useMemo(() => {
    if (!responseList.length) {
      return null;
    }
    if (selectedResponseId) {
      const match = responseList.find(
        (entry, index) => getChiefResponseId(entry, index) === selectedResponseId,
      );
      if (match) {
        return match;
      }
    }
    return responseList[0];
  }, [responseList, selectedResponseId]);

  const isViewingEarlierOutput = Boolean(
    selectedResponse && responseList.length && selectedResponse !== responseList[0],
  );

  // Memoize the parsed/normalized panel result so the structured payload
  // tree (often several KB) is not rebuilt on every notes keystroke. Keyed
  // on the response identity which only changes after a successful save or
  // a history selection.
  const result = useMemo(() => toPanelResult(selectedResponse), [selectedResponse]);
  const notesLength = typeof notes === "string" ? notes.length : 0;
  const notesLimitReached = notesLength >= MAX_NOTES_LENGTH;

  const feedbackMessage = loadError
    ? "Review the workspace status above, then retry when ready."
    : feedback;
  const actionHint = notesLimitReached
    ? "Notes reached the current limit. Trim them before generating again."
    : notes.trim()
      ? "Your notes stay editable. Review every recommendation before using it."
      : "Add a few founder notes, then choose what to make.";

  const canGenerate = Boolean(notes.trim()) && !isGenerating && !notesLimitReached;

  const handleGenerate = useCallback(() => {
    handleAction(selectedActionKey);
  }, [handleAction, selectedActionKey]);

  const handleSelectResponse = useCallback((id) => {
    setSelectedResponseId(id || null);
  }, []);

  const handleViewLatest = useCallback(() => {
    setSelectedResponseId(null);
  }, []);

  const handleRequestReset = useCallback(() => {
    setIsResetConfirmOpen(true);
  }, []);

  const handleCancelReset = useCallback(() => {
    if (isResetting) {
      return;
    }
    setIsResetConfirmOpen(false);
  }, [isResetting]);

  const handleConfirmReset = useCallback(async () => {
    setIsResetting(true);
    try {
      await clearWorkspace();
      setSelectedResponseId(null);
      setIsResetConfirmOpen(false);
    } finally {
      setIsResetting(false);
    }
  }, [clearWorkspace]);

  // Stable callback references so ChiefOutputPanel children don't re-render
  // on every parent paint.
  const onAcceptPriority = useCallback((item) => acceptStructuredItem("priorities", item), [acceptStructuredItem]);
  const onAcceptOpportunity = useCallback((item) => acceptStructuredItem("opportunities", item), [acceptStructuredItem]);
  const onAcceptContent = useCallback((item) => acceptStructuredItem("contentItems", item), [acceptStructuredItem]);
  const onAcceptTask = useCallback((item) => acceptStructuredItem("tasks", item), [acceptStructuredItem]);
  const onAcceptAll = useCallback(() => acceptAllStructured(result?.structured), [acceptAllStructured, result]);
  const isPriorityAccepted = useCallback((item) => isStructuredItemAccepted("priorities", item), [isStructuredItemAccepted]);
  const isPriorityAccepting = useCallback((item) => isStructuredItemAccepting("priorities", item), [isStructuredItemAccepting]);
  const isOpportunityAccepted = useCallback((item) => isStructuredItemAccepted("opportunities", item), [isStructuredItemAccepted]);
  const isOpportunityAccepting = useCallback((item) => isStructuredItemAccepting("opportunities", item), [isStructuredItemAccepting]);
  const isContentAccepted = useCallback((item) => isStructuredItemAccepted("contentItems", item), [isStructuredItemAccepted]);
  const isContentAccepting = useCallback((item) => isStructuredItemAccepting("contentItems", item), [isStructuredItemAccepting]);
  const isTaskAccepted = useCallback((item) => isStructuredItemAccepted("tasks", item), [isStructuredItemAccepted]);
  const isTaskAccepting = useCallback((item) => isStructuredItemAccepting("tasks", item), [isStructuredItemAccepting]);

  return (
    <section className="chief-page-grid">
      <h1 className="sr-only">Chief of Staff</h1>
      <div className="chief-left-column">
        <div className="chief-card chief-input-card">
          <div className="chief-input-header">
            <div>
              <p className="chief-eyebrow">Prompt Workspace</p>
              <h2>Turn founder notes into action</h2>
            </div>

            <Button type="button" variant="ghost" size="small" onClick={handleRequestReset} disabled={isGenerating}>
              Reset Workspace
            </Button>
          </div>

          <p className="chief-helper-text">
            Paste notes, founder thoughts, meeting takeaways, or rough strategy
            ideas.
          </p>
          <SourceStatusNotice
            source={source}
            supabaseText={buildSourceNotice("supabase", { supabasePrefix: "" })}
            localText="Chief workspace is stored on this device only."
            loadError={isLoading ? "" : loadError}
            onRetry={refreshWorkspace}
            retryAriaLabel="Retry loading chief workspace"
            retryDisabled={isGenerating}
          />

          <label htmlFor="chief-notes-input" className="sr-only">
            Founder notes
          </label>
          <textarea
            id="chief-notes-input"
            className="chief-notes-input"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Paste founder notes, meeting takeaways, risks, priorities, or rough ideas here..."
            maxLength={MAX_NOTES_LENGTH}
            disabled={isGenerating}
            aria-disabled={isGenerating}
            aria-label="Founder notes for chief of staff workspace"
            aria-describedby="chief-notes-meta chief-action-hint"
            aria-invalid={notesLimitReached}
          />
          <p
            id="chief-notes-meta"
            className={`chief-notes-meta ${notesLimitReached ? "chief-notes-meta--limit" : ""}`.trim()}
            role="status"
            aria-live="polite"
          >
            {notesLength.toLocaleString()} / {MAX_NOTES_LENGTH.toLocaleString()} characters
            {notesLimitReached ? " (limit reached)" : ""}
          </p>

          <div
            className={`chief-make-shell ${isGenerating ? "chief-make-shell--disabled" : ""}`.trim()}
            aria-busy={isGenerating}
          >
            <ChiefOutputPicker
              value={selectedActionKey}
              onChange={setSelectedActionKey}
              onGenerate={handleGenerate}
              disabled={!canGenerate}
              isGenerating={isGenerating}
            />
          </div>
          <p id="chief-action-hint" className="chief-helper-text" role="status" aria-live="polite">
            {actionHint}
          </p>

          <p className="chief-feedback-text" role="status" aria-live="polite">
            {isGenerating ? "Generating recommendations from your notes..." : feedbackMessage}
          </p>

          {isMetaMode ? (
            <Suspense
              fallback={(
                <div className="chief-card" aria-live="polite">
                  <div className="chief-section-header">
                    <h3>Decision Engine Health</h3>
                    <span className="chief-count-badge">--</span>
                  </div>
                  <p className="chief-helper-text">Loading telemetry diagnostics...</p>
                </div>
              )}
            >
              <ChiefTelemetryDiagnosticsPanel />
            </Suspense>
          ) : null}
        </div>
      </div>

      <div className="chief-right-column">
        {isViewingEarlierOutput ? (
          <div className="chief-card chief-history-notice" role="status">
            <p>You're viewing an earlier output. It's read-only history — generating a new one won't change it.</p>
            <Button type="button" variant="ghost" size="small" onClick={handleViewLatest}>
              Back to latest
            </Button>
          </div>
        ) : null}

        <ChiefOutputPanel
          isGenerating={isGenerating}
          result={result}
          onAcceptPriority={onAcceptPriority}
          onAcceptOpportunity={onAcceptOpportunity}
          onAcceptContent={onAcceptContent}
          onAcceptTask={onAcceptTask}
          onAcceptAll={onAcceptAll}
          isAcceptingAll={isAcceptingAll}
          isPriorityAccepted={isPriorityAccepted}
          isPriorityAccepting={isPriorityAccepting}
          isOpportunityAccepted={isOpportunityAccepted}
          isOpportunityAccepting={isOpportunityAccepting}
          isContentAccepted={isContentAccepted}
          isContentAccepting={isContentAccepting}
          isTaskAccepted={isTaskAccepted}
          isTaskAccepting={isTaskAccepting}
        />

        <ChiefHistoryList
          items={responseList}
          selectedId={selectedResponseId}
          onSelect={handleSelectResponse}
        />
      </div>

      <ConfirmModal
        isOpen={isResetConfirmOpen}
        title="Clear the Chief of Staff workspace?"
        message="This removes your saved notes and every generated output on this workspace. Items you already accepted into Weekly Brief, Opportunities, or Content OS stay where they are. This can't be undone."
        cancelLabel="Keep workspace"
        confirmLabel={isResetting ? "Clearing..." : "Clear workspace"}
        confirmAriaLabel="Clear chief of staff workspace"
        cancelAriaLabel="Keep chief of staff workspace"
        isConfirming={isResetting}
        onCancel={handleCancelReset}
        onConfirm={handleConfirmReset}
      />
    </section>
  );
}
