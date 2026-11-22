import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import Button from '../ui/Button';
import ConfirmModal from '../ui/ConfirmModal';
import { getOfflineQueue, OFFLINE_QUEUE_UPDATED_EVENT, discardOfflineWrite, retryOfflineWrite } from '../../lib/offlineWriteQueue';
import { getWorkspaceOwnerId } from '../../lib/workspaceOwnership';
import { listStorageRecovery, discardCorruptBackup, restoreCorruptBackup, STORAGE_CORRUPTION_EVENT, STORAGE_ARCHIVED_EVENT, STORAGE_RESTORED_EVENT } from '../../lib/storageCorruption';
import { listImportSnapshots } from '../../lib/importRecovery';
import { accountBackupValue } from '../../lib/workspaceBackupOwnership';
import { downloadTextFile } from '../../lib/downloadFile';

export default function WorkspaceRecoveryTools() {
  const [, refresh] = useState(0);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const owner = getWorkspaceOwnerId();
  const queue = getOfflineQueue().filter((entry) => entry.ownerId === owner || entry.ownerId === undefined);
  const recovery = listStorageRecovery();
  const snapshots = listImportSnapshots().filter((snapshot) => snapshot.ownerId === owner);
  useEffect(() => {
    const update = () => refresh((count) => count + 1);
    const events = [OFFLINE_QUEUE_UPDATED_EVENT, STORAGE_CORRUPTION_EVENT, STORAGE_ARCHIVED_EVENT, STORAGE_RESTORED_EVENT, 'storage'];
    events.forEach((event) => window.addEventListener(event, update));
    return () => events.forEach((event) => window.removeEventListener(event, update));
  }, []);
  const run = async (action) => {
    setError(''); setBusy(true);
    try { if (await action() === false) throw new Error('This recovery action could not be saved. The original data is still available.'); }
    catch (failure) { setError(failure.message || 'Recovery failed. Your original data is preserved.'); }
    finally { setBusy(false); refresh((count) => count + 1); }
  };
  return <div className="workspace-recovery">
    {error ? <p role="alert">{error}</p> : null}
    <h3>Pending writes</h3>
    <p>Queued actions are not yet saved to your account. Blocked actions stay here for review; they do not stop unrelated work.</p>
    {queue.length ? <Button onClick={() => downloadTextFile(JSON.stringify(queue, null, 2), 'ceo-os-pending-writes.json')}>Export pending writes</Button> : <p>No pending writes to review.</p>}
    <ul>{queue.map((entry) => <li key={entry.id}>
      <strong>{entry.payload?.title || entry.payload?.name || entry.payload?.text || entry.kind}</strong>
      <p>{entry.ownerId === undefined ? 'Legacy action: its account is unknown. Export it for manual recovery.' : `${entry.status || 'pending'} · ${entry.attempts || 0} ${entry.attempts === 1 ? 'attempt' : 'attempts'}`}</p>
      {entry.lastError ? <p>{entry.lastError}</p> : null}
      <details><summary>Review action data</summary><pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(entry.payload, null, 2)}</pre></details>
      <div className="modal-actions">
        <Button disabled={busy || entry.ownerId !== owner} onClick={() => run(() => retryOfflineWrite(entry.id))}>Retry action</Button>
        <Button variant="ghost" disabled={busy} onClick={() => setConfirm({ message: 'Discard this pending action? It will no longer be retried. A request already in progress may still finish. Export it first if you need a copy.', action: () => discardOfflineWrite(entry.id) })}>Discard action</Button>
      </div>
    </li>)}</ul>
    <h3>Preserved local data</h3>
    {!recovery.length ? <p>No unreadable or archived stores need review.</p> : null}
    <ul>{recovery.map((entry) => <li key={entry.backupKey || entry.key}>
      <strong>{entry.key.replace(/^ceo-os-/, '').replaceAll('-', ' ')}</strong>
      <p>{entry.backupKey ? `Preserved ${entry.savedAt || 'earlier'}.` : 'The original is still in place because a backup could not be stored.'} {entry.restorable ? 'This snapshot passes validation.' : 'This data cannot be restored by this version. Export the original for recovery.'}</p>
      <div className="modal-actions">
        <Button onClick={() => downloadTextFile(entry.value, `${entry.key}-recovery.txt`, 'text/plain')}>Export original</Button>
        {entry.restorable && entry.backupKey ? <Button disabled={busy} onClick={() => setConfirm({ message: 'Restore this validated snapshot? The current store will be preserved first. Reload after restoring.', action: () => restoreCorruptBackup(entry.key, entry.backupKey) })}>Restore snapshot</Button> : null}
        <Button variant="ghost" disabled={busy} onClick={() => setConfirm({ message: 'Permanently discard this preserved data? Export the original first if you need a copy.', action: () => discardCorruptBackup(entry.key, entry.backupKey) })}>Discard preserved data</Button>
      </div>
    </li>)}</ul>
    <h3>Before-restore snapshots</h3>
    <p>Each backup restore or demo change preserves the original stores here. Download a snapshot to review or import it through the normal backup preview. It contains previously existing stores; importing it does not delete stores added later.</p>
    <ul>{snapshots.map((snapshot) => <li key={snapshot.key}>
      {snapshot.createdAt}
      <Button onClick={() => downloadTextFile(JSON.stringify({ format: 'codeherway-ceo-os-local-backup', schemaVersion: 1, workspaceOwnerId: snapshot.ownerId,
        exportedAt: snapshot.createdAt, keys: Object.fromEntries(Object.entries(snapshot.before).filter(([, raw]) => raw !== null).map(([key, raw]) => [key, accountBackupValue(key, raw)])) }, null, 2), 'ceo-os-before-restore.json')}>Download before-restore backup</Button>
      <Button variant="ghost" onClick={() => setConfirm({ message: 'Delete this before-restore snapshot? Download it first if you need a copy.', action: () => localStorage.removeItem(snapshot.key) })}>Discard snapshot</Button>
    </li>)}</ul>
    {createPortal(<ConfirmModal isOpen={Boolean(confirm)} title="Confirm recovery action" message={confirm?.message} isConfirming={busy}
      onCancel={() => { if (!busy) setConfirm(null); }} onConfirm={async () => { await run(confirm.action); setConfirm(null); }} />, document.body)}
  </div>;
}
