if (process.env.AUTH_PROVIDER && process.env.AUTH_PROVIDER !== 'supabase') {
  throw new Error('The Railway entrypoint requires AUTH_PROVIDER=supabase');
}
process.env.AUTH_PROVIDER = 'supabase';
process.env.SERVE_WEB = 'true';
await import('../artifacts/api-server/dist/index.mjs');
