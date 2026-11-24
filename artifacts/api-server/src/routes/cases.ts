import { Router, type IRouter } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  db,
  renalStudyCasesTable,
  renalStudyTreatmentsTable,
} from "@workspace/db";
import {
  CreateCaseBody,
  CreateCaseResponse,
  DeleteCaseParams,
  GetCaseParams,
  GetCaseResponse,
  GetStudySummaryResponse,
  ListCasesResponse,
  UpdateCaseBody,
  UpdateCaseParams,
  UpdateCaseResponse,
} from "@workspace/api-zod";
import requireAuth from "../middlewares/requireAuth";
import { validateCaseStatus } from "../lib/case-status";

const router: IRouter = Router();
router.use(requireAuth);

function toCalendarDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function validateTreatmentDates(
  treatments: Array<{ startDate: Date; endDate: Date | null; ongoing: boolean }>,
): string | null {
  for (const treatment of treatments) {
    if (treatment.ongoing && treatment.endDate !== null) {
      return "Ongoing treatment lines must not have an end date.";
    }
    if (!treatment.ongoing && treatment.endDate === null) {
      return "Completed treatment lines must have an end date.";
    }
    if (treatment.endDate && treatment.endDate < treatment.startDate) {
      return "Treatment end dates must be on or after their start dates.";
    }
  }
  return null;
}

async function getTreatmentsByCaseIds(caseIds: number[]) {
  if (caseIds.length === 0) {
    return new Map<
      number,
      (typeof renalStudyTreatmentsTable.$inferSelect)[]
    >();
  }

  const rows = await db
    .select()
    .from(renalStudyTreatmentsTable)
    .where(inArray(renalStudyTreatmentsTable.caseId, caseIds))
    .orderBy(renalStudyTreatmentsTable.sequenceNumber);
  const grouped = new Map<number, typeof rows>();
  for (const row of rows) {
    const group = grouped.get(row.caseId) ?? [];
    group.push(row);
    grouped.set(row.caseId, group);
  }
  return grouped;
}

async function getCasesWithTreatments(userId: string) {
  const cases = await db
    .select()
    .from(renalStudyCasesTable)
    .where(eq(renalStudyCasesTable.userId, userId))
    .orderBy(desc(renalStudyCasesTable.createdAt));
  const treatments = await getTreatmentsByCaseIds(cases.map((record) => record.id));

  return cases.map((record) => ({
    ...record,
    treatments: (treatments.get(record.id) ?? []).map((line) => ({
      id: line.id,
      sequenceNumber: line.sequenceNumber,
      regimen: line.regimen,
      startDate: line.startDate,
      endDate: line.endDate,
      ongoing: line.ongoing,
      clinicalResponse: line.clinicalResponse,
      discontinuationReason: line.discontinuationReason,
    })),
  }));
}

router.get("/study/summary", async (req, res): Promise<void> => {
  const cases = await getCasesWithTreatments(req.userId!);
  const summary = {
    totalCases: cases.length,
    activeTreatments: cases.reduce(
      (total, record) =>
        total + record.treatments.filter((line) => line.ongoing).length,
      0,
    ),
    stableCases: cases.filter((record) => record.diseaseStatus === "Stable disease")
      .length,
    progressiveCases: cases.filter(
      (record) => record.diseaseStatus === "Progression / recurrence",
    ).length,
    noEvidenceOfDiseaseCases: cases.filter((record) => record.diseaseStatus === "No evidence of disease").length,
    deceasedCases: cases.filter((record) => record.vitalStatus === "Deceased").length,
    recentCases: cases.slice(0, 5),
  };
  res.json(GetStudySummaryResponse.parse(summary));
});

router.get("/cases", async (req, res): Promise<void> => {
  const cases = await getCasesWithTreatments(req.userId!);
  res.json(ListCasesResponse.parse(cases));
});

router.post("/cases", async (req, res): Promise<void> => {
  const parsed = CreateCaseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const dateError = validateTreatmentDates(parsed.data.treatments);
  const statusError = validateCaseStatus(parsed.data);
  if (dateError || statusError) {
    res.status(400).json({ error: dateError || statusError });
    return;
  }

  const record = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(renalStudyCasesTable)
      .values({
        userId: req.userId!,
        patientCode: parsed.data.patientCode.trim(),
        hospital: parsed.data.hospital.trim(),
        diagnosisDate: toCalendarDate(parsed.data.diagnosisDate),
        tnmEdition: parsed.data.tnmEdition,
        clinicalT: parsed.data.clinicalT,
        clinicalN: parsed.data.clinicalN,
        clinicalM: parsed.data.clinicalM,
        clinicalStage: parsed.data.clinicalStage,
        histology: parsed.data.histology,
        prognosticFactors: parsed.data.prognosticFactors,
        outcome: "Not assessed",
        vitalStatus: parsed.data.vitalStatus,
        diseaseStatus: parsed.data.diseaseStatus,
        treatmentResponse: parsed.data.treatmentResponse,
        lastFollowUpDate: toCalendarDate(parsed.data.lastFollowUpDate!),
        deathDate: parsed.data.deathDate ? toCalendarDate(parsed.data.deathDate) : null,
      })
      .returning();

    const lines =
      parsed.data.treatments.length > 0
        ? await tx
            .insert(renalStudyTreatmentsTable)
            .values(
              parsed.data.treatments.map((line, index) => ({
                caseId: created.id,
                sequenceNumber: index + 1,
                regimen: line.regimen,
                startDate: toCalendarDate(line.startDate),
                endDate: line.endDate ? toCalendarDate(line.endDate) : null,
                ongoing: line.ongoing,
                clinicalResponse: line.clinicalResponse ?? null,
                discontinuationReason: line.discontinuationReason ?? null,
              })),
            )
            .returning()
        : [];

    return {
      ...created,
      treatments: lines.map((line) => ({
        id: line.id,
        sequenceNumber: line.sequenceNumber,
        regimen: line.regimen,
        startDate: line.startDate,
        endDate: line.endDate,
        ongoing: line.ongoing,
        clinicalResponse: line.clinicalResponse,
        discontinuationReason: line.discontinuationReason,
      })),
    };
  });

  res.status(201).json(CreateCaseResponse.parse(record));
});

router.get("/cases/:id", async (req, res): Promise<void> => {
  const params = GetCaseParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [record] = await db
    .select()
    .from(renalStudyCasesTable)
    .where(
      and(
        eq(renalStudyCasesTable.id, params.data.id),
        eq(renalStudyCasesTable.userId, req.userId!),
      ),
    );
  if (!record) {
    res.status(404).json({ error: "Case not found" });
    return;
  }

  const treatmentMap = await getTreatmentsByCaseIds([record.id]);
  const response = {
    ...record,
    treatments: (treatmentMap.get(record.id) ?? []).map((line) => ({
      id: line.id,
      sequenceNumber: line.sequenceNumber,
      regimen: line.regimen,
      startDate: line.startDate,
      endDate: line.endDate,
      ongoing: line.ongoing,
      clinicalResponse: line.clinicalResponse,
      discontinuationReason: line.discontinuationReason,
    })),
  };
  res.json(GetCaseResponse.parse(response));
});

router.put("/cases/:id", async (req, res): Promise<void> => {
  const params = UpdateCaseParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateCaseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const dateError = validateTreatmentDates(parsed.data.treatments);
  const statusError = validateCaseStatus(parsed.data);
  if (dateError || statusError) {
    res.status(400).json({ error: dateError || statusError });
    return;
  }

  const updated = await db.transaction(async (tx) => {
    const [record] = await tx
      .update(renalStudyCasesTable)
      .set({
        patientCode: parsed.data.patientCode.trim(),
        hospital: parsed.data.hospital.trim(),
        diagnosisDate: toCalendarDate(parsed.data.diagnosisDate),
        tnmEdition: parsed.data.tnmEdition,
        clinicalT: parsed.data.clinicalT,
        clinicalN: parsed.data.clinicalN,
        clinicalM: parsed.data.clinicalM,
        clinicalStage: parsed.data.clinicalStage,
        histology: parsed.data.histology,
        prognosticFactors: parsed.data.prognosticFactors,
        vitalStatus: parsed.data.vitalStatus,
        diseaseStatus: parsed.data.diseaseStatus,
        treatmentResponse: parsed.data.treatmentResponse,
        lastFollowUpDate: toCalendarDate(parsed.data.lastFollowUpDate!),
        deathDate: parsed.data.deathDate ? toCalendarDate(parsed.data.deathDate) : null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(renalStudyCasesTable.id, params.data.id),
          eq(renalStudyCasesTable.userId, req.userId!),
        ),
      )
      .returning();

    if (!record) return null;

    await tx
      .delete(renalStudyTreatmentsTable)
      .where(eq(renalStudyTreatmentsTable.caseId, record.id));
    const lines =
      parsed.data.treatments.length > 0
        ? await tx
            .insert(renalStudyTreatmentsTable)
            .values(
              parsed.data.treatments.map((line, index) => ({
                caseId: record.id,
                sequenceNumber: index + 1,
                regimen: line.regimen,
                startDate: toCalendarDate(line.startDate),
                endDate: line.endDate ? toCalendarDate(line.endDate) : null,
                ongoing: line.ongoing,
                clinicalResponse: line.clinicalResponse ?? null,
                discontinuationReason: line.discontinuationReason ?? null,
              })),
            )
            .returning()
        : [];

    return {
      ...record,
      treatments: lines.map((line) => ({
        id: line.id,
        sequenceNumber: line.sequenceNumber,
        regimen: line.regimen,
        startDate: line.startDate,
        endDate: line.endDate,
        ongoing: line.ongoing,
        clinicalResponse: line.clinicalResponse,
        discontinuationReason: line.discontinuationReason,
      })),
    };
  });

  if (!updated) {
    res.status(404).json({ error: "Case not found" });
    return;
  }
  res.json(UpdateCaseResponse.parse(updated));
});

router.delete("/cases/:id", async (req, res): Promise<void> => {
  const params = DeleteCaseParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(renalStudyCasesTable)
    .where(
      and(
        eq(renalStudyCasesTable.id, params.data.id),
        eq(renalStudyCasesTable.userId, req.userId!),
      ),
    )
    .returning({ id: renalStudyCasesTable.id });
  if (!deleted) {
    res.status(404).json({ error: "Case not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
