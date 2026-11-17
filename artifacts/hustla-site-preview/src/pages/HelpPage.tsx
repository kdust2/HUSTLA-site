import { Link } from 'wouter';
import { ArrowRight } from 'lucide-react';
import { useScrollReveal } from '@/lib/motion';
import { faqs } from '@/lib/content';
import { AppShell, Header } from '@/components/layout';

export function HelpPage() {
  useScrollReveal();
  return (
    <AppShell title="Help">
      <Header eyebrow="HELP CENTRE" title="Answers, without the runaround." description="The details on payouts, corrections, disputes and keeping the marketplace fair." />
      <><div className="faq-list reveal">{faqs.map(([question, answer], index) => <details key={question}><summary data-testid={`summary-help-${index}`}>{question}</summary><p>{answer}</p></details>)}</div><div className="notice reveal"><strong>Still stuck?</strong> Open a support request from your dashboard, or use the report action on any campaign. <Link href="/dashboard" data-testid="link-help-dashboard">Go to dashboard <ArrowRight size={13} /></Link></div></>
    </AppShell>
  );
}
