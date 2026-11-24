import assert from "node:assert/strict";
import test from "node:test";
import { validateBreastCase, validateBreastDateInput } from "../artifacts/api-server/src/lib/breast-validation";

const base = () => ({
  patientCode:"BC-001", hospital:"Test Hospital", diagnosisDate:new Date("2024-02-29"),
  clinicalStage:"Stage IIA", clinicalM:"cM0", subtype:"HER2-positive / HR-negative",
  erStatus:"Negative", prStatus:"Negative", erPercent:0, prPercent:0,
  her2Ihc:"3+", her2Ish:"Not performed", her2Expression:"HER2-positive",
  vitalStatus:"Alive", diseaseStatus:"No evidence of disease", treatmentResponse:"Complete response",
  lastFollowUpDate:new Date("2025-06-01"), deathDate:null as Date|null,
  treatments:[] as Array<{sequenceNumber:number; lineNumber:number; setting:string; phase:string; regimen:string; startDate:Date; endDate:Date|null; ongoing:boolean}>,
});
test("breast staging and biomarkers do not silently recode or contradict each other", () => {
  assert.equal(validateBreastCase(base()), null);
  assert.match(validateBreastCase({...base(), clinicalM:"cM1"})!, /Stage IV/);
  assert.match(validateBreastCase({...base(), subtype:"Triple-negative"})!, /Triple-negative/);
  assert.match(validateBreastCase({...base(), erStatus:"Positive"})!, /HR-negative/);
  assert.match(validateBreastCase({...base(), subtype:"Not classified", her2Expression:"HER2-low"})!, /HER2-low/);
  // HER2-low may coexist with HR-positive luminal or triple-negative disease.
  for (const subtype of ["Luminal A-like", "Luminal B-like", "Triple-negative"]) {
    const positive = subtype !== "Triple-negative";
    assert.equal(validateBreastCase({...base(), subtype, erStatus:positive?"Positive":"Negative", erPercent:positive?80:0, her2Ihc:"1+", her2Expression:"HER2-low"}), null);
  }
  assert.equal(validateBreastCase({...base(), subtype:"Triple-negative", her2Ihc:"2+", her2Ish:"Negative", her2Expression:"HER2-low"}), null);
});
test("follow-up dates and vital status remain independent", () => {
  assert.match(validateBreastCase({...base(), vitalStatus:"Deceased"})!, /death/);
  assert.equal(validateBreastCase({...base(), vitalStatus:"Deceased", deathDate:new Date("2025-05-01")}), null);
  assert.match(validateBreastCase({...base(), deathDate:new Date("2025-05-01")})!, /deceased/i);
});
test("treatment episodes preserve setting, maintenance line number and date consistency", () => {
  const treatment = {sequenceNumber:1,lineNumber:1,setting:"Metastatic",phase:"Induction",regimen:"Docetaxel + trastuzumab + pertuzumab", startDate:new Date("2024-03-01"),endDate:new Date("2024-09-01"),ongoing:false};
  const maintenance = {...treatment,sequenceNumber:2,phase:"Maintenance",regimen:"Trastuzumab + pertuzumab", startDate:new Date("2024-09-02"),endDate:null,ongoing:true};
  assert.equal(validateBreastCase({...base(),treatments:[treatment,maintenance]}),null);
  assert.equal(validateBreastCase({...base(),treatments:[maintenance]}),null);
  assert.match(validateBreastCase({...base(),treatments:[treatment,{...maintenance,sequenceNumber:1}]})!, /unique sequence/);
  assert.match(validateBreastCase({...base(),treatments:[{...treatment,regimen:"Clinical trial (specify regimen)"}]})!, /actual drugs/);
  assert.equal(validateBreastCase({...base(),treatments:[{...treatment,regimen:"Clinical trial (specify regimen): docetaxel"}]}),null);
  assert.match(validateBreastCase({...base(),treatments:[{...treatment,ongoing:true}]})!, /Ongoing/);
  assert.match(validateBreastCase({...base(),treatments:[{...treatment,endDate:null}]})!, /Completed/);
  assert.match(validateBreastCase({...base(),vitalStatus:"Deceased",deathDate:new Date("2025-05-01"),treatments:[maintenance]})!, /sequence|deceased/);
});
test("JSON date validation rejects null, impossible and shifted calendar dates", () => {
  const input = {diagnosisDate:"2024-02-29",lastFollowUpDate:"2025-06-01",deathDate:null,treatments:[]};
  assert.equal(validateBreastDateInput(input),null);
  for (const invalid of [null,"2023-02-29","2024-04-31","bad","2024-02-29T00:00:00.000Z"]) {
    assert.ok(validateBreastDateInput({...input,diagnosisDate:invalid}));
  }
  assert.ok(validateBreastDateInput({...input,treatments:[{startDate:"2025-01-01",endDate:"2025-02-30"}]}));
});
