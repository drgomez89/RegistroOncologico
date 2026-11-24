type Environment = Record<string, string | undefined>;
export function authProvider(env: Environment = process.env): 'clerk' | 'supabase' {
  const provider = env.AUTH_PROVIDER ?? 'clerk';
  if (provider !== 'clerk' && provider !== 'supabase') throw new Error('AUTH_PROVIDER must be clerk or supabase');
  return provider;
}

// Only a deliberately public key may ever reach the browser. In particular,
// reject Supabase secret keys and legacy service_role JWTs, even if misconfigured.
export function supabasePublicConfig(env: Environment = process.env) {
  const url = new URL(env.SUPABASE_URL || '');
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('SUPABASE_URL must be the HTTPS project origin');
  }
  const key = env.SUPABASE_PUBLISHABLE_KEY || '';
  let legacyAnon = false;
  if (key.split('.').length === 3) {
    try { legacyAnon = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'anon'; } catch { /* invalid key */ }
  }
  if (!key.startsWith('sb_publishable_') && !legacyAnon) {
    throw new Error('Set a Supabase publishable or legacy anon key, never a secret/service_role key');
  }
  return { provider: 'supabase' as const, supabaseUrl: url.origin, publishableKey: key };
}

export class AuthUnavailable extends Error {}
export async function verifiedSupabaseIdentity(
  authorization: string | undefined,
  config = supabasePublicConfig(),
  request: typeof fetch = fetch,
) {
  if (!authorization?.match(/^Bearer [^\s]+$/i)) return null;
  let response: Response;
  try {
    response = await request(`${config.supabaseUrl}/auth/v1/user`, {
      headers: { apikey: config.publishableKey, authorization },
      signal: AbortSignal.timeout(8000),
    });
  } catch { throw new AuthUnavailable('Authentication service unavailable'); }
  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok) throw new AuthUnavailable('Authentication service unavailable');
  let body: unknown;
  try { body = await response.json(); } catch { throw new AuthUnavailable('Invalid authentication response'); }
  if (!body || typeof body !== 'object') throw new AuthUnavailable('Invalid authentication response');
  const user = body as { id?: unknown; user_metadata?: { full_name?: unknown } };
  if (typeof user.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id)) {
    throw new AuthUnavailable('Invalid authentication identity');
  }
  const name = user.user_metadata?.full_name;
  return {
    id: user.id,
    displayName: typeof name === 'string' && name.trim() ? name.trim().slice(0, 120) : `Physician ${user.id.slice(-6)}`,
  };
}
