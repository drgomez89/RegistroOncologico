import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toDateInput, formatCalendarDate } from '../artifacts/renal-cancer-study/src/lib/calendar-date.ts';
import { validateCaseStatus } from '../artifacts/api-server/src/lib/case-status.ts';

test('calendar dates accept date-only and API ISO responses without invalid or shifted days', () => {
  for (const value of ['2024-02-29', '2024-02-29T00:00:00.000Z', new Date('2024-02-29T00:00:00Z')]) {
    assert.equal(toDateInput(value), '2024-02-29');
    assert.equal(formatCalendarDate(value), 'Feb 29, 2024');
  }
  assert.equal(formatCalendarDate('2025-03-01T00:00:00.000Z'), 'Mar 1, 2025');
  for (const invalid of [null, undefined, '', 'invalid', '2025-02-30', new Date('invalid')]) {
    assert.equal(toDateInput(invalid), '');
    assert.equal(formatCalendarDate(invalid), '—');
  }
});

const followUp = {
  diagnosisDate: new Date('2020-01-01T00:00:00Z'),
  vitalStatus: 'Alive',
  diseaseStatus: 'No evidence of disease',
  treatmentResponse: 'Not assessed',
  lastFollowUpDate: new Date('2022-01-01T00:00:00Z'),
  deathDate: null,
};

test('vital status, disease status and response are independent without automatic recoding', () => {
  for (const vitalStatus of ['Alive', 'Unknown']) {
    for (const diseaseStatus of ['No evidence of disease', 'Stable disease', 'Progression / recurrence', 'Not assessed']) {
      for (const treatmentResponse of ['Complete response', 'Partial response', 'Stable disease', 'Progressive disease', 'Not assessed']) {
        assert.equal(validateCaseStatus({...followUp, vitalStatus, diseaseStatus, treatmentResponse}), null);
      }
    }
  }
  // Death does not itself establish cancer progression or a cancer-related cause.
  assert.equal(validateCaseStatus({...followUp, vitalStatus: 'Deceased', deathDate: new Date('2021-02-03')}), null);
});

test('each independent field is required; historical outcomes must be reviewed explicitly', () => {
  for (const field of ['vitalStatus', 'diseaseStatus', 'treatmentResponse', 'lastFollowUpDate']) {
    assert.ok(validateCaseStatus({...followUp, [field]: null}));
  }
  assert.match(validateCaseStatus({...followUp, vitalStatus: 'Stable disease'}), /vital status/);
  assert.match(validateCaseStatus({...followUp, diseaseStatus: 'Deceased'}), /disease status/);
  assert.match(validateCaseStatus({...followUp, treatmentResponse: 'No evidence of disease'}), /response/);
});

test('follow-up and death dates are consistent and not future dates', () => {
  assert.match(validateCaseStatus({...followUp, lastFollowUpDate: new Date('2019-01-01')}), /follow-up/);
  assert.match(validateCaseStatus({...followUp, lastFollowUpDate: new Date('2999-01-01')}), /follow-up/);
  assert.match(validateCaseStatus({...followUp, vitalStatus: 'Deceased'}), /required/);
  assert.match(validateCaseStatus({...followUp, vitalStatus: 'Deceased', deathDate: new Date('2019-01-01')}), /before diagnosis/);
  assert.match(validateCaseStatus({...followUp, vitalStatus: 'Deceased', deathDate: new Date('2999-01-01')}), /future/);
  assert.match(validateCaseStatus({...followUp, vitalStatus: 'Deceased', deathDate: new Date('2023-01-01')}), /after the last follow-up/);
  assert.match(validateCaseStatus({...followUp, deathDate: new Date('2021-01-01')}), /only/);
  assert.match(validateCaseStatus({...followUp, vitalStatus: 'Unknown', deathDate: new Date('2021-01-01')}), /only/);
});
