import { Router, type IRouter } from "express";
import { clerkClient } from "@clerk/express";
import { and, desc, eq } from "drizzle-orm";
import { db, breastStudyCasesTable, type BreastStudyCase } from "@workspace/db";
import { CreateBreastCaseBody, UpdateBreastCaseBody } from "@workspace/api-zod";
import requireAuth from "../middlewares/requireAuth";
import { breastCatalog } from "../lib/breast-catalog";
import { validateBreastCase, validateBreastDateInput } from "../lib/breast-validation";

const router: IRouter = Router();
router.use("/breast", requireAuth);
const publicCase = (record: BreastStudyCase, userId: string) => {
  const { userId: owner, ...clinical } = record;
  return { ...clinical, canEdit: owner === userId };
};
const day = (date: Date) => date.toISOString().slice(0, 10);
function storageValues(data: typeof CreateBreastCaseBody._output) {
  return {
    ...data, patientCode: data.patientCode.trim(), hospital: data.hospital.trim(),
    diagnosisDate: day(data.diagnosisDate), lastFollowUpDate: day(data.lastFollowUpDate),
    deathDate: data.deathDate ? day(data.deathDate) : null,
    erPercent: data.erPercent ?? null, prPercent: data.prPercent ?? null, ki67Percent: data.ki67Percent ?? null,
    treatments: [...data.treatments].sort((a, b) => a.sequenceNumber - b.sequenceNumber).map(t => ({ ...t, regimen: t.regimen.trim(), startDate: day(t.startDate), endDate: t.endDate ? day(t.endDate) : null })),
  };
}
const duplicate = (error: unknown) => {
  const e = error as { code?: string; cause?: {code?: string} };
  return e.code === "23505" || e.cause?.code === "23505";
};
router.get("/breast/catalog", (_req, res) => { res.json(breastCatalog); });
router.get("/breast/summary", async (req, res) => {
  const records = await db.select().from(breastStudyCasesTable);
  res.json({
    totalCases: records.length,
    myCases: records.filter(c => c.userId === req.userId).length,
    activeTreatments: records.reduce((n, c) => n + c.treatments.filter(t => t.ongoing).length, 0),
    noEvidenceOfDiseaseCases: records.filter(c => c.diseaseStatus === "No evidence of disease").length,
    progressiveCases: records.filter(c => c.diseaseStatus === "Progression / recurrence").length,
    deceasedCases: records.filter(c => c.vitalStatus === "Deceased").length,
  });
});
router.get("/breast/cases", async (req, res) => {
  const records = await db.select().from(breastStudyCasesTable).orderBy(desc(breastStudyCasesTable.createdAt));
  res.json(records.map(record => publicCase(record, req.userId!)));
});
router.get("/breast/cases/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) { res.status(400).json({error:"Invalid case ID"}); return; }
  const [record] = await db.select().from(breastStudyCasesTable).where(eq(breastStudyCasesTable.id, id));
  if (!record) { res.status(404).json({error:"Breast case not found"}); return; }
  res.json(publicCase(record, req.userId!));
});
router.post("/breast/cases", async (req, res) => {
  const dateError = validateBreastDateInput(req.body);
  if (dateError) { res.status(400).json({error:dateError}); return; }
  const parsed = CreateBreastCaseBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({error:"Invalid breast case data", details:parsed.error.flatten()}); return; }
  const error = validateBreastCase(parsed.data);
  if (error) { res.status(400).json({error}); return; }
  // Identity comes from the verified provider, never from the submitted case.
  try {
    let authorName = req.authDisplayName;
    if (!authorName) {
      const user = await clerkClient.users.getUser(req.userId!);
      authorName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || `Physician ${user.id.slice(-6)}`;
    }
    const [record] = await db.insert(breastStudyCasesTable).values({
      ...storageValues(parsed.data), userId:req.userId!, authorName,
    }).returning();
    res.status(201).json(publicCase(record, req.userId!));
  } catch (error) {
    if (duplicate(error)) { res.status(409).json({error:"You already registered this breast study code."}); return; }
    req.log.error({err:error}, "Unable to create breast case");
    res.status(503).json({error:"Unable to save the case. Please try again."});
  }
});
router.put("/breast/cases/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) { res.status(400).json({error:"Invalid case ID"}); return; }
  const [existing] = await db.select().from(breastStudyCasesTable).where(eq(breastStudyCasesTable.id, id));
  if (!existing) { res.status(404).json({error:"Breast case not found"}); return; }
  if (existing.userId !== req.userId) { res.status(403).json({error:"Only the registering physician may edit this case."}); return; }
  const dateError = validateBreastDateInput(req.body);
  if (dateError) { res.status(400).json({error:dateError}); return; }
  const parsed = UpdateBreastCaseBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({error:"Invalid breast case data", details:parsed.error.flatten()}); return; }
  const error = validateBreastCase(parsed.data);
  if (error) { res.status(400).json({error}); return; }
  try {
    const [record] = await db.update(breastStudyCasesTable).set(storageValues(parsed.data))
      .where(and(eq(breastStudyCasesTable.id, id), eq(breastStudyCasesTable.userId, req.userId!))).returning();
    if (!record) { res.status(404).json({error:"Breast case no longer exists"}); return; }
    res.json(publicCase(record, req.userId!));
  } catch (error) {
    if (duplicate(error)) { res.status(409).json({error:"You already registered this breast study code."}); return; }
    req.log.error({err:error}, "Unable to update breast case");
    res.status(503).json({error:"Unable to update the case. Please try again."});
  }
});
router.delete("/breast/cases/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) { res.status(400).json({error:"Invalid case ID"}); return; }
  const [existing] = await db.select().from(breastStudyCasesTable).where(eq(breastStudyCasesTable.id, id));
  if (!existing) { res.status(404).json({error:"Breast case not found"}); return; }
  if (existing.userId !== req.userId) { res.status(403).json({error:"Only the registering physician may delete this case."}); return; }
  await db.delete(breastStudyCasesTable).where(and(eq(breastStudyCasesTable.id, id), eq(breastStudyCasesTable.userId, req.userId!)));
  res.status(204).send();
});
export default router;
