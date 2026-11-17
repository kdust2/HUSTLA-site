import { useState } from 'react';
import { Link } from 'wouter';
import { ArrowRight } from 'lucide-react';
import { gh, type Task } from '@/lib/data';
import { useScrollReveal } from '@/lib/motion';
import { type Campaign } from '@/lib/campaigns';
import { AppShell, Header } from '@/components/layout';

export function PricingPage() {
  useScrollReveal();
  const [quantity, setQuantity] = useState(5);
  const [reward, setReward] = useState(100);
  return (
    <AppShell title="Pricing">
      <Header eyebrow="PRICING & FEES" title="Simple, in cedis." description="One monthly membership, one transparent fee, nothing hidden in the reward." />
      <>
        <div className="pricing-grid reveal"><div className="price-card"><span className="section-label">Task workers</span><div className="price-value">GH₵20<small> / month</small></div><p>Access and apply for available tasks.</p><Link className="btn" href="/leaderboard" data-testid="link-pricing-leaderboard">Leaderboard <ArrowRight size={14} /></Link></div><div className="price-card featured"><span className="section-label" style={{ color: '#f4c449' }}>Advertisers</span><div className="price-value">GH₵30<small> / month</small></div><p>Create and manage reviewed campaigns.</p><Link className="btn btn-warm" href="/campaigns" data-testid="link-pricing-campaigns">Campaigns <ArrowRight size={14} /></Link></div></div>
        <section className="fee-calculator reveal"><h2 className="display">The 10% fee, worked out</h2><p className="auth-caption">HUSTLA charges the advertiser 10% on top. The worker always receives the full agreed reward.</p><div className="calc-row"><div><label htmlFor="calc-quantity">Number of tasks</label><input id="calc-quantity" className="field" data-testid="input-pricing-quantity" type="number" min="1" value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value)))} /></div><div><label htmlFor="calc-reward">Reward per task (GH₵)</label><input id="calc-reward" className="field" data-testid="input-pricing-reward" type="number" min="1" step=".5" value={reward} onChange={(event) => setReward(Math.max(1, Number(event.target.value)))} /></div></div><div className="calc-result"><span>Total workers receive</span><strong>{gh(quantity * reward)}</strong></div><div className="calc-result"><span>HUSTLA fee (10%)</span><strong>{gh(quantity * reward * .1)}</strong></div><div className="calc-result"><b>Campaign funding required</b><strong>{gh(quantity * reward * 1.1)}</strong></div></section>
        <section className="sec reveal"><h2 className="display">Deposits and withdrawals</h2><div className="simple-grid">{[['Minimum campaign deposit','GH₵50'],['Minimum withdrawal','GH₵20'],['Payout days','Tuesday and Friday'],['Membership billing','Monthly only']].map(([label, amount]) => <div className="info-panel" key={label}><span className="auth-caption">{label}</span><h3>{amount}</h3></div>)}</div><p className="auth-caption">Any payment-provider charge is shown before you confirm, and never reduces a worker’s agreed reward.</p></section>
      </>
    </AppShell>
  );
}
