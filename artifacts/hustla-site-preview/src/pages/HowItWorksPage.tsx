import { useScrollReveal } from '@/lib/motion';
import { businessSteps, workerSteps } from '@/lib/content';
import { AppShell, Header } from '@/components/layout';
import { NumberedSteps } from '@/components/shared';

export function HowItWorksPage() {
  useScrollReveal();
  return (
    <AppShell title="How it works">
      <Header eyebrow="THE FLOW" title="Two journeys. One community." description="Clear deadlines on both sides, so good work does not get stuck waiting." />
      <div className="simple-grid reveal"><section><h2 className="display">If you publish</h2><NumberedSteps items={businessSteps} /></section><section><h2 className="display">If you earn</h2><NumberedSteps items={workerSteps} /></section></div>
    </AppShell>
  );
}
