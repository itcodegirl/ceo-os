import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PageHeader from '../components/ui/PageHeader';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { useAuthSession } from '../hooks/useAuthSession';
import { getSafeRedirectPath } from '../lib/safeRedirect';
import { isSupabaseConfigured, signInWithMagicLink } from '../lib/supabase';
import '../styles/forms.css';

const SIGNIN_DISABLED_COPY =
  'Magic-link sign in requires Supabase to be configured. The app is running in local-first mode on this device. You can keep using local data without signing in.';

function SignIn() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isInitializing, isDisabled } = useAuthSession();
  const [email, setEmail] = useState('');
  const [submitState, setSubmitState] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [sentTo, setSentTo] = useState('');

  // If a session already exists, send the user back to the home route.
  // Respect ?redirectTo=... so deep links reroute correctly post-sign-in,
  // but only for same-origin relative paths (no open redirects).
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    const params = new URLSearchParams(location.search);
    const target = getSafeRedirectPath(params.get('redirectTo'));
    navigate(target, { replace: true });
  }, [isAuthenticated, location.search, navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitState === 'sending') {
      return;
    }

    setErrorMessage('');
    setSubmitState('sending');
    try {
      const callbackUrl = `${window.location.origin}/auth/callback`;
      const result = await signInWithMagicLink({ email, redirectTo: callbackUrl });
      setSentTo(result.sentTo);
      setSubmitState('sent');
    } catch (caught) {
      setSubmitState('error');
      setErrorMessage(
        caught?.message || 'We could not send a magic link right now. Try again in a moment.',
      );
    }
  };

  if (isInitializing) {
    return (
      <section className="signin-page">
        <PageHeader title="Sign in" description="Checking your session…" />
      </section>
    );
  }

  if (isDisabled || !isSupabaseConfigured) {
    return (
      <section className="signin-page">
        <PageHeader
          title="Sign in"
          description="Cloud sync is not connected on this build."
        />
        <p className="helper-text">{SIGNIN_DISABLED_COPY}</p>
        <Button type="button" variant="ghost" onClick={() => navigate('/')}>
          Continue with local workspace
        </Button>
      </section>
    );
  }

  return (
    <section className="signin-page">
      <PageHeader
        title="Sign in"
        description="We email you a one-time magic link. No password to remember."
      />

      {submitState === 'sent' ? (
        <div className="signin-confirmation" role="status" aria-live="polite">
          <h2>Check your email</h2>
          <p className="helper-text">
            A sign-in link was sent to <strong>{sentTo}</strong>. Open it on this device to
            finish signing in. The link expires shortly for security.
          </p>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setSubmitState('idle');
              setSentTo('');
            }}
          >
            Use a different email
          </Button>
        </div>
      ) : (
        <form className="signin-form" onSubmit={handleSubmit} noValidate>
          <Input
            id="signin-email"
            label="Email address"
            type="email"
            name="email"
            value={email}
            autoComplete="email"
            required
            onChange={(event) => setEmail(event.target.value)}
            error={submitState === 'error' ? errorMessage : ''}
          />
          <Button type="submit" disabled={submitState === 'sending' || !email.trim()}>
            {submitState === 'sending' ? 'Sending magic link…' : 'Send magic link'}
          </Button>
          <p className="helper-text">
            Local-only data on this device stays put even if you sign in — Supabase becomes
            an additional source rather than a replacement.
          </p>
        </form>
      )}
    </section>
  );
}

export default SignIn;
