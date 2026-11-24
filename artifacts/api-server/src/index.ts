import app from "./app";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";
import { migrateRenalTreatmentOutcomes } from "./lib/renal-treatment-migration";
import { authProvider, supabasePublicConfig } from "./lib/supabase-auth";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function start() {
  // Both development and production use this entry point. Complete schema
  // compatibility before listening, and fail explicitly if migration fails.
  if (authProvider() === 'supabase') {
    supabasePublicConfig();
    // External schema installation is explicit, never automatic startup DDL.
    const { rows } = await pool.query(`SELECT to_regclass('public.renal_study_cases') AS renal,
      to_regclass('public.renal_study_treatments') AS treatments, to_regclass('public.breast_study_cases') AS breast`);
    if (!rows[0]?.renal || !rows[0]?.treatments || !rows[0]?.breast) {
      throw new Error('Initialize the Supabase registry schema using deployment/supabase-schema.sql before starting');
    }
    const permissions = await pool.query(`SELECT c.relrowsecurity,
      has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE') AS anon_access,
      has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE') AS browser_access
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname IN
      ('renal_study_cases', 'renal_study_treatments', 'breast_study_cases')`);
    if (permissions.rows.length !== 3 || permissions.rows.some(row => !row.relrowsecurity || row.anon_access || row.browser_access)) {
      throw new Error('Registry tables must enable RLS and deny direct browser-role access; review deployment/supabase-schema.sql');
    }
  } else {
    await migrateRenalTreatmentOutcomes(pool);
    logger.info("Treatment outcome database migration completed");
  }

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
}

start().catch((err) => {
  logger.error({ err }, "Database migration failed; API was not started");
  process.exit(1);
});
