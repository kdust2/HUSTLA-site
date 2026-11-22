import { Link } from 'wouter';
import { ArrowRight, BadgeCheck } from 'lucide-react';
import { categories } from '@/lib/data';
import { useScrollReveal, delay, CountUp } from '@/lib/motion';
import { Brand } from '@/components/layout';
import { LegalLinks } from '@/components/LegalLinks';

export function HomePage() {
  useScrollReveal();
  const steps = [
    ['1', 'Pick or post', 'Browse reviewed tasks, or post a brief and a budget.'],
    ['2', 'Do the work', 'Deliver it, with one correction round if needed.'],
    ['3', 'Get paid', 'Approved work is paid in cedis every Tuesday and Friday.'],
  ];
  return (
    <div className="site home">
      <header className="public-header">
        <Brand />
        <div className="public-actions">
          <Link className="btn" href="/sign-in" data-testid="link-public-sign-in">Sign in</Link>
          <Link className="btn btn-primary" href="/sign-up" data-testid="link-public-sign-up">Create account <ArrowRight size={15} /></Link>
        </div>
      </header>
      <main className="home-hero">
        <div className="hero-copy">
          <p className="eyebrow rise" style={delay(0)}>The social marketplace for tasks</p>
          <h1 className="rise" style={delay(120)}>Make your next move <em>count.</em></h1>
          <p className="home-lead rise" style={delay(240)}>HUSTLA is where businesses, creators and everyday people post tasks, take them on and get paid in cedis, all in one community.</p>
          <div className="public-actions rise" style={delay(360)}>
            <Link className="btn btn-primary" href="/sign-up" data-testid="link-hero-sign-up">Create your account <ArrowRight size={16} /></Link>
            <Link className="btn" href="/sign-in" data-testid="link-hero-sign-in">Sign in</Link>
          </div>
          <p className="home-footnote rise" style={delay(480)}>One account for campaign publishers and task workers.</p>
        </div>
        <div className="hero-art rise" style={delay(200)} aria-label="HUSTLA marketplace illustration">
          <span className="ring" aria-hidden="true" />
          <span className="blob blob-a" aria-hidden="true" />
          <span className="blob blob-b" aria-hidden="true" />
          <div className="orbit-card">
            <img src={`${import.meta.env.BASE_URL}assets/hustla-mark.png`} alt="" />
            <span className="mini-label">Discover · Hustle · Earn</span>
            <h2>Good work moves both ways.</h2>
            <p>Find people. Find paid work. Build something real.</p>
          </div>
          <div className="float-pill float-one"><strong>GH₵40</strong> for your next idea</div>
          <div className="float-pill float-two"><BadgeCheck size={16} /> Approved work only</div>
        </div>
      </main>
      <section className="ticker" aria-label="Task categories"><div className="ticker-track">{[...categories, ...categories].map((item, index) => <span key={index}>{item}</span>)}</div></section>
      <section className="home-section">
        <p className="eyebrow reveal">How it works</p>
        <h2 className="reveal" style={delay(80)}>Three steps from idea to cedis.</h2>
        <div className="steps-grid">{steps.map(([number, title, copy], index) => <div className="step-card reveal" style={delay(index * 120)} key={number}><span className="step-num">{number}</span><h3>{title}</h3><p>{copy}</p></div>)}</div>
      </section>
      <section className="home-section">
        <div className="stats-row reveal">
          <div><strong><CountUp to={12} /></strong><span>task categories</span></div>
          <div><strong><CountUp to={24} suffix="h" /></strong><span>campaign review</span></div>
          <div><strong><CountUp to={2} /></strong><span>payout days a week</span></div>
          <div><strong><CountUp to={100} suffix="%" /></strong><span>of the reward goes to the worker</span></div>
        </div>
      </section>
      <section className="home-section cta-wrap">
        <div className="cta-band reveal"><h2>Ready to make a move?</h2><Link className="btn btn-warm" href="/sign-up" data-testid="link-cta-sign-up">Create your account <ArrowRight size={16} /></Link></div>
      </section>
      <footer className="public-footer"><Brand /><span>Built around real work in Ghana. All times are Ghana time (GMT).</span><LegalLinks /></footer>
    </div>
  );
}
