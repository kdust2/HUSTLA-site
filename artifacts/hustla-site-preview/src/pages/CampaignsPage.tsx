import { Link } from 'wouter';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { categories } from '@/lib/data';
import { useScrollReveal } from '@/lib/motion';
import { businessSteps } from '@/lib/content';
import { AppShell, Header } from '@/components/layout';
import { NumberedSteps, CampaignIntegrity } from '@/components/shared';

export function CampaignsPage() {
  useScrollReveal();
  return (
    <AppShell title="Campaigns">
      <Header eyebrow="CAMPAIGNS" title="Find your people. Make good work." description="UGC, demos, graphics, testing and research — delivered by real people, with your budget held until approval." />
      <>
        <section className="business-hero reveal"><h2>Campaigns that pay for actual work.</h2><p>Choose who applies, review every deliverable and keep your brief and budget in control at each step.</p><Link className="btn btn-warm" href="/new-campaign" data-testid="button-publish-campaign-info">Publish a campaign <ArrowRight size={15} /></Link></section>
        <section className="sec reveal"><h2 className="display">What can you put to work?</h2><p className="auth-caption">Twelve campaign categories, from the first product impression to the final edit.</p><div className="simple-grid">{[['You stay in control', 'Choose applicants, approve the work or request one correction with a clear reason. Scope and reward lock when a worker is accepted.'], ['Your money stays accounted for', 'Budget is reserved before tasks go live. It is released only on approval or a dispute decision. Unused balance stays in your wallet.']].map(([title, copy]) => <div className="info-panel" key={title}><ShieldCheck color="#2455d6" /><h3>{title}</h3><p>{copy}</p></div>)}</div></section>
        <section className="sec reveal"><h2 className="display">From brief to approved work</h2><NumberedSteps items={businessSteps} /><CampaignIntegrity /></section>
      </>
    </AppShell>
  );
}
