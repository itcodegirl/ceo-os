import { useRef, useState } from 'react';
import Button from './Button';
import ConfirmModal from './ConfirmModal';
import { useWorkspaceSetup } from '../../hooks/useWorkspaceSetup';

// All setup actions preview the exact stores they will change and keep failures
// beside the action. The shared restore journal preserves the original workspace.
export default function LoadDemoWorkspaceButton({
  size = 'default', variant = 'ghost', action = 'demo', disabled = false,
  onLoaded, onError, children = 'Load demo workspace',
}) {
  const { previewSetupChange, applySetupChange } = useWorkspaceSetup();
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const prepare = async () => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try { setPlan(await previewSetupChange(action)); }
    catch (failure) { setError(failure.message || 'Unable to preview this workspace change.'); onError?.(); }
    finally { pending.current = false; setBusy(false); }
  };
  const apply = async () => {
    if (pending.current || !plan) return;
    pending.current = true; setBusy(true); setError('');
    try { await applySetupChange(plan); setPlan(null); onLoaded?.(); }
    catch (failure) { setError(failure.message || 'Unable to update this workspace.'); onError?.(); }
    finally { pending.current = false; setBusy(false); }
  };
  return <>
    <Button type="button" size={size} variant={variant} disabled={disabled || busy} onClick={prepare} loading={busy && !plan} icon={{ name: 'section', size: 14 }}>{children}</Button>
    {!plan && error ? <p role="alert" className="form-error">{error}</p> : null}
    <ConfirmModal isOpen={Boolean(plan)} title={action === 'demo' ? 'Review demo workspace changes' : 'Review demo cleanup'}
      message={plan ? `Opportunities, Content OS, and ${plan.weeks.length} week${plan.weeks.length === 1 ? '' : 's'}${plan.weeks.length ? ` (${plan.weeks.join(', ')})` : ''}: remove ${plan.removed} unchanged examples${action === 'demo' ? ` and add ${plan.added} fresh examples` : ''}. Keep ${plan.preserved} edited or authored records and reflections. An original snapshot will be available in Settings recovery tools. This changes local data only.` : ''}
      error={error} isConfirming={busy} onCancel={() => { if (!pending.current) { setPlan(null); setError(''); } }} onConfirm={apply}
      confirmLabel={action === 'demo' ? 'Load demo examples' : 'Clear unchanged examples'}
      confirmAriaLabel={action === 'demo' ? 'Confirm demo workspace changes' : 'Confirm demo cleanup'} />
  </>;
}
