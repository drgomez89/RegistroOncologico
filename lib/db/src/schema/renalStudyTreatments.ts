import {
  boolean,
  date,
  integer,
  pgTable,
  serial,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { renalStudyCasesTable } from "./renalStudyCases";

export const renalStudyTreatmentsTable = pgTable(
  "renal_study_treatments",
  {
    id: serial("id").primaryKey(),
    caseId: integer("case_id")
      .notNull()
      .references(() => renalStudyCasesTable.id, { onDelete: "cascade" }),
    sequenceNumber: integer("sequence_number").notNull(),
    regimen: text("regimen").notNull(),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }),
    ongoing: boolean("ongoing").notNull().default(false),
    clinicalResponse: text("clinical_response"),
    discontinuationReason: text("discontinuation_reason"),
  },
  (table) => [
    uniqueIndex("renal_study_treatments_case_sequence_unique").on(
      table.caseId,
      table.sequenceNumber,
    ),
  ],
);

export type RenalStudyTreatment = typeof renalStudyTreatmentsTable.$inferSelect;
