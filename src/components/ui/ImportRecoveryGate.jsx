import { withStorageLock } from '../../lib/storageLock';
import { useCallback, useEffect, useState } from 'react';
import { ACTIVE_IMPORT_KEY, IMPORT_RECOVERY_EVENT, getImportRecovery, rollbackImport } from '../../lib/importRecovery';
import { downloadTextFile } from '../../lib/downloadFile';

export default function ImportRecoveryGate({ children }) {
  const [recovery, setRecovery] = useState(() => getImportRecovery() ? { checking: true, failedKeys: [] } : null);
  const [error, setError] = useState('');
  const [exported, setExported] = useState(false);
  const [confirmKeep, setConfirmKeep] = useState(false);
  const recover = useCallback(async () => {
    try {
      // A second tab must not roll back an import that is still committing.
      const result = await withStorageLock('workspace-import', () => rollbackImport());
      setError('');
      setRecovery(result.recovered ? null : result);
    } catch (failure) { setError(failure.message); setRecovery({ failedKeys: [] }); }
  }, []);
  useEffect(() => {
    if (getImportRecovery()) void Promise.resolve().then(recover);
    const refresh = () => {
      const journal = getImportRecovery();
      if (journal) setRecovery({ recovered: false, failedKeys: Object.keys(journal.before || {}) });
    };
    window.addEventListener(IMPORT_RECOVERY_EVENT, refresh);
    return () => window.removeEventListener(IMPORT_RECOVERY_EVENT, refresh);
  }, [recover]);
  if (recovery?.checking) return <p role="status">Checking workspace recovery…</p>;
  if (!recovery) return children;
  return <main className="page-content" style={{ maxWidth: 720, margin: '48px auto', padding: 24 }}>
    <h1>Finish recovering your workspace</h1>
    {error ? <p role="alert">{error}</p> : null}
    <p role="alert">A workspace update was interrupted. Your original data is preserved. Some stores could not be rolled back, so editing is paused.</p>
    <p>Download the recovery snapshot first. You can retry restoring the original data, or deliberately keep the current data after reviewing it.</p>
    <ul>{recovery.failedKeys.map((key) => <li key={key}>{key.replace(/^ceo-os-/, '').replaceAll('-', ' ')}</li>)}</ul>
    <div className="modal-actions">
      <button onClick={() => { const snapshot = getImportRecovery(); downloadTextFile(localStorage.getItem(snapshot.key) || JSON.stringify(snapshot), 'ceo-os-import-recovery.json'); setExported(true); }}>Download recovery snapshot</button>
      <button onClick={recover}>Retry recovery</button>
      <button disabled={!exported} onClick={() => setConfirmKeep(true)}>Keep current data</button>
    </div>
    {confirmKeep ? <div role="alert">
      <p>This keeps the current combination of stores. The original snapshot remains available in Settings. Continue?</p>
      <button onClick={() => setConfirmKeep(false)}>Cancel</button>
      <button onClick={async () => { try { await withStorageLock('workspace-import', () => localStorage.removeItem(ACTIVE_IMPORT_KEY)); setRecovery(null); } catch (failure) { setError(failure.message); } }}>Confirm keeping current data</button>
    </div> : null}
  </main>;
}
