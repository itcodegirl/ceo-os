import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  WORKSPACE_SETUP_STORAGE_KEY,
  WORKSPACE_SETUP_UPDATED_EVENT,
  WORKSPACE_SETUP_MODES,
  getWorkspaceSetupMode,
  hasWorkspaceSetupChoice,
  saveWorkspaceSetupMode,
} from '../lib/workspaceSetup';

function readWorkspaceSetupState() {
  return {
    mode: getWorkspaceSetupMode(),
    hasChoice: hasWorkspaceSetupChoice(),
  };
}

async function loadWorkspaceSetupRepositories() {
  const [opportunities, content, weekly] = await Promise.all([
    import('../lib/opportunitiesRepository'),
    import('../lib/contentRepository'),
    import('../lib/weeklyRepository'),
  ]);

  return { opportunities, content, weekly };
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

  const startBlankWorkspace = useCallback(async () => {
    saveWorkspaceSetupMode(WORKSPACE_SETUP_MODES.blank);
    const { opportunities, content, weekly } = await loadWorkspaceSetupRepositories();
    opportunities.clearLocalOpportunityDemoData();
    content.clearLocalContentDemoData();
    weekly.clearLocalWeeklyDemoData();
    refreshState();
  }, [refreshState]);

  const loadDemoWorkspace = useCallback(async () => {
    saveWorkspaceSetupMode(WORKSPACE_SETUP_MODES.demo);
    const { opportunities, content, weekly } = await loadWorkspaceSetupRepositories();
    opportunities.resetLocalOpportunityDemoData();
    content.resetLocalContentDemoData();
    weekly.resetLocalWeeklyDemoData();
    refreshState();
  }, [refreshState]);

  /**
   * How many local records `loadDemoWorkspace` would destroy. The demo reset
   * replaces each local store outright, so anything the user created is lost;
   * callers confirm before calling when this is above zero. A device holding
   * only demo seed returns 0, which keeps the first-run choice prompt-free.
   *
   * Returns null when the stores cannot be read. Callers must treat that as
   * "unknown, so ask" rather than "nothing at risk" — failing open on a
   * destructive action is how data gets lost silently.
   */
  const countLocalRecordsAtRisk = useCallback(async () => {
    try {
      const { opportunities, content, weekly } = await loadWorkspaceSetupRepositories();
      return opportunities.countNonDemoLocalOpportunities()
        + content.countNonDemoLocalContentItems()
        + weekly.countNonDemoLocalWeeklyRecords();
    } catch {
      return null;
    }
  }, []);

  return useMemo(() => ({
    mode: state.mode,
    hasChoice: state.hasChoice,
    isDemoMode: state.mode === WORKSPACE_SETUP_MODES.demo,
    isBlankMode: state.mode === WORKSPACE_SETUP_MODES.blank,
    startBlankWorkspace,
    loadDemoWorkspace,
    countLocalRecordsAtRisk,
    clearDemoData: startBlankWorkspace,
  }), [
    countLocalRecordsAtRisk,
    loadDemoWorkspace,
    startBlankWorkspace,
    state.hasChoice,
    state.mode,
  ]);
}
