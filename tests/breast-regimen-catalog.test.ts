import assert from 'node:assert/strict';
import test from 'node:test';
import { breastCatalog } from '../artifacts/api-server/src/lib/breast-catalog.ts';
import { breastRegimenOptions } from '../artifacts/renal-cancer-study/src/lib/breast-regimens.ts';

const names = (subtype: string, setting: string, phase = 'Other') =>
  breastRegimenOptions(breastCatalog.regimens, subtype, setting, phase).names;
const tnbc = 'Triple-negative';
const continuation = 'Pembrolizumab (adjuvant continuation after neoadjuvant therapy)';

test('triple-negative neoadjuvant chemotherapy is first, with both pembrolizumab variants after it', () => {
  const options = names(tnbc, 'Neoadjuvant', 'Induction');
  assert.equal(options[0], 'Doxorubicin + cyclophosphamide → carboplatin + paclitaxel');
  assert.equal(options.length, 8);
  assert.ok(options.slice(0, 6).every(name => !name.includes('Pembrolizumab')));
  assert.ok(options.slice(6).every(name => name.startsWith('Pembrolizumab + carboplatin + paclitaxel')));
  assert.ok(options[6].includes('doxorubicin'));
  assert.ok(options[7].includes('epirubicin'));
});
test('upfront adjuvant chemotherapy differs from postoperative treatment after neoadjuvant therapy', () => {
  const adjuvant = names(tnbc, 'Adjuvant');
  assert.equal(adjuvant.length, 6);
  for (const drug of ['Doxorubicin', 'Epirubicin', 'Docetaxel + cyclophosphamide', 'Olaparib']) {
    assert.ok(adjuvant.some(name => name.includes(drug)));
  }
  assert.ok(!adjuvant.some(name => name.includes('Pembrolizumab') || name === 'Capecitabine'));
  assert.deepEqual(names(tnbc, 'Post-neoadjuvant'), ['Capecitabine', 'Olaparib', continuation]);
  const note = breastRegimenOptions(breastCatalog.regimens, tnbc, 'Post-neoadjuvant', 'Other', continuation).note;
  assert.match(note!, /including after pathological complete response/);
  assert.match(note!, /Not equivalent to starting pembrolizumab only after upfront surgery/);
});
test('HER2, unselected subtypes and metastatic catalogs are not mixed with the new TNBC choices', () => {
  assert.deepEqual(names('HER2-positive / HR-negative', 'Neoadjuvant'),
    ['TCHP', 'AC → THP', 'EC → THP', 'TCH', 'AC → TH', 'EC → TH', 'THP', 'T-DXd → THP', 'Clinical trial (specify regimen)']);
  for (const subtype of ['HER2-positive / HR-negative', 'HER2-positive / HR-positive', 'Luminal A-like']) {
    assert.ok(!names(subtype, 'Post-neoadjuvant').includes(continuation));
  }
  assert.ok(names(tnbc, 'Metastatic').length > 0);
  assert.deepEqual(names(tnbc, 'Neoadjuvant', 'Maintenance'), []);
});
test('metastatic TNBC includes all selected chemotherapy before immunotherapy and targeted treatments', () => {
  const options = names(tnbc, 'Metastatic');
  assert.equal(options.length, 22);
  assert.equal(new Set(options).size, options.length);
  assert.deepEqual(options.slice(0, 13), [
    'Paclitaxel', 'Docetaxel', 'Nab-paclitaxel',
    'Gemcitabine + carboplatin', 'Paclitaxel + carboplatin', 'Carboplatin', 'Cisplatin',
    'Capecitabine', 'Gemcitabine', 'Vinorelbine', 'Eribulin', 'Doxorubicin', 'Liposomal doxorubicin',
  ]);
  assert.deepEqual(options.slice(13), [
    'Olaparib', 'Pembrolizumab + paclitaxel', 'Pembrolizumab + nab-paclitaxel',
    'Pembrolizumab + gemcitabine + carboplatin', 'Sacituzumab govitecan + pembrolizumab',
    'Talazoparib', 'Sacituzumab govitecan', 'Datopotamab deruxtecan', 'Trastuzumab deruxtecan (HER2-low)',
  ]);
  assert.deepEqual(names(tnbc, 'Metastatic', 'Induction'), options);
  assert.ok(!options.includes(continuation));
  assert.ok(!names(tnbc, 'Adjuvant').includes('Talazoparib'));
});
test('metastatic eligibility notes distinguish early-stage, biomarker and prior-treatment contexts', () => {
  const note = (regimen: string) => breastRegimenOptions(breastCatalog.regimens, tnbc, 'Metastatic', 'Other', regimen).note!;
  for (const drug of ['Pembrolizumab + paclitaxel', 'Pembrolizumab + nab-paclitaxel', 'Pembrolizumab + gemcitabine + carboplatin', 'Sacituzumab govitecan + pembrolizumab']) {
    assert.match(note(drug), /CPS ≥10/);
  }
  for (const drug of ['Olaparib', 'Talazoparib']) {
    assert.match(note(drug), /germline BRCA1\/2/);
    assert.match(note(drug), /not qualifying|not a variant of uncertain significance/);
  }
  assert.match(note('Capecitabine'), /residual disease after surgery is not required/);
  assert.match(note('Sacituzumab govitecan'), /at least two prior systemic therapies, including at least one for metastatic disease/);
  assert.match(note('Datopotamab deruxtecan'), /not eligible for PD-1\/PD-L1/);
  assert.match(note('Trastuzumab deruxtecan (HER2-low)'), /IHC 1\+ or IHC 2\+\/ISH-negative/);
  assert.match(note('Trastuzumab deruxtecan (HER2-low)'), /within six months/);
});
test('existing custom and out-of-catalog treatments are retained on subtype or setting changes', () => {
  for (const recorded of [continuation, 'Historical chemotherapy']) {
    const result = breastRegimenOptions(breastCatalog.regimens, 'Luminal A-like', 'Adjuvant', 'Other', recorded);
    assert.equal(result.retained, recorded);
  }
  const custom = breastRegimenOptions(breastCatalog.regimens, tnbc, 'Neoadjuvant', 'Other', 'Other recorded regimen: paclitaxel');
  assert.equal(custom.isOther, true);
  assert.equal(custom.retained, '');
  const legacy = breastRegimenOptions([{name:'Old HER2 regimen',settings:['Adjuvant'],phases:['Other']}], 'HER2-positive / HR-negative', 'Adjuvant', 'Other');
  assert.deepEqual(legacy.names, ['Old HER2 regimen']);
});
