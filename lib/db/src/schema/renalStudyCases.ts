import {
  date,
  index,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { createInsertSchema } from "drizzle-zod";

export const renalStudyCasesTable = pgTable(
  "renal_study_cases",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    patientCode: text("patient_code").notNull(),
    hospital: text("hospital").notNull(),
    diagnosisDate: date("diagnosis_date", { mode: "string" }).notNull(),
    tnmEdition: text("tnm_edition").notNull(),
    clinicalT: text("clinical_t").notNull(),
    clinicalN: text("clinical_n").notNull(),
    clinicalM: text("clinical_m").notNull(),
    clinicalStage: text("clinical_stage").notNull(),
    histology: text("histology").notNull(),
    prognosticFactors: jsonb("prognostic_factors")
      .$type<string[]>()
      .notNull()
      .default([]),
    outcome: text("outcome").notNull(),
    deathDate: date("death_date", { mode: "string" }),
    vitalStatus: text("vital_status"),
    diseaseStatus: text("disease_status"),
    treatmentResponse: text("treatment_response"),
    lastFollowUpDate: date("last_follow_up_date", { mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("renal_study_cases_user_code_unique").on(
      table.userId,
      table.patientCode,
    ),
    index("renal_study_cases_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
  ],
);

export const insertRenalStudyCaseSchema = createInsertSchema(
  renalStudyCasesTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRenalStudyCase = z.infer<typeof insertRenalStudyCaseSchema>;
export type RenalStudyCase = typeof renalStudyCasesTable.$inferSelect;
