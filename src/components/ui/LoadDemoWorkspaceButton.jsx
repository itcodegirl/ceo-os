import { useCallback, useState } from 'react';
import Button from './Button';
import ConfirmModal from './ConfirmModal';
import { useWorkspaceSetup } from '../../hooks/useWorkspaceSetup';

/**
 * "Load demo workspace" action with a confirmation gate.
 *
 * Loading the demo workspace REPLACES each local store with the demo seed, so
 * any records the user created on this device are destroyed. That conflicts
 * with the project's "never discard user data without trace" contract, so this
 * component asks first — but only when there is something to lose. A device
 * holding nothing but demo seed (the first-run case) loads straight through,
 * which keeps the setup choice on Focus Home a single click.
 *
 * Both call sites need this: Settings is the obvious one, but the first-run
 * prompt is shown whenever no setup choice has been saved, and a user can
 * create real records before ever making that choice.
 */
function LoadDemoWorkspaceButton({
  size = 'default',
  variant = 'ghost',
  onLoaded,
  onError,
  children = 'Load demo workspace',
}) {
  const { loadDemoWorkspace, countLocalRecordsAtRisk } = useWorkspaceSetup();
  const [recordsAtRisk, setRecordsAtRisk] = useState(0);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const runLoad = useCallback(async () => {
    setIsLoading(true);
    try {
      await loadDemoWorkspace();
      setIsConfirmOpen(false);
      onLoaded?.();
    } catch {
      setIsConfirmOpen(false);
      onError?.();
    } finally {
      setIsLoading(false);
    }
  }, [loadDemoWorkspace, onLoaded, onError]);

  // Anything other than a confident zero prompts. A count we could not
  // determine (null, or a consumer that predates this prop) must not be read
  // as "nothing to lose" — on a destructive action the safe default is to ask.
  const handleClick = useCallback(async () => {
    let atRisk = null;
    try {
      atRisk = typeof countLocalRecordsAtRisk === 'function'
        ? await countLocalRecordsAtRisk()
        : null;
    } catch {
      atRisk = null;
    }

    if (atRisk === 0) {
      await runLoad();
      return;
    }

    setRecordsAtRisk(atRisk);
    setIsConfirmOpen(true);
  }, [countLocalRecordsAtRisk, runLoad]);

  const recordLabel = recordsAtRisk === null
    ? 'Any records'
    : recordsAtRisk === 1
      ? '1 record'
      : `${recordsAtRisk} records`;

  return (
    <>
      <Button
        type="button"
        size={size}
        variant={variant}
        onClick={handleClick}
        loading={isLoading && !isConfirmOpen}
        icon={{ name: 'section', size: 14 }}
      >
        {children}
      </Button>
      <ConfirmModal
        isOpen={isConfirmOpen}
        title="Replace this workspace with demo data?"
        message={`Loading the demo workspace replaces the local data on this device. ${recordLabel} you created here will be removed and cannot be recovered from within the app. Export a backup first from Settings > Workspace data if you want to keep them.`}
        cancelLabel="Keep my data"
        confirmLabel="Replace with demo data"
        confirmAriaLabel="Replace local workspace with demo data"
        cancelAriaLabel="Keep local workspace data"
        isConfirming={isLoading}
        onCancel={() => setIsConfirmOpen(false)}
        onConfirm={runLoad}
      />
    </>
  );
}

export default LoadDemoWorkspaceButton;
