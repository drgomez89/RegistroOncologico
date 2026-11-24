import { useEffect, useRef, useState, type ButtonHTMLAttributes, type FormEvent, type ReactNode } from 'react';
import { RegistryAuthProvider as ClerkProvider, Show, SignIn, SignUp, useClerk, useUser, usesSupabase } from './auth/provider';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Route, Switch, Router as WouterRouter, Redirect, Link, useLocation, useRoute } from 'wouter';
import {
  Activity, ArrowLeft, ArrowRight, BookOpenCheck, Building2, CalendarDays, Check,
  ChevronDown, CircleHelp, ClipboardList, Clock3, Filter, LayoutDashboard,
  LogOut, Menu, Plus, Search, ShieldCheck, Trash2, TrendingUp, X,
} from 'lucide-react';
import {
  getGetCaseQueryKey, getGetStudySummaryQueryKey, getListCasesQueryKey,
  useCreateCase, useDeleteCase, useGetCase, useGetStudySummary, useListCases, useUpdateCase,
} from '@workspace/api-client-react';
import type { CaseInput, PatientCase, TreatmentInput } from '@workspace/api-client-react';
import { formatCalendarDate, toDateInput } from './lib/calendar-date';
import { RegistryLanding, RegistryChooser, RegistryLogo, SwitchRegistry, useDocumentTitle } from './components/registry';
import { BreastShell, BreastDashboard, BreastNewCase, BreastCaseDetail } from './components/breast';

const queryClient = new QueryClient();
const clerkPubKey = usesSupabase ? '' : publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
function stripBase(path: string) { return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path; }
if (!usesSupabase && !clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');

const appearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: { logoPlacement: 'inside' as const, logoLinkUrl: basePath || '/', logoImageUrl: `${window.location.origin}${basePath}/logo.svg` },
  variables: {
    colorPrimary: '#28685f', colorForeground: '#203a3d', colorMutedForeground: '#6c8281',
    colorDanger: '#b64e49', colorBackground: '#fffefa', colorInput: '#fffefa',
    colorInputForeground: '#203a3d', colorNeutral: '#d6e0dc', fontFamily: 'DM Sans',
    borderRadius: '0.75rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center', cardBox: 'bg-[#fffefa] rounded-2xl w-[440px] max-w-full overflow-hidden shadow-xl',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none', footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#203a3d] font-bold', headerSubtitle: 'text-[#657d7b]',
    socialButtonsBlockButtonText: 'text-[#203a3d] font-semibold', formFieldLabel: 'text-[#29474a] font-semibold',
    footerActionLink: 'text-[#28685f] font-semibold', footerActionText: 'text-[#657d7b]',
    dividerText: 'text-[#748886]', identityPreviewEditButton: 'text-[#28685f]',
    formFieldSuccessText: 'text-[#28685f]', alertText: 'text-[#8a3f3b]',
    logoBox: 'rounded-xl', logoImage: 'object-contain', socialButtonsBlockButton: 'border-[#d8e2de] bg-[#fffefa]',
    formButtonPrimary: 'bg-[#28685f] hover:bg-[#20584f] text-white font-semibold',
    formFieldInput: 'border-[#d8e2de] bg-[#fffefa] text-[#203a3d]',
    footerAction: 'border-t border-[#e4eae7]', dividerLine: 'bg-[#d8e2de]',
    alert: 'border-[#efd7d3] bg-[#fff6f3]', otpCodeFieldInput: 'border-[#d8e2de]',
    formFieldRow: 'gap-2', main: 'gap-4',
  },
};

const histologies = [
  'Clear cell RCC', 'Papillary RCC (not type 1/2)', 'Chromophobe RCC', 'Collecting duct carcinoma',
  'Renal medullary carcinoma', 'TFE3-rearranged RCC', 'FH-deficient RCC', 'SDH-deficient RCC',
  'TFEB-altered RCC', 'ELOC-mutated RCC', 'Clear cell papillary renal cell tumor',
  'Multilocular cystic renal neoplasm of low malignant potential',
  'Acquired cystic disease-associated RCC', 'Tubulocystic RCC',
  'Mucinous tubular and spindle cell carcinoma', 'Eosinophilic solid and cystic RCC',
  'ALK-rearranged RCC',
  'Unclassified RCC', 'Other / unknown',
];
const prognosticOptions = [
  'Karnofsky performance status <80%', '<1 year from diagnosis to systemic therapy',
  'Hemoglobin below lower limit of normal', 'Corrected calcium above upper limit of normal',
  'Neutrophils above upper limit of normal', 'Platelets above upper limit of normal',
  'Sarcomatoid differentiation', 'Rhabdoid differentiation', 'High grade', 'Tumor necrosis',
  'Venous invasion', 'Nodal involvement', 'Other',
];
const tOptions = ['cT0','cT1a','cT1b','cT2a','cT2b','cT3a','cT3b','cT3c','cT4','cTX'];
const nOptions = ['cN0','cN1','cNX'];
const mOptions = ['cM0','cM1','Not assessed'];
const vitalStatuses = ['Alive','Deceased','Unknown'];
const diseaseStatuses = ['No evidence of disease','Stable disease','Progression / recurrence','Not assessed'];
const treatmentResponses = ['Complete response','Partial response','Stable disease','Progressive disease','Not assessed'];
const stages = ['Stage I','Stage II','Stage III','Stage IV'];
const firstLineRegimens = [
  'Nivolumab + ipilimumab', 'Pembrolizumab + axitinib',
  'Pembrolizumab + lenvatinib', 'Nivolumab + cabozantinib',
];
const otherSystemicRegimens = [
  'Sunitinib', 'Pazopanib', 'Cabozantinib', 'Axitinib', 'Nivolumab',
  'Lenvatinib + everolimus', 'Tivozanib', 'Everolimus', 'Belzutifan',
];
const adjuvantRegimens = ['Adjuvant pembrolizumab'];
const regimenOptions = [...firstLineRegimens, ...otherSystemicRegimens, ...adjuvantRegimens];
const REGIMEN_OTHER = 'Other regimen / clinical trial';

function Mark({ small = false }: { small?: boolean }) {
  return <span className={`brand-mark ${small ? 'brand-mark-sm' : ''}`} aria-hidden="true"><span /><span /><span /></span>;
}
function Logo({ inverse = false, renal = false }: { inverse?: boolean; renal?: boolean }) {
  if (!renal) return <RegistryLogo inverse={inverse} />;
  return <Link href="/" className={`brand ${inverse ? 'brand-inverse' : ''}`} data-testid="link-brand-home">
    <Mark /><span><b>Renal Cancer</b><small>STUDY REGISTRY</small></span>
  </Link>;
}
function Button({ children, variant = 'primary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary'|'secondary'|'quiet'|'danger' }) {
  return <button {...props} className={`button button-${variant} ${className}`}>{children}</button>;
}
function AlertNote() {
  return <div className="research-note"><ShieldCheck size={18} /><div><strong>Research data only</strong><p>This is a data capture tool, not a clinical decision aid. Record diagnosis-time TNM and stage as documented by the study clinician. Follow the study protocol and local clinical documentation.</p><b>Do not enter patient names, dates of birth, medical-record numbers, or other direct identifiers.</b></div></div>;
}
function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) qc.clear();
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);
  return null;
}
function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={appearance}
    signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`}
    signInFallbackRedirectUrl={`${basePath}/registries`} signUpFallbackRedirectUrl={`${basePath}/registries`}
    localization={{ signIn: { start: { title: 'Welcome back', subtitle: 'Continue your study work' } }, signUp: { start: { title: 'Join the registry', subtitle: 'Create your physician account' } } }}
    routerPush={(to) => setLocation(stripBase(to))} routerReplace={(to) => setLocation(stripBase(to), { replace: true })}>
    <QueryClientProvider client={queryClient}><ClerkQueryClientCacheInvalidator />
      <Switch>
        <Route path="/" component={HomeRedirect} />
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route path="/registries" component={ProtectedChooser} />
        <Route path="/breast" component={ProtectedBreastHome} />
        <Route path="/breast/cases/new" component={ProtectedBreastNew} />
        <Route path="/breast/cases/:id" component={ProtectedBreastDetail} />
        <Route path="/user-portal" component={ProtectedPortal} />
        <Route path="/cases/new" component={ProtectedNewCase} />
        <Route path="/cases/:id" component={ProtectedCaseDetail} />
        <Route component={NotFound} />
      </Switch>
    </QueryClientProvider>
  </ClerkProvider>;
}
function SignInPage() {
  return <div className="auth-page"><div className="auth-side"><Logo inverse /><div className="auth-manifest"><span>CANCER STUDY REGISTRY</span><h1>Clear records.<br />Better research.</h1><p>One physician account for coded renal and breast cancer research registries.</p><div className="auth-proof"><ShieldCheck size={18} /> Coded study data only</div></div><div className="auth-foot">Clinical research, recorded with care.</div></div><div className="auth-main"><SignIn fallbackRedirectUrl={`${basePath}/registries`} routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div></div>;
}
function SignUpPage() {
  return <div className="auth-page"><div className="auth-side"><Logo inverse /><div className="auth-manifest"><span>CANCER STUDY REGISTRY</span><h1>Make every case<br />count.</h1><p>Create your physician account, then choose the registry you work in.</p><div className="auth-proof"><ShieldCheck size={18} /> Physician access</div></div><div className="auth-foot">Clinical research, recorded with care.</div></div><div className="auth-main"><SignUp fallbackRedirectUrl={`${basePath}/registries`} routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></div></div>;
}
function HomeRedirect() {
  return <><Show when="signed-in"><Redirect to="/registries" /></Show><Show when="signed-out"><RegistryLanding /></Show></>;
}
function ProtectedChooser() { return <><Show when="signed-in"><RegistryChooser /></Show><Show when="signed-out"><Redirect to="/" /></Show></>; }
function ProtectedBreastHome() { return <><Show when="signed-in"><BreastShell crumb="Overview"><BreastDashboard /></BreastShell></Show><Show when="signed-out"><Redirect to="/" /></Show></>; }
function ProtectedBreastNew() { return <><Show when="signed-in"><BreastShell crumb="New case"><BreastNewCase /></BreastShell></Show><Show when="signed-out"><Redirect to="/" /></Show></>; }
function ProtectedBreastDetail() { return <><Show when="signed-in"><BreastShell crumb="Case record"><BreastCaseDetail /></BreastShell></Show><Show when="signed-out"><Redirect to="/" /></Show></>; }
function ProtectedPortal() { return <><Show when="signed-in"><Shell><Dashboard /></Shell></Show><Show when="signed-out"><Redirect to="/" /></Show></>; }
function ProtectedNewCase() { return <><Show when="signed-in"><Shell><CaseForm /></Shell></Show><Show when="signed-out"><Redirect to="/" /></Show></>; }
function ProtectedCaseDetail() { return <><Show when="signed-in"><Shell><CaseDetail /></Shell></Show><Show when="signed-out"><Redirect to="/" /></Show></>; }
function Shell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { signOut } = useClerk();
  const { user } = useUser();
  useDocumentTitle('Renal Cancer Study · Cancer Study Registry');
  const selected = location === '/user-portal' ? 'overview' : 'cases';
  return <div className="app-shell">
    <aside className={`side-nav ${mobileOpen ? 'side-nav-open' : ''}`}><div className="side-brand"><Logo inverse renal /><button className="mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={19} /></button></div>
      <SwitchRegistry name="Renal cancer study" kind="renal" /><div className="nav-caption">WORKSPACE</div><Link href="/user-portal" className={`side-link ${selected==='overview'?'active':''}`} onClick={() => setMobileOpen(false)}><LayoutDashboard size={17} /> Overview</Link>
      <Link href="/user-portal#cases" className={`side-link ${selected==='cases'?'active':''}`} onClick={() => setMobileOpen(false)}><ClipboardList size={17} /> Coded cases</Link>
      <div className="side-study"><span className="side-study-icon"><BookOpenCheck size={17} /></span><div><b>Study workspace</b><small>AJCC 8th edition</small></div></div>
      <div className="side-bottom"><div className="physician-card"><span className="physician-avatar">{(user?.firstName?.[0] || 'P')}{(user?.lastName?.[0] || '')}</span><span className="physician-meta"><b>{user?.fullName || 'Study physician'}</b><small>Physician account</small></span><button className="logout-button" title="Sign out" data-testid="button-sign-out" onClick={() => signOut({ redirectUrl: basePath || '/' })}><LogOut size={16} /></button></div><p>Research data only.<br />No direct patient identifiers.</p></div>
    </aside>
    {mobileOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
       <div className="main-column"><header className="topbar"><button className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={20} /></button><div className="breadcrumb"><span>Renal cancer study</span><span className="breadcrumb-sep">/</span><b>{selected === 'overview' ? 'Overview' : location.includes('/new') ? 'New case' : location.includes('/cases/') ? 'Case record' : 'Coded cases'}</b></div><div className="topbar-right"><span className="privacy-status"><span /> Account-protected workspace</span><span className="top-avatar">{(user?.firstName?.[0] || 'P').toUpperCase()}</span></div></header><main className="page-content">{children}</main><footer className="app-footer"><span>Renal Cancer Study</span><span>Research data only · Not a clinical decision tool</span></footer></div>
  </div>;
}
function Dashboard() {
  const summaryQuery = useGetStudySummary();
  const casesQuery = useListCases();
  const cases = casesQuery.data || [];
  const summary = summaryQuery.data;
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('All stages');
  const filtered = cases.filter((c) => `${c.patientCode} ${c.hospital} ${c.histology}`.toLowerCase().includes(search.toLowerCase()) && (stageFilter === 'All stages' || c.clinicalStage === stageFilter));
  const isLoading = summaryQuery.isLoading || casesQuery.isLoading;
  return <div className="dashboard fade-up">
    <div className="page-heading"><div><div className="eyebrow">STUDY OVERVIEW</div><h1>Good morning, <span>doctor.</span></h1><p>Your coded cases and treatment follow-up, in one place.</p></div><Link href="/cases/new" className="button button-primary" data-testid="link-create-case"><Plus size={17} /> Add coded case</Link></div>
    <AlertNote />
    {isLoading ? <DashboardSkeleton /> : (summaryQuery.isError || casesQuery.isError) ? <ErrorPanel onRetry={() => { summaryQuery.refetch(); casesQuery.refetch(); }} /> : <>
      <div className="metric-grid">
        <Metric label="Total coded cases" value={summary?.totalCases ?? cases.length} icon={<ClipboardList size={18} />} note="In your study record" tone="teal" />
        <Metric label="Active treatments" value={summary?.activeTreatments ?? cases.reduce((n,c)=>n+(c.treatments||[]).filter(t=>t.ongoing).length,0)} icon={<Activity size={18} />} note="Ongoing treatment lines" tone="sage" />
        <Metric label="Stable disease" value={summary?.stableCases ?? cases.filter(c=>c.diseaseStatus==='Stable disease').length} icon={<Check size={18} />} note="Independent disease status" tone="gold" />
        <Metric label="Progression / recurrence" value={summary?.progressiveCases ?? cases.filter(c=>c.diseaseStatus==='Progression / recurrence').length} icon={<TrendingUp size={18} />} note="Independent disease status" tone="rose" />
        <Metric label="No evidence of disease" value={summary?.noEvidenceOfDiseaseCases ?? cases.filter(c=>c.diseaseStatus==='No evidence of disease').length} icon={<ShieldCheck size={18} />} note="Not the same as stable disease" tone="sage" />
        <Metric label="Deceased" value={summary?.deceasedCases ?? cases.filter(c=>c.vitalStatus==='Deceased').length} icon={<CalendarDays size={18} />} note="Independent vital status" tone="rose" />
      </div>
      <section className="panel case-panel" id="cases">
        <div className="panel-heading"><div><h2>Coded case records</h2><p>Longitudinal records linked by study code only.</p></div><span className="count-badge">{cases.length} {cases.length === 1 ? 'case' : 'cases'}</span></div>
        <div className="table-controls"><label className="search-box"><Search size={16} /><input aria-label="Search coded cases" data-testid="input-case-search" placeholder="Search code, hospital, histology" value={search} onChange={(e)=>setSearch(e.target.value)} /></label><label className="filter-box"><Filter size={15} /><select aria-label="Filter by stage" value={stageFilter} onChange={(e)=>setStageFilter(e.target.value)}><option>All stages</option>{stages.map(s=><option key={s}>{s}</option>)}</select><ChevronDown size={14} /></label></div>
        {casesQuery.isLoading ? <TableSkeleton /> : filtered.length === 0 ? <EmptyCases filtered={cases.length > 0} /> : <div className="table-scroll"><table className="case-table"><thead><tr><th>STUDY CODE</th><th>DIAGNOSIS DATE</th><th>HOSPITAL</th><th>STAGE AT DIAGNOSIS</th><th>HISTOLOGY</th><th>VITAL STATUS</th><th>DISEASE STATUS</th><th>TREATMENT RESPONSE</th><th>LAST FOLLOW-UP</th><th>TREATMENT</th><th></th></tr></thead><tbody>{filtered.map(c=><CaseRow key={c.id} item={c} />)}</tbody></table></div>}
        <div className="table-foot"><span>Showing {filtered.length} of {cases.length} case records</span><Link href="/cases/new" className="text-link">Add a case <ArrowRight size={14} /></Link></div>
      </section>
      <div className="dashboard-bottom"><div className="bottom-note"><span className="bottom-icon"><Clock3 size={17} /></span><div><b>Keep follow-up current</b><p>Update treatment lines as regimens start, end, or remain ongoing.</p></div></div><Link href="/cases/new" className="button button-secondary">Start a new record <ArrowRight size={16} /></Link></div>
    </>}
  </div>;
}
function Metric({ label, value, icon, note, tone }: {label:string;value:number;icon:ReactNode;note:string;tone:string}) {
  return <div className="metric-card"><div className={`metric-icon ${tone}`}>{icon}</div><span className="metric-label">{label}</span><div className="metric-number">{value}</div><span className="metric-note">{note}</span></div>;
}
function CaseRow({ item }: {item:PatientCase}) {
  const active = item.treatments?.find(t=>t.ongoing);
  const date = formatCalendarDate(item.diagnosisDate);
  return <tr data-testid={`row-case-${item.id}`}>
    <td><Link href={`/cases/${item.id}`} className="study-code mono">{item.patientCode}</Link></td><td>{date}</td>
    <td><span className="hospital-cell"><Building2 size={14}/>{item.hospital}</span></td>
    <td><span className="stage-pill">{item.clinicalStage}</span></td><td className="histology-cell">{item.histology}</td>
    <td><OutcomeBadge outcome={item.vitalStatus||'Not recorded'}/>{item.vitalStatus==='Deceased' && <div className="death-date" data-testid={`text-death-date-${item.id}`}>Date of death: {formatCalendarDate(item.deathDate)}</div>}
      {!item.vitalStatus && item.outcome && <div className="legacy-status">Historical combined outcome: {item.outcome}{item.deathDate && ` · Date of death: ${formatCalendarDate(item.deathDate)}`}</div>}
    </td>
    <td><OutcomeBadge outcome={item.diseaseStatus||'Not recorded'}/></td>
    <td><OutcomeBadge outcome={item.treatmentResponse||'Not recorded'}/></td>
    <td>{formatCalendarDate(item.lastFollowUpDate)}</td>
    <td><span className="treatment-cell">{active ? <><i />{active.regimen}</> : item.treatments?.length ? `${item.treatments.length} line${item.treatments.length === 1 ? '' : 's'}` : 'Not recorded'}</span></td>
    <td><Link href={`/cases/${item.id}`} className="row-open" aria-label={`Open case ${item.patientCode}`}><ArrowRight size={16}/></Link></td>
  </tr>;
}
function OutcomeBadge({ outcome }: {outcome:string}) {
  const tone = ['Alive','No evidence of disease','Stable disease','Complete response'].includes(outcome) ? 'positive' : ['Deceased','Progressive disease','Progression / recurrence'].includes(outcome) ? 'warning' : outcome === 'Partial response' ? 'info' : 'neutral';
  return <span className={`outcome outcome-${tone}`}><i />{outcome}</span>;
}
function EmptyCases({filtered}:{filtered:boolean}) {
  return <div className="empty-state"><div className="empty-icon"><ClipboardList size={23}/></div><h3>{filtered ? 'No records match this view' : 'Your study list is ready'}</h3><p>{filtered ? 'Try another search term or clear the stage filter.' : 'Create your first coded case to begin a longitudinal record.'}</p>{!filtered && <Link href="/cases/new" className="button button-primary"><Plus size={16}/> Add coded case</Link>}</div>;
}
function DashboardSkeleton() {
  return <><div className="metric-grid">{[1,2,3,4].map(i=><div className="metric-card skeleton-card" key={i}><div className="skeleton skeleton-icon"/><div className="skeleton skeleton-line"/><div className="skeleton skeleton-number"/><div className="skeleton skeleton-line short"/></div>)}</div><div className="panel skeleton-panel"><div className="skeleton skeleton-line"/><div className="skeleton skeleton-row"/><div className="skeleton skeleton-row"/><div className="skeleton skeleton-row"/></div></>;
}
function TableSkeleton() { return <div className="table-skeleton">{[1,2,3].map(i=><div className="skeleton skeleton-row" key={i}/>)}</div>; }
function ErrorPanel({onRetry}:{onRetry:()=>void}) {
  return <div className="error-panel"><div><CircleHelp size={20}/></div><h3>We couldn't load the study records</h3><p>Please check your connection and try again. Your data has not been changed.</p><Button variant="secondary" onClick={onRetry}>Try again</Button></div>;
}
function CaseForm() { return <CaseEditor />; }
function CaseDetail() {
  const [, params] = useRoute('/cases/:id');
  const id = Number(params?.id);
  const caseQuery = useGetCase(id, { query: { enabled: Number.isFinite(id) && id > 0, queryKey: getGetCaseQueryKey(id) } });
  if (caseQuery.isLoading) return <EditorSkeleton />;
  if (caseQuery.isError || !caseQuery.data) return <div className="page-error"><ErrorPanel onRetry={()=>caseQuery.refetch()}/><Link href="/user-portal" className="text-link"><ArrowLeft size={14}/> Return to overview</Link></div>;
  return <CaseEditor initial={caseQuery.data} />;
}
function CaseEditor({ initial }: {initial?:PatientCase}) {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const create = useCreateCase();
  const update = useUpdateCase();
  const remove = useDeleteCase();
  const editing = Boolean(initial);
  const [patientCode,setPatientCode] = useState(initial?.patientCode || '');
  const [hospital,setHospital] = useState(initial?.hospital || '');
  const [diagnosisDate,setDiagnosisDate] = useState(toDateInput(initial?.diagnosisDate));
  const [clinicalT,setClinicalT] = useState(initial?.clinicalT || '');
  const [clinicalN,setClinicalN] = useState(initial?.clinicalN || '');
  const [clinicalM,setClinicalM] = useState(initial?.clinicalM || '');
  const [clinicalStage,setClinicalStage] = useState(initial?.clinicalStage || '');
  const [histology,setHistology] = useState(initial?.histology || '');
  const initialFactors = initial?.prognosticFactors || [];
  const [prognosticFactors,setPrognosticFactors] = useState<string[]>(initialFactors.filter(f=>f!=='Other'&&!f.startsWith('Other: ')));
  const [includeOtherFactor,setIncludeOtherFactor] = useState(initialFactors.some(f=>f==='Other'||f.startsWith('Other: ')));
  const [otherPrognosticFactor,setOtherPrognosticFactor] = useState(initialFactors.find(f=>f.startsWith('Other: '))?.slice(7)||'');
  const [factorSearch,setFactorSearch] = useState('');
  const [vitalStatus,setVitalStatus] = useState(initial?.vitalStatus || '');
  const [diseaseStatus,setDiseaseStatus] = useState(initial?.diseaseStatus || '');
  const [treatmentResponse,setTreatmentResponse] = useState(initial?.treatmentResponse || '');
  const [lastFollowUpDate,setLastFollowUpDate] = useState(toDateInput(initial?.lastFollowUpDate));
  const [deathDate,setDeathDate] = useState(toDateInput(initial?.deathDate));
  const [treatments,setTreatments] = useState<TreatmentInput[]>((initial?.treatments || []).map(t=>({regimen:t.regimen,startDate:toDateInput(t.startDate),endDate:toDateInput(t.endDate)||null,ongoing:t.ongoing,clinicalResponse:t.clinicalResponse??null,discontinuationReason:t.discontinuationReason??null})));
  const [formError,setFormError] = useState('');
  const pending = create.isPending || update.isPending || remove.isPending;
  function toggleFactor(factor:string) {
    if (factor === 'Other') { setIncludeOtherFactor(current=>!current); return; }
    setPrognosticFactors(current=>current.includes(factor)?current.filter(x=>x!==factor):[...current,factor]);
  }
  function patchTreatment(index:number,patch:Partial<TreatmentInput>) { setTreatments(current=>current.map((t,i)=>i===index?{...t,...patch}:t)); }
  function addTreatment() { setTreatments(current=>[...current,{regimen:'',startDate:'',endDate:null,ongoing:true,clinicalResponse:null,discontinuationReason:null}]); }
  function deleteCase() {
    if (!initial || !window.confirm(`Delete coded case ${initial.patientCode}? This cannot be undone.`)) return;
    remove.mutate({id:initial.id},{onSuccess:async()=>{await Promise.all([qc.invalidateQueries({queryKey:getListCasesQueryKey()}),qc.invalidateQueries({queryKey:getGetStudySummaryQueryKey()}),qc.invalidateQueries({queryKey:getGetCaseQueryKey(initial.id)})]);setLocation('/user-portal');},onError:()=>setFormError('Case could not be deleted. Please try again.')});
  }
  function submit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault(); setFormError('');
    if (!patientCode.trim() || !hospital.trim() || !diagnosisDate || !clinicalT || !clinicalN || !clinicalM || !clinicalStage || !histology) { setFormError('Complete each required diagnosis field before saving.'); return; }
    if (!vitalStatuses.includes(vitalStatus) || !diseaseStatuses.includes(diseaseStatus) || !treatmentResponses.includes(treatmentResponse)) { setFormError('Select vital status, disease status, and treatment response separately. Use Not assessed when appropriate.'); return; }
    if (!lastFollowUpDate || lastFollowUpDate<diagnosisDate || lastFollowUpDate>new Date().toISOString().slice(0,10)) { setFormError('Enter a last follow-up date on or after diagnosis and not in the future.'); return; }
    if (vitalStatus==='Deceased' && (!deathDate || deathDate<diagnosisDate || deathDate>lastFollowUpDate)) { setFormError('Enter a date of death on or after diagnosis and no later than the last follow-up.'); return; }
     if (includeOtherFactor && !otherPrognosticFactor.trim()) { setFormError('Describe the additional prognostic factor or clear the Other selection.'); return; }
     if (treatments.some(t=>!t.regimen.trim()||t.regimen===REGIMEN_OTHER||!t.startDate)) { setFormError('Each treatment line needs a regimen and start date. Complete the other-regimen or clinical-trial text when selected.'); return; }
     if (treatments.some(t=>(!t.ongoing&&!t.endDate)||(Boolean(t.endDate)&&Boolean(t.startDate)&&t.endDate!<t.startDate))) { setFormError('Completed treatment lines need an end date on or after the start date.'); return; }
     const payload:CaseInput = { patientCode:patientCode.trim(),hospital:hospital.trim(),diagnosisDate,tnmEdition:'AJCC 8th edition',clinicalT,clinicalN,clinicalM,clinicalStage:clinicalStage as CaseInput['clinicalStage'],histology,prognosticFactors:[...prognosticFactors,...(includeOtherFactor?[`Other: ${otherPrognosticFactor.trim()}`]:[])],vitalStatus:vitalStatus as CaseInput['vitalStatus'],diseaseStatus:diseaseStatus as CaseInput['diseaseStatus'],treatmentResponse:treatmentResponse as CaseInput['treatmentResponse'],lastFollowUpDate,deathDate:vitalStatus==='Deceased'?deathDate:null,treatments:treatments.map(t=>({...t,regimen:t.regimen.trim(),endDate:t.ongoing?null:t.endDate||null})) };
    const onSuccess = async (saved:PatientCase) => { await Promise.all([qc.invalidateQueries({queryKey:getListCasesQueryKey()}),qc.invalidateQueries({queryKey:getGetStudySummaryQueryKey()}),...(initial?[qc.invalidateQueries({queryKey:getGetCaseQueryKey(initial.id)})]:[])]); setLocation(`/cases/${saved.id}`); };
    if(initial) update.mutate({id:initial.id,data:payload},{onSuccess,onError:()=>setFormError('Changes could not be saved. Please try again.')});
    else create.mutate({data:payload},{onSuccess,onError:()=>setFormError('Case could not be created. Please try again.')});
  }
  return <div className="editor-page fade-up">
    <div className="editor-breadcrumb"><Link href="/user-portal"><ArrowLeft size={15}/> All coded cases</Link><span>/</span><b>{editing ? initial?.patientCode : 'New case record'}</b></div>
    <div className="editor-heading"><div><div className="eyebrow">{editing ? 'CASE RECORD' : 'NEW STUDY ENTRY'}</div><h1>{editing ? 'Edit coded case' : 'Add a coded case'}</h1><p>{editing ? 'Review the diagnosis profile and treatment history.' : 'Start with the diagnosis record. Add treatment lines as documented.'}</p></div>{editing && <Button variant="danger" onClick={deleteCase} disabled={pending}><Trash2 size={16}/> Delete case</Button>}</div>
    <AlertNote />
    <div className="reference-strip" aria-label="Clinical reference sources">
      <span>REFERENCE SOURCES</span>
      <a href="https://www.cancer.gov/types/kidney/hp/kidney-treatment-pdq" target="_blank" rel="noreferrer">NCI PDQ · AJCC 8th edition <ArrowRight size={12}/></a>
      <a href="https://uroweb.org/guidelines/renal-cell-carcinoma/chapter/epidemiology-aetiology-and-pathology" target="_blank" rel="noreferrer">EAU · WHO 2022 histology <ArrowRight size={12}/></a>
      <a href="https://uroweb.org/guidelines/renal-cell-carcinoma/chapter/disease-management" target="_blank" rel="noreferrer">EAU 2026 · disease management <ArrowRight size={12}/></a>
    </div>
    <form onSubmit={submit} className="case-form">
      <section className="form-section"><div className="section-head"><span className="section-index">01</span><div><h2>Study identification</h2><p>Use the protocol-assigned code; do not enter direct identifiers.</p></div></div><div className="form-grid"><Field label="Patient study code" required hint="Study code only. No patient identifiers."><input className="field mono" data-testid="input-patient-code" maxLength={80} placeholder="e.g. RCC-0427" value={patientCode} onChange={e=>setPatientCode(e.target.value)} /></Field><Field label="Hospital / study site" required><input className="field" data-testid="input-hospital" maxLength={200} placeholder="Enter hospital or site name" value={hospital} onChange={e=>setHospital(e.target.value)} /></Field><Field label="Diagnosis date" required><div className="field-icon-wrap"><CalendarDays size={16}/><input type="date" className="field" data-testid="input-diagnosis-date" value={diagnosisDate} onChange={e=>setDiagnosisDate(e.target.value)} /></div></Field></div></section>
       <section className="form-section">
         <div className="section-head"><span className="section-index">02</span><div><h2>Diagnosis profile</h2><p>Record the clinical TNM and stage at diagnosis as documented.</p></div><span className="fixed-edition">TNM · AJCC 8th edition</span></div>
         <div className="form-grid form-grid-4"><SelectField label="Clinical T" required value={clinicalT} onChange={setClinicalT} options={tOptions} placeholder="Select cT"/><SelectField label="Clinical N" required value={clinicalN} onChange={setClinicalN} options={nOptions} placeholder="Select cN"/><SelectField label="Clinical M" required value={clinicalM} onChange={setClinicalM} options={mOptions} placeholder="Select cM"/><SelectField label="Clinical stage at diagnosis" required value={clinicalStage} onChange={setClinicalStage} options={stages} placeholder="Select stage"/></div>
         <div className="form-grid form-grid-2 diagnosis-second">
           <SelectField label="Histology · WHO 2022" required value={histology} onChange={setHistology} options={histologies} placeholder="Select histology"/>
         </div>
         <div className="inline-guidance"><CircleHelp size={15}/><span>No stage is calculated. Enter the clinician-recorded diagnosis-time stage and TNM.</span></div>
       </section>
       <section className="form-section" data-testid="section-follow-up">
         <div className="section-head"><span className="section-index">03</span><div><h2>Follow-up and outcomes</h2><p>Record vital status, disease status, and treatment response independently.</p></div></div>
         {initial?.outcome && (!initial.vitalStatus || initial.outcome!=='Not assessed') && <div className="research-note"><CircleHelp size={18}/><div><strong>Historical combined outcome: {initial.outcome}</strong><p>This original value is retained, not automatically reclassified. Review and select each independent field below.</p></div></div>}
         <div className="form-grid form-grid-2">
           <SelectField label="Vital status" required value={vitalStatus} onChange={value=>{setVitalStatus(value);if(value!=='Deceased')setDeathDate('');}} options={vitalStatuses} placeholder="Select vital status"/>
           <SelectField label="Disease status" required value={diseaseStatus} onChange={setDiseaseStatus} options={diseaseStatuses} placeholder="Select disease status"/>
           <SelectField label="Latest global treatment response" required value={treatmentResponse} onChange={setTreatmentResponse} options={treatmentResponses} placeholder="Select response"/>
           <Field label="Last follow-up date" required><input type="date" aria-label="Last follow-up date" className="field" data-testid="input-last-follow-up-date" required min={diagnosisDate||undefined} max={new Date().toISOString().slice(0,10)} value={lastFollowUpDate} onChange={e=>setLastFollowUpDate(e.target.value)}/></Field>
           {vitalStatus==='Deceased' && <Field label="Date of death" required><input type="date" aria-label="Date of death" className="field" data-testid="input-death-date" required min={diagnosisDate||undefined} max={lastFollowUpDate||new Date().toISOString().slice(0,10)} value={deathDate} onChange={e=>setDeathDate(e.target.value)}/></Field>}
         </div>
         <div className="inline-guidance"><CircleHelp size={15}/><span>No evidence of disease is not the same as stable disease. Response is clinician-recorded; no response criteria are calculated. Use Not assessed when response has not been evaluated.</span></div>
       </section>
     <section className="form-section"><div className="section-head"><span className="section-index">04</span><div><h2>Prognostic factors</h2><p>Select each factor recorded in the study documentation.</p></div></div><div className="factor-tools"><label className="search-box"><Search size={15}/><input aria-label="Search prognostic factors" data-testid="input-factor-search" placeholder="Search factors" value={factorSearch} onChange={e=>setFactorSearch(e.target.value)}/></label><span>{prognosticFactors.length + Number(includeOtherFactor)} selected</span></div><div className="factor-grid">{prognosticOptions.filter(f=>f.toLowerCase().includes(factorSearch.toLowerCase())).map((factor,i)=><label key={factor} className={`factor-check ${(factor==='Other'?includeOtherFactor:prognosticFactors.includes(factor))?'checked':''}`}><input type="checkbox" data-testid={`checkbox-factor-${i}`} checked={factor==='Other'?includeOtherFactor:prognosticFactors.includes(factor)} onChange={()=>toggleFactor(factor)}/><span className="checkmark"><Check size={13}/></span><span>{factor}</span></label>)}</div>{includeOtherFactor && <Field label="Other factor" required hint="Stored with the prognostic-factor list."><input className="field" data-testid="input-other-factor" value={otherPrognosticFactor} onChange={e=>setOtherPrognosticFactor(e.target.value)} placeholder="Describe the additional factor"/></Field>}</section>
       <section className="form-section treatment-section">
         <div className="section-head">
           <span className="section-index">05</span>
           <div><h2>Treatment history</h2><p>Add each systemic treatment line in sequence, following the study protocol.</p></div>
           <Button type="button" variant="secondary" onClick={addTreatment}><Plus size={16}/> Add treatment line</Button>
         </div>
         <div className="regimen-disclaimer">Data-capture options only — not treatment recommendations. Select and record treatments according to the study protocol and local clinical documentation. <a href="https://uroweb.org/guidelines/renal-cell-carcinoma/chapter/disease-management" target="_blank" rel="noreferrer">EAU 2026 disease management reference <ArrowRight size={12}/></a></div>
         {treatments.length===0
           ? <div className="treatment-empty"><span><Activity size={18}/></span><div><b>No treatment lines recorded</b><p>Add a regimen when treatment is documented. This section may remain empty.</p></div><Button type="button" variant="quiet" onClick={addTreatment}><Plus size={15}/> Add line</Button></div>
           : <div className="treatment-list">{treatments.map((t,i)=>{
             const otherChoice = t.regimen===REGIMEN_OTHER || (!!t.regimen && !regimenOptions.includes(t.regimen));
             const regimenValue = otherChoice ? REGIMEN_OTHER : t.regimen;
             return <div className="treatment-card" key={i}>
               <div className="treatment-card-head"><span className="line-number">LINE {String(i+1).padStart(2,'0')}</span><span className={t.ongoing?'line-status active-line':'line-status'}><i/>{t.ongoing?'Ongoing':'Completed'}</span><button type="button" className="remove-line" aria-label={`Remove treatment line ${i+1}`} data-testid={`button-remove-treatment-${i}`} onClick={()=>setTreatments(current=>current.filter((_,idx)=>idx!==i))}><Trash2 size={15}/></button></div>
               <div className="form-grid form-grid-3 treatment-fields">
                 <Field label="Systemic regimen" required>
                   <div className="select-wrap"><select className="field" data-testid={`select-regimen-${i}`} value={regimenValue} onChange={e=>patchTreatment(i,{regimen:e.target.value})}>
                     <option value="">Select a data-capture option</option>
                     <optgroup label="First-line combinations · clear-cell RCC">{firstLineRegimens.map(r=><option key={r} value={r}>{r}</option>)}</optgroup>
                     <optgroup label="Other systemic regimens">{otherSystemicRegimens.map(r=><option key={r} value={r}>{r}</option>)}</optgroup>
                     <optgroup label="Adjuvant">{adjuvantRegimens.map(r=><option key={r} value={r}>{r}</option>)}</optgroup>
                     <option value={REGIMEN_OTHER}>Other regimen / clinical trial</option>
                   </select><ChevronDown size={15}/></div>
                   {otherChoice && <input className="field regimen-other" data-testid={`input-regimen-other-${i}`} value={t.regimen===REGIMEN_OTHER?'':t.regimen} onChange={e=>patchTreatment(i,{regimen:e.target.value||REGIMEN_OTHER})} placeholder="Enter other regimen or clinical-trial name" aria-label="Other regimen or clinical trial name"/>}
                 </Field>
                 <Field label="Start date" required><input type="date" className="field" data-testid={`input-treatment-start-${i}`} value={t.startDate} onChange={e=>patchTreatment(i,{startDate:e.target.value})}/></Field>
                 <Field label="End date"><input type="date" className="field" data-testid={`input-treatment-end-${i}`} disabled={t.ongoing} value={t.endDate||''} onChange={e=>patchTreatment(i,{endDate:e.target.value||null})}/></Field>
               </div>
               <div className="form-grid treatment-fields">
                 <SelectField label={`Clinical response · line ${i+1}`} value={t.clinicalResponse||''} onChange={value=>patchTreatment(i,{clinicalResponse:(value||null) as TreatmentInput['clinicalResponse']})} options={treatmentResponses} placeholder="Unclassified / pending review"/>
                 <SelectField label={`Reason for discontinuation · line ${i+1}`} value={t.discontinuationReason||''} onChange={value=>patchTreatment(i,{discontinuationReason:(value||null) as TreatmentInput['discontinuationReason']})} options={['Planned completion','Progression','Toxicity','Death','Other','Not documented']} placeholder="Unclassified / pending review"/>
               </div>
               <p className="field-hint">Record only what is documented for this line; no RECIST calculation or automatic classification. These fields do not change the latest global response or disease status. Leave unclassified until reviewed; use Not documented if the reason was reviewed but is unavailable.</p>
               <label className="ongoing-toggle"><input type="checkbox" data-testid={`checkbox-treatment-ongoing-${i}`} checked={t.ongoing} onChange={e=>patchTreatment(i,{ongoing:e.target.checked,endDate:e.target.checked?null:t.endDate})}/><span className="toggle-track"/><span>Ongoing treatment</span></label>
             </div>;
           })}</div>}
       </section>
      {formError && <div className="form-error" role="alert"><CircleHelp size={17}/>{formError}</div>}
       <div className="form-actions"><Link href={editing?`/cases/${initial?.id}`:'/user-portal'} className="button button-quiet">Cancel</Link><div><span className="autosave-note"><ShieldCheck size={14}/> Saved to your study record</span><Button type="submit" disabled={pending} data-testid="button-save-case">{pending ? 'Saving record…' : editing ? 'Save changes' : 'Create case record'} {!pending && <ArrowRight size={16}/>}</Button></div></div>
    </form>
  </div>;
}
function Field({label,required,hint,children}:{label:string;required?:boolean;hint?:string;children:ReactNode}) {
  return <div className="field-group"><label className="label">{label}{required&&<em> *</em>}</label>{children}{hint&&<span className="field-hint">{hint}</span>}</div>;
}
function SelectField({label,required,value,onChange,options,placeholder}:{label:string;required?:boolean;value:string;onChange:(value:string)=>void;options:string[];placeholder?:string}) {
  return <Field label={label} required={required}><div className="select-wrap"><select aria-label={label} required={required} className="field" value={value} onChange={e=>onChange(e.target.value)}><option value="">{placeholder||'Select an option'}</option>{options.map(o=><option key={o} value={o}>{o}</option>)}</select><ChevronDown size={15}/></div></Field>;
}
function EditorSkeleton() {
  return <div className="editor-skeleton"><div className="skeleton skeleton-line short"/><div className="skeleton skeleton-title"/><div className="panel"><div className="skeleton skeleton-row"/><div className="skeleton skeleton-row"/><div className="skeleton skeleton-row"/></div></div>;
}
function NotFound() {
  return <div className="not-found"><Logo/><span className="eyebrow">404 · RECORD NOT FOUND</span><h1>This page isn't in the study.</h1><p>The address may have changed, or the record is no longer available.</p><Link href="/" className="button button-primary">Return to registry home <ArrowRight size={16}/></Link></div>;
}

function App() {
  return <WouterRouter base={basePath}><ClerkProviderWithRoutes /></WouterRouter>;
}
export default App;
