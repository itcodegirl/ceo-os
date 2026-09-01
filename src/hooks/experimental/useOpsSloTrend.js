import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getOpsSloSnapshotsSource,
  listOpsSloSnapshots,
} from '../../lib/experimental/telemetry/opsSloSnapshotsRepository';

export function useOpsSloTrend({
  limit = 20,
  onLoadError,
} = {}) {
  const [snapshots, setSnapshots] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const source = getOpsSloSnapshotsSource();
  const onLoadErrorRef = useRef(onLoadError);

  useEffect(() => {
    onLoadErrorRef.current = onLoadError;
  }, [onLoadError]);

  useEffect(() => {
    let isSubscribed = true;

    const loadInitialSnapshots = async () => {
      try {
        const result = await listOpsSloSnapshots({ limit });
        if (!isSubscribed) {
          return;
        }

        setSnapshots(Array.isArray(result) ? result : []);
        setLoadError('');
      } catch (error) {
        if (!isSubscribed) {
          return;
        }

        setSnapshots([]);
        setLoadError('Unable to load SLO trend snapshots right now.');
        if (typeof onLoadErrorRef.current === 'function') {
          onLoadErrorRef.current(error);
        }
      } finally {
        if (isSubscribed) {
          setIsLoading(false);
        }
      }
    };

    void loadInitialSnapshots();

    return () => {
      isSubscribed = false;
    };
  }, [limit]);

  const refreshSnapshots = useCallback(async () => {
    setIsLoading(true);

    try {
      const result = await listOpsSloSnapshots({ limit });
      setSnapshots(Array.isArray(result) ? result : []);
      setLoadError('');
    } catch (error) {
      setSnapshots([]);
      setLoadError('Unable to load SLO trend snapshots right now.');
      if (typeof onLoadErrorRef.current === 'function') {
        onLoadErrorRef.current(error);
      }
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  return {
    snapshots,
    isLoading,
    loadError,
    source,
    refreshSnapshots,
  };
}
