import { createContext, useContext, useEffect, useMemo, useRef, useState, type ComponentProps, type FormEvent, type ReactNode } from 'react';
import { ClerkProvider, Show as ClerkShow, SignIn as ClerkSignIn, SignUp as ClerkSignUp, useClerk as useLegacyActions, useUser as useLegacyUser } from '@clerk/react';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { getAuthPublicConfig, setAuthTokenGetter } from '@workspace/api-client-react';

// The migration is opt-in. Existing Replit builds retain their current provider;
// the separate Railway build explicitly selects Supabase.
const configuredProvider = import.meta.env.VITE_AUTH_PROVIDER ?? 'clerk';
if (!['clerk', 'supabase'].includes(configuredProvider)) throw new Error('VITE_AUTH_PROVIDER must be clerk or supabase');
export const usesSupabase = configuredProvider === 'supabase';
type Physician = { id: string; firstName: string | null; lastName: string | null; fullName: string | null; username: null; primaryEmailAddress: { emailAddress: string } | null };
type Listener = (event: { user: Physician | null }) => void;
function physician(session: Session | null): Physician | null {
  if (!session) return null;
  const name = typeof session.user.user_metadata.full_name === 'string' ? session.user.user_metadata.full_name : '';
  return { id: session.user.id, fullName: name || null, firstName: name.split(' ')[0] || null,
    lastName: name.split(' ').slice(1).join(' ') || null, username: null,
    primaryEmailAddress: session.user.email ? { emailAddress: session.user.email } : null };
}
type Context = { client: SupabaseClient | null; user: Physician | null; loading: boolean; error: string; subscribe: (listener: Listener) => () => void };
const AuthContext = createContext<Context | null>(null);
function useSupabaseContext() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('Authentication provider is not mounted');
  return value;
}
function SupabaseProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [user, setUser] = useState<Physician | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const currentUser = useRef<Physician | null>(null);
  const listeners = useRef(new Set<Listener>());
  const subscribe = useMemo(() => (listener: Listener) => {
    listeners.current.add(listener);
    listener({ user: currentUser.current });
    return () => { listeners.current.delete(listener); };
  }, []);
  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    setAuthTokenGetter(null);
    const update = (session: Session | null) => {
      if (!active) return;
      currentUser.current = physician(session);
      for (const listener of listeners.current) listener({ user: currentUser.current });
      setUser(currentUser.current);
      setLoading(false);
    };
    void (async () => {
      try {
        const config = await getAuthPublicConfig();
        if (config.provider !== 'supabase' || !config.supabaseUrl || !config.publishableKey) throw new Error('Frontend and API authentication settings do not match. Configure Supabase before enabling this build.');
        if (!active) return;
        const supabase = createClient(config.supabaseUrl, config.publishableKey, {
          auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
        });
        setClient(supabase);
        setAuthTokenGetter(async () => {
          const { data, error: sessionError } = await supabase.auth.getSession();
          if (sessionError) throw sessionError;
          return data.session?.access_token ?? null;
        });
        const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => update(session));
        unsubscribe = () => {
          subscription.subscription.unsubscribe();
          supabase.auth.stopAutoRefresh();
        };
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        update(data.session);
      } catch {
        if (active) { setError('Supabase sign-in is not ready. Check the project configuration and API connection. No alternative provider was used.'); setLoading(false); }
      }
    })();
    return () => { active = false; unsubscribe?.(); setAuthTokenGetter(null); };
  }, []);
  return <AuthContext.Provider value={{ client, user, loading, error, subscribe }}>{children}</AuthContext.Provider>;
}
export function RegistryAuthProvider(props: ComponentProps<typeof ClerkProvider>) {
  return usesSupabase ? <SupabaseProvider>{props.children}</SupabaseProvider> : <ClerkProvider {...props} />;
}
function useSupabaseUser() {
  const { user, loading } = useSupabaseContext();
  return { user, isLoaded: !loading, isSignedIn: Boolean(user) };
}
function useSupabaseActions() {
  const { client, subscribe } = useSupabaseContext();
  return useMemo(() => ({
    addListener: subscribe,
    async signOut(options?: { redirectUrl?: string }) {
      if (!client) throw new Error('Authentication is not configured');
      const { error } = await client.auth.signOut();
      if (error) throw error;
      if (options?.redirectUrl) window.location.assign(options.redirectUrl);
    },
  }), [client, subscribe]);
}
export const useUser = usesSupabase ? useSupabaseUser : useLegacyUser;
export const useClerk = usesSupabase ? useSupabaseActions : useLegacyActions;
export function Show({ when, children }: { when: 'signed-in' | 'signed-out'; children: ReactNode }) {
  if (!usesSupabase) return <ClerkShow when={when}>{children}</ClerkShow>;
  return <SupabaseVisibility when={when}>{children}</SupabaseVisibility>;
}
function SupabaseVisibility({ when, children }: { when: 'signed-in' | 'signed-out'; children: ReactNode }) {
  const { user, loading, error } = useSupabaseContext();
  if (loading) return when === 'signed-out' ? <p role="status">Loading your account…</p> : null;
  if (error) return when === 'signed-out' ? <p className="field-hint" role="alert">{error}</p> : null;
  return Boolean(user) === (when === 'signed-in') ? <>{children}</> : null;
}
export function SignIn(props: ComponentProps<typeof ClerkSignIn>) {
  return usesSupabase ? <SupabaseForm signup={false} /> : <ClerkSignIn {...props} />;
}
export function SignUp(props: ComponentProps<typeof ClerkSignUp>) {
  return usesSupabase ? <SupabaseForm signup /> : <ClerkSignUp {...props} />;
}
function SupabaseForm({ signup }: { signup: boolean }) {
  const { client, user, loading, error: setupError } = useSupabaseContext();
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const [mode, setMode] = useState<'sign-in' | 'sign-up' | 'request-reset' | 'change-password'>(
    new URLSearchParams(window.location.search).get('recovery') === '1' ? 'change-password' : signup ? 'sign-up' : 'sign-in');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (user && mode !== 'change-password' && mode !== 'request-reset') window.location.replace(`${base}/registries`);
  }, [user, mode, base]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!client || pending) return;
    setPending(true); setError(''); setMessage('');
    try {
      if (mode === 'request-reset') {
        const result = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}${base}/sign-in?recovery=1` });
        if (result.error) throw result.error;
        setMessage('If this email has an account, a password reset link will arrive shortly. Open it in this browser.');
      } else if (mode === 'change-password') {
        if (!user) throw new Error('This recovery link is invalid or expired. Request a new password reset link.');
        const result = await client.auth.updateUser({ password });
        if (result.error) throw result.error;
        window.location.replace(`${base}/registries`);
      } else if (mode === 'sign-up') {
        const result = await client.auth.signUp({ email: email.trim(), password,
          options: { data: { full_name: name.trim() }, emailRedirectTo: `${window.location.origin}${base}/sign-in` } });
        if (result.error) throw result.error;
        if (!result.data.session) setMessage('Check your email to confirm your account. Open the confirmation link in this browser, then sign in.');
      } else {
        const result = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (result.error) throw result.error;
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The request could not be completed. Please try again.'); }
    finally { setPending(false); }
  }
  const title = mode === 'sign-up' ? 'Create your physician account' : mode === 'request-reset' ? 'Reset your password' : mode === 'change-password' ? 'Choose a new password' : 'Welcome back';
  return <section className="panel" style={{ padding: 28, width: 440, maxWidth: '100%' }} aria-label="Physician authentication">
    <h1 style={{ fontSize: 26 }}>{title}</h1><p>One account for the renal and breast registries.</p>
    {(setupError || error) && <p role="alert" className="field-hint">{setupError || error}</p>}
    {message && <p role="status">{message}</p>}
    <form onSubmit={submit} style={{ display: 'grid', gap: 16, marginTop: 20 }}>
      {mode === 'sign-up' && <label className="label">Physician name<input className="field" required maxLength={120} value={name} onChange={e => setName(e.target.value)} autoComplete="name" /></label>}
      {mode !== 'change-password' && <label className="label">Email<input className="field" required type="email" maxLength={254} value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></label>}
      {mode !== 'request-reset' && <label className="label">Password<input className="field" required type="password" minLength={mode === 'sign-in' ? 1 : 8} value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} /></label>}
      <button className="button button-primary" disabled={pending || loading || !client || Boolean(setupError)}>{pending ? 'Please wait…' : mode === 'sign-up' ? 'Create account' : mode === 'request-reset' ? 'Send reset link' : mode === 'change-password' ? 'Save password' : 'Sign in'}</button>
    </form>
    <div style={{ display: 'grid', gap: 12, marginTop: 20 }}>
      {mode === 'sign-in' && <button className="button button-quiet" type="button" onClick={() => { setMode('request-reset'); setError(''); setMessage(''); }}>Forgot password?</button>}
      <a href={`${base}${signup ? '/sign-in' : '/sign-up'}`}>{signup ? 'Already registered? Sign in' : 'Create a physician account'}</a>
      {(mode === 'request-reset' || mode === 'change-password') && <a href={`${base}/sign-in`}>Back to sign in</a>}
    </div>
  </section>;
}
