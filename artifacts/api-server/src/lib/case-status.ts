interface FollowUpInput {
  diagnosisDate: Date;
  vitalStatus?: string | null;
  diseaseStatus?: string | null;
  treatmentResponse?: string | null;
  lastFollowUpDate?: Date | null;
  deathDate?: Date | null;
}

export function validateCaseStatus(data: FollowUpInput): string | null {
  if (!['Alive', 'Deceased', 'Unknown'].includes(data.vitalStatus || '')) {
    return 'Select the vital status.';
  }
  if (!['No evidence of disease', 'Stable disease', 'Progression / recurrence', 'Not assessed'].includes(data.diseaseStatus || '')) {
    return 'Select the disease status separately from the vital status.';
  }
  if (!['Complete response', 'Partial response', 'Stable disease', 'Progressive disease', 'Not assessed'].includes(data.treatmentResponse || '')) {
    return 'Select the treatment response, or Not assessed.';
  }
  const { diagnosisDate, lastFollowUpDate, deathDate, vitalStatus } = data;
  if (!lastFollowUpDate || Number.isNaN(lastFollowUpDate.getTime())) return 'Last follow-up date is required.';
  const today = new Date().toISOString().slice(0, 10);
  if (lastFollowUpDate < diagnosisDate || lastFollowUpDate.toISOString().slice(0, 10) > today) {
    return 'Last follow-up must be on or after diagnosis and not in the future.';
  }
  if (vitalStatus !== 'Deceased') {
    return deathDate ? 'A death date can only be recorded for a deceased patient.' : null;
  }
  if (!deathDate || Number.isNaN(deathDate.getTime())) return 'Date of death is required for a deceased patient.';
  if (deathDate < diagnosisDate) return 'Date of death cannot be before diagnosis.';
  if (deathDate.toISOString().slice(0, 10) > today) return 'Date of death cannot be in the future.';
  if (deathDate > lastFollowUpDate) return 'Date of death cannot be after the last follow-up.';
  return null;
}
