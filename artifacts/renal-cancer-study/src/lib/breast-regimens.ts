import type { BreastRegimen } from '@workspace/api-client-react';

// Do not infer a new treatment from a subtype/context correction. Keep the
// recorded value selectable even when it is outside the current catalog.
export function breastRegimenOptions(catalog: BreastRegimen[], subtype: string, setting: string, phase: string, recorded = '') {
  const available = catalog.filter(c =>
    (c.subtypes ?? ['HER2-positive / HR-negative']).includes(subtype) &&
    (!setting || c.settings.includes(setting)) &&
    (!phase || c.phases.includes(phase)));
  const specified = recorded.match(/^(.*\(specify (?:components|regimen)\))(?:\:.*)?$/)?.[1] || '';
  const isOther = recorded.startsWith('Other recorded regimen: ');
  const names = available.map(c => c.name);
  const retained = recorded && !isOther && !names.includes(specified || recorded) ? recorded : '';
  const note = catalog.find(c => c.name === (specified || recorded))?.note;
  return { names, isOther, retained, specified, note };
}
