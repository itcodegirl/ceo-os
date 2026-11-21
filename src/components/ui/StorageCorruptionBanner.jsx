import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listStorageRecovery, STORAGE_CORRUPTION_EVENT, STORAGE_RESTORED_EVENT, STORAGE_ARCHIVED_EVENT } from '../../lib/storageCorruption';

export default function StorageCorruptionBanner() {
  const [count, setCount] = useState(() => listStorageRecovery().length);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    const refresh = () => { setCount(listStorageRecovery().length); setDismissed(false); };
    window.addEventListener(STORAGE_CORRUPTION_EVENT, refresh);
    window.addEventListener(STORAGE_RESTORED_EVENT, refresh);
    window.addEventListener(STORAGE_ARCHIVED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    refresh();
    return () => {
      window.removeEventListener(STORAGE_CORRUPTION_EVENT, refresh);
      window.removeEventListener(STORAGE_RESTORED_EVENT, refresh);
      window.removeEventListener(STORAGE_ARCHIVED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);
  if (!count || dismissed) return null;
  return <div className="storage-corruption-banner" role="status" data-testid="storage-corruption-banner">
    <div className="storage-corruption-banner__body">
      <strong>Local data needs recovery</strong>
      <p>{count} preserved or unreadable store{count === 1 ? '' : 's'} available for review. Export the original data before discarding it.</p>
      <Link to="/settings#recovery">Review recovery data</Link>
    </div>
    <button className="storage-corruption-banner__dismiss" onClick={() => setDismissed(true)} aria-label="Dismiss data recovery notice">Dismiss</button>
  </div>;
}
