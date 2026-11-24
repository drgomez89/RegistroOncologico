export function databaseConnection(env: Record<string, string | undefined> = process.env): string {
  const provider = env.AUTH_PROVIDER ?? 'clerk';
  if (provider !== 'clerk' && provider !== 'supabase') throw new Error('AUTH_PROVIDER must be clerk or supabase');
  if (provider === 'clerk') {
    if (!env.DATABASE_URL) throw new Error('DATABASE_URL must be set');
    return env.DATABASE_URL;
  }
  if (!env.SUPABASE_DATABASE_URL) throw new Error('SUPABASE_DATABASE_URL is required; refusing to use the Replit database in Supabase mode');
  try {
    const url = new URL(env.SUPABASE_DATABASE_URL);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error();
    url.searchParams.set('sslmode', 'verify-full');
    return url.toString();
  } catch { throw new Error('SUPABASE_DATABASE_URL must be a valid PostgreSQL connection URL'); }
}
