import { validateCaseStatus } from "./case-status";

// Validate the original JSON before Zod's Date coercion can turn null into
// 1970-01-01 or roll an impossible calendar date into another month.
export function validateBreastDateInput(input: unknown): string | null {
  if (!input || typeof input !== "object") return "Invalid case data.";
  const data = input as Record<string, unknown>;
  const validDay = (value: unknown) => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  };
  if (!validDay(data.diagnosisDate) || !validDay(data.lastFollowUpDate)) return "Diagnosis and last follow-up require valid calendar dates (YYYY-MM-DD).";
  if (data.deathDate != null && !validDay(data.deathDate)) return "Invalid calendar date of death.";
  if (Array.isArray(data.treatments)) {
    for (const treatment of data.treatments) {
      if (!treatment || typeof treatment !== "object" || !validDay(treatment.startDate) ||
          (treatment.endDate != null && !validDay(treatment.endDate))) return "Treatment dates must be valid calendar dates (YYYY-MM-DD).";
    }
  }
  return null;
}

interface BreastValidationInput {
  patientCode: string; hospital: string; diagnosisDate: Date;
  clinicalStage: string; clinicalM: string; subtype: string;
  erStatus: string; prStatus: string;
  erPercent?: number | null; prPercent?: number | null;
  her2Ihc: string; her2Ish: string; her2Expression: string;
  vitalStatus: string; diseaseStatus: string; treatmentResponse: string;
  lastFollowUpDate: Date; deathDate?: Date | null;
  treatments: Array<{sequenceNumber: number; lineNumber: number; setting: string; phase: string; regimen: string; startDate: Date; endDate: Date | null; ongoing: boolean}>;
}
export function validateBreastCase(data: BreastValidationInput): string | null {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,59}$/.test(data.patientCode.trim())) return "Use a study code containing letters, numbers, dots, hyphens or underscores only.";
  if (!data.hospital.trim()) return "Hospital is required.";
  const statusError = validateCaseStatus(data);
  if (statusError) return statusError;
  if ((data.clinicalStage === "Stage IV" && data.clinicalM === "cM0") ||
      (data.clinicalM === "cM1" && data.clinicalStage !== "Stage IV")) return "Review diagnosis-time stage and M category: documented distant metastasis corresponds to Stage IV.";
  const hrPositive = data.erStatus === "Positive" || data.prStatus === "Positive";
  const hrNegative = data.erStatus === "Negative" && data.prStatus === "Negative";
  if (data.subtype === "Triple-negative" && (hrPositive || data.her2Expression === "HER2-positive")) return "Triple-negative subtype conflicts with positive hormone receptors or HER2.";
  if (data.subtype === "HER2-positive / HR-negative" && hrPositive) return "HR-negative subtype conflicts with a positive hormone receptor.";
  if ((data.subtype === "HER2-positive / HR-positive" || data.subtype.startsWith("Luminal")) && hrNegative) return "The recorded subtype conflicts with both hormone receptors being negative.";
  if (data.subtype.startsWith("HER2-positive") && !["HER2-positive", "Unknown"].includes(data.her2Expression)) return "HER2-positive subtype conflicts with the recorded HER2 expression.";
  if (data.subtype === "Luminal A-like" && data.her2Expression === "HER2-positive") return "Luminal A-like subtype conflicts with HER2-positive expression.";
  if (data.her2Expression === "HER2-low" && !(data.her2Ihc === "1+" || (data.her2Ihc === "2+" && data.her2Ish === "Negative"))) return "HER2-low recording requires IHC 1+, or IHC 2+ with negative ISH.";
  if (["HER2-low", "HER2-negative (not low)"].includes(data.her2Expression) && (data.her2Ihc === "3+" || data.her2Ish === "Positive")) return "The HER2 expression category conflicts with positive HER2 testing.";
  if (data.her2Expression === "HER2-positive" && data.her2Ish === "Negative" && ["0", "1+", "2+"].includes(data.her2Ihc)) return "Review HER2 expression against the recorded IHC and ISH results.";
  if (data.her2Expression === "HER2-negative (not low)" && (data.her2Ihc === "1+" || (data.her2Ihc === "2+" && data.her2Ish === "Negative"))) return "Review the HER2 category: these recorded results correspond to HER2-low.";
  for (const [status, percent] of [[data.erStatus, data.erPercent], [data.prStatus, data.prPercent]] as const) {
    if (percent != null && ((status === "Negative" && percent >= 1) || (status === "Positive" && percent < 1))) return "Hormone receptor status conflicts with the recorded percentage (positivity threshold 1%).";
  }
  const today = new Date().toISOString().slice(0, 10);
  const sequenceNumbers = new Set<number>();
  for (const treatment of data.treatments) {
    if (sequenceNumbers.has(treatment.sequenceNumber)) return "Each treatment episode requires a unique sequence number.";
    sequenceNumbers.add(treatment.sequenceNumber);
    if (!treatment.regimen.trim()) return "Each treatment episode requires a regimen.";
    if (/^.*\(specify (components|regimen)\)(:\s*)?$/.test(treatment.regimen.trim())) return "Specify the actual drugs for this treatment episode.";
    if (treatment.ongoing && treatment.endDate !== null) return "Ongoing treatment must not have an end date.";
    if (!treatment.ongoing && treatment.endDate === null) return "Completed treatment requires an end date.";
    if (treatment.endDate && treatment.endDate < treatment.startDate) return "Treatment end date must not precede its start date.";
    if (treatment.startDate < data.diagnosisDate) return "Treatment start date must not precede diagnosis.";
    if (treatment.startDate.toISOString().slice(0, 10) > today || (treatment.endDate && treatment.endDate.toISOString().slice(0, 10) > today)) return "Recorded treatment dates cannot be in the future.";
    if (treatment.endDate && treatment.endDate > data.lastFollowUpDate) return "Treatment end date must not be after last follow-up.";
    if (treatment.startDate > data.lastFollowUpDate) return "Treatment start date must not be after last follow-up.";
    if (data.deathDate && (treatment.ongoing || treatment.startDate > data.deathDate || (treatment.endDate && treatment.endDate > data.deathDate))) return "A deceased patient cannot have ongoing treatment or treatment dated after death.";
  }
  return null;
}
