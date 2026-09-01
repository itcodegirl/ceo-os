import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import ErrorBoundary from './components/ui/ErrorBoundary';
import { useMetaMode } from './hooks/useMetaMode';
import { APP_ROUTES, filterRoutesByMetaMode, toNestedRoutePath } from './lib/routes';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Capture = lazy(() => import('./pages/Capture'));
const Journal = lazy(() => import('./pages/Journal'));
const Opportunities = lazy(() => import('./pages/Opportunities'));
const ContentOS = lazy(() => import('./pages/ContentOS'));
const WeeklyBrief = lazy(() => import('./pages/WeeklyBrief'));
const ChiefOfStaff = lazy(() => import('./pages/ChiefOfStaff'));
const OpsReliability = lazy(() => import('./pages/experimental/OpsReliability'));
const Settings = lazy(() => import('./pages/Settings'));
const SignIn = lazy(() => import('./pages/SignIn'));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));

const ROUTE_COMPONENTS = {
  'focus-home': Dashboard,
  capture: Capture,
  journal: Journal,
  opportunities: Opportunities,
  content: ContentOS,
  'weekly-brief': WeeklyBrief,
  'chief-of-staff': ChiefOfStaff,
  'ops-reliability': OpsReliability,
  settings: Settings,
};

function App() {
  const isMetaMode = useMetaMode();
  const visibleRoutes = filterRoutesByMetaMode(APP_ROUTES, isMetaMode);

  return (
    <ErrorBoundary name="App shell">
      <Suspense
        fallback={
          <div className="app-shell-load" role="status" aria-live="polite">
            Loading CEO OS...
          </div>
        }
      >
        <Routes>
          {/* Auth routes intentionally render outside the app shell so the
              sign-in surface is uncluttered and not gated behind a session. */}
          <Route path="/sign-in" element={<SignIn />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

          <Route path="/" element={<AppLayout />}>
            {visibleRoutes.map((route) => {
              const RouteComponent = ROUTE_COMPONENTS[route.id];
              if (!RouteComponent) {
                return null;
              }

              if (route.path === '/') {
                return <Route key={route.id} index element={<RouteComponent />} />;
              }

              return (
                <Route
                  key={route.id}
                  path={toNestedRoutePath(route.path)}
                  element={<RouteComponent />}
                />
              );
            })}
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;
