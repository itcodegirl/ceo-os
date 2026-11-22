import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  WORKSPACE_SETUP_STORAGE_KEY,
  WORKSPACE_SETUP_UPDATED_EVENT,
  WORKSPACE_SETUP_MODES,
  getWorkspaceSetupMode,
  hasWorkspaceSetupChoice,
} from '../lib/workspaceSetup';

function readWorkspaceSetupState() {
  return {
    mode: getWorkspaceSetupMode(),
    hasChoice: hasWorkspaceSetupChoice(),
  };
}

export function useWorkspaceSetup() {
  const [state, setState] = useState(() => readWorkspaceSetupState());

  const refreshState = useCallback(() => {
    setState(readWorkspaceSetupState());
  }, []);

  useEffect(() => {
    const handleStorageChange = (event) => {
      if (event?.key === null || event?.key === WORKSPACE_SETUP_STORAGE_KEY) {
        refreshState();
      }
    };

    window.addEventListener(WORKSPACE_SETUP_UPDATED_EVENT, refreshState);
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener(WORKSPACE_SETUP_UPDATED_EVENT, refreshState);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [refreshState]);

  const previewSetupChange = useCallback(async (mode) => {
    const { previewWorkspaceSetupChange } = await import('../lib/workspaceDemoChange');
    return previewWorkspaceSetupChange(mode);
  }, []);
  const applySetupChange = useCallback(async (plan) => {
    const { applyWorkspaceSetupChange } = await import('../lib/workspaceDemoChange');
    await applyWorkspaceSetupChange(plan);
    refreshState();
  }, [refreshState]);
  const startBlankWorkspace = useCallback(async () => applySetupChange(await previewSetupChange('blank')), [applySetupChange, previewSetupChange]);
  const loadDemoWorkspace = useCallback(async () => applySetupChange(await previewSetupChange('demo')), [applySetupChange, previewSetupChange]);
  const countLocalRecordsAtRisk = useCallback(async () => (await previewSetupChange('demo')).preserved, [previewSetupChange]);

  return useMemo(() => ({
    previewSetupChange,
    applySetupChange,
    mode: state.mode,
    hasChoice: state.hasChoice,
    isDemoMode: state.mode === WORKSPACE_SETUP_MODES.demo,
    isBlankMode: state.mode === WORKSPACE_SETUP_MODES.blank,
    startBlankWorkspace,
    loadDemoWorkspace,
    countLocalRecordsAtRisk,
    clearDemoData: startBlankWorkspace,
  }), [
    previewSetupChange,
    applySetupChange,
    countLocalRecordsAtRisk,
    loadDemoWorkspace,
    startBlankWorkspace,
    state.hasChoice,
    state.mode,
  ]);
}
