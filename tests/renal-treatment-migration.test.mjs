import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { migrateRenalTreatmentOutcomes } from '../artifacts/api-server/src/lib/renal-treatment-migration.ts';

const require = createRequire(new URL('../lib/db/package.json', import.meta.url));
const { Pool } = require('pg');

test('additive migration preserves old rows and supports list/detail/create/update on the previous schema', {
  skip: !process.env.DATABASE_URL && 'DATABASE_URL is required for the database compatibility test',
}, async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Temporary tables shadow the real registry only on this connection.
    // No real patient rows, public tables or public sequences are modified.
    await client.query(`
      CREATE TEMP TABLE renal_study_treatments (
        id integer PRIMARY KEY, case_id integer NOT NULL,
        sequence_number integer NOT NULL, regimen text NOT NULL,
        start_date date NOT NULL, end_date date, ongoing boolean NOT NULL,
        UNIQUE (case_id, sequence_number)
      ) ON COMMIT DROP;
      INSERT INTO renal_study_treatments
        VALUES (1, 100, 1, 'Historical regimen', '2020-01-01', '2021-01-01', false)
    `);
    await migrateRenalTreatmentOutcomes(client);
    await migrateRenalTreatmentOutcomes(client); // Safe on every API restart.

    const { rows: [legacy] } = await client.query('SELECT * FROM renal_study_treatments WHERE id = 1');
    assert.equal(legacy.regimen, 'Historical regimen');
    assert.equal(legacy.clinical_response, null);
    assert.equal(legacy.discontinuation_reason, null);

    await client.query(`
      INSERT INTO renal_study_treatments
        (id, case_id, sequence_number, regimen, start_date, ongoing, clinical_response, discontinuation_reason)
      VALUES
        (2, 100, 2, 'Synthetic second regimen', '2021-02-01', true, 'Partial response', 'Toxicity'),
        (3, 101, 1, 'Synthetic other case', '2020-01-01', true, 'Stable disease', 'Other')
    `);
    const list = await client.query('SELECT * FROM renal_study_treatments ORDER BY case_id, sequence_number');
    assert.equal(list.rows.length, 3);
    const detail = await client.query('SELECT * FROM renal_study_treatments WHERE case_id = 100 ORDER BY sequence_number');
    assert.deepEqual(detail.rows.map(row => row.clinical_response), [null, 'Partial response']);
    assert.deepEqual(detail.rows.map(row => row.discontinuation_reason), [null, 'Toxicity']);

    // Case edits replace a case's treatment lines inside the existing transaction.
    await client.query('DELETE FROM renal_study_treatments WHERE case_id = 100');
    await client.query(`
      INSERT INTO renal_study_treatments
        (id, case_id, sequence_number, regimen, start_date, ongoing, clinical_response, discontinuation_reason)
      VALUES
        (4, 100, 1, 'Historical regimen', '2020-01-01', false, NULL, NULL),
        (5, 100, 2, 'Synthetic second regimen', '2021-02-01', false, 'Complete response', 'Planned completion')
    `);
    const reopened = await client.query('SELECT * FROM renal_study_treatments WHERE case_id = 100 ORDER BY sequence_number');
    assert.deepEqual(reopened.rows.map(row => row.clinical_response), [null, 'Complete response']);
    assert.deepEqual(reopened.rows.map(row => row.discontinuation_reason), [null, 'Planned completion']);
    const untouched = await client.query('SELECT * FROM renal_study_treatments WHERE case_id = 101');
    assert.equal(untouched.rows[0].clinical_response, 'Stable disease');
    assert.equal(untouched.rows[0].discontinuation_reason, 'Other');
  } finally {
    await client.query('ROLLBACK');
    client.release();
    await pool.end();
  }
});

test('migration errors propagate so startup cannot accept requests with an incompatible schema', async () => {
  await assert.rejects(
    migrateRenalTreatmentOutcomes({query: async () => { throw new Error('DDL permission denied'); }}),
    /DDL permission denied/,
  );
});
