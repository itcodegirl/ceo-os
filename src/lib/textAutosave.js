// Writes for a resource stay ordered even when its page unmounts and remounts.
const writes = new Map();

export function enqueueTextWrite(key, write) {
  const pending = (writes.get(key) || Promise.resolve()).catch(() => {}).then(write);
  writes.set(key, pending);
  const cleanup = () => { if (writes.get(key) === pending) writes.delete(key); };
  pending.then(cleanup, cleanup);
  return pending;
}

export function createTextAutosave({ key, save, delay = 600, storage }) {
  if (!storage) {
    try { storage = window.sessionStorage; } catch { /* Storage access can be denied. */ }
  }
  const recoveryKey = `ceo-os:draft:${key}`;
  let recovered;
  try { recovered = JSON.parse(storage.getItem(recoveryKey)); } catch { /* storage may be unavailable */ }
  let snapshot = { value: typeof recovered?.value === 'string' ? recovered.value : '',
    status: typeof recovered?.value === 'string' ? 'dirty' : 'idle' };
  let revision = 0;
  let token = recovered?.token;
  let timer;
  let pending;
  let queuedRevision = -1;
  const listeners = new Set();
  const publish = (next) => { snapshot = { ...snapshot, ...next }; listeners.forEach((fn) => fn()); };
  const clearRecovery = (savedToken) => {
    try {
      if (JSON.parse(storage.getItem(recoveryKey))?.token === savedToken) storage.removeItem(recoveryKey);
    } catch { /* Keep the in-memory draft when storage is unavailable. */ }
  };
  const flush = () => {
    clearTimeout(timer);
    if (snapshot.status === 'idle' || snapshot.status === 'saved') return Promise.resolve(true);
    if (pending && queuedRevision === revision) return pending;
    const savingRevision = revision;
    const savingToken = token;
    const value = snapshot.value;
    queuedRevision = revision;
    publish({ status: 'saving' });
    pending = enqueueTextWrite(key, () => save(value)).then(() => {
      clearRecovery(savingToken);
      if (revision === savingRevision) { revision += 1; publish({ status: 'saved' }); }
      return true;
    }, () => {
      if (revision === savingRevision) publish({ status: 'error' });
      return false;
    }).finally(() => { if (queuedRevision === savingRevision) pending = undefined; });
    return pending;
  };
  return {
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    getSnapshot: () => snapshot,
    getRevision: () => revision,
    set(value) {
      revision += 1;
      token = `${Date.now()}:${Math.random()}`;
      try { storage.setItem(recoveryKey, JSON.stringify({ value, token })); } catch { /* still attempt the real save */ }
      publish({ value, status: 'dirty' });
      clearTimeout(timer);
      timer = setTimeout(flush, delay);
    },
    receive(value, startedAt = revision) {
      if (startedAt !== revision || !['idle', 'saved'].includes(snapshot.status)) return;
      revision += 1;
      publish({ value });
    },
    clear() {
      clearTimeout(timer);
      clearRecovery(token);
      revision += 1;
      publish({ value: '', status: 'idle' });
    },
    flush,
  };
}
