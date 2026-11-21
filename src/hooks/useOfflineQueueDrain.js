import { useCallback, useEffect, useRef } from 'react';
import { drainOfflineQueue, getCurrentOfflineQueue, OFFLINE_QUEUE_UPDATED_EVENT, OFFLINE_QUEUE_STORAGE_KEY, OFFLINE_QUEUE_RETRY_EVENT } from '../lib/offlineWriteQueue';
import { AUTH_STORAGE_KEY, WORKSPACE_ACCOUNT_EVENT } from '../lib/workspaceOwnership';
import { useOnlineStatus } from './useOnlineStatus';

export function useOfflineQueueDrain({ handlerByKind = {}, onDrainFailure } = {}) {
  const isOnline = useOnlineStatus();
  const isDraining = useRef(false);
  const handlers = useRef(handlerByKind);
  const onFailure = useRef(onDrainFailure);
  useEffect(() => { handlers.current = handlerByKind; onFailure.current = onDrainFailure; });
  const runDrain = useCallback(async () => {
    if (isDraining.current || !getCurrentOfflineQueue().length) return;
    isDraining.current = true;
    try {
      const result = await drainOfflineQueue(handlers.current);
      if (result.failed) onFailure.current?.(result);
    } catch {
      onFailure.current?.({ drained: 0, failed: 1, remaining: getCurrentOfflineQueue().length });
    } finally { isDraining.current = false; }
  }, []);
  useEffect(() => {
    if (!isOnline) return undefined;
    const retry = () => { void runDrain(); };
    const onQueue = (event) => { if (['enqueue', 'retry'].includes(event.detail?.kind)) retry(); };
    const onStorage = (event) => { if (!event.key || [OFFLINE_QUEUE_STORAGE_KEY, AUTH_STORAGE_KEY].includes(event.key)) retry(); };
    // Bounded retry timestamps are enforced by the queue. This clock also
    // notices work queued after an initially healthy online connection.
    const timer = window.setInterval(retry, 5000);
    window.addEventListener(OFFLINE_QUEUE_UPDATED_EVENT, onQueue);
    window.addEventListener(OFFLINE_QUEUE_RETRY_EVENT, retry);
    window.addEventListener(WORKSPACE_ACCOUNT_EVENT, retry);
    window.addEventListener('storage', onStorage);
    retry();
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(OFFLINE_QUEUE_UPDATED_EVENT, onQueue);
      window.removeEventListener(OFFLINE_QUEUE_RETRY_EVENT, retry);
      window.removeEventListener(WORKSPACE_ACCOUNT_EVENT, retry);
      window.removeEventListener('storage', onStorage);
    };
  }, [isOnline, runDrain]);
}
