import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CreateCaseBody,
  CreateCaseResponse,
  GetCaseResponse,
  ListCasesResponse,
  UpdateCaseBody,
  UpdateCaseResponse,
} from '../lib/api-zod/src/generated/api.ts';

const oldLine = {
  regimen: 'Pembrolizumab',
  startDate: '2020-01-02',
  endDate: '2021-01-02',
  ongoing: false,
};
const caseInput = {
  patientCode: 'SYNTHETIC-CONTRACT-TEST',
  hospital: 'Test hospital',
  diagnosisDate: '2020-01-01',
  tnmEdition: 'AJCC 8th edition',
  clinicalT: 'T2',
  clinicalN: 'N0',
  clinicalM: 'M0',
  clinicalStage: 'Stage II',
  histology: 'Clear cell',
  prognosticFactors: [],
  vitalStatus: 'Alive',
  diseaseStatus: 'No evidence of disease',
  treatmentResponse: 'Not assessed',
  lastFollowUpDate: '2022-01-01',
  deathDate: null,
  treatments: [],
};

function response(input) {
  return {
    ...input,
    id: 1,
    outcome: 'Not assessed',
    createdAt: '2022-01-01T00:00:00Z',
    updatedAt: '2022-01-01T00:00:00Z',
    treatments: input.treatments.map((line, index) => ({
      ...line,
      id: index + 1,
      sequenceNumber: index + 1,
    })),
  };
}

test('legacy lines remain unclassified, distinct from explicitly documented unavailable values', () => {
  for (const schema of [CreateCaseBody, UpdateCaseBody]) {
    const parsed = schema.parse({...caseInput, treatments: [
      oldLine,
      {...oldLine, clinicalResponse: null, discontinuationReason: null},
      {...oldLine, clinicalResponse: 'Not assessed', discontinuationReason: 'Not documented'},
    ]});
    assert.equal(parsed.treatments[0].clinicalResponse, undefined);
    assert.equal(parsed.treatments[0].discontinuationReason, undefined);
    assert.equal(parsed.treatments[1].clinicalResponse, null);
    assert.equal(parsed.treatments[1].discontinuationReason, null);
    assert.equal(parsed.treatments[2].clinicalResponse, 'Not assessed');
    assert.equal(parsed.treatments[2].discontinuationReason, 'Not documented');
  }
});

test('create, update, detail and list contracts preserve independent outcomes across multiple lines', () => {
  const reasons = ['Planned completion', 'Progression', 'Toxicity', 'Death', 'Other', 'Not documented'];
  const responses = ['Complete response', 'Partial response', 'Stable disease', 'Progressive disease', 'Not assessed', null];
  const input = {...caseInput, treatments: reasons.map((reason, index) => ({
    ...oldLine, clinicalResponse: responses[index], discontinuationReason: reason,
  }))};
  const created = CreateCaseResponse.parse(response(CreateCaseBody.parse(input)));
  const updated = UpdateCaseResponse.parse(response(UpdateCaseBody.parse(created)));
  const reopened = GetCaseResponse.parse(updated);
  const [listed] = ListCasesResponse.parse([reopened]);
  for (const record of [created, updated, reopened, listed]) {
    assert.deepEqual(record.treatments.map(line => line.clinicalResponse), responses);
    assert.deepEqual(record.treatments.map(line => line.discontinuationReason), reasons);
    assert.equal(record.treatmentResponse, 'Not assessed');
    assert.equal(record.diseaseStatus, 'No evidence of disease');
    assert.equal(record.vitalStatus, 'Alive');
  }
});

test('invalid line response and discontinuation categories are rejected on create and edit', () => {
  for (const schema of [CreateCaseBody, UpdateCaseBody]) {
    assert.equal(schema.safeParse({...caseInput, treatments: [oldLine]}).success, true);
    for (const patch of [
      {clinicalResponse: 'No evidence of disease'},
      {clinicalResponse: 'Deceased'},
      {discontinuationReason: 'Stable disease'},
      {clinicalResponse: ''},
      {discontinuationReason: ''},
    ]) {
      assert.equal(schema.safeParse({...caseInput, treatments: [{...oldLine, ...patch}]}).success, false);
    }
  }
});
