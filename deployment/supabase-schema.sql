-- Run once in a NEW/EMPTY target project using Supabase SQL Editor.
-- This creates only application tables. It does not copy, delete or remap data.
-- If a registry table already exists, stop and inspect it; do not DROP it.
BEGIN;

CREATE TABLE public.renal_study_cases (
  id serial PRIMARY KEY,
  user_id text NOT NULL,
  patient_code text NOT NULL,
  hospital text NOT NULL,
  diagnosis_date date NOT NULL,
  tnm_edition text NOT NULL,
  clinical_t text NOT NULL,
  clinical_n text NOT NULL,
  clinical_m text NOT NULL,
  clinical_stage text NOT NULL,
  histology text NOT NULL,
  prognostic_factors jsonb NOT NULL DEFAULT '[]'::jsonb,
  outcome text NOT NULL,
  death_date date,
  vital_status text,
  disease_status text,
  treatment_response text,
  last_follow_up_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX renal_study_cases_user_code_unique ON public.renal_study_cases (user_id, patient_code);
CREATE INDEX renal_study_cases_user_created_idx ON public.renal_study_cases (user_id, created_at);

CREATE TABLE public.renal_study_treatments (
  id serial PRIMARY KEY,
  case_id integer NOT NULL REFERENCES public.renal_study_cases(id) ON DELETE CASCADE,
  sequence_number integer NOT NULL,
  regimen text NOT NULL,
  start_date date NOT NULL,
  end_date date,
  ongoing boolean NOT NULL DEFAULT false,
  clinical_response text,
  discontinuation_reason text
);
CREATE UNIQUE INDEX renal_study_treatments_case_sequence_unique ON public.renal_study_treatments(case_id, sequence_number);

CREATE TABLE public.breast_study_cases (
  id serial PRIMARY KEY,
  user_id text NOT NULL,
  author_name text NOT NULL,
  patient_code text NOT NULL,
  hospital text NOT NULL,
  diagnosis_date date NOT NULL,
  tnm_edition text NOT NULL DEFAULT 'AJCC8',
  clinical_t text NOT NULL,
  clinical_n text NOT NULL,
  clinical_m text NOT NULL,
  clinical_stage text NOT NULL,
  histology text NOT NULL,
  subtype text NOT NULL,
  er_status text NOT NULL,
  pr_status text NOT NULL,
  er_percent real,
  pr_percent real,
  ki67_percent real,
  her2_ihc text NOT NULL,
  her2_ish text NOT NULL,
  her2_expression text NOT NULL,
  vital_status text NOT NULL,
  disease_status text NOT NULL,
  treatment_response text NOT NULL,
  last_follow_up_date date NOT NULL,
  death_date date,
  treatments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX breast_study_cases_user_code_unique ON public.breast_study_cases(user_id, patient_code);
CREATE INDEX breast_study_cases_created_idx ON public.breast_study_cases(created_at);

-- All clinical access goes through the API, which validates the user and
-- enforces renal ownership and shared-view/author-edit breast permissions.
-- A public publishable key must NOT expose clinical tables via the Data API.
ALTER TABLE public.renal_study_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.renal_study_treatments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.breast_study_cases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.renal_study_cases, public.renal_study_treatments,
  public.breast_study_cases FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.renal_study_cases_id_seq,
  public.renal_study_treatments_id_seq, public.breast_study_cases_id_seq
  FROM PUBLIC, anon, authenticated;
COMMIT;
