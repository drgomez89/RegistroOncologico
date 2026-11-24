import assert from 'node:assert/strict';
import test from 'node:test';
import { authProvider, supabasePublicConfig, verifiedSupabaseIdentity, AuthUnavailable } from '../artifacts/api-server/src/lib/supabase-auth.ts';
import { databaseConnection } from '../lib/db/src/connection.ts';

const env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_test_only' };
const config = supabasePublicConfig(env);
const id = '11111111-1111-4111-8111-111111111111';

test('provider switch is explicit and never accepts an unknown provider', () => {
  assert.equal(authProvider({}), 'clerk');
  assert.equal(authProvider({ AUTH_PROVIDER: 'supabase' }), 'supabase');
  assert.throws(() => authProvider({ AUTH_PROVIDER: 'wrong' }));
});
test('public configuration rejects privileged Supabase keys', () => {
  assert.deepEqual(config, { provider: 'supabase', supabaseUrl: env.SUPABASE_URL, publishableKey: env.SUPABASE_PUBLISHABLE_KEY });
  for (const key of ['', 'sb_secret_synthetic_test_only', `x.${Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')}.x`]) {
    assert.throws(() => supabasePublicConfig({ ...env, SUPABASE_PUBLISHABLE_KEY: key }));
  }
  assert.throws(() => supabasePublicConfig({ ...env, SUPABASE_URL: 'http://example.supabase.co' }));
  assert.throws(() => supabasePublicConfig({ ...env, SUPABASE_URL: 'https://example.supabase.co/untrusted-path' }));
});
test('missing or malformed credentials are not treated as authenticated', async () => {
  for (const token of [undefined, '', 'Basic anything', 'Bearer ', 'Bearer a b']) {
    assert.equal(await verifiedSupabaseIdentity(token, config), null);
  }
});
test('identity is obtained from Supabase rather than unverified token claims', async () => {
  let calls = 0;
  const request: typeof fetch = async (input, options) => {
    calls++;
    assert.equal(input, `${env.SUPABASE_URL}/auth/v1/user`);
    assert.equal((options?.headers as Record<string,string>).authorization, 'Bearer synthetic-token');
    assert.equal((options?.headers as Record<string,string>).apikey, env.SUPABASE_PUBLISHABLE_KEY);
    return Response.json({ id, user_metadata: { full_name: ' Test Physician ' } });
  };
  assert.deepEqual(await verifiedSupabaseIdentity('Bearer synthetic-token', config, request), { id, displayName: 'Test Physician' });
  assert.equal(calls, 1);
});
test('expired sessions are rejected and provider failures never fall back to Clerk', async () => {
  assert.equal(await verifiedSupabaseIdentity('Bearer expired', config, async () => new Response('', {status:401})), null);
  await assert.rejects(() => verifiedSupabaseIdentity('Bearer token', config, async () => new Response('', {status:503})), AuthUnavailable);
  await assert.rejects(() => verifiedSupabaseIdentity('Bearer token', config, async () => { throw new Error('network'); }), AuthUnavailable);
  await assert.rejects(() => verifiedSupabaseIdentity('Bearer token', config, async () => Response.json({id:'not-a-uuid'})), AuthUnavailable);
  await assert.rejects(() => verifiedSupabaseIdentity('Bearer token', config, async () => Response.json(null)), AuthUnavailable);
});
test('Supabase mode cannot accidentally connect to the managed database or disable TLS', () => {
  const managed = 'postgresql://synthetic:synthetic@managed.invalid/test';
  assert.equal(databaseConnection({DATABASE_URL:managed}), managed);
  assert.throws(() => databaseConnection({AUTH_PROVIDER:'supabase',DATABASE_URL:managed}), /refusing/);
  const target = new URL(databaseConnection({AUTH_PROVIDER:'supabase',DATABASE_URL:managed,SUPABASE_DATABASE_URL:'postgresql://synthetic:synthetic@pooler.invalid:5432/postgres?sslmode=disable'}));
  assert.equal(target.hostname, 'pooler.invalid');
  assert.equal(target.searchParams.get('sslmode'), 'verify-full');
  assert.throws(() => databaseConnection({AUTH_PROVIDER:'supabase',SUPABASE_DATABASE_URL:'invalid-sensitive-input'}), error => !String(error).includes('invalid-sensitive-input'));
});
