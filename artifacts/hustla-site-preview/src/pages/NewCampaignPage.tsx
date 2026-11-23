import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { categories, gh } from '@/lib/data';
import { FLASH_KEY } from '@/lib/campaigns';
import { api, type Wallet } from '@/lib/api';
import { AppShell, Header } from '@/components/layout';

export function NewCampaignPage() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(categories[3]);
  const [deliverable, setDeliverable] = useState('');
  const [criteria, setCriteria] = useState('');
  const [days, setDays] = useState(7);
  const [quantity, setQuantity] = useState(3);
  const [reward, setReward] = useState(40);
  const [available, setAvailable] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<Wallet>('/wallet').then((w) => setAvailable(w.balances.available)).catch(() => setAvailable(null));
  }, []);

  const rewardP = Math.round(reward * 100);
  const feeP = Math.round(rewardP * 0.1);
  const rewardTotal = (quantity * rewardP) / 100;
  const feeTotal = (quantity * feeP) / 100;
  const total = (quantity * (rewardP + feeP)) / 100;
  const short = available !== null && available < total ? total - available : 0;

  const go = (next: number) => { setError(''); setStep(next); };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (step === 1 && (title.trim().length < 8 || description.trim().length < 10)) {
      setError('Add a clear title (at least 8 letters) and a short brief to continue.');
      return;
    }
    if (step === 2 && (deliverable.trim().length < 3 || criteria.trim().length < 3)) {
      setError('Say what the worker must deliver and how you will judge it.');
      return;
    }
    if (step === 3 && (!Number.isInteger(quantity) || quantity < 1 || reward < 1)) {
      setError('Tasks must be a whole number of at least 1, and the reward at least GH₵1.');
      return;
    }
    if (step < 4) { go(step + 1); return; }
    setSaving(true);
    try {
      await api('/campaigns', { body: { title: title.trim(), description: description.trim(), deliverable: deliverable.trim(), criteria: criteria.trim(), category, quantity, reward, days } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit the campaign. Please try again.');
      setSaving(false);
      return;
    }
    try { window.sessionStorage.setItem(FLASH_KEY, 'Submitted. HUSTLA reviews new campaigns within 24 hours.'); } catch { /* storage can be unavailable */ }
    setLocation('/dashboard#publisher');
  };

  const summary = (
    <div className="fee-calculator">
      <div className="calc-result"><span>Workers receive</span><strong>{gh(rewardTotal)}</strong></div>
      <div className="calc-result"><span>HUSTLA fee (10%)</span><strong>{gh(feeTotal)}</strong></div>
      <div className="calc-result"><b>Total to fund</b><strong data-testid="campaign-total">{gh(total)}</strong></div>
    </div>
  );

  return (
    <AppShell title="New campaign">
      <Header eyebrow="Publisher" title="Start a campaign." description="Tell workers exactly what to make. The full cost is reserved from your wallet, and new campaigns are reviewed within 24 hours." action={<Link className="btn" href="/dashboard" data-testid="link-cancel-campaign">Cancel</Link>} />
      <ol className="steps" aria-label="Progress">
        {['Brief', 'Deliverable', 'Budget', 'Review'].map((label, index) => (
          <li key={label} className={step === index + 1 ? 'on' : step > index + 1 ? 'done' : ''} aria-current={step === index + 1 ? 'step' : undefined}>{index + 1} {label}</li>
        ))}
      </ol>
      <form className="surface campaign-form form-page" onSubmit={submit}>
        <div className="step-pane" key={step}>
          {step === 1 && <>
            <label htmlFor="campaign-name" style={{ marginTop: 0 }}>Campaign title</label>
            <input id="campaign-name" className="field" data-testid="input-campaign-name" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Honest unboxing video of our shea butter" maxLength={120} />
            <label htmlFor="campaign-category">Category</label>
            <select id="campaign-category" className="field" data-testid="select-campaign-category" value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select>
            <label htmlFor="campaign-brief">What is the task?</label>
            <textarea id="campaign-brief" className="field" data-testid="textarea-campaign-brief" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the task so a worker knows exactly what to do." rows={5} maxLength={2000} />
          </>}
          {step === 2 && <>
            <label htmlFor="campaign-deliverable" style={{ marginTop: 0 }}>What must the worker deliver?</label>
            <input id="campaign-deliverable" className="field" data-testid="input-campaign-deliverable" value={deliverable} onChange={(event) => setDeliverable(event.target.value)} placeholder="e.g. A link to the posted video" maxLength={300} />
            <label htmlFor="campaign-criteria">How will you judge the work?</label>
            <textarea id="campaign-criteria" className="field" data-testid="textarea-campaign-criteria" value={criteria} onChange={(event) => setCriteria(event.target.value)} placeholder="e.g. At least 30 seconds, shows the product clearly, no copied footage." rows={4} maxLength={1000} />
            <label htmlFor="campaign-days">Days to finish after you accept a worker</label>
            <input id="campaign-days" className="field" data-testid="input-campaign-days" type="number" min={1} max={30} value={days} onChange={(event) => setDays(Number(event.target.value))} />
            <p className="auth-caption">You will have 48 hours to review submitted work. Campaigns for fake followers, likes, reviews, crypto, gambling and other prohibited types are not accepted.</p>
          </>}
          {step === 3 && <>
            <div className="calc-row">
              <div><label htmlFor="campaign-quantity" style={{ marginTop: 0 }}>Number of tasks</label><input id="campaign-quantity" className="field" data-testid="input-campaign-quantity" type="number" min={1} max={100} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></div>
              <div><label htmlFor="campaign-reward" style={{ marginTop: 0 }}>Reward per task (GH₵)</label><input id="campaign-reward" className="field" data-testid="input-campaign-reward" type="number" min={1} step="0.01" value={reward} onChange={(event) => setReward(Number(event.target.value))} /></div>
            </div>
            {summary}
            <p className="auth-caption">The worker always receives the full reward shown. The 10% fee is added on top.</p>
          </>}
          {step === 4 && <>
            <span className="category">{category}</span>
            <h2 style={{ margin: '10px 0 6px' }}>{title}</h2>
            <p className="auth-caption" style={{ margin: '0 0 6px' }}>{description}</p>
            <p className="auth-caption" style={{ margin: '0 0 6px' }}><strong>Deliverable:</strong> {deliverable}</p>
            <p className="auth-caption" style={{ margin: '0 0 6px' }}><strong>Judged on:</strong> {criteria}</p>
            <p className="auth-caption" style={{ margin: 0 }}>{quantity} tasks at {gh(reward)} each, {days} {days === 1 ? 'day' : 'days'} to finish</p>
            {summary}
            <p className="auth-caption" data-testid="campaign-funds">Your available funds: <strong>{available === null ? 'unknown' : gh(available)}</strong>. Submitting reserves {gh(total)}. It is only paid out when you approve the work, and it comes back to you if the campaign is declined or closed.</p>
            {short > 0 && <div className="notice" role="alert" data-testid="campaign-short">You need {gh(short)} more. <Link href="/wallet" data-testid="link-add-funds">Add funds in your Wallet</Link>, then come back.</div>}
          </>}
        </div>
        {error && <div className="notice" role="alert">{error}</div>}
        <div className="form-actions split">
          {step > 1 ? <button type="button" className="btn" data-testid="button-back-campaign" onClick={() => go(step - 1)}>Back</button> : <Link className="btn" href="/dashboard" data-testid="button-cancel-campaign">Cancel</Link>}
          <button type="submit" className="btn btn-primary" data-testid="button-submit-campaign" disabled={saving || (step === 4 && short > 0)}>{step < 4 ? 'Continue' : saving ? 'Submitting…' : 'Submit for review'}</button>
        </div>
      </form>
    </AppShell>
  );
}
