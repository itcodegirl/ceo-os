import { WORKSPACE_ACCOUNT_EVENT, AUTH_STORAGE_KEY } from '../lib/workspaceOwnership';
import { useEffect, useState } from 'react';
import {
  OFFLINE_QUEUE_UPDATED_EVENT,
  getCurrentOfflineQueue,
} from '../lib/offlineWriteQueue';

/**
 * Subscribes a component to the offline-write queue size. Returns the
 * count of pending writes so the SyncStatusPill (or any other UI) can
 * surface it without callers having to wire the event listener themselves.
 *
 * Reads the current size on mount, updates on every queue change event,
 * and cleans up on unmount.
 */
export function useOfflineWriteQueueSize() {
  const [size, setSize] = useState(() => getCurrentOfflineQueue().length);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleQueueChange = () => {
      setSize(getCurrentOfflineQueue().length);
    };

    // Refetch on storage events so other tabs' queue mutations propagate.
    const handleStorageChange = (event) => {
      if (event?.key === null || event?.key === 'ceo-os-offline-write-queue' || event?.key === AUTH_STORAGE_KEY) {
        setSize(getCurrentOfflineQueue().length);
      }
    };

    window.addEventListener(OFFLINE_QUEUE_UPDATED_EVENT, handleQueueChange);
    window.addEventListener(WORKSPACE_ACCOUNT_EVENT, handleQueueChange);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener(OFFLINE_QUEUE_UPDATED_EVENT, handleQueueChange);
      window.removeEventListener(WORKSPACE_ACCOUNT_EVENT, handleQueueChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  return size;
}
