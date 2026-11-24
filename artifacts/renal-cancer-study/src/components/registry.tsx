import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'wouter';
import { useClerk, useUser } from '../auth/provider';
import { Activity, ArrowRight, HeartPulse, LogOut, ShieldCheck, Stethoscope } from 'lucide-react';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

export const REGISTRY_TITLE = 'Cancer Study Registry';

export function useDocumentTitle(title: string) {
  useEffect(() => {
    const previous = document.title;
    document.title = title;
    const meta = document.querySelector('meta[property="og:title"]');
    const prevMeta = meta?.getAttribute('content');
    meta?.setAttribute('content', title);
    return () => {
      document.title = previous;
      if (meta && prevMeta != null) meta.setAttribute('content', prevMeta);
    };
  }, [title]);
}

export function RegistryMark({ small = false }: { small?: boolean }) {
  return <span className={`brand-mark ${small ? 'brand-mark-sm' : ''}`} aria-hidden="true"><span /><span /><span /></span>;
}

export function RegistryLogo({ inverse = false }: { inverse?: boolean }) {
  return <Link href="/" className={`brand ${inverse ? 'brand-inverse' : ''}`} data-testid="link-brand-home">
    <RegistryMark /><span><b>Cancer Study</b><small>REGISTRY</small></span>
  </Link>;
}

export function SwitchRegistry({ name, kind }: { name: string; kind: 'renal' | 'breast' }) {
  return <div className="registry-switch" data-testid={`registry-current-${kind}`}>
    <span className="registry-switch-label">CURRENT REGISTRY</span>
    <b data-testid="text-registry-name">{name}</b>
    <Link href="/registries" className="registry-switch-link" data-testid="link-switch-registry">Switch registry <ArrowRight size={13} /></Link>
  </div>;
}

function ChoiceCards({ cta }: { cta: (href: string) => string }) {
  return <div className="choice-grid">
    <Link href={cta('/user-portal')} className="choice-card choice-renal" data-testid="link-choose-renal">
      <span className="choice-icon"><Activity size={22} /></span>
      <span className="choice-kicker">REGISTRY 01</span>
      <b>Renal cancer study</b>
      <p>Coded renal cell carcinoma cases with cTNM, histology, prognostic factors, treatment lines and follow-up. Cases are visible to their registering physician.</p>
      <span className="choice-go">Open renal registry <ArrowRight size={15} /></span>
    </Link>
    <Link href={cta('/breast')} className="choice-card choice-breast" data-testid="link-choose-breast">
      <span className="choice-icon"><HeartPulse size={22} /></span>
      <span className="choice-kicker">REGISTRY 02</span>
      <b>Breast cancer registry</b>
      <p>Coded stage I to IV breast cancer, retrospective and prospective. Biomarkers, treatment episodes and evolution. Cases are visible to all registry physicians; only the author edits.</p>
      <span className="choice-go">Open breast registry <ArrowRight size={15} /></span>
    </Link>
  </div>;
}

export function RegistryLanding() {
  useDocumentTitle(REGISTRY_TITLE);
  return <main className="landing">
    <header className="landing-header"><RegistryLogo /><nav><Link className="nav-signin" href="/sign-in">Sign in <ArrowRight size={15} /></Link><Link className="button button-primary" href="/sign-up">Create physician account</Link></nav></header>
    <section className="hero entry-hero">
      <div className="hero-copy fade-up">
        <div className="eyebrow"><span className="eyebrow-dot" /> CLINICIAN-LED RESEARCH REGISTRIES</div>
        <h1>One account.<br /><em>Two registries.</em></h1>
        <p className="hero-dek">Coded, longitudinal records for renal and breast cancer research. Sign in once with your physician account, then choose the registry you are working in.</p>
        <div className="hero-actions"><Link href="/sign-up" className="button button-primary button-large" data-testid="link-join">Create physician account <ArrowRight size={17} /></Link><Link href="/sign-in" className="button button-secondary button-large" data-testid="link-sign-in">Physician sign in</Link></div>
        <div className="hero-assurance"><ShieldCheck size={16} /><span>Use study codes only. Do not enter patient identifiers. Research data only, not clinical recommendations.</span></div>
      </div>
    </section>
    <section className="entry-choice" aria-label="Choose a registry">
      <div className="entry-choice-head"><span className="eyebrow">CHOOSE A REGISTRY</span><h2>Separate studies, separate records.</h2></div>
      <ChoiceCards cta={() => '/sign-in'} />
      <p className="entry-note">You will be asked to sign in first. Each registry keeps its own cases, fields and permissions.</p>
    </section>
    <footer className="landing-footer"><RegistryLogo /><span>For clinical research use. Not a clinical decision tool.</span><span>Cancer Study Registry</span></footer>
  </main>;
}

export function RegistryChooser() {
  useDocumentTitle(`Choose a registry · ${REGISTRY_TITLE}`);
  const { signOut } = useClerk();
  const { user } = useUser();
  const [busy, setBusy] = useState(false);
  return <main className="landing chooser-page">
    <header className="landing-header"><RegistryLogo />
      <nav><span className="chooser-user"><Stethoscope size={15} /> {user?.fullName || 'Study physician'}</span>
        <button className="button button-quiet" disabled={busy} data-testid="button-sign-out" onClick={() => { setBusy(true); signOut({ redirectUrl: basePath || '/' }); }}><LogOut size={15} /> Sign out</button></nav>
    </header>
    <section className="entry-choice chooser-body">
      <div className="entry-choice-head fade-up"><span className="eyebrow">WELCOME{user?.firstName ? `, ${user.firstName.toUpperCase()}` : ''}</span><h1>Which registry are you working in today?</h1><p>You can switch at any time from inside a registry.</p></div>
      <ChoiceCards cta={(h) => h} />
    </section>
  </main>;
}

export function Note({ children }: { children: ReactNode }) { return <>{children}</>; }
