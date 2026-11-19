import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { categories, gh } from '@/lib/data';
import { FLASH_KEY } from '@/lib/campaigns';
import { api } from '@/lib/api';
import { AppShell, Header } from '@/components/layout';

export function NewCampaignPage() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(categories[3]);
  const [quantity, setQuantity] = useState(3);
  const [reward, setReward] = useState(40);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const rewardTotal = quantity * reward;

  const go = (next: number) => { setError(''); setStep(next); };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (step === 1 && (title.trim().length < 8 || description.trim().length < 10)) {
      setError('Add a clear title (at least 8 letters) and a short brief to continue.');
      return;
    }
    if (step === 2 && (quantity < 1 || reward < 1)) {
      setError('Tasks and reward must each be at least 1.');
      return;
    }
    if (step < 3) { go(step + 1); return; }
    setSaving(true);
    try {
      await api('/campaigns', { body: { title: title.trim(), description: description.trim(), category, quantity, reward } });
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
      <div className="calc-result"><span>HUSTLA fee (10%)</span><strong>{gh(rewardTotal * 0.1)}</strong></div>
      <div className="calc-result"><b>Total to fund</b><strong>{gh(rewardTotal * 1.1)}</strong></div>
    </div>
  );

  return (
    <AppShell title="New campaign">
      <Header eyebrow="Publisher" title="Start a campaign." description="Tell workers exactly what to make. New campaigns are reviewed within 24 hours." action={<Link className="btn" href="/dashboard" data-testid="link-cancel-campaign">Back to dashboard</Link>} />
      <ol className="steps" aria-label="Progress">
        {['Brief', 'Budget', 'Review'].map((label, index) => (
          <li key={label} className={step === index + 1 ? 'on' : step > index + 1 ? 'done' : ''} aria-current={step === index + 1 ? 'step' : undefined}>{index + 1} {label}</li>
        ))}
      </ol>
      <form className="surface campaign-form form-page" onSubmit={submit}>
        <div className="step-pane" key={step}>
          {step === 1 && <>
            <label htmlFor="campaign-name" style={{ marginTop: 0 }}>Campaign title</label>
            <input id="campaign-name" className="field" data-testid="input-campaign-name" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Create a product demo reel" />
            <label htmlFor="campaign-category">Category</label>
            <select id="campaign-category" className="field" data-testid="select-campaign-category" value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select>
            <label htmlFor="campaign-brief">What should the worker deliver?</label>
            <textarea id="campaign-brief" className="field" data-testid="textarea-campaign-brief" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the deliverable, requirements and what counts as done." />
          </>}
          {step === 2 && <>
            <div className="calc-row">
              <div><label htmlFor="campaign-quantity" style={{ marginTop: 0 }}>Number of tasks</label><input id="campaign-quantity" className="field" data-testid="input-campaign-quantity" type="number" min="1" max="100" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></div>
              <div><label htmlFor="campaign-reward" style={{ marginTop: 0 }}>Reward per task (GH₵)</label><input id="campaign-reward" className="field" data-testid="input-campaign-reward" type="number" min="1" step=".5" value={reward} onChange={(event) => setReward(Number(event.target.value))} /></div>
            </div>
            {summary}
            <p className="auth-caption">The worker always receives the full reward shown. The 10% fee is added on top.</p>
          </>}
          {step === 3 && <>
            <span className="category">{category}</span>
            <h2 style={{ margin: '10px 0 6px' }}>{title}</h2>
            <p className="auth-caption" style={{ margin: '0 0 6px' }}>{description}</p>
            <p className="auth-caption" style={{ margin: 0 }}>{quantity} tasks at {gh(reward)} each</p>
            {summary}
            <p className="auth-caption">Your budget is held safely and only released when you approve the work.</p>
          </>}
        </div>
        {error && <div className="notice" role="alert">{error}</div>}
        <div className="form-actions split">
          {step > 1 ? <button type="button" className="btn" data-testid="button-back-campaign" onClick={() => go(step - 1)}>Back</button> : <Link className="btn" href="/dashboard" data-testid="button-cancel-campaign">Cancel</Link>}
          <button type="submit" className="btn btn-primary" data-testid="button-submit-campaign" disabled={saving}>{step < 3 ? 'Continue' : saving ? 'Submitting…' : 'Submit for review'}</button>
        </div>
      </form>
    </AppShell>
  );
}
