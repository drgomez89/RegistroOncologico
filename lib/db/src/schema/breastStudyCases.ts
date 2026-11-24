import { date, index, jsonb, pgTable, real, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export interface BreastTreatment {
  sequenceNumber: number;
  lineNumber: number;
  setting: string;
  phase: string;
  regimen: string;
  startDate: string;
  endDate: string | null;
  ongoing: boolean;
}

// Separate storage ensures renal cases can never be treated as breast cases.
export const breastStudyCasesTable = pgTable("breast_study_cases", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  authorName: text("author_name").notNull(),
  patientCode: text("patient_code").notNull(),
  hospital: text("hospital").notNull(),
  diagnosisDate: date("diagnosis_date", { mode: "string" }).notNull(),
  tnmEdition: text("tnm_edition").notNull().default("AJCC8"),
  clinicalT: text("clinical_t").notNull(),
  clinicalN: text("clinical_n").notNull(),
  clinicalM: text("clinical_m").notNull(),
  clinicalStage: text("clinical_stage").notNull(),
  histology: text("histology").notNull(),
  subtype: text("subtype").notNull(),
  erStatus: text("er_status").notNull(),
  prStatus: text("pr_status").notNull(),
  erPercent: real("er_percent"),
  prPercent: real("pr_percent"),
  ki67Percent: real("ki67_percent"),
  her2Ihc: text("her2_ihc").notNull(),
  her2Ish: text("her2_ish").notNull(),
  her2Expression: text("her2_expression").notNull(),
  vitalStatus: text("vital_status").notNull(),
  diseaseStatus: text("disease_status").notNull(),
  treatmentResponse: text("treatment_response").notNull(),
  lastFollowUpDate: date("last_follow_up_date", { mode: "string" }).notNull(),
  deathDate: date("death_date", { mode: "string" }),
  treatments: jsonb("treatments").$type<BreastTreatment[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("breast_study_cases_user_code_unique").on(table.userId, table.patientCode),
  index("breast_study_cases_created_idx").on(table.createdAt),
]);
export const insertBreastStudyCaseSchema = createInsertSchema(breastStudyCasesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBreastStudyCase = z.infer<typeof insertBreastStudyCaseSchema>;
export type BreastStudyCase = typeof breastStudyCasesTable.$inferSelect;
