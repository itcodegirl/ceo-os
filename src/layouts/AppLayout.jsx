import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import Sidebar from '../components/ui/Sidebar';
import Topbar from '../components/ui/Topbar';
import SystemPulse from '../components/ui/SystemPulse';
import ErrorBoundary from '../components/ui/ErrorBoundary';
import StorageCorruptionBanner from '../components/ui/StorageCorruptionBanner';
import StorageQuotaBanner from '../components/ui/StorageQuotaBanner';
import LocalOnlyNotice from '../components/ui/LocalOnlyNotice';
import ToastProvider from '../components/ui/ToastProvider';
import { useSettings } from '../hooks/useSettings';
import { usePageMeta } from '../hooks/usePageMeta';
import { useThemePreference } from '../hooks/useThemePreference';
import { useToast } from '../hooks/useToast';
import { useOfflineQueueDrain } from '../hooks/useOfflineQueueDrain';
import { resolvePageMeta } from '../lib/pageMeta';
import { resolveTeamName } from '../lib/settings';
import {
  OPPORTUNITY_QUEUE_KIND_CREATE,
  OPPORTUNITY_QUEUE_KIND_DELETE,
  OPPORTUNITY_QUEUE_KIND_UPDATE,
  createOpportunity,
  deleteOpportunity,
  updateOpportunity,
} from '../lib/opportunitiesRepository';
import {
  CONTENT_QUEUE_KIND_CREATE,
  CONTENT_QUEUE_KIND_DELETE,
  CONTENT_QUEUE_KIND_UPDATE,
  createContentItem,
  deleteContentItem,
  updateContentItem,
} from '../lib/contentRepository';

// Replay handlers for the offline write queue. The `skipQueue: true` option
// ensures a failed replay doesn't enqueue itself a second time — the
// drainOfflineQueue contract already keeps the entry in place when replay
// rejects, and a new attempt fires on the next reconnect.
const OFFLINE_QUEUE_HANDLERS = {
  [OPPORTUNITY_QUEUE_KIND_CREATE]: (payload) =>
    createOpportunity(payload, { skipQueue: true }),
  [OPPORTUNITY_QUEUE_KIND_UPDATE]: ({ id, payload, expectedUpdatedAt } = {}) =>
    updateOpportunity(id, payload, { skipQueue: true, expectedUpdatedAt }),
  [OPPORTUNITY_QUEUE_KIND_DELETE]: ({ id } = {}) =>
    deleteOpportunity(id, { skipQueue: true }),
  [CONTENT_QUEUE_KIND_CREATE]: (payload) =>
    createContentItem(payload, { skipQueue: true }),
  [CONTENT_QUEUE_KIND_UPDATE]: ({ id, payload, expectedUpdatedAt } = {}) =>
    updateContentItem(id, payload, { skipQueue: true, expectedUpdatedAt }),
  [CONTENT_QUEUE_KIND_DELETE]: ({ id } = {}) =>
    deleteContentItem(id, { skipQueue: true }),
};

function AppShellInner() {
  const location = useLocation();
  const navigate = useNavigate();
  const mainRef = useRef(null);
  const { settings } = useSettings();
  const { showToast } = useToast();
  // Mounted at the shell so the html data-theme attribute is set on every
  // authenticated render and stays in sync with OS preference changes.
  useThemePreference();

  useOfflineQueueDrain({
    handlerByKind: OFFLINE_QUEUE_HANDLERS,
    onDrainFailure: (result) => {
      showToast(
        `${result.failed} queued write${result.failed === 1 ? '' : 's'} could not sync. Check your connection and try again.`,
      );
    },
  });

  const teamName = resolveTeamName(settings?.teamName);
  const appName = `${teamName} CEO OS`;
  const currentPageTitle = useMemo(() => {
    const pageMeta = resolvePageMeta(appName, location.pathname);
    const topbarTitle = String(pageMeta?.title || '').split('|')[0].trim();
    return topbarTitle || 'Focus Home';
  }, [appName, location.pathname]);

  const showSystemPulse = useMemo(() => {
    const path = location.pathname || '/';
    // Focus Home already surfaces the "next move" + open-loops signal in its
    // own panels, so the System Pulse strip there is duplicate chrome that
    // works against the calm-OS thesis. Settings and Ops Reliability are
    // configuration/diagnostic surfaces that don't need the cross-system
    // signal at all.
    return path !== '/' && path !== '/settings' && path !== '/ops-reliability';
  }, [location.pathname]);

  usePageMeta(appName);

  const handleReturnHome = useCallback(() => {
    navigate('/', { replace: true });
  }, [navigate]);

  useEffect(() => {
    const mainElement = mainRef.current;

    if (!mainElement || typeof mainElement.focus !== 'function') {
      return;
    }

    try {
      mainElement.focus({ preventScroll: true });
    } catch {
      mainElement.focus();
    }
  }, [location.pathname]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <Sidebar />
      <div className="app-main">
        <Topbar pageTitle={currentPageTitle} />
        <StorageCorruptionBanner />
        <StorageQuotaBanner />
        <LocalOnlyNotice />
        {showSystemPulse ? <SystemPulse /> : null}
        <main className="app-content" id="main-content" tabIndex="-1" ref={mainRef}>
          <ErrorBoundary
            key={location.pathname}
            resetKey={location.key}
            name={currentPageTitle}
            onReturnHome={handleReturnHome}
          >
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

function AppLayout() {
  return (
    <ToastProvider>
      <AppShellInner />
    </ToastProvider>
  );
}

export default AppLayout;
