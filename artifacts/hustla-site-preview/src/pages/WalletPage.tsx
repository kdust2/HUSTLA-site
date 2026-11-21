import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ArrowDownLeft, ArrowUpRight, Check, Clock, Landmark, Smartphone, X } from 'lucide-react';
import { gh } from '@/lib/data';
import { api, formatDay, formatMomo, networkLabel, timeAgo, type Network, type Wallet, type WithdrawalStatus } from '@/lib/api';
import { AppShell, Header } from '@/components/layout';
import { useMode } from '@/lib/mode';

const kindLabel: Record<string, string> = {
  deposit: 'Deposit', earning: 'Earnings', pending: 'Pending earnings', release: 'Earnings cleared',
  withdrawal_request: 'Withdrawal requested', withdrawal_cancel: 'Withdrawal cancelled', withdrawal_reject: 'Withdrawal returned',
};
const bucketLabel: Record<string, string> = { available: 'Available funds', reserved: 'Reserved', pending: 'Pending', withdrawable: 'Withdrawable' };
const statusText: Record<WithdrawalStatus, string> = { requested: 'In the next payout', paid: 'Paid', rejected: 'Returned to wallet', cancelled: 'Cancelled' };

export function WalletPage() {
  const { mode } = useMode();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 3200); };

  // mobile money form
  const [editing, setEditing] = useState(false);
  const [network, setNetwork] = useState<Network>('mtn');
  const [number, setNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [savingMethod, setSavingMethod] = useState(false);
  const [methodError, setMethodError] = useState('');

  // withdraw form
  const [amount, setAmount] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await api<Wallet>('/wallet');
      setWallet(data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your wallet.');
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (!wallet) {
    return (
      <AppShell title="Wallet">
        <Header eyebrow="Wallet" title="Your money." description="Everything that comes in and goes out of your HUSTLA wallet, in one place." />
        {error ? <div className="notice" role="alert">{error}</div> : <p className="auth-caption" role="status">Loading your wallet…</p>}
      </AppShell>
    );
  }

  const { balances, payoutMethod, minWithdrawal } = wallet;
  const showForm = editing || !payoutMethod;
  const amountNumber = Number(amount);
  const amountValid = amount.trim() !== '' && Number.isFinite(amountNumber) && amountNumber > 0 && Math.abs(amountNumber * 100 - Math.round(amountNumber * 100)) < 1e-6;
  const canWithdraw = !!payoutMethod?.verified;

  const startEdit = () => {
    setNetwork(payoutMethod?.network ?? 'mtn');
    setNumber(payoutMethod?.number ?? '');
    setAccountName(payoutMethod?.accountName ?? '');
    setMethodError('');
    setEditing(true);
  };

  const saveMethod = async (event: FormEvent) => {
    event.preventDefault();
    setMethodError('');
    setSavingMethod(true);
    try {
      const data = await api<Wallet>('/wallet/payout-method', { method: 'PUT', body: { network, number, accountName } });
      setWallet(data);
      setEditing(false);
      notify('Mobile money number saved. HUSTLA will verify it before your first withdrawal.');
    } catch (err) {
      setMethodError(err instanceof Error ? err.message : 'Could not save your number.');
    } finally {
      setSavingMethod(false);
    }
  };

  const reviewWithdrawal = (event: FormEvent) => {
    event.preventDefault();
    setWithdrawError('');
    if (!amountValid) { setWithdrawError('Enter an amount in cedis, like 50 or 50.50.'); return; }
    if (amountNumber < minWithdrawal) { setWithdrawError(`The minimum withdrawal is ${gh(minWithdrawal)}.`); return; }
    if (amountNumber > balances.withdrawable) { setWithdrawError(`You can withdraw up to ${gh(balances.withdrawable)}.`); return; }
    setConfirming(true);
  };

  const confirmWithdrawal = async () => {
    setWithdrawing(true);
    setWithdrawError('');
    try {
      const data = await api<Wallet>('/wallet/withdrawals', { body: { amount: amountNumber } });
      setWallet(data);
      setAmount('');
      setConfirming(false);
      notify(`Withdrawal requested. It goes out on ${formatDay(data.withdrawals[0].payoutDate)}.`);
    } catch (err) {
      setConfirming(false);
      setWithdrawError(err instanceof Error ? err.message : 'Could not request that withdrawal.');
      await load();
    } finally {
      setWithdrawing(false);
    }
  };

  const cancelWithdrawal = async (id: number) => {
    try {
      setWallet(await api<Wallet>(`/wallet/withdrawals/${id}/cancel`, { method: 'POST', body: {} }));
      notify('Withdrawal cancelled. The money is back in your wallet.');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not cancel that withdrawal.');
      await load();
    }
  };

  const card = (label: string, value: number, hint: string, key: string, hero: boolean) => (
    <div className={`wallet-card${hero ? ' hero' : ''}`} data-testid={`wallet-${key}`}>
      <span>{label}</span>
      <strong>{gh(value)}</strong>
      <small>{hint}</small>
    </div>
  );

  return (
    <AppShell title="Wallet">
      <Header eyebrow="Wallet" title="Your money." description="Everything that comes in and goes out of your HUSTLA wallet, in one place." />

      <div className="wallet-cards">
        {card('Withdrawable earnings', balances.withdrawable, 'Cleared and ready to withdraw', 'withdrawable', mode === 'worker')}
        {card('Pending earnings', balances.pending, 'Waiting to clear', 'pending', false)}
        {card('Available funds', balances.available, 'For funding your campaigns', 'available', mode === 'publisher')}
        {card('Reserved for campaigns', balances.reserved, 'Held until tasks are resolved', 'reserved', false)}
      </div>
      {balances.inPayout > 0 && <p className="wallet-note" data-testid="wallet-in-payout"><Clock size={15} aria-hidden="true" /> {gh(balances.inPayout)} is in withdrawals waiting to be paid out.</p>}
      {error && <div className="notice" role="alert">{error}</div>}

      <div className="wallet-grid">
        <section className="surface wallet-panel">
          <div className="surface-head"><h2>Mobile money number</h2>{payoutMethod && !showForm && <button type="button" className="btn btn-small" data-testid="button-change-momo" onClick={startEdit}>Change</button>}</div>
          {showForm ? (
            <form onSubmit={saveMethod} className="wallet-form">
              <p className="wallet-help">This is where your withdrawals are sent. Use a number registered in your own name.</p>
              <div className="network-pick" role="radiogroup" aria-label="Network">
                {(Object.keys(networkLabel) as Network[]).map((key) => (
                  <button key={key} type="button" role="radio" aria-checked={network === key} className={`network ${key}${network === key ? ' on' : ''}`} data-testid={`network-${key}`} onClick={() => setNetwork(key)}>{networkLabel[key]}</button>
                ))}
              </div>
              <label htmlFor="momo-number" className="auth-label">Mobile money number</label>
              <input id="momo-number" className="field" data-testid="input-momo-number" inputMode="tel" autoComplete="tel" placeholder="0244 123 456" value={number} onChange={(e) => setNumber(e.target.value)} required />
              <label htmlFor="momo-name" className="auth-label">Name on the account</label>
              <input id="momo-name" className="field" data-testid="input-momo-name" autoComplete="name" placeholder="As registered with your network" value={accountName} onChange={(e) => setAccountName(e.target.value)} required minLength={3} />
              <p className="wallet-help">HUSTLA checks that the name matches before your first withdrawal. Changing the number later means it is checked again.</p>
              {methodError && <div className="notice" role="alert">{methodError}</div>}
              <div className="wallet-actions">
                <button type="submit" className="btn btn-primary" data-testid="button-save-momo" disabled={savingMethod}>{savingMethod ? 'Saving…' : 'Save number'}</button>
                {payoutMethod && <button type="button" className="btn" data-testid="button-cancel-momo" onClick={() => setEditing(false)}>Cancel</button>}
              </div>
            </form>
          ) : payoutMethod && (
            <div className="momo-summary" data-testid="momo-summary">
              <span className={`network-dot ${payoutMethod.network}`} aria-hidden="true"><Smartphone size={18} /></span>
              <div>
                <strong>{networkLabel[payoutMethod.network]} · {formatMomo(payoutMethod.number)}</strong>
                <small>{payoutMethod.accountName}</small>
              </div>
              <span className={`pill ${payoutMethod.verified ? 'pill-live' : 'pill-pending_review'}`} data-testid="momo-status">{payoutMethod.verified ? 'Verified' : 'Waiting for verification'}</span>
            </div>
          )}
        </section>

        <section className="surface wallet-panel">
          <div className="surface-head"><h2>Withdraw</h2></div>
          {!payoutMethod ? (
            <p className="wallet-help" data-testid="withdraw-blocked">Add your mobile money number first, then you can withdraw your earnings here.</p>
          ) : !canWithdraw ? (
            <p className="wallet-help" data-testid="withdraw-blocked">Your number is waiting for HUSTLA to verify it. You can withdraw as soon as it is verified.</p>
          ) : confirming ? (
            <div className="wallet-confirm" data-testid="withdraw-confirm">
              <p><strong>Send {gh(amountNumber)}</strong> to {networkLabel[payoutMethod.network]} {formatMomo(payoutMethod.number)} ({payoutMethod.accountName})?</p>
              <dl>
                <div><dt>Withdrawal fee</dt><dd>{gh(0)}</dd></div>
                <div><dt>You receive</dt><dd>{gh(amountNumber)}</dd></div>
                <div><dt>Paid out on</dt><dd>{formatDay(wallet.nextPayout.date)}</dd></div>
              </dl>
              {withdrawError && <div className="notice" role="alert">{withdrawError}</div>}
              <div className="wallet-actions">
                <button type="button" className="btn btn-primary" data-testid="button-confirm-withdraw" disabled={withdrawing} onClick={() => void confirmWithdrawal()}>{withdrawing ? 'Requesting…' : 'Confirm withdrawal'}</button>
                <button type="button" className="btn" data-testid="button-back-withdraw" disabled={withdrawing} onClick={() => setConfirming(false)}>Back</button>
              </div>
            </div>
          ) : (
            <form onSubmit={reviewWithdrawal} className="wallet-form">
              <label htmlFor="withdraw-amount" className="auth-label">Amount (GH₵)</label>
              <div className="amount-row">
                <input id="withdraw-amount" className="field" data-testid="input-withdraw-amount" inputMode="decimal" placeholder={`Minimum ${minWithdrawal}`} value={amount} onChange={(e) => setAmount(e.target.value)} />
                <button type="button" className="btn btn-small" data-testid="button-withdraw-all" disabled={balances.withdrawable < minWithdrawal} onClick={() => setAmount(String(balances.withdrawable))}>All</button>
              </div>
              <ul className="wallet-rules">
                <li>You can withdraw up to <strong>{gh(balances.withdrawable)}</strong>. Minimum {gh(minWithdrawal)}.</li>
                <li>Payouts go out on <strong>Tuesdays and Fridays</strong>. Request by Monday noon for Tuesday, or Thursday noon for Friday (Ghana time).</li>
                <li>Ask now and you are paid on <strong data-testid="next-payout">{formatDay(wallet.nextPayout.date)}</strong>.</li>
              </ul>
              {withdrawError && <div className="notice" role="alert">{withdrawError}</div>}
              <button type="submit" className="btn btn-primary" data-testid="button-review-withdraw" disabled={balances.withdrawable < minWithdrawal}>Review withdrawal</button>
              {balances.withdrawable < minWithdrawal && <p className="wallet-help">You need at least {gh(minWithdrawal)} in withdrawable earnings to withdraw.</p>}
            </form>
          )}
        </section>
      </div>

      <section className="surface wallet-list" data-testid="withdrawal-list">
        <div className="surface-head"><h2>Withdrawals</h2></div>
        {wallet.withdrawals.length === 0 ? <p className="wallet-empty">No withdrawals yet.</p> : wallet.withdrawals.map((w) => (
          <div className="wallet-row" key={w.id} data-testid={`withdrawal-${w.id}`}>
            <span className={`ledger-icon out`} aria-hidden="true"><ArrowUpRight size={16} /></span>
            <div className="wallet-row-main">
              <strong>{gh(w.amount)} to {networkLabel[w.network]} {formatMomo(w.number)}</strong>
              <small>
                {w.status === 'requested' ? `Payout on ${formatDay(w.payoutDate)}` : w.status === 'paid' ? `Paid ${w.processedAt ? timeAgo(w.processedAt) : ''}${w.reference ? ` · Ref ${w.reference}` : ''}` : w.status === 'rejected' ? `Returned to your wallet${w.reason ? `: ${w.reason}` : ''}` : 'Cancelled, the money is back in your wallet'}
              </small>
            </div>
            <span className={`pill pill-wd-${w.status}`}>{statusText[w.status]}</span>
            {w.status === 'requested' && <button type="button" className="btn btn-small" data-testid={`button-cancel-withdrawal-${w.id}`} onClick={() => void cancelWithdrawal(w.id)}><X size={14} /> Cancel</button>}
          </div>
        ))}
      </section>

      <section className="surface wallet-list" data-testid="ledger-list">
        <div className="surface-head"><h2>Transaction history</h2></div>
        {wallet.ledger.length === 0 ? <p className="wallet-empty">Nothing yet. Deposits, earnings and withdrawals will show up here.</p> : wallet.ledger.map((entry) => (
          <div className="wallet-row" key={entry.id}>
            <span className={`ledger-icon ${entry.amount >= 0 ? 'in' : 'out'}`} aria-hidden="true">{entry.amount >= 0 ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}</span>
            <div className="wallet-row-main">
              <strong>{kindLabel[entry.kind] ?? entry.kind}</strong>
              <small>{bucketLabel[entry.bucket] ?? entry.bucket}{entry.note ? ` · ${entry.note}` : ''} · {timeAgo(entry.createdAt)}</small>
            </div>
            <span className={`ledger-amount ${entry.amount >= 0 ? 'in' : 'out'}`}>{entry.amount >= 0 ? '+' : '−'}{gh(Math.abs(entry.amount))}</span>
          </div>
        ))}
      </section>
      <p className="wallet-footnote"><Landmark size={14} aria-hidden="true" /> Only approved and cleared earnings can be withdrawn. Money that is pending, disputed or on hold stays in your wallet until it is resolved.</p>
      {toast && <div className="toast" role="status"><Check size={14} aria-hidden="true" /> {toast}</div>}
    </AppShell>
  );
}
