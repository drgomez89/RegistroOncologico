import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useRoute } from 'wouter';
import { useClerk, useUser } from '../auth/provider';
import { useQueryClient } from '@tanstack/react-query';
import {
  Activity, ArrowLeft, ArrowRight, Building2, CalendarDays, Check, ChevronDown, CircleHelp,
  ClipboardList, Eye, Filter, LayoutDashboard, LogOut, Menu, Plus, Search, ShieldCheck,
  Trash2, TrendingUp, X,
} from 'lucide-react';
import {
  BreastCaseInputClinicalM, BreastCaseInputClinicalN, BreastCaseInputClinicalStage, BreastCaseInputClinicalT,
  BreastCaseInputDiseaseStatus, BreastCaseInputErStatus, BreastCaseInputHer2Expression, BreastCaseInputHer2Ihc,
  BreastCaseInputHer2Ish, BreastCaseInputHistology, BreastCaseInputPrStatus, BreastCaseInputSubtype,
  BreastCaseInputTreatmentResponse, BreastCaseInputVitalStatus, BreastTreatmentInputPhase, BreastTreatmentInputSetting,
  getGetBreastCaseQueryKey, getGetBreastSummaryQueryKey, getListBreastCasesQueryKey,
  useCreateBreastCase, useDeleteBreastCase, useGetBreastCase, useGetBreastCatalog, useGetBreastSummary,
  useListBreastCases, useUpdateBreastCase,
} from '@workspace/api-client-react';
import type { BreastCase, BreastCaseInput, BreastTreatmentInput } from '@workspace/api-client-react';
import { formatCalendarDate, toDateInput } from '../lib/calendar-date';
import { breastRegimenOptions } from '../lib/breast-regimens';
import { RegistryLogo, SwitchRegistry, useDocumentTitle } from './registry';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const BREAST_NAME = 'Breast cancer registry';
const vals = (o: object) => Object.values(o) as string[];
const T_OPTS = vals(BreastCaseInputClinicalT), N_OPTS = vals(BreastCaseInputClinicalN), M_OPTS = vals(BreastCaseInputClinicalM);
const STAGE_OPTS = vals(BreastCaseInputClinicalStage), HISTO_OPTS = vals(BreastCaseInputHistology), SUBTYPE_OPTS = vals(BreastCaseInputSubtype);
const ER_OPTS = vals(BreastCaseInputErStatus), PR_OPTS = vals(BreastCaseInputPrStatus);
const IHC_OPTS = vals(BreastCaseInputHer2Ihc), ISH_OPTS = vals(BreastCaseInputHer2Ish), EXPR_OPTS = vals(BreastCaseInputHer2Expression);
const VITAL_OPTS = vals(BreastCaseInputVitalStatus), DISEASE_OPTS = vals(BreastCaseInputDiseaseStatus), RESP_OPTS = vals(BreastCaseInputTreatmentResponse);
const SETTING_OPTS = vals(BreastTreatmentInputSetting), PHASE_OPTS = vals(BreastTreatmentInputPhase);
const HER2_POSITIVE_SUBTYPES = [BreastCaseInputSubtype['HER2-positive_/_HR-negative'], BreastCaseInputSubtype['HER2-positive_/_HR-positive']] as string[];
const OTHER_PREFIX = 'Other recorded regimen: ';
const OTHER_VALUE = '__other__';
const FRESH = { staleTime: 15_000, refetchOnMount: 'always' as const };
const today = () => new Date().toISOString().slice(0, 10);

/* ---------- shell ---------- */
export function BreastShell({ children, crumb }: { children: ReactNode; crumb: string }) {
  const [open, setOpen] = useState(false);
  const { signOut } = useClerk();
  const { user } = useUser();
  const [location] = useLocation();
  useDocumentTitle(`${BREAST_NAME} · Cancer Study Registry`);
  const overview = location === '/breast';
  return <div className="app-shell breast-workspace">
    <aside className={`side-nav ${open ? 'side-nav-open' : ''}`}>
      <div className="side-brand"><RegistryLogo inverse /><button className="mobile-close" onClick={() => setOpen(false)} aria-label="Close navigation"><X size={19} /></button></div>
      <SwitchRegistry name={BREAST_NAME} kind="breast" />
      <div className="nav-caption">WORKSPACE</div>
      <Link href="/breast" className={`side-link ${overview ? 'active' : ''}`} onClick={() => setOpen(false)} data-testid="link-breast-overview"><LayoutDashboard size={17} /> Overview</Link>
      <Link href="/breast#cases" className="side-link" onClick={() => setOpen(false)} data-testid="link-breast-cases"><ClipboardList size={17} /> Coded cases</Link>
      <Link href="/breast/cases/new" className={`side-link ${location === '/breast/cases/new' ? 'active' : ''}`} onClick={() => setOpen(false)} data-testid="link-breast-new"><Plus size={17} /> New case</Link>
      <div className="side-bottom"><div className="physician-card"><span className="physician-avatar">{(user?.firstName?.[0] || 'P')}{(user?.lastName?.[0] || '')}</span><span className="physician-meta"><b>{user?.fullName || 'Study physician'}</b><small>Physician account</small></span><button className="logout-button" title="Sign out" data-testid="button-sign-out" onClick={() => signOut({ redirectUrl: basePath || '/' })}><LogOut size={16} /></button></div><p>Research data only.<br />No direct patient identifiers.</p></div>
    </aside>
    {open && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setOpen(false)} />}
    <div className="main-column">
      <header className="topbar"><button className="mobile-menu" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu size={20} /></button><div className="breadcrumb"><span>{BREAST_NAME}</span><span className="breadcrumb-sep">/</span><b>{crumb}</b></div><div className="topbar-right"><Link href="/registries" className="text-link" data-testid="link-switch-registry-top">Switch registry</Link><span className="top-avatar">{(user?.firstName?.[0] || 'P').toUpperCase()}</span></div></header>
      <main className="page-content">{children}</main>
      <footer className="app-footer"><span>{BREAST_NAME}</span><span>Research data only · Not a clinical decision tool</span></footer>
    </div>
  </div>;
}

function Disclosure() {
  return <div className="research-note"><ShieldCheck size={18} /><div><strong>Research data only</strong><p>This registry describes treatments and patient evolution. It does not recommend treatment and is not a clinical decision aid. Record findings as documented by the treating clinician.</p><b>Use coded study fields only. Do not enter patient names, dates of birth, medical-record numbers, or free-text narrative notes.</b></div></div>;
}
function ErrorBox({ onRetry, what }: { onRetry: () => void; what: string }) {
  return <div className="error-panel" role="alert"><div><CircleHelp size={20} /></div><h3>We couldn't load {what}</h3><p>Please check your connection and try again. Your data has not been changed.</p><button type="button" className="button button-secondary" onClick={onRetry}>Try again</button></div>;
}
function Skel() { return <div className="panel skeleton-panel"><div className="skeleton skeleton-line" /><div className="skeleton skeleton-row" /><div className="skeleton skeleton-row" /><div className="skeleton skeleton-row" /></div>; }
function Badge({ text }: { text: string }) {
  const tone = ['Alive', 'No evidence of disease', 'Stable disease', 'Complete response'].includes(text) ? 'positive' : ['Deceased', 'Progressive disease', 'Progression / recurrence'].includes(text) ? 'warning' : text === 'Partial response' ? 'info' : 'neutral';
  return <span className={`outcome outcome-${tone}`}><i />{text}</span>;
}

/* ---------- dashboard ---------- */
export function BreastDashboard() {
  const list = useListBreastCases({ query: { queryKey: getListBreastCasesQueryKey(), ...FRESH } });
  const summary = useGetBreastSummary({ query: { queryKey: getGetBreastSummaryQueryKey(), ...FRESH } });
  const [search, setSearch] = useState('');
  const [subtype, setSubtype] = useState('All subtypes');
  const [mine, setMine] = useState(false);
  const cases = list.data || [];
  const filtered = cases.filter((c) =>
    `${c.patientCode} ${c.hospital} ${c.authorName} ${c.histology}`.toLowerCase().includes(search.toLowerCase())
    && (subtype === 'All subtypes' || c.subtype === subtype) && (!mine || c.canEdit));
  const s = summary.data;
  return <div className="dashboard fade-up">
    <div className="page-heading"><div><div className="eyebrow">BREAST REGISTRY OVERVIEW</div><h1>Coded breast cases, <span>shared.</span></h1><p>Every registry physician can view all cases. Only the registering physician can edit.</p></div><Link href="/breast/cases/new" className="button button-primary" data-testid="link-create-breast-case"><Plus size={17} /> Add coded case</Link></div>
    <Disclosure />
    {summary.isError ? <ErrorBox what="the registry summary" onRetry={() => summary.refetch()} /> : <div className="metric-grid">
      {summary.isLoading ? [1, 2, 3].map((i) => <div className="metric-card skeleton-card" key={i}><div className="skeleton skeleton-icon" /><div className="skeleton skeleton-line" /><div className="skeleton skeleton-number" /></div>) : <>
        <BMetric label="Total coded cases" value={s?.totalCases} note="All registry physicians" icon={<ClipboardList size={18} />} tone="teal" />
        <BMetric label="My cases" value={s?.myCases} note="Registered by you" icon={<Check size={18} />} tone="sage" />
        <BMetric label="Active treatments" value={s?.activeTreatments} note="Ongoing episodes" icon={<Activity size={18} />} tone="sage" />
        <BMetric label="No evidence of disease" value={s?.noEvidenceOfDiseaseCases} note="Not the same as stable disease" icon={<ShieldCheck size={18} />} tone="gold" />
        <BMetric label="Progression / recurrence" value={s?.progressiveCases} note="Independent disease status" icon={<TrendingUp size={18} />} tone="rose" />
        <BMetric label="Deceased" value={s?.deceasedCases} note="Independent vital status" icon={<CalendarDays size={18} />} tone="rose" />
      </>}
    </div>}
    <section className="panel case-panel" id="cases">
      <div className="panel-heading"><div><h2>Coded case records</h2><p>Visible to all registry physicians; linked by study code only.</p></div><span className="count-badge">{cases.length} {cases.length === 1 ? 'case' : 'cases'}</span></div>
      <div className="table-controls">
        <label className="search-box"><Search size={16} /><input aria-label="Search coded cases" data-testid="input-breast-search" placeholder="Search code, hospital, author" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
        <div className="breast-filters">
          <label className="filter-box"><Filter size={15} /><select aria-label="Filter by reported subtype" value={subtype} onChange={(e) => setSubtype(e.target.value)}><option>All subtypes</option>{SUBTYPE_OPTS.map((o) => <option key={o}>{o}</option>)}</select><ChevronDown size={14} /></label>
          <label className="mine-toggle"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} data-testid="checkbox-my-cases" /> My cases only</label>
        </div>
      </div>
      {list.isLoading ? <div className="table-skeleton">{[1, 2, 3].map((i) => <div className="skeleton skeleton-row" key={i} />)}</div>
        : list.isError ? <div className="panel-pad"><ErrorBox what="the breast cases" onRetry={() => list.refetch()} /></div>
        : filtered.length === 0 ? <div className="empty-state"><div className="empty-icon"><ClipboardList size={23} /></div><h3>{cases.length ? 'No records match this view' : 'The breast registry is ready'}</h3><p>{cases.length ? 'Try another search term, subtype, or clear the my-cases filter.' : 'No coded cases have been registered yet. Create the first coded case to begin.'}</p>{!cases.length && <Link href="/breast/cases/new" className="button button-primary"><Plus size={16} /> Add coded case</Link>}</div>
        : <div className="table-scroll"><table className="case-table"><thead><tr><th>STUDY CODE</th><th>DIAGNOSIS DATE</th><th>HOSPITAL</th><th>REGISTERED BY</th><th>STAGE</th><th>REPORTED SUBTYPE</th><th>HER2 CATEGORY</th><th>VITAL</th><th>DISEASE</th><th>RESPONSE</th><th>LAST FOLLOW-UP</th><th>TREATMENT</th><th></th></tr></thead>
          <tbody>{filtered.map((c) => <BreastRow key={c.id} c={c} />)}</tbody></table></div>}
      <div className="table-foot"><span>Showing {filtered.length} of {cases.length} case records</span><Link href="/breast/cases/new" className="text-link">Add a case <ArrowRight size={14} /></Link></div>
    </section>
  </div>;
}
function BMetric({ label, value, note, icon, tone }: { label: string; value?: number; note: string; icon: ReactNode; tone: string }) {
  return <div className="metric-card"><div className={`metric-icon ${tone}`}>{icon}</div><span className="metric-label">{label}</span><div className="metric-number">{value ?? 0}</div><span className="metric-note">{note}</span></div>;
}
function BreastRow({ c }: { c: BreastCase }) {
  const active = c.treatments.find((t) => t.ongoing);
  return <tr data-testid={`row-breast-case-${c.id}`}>
    <td><Link href={`/breast/cases/${c.id}`} className="study-code mono">{c.patientCode}</Link></td>
    <td>{formatCalendarDate(c.diagnosisDate)}</td>
    <td><span className="hospital-cell"><Building2 size={14} />{c.hospital}</span></td>
    <td>{c.authorName}{c.canEdit && <span className="mine-chip">You</span>}</td>
    <td><span className="stage-pill">{c.clinicalStage}</span></td>
    <td>{c.subtype}</td><td>{c.her2Expression}</td>
    <td><Badge text={c.vitalStatus} />{c.vitalStatus === 'Deceased' && <div className="death-date">Date of death: {formatCalendarDate(c.deathDate)}</div>}</td>
    <td><Badge text={c.diseaseStatus} /></td><td><Badge text={c.treatmentResponse} /></td>
    <td>{formatCalendarDate(c.lastFollowUpDate)}</td>
    <td><span className="treatment-cell">{active ? <><i />{active.regimen}</> : c.treatments.length ? `${c.treatments.length} episode${c.treatments.length === 1 ? '' : 's'}` : 'Not recorded'}</span></td>
    <td><Link href={`/breast/cases/${c.id}`} className="row-open" aria-label={`Open case ${c.patientCode}`}>{c.canEdit ? <ArrowRight size={16} /> : <Eye size={16} />}</Link></td>
  </tr>;
}

/* ---------- routes ---------- */
export function BreastNewCase() { return <BreastEditor />; }
export function BreastCaseDetail() {
  const [, params] = useRoute('/breast/cases/:id');
  const id = Number(params?.id);
  const valid = Number.isInteger(id) && id > 0;
  const q = useGetBreastCase(id, { query: { enabled: valid, queryKey: getGetBreastCaseQueryKey(id), ...FRESH } });
  if (!valid) return <div className="page-error"><div className="error-panel"><h3>This case address is not valid</h3></div><Link href="/breast" className="text-link"><ArrowLeft size={14} /> Return to overview</Link></div>;
  if (q.isLoading) return <div className="editor-skeleton"><div className="skeleton skeleton-line short" /><Skel /></div>;
  if (q.isError || !q.data) return <div className="page-error"><ErrorBox what="this case" onRetry={() => q.refetch()} /><Link href="/breast" className="text-link"><ArrowLeft size={14} /> Return to overview</Link></div>;
  return q.data.canEdit ? <BreastEditor key={`${q.data.id}-${q.data.updatedAt}`} initial={q.data} /> : <BreastReadOnly c={q.data} />;
}

/* ---------- read-only ---------- */
function Row({ k, v }: { k: string; v: ReactNode }) { return <div className="ro-item"><dt>{k}</dt><dd>{v || '—'}</dd></div>; }
function BreastReadOnly({ c }: { c: BreastCase }) {
  const pct = (n?: number | null) => (n == null ? '' : `${n}%`);
  return <div className="editor-page fade-up">
    <div className="editor-breadcrumb"><Link href="/breast"><ArrowLeft size={15} /> All coded cases</Link><span>/</span><b>{c.patientCode}</b></div>
    <div className="editor-heading"><div><div className="eyebrow">READ-ONLY CASE RECORD</div><h1>{c.patientCode}</h1><p>Registered by {c.authorName} at {c.hospital}.</p></div></div>
    <div className="readonly-banner" data-testid="text-readonly-notice"><Eye size={17} /><span>You are viewing a case registered by another physician. Only the registering physician can edit or delete it.</span></div>
    <div className="case-form">
      <section className="form-section"><div className="section-head"><span className="section-index">01</span><div><h2>Identification</h2></div></div><dl className="ro-grid"><Row k="Study code" v={c.patientCode} /><Row k="Hospital" v={c.hospital} /><Row k="Registered by" v={c.authorName} /><Row k="Diagnosis date" v={formatCalendarDate(c.diagnosisDate)} /></dl></section>
      <section className="form-section"><div className="section-head"><span className="section-index">02</span><div><h2>Diagnosis (AJCC 8th edition)</h2></div></div><dl className="ro-grid"><Row k="Clinical T" v={c.clinicalT} /><Row k="Clinical N" v={c.clinicalN} /><Row k="Clinical M" v={c.clinicalM} /><Row k="Anatomic stage (clinician-reported)" v={c.clinicalStage} /><Row k="Histology" v={c.histology} /></dl></section>
      <section className="form-section"><div className="section-head"><span className="section-index">03</span><div><h2>Biomarkers</h2></div></div><dl className="ro-grid"><Row k="Reported subtype" v={c.subtype} /><Row k="ER status" v={`${c.erStatus}${c.erPercent != null ? ` · ${pct(c.erPercent)}` : ''}`} /><Row k="PR status" v={`${c.prStatus}${c.prPercent != null ? ` · ${pct(c.prPercent)}` : ''}`} /><Row k="Ki67" v={pct(c.ki67Percent)} /><Row k="HER2 IHC" v={c.her2Ihc} /><Row k="HER2 ISH" v={c.her2Ish} /><Row k="HER2 category" v={c.her2Expression} /></dl></section>
      <section className="form-section"><div className="section-head"><span className="section-index">04</span><div><h2>Follow-up</h2></div></div><dl className="ro-grid"><Row k="Vital status" v={<Badge text={c.vitalStatus} />} /><Row k="Disease status" v={<Badge text={c.diseaseStatus} />} /><Row k="Treatment response" v={<Badge text={c.treatmentResponse} />} /><Row k="Last follow-up" v={formatCalendarDate(c.lastFollowUpDate)} />{c.vitalStatus === 'Deceased' && <Row k="Date of death" v={formatCalendarDate(c.deathDate)} />}</dl></section>
      <section className="form-section"><div className="section-head"><span className="section-index">05</span><div><h2>Treatment episodes</h2></div></div>
        {c.treatments.length === 0 ? <p className="field-hint">No treatment episodes recorded.</p> : <div className="ro-treatments">{[...c.treatments].sort((a, b) => a.sequenceNumber - b.sequenceNumber).map((t) => <div className="ro-treatment" key={t.sequenceNumber} data-testid={`text-breast-treatment-${t.sequenceNumber}`}><b>#{t.sequenceNumber} · {t.regimen}</b><span>Line {t.lineNumber} · {t.setting} · {t.phase}</span><span>{formatCalendarDate(t.startDate)} to {t.ongoing ? 'ongoing' : formatCalendarDate(t.endDate)}</span></div>)}</div>}
      </section>
    </div>
  </div>;
}

/* ---------- editor ---------- */
type Row = { key: number; sequenceNumber: string; lineNumber: string; setting: string; phase: string; regimen: string; startDate: string; endDate: string; ongoing: boolean };
let rowKey = 0;
const blankRow = (rows: Row[]): Row => ({
  key: ++rowKey, sequenceNumber: String(Math.max(0, ...rows.map((r) => Number(r.sequenceNumber) || 0)) + 1),
  lineNumber: String(rows.length ? Number(rows[rows.length - 1].lineNumber) || 1 : 1),
  setting: '', phase: '', regimen: '', startDate: '', endDate: '', ongoing: true,
});
const pctInput = (n?: number | null) => (n == null ? '' : String(n));

function Fld({ label, required, hint, id, children }: { label: string; required?: boolean; hint?: string; id: string; children: ReactNode }) {
  return <div className="field-group"><label className="label" htmlFor={id}>{label}{required && <em> *</em>}</label>{children}{hint && <span className="field-hint">{hint}</span>}</div>;
}
function Sel({ id, label, value, onChange, options, required, hint, placeholder }: { id: string; label: string; value: string; onChange: (v: string) => void; options: string[]; required?: boolean; hint?: string; placeholder?: string }) {
  return <Fld id={id} label={label} required={required} hint={hint}><div className="select-wrap"><select id={id} data-testid={`select-${id}`} required={required} className="field" value={value} onChange={(e) => onChange(e.target.value)}><option value="">{placeholder || 'Select an option'}</option>{options.map((o) => <option key={o} value={o}>{label === 'Setting' && o === 'Post-neoadjuvant' ? 'Post-neoadjuvant (adjuvant after surgery)' : label === 'Setting' && o === 'Adjuvant' ? 'Adjuvant (surgery first)' : o}</option>)}</select><ChevronDown size={15} /></div></Fld>;
}

function specifiedRegimenBase(value: string) {
  return value.match(/^(.*\(specify (?:components|regimen)\))(?:\:.*)?$/)?.[1] || '';
}
function saveError(error: unknown, fallback: string) {
  const data = (error as { data?: { error?: unknown } })?.data;
  return typeof data?.error === 'string' ? data.error : fallback;
}
function BreastEditor({ initial }: { initial?: BreastCase }) {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const create = useCreateBreastCase();
  const update = useUpdateBreastCase();
  const remove = useDeleteBreastCase();
  const catalogQ = useGetBreastCatalog({ query: { queryKey: ['/api/breast/catalog'], staleTime: 300_000, refetchOnMount: 'always' } });
  const editing = Boolean(initial);
  const [f, setF] = useState({
    patientCode: initial?.patientCode || '', hospital: initial?.hospital || '', diagnosisDate: toDateInput(initial?.diagnosisDate),
    clinicalT: initial?.clinicalT || '', clinicalN: initial?.clinicalN || '', clinicalM: initial?.clinicalM || '', clinicalStage: initial?.clinicalStage || '',
    histology: initial?.histology || '', subtype: initial?.subtype || '', erStatus: initial?.erStatus || '', prStatus: initial?.prStatus || '',
    erPercent: pctInput(initial?.erPercent), prPercent: pctInput(initial?.prPercent), ki67Percent: pctInput(initial?.ki67Percent),
    her2Ihc: initial?.her2Ihc || '', her2Ish: initial?.her2Ish || '', her2Expression: initial?.her2Expression || '',
    vitalStatus: initial?.vitalStatus || '', diseaseStatus: initial?.diseaseStatus || '', treatmentResponse: initial?.treatmentResponse || '',
    lastFollowUpDate: toDateInput(initial?.lastFollowUpDate), deathDate: toDateInput(initial?.deathDate),
  });
  const [rows, setRows] = useState<Row[]>(() => (initial?.treatments || []).map((t) => ({
    key: ++rowKey, sequenceNumber: String(t.sequenceNumber), lineNumber: String(t.lineNumber), setting: t.setting, phase: t.phase,
    regimen: t.regimen, startDate: toDateInput(t.startDate), endDate: toDateInput(t.endDate), ongoing: t.ongoing,
  })));
  const [error, setError] = useState('');
  const pending = create.isPending || update.isPending || remove.isPending;
  const set = (k: keyof typeof f) => (v: string) => setF((cur) => ({ ...cur, [k]: v }));
  const patchRow = (key: number, patch: Partial<Row>) => setRows((cur) => cur.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const her2Subtype = HER2_POSITIVE_SUBTYPES.includes(f.subtype);
  const catalog = useMemo(() => catalogQ.data?.regimens || [], [catalogQ.data]);

  async function refresh(id?: number, gone = false) {
    if (id != null && gone) qc.removeQueries({ queryKey: getGetBreastCaseQueryKey(id) });
    await Promise.all([
      qc.invalidateQueries({ queryKey: getListBreastCasesQueryKey() }),
      qc.invalidateQueries({ queryKey: getGetBreastSummaryQueryKey() }),
      ...(id != null && !gone ? [qc.invalidateQueries({ queryKey: getGetBreastCaseQueryKey(id) })] : []),
    ]);
  }
  function deleteCase() {
    if (!initial || !window.confirm(`Delete coded case ${initial.patientCode}? This cannot be undone.`)) return;
    remove.mutate({ id: initial.id }, { onSuccess: async () => { await refresh(initial.id, true); setLocation('/breast'); }, onError: () => setError('Case could not be deleted. Only the registering physician can delete it. Please try again.') });
  }
  function percent(label: string, v: string): string | null {
    if (v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 && n <= 100 ? null : `${label} must be a number between 0 and 100.`;
  }
  function validate(): string {
    const required: (keyof typeof f)[] = ['patientCode', 'hospital', 'diagnosisDate', 'clinicalT', 'clinicalN', 'clinicalM', 'clinicalStage', 'histology', 'subtype', 'erStatus', 'prStatus', 'her2Ihc', 'her2Ish', 'her2Expression', 'vitalStatus', 'diseaseStatus', 'treatmentResponse', 'lastFollowUpDate'];
    if (required.some((k) => !String(f[k]).trim())) return 'Complete every required field. Use Unknown or Not assessed where appropriate.';
    const pe = percent('ER percent', f.erPercent) || percent('PR percent', f.prPercent) || percent('Ki67', f.ki67Percent);
    if (pe) return pe;
    if (f.diagnosisDate > today()) return 'Diagnosis date cannot be in the future.';
    if (f.lastFollowUpDate < f.diagnosisDate || f.lastFollowUpDate > today()) return 'Enter a last follow-up date on or after diagnosis and not in the future.';
    if (f.vitalStatus === 'Deceased' && (!f.deathDate || f.deathDate < f.diagnosisDate || f.deathDate > f.lastFollowUpDate)) return 'Enter a date of death on or after diagnosis and no later than the last follow-up.';
    if (her2Subtype && f.her2Expression !== 'HER2-positive') return 'A HER2-positive reported subtype requires the HER2 category HER2-positive.';
    if (f.subtype.endsWith('HR-negative') && (f.erStatus === 'Positive' || f.prStatus === 'Positive')) return 'HR-negative subtype conflicts with a positive ER or PR status.';
    if (f.subtype.endsWith('HR-positive') && f.erStatus !== 'Positive' && f.prStatus !== 'Positive') return 'HR-positive subtype needs a positive ER or PR status.';
    const seqs = new Set<number>();
    for (const r of rows) {
      const seq = Number(r.sequenceNumber), line = Number(r.lineNumber);
      if (!Number.isInteger(seq) || seq < 1 || !Number.isInteger(line) || line < 1) return 'Sequence and line numbers must be whole numbers of 1 or more.';
      if (seqs.has(seq)) return `Sequence number ${seq} is used twice. Each treatment episode needs its own sequence number.`;
      seqs.add(seq);
      if (!r.setting || !r.phase) return 'Each treatment episode needs a setting and phase.';
      const reg = r.regimen.trim();
      if (!reg || reg === OTHER_PREFIX.trim() || (r.regimen.startsWith(OTHER_PREFIX) && !r.regimen.slice(OTHER_PREFIX.length).trim())) return 'Each treatment episode needs a regimen. Other recorded regimens require a specification.';
      const specified = specifiedRegimenBase(reg);
      if (specified && !reg.slice(specified.length).replace(/^:\s*/, '').trim()) return 'Specify the actual drugs for the chemotherapy or clinical-trial episode.';
      if (!r.startDate || r.startDate > today()) return 'Each treatment episode needs a start date that is not in the future.';
      if (r.startDate < f.diagnosisDate) return 'A treatment start date cannot be before the diagnosis date.';
      if (!r.ongoing && !r.endDate) return 'Completed treatment episodes need an end date.';
      if (!r.ongoing && (r.endDate < r.startDate || r.endDate > today())) return 'Treatment end dates must be on or after the start date and not in the future.';
    }
    return '';
  }
  function submit(e: FormEvent) {
    e.preventDefault(); setError('');
    const problem = validate();
    if (problem) { setError(problem); return; }
    const num = (v: string) => (v === '' ? null : Number(v));
    const treatments: BreastTreatmentInput[] = [...rows].sort((a, b) => Number(a.sequenceNumber) - Number(b.sequenceNumber)).map((r) => ({
      sequenceNumber: Number(r.sequenceNumber), lineNumber: Number(r.lineNumber), setting: r.setting as BreastTreatmentInput['setting'], phase: r.phase as BreastTreatmentInput['phase'],
      regimen: r.regimen.trim(), startDate: r.startDate, endDate: r.ongoing ? null : r.endDate || null, ongoing: r.ongoing,
    }));
    const payload: BreastCaseInput = {
      patientCode: f.patientCode.trim(), hospital: f.hospital.trim(), diagnosisDate: f.diagnosisDate,
      clinicalT: f.clinicalT as BreastCaseInput['clinicalT'], clinicalN: f.clinicalN as BreastCaseInput['clinicalN'], clinicalM: f.clinicalM as BreastCaseInput['clinicalM'],
      clinicalStage: f.clinicalStage as BreastCaseInput['clinicalStage'], histology: f.histology as BreastCaseInput['histology'], subtype: f.subtype as BreastCaseInput['subtype'],
      erStatus: f.erStatus as BreastCaseInput['erStatus'], prStatus: f.prStatus as BreastCaseInput['prStatus'],
      erPercent: num(f.erPercent), prPercent: num(f.prPercent), ki67Percent: num(f.ki67Percent),
      her2Ihc: f.her2Ihc as BreastCaseInput['her2Ihc'], her2Ish: f.her2Ish as BreastCaseInput['her2Ish'], her2Expression: f.her2Expression as BreastCaseInput['her2Expression'],
      vitalStatus: f.vitalStatus as BreastCaseInput['vitalStatus'], diseaseStatus: f.diseaseStatus as BreastCaseInput['diseaseStatus'], treatmentResponse: f.treatmentResponse as BreastCaseInput['treatmentResponse'],
      lastFollowUpDate: f.lastFollowUpDate, deathDate: f.vitalStatus === 'Deceased' ? f.deathDate : null, treatments,
    };
    const onSuccess = async (saved: BreastCase) => { await refresh(saved.id); setLocation(`/breast/cases/${saved.id}`); };
    if (initial) update.mutate({ id: initial.id, data: payload }, { onSuccess, onError: (error) => setError(saveError(error, 'Changes could not be saved. Please try again.')) });
    else create.mutate({ data: payload }, { onSuccess, onError: (error) => setError(saveError(error, 'Case could not be created. Please try again.')) });
  }

  function regimenOptions(r: Row) {
    return breastRegimenOptions(catalog, f.subtype, r.setting, r.phase, r.regimen);
  }

  return <div className="editor-page fade-up">
    <div className="editor-breadcrumb"><Link href="/breast"><ArrowLeft size={15} /> All coded cases</Link><span>/</span><b>{editing ? initial?.patientCode : 'New case record'}</b></div>
    <div className="editor-heading"><div><div className="eyebrow">{editing ? 'CASE RECORD' : 'NEW REGISTRY ENTRY'}</div><h1>{editing ? 'Edit coded case' : 'Add a coded breast case'}</h1><p>{editing ? `Registered by you at ${initial?.hospital}.` : 'Record diagnosis, biomarkers, follow-up and treatment episodes as documented.'}</p></div>{editing && <button type="button" className="button button-danger" onClick={deleteCase} disabled={pending} data-testid="button-delete-breast-case"><Trash2 size={16} /> Delete case</button>}</div>
    <Disclosure />
    <div className="reference-strip" aria-label="Clinical reference sources"><span>RECORDING REFERENCES</span>
      <a href="https://www.cancer.gov/types/breast/hp/breast-treatment-pdq" target="_blank" rel="noreferrer">NCI PDQ · breast cancer treatment <ArrowRight size={12} /></a>
      <a href="https://www.cap.org/protocols-and-guidelines/cap-guidelines/current-cap-guidelines/recommendations-for-human-epidermal-growth-factor-2-testing-in-breast-cancer" target="_blank" rel="noreferrer">ASCO/CAP · HER2 testing guideline update <ArrowRight size={12} /></a>
    </div>
    <form onSubmit={submit} className="case-form" noValidate>
      <section className="form-section"><div className="section-head"><span className="section-index">01</span><div><h2>Study identification</h2><p>Use the protocol-assigned code; never direct identifiers.</p></div></div>
        <div className="form-grid">
          <Fld id="patientCode" label="Patient study code" required hint="Coded only. No names, MRN, or dates of birth."><input id="patientCode" data-testid="input-patient-code" className="field mono" maxLength={60} value={f.patientCode} onChange={(e) => set('patientCode')(e.target.value)} placeholder="e.g. NI-BR-0147" autoComplete="off" /></Fld>
          <Fld id="hospital" label="Hospital" required><input id="hospital" data-testid="input-hospital" className="field" maxLength={160} value={f.hospital} onChange={(e) => set('hospital')(e.target.value)} autoComplete="off" /></Fld>
          <Fld id="diagnosisDate" label="Diagnosis date" required><input id="diagnosisDate" data-testid="input-diagnosis-date" type="date" max={today()} className="field" value={f.diagnosisDate} onChange={(e) => set('diagnosisDate')(e.target.value)} /></Fld>
        </div></section>
      <section className="form-section"><div className="section-head"><span className="section-index">02</span><div><h2>Diagnosis</h2><p>Clinical TNM, AJCC 8th edition. Anatomic stage is entered as reported by the clinician, never calculated.</p></div><span className="fixed-edition">AJCC 8th edition</span></div>
        <div className="form-grid form-grid-4"><Sel id="clinicalT" label="Clinical T" required value={f.clinicalT} onChange={set('clinicalT')} options={T_OPTS} /><Sel id="clinicalN" label="Clinical N" required value={f.clinicalN} onChange={set('clinicalN')} options={N_OPTS} /><Sel id="clinicalM" label="Clinical M" required value={f.clinicalM} onChange={set('clinicalM')} options={M_OPTS} /><Sel id="clinicalStage" label="Anatomic stage (clinician-reported)" required value={f.clinicalStage} onChange={set('clinicalStage')} options={STAGE_OPTS} /></div>
        <div className="form-grid form-grid-2 diagnosis-second"><Sel id="histology" label="Histology" required value={f.histology} onChange={set('histology')} options={HISTO_OPTS} /></div></section>
      <section className="form-section"><div className="section-head"><span className="section-index">03</span><div><h2>Biomarkers</h2><p>The reported subtype is recorded as documented, not inferred. HER2-low is a separate HER2 category and can coexist with luminal or triple-negative disease.</p></div></div>
        <div className="form-grid form-grid-2"><Sel id="subtype" label="Reported subtype" required value={f.subtype} onChange={set('subtype')} options={SUBTYPE_OPTS} /><Sel id="her2Expression" label="HER2 category" required value={f.her2Expression} onChange={set('her2Expression')} options={EXPR_OPTS} hint="HER2-low is independent of the reported subtype." /></div>
        <div className="form-grid form-grid-4 diagnosis-second">
          <Sel id="erStatus" label="ER status" required value={f.erStatus} onChange={set('erStatus')} options={ER_OPTS} />
          <Fld id="erPercent" label="ER percent (optional)"><input id="erPercent" data-testid="input-er-percent" className="field" type="number" inputMode="decimal" min={0} max={100} step="any" value={f.erPercent} onChange={(e) => set('erPercent')(e.target.value)} /></Fld>
          <Sel id="prStatus" label="PR status" required value={f.prStatus} onChange={set('prStatus')} options={PR_OPTS} />
          <Fld id="prPercent" label="PR percent (optional)"><input id="prPercent" data-testid="input-pr-percent" className="field" type="number" inputMode="decimal" min={0} max={100} step="any" value={f.prPercent} onChange={(e) => set('prPercent')(e.target.value)} /></Fld>
        </div>
        <div className="form-grid diagnosis-second">
          <Fld id="ki67Percent" label="Ki67 percent (optional)"><input id="ki67Percent" data-testid="input-ki67" className="field" type="number" inputMode="decimal" min={0} max={100} step="any" value={f.ki67Percent} onChange={(e) => set('ki67Percent')(e.target.value)} /></Fld>
          <Sel id="her2Ihc" label="HER2 IHC" required value={f.her2Ihc} onChange={set('her2Ihc')} options={IHC_OPTS} />
          <Sel id="her2Ish" label="HER2 ISH" required value={f.her2Ish} onChange={set('her2Ish')} options={ISH_OPTS} />
        </div></section>
      <section className="form-section"><div className="section-head"><span className="section-index">04</span><div><h2>Follow-up</h2><p>Vital status, disease status and treatment response are recorded independently.</p></div></div>
        <div className="form-grid">
          <Sel id="vitalStatus" label="Vital status" required value={f.vitalStatus} onChange={(v) => setF((c) => ({ ...c, vitalStatus: v, deathDate: v === 'Deceased' ? c.deathDate : '' }))} options={VITAL_OPTS} />
          <Sel id="diseaseStatus" label="Disease status" required value={f.diseaseStatus} onChange={set('diseaseStatus')} options={DISEASE_OPTS} />
          <Sel id="treatmentResponse" label="Treatment response" required value={f.treatmentResponse} onChange={set('treatmentResponse')} options={RESP_OPTS} />
        </div>
        <div className="form-grid form-grid-2 diagnosis-second">
          <Fld id="lastFollowUpDate" label="Last follow-up date" required><input id="lastFollowUpDate" data-testid="input-last-follow-up" type="date" max={today()} className="field" value={f.lastFollowUpDate} onChange={(e) => set('lastFollowUpDate')(e.target.value)} /></Fld>
          {f.vitalStatus === 'Deceased' && <Fld id="deathDate" label="Date of death" required hint="On or after diagnosis, no later than last follow-up."><input id="deathDate" data-testid="input-death-date" type="date" max={today()} className="field" value={f.deathDate} onChange={(e) => set('deathDate')(e.target.value)} /></Fld>}
        </div></section>
      <section className="form-section"><div className="section-head"><span className="section-index">05</span><div><h2>Treatment episodes</h2><p>Optional. Setting and phase belong to each episode. Maintenance does not automatically increase the line number.</p></div><button type="button" className="button button-secondary" onClick={() => setRows((cur) => [...cur, blankRow(cur)])} data-testid="button-add-breast-treatment"><Plus size={15} /> Add episode</button></div>
        <div className="regimen-disclaimer"><span>The predefined catalog contains the study owner's selected HER2-positive / HR-negative and triple-negative recording choices. It is not a statement of local availability, approval, or a treatment recommendation. Record actual treatment, not a recommended sequence.</span></div>
        {catalogQ.isError && <div className="inline-alert" role="alert">The regimen catalog could not be loaded. You can still use Other recorded regimen. <button type="button" className="text-link" onClick={() => catalogQ.refetch()}>Retry</button></div>}
        {!['HER2-positive / HR-negative', 'Triple-negative'].includes(f.subtype) && <p className="field-hint breast-catalog-hint">Predefined lists for this subtype have not yet been selected for the study. Record the actual regimen using Other recorded regimen with a specification. Existing entries are kept.</p>}
        {f.subtype === 'Triple-negative' && <p className="field-hint breast-catalog-hint">Conventional chemotherapy is listed first. After neoadjuvant treatment and surgery, choose Post-neoadjuvant (adjuvant after surgery) for pembrolizumab continuation, residual-disease capecitabine, or qualifying olaparib. For Metastatic treatment, record the actual metastatic line and prior exposure; early-stage treatment is not a metastatic line. Immunotherapy and targeted options have specific PD-L1, germline BRCA or HER2-low requirements where applicable; read the selected regimen's context note. These are not automatic combinations. Use Other recorded regimen for documented treatment outside the selected catalog.</p>}
        <details className="abbr-help"><summary>Abbreviations used in HER2 recording choices</summary><dl>
          <div><dt>AC / EC</dt><dd>doxorubicin or epirubicin with cyclophosphamide</dd></div><div><dt>TH</dt><dd>taxane with trastuzumab</dd></div><div><dt>THP</dt><dd>taxane, trastuzumab, pertuzumab</dd></div><div><dt>TCH / TCHP</dt><dd>docetaxel, carboplatin, trastuzumab (plus pertuzumab)</dd></div><div><dt>T-DM1</dt><dd>trastuzumab emtansine</dd></div><div><dt>T-DXd</dt><dd>trastuzumab deruxtecan</dd></div></dl></details>
        {rows.length === 0 ? <div className="empty-state compact"><p>No treatment episodes recorded. This is allowed; add one when treatment is documented.</p></div> :
          <div className="bt-list">{rows.map((r, i) => { const { names, isOther, retained, specified, note } = regimenOptions(r); const id = `bt-${r.key}`; return <fieldset className="bt-row" key={r.key} data-testid={`row-breast-treatment-${i}`}>
            <legend>Episode {i + 1}</legend>
            <button type="button" className="bt-remove" aria-label={`Remove episode ${i + 1}`} onClick={() => setRows((cur) => cur.filter((x) => x.key !== r.key))} data-testid={`button-remove-breast-treatment-${i}`}><Trash2 size={15} /></button>
            <div className="form-grid form-grid-4">
              <Fld id={`${id}-seq`} label="Sequence number" required><input id={`${id}-seq`} className="field" type="number" min={1} step={1} value={r.sequenceNumber} onChange={(e) => patchRow(r.key, { sequenceNumber: e.target.value })} /></Fld>
              <Fld id={`${id}-line`} label="Line number" required><input id={`${id}-line`} className="field" type="number" min={1} step={1} value={r.lineNumber} onChange={(e) => patchRow(r.key, { lineNumber: e.target.value })} /></Fld>
              <Sel id={`${id}-setting`} label="Setting" required value={r.setting} onChange={(v) => patchRow(r.key, { setting: v })} options={SETTING_OPTS} />
              <Sel id={`${id}-phase`} label="Phase" required value={r.phase} onChange={(v) => patchRow(r.key, { phase: v })} options={PHASE_OPTS} />
            </div>
            <div className="form-grid form-grid-2 diagnosis-second">
              <Fld id={`${id}-regimen`} label="Regimen" required hint={retained ? 'Retained from the saved record; change it only if documentation differs.' : undefined}><div className="select-wrap"><select id={`${id}-regimen`} className="field" value={isOther ? OTHER_VALUE : retained || specified || r.regimen} onChange={(e) => patchRow(r.key, { regimen: e.target.value === OTHER_VALUE ? OTHER_PREFIX : specifiedRegimenBase(e.target.value) ? `${e.target.value}: ` : e.target.value })}>
                <option value="">Select a regimen</option>
                {retained && <option value={retained}>{retained} (retained)</option>}
                {names.map((n) => <option key={n} value={n}>{n}</option>)}
                <option value={OTHER_VALUE}>Other recorded regimen</option></select><ChevronDown size={15} /></div></Fld>
              {note && <p className="field-hint" style={{ gridColumn: '1 / -1' }} role="note" aria-live="polite">{note}</p>}
              {isOther && <Fld id={`${id}-spec`} label="Specify regimen" required hint="Drug names only. No narrative notes."><input id={`${id}-spec`} className="field" maxLength={200} value={r.regimen.slice(OTHER_PREFIX.length)} onChange={(e) => patchRow(r.key, { regimen: OTHER_PREFIX + e.target.value })} /></Fld>}
              {specified && <Fld id={`${id}-components`} label="Actual drugs / trial regimen" required hint="Record the actual drug components, not patient identifiers."><input id={`${id}-components`} className="field" maxLength={170} value={r.regimen.slice(specified.length).replace(/^:\s*/, '')} onChange={(e) => patchRow(r.key, { regimen: `${specified}: ${e.target.value}` })} /></Fld>}
            </div>
            <div className="form-grid diagnosis-second">
              <Fld id={`${id}-start`} label="Start date" required><input id={`${id}-start`} type="date" max={today()} className="field" value={r.startDate} onChange={(e) => patchRow(r.key, { startDate: e.target.value })} /></Fld>
              <Fld id={`${id}-end`} label="End date" required={!r.ongoing}><input id={`${id}-end`} type="date" max={today()} className="field" disabled={r.ongoing} value={r.ongoing ? '' : r.endDate} onChange={(e) => patchRow(r.key, { endDate: e.target.value })} /></Fld>
              <div className="field-group"><span className="label">Status</span><label className="mine-toggle bt-ongoing"><input type="checkbox" checked={r.ongoing} onChange={(e) => patchRow(r.key, { ongoing: e.target.checked, endDate: e.target.checked ? '' : r.endDate })} data-testid={`checkbox-ongoing-${i}`} /> Ongoing</label></div>
            </div>
          </fieldset>; })}</div>}
      </section>
      {error && <div className="form-error" role="alert" data-testid="text-form-error">{error}</div>}
      <div className="form-actions"><Link href="/breast" className="button button-quiet">Cancel</Link><button type="submit" className="button button-primary" disabled={pending} data-testid="button-save-breast-case">{pending ? 'Saving…' : editing ? 'Save changes' : 'Create case'} {!pending && <ArrowRight size={16} />}</button></div>
    </form>
  </div>;
}
