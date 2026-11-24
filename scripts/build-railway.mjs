import { spawnSync } from 'node:child_process';

// One portable service; no auth/database credentials are embedded in the bundle.
// Runtime public Supabase configuration comes from /api/auth/config.
const env = {
  ...process.env,
  NODE_ENV: 'production',
  PORT: process.env.PORT || '3000',
  BASE_PATH: '/',
  VITE_AUTH_PROVIDER: 'supabase',
};
for (const args of [
  ['--filter', '@workspace/api-spec', 'run', 'codegen'],
  ['--filter', '@workspace/api-server', 'run', 'typecheck'],
  ['--filter', '@workspace/renal-cancer-study', 'run', 'typecheck'],
  ['--filter', '@workspace/renal-cancer-study', 'run', 'build'],
  ['--filter', '@workspace/api-server', 'run', 'build'],
]) {
  const result = spawnSync('pnpm', args, { env, stdio: 'inherit' });
  if (result.error || result.status !== 0) process.exit(result.status || 1);
}
