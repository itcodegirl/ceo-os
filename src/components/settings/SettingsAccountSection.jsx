import { useState } from 'react';
import { Link } from 'react-router-dom';
import SectionCard from '../ui/SectionCard';
import Button from '../ui/Button';
import { useAuthSession } from '../../hooks/useAuthSession';
import { isSupabaseConfigured, signOut } from '../../lib/supabase';

/**
 * Account section of the Settings page. Self-contained — owns the sign-out
 * state and renders the appropriate copy for unconfigured / initializing /
 * authenticated / unauthenticated branches. Extracted from Settings.jsx so
 * the page no longer has to carry auth state alongside every other concern.
 */
function SettingsAccountSection() {
  const {
    user,
    isAuthenticated,
    isInitializing: isAuthInitializing,
    isDisabled: isAuthDisabled,
  } = useAuthSession();
  const [signOutState, setSignOutState] = useState('idle');
  const [signOutError, setSignOutError] = useState('');

  const handleSignOut = async () => {
    if (signOutState === 'pending') {
      return;
    }
    setSignOutState('pending');
    setSignOutError('');
    try {
      await signOut();
      setSignOutState('idle');
    } catch (caught) {
      setSignOutError(caught?.message || 'Sign out failed.');
      setSignOutState('error');
    }
  };

  return (
    <SectionCard title="Account" iconName="settings">
      {!isSupabaseConfigured || isAuthDisabled ? (
        <p className="helper-text">
          Cloud sync is not configured for this build. Local data on this device is the
          source of truth. To enable accounts, set <code>VITE_SUPABASE_URL</code> and{' '}
          <code>VITE_SUPABASE_ANON_KEY</code>, then redeploy.
        </p>
      ) : isAuthInitializing ? (
        <p className="helper-text" role="status" aria-live="polite">
          Checking your session…
        </p>
      ) : isAuthenticated ? (
        <div className="settings-account">
          <p className="helper-text">
            Signed in as <strong>{user?.email || 'authenticated user'}</strong>.
          </p>
          <Button
            type="button"
            variant="ghost"
            size="small"
            onClick={handleSignOut}
            disabled={signOutState === 'pending'}
          >
            {signOutState === 'pending' ? 'Signing out…' : 'Sign out'}
          </Button>
          {signOutError ? (
            <p role="alert" className="form-error">{signOutError}</p>
          ) : null}
        </div>
      ) : (
        <div className="settings-account">
          <p className="helper-text">
            You are not signed in. Cloud sync stays off until you sign in. Local data on
            this device is preserved either way.
          </p>
          <Link to="/sign-in" className="settings-account__signin-link">
            Sign in with magic link
          </Link>
        </div>
      )}
    </SectionCard>
  );
}

export default SettingsAccountSection;
