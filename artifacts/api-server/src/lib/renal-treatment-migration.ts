/**
 * Additive, repeatable migration for databases created before per-line outcomes.
 * Run before accepting requests so old registries never serve missing columns.
 * No defaults/backfill: existing rows remain unclassified (NULL).
 */
export async function migrateRenalTreatmentOutcomes(
  database: { query: (sql: string) => Promise<unknown> },
): Promise<void> {
  await database.query(`
    ALTER TABLE renal_study_treatments
      ADD COLUMN IF NOT EXISTS clinical_response text,
      ADD COLUMN IF NOT EXISTS discontinuation_reason text
  `);
}
