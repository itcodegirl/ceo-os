import { WORKSPACE_ACCOUNT_EVENT } from './workspaceOwnership';
const supabaseEnv = {
  url: import.meta.env.VITE_SUPABASE_URL,
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
};

const shouldLogSupabaseDebug = import.meta.env.DEV && import.meta.env.VITE_SUPABASE_DEBUG === 'true';

if ((!supabaseEnv.url || !supabaseEnv.anonKey) && shouldLogSupabaseDebug) {
  console.info(
    'Supabase is not configured; running in local-first mode. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable live persistence.',
  );
}

export const isSupabaseConfigured = Boolean(supabaseEnv.url && supabaseEnv.anonKey);

export const getSupabaseConfig = () => ({
  url: supabaseEnv.url || '',
  anonKey: supabaseEnv.anonKey || '',
});

let cachedSupabaseClient = null;
let cachedSupabaseClientPromise = null;

async function createSupabaseClient() {
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(supabaseEnv.url, supabaseEnv.anonKey, {
    auth: {
      // Persist the session so the magic-link sign-in flow survives reloads
      // and tab switches. Authenticated repository calls require a session
      // to satisfy RLS policies based on auth.uid().
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      storageKey: 'ceo-os:auth',
    },
  });
  client.auth.onAuthStateChange(() => {
    window.dispatchEvent(new Event(WORKSPACE_ACCOUNT_EVENT));
  });
  return client;
}

export async function getSupabaseSession() {
  const supabaseClient = await getSupabaseClient();
  if (!supabaseClient) {
    return null;
  }

  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    throw error;
  }
  return data?.session || null;
}

export async function signInWithMagicLink({ email, redirectTo } = {}) {
  const supabaseClient = await getSupabaseClient();
  if (!supabaseClient) {
    const configurationError = new Error('Supabase is not configured.');
    configurationError.code = 'SUPABASE_NOT_CONFIGURED';
    throw configurationError;
  }

  const trimmedEmail = typeof email === 'string' ? email.trim() : '';
  if (!trimmedEmail) {
    const validationError = new Error('Email is required to sign in.');
    validationError.code = 'AUTH_EMAIL_REQUIRED';
    throw validationError;
  }

  const options = redirectTo ? { emailRedirectTo: redirectTo } : undefined;
  const { error } = await supabaseClient.auth.signInWithOtp({
    email: trimmedEmail,
    options,
  });

  if (error) {
    throw error;
  }

  return { sentTo: trimmedEmail };
}

export async function signOut() {
  const supabaseClient = await getSupabaseClient();
  if (!supabaseClient) {
    return;
  }
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    throw error;
  }
}

export async function getSupabaseClient() {
  if (!isSupabaseConfigured) {
    return null;
  }

  if (cachedSupabaseClient) {
    return cachedSupabaseClient;
  }

  if (!cachedSupabaseClientPromise) {
    cachedSupabaseClientPromise = createSupabaseClient()
      .then((client) => {
        cachedSupabaseClient = client;
        return client;
      })
      .catch((error) => {
        cachedSupabaseClientPromise = null;
        throw error;
      });
  }

  return cachedSupabaseClientPromise;
}

export async function requireSupabaseUserId() {
  const supabaseClient = await getSupabaseClient();
  if (!supabaseClient) {
    return '';
  }

  const { data, error } = await supabaseClient.auth.getUser();
  if (error) {
    throw error;
  }

  const userId = data?.user?.id;
  if (!userId) {
    const authError = new Error('Supabase authentication is required for this action.');
    authError.code = 'SUPABASE_AUTH_REQUIRED';
    throw authError;
  }

  return userId;
}
