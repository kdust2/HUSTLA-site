import { createHash, createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

const CATEGORIES = [
  'Business & Product Promotion', 'Social Media Growth', 'Music & Entertainment',
  'Content Creation & UGC', 'Design & Branding', 'Video & Photo Services',
  'Digital & Tech Services', 'Events & Experiences', 'Writing & Marketing',
  'Fashion & Lifestyle', 'Education & Learning', 'Other Tasks & Opportunities',
];
const COOKIE = 'hustla_session';
const SESSION_DAYS = 30;
const RESET_HOURS = 24;
const MIN_WITHDRAWAL_P = 2000; // GH₵20, from the HUSTLA wallet rules
const NETWORKS = ['mtn', 'telecel', 'at'];
const FEE_RATE = 0.1; // HUSTLA's 10% fee, paid by the publisher on top of the reward
const MIN_DEPOSIT_P = 5000; // GH₵50
const feeFor = (rewardP: number) => Math.round(rewardP * FEE_RATE);

// Database access. On Render (or anywhere with DATABASE_URL) use a normal Postgres connection;
// on Netlify fall back to Netlify Database. Connected lazily so a missing connection gives a clear 503.
type SqlImpl = (strings: TemplateStringsArray, values: unknown[]) => Promise<any>;
let impl: Promise<SqlImpl> | null = null;
function getImpl(): Promise<SqlImpl> {
  impl ??= (async (): Promise<SqlImpl> => {
    const url = process.env.DATABASE_URL;
    if (url) {
      const pg = (await import('pg')).default;
      const pool = new pg.Pool({
        connectionString: url,
        max: 5,
        // Render's external hostnames need TLS; internal ones do not.
        ssl: /\.render\.com/.test(url) ? { rejectUnauthorized: false } : undefined,
      });
      return async (strings, values) => {
        const text = strings.reduce((acc, part, i) => acc + part + (i < values.length ? `$${i + 1}` : ''), '');
        return (await pool.query(text, values as any[])).rows;
      };
    }
    const { getDatabase } = await import('@netlify/database');
    const db = getDatabase();
    return async (strings, values) => (db.sql as any)(strings, ...values);
  })();
  return impl;
}
const sql = async (strings: TemplateStringsArray, ...values: unknown[]): Promise<any> => (await getImpl())(strings, values);

// ---------- schema (idempotent, runs once per cold start) ----------
let ready: Promise<void> | null = null;
function ensureSchema(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS campaigns (
        id SERIAL PRIMARY KEY,
        owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 100),
        reward NUMERIC(10,2) NOT NULL CHECK (reward >= 1),
        days INTEGER NOT NULL DEFAULT 7,
        status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review','live','declined','closed')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        reviewed_at TIMESTAMPTZ,
        reviewed_by INTEGER REFERENCES users(id)
      )`;
      await sql`CREATE TABLE IF NOT EXISTS applications (
        id SERIAL PRIMARY KEY,
        campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        worker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (campaign_id, worker_id)
      )`;
      await sql`CREATE TABLE IF NOT EXISTS app_secrets (
        name TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS password_resets (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT,
        expires_at TIMESTAMPTZ,
        used_at TIMESTAMPTZ,
        dismissed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_seq INTEGER NOT NULL DEFAULT 0`;
      await sql`CREATE TABLE IF NOT EXISTS wallet_ledger (
        id BIGSERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        bucket TEXT NOT NULL CHECK (bucket IN ('available','reserved','pending','withdrawable','payout_hold')),
        amount_p BIGINT NOT NULL,
        kind TEXT NOT NULL,
        ref_type TEXT,
        ref_id INTEGER,
        note TEXT,
        actor_id INTEGER REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS payout_methods (
        user_id INTEGER PRIMARY KEY REFERENCES users(id),
        network TEXT NOT NULL CHECK (network IN ('mtn','telecel','at')),
        number TEXT NOT NULL,
        account_name TEXT NOT NULL,
        verified_at TIMESTAMPTZ,
        verified_by INTEGER REFERENCES users(id),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS withdrawals (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        amount_p BIGINT NOT NULL CHECK (amount_p > 0),
        network TEXT NOT NULL,
        number TEXT NOT NULL,
        account_name TEXT NOT NULL,
        payout_date DATE NOT NULL,
        status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','paid','rejected','cancelled')),
        reason TEXT,
        reference TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        processed_at TIMESTAMPTZ,
        processed_by INTEGER REFERENCES users(id)
      )`;
      await sql`CREATE INDEX IF NOT EXISTS wallet_ledger_user_idx ON wallet_ledger (user_id, id DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS withdrawals_status_idx ON withdrawals (status, payout_date)`;
      await sql`CREATE INDEX IF NOT EXISTS withdrawals_user_idx ON withdrawals (user_id, id DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS password_resets_token_idx ON password_resets (token_hash)`;
      await sql`CREATE INDEX IF NOT EXISTS campaigns_status_idx ON campaigns (status, created_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS campaigns_owner_idx ON campaigns (owner_id)`;
      await sql`CREATE TABLE IF NOT EXISTS assignments (
        id SERIAL PRIMARY KEY,
        campaign_id INTEGER NOT NULL REFERENCES campaigns(id),
        application_id INTEGER NOT NULL UNIQUE REFERENCES applications(id),
        worker_id INTEGER NOT NULL REFERENCES users(id),
        publisher_id INTEGER NOT NULL REFERENCES users(id),
        reward_p BIGINT NOT NULL,
        fee_p BIGINT NOT NULL,
        status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned','submitted','correction_requested','resubmitted','completed','cancelled','expired','under_dispute')),
        due_at TIMESTAMPTZ NOT NULL,
        review_due_at TIMESTAMPTZ,
        correction_due_at TIMESTAMPTZ,
        correction_used BOOLEAN NOT NULL DEFAULT false,
        correction_reason TEXT,
        reminded BOOLEAN NOT NULL DEFAULT false,
        settled TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        completed_at TIMESTAMPTZ
      )`;
      await sql`CREATE TABLE IF NOT EXISTS submissions (
        id SERIAL PRIMARY KEY,
        assignment_id INTEGER NOT NULL REFERENCES assignments(id),
        round INTEGER NOT NULL,
        link TEXT,
        note TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS task_events (
        id BIGSERIAL PRIMARY KEY,
        assignment_id INTEGER REFERENCES assignments(id),
        campaign_id INTEGER REFERENCES campaigns(id),
        actor_id INTEGER REFERENCES users(id),
        event TEXT NOT NULL,
        note TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS notifications (
        id BIGSERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT,
        href TEXT,
        read_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS deposits (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        amount_p BIGINT NOT NULL CHECK (amount_p > 0),
        reference TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','confirmed','rejected')),
        note TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        processed_at TIMESTAMPTZ,
        processed_by INTEGER REFERENCES users(id)
      )`;
      await sql`CREATE TABLE IF NOT EXISTS disputes (
        id SERIAL PRIMARY KEY,
        assignment_id INTEGER NOT NULL UNIQUE REFERENCES assignments(id),
        opened_by INTEGER NOT NULL REFERENCES users(id),
        reason TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
        decision TEXT,
        worker_amount_p BIGINT,
        admin_note TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        resolved_at TIMESTAMPTZ,
        resolved_by INTEGER REFERENCES users(id)
      )`;
      await sql`CREATE TABLE IF NOT EXISTS dispute_messages (
        id SERIAL PRIMARY KEY,
        dispute_id INTEGER NOT NULL REFERENCES disputes(id),
        user_id INTEGER NOT NULL REFERENCES users(id),
        body TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS reports (
        id SERIAL PRIMARY KEY,
        campaign_id INTEGER NOT NULL REFERENCES campaigns(id),
        reporter_id INTEGER NOT NULL REFERENCES users(id),
        reason TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (campaign_id, reporter_id)
      )`;
      await sql`CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )`;
      await sql`CREATE INDEX IF NOT EXISTS assignments_campaign_idx ON assignments (campaign_id, status)`;
      await sql`CREATE INDEX IF NOT EXISTS assignments_worker_idx ON assignments (worker_id, id DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS assignments_deadline_idx ON assignments (status, due_at)`;
      await sql`CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, id DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS applications_campaign_idx ON applications (campaign_id, status)`;
      // One-time upgrades (the version is kept in app_secrets).
      const version = Number(rowsOf(await sql`SELECT value FROM app_secrets WHERE name = 'schema_v'`)[0]?.value ?? 0);
      if (version < 1) {
        await sql`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS deliverable TEXT NOT NULL DEFAULT ''`;
        await sql`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS criteria TEXT NOT NULL DEFAULT ''`;
        await sql`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS slots_taken INTEGER NOT NULL DEFAULT 0`;
        await sql`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS reward_p BIGINT`;
        await sql`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS fee_p BIGINT NOT NULL DEFAULT 0`;
        await sql`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS funded BOOLEAN NOT NULL DEFAULT false`;
        await sql`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ`;
        await sql`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS review_note TEXT`;
        await sql`UPDATE campaigns SET reward_p = ROUND(reward * 100) WHERE reward_p IS NULL`;
        await sql`ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_status_check`;
        await sql`ALTER TABLE applications ADD CONSTRAINT applications_status_check CHECK (status IN ('pending','accepted','declined','expired','withdrawn'))`;
        await sql`ALTER TABLE wallet_ledger DROP CONSTRAINT IF EXISTS wallet_ledger_bucket_check`;
        await sql`ALTER TABLE wallet_ledger ADD CONSTRAINT wallet_ledger_bucket_check CHECK (bucket IN ('available','reserved','pending','withdrawable','payout_hold','fee'))`;
        await sql`INSERT INTO app_secrets (name, value) VALUES ('schema_v', '1') ON CONFLICT (name) DO UPDATE SET value = '1'`;
      }
    })().catch((error) => { ready = null; throw error; });
  }
  return ready;
}

// ---------- helpers ----------
class HttpError extends Error {
  constructor(public status: number, public code: string, message?: string) { super(message ?? code); }
}
const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } });

const rowsOf = (result: any): any[] => (Array.isArray(result) ? result : result?.rows ?? []);
const b64url = (buf: Buffer | string) => Buffer.from(buf).toString('base64url');
// Session signing key: SESSION_SECRET if set, otherwise a random key generated once and kept in the database.
let cachedSecret: string | null = null;
async function secret(): Promise<string> {
  if (cachedSecret) return cachedSecret;
  const fromEnv = process.env.SESSION_SECRET;
  if (fromEnv && fromEnv.length >= 16) return (cachedSecret = fromEnv);
  await sql`INSERT INTO app_secrets (name, value) VALUES ('session', ${randomBytes(32).toString('hex')}) ON CONFLICT (name) DO NOTHING`;
  const rows = rowsOf(await sql`SELECT value FROM app_secrets WHERE name = 'session'`);
  if (!rows[0]) throw new HttpError(500, 'server_misconfigured', 'Could not load the session key.');
  return (cachedSecret = rows[0].value as string);
}
const sign = async (payload: string) => createHmac('sha256', await secret()).update(payload).digest('base64url');
const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a); const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
// Changing a password changes this value, which signs out any older sessions.
const fingerprint = (passwordHash: string) => sha256(passwordHash).slice(0, 16);

// Small in-memory attempt limiter (per server instance) to slow down guessing.
const hits = new Map<string, number[]>();
function throttle(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    throw new HttpError(429, 'too_many_attempts', 'Too many attempts. Please wait a few minutes and try again.');
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
}
const clientIp = (req: Request) =>
  (req.headers.get('x-forwarded-for') ?? req.headers.get('x-nf-client-connection-ip') ?? 'unknown').split(',')[0].trim();

// Optional email through Resend. Without RESEND_API_KEY and MAIL_FROM, reset links are handed out by the admin instead.
const emailEnabled = () => !!(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
async function sendMail(to: string, subject: string, text: string): Promise<boolean> {
  if (!emailEnabled()) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: process.env.MAIL_FROM, to: [to], subject, text }),
    });
    return res.ok;
  } catch { return false; }
}
const appBase = (req: Request) => (process.env.APP_URL ?? new URL(req.url).origin).replace(/\/$/, '');

const adminEmails = () => (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
const isAdminEmail = (email: string) => adminEmails().includes(email.toLowerCase());

async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `s1$${salt.toString('base64')}$${hash.toString('base64')}`;
}
async function verifyPassword(password: string, stored: string) {
  const [version, saltB64, hashB64] = stored.split('$');
  if (version !== 's1' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
const DUMMY_HASH = 's1$AAAAAAAAAAAAAAAAAAAAAA==$' + Buffer.alloc(64).toString('base64');

async function sessionCookie(userId: number, passwordHash: string) {
  const exp = Date.now() + SESSION_DAYS * 86400_000;
  const payload = b64url(JSON.stringify({ u: userId, e: exp, p: fingerprint(passwordHash) }));
  return `${COOKIE}=${payload}.${await sign(payload)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_DAYS * 86400}`;
}
const clearCookie = () => `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;

async function readSession(req: Request): Promise<{ u: number; p: string } | null> {
  const header = req.headers.get('cookie') ?? '';
  const match = header.split(/;\s*/).find((part) => part.startsWith(`${COOKIE}=`));
  if (!match) return null;
  const token = match.slice(COOKIE.length + 1);
  const [payload, mac] = token.split('.');
  if (!payload || !mac || !safeEqual(mac, await sign(payload))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof data.u === 'number' && typeof data.e === 'number' && typeof data.p === 'string' && data.e > Date.now() ? { u: data.u, p: data.p } : null;
  } catch { return null; }
}

type User = { id: number; name: string; email: string; isAdmin: boolean };
const publicUser = (row: any): User => ({ id: row.id, name: row.name, email: row.email, isAdmin: isAdminEmail(row.email) });

async function currentUser(req: Request): Promise<User | null> {
  const session = await readSession(req);
  if (!session) return null;
  const rows = rowsOf(await sql`SELECT id, name, email, password_hash FROM users WHERE id = ${session.u}`);
  return rows[0] && safeEqual(session.p, fingerprint(rows[0].password_hash)) ? publicUser(rows[0]) : null;
}
async function requireUser(req: Request) {
  const user = await currentUser(req);
  if (!user) throw new HttpError(401, 'not_signed_in', 'Please sign in.');
  return user;
}
// Member features are for member accounts. The admin account only runs the platform.
async function requireMember(req: Request) {
  const user = await requireUser(req);
  if (user.isAdmin) throw new HttpError(403, 'admin_account', 'The admin account only manages HUSTLA. Use a separate member account to try member features.');
  return user;
}
async function requireAdmin(req: Request) {
  const user = await requireUser(req);
  if (!user.isAdmin) throw new HttpError(403, 'forbidden', 'Admins only.');
  return user;
}

async function body(req: Request): Promise<Record<string, unknown>> {
  try {
    const data = await req.json();
    return data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  } catch { throw new HttpError(400, 'bad_json', 'Request body must be JSON.'); }
}
const str = (value: unknown, min: number, max: number, label: string) => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length < min || text.length > max) throw new HttpError(400, 'invalid', `${label} must be ${min} to ${max} characters.`);
  return text;
};

const campaignView = (row: any) => {
  const ageDays = Math.floor((Date.now() - new Date(row.created_at).getTime()) / 86400_000);
  const rewardP = row.reward_p !== null && row.reward_p !== undefined ? Number(row.reward_p) : Math.round(Number(row.reward) * 100);
  const feeP = Number(row.fee_p ?? 0);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    deliverable: row.deliverable ?? '',
    criteria: row.criteria ?? '',
    category: row.category,
    quantity: row.quantity,
    reward: rewardP / 100,
    fee: feeP / 100,
    budget: (row.quantity * (rewardP + feeP)) / 100,
    days: row.days,
    daysLeft: Math.max(0, row.days - ageDays),
    status: row.status,
    funded: !!row.funded,
    slotsTaken: Number(row.slots_taken ?? 0),
    reviewNote: row.review_note ?? null,
    createdAt: row.created_at,
    ...(row.spots_open !== undefined ? { spotsOpen: Math.max(0, Number(row.spots_open)) } : {}),
    ...(row.applicant_count !== undefined ? { applicantCount: Number(row.applicant_count) } : {}),
    ...(row.pending_apps !== undefined ? { pendingApps: Number(row.pending_apps) } : {}),
    ...(row.to_review !== undefined ? { toReview: Number(row.to_review) } : {}),
    ...(row.completed !== undefined ? { completed: Number(row.completed) } : {}),
    ...(row.report_count !== undefined ? { reportCount: Number(row.report_count) } : {}),
    ...(row.application_status !== undefined ? { applicationStatus: row.application_status } : {}),
    ...(row.applied !== undefined ? { applied: !!row.applied } : {}),
    ...(row.owner_id !== undefined ? { isOwn: !!row.is_own } : {}),
    ...(row.owner_name !== undefined ? { ownerName: row.owner_name, ownerEmail: row.owner_email } : {}),
  };
};

// ---------- wallet ----------
const ghs = (pesewas: number) => Number(pesewas) / 100;
// Whole pesewas from a GH₵ amount; null if it is not a positive number with at most 2 decimals.
function toPesewas(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : NaN;
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000) return null;
  const p = Math.round(n * 100);
  return Math.abs(n * 100 - p) < 1e-6 ? p : null;
}
function normaliseMomo(input: unknown): string | null {
  let digits = (typeof input === 'string' ? input : '').replace(/[\s-]/g, '');
  if (digits.startsWith('+233')) digits = '0' + digits.slice(4);
  else if (digits.startsWith('233')) digits = '0' + digits.slice(3);
  return /^0[25]\d{8}$/.test(digits) ? digits : null;
}
// Payout runs are Tuesdays and Fridays (Ghana time = GMT). A request is included in a run if it is made
// before 12:00 noon on the day before: Monday for Tuesday, Thursday for Friday.
export function nextPayout(now: Date = new Date()): { date: string; cutoff: string } {
  for (let i = 0; i < 10; i++) {
    const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + i));
    const dow = day.getUTCDay();
    if (dow !== 2 && dow !== 5) continue;
    const cutoff = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() - 1, 12, 0, 0));
    if (cutoff.getTime() > now.getTime()) return { date: day.toISOString().slice(0, 10), cutoff: cutoff.toISOString() };
  }
  throw new Error('no payout date found');
}

async function walletView(userId: number) {
  const sums = rowsOf(await sql`SELECT bucket, COALESCE(SUM(amount_p), 0) AS total FROM wallet_ledger WHERE user_id = ${userId}::int GROUP BY bucket`);
  const b: Record<string, number> = { available: 0, reserved: 0, pending: 0, withdrawable: 0, payout_hold: 0 };
  for (const row of sums) b[row.bucket] = Number(row.total);
  const pm = rowsOf(await sql`SELECT network, number, account_name, verified_at FROM payout_methods WHERE user_id = ${userId}::int`)[0];
  const ledger = rowsOf(await sql`SELECT id, bucket, amount_p, kind, note, created_at FROM wallet_ledger
    WHERE user_id = ${userId}::int AND bucket NOT IN ('payout_hold', 'fee') ORDER BY id DESC LIMIT 50`);
  const wds = rowsOf(await sql`SELECT id, amount_p, network, number, status, reason, reference,
      to_char(payout_date, 'YYYY-MM-DD') AS payout_date, created_at, processed_at
    FROM withdrawals WHERE user_id = ${userId}::int ORDER BY id DESC LIMIT 30`);
  const deposits = rowsOf(await sql`SELECT id, amount_p, reference, status, note, created_at FROM deposits WHERE user_id = ${userId}::int ORDER BY id DESC LIMIT 20`);
  const instructions = rowsOf(await sql`SELECT value FROM app_settings WHERE key = 'deposit_instructions'`)[0]?.value ?? '';
  return {
    balances: { available: ghs(b.available), reserved: ghs(b.reserved), pending: ghs(b.pending), withdrawable: ghs(b.withdrawable), inPayout: ghs(b.payout_hold) },
    payoutMethod: pm ? { network: pm.network, number: pm.number, accountName: pm.account_name, verified: !!pm.verified_at } : null,
    ledger: ledger.map((row) => ({ id: Number(row.id), bucket: row.bucket, amount: ghs(Number(row.amount_p)), kind: row.kind, note: row.note, createdAt: row.created_at })),
    withdrawals: wds.map((row) => ({
      id: row.id, amount: ghs(Number(row.amount_p)), network: row.network, number: row.number, status: row.status,
      reason: row.reason, reference: row.reference, payoutDate: row.payout_date, createdAt: row.created_at, processedAt: row.processed_at,
    })),
    minWithdrawal: ghs(MIN_WITHDRAWAL_P),
    minDeposit: ghs(MIN_DEPOSIT_P),
    depositInstructions: instructions as string,
    deposits: deposits.map((row) => ({ id: row.id, amount: ghs(Number(row.amount_p)), reference: row.reference, status: row.status, note: row.note, createdAt: row.created_at })),
    nextPayout: nextPayout(),
  };
}

// Money that leaves a bucket is guarded by a per-user counter: the write only happens if nobody else touched
// this wallet since we read it, so two requests at once cannot spend the same money twice.
async function walletSnapshot(userId: number, bucket: string) {
  const row = rowsOf(await sql`SELECT u.wallet_seq AS seq,
      COALESCE((SELECT SUM(amount_p) FROM wallet_ledger WHERE user_id = u.id AND bucket = ${bucket}), 0) AS bal
    FROM users u WHERE u.id = ${userId}::int`)[0];
  return { seq: Number(row.seq), balance: Number(row.bal) };
}


// ---------- safety screening (the proposal's prohibited campaign list) ----------
const PROHIBITED: [string, RegExp][] = [
  ['fake engagement', /\b(buy|sell|purchase|exchange|swap|get|boost)\b.{0,30}\b(followers?|likes?|views?|subscribers?|streams?|plays?)\b/i],
  ['fake engagement', /\b(fake|bot|artificial|paid)\s+(followers?|likes?|views?|comments?|streams?|engagement|subscribers?)\b/i],
  ['fake or paid reviews', /\b(paid|fake|positive|five[- ]star|5[- ]star)\s+(google\s+)?(reviews?|ratings?|testimonials?)\b/i],
  ['fake or paid reviews', /\b(write|leave|post|give)\b.{0,25}\b(5[- ]star|five[- ]star|positive|google)\b.{0,15}\b(reviews?|ratings?)\b/i],
  ['gambling', /\b(betting|gambl\w*|casino|sportybet|lotto|jackpot)\b/i],
  ['financial or crypto offers', /\b(crypto\w*|bitcoin|ethereum|usdt|nft|binance|forex|loans?|investment|invest(ing)?|ponzi|money[- ]doubling|double your money)\b/i],
  ['adult content', /\b(escort|nudes?|porn\w*|xxx|sex (video|service)s?)\b/i],
  ['giveaways and contests', /\b(giveaways?|sweepstakes?|raffle|win a prize)\b/i],
  ['job recruitment', /\b(we are hiring|job vacanc\w+|work[- ]from[- ]home|recruitment)\b/i],
  ['health and medical claims', /\b(weight loss|slimming|supplements?|herbal (medicine|remedy)|miracle cure|medical claim)\b/i],
  ['political campaigns', /\b(vote for|election campaign|political party|campaign for (the )?(ndc|npp))\b/i],
  ['alcohol', /\b(alcohol|beer|whisky|whiskey|vodka)\b/i],
  ['content involving children', /\b(children|kids|minors?|under ?18|underage|pupils?)\b/i],
  ['academic dishonesty', /\b(write my (essay|assignment|thesis)|do my (assignment|homework|exam)|exam (answers|leak))\b/i],
  ['cybercrime', /\b(hack\w*|malware|phishing|spyware|ddos|password cracking)\b/i],
];
function screenText(text: string): string | null {
  for (const [label, re] of PROHIBITED) if (re.test(text)) return label;
  return null;
}

// ---------- notifications and history ----------
async function notify(userId: number, kind: string, title: string, bodyText: string, href: string) {
  try {
    await sql`INSERT INTO notifications (user_id, kind, title, body, href) VALUES (${userId}::int, ${kind}, ${title}, ${bodyText}, ${href})`;
  } catch (error) { console.error('notify failed', error); }
}
async function notifyAdmins(kind: string, title: string, bodyText: string, href: string) {
  for (const email of adminEmails()) {
    const row = rowsOf(await sql`SELECT id FROM users WHERE email = ${email}`)[0];
    if (row) await notify(row.id, kind, title, bodyText, href);
  }
}
async function logEvent(assignmentId: number | null, campaignId: number | null, actorId: number | null, event: string, note: string | null = null) {
  try {
    await sql`INSERT INTO task_events (assignment_id, campaign_id, actor_id, event, note) VALUES (${assignmentId}::int, ${campaignId}::int, ${actorId}::int, ${event}, ${note})`;
  } catch (error) { console.error('event log failed', error); }
}
const cedis = (pesewas: number) => `GH₵${(Number(pesewas) / 100).toFixed(2)}`;

// ---------- settling a task ----------
// One atomic statement: the task changes state and the money moves, or neither happens.
type SettleOptions = {
  id: number; guard: 'review' | 'dispute'; kind: 'release' | 'refund' | 'split'; workerP?: number;
  actor: number | null; note: string; disputeId?: number; decision?: string; adminNote?: string;
};
async function settleAssignment(o: SettleOptions) {
  const a = rowsOf(await sql`SELECT reward_p, fee_p FROM assignments WHERE id = ${o.id}::int`)[0];
  if (!a) return null;
  const R = Number(a.reward_p), F = Number(a.fee_p);
  let W = R, fee = F, refund = 0, status = 'completed', label = 'paid';
  if (o.kind === 'refund') { W = 0; fee = 0; refund = R + F; status = 'cancelled'; label = 'refunded'; }
  if (o.kind === 'split') { W = Math.max(0, Math.min(R, Math.round(o.workerP ?? 0))); fee = feeFor(W); refund = R + F - W - fee; label = 'split'; }
  const done = rowsOf(await sql`WITH s AS (
      UPDATE assignments SET status = ${status}, settled = ${label}, completed_at = now(), updated_at = now()
      WHERE id = ${o.id}::int AND ((${o.guard}::text = 'review' AND status IN ('submitted','resubmitted')) OR (${o.guard}::text = 'dispute' AND status = 'under_dispute'))
      RETURNING id, worker_id, publisher_id, campaign_id, reward_p, fee_p
    ), d AS (
      UPDATE disputes SET status = 'resolved', decision = ${o.decision ?? null}, worker_amount_p = ${W}::bigint, admin_note = ${o.adminNote ?? null},
        resolved_at = now(), resolved_by = ${o.actor}::int
      WHERE id = ${o.disputeId ?? 0}::int AND status = 'open' AND EXISTS (SELECT 1 FROM s) RETURNING id
    ), l AS (
      INSERT INTO wallet_ledger (user_id, bucket, amount_p, kind, ref_type, ref_id, note, actor_id)
      SELECT s.publisher_id, 'reserved'::text, (-(s.reward_p + s.fee_p))::bigint, 'task_settled'::text, 'assignment'::text, s.id, ${o.note}::text, ${o.actor}::int FROM s
      UNION ALL
      SELECT s.worker_id, 'withdrawable'::text, ${W}::bigint, 'earning'::text, 'assignment'::text, s.id, ${o.note}::text, ${o.actor}::int FROM s WHERE ${W}::bigint > 0
      UNION ALL
      SELECT s.publisher_id, 'fee'::text, ${fee}::bigint, 'fee'::text, 'assignment'::text, s.id, 'Platform fee'::text, ${o.actor}::int FROM s WHERE ${fee}::bigint > 0
      UNION ALL
      SELECT s.publisher_id, 'available'::text, ${refund}::bigint, 'task_refund'::text, 'assignment'::text, s.id, ${o.note}::text, ${o.actor}::int FROM s WHERE ${refund}::bigint > 0
      RETURNING 1
    ) SELECT id, worker_id, publisher_id, campaign_id FROM s`)[0];
  return done ? { ...done, workerP: W, feeP: fee, refundP: refund } : null;
}

// A task that was not delivered in time. While the campaign is open the money stays reserved and the spot reopens;
// on a closed campaign the money goes back to the publisher.
async function expireAssignment(id: number) {
  const done = rowsOf(await sql`WITH e AS (
      UPDATE assignments SET status = 'expired', updated_at = now()
      WHERE id = ${id}::int AND ((status = 'assigned' AND due_at < now()) OR (status = 'correction_requested' AND correction_due_at < now()))
      RETURNING id, campaign_id, worker_id, publisher_id, reward_p, fee_p
    ), reopen AS (
      UPDATE campaigns SET slots_taken = slots_taken - 1 WHERE id IN (SELECT campaign_id FROM e) AND status = 'live' RETURNING id
    ), refund AS (
      INSERT INTO wallet_ledger (user_id, bucket, amount_p, kind, ref_type, ref_id, note)
      SELECT e.publisher_id, 'reserved'::text, (-(e.reward_p + e.fee_p))::bigint, 'task_refund'::text, 'assignment'::text, e.id, 'Task was not delivered in time'::text FROM e WHERE NOT EXISTS (SELECT 1 FROM reopen)
      UNION ALL
      SELECT e.publisher_id, 'available'::text, (e.reward_p + e.fee_p)::bigint, 'task_refund'::text, 'assignment'::text, e.id, 'Task was not delivered in time'::text FROM e WHERE NOT EXISTS (SELECT 1 FROM reopen)
      RETURNING 1
    ) SELECT e.id, e.campaign_id, e.worker_id, e.publisher_id, EXISTS (SELECT 1 FROM reopen) AS reopened FROM e`)[0];
  if (!done) return null;
  await logEvent(done.id, done.campaign_id, null, 'expired', 'The deadline passed');
  await notify(done.worker_id, 'task_expired', 'A task expired', 'The deadline passed before the work was delivered.', `/tasks/${done.id}`);
  await notify(done.publisher_id, 'task_expired', 'A task expired', done.reopened ? 'The worker missed the deadline. The spot is open again and your money stays reserved.' : 'The worker missed the deadline and your money was returned to your wallet.', `/campaigns/${done.campaign_id}`);
  return done;
}

// Time-based rules from the workflow specification. Safe to run often and from several servers at once.
export async function runSweep() {
  const expired = rowsOf(await sql`UPDATE applications SET status = 'expired' WHERE status = 'pending' AND created_at < now() - interval '24 hours' RETURNING id, worker_id, campaign_id`);
  for (const r of expired) await notify(r.worker_id, 'application_expired', 'An application expired', 'The publisher did not reply within 24 hours.', '/explore');
  const late = rowsOf(await sql`SELECT id FROM assignments WHERE (status = 'assigned' AND due_at < now()) OR (status = 'correction_requested' AND correction_due_at < now()) LIMIT 50`);
  for (const r of late) await expireAssignment(r.id);
  const due = rowsOf(await sql`SELECT id FROM assignments WHERE status IN ('submitted','resubmitted') AND review_due_at < now() LIMIT 50`);
  for (const r of due) {
    const done = await settleAssignment({ id: r.id, guard: 'review', kind: 'release', actor: null, note: 'Approved automatically after the review period' });
    if (done) {
      await logEvent(done.id, done.campaign_id, null, 'auto_approved', 'The review period ended with no action');
      await notify(done.worker_id, 'task_approved', 'Work approved', `The review period ended, so your work was approved. ${cedis(done.workerP)} was added to your wallet.`, `/tasks/${done.id}`);
      await notify(done.publisher_id, 'task_approved', 'Work approved automatically', 'The 48-hour review period ended, so the work was approved and the worker was paid.', `/tasks/${done.id}`);
    }
  }
  const soon = rowsOf(await sql`UPDATE assignments SET reminded = true
    WHERE reminded = false AND ((status IN ('submitted','resubmitted') AND review_due_at < now() + interval '12 hours') OR (status = 'correction_requested' AND correction_due_at < now() + interval '12 hours'))
    RETURNING id, status, publisher_id, worker_id`);
  for (const r of soon) {
    if (r.status === 'correction_requested') await notify(r.worker_id, 'reminder', 'Correction due soon', 'You have less than 12 hours left to send the corrected work.', `/tasks/${r.id}`);
    else await notify(r.publisher_id, 'reminder', 'Review due soon', 'You have less than 12 hours left to review this work. After that it is approved automatically.', `/tasks/${r.id}`);
  }
}
let lastSweep = 0;
async function lazySweep() {
  const gap = Number(process.env.SWEEP_MIN_SECONDS ?? 30) * 1000;
  if (Date.now() - lastSweep < gap) return;
  lastSweep = Date.now();
  try { await runSweep(); } catch (error) { console.error('sweep failed', error); }
}

// ---------- routes ----------
async function route(req: Request, path: string[]): Promise<Response> {
  const method = req.method;
  const [a, b, c] = path;

  // auth
  if (a === 'auth') {
    if (b === 'me' && method === 'GET') {
      return json({ user: await currentUser(req) });
    }
    if (b === 'signup' && method === 'POST') {
      const data = await body(req);
      const name = str(data.name, 2, 80, 'Name');
      const email = str(data.email, 5, 160, 'Email').toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'invalid', 'Enter a valid email address.');
      const password = typeof data.password === 'string' ? data.password : '';
      if (password.length < 8 || password.length > 200) throw new HttpError(400, 'invalid', 'Password must be at least 8 characters.');
      if (isAdminEmail(email)) {
        const expected = process.env.ADMIN_SETUP_CODE ?? '';
        const given = typeof data.adminCode === 'string' ? data.adminCode.trim() : '';
        if (!expected) throw new HttpError(403, 'admin_signup_disabled', 'Admin sign-up is not enabled yet.');
        if (!given) throw new HttpError(403, 'admin_code_required', 'This email is reserved for the HUSTLA admin. Enter the admin setup code.');
        if (!safeEqual(given, expected)) throw new HttpError(403, 'admin_code_invalid', 'That admin setup code is not right.');
      }
      const existing = rowsOf(await sql`SELECT id FROM users WHERE email = ${email}`);
      if (existing.length) throw new HttpError(409, 'email_taken', 'An account with that email already exists. Try signing in.');
      const hash = await hashPassword(password);
      const rows = rowsOf(await sql`INSERT INTO users (email, name, password_hash) VALUES (${email}, ${name}, ${hash}) RETURNING id, name, email, password_hash`);
      const user = publicUser(rows[0]);
      return json({ user }, 201, { 'set-cookie': await sessionCookie(user.id, rows[0].password_hash) });
    }
    if (b === 'signin' && method === 'POST') {
      const data = await body(req);
      const email = (typeof data.email === 'string' ? data.email : '').trim().toLowerCase();
      const password = typeof data.password === 'string' ? data.password : '';
      throttle(`signin:${clientIp(req)}:${email}`, 10, 15 * 60_000);
      const rows = rowsOf(await sql`SELECT id, name, email, password_hash FROM users WHERE email = ${email}`);
      const ok = await verifyPassword(password, rows[0]?.password_hash ?? DUMMY_HASH);
      if (!rows[0] || !ok) throw new HttpError(401, 'bad_credentials', 'Email or password is not right.');
      const user = publicUser(rows[0]);
      return json({ user }, 200, { 'set-cookie': await sessionCookie(user.id, rows[0].password_hash) });
    }
    if (b === 'forgot' && method === 'POST') {
      throttle(`forgot:${clientIp(req)}`, 5, 15 * 60_000);
      const data = await body(req);
      const email = (typeof data.email === 'string' ? data.email : '').trim().toLowerCase();
      // Same answer whether or not the account exists, so this cannot be used to find out who has an account.
      const generic = { ok: true, emailEnabled: emailEnabled() };
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(generic);
      const user = rowsOf(await sql`SELECT id, name, email FROM users WHERE email = ${email}`)[0];
      if (user) {
        const recent = rowsOf(await sql`SELECT id FROM password_resets WHERE user_id = ${user.id} AND used_at IS NULL AND dismissed_at IS NULL AND created_at > now() - interval '5 minutes'`);
        if (!recent.length) {
          const token = emailEnabled() ? randomBytes(32).toString('base64url') : null;
          const expires = token ? new Date(Date.now() + RESET_HOURS * 3600_000).toISOString() : null;
          await sql`INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (${user.id}, ${token ? sha256(token) : null}, ${expires})`;
          if (token) {
            await sendMail(user.email, 'Reset your HUSTLA password',
              `Hi ${user.name},\n\nUse this link to choose a new HUSTLA password. It works once and expires in ${RESET_HOURS} hours:\n\n${appBase(req)}/reset-password?token=${token}\n\nIf you did not ask for this, you can ignore this email.`);
          }
        }
      }
      return json(generic);
    }
    if (b === 'reset' && method === 'POST') {
      throttle(`reset:${clientIp(req)}`, 10, 15 * 60_000);
      const data = await body(req);
      const password = typeof data.password === 'string' ? data.password : '';
      if (password.length < 8 || password.length > 200) throw new HttpError(400, 'invalid', 'Password must be at least 8 characters.');
      const token = typeof data.token === 'string' ? data.token.trim() : '';
      let userId: number;
      if (token) {
        const found = rowsOf(await sql`SELECT user_id FROM password_resets WHERE token_hash = ${sha256(token)} AND used_at IS NULL AND dismissed_at IS NULL AND expires_at > now()`)[0];
        if (!found) throw new HttpError(400, 'invalid_link', 'This reset link is invalid or has expired. Ask for a new one.');
        userId = found.user_id;
      } else {
        // Admin recovery: the admin email plus the admin setup code.
        const email = (typeof data.email === 'string' ? data.email : '').trim().toLowerCase();
        const code = typeof data.adminCode === 'string' ? data.adminCode.trim() : '';
        const expected = process.env.ADMIN_SETUP_CODE ?? '';
        const user = email ? rowsOf(await sql`SELECT id FROM users WHERE email = ${email}`)[0] : null;
        if (!expected || !user || !isAdminEmail(email) || !safeEqual(code, expected)) {
          throw new HttpError(403, 'invalid_admin_recovery', 'The email or admin setup code is not right.');
        }
        userId = user.id;
      }
      const hash = await hashPassword(password);
      await sql`UPDATE users SET password_hash = ${hash} WHERE id = ${userId}`;
      await sql`UPDATE password_resets SET used_at = now() WHERE user_id = ${userId} AND used_at IS NULL`;
      return json({ ok: true });
    }
    if (b === 'signout' && method === 'POST') {
      return json({ ok: true }, 200, { 'set-cookie': clearCookie() });
    }
  }

  // campaigns
  if (a === 'campaigns') {
    if (!b && method === 'POST') {
      const user = await requireMember(req);
      throttle(`campaign:${user.id}`, 20, 3600_000);
      const data = await body(req);
      const title = str(data.title, 8, 120, 'Title');
      const description = str(data.description, 10, 2000, 'Brief');
      const deliverable = str(data.deliverable, 3, 300, 'What the worker must deliver');
      const criteria = str(data.criteria, 3, 1000, 'How the work will be judged');
      const category = typeof data.category === 'string' && CATEGORIES.includes(data.category) ? data.category : null;
      if (!category) throw new HttpError(400, 'invalid', 'Pick a valid category.');
      const quantity = Number(data.quantity);
      const rewardP = toPesewas(data.reward);
      const days = data.days === undefined || data.days === '' ? 7 : Number(data.days);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) throw new HttpError(400, 'invalid', 'Tasks must be a whole number from 1 to 100.');
      if (!rewardP || rewardP < 100 || rewardP > 10_000_000) throw new HttpError(400, 'invalid', 'Reward must be at least GH₵1.');
      if (!Number.isInteger(days) || days < 1 || days > 30) throw new HttpError(400, 'invalid', 'Days to finish must be a whole number from 1 to 30.');
      const blocked = screenText(`${title} ${description} ${deliverable} ${criteria}`);
      if (blocked) throw new HttpError(400, 'prohibited', `This campaign looks like a type HUSTLA does not allow (${blocked}). Please change it, or contact support if you think this is a mistake.`);
      const feeP = feeFor(rewardP);
      const totalP = quantity * (rewardP + feeP);
      // The full cost is reserved up front: every task's reward plus HUSTLA's fee.
      for (let attempt = 0; attempt < 4; attempt++) {
        const snap = await walletSnapshot(user.id, 'available');
        if (snap.balance < totalP) {
          throw new HttpError(400, 'insufficient_funds', `This campaign reserves ${cedis(totalP)} (the rewards plus the 10% fee). You have ${cedis(snap.balance)} in available funds. Add funds in your Wallet first.`);
        }
        const rows = rowsOf(await sql`WITH bump AS (
            UPDATE users SET wallet_seq = wallet_seq + 1 WHERE id = ${user.id}::int AND wallet_seq = ${snap.seq}::int RETURNING id
          ), c AS (
            INSERT INTO campaigns (owner_id, title, description, deliverable, criteria, category, quantity, reward, reward_p, fee_p, days, funded)
            SELECT ${user.id}::int, ${title}::text, ${description}::text, ${deliverable}::text, ${criteria}::text, ${category}::text, ${quantity}::int,
              (${rewardP}::bigint / 100.0)::numeric, ${rewardP}::bigint, ${feeP}::bigint, ${days}::int, true FROM bump
            RETURNING *
          ), l AS (
            INSERT INTO wallet_ledger (user_id, bucket, amount_p, kind, ref_type, ref_id, note)
            SELECT ${user.id}::int, 'available'::text, (-(${totalP}::bigint)), 'campaign_reserve'::text, 'campaign'::text, c.id, 'Reserved for a new campaign'::text FROM c
            UNION ALL
            SELECT ${user.id}::int, 'reserved'::text, ${totalP}::bigint, 'campaign_reserve'::text, 'campaign'::text, c.id, 'Reserved for a new campaign'::text FROM c
            RETURNING 1
          ) SELECT * FROM c`);
        if (rows.length) {
          await notifyAdmins('campaign_submitted', 'New campaign to review', `${title} by ${user.name}`, '/admin');
          return json({ campaign: campaignView(rows[0]) }, 201);
        }
      }
      throw new HttpError(409, 'busy', 'Your wallet was updated at the same moment. Please try again.');
    }
    if (b === 'mine' && method === 'GET') {
      const user = await requireMember(req);
      const rows = rowsOf(await sql`SELECT c.*,
          (SELECT COUNT(*) FROM applications a WHERE a.campaign_id = c.id) AS applicant_count,
          (SELECT COUNT(*) FROM applications a WHERE a.campaign_id = c.id AND a.status = 'pending') AS pending_apps,
          (SELECT COUNT(*) FROM assignments s WHERE s.campaign_id = c.id AND s.status IN ('submitted','resubmitted')) AS to_review,
          (SELECT COUNT(*) FROM assignments s WHERE s.campaign_id = c.id AND s.status = 'completed') AS completed
        FROM campaigns c WHERE c.owner_id = ${user.id}::int ORDER BY c.created_at DESC`);
      return json({ campaigns: rows.map(campaignView) });
    }
    if (b === 'live' && method === 'GET') {
      const user = await requireMember(req);
      const rows = rowsOf(await sql`SELECT c.*, (c.quantity - c.slots_taken) AS spots_open,
          (SELECT a.status FROM applications a WHERE a.campaign_id = c.id AND a.worker_id = ${user.id}::int) AS application_status,
          EXISTS (SELECT 1 FROM applications a WHERE a.campaign_id = c.id AND a.worker_id = ${user.id}::int AND a.status IN ('pending','accepted','declined')) AS applied,
          (c.owner_id = ${user.id}::int) AS is_own
        FROM campaigns c WHERE c.status = 'live' AND c.funded AND c.slots_taken < c.quantity ORDER BY c.reviewed_at DESC NULLS LAST, c.created_at DESC`);
      return json({ campaigns: rows.map(campaignView) });
    }
    const campaignId = Number(b);
    if (b && Number.isInteger(campaignId)) {
      if (!c && method === 'GET') {
        const user = await requireMember(req);
        const row = rowsOf(await sql`SELECT c.*,
            (SELECT COUNT(*) FROM applications a WHERE a.campaign_id = c.id) AS applicant_count,
            (SELECT COUNT(*) FROM applications a WHERE a.campaign_id = c.id AND a.status = 'pending') AS pending_apps,
            (SELECT COUNT(*) FROM assignments s WHERE s.campaign_id = c.id AND s.status IN ('submitted','resubmitted')) AS to_review,
            (SELECT COUNT(*) FROM assignments s WHERE s.campaign_id = c.id AND s.status = 'completed') AS completed
          FROM campaigns c WHERE c.id = ${campaignId}::int AND c.owner_id = ${user.id}::int`)[0];
        if (!row) throw new HttpError(404, 'not_found', 'Campaign not found.');
        const apps = rowsOf(await sql`SELECT a.id, a.status, a.created_at, (a.created_at + interval '24 hours') AS expires_at, u.name AS worker_name
          FROM applications a JOIN users u ON u.id = a.worker_id WHERE a.campaign_id = ${campaignId}::int
          ORDER BY (a.status = 'pending') DESC, a.created_at DESC LIMIT 200`);
        const tasks = rowsOf(await sql`SELECT s.id, s.status, s.due_at, s.review_due_at, s.correction_due_at, s.settled, u.name AS worker_name
          FROM assignments s JOIN users u ON u.id = s.worker_id WHERE s.campaign_id = ${campaignId}::int ORDER BY s.id DESC LIMIT 200`);
        return json({
          campaign: campaignView(row),
          applications: apps.map((x) => ({ id: x.id, status: x.status, workerName: x.worker_name, createdAt: x.created_at, expiresAt: x.expires_at })),
          assignments: tasks.map((x) => ({ id: x.id, status: x.status, workerName: x.worker_name, dueAt: x.due_at, reviewDueAt: x.review_due_at, correctionDueAt: x.correction_due_at, settled: x.settled })),
        });
      }
      if (c === 'apply' && method === 'POST') {
        const user = await requireMember(req);
        throttle(`apply:${user.id}`, 40, 3600_000);
        const row = rowsOf(await sql`SELECT id, title, owner_id, status, funded, quantity, slots_taken FROM campaigns WHERE id = ${campaignId}::int`)[0];
        if (!row || row.status !== 'live' || !row.funded || row.slots_taken >= row.quantity) throw new HttpError(404, 'not_found', 'That campaign is not open.');
        if (row.owner_id === user.id) throw new HttpError(400, 'own_campaign', 'You cannot apply to your own campaign.');
        const ins = rowsOf(await sql`INSERT INTO applications (campaign_id, worker_id) VALUES (${campaignId}::int, ${user.id}::int)
          ON CONFLICT (campaign_id, worker_id) DO UPDATE SET status = 'pending', created_at = now() WHERE applications.status IN ('expired','withdrawn')
          RETURNING id`);
        if (ins.length) await notify(row.owner_id, 'application', 'New application', `${user.name} applied to ${row.title}. You have 24 hours to reply.`, `/campaigns/${campaignId}`);
        return json({ applied: true });
      }
      if (c === 'close' && method === 'POST') {
        const user = await requireMember(req);
        const done = rowsOf(await sql`WITH c AS (
            UPDATE campaigns SET status = 'closed', closed_at = now()
            WHERE id = ${campaignId}::int AND owner_id = ${user.id}::int AND status IN ('pending_review','live')
            RETURNING id, owner_id, quantity, slots_taken, reward_p, fee_p, funded
          ), w AS (
            UPDATE applications SET status = 'withdrawn' WHERE campaign_id IN (SELECT id FROM c) AND status = 'pending' RETURNING id
          ), l AS (
            INSERT INTO wallet_ledger (user_id, bucket, amount_p, kind, ref_type, ref_id, note)
            SELECT c.owner_id, 'reserved'::text, (-((c.quantity - c.slots_taken)::bigint * (c.reward_p + c.fee_p)))::bigint, 'campaign_refund'::text, 'campaign'::text, c.id, 'Campaign closed'::text FROM c WHERE c.funded AND c.quantity > c.slots_taken
            UNION ALL
            SELECT c.owner_id, 'available'::text, ((c.quantity - c.slots_taken)::bigint * (c.reward_p + c.fee_p))::bigint, 'campaign_refund'::text, 'campaign'::text, c.id, 'Campaign closed'::text FROM c WHERE c.funded AND c.quantity > c.slots_taken
            RETURNING 1
          ) SELECT c.id, (c.quantity - c.slots_taken) AS open_slots FROM c`)[0];
        if (!done) throw new HttpError(409, 'not_closable', 'This campaign can no longer be closed.');
        return json({ ok: true, refundedSlots: Number(done.open_slots) });
      }
      if (c === 'report' && method === 'POST') {
        const user = await requireMember(req);
        throttle(`report:${user.id}`, 10, 3600_000);
        const data = await body(req);
        const reason = str(data.reason, 5, 300, 'Reason');
        const row = rowsOf(await sql`SELECT owner_id, title FROM campaigns WHERE id = ${campaignId}::int`)[0];
        if (!row) throw new HttpError(404, 'not_found', 'Campaign not found.');
        if (row.owner_id === user.id) throw new HttpError(400, 'own_campaign', 'You cannot report your own campaign.');
        const ins = rowsOf(await sql`INSERT INTO reports (campaign_id, reporter_id, reason) VALUES (${campaignId}::int, ${user.id}::int, ${reason}) ON CONFLICT (campaign_id, reporter_id) DO NOTHING RETURNING id`);
        if (ins.length) await notifyAdmins('report', 'Campaign reported', `${row.title}: ${reason}`, '/admin');
        return json({ ok: true });
      }
    }
  }

  // wallet
  if (a === 'wallet') {
    const user = await requireMember(req);
    if (!b && method === 'GET') return json(await walletView(user.id));
    if (b === 'deposits' && method === 'POST') {
      throttle(`deposit:${user.id}`, 10, 3600_000);
      const data = await body(req);
      const amountP = toPesewas(data.amount);
      const reference = str(data.reference, 3, 80, 'Payment reference');
      if (!amountP) throw new HttpError(400, 'invalid', 'Enter an amount in cedis, with at most 2 decimal places.');
      if (amountP < MIN_DEPOSIT_P) throw new HttpError(400, 'below_minimum', `The minimum deposit is ${cedis(MIN_DEPOSIT_P)}.`);
      const open = rowsOf(await sql`SELECT COUNT(*) AS n FROM deposits WHERE user_id = ${user.id}::int AND status = 'requested'`)[0];
      if (Number(open.n) >= 5) throw new HttpError(400, 'too_many', 'You already have 5 deposits waiting to be confirmed. Please wait for HUSTLA to confirm them.');
      await sql`INSERT INTO deposits (user_id, amount_p, reference) VALUES (${user.id}::int, ${amountP}::bigint, ${reference})`;
      await notifyAdmins('deposit', 'Deposit to confirm', `${user.name} says they paid ${cedis(amountP)} (ref ${reference}).`, '/admin');
      return json(await walletView(user.id), 201);
    }
    if (b === 'payout-method' && method === 'PUT') {
      throttle(`payout-method:${user.id}`, 10, 3600_000);
      const data = await body(req);
      const network = typeof data.network === 'string' ? data.network : '';
      if (!NETWORKS.includes(network)) throw new HttpError(400, 'invalid', 'Pick MTN, Telecel or AT.');
      const number = normaliseMomo(data.number);
      if (!number) throw new HttpError(400, 'invalid', 'Enter a valid Ghana mobile money number, like 0244123456.');
      const accountName = str(data.accountName, 3, 80, 'Name on the account');
      // Changing the number or network means it has to be verified again.
      await sql`INSERT INTO payout_methods (user_id, network, number, account_name)
        VALUES (${user.id}::int, ${network}, ${number}, ${accountName})
        ON CONFLICT (user_id) DO UPDATE SET
          verified_at = CASE WHEN payout_methods.number = EXCLUDED.number AND payout_methods.network = EXCLUDED.network THEN payout_methods.verified_at ELSE NULL END,
          verified_by = CASE WHEN payout_methods.number = EXCLUDED.number AND payout_methods.network = EXCLUDED.network THEN payout_methods.verified_by ELSE NULL END,
          network = EXCLUDED.network, number = EXCLUDED.number, account_name = EXCLUDED.account_name, updated_at = now()`;
      return json(await walletView(user.id));
    }
    if (b === 'withdrawals' && !c && method === 'POST') {
      throttle(`withdraw:${user.id}`, 20, 3600_000);
      const data = await body(req);
      const amountP = toPesewas(data.amount);
      if (!amountP) throw new HttpError(400, 'invalid', 'Enter an amount in cedis, with at most 2 decimal places.');
      if (amountP < MIN_WITHDRAWAL_P) throw new HttpError(400, 'below_minimum', `The minimum withdrawal is GH₵${ghs(MIN_WITHDRAWAL_P).toFixed(2)}.`);
      const pm = rowsOf(await sql`SELECT network, number, account_name, verified_at FROM payout_methods WHERE user_id = ${user.id}::int`)[0];
      if (!pm) throw new HttpError(400, 'no_payout_method', 'Add your mobile money number first.');
      if (!pm.verified_at) throw new HttpError(400, 'payout_not_verified', 'Your mobile money number is waiting for HUSTLA to verify it.');
      const payoutDate = nextPayout().date;
      for (let attempt = 0; attempt < 4; attempt++) {
        const snap = await walletSnapshot(user.id, 'withdrawable');
        if (snap.balance < amountP) throw new HttpError(400, 'insufficient_funds', 'You do not have that much available to withdraw.');
        const done = rowsOf(await sql`WITH bump AS (
            UPDATE users SET wallet_seq = wallet_seq + 1 WHERE id = ${user.id}::int AND wallet_seq = ${snap.seq}::int RETURNING id
          ), w AS (
            INSERT INTO withdrawals (user_id, amount_p, network, number, account_name, payout_date)
            SELECT ${user.id}::int, ${amountP}::bigint, ${pm.network}::text, ${pm.number}::text, ${pm.account_name}::text, ${payoutDate}::date FROM bump
            RETURNING id
          ), l AS (
            INSERT INTO wallet_ledger (user_id, bucket, amount_p, kind, ref_type, ref_id, note)
            SELECT ${user.id}::int, 'withdrawable'::text, (-(${amountP}::bigint)), 'withdrawal_request'::text, 'withdrawal'::text, w.id, 'Withdrawal requested'::text FROM w
            UNION ALL
            SELECT ${user.id}::int, 'payout_hold'::text, ${amountP}::bigint, 'withdrawal_request'::text, 'withdrawal'::text, w.id, 'Withdrawal requested'::text FROM w
            RETURNING 1
          ) SELECT id FROM w`);
        if (done.length) {
          await notifyAdmins('withdrawal', 'Withdrawal to pay', `${user.name} asked to withdraw ${cedis(amountP)}.`, '/admin');
          return json(await walletView(user.id), 201);
        }
      }
      throw new HttpError(409, 'busy', 'Your wallet was updated at the same moment. Please try again.');
    }
    if (b === 'withdrawals' && c && path[3] === 'cancel' && method === 'POST') {
      const id = Number(c);
      if (!Number.isInteger(id)) throw new HttpError(400, 'invalid', 'Bad withdrawal id.');
      const done = rowsOf(await sql`WITH c AS (
          UPDATE withdrawals SET status = 'cancelled', processed_at = now()
          WHERE id = ${id}::int AND user_id = ${user.id}::int AND status = 'requested' RETURNING id, amount_p
        ), l AS (
          INSERT INTO wallet_ledger (user_id, bucket, amount_p, kind, ref_type, ref_id, note)
          SELECT ${user.id}::int, 'payout_hold'::text, (-c.amount_p)::bigint, 'withdrawal_cancel'::text, 'withdrawal'::text, c.id, 'Withdrawal cancelled'::text FROM c
          UNION ALL
          SELECT ${user.id}::int, 'withdrawable'::text, c.amount_p::bigint, 'withdrawal_cancel'::text, 'withdrawal'::text, c.id, 'Withdrawal cancelled'::text FROM c
          RETURNING 1
        ) SELECT id FROM c`);
      if (!done.length) throw new HttpError(409, 'not_cancellable', 'That withdrawal can no longer be cancelled.');
      return json(await walletView(user.id));
    }
  }

  // applications
  if (a === 'applications' && b === 'mine' && method === 'GET') {
    const user = await requireMember(req);
    const rows = rowsOf(await sql`SELECT campaign_id, status FROM applications WHERE worker_id = ${user.id}::int`);
    return json({ applications: rows.map((row) => ({ campaignId: row.campaign_id, status: row.status })) });
  }
  if (a === 'applications' && b && c === 'decide' && method === 'POST') {
    const user = await requireMember(req);
    const appId = Number(b);
    if (!Number.isInteger(appId)) throw new HttpError(400, 'invalid', 'Bad application id.');
    const data = await body(req);
    const info = rowsOf(await sql`SELECT a.id, a.worker_id, a.campaign_id, c.title FROM applications a JOIN campaigns c ON c.id = a.campaign_id
      WHERE a.id = ${appId}::int AND c.owner_id = ${user.id}::int`)[0];
    if (!info) throw new HttpError(404, 'not_found', 'Application not found.');
    if (data.decision === 'accept') {
      const done = rowsOf(await sql`WITH app AS (
          UPDATE applications a SET status = 'accepted' FROM campaigns c
          WHERE a.id = ${appId}::int AND a.campaign_id = c.id AND c.owner_id = ${user.id}::int AND c.status = 'live' AND c.funded
            AND a.status = 'pending' AND a.created_at > now() - interval '24 hours'
          RETURNING a.id AS app_id, a.campaign_id, a.worker_id
        ), slot AS (
          UPDATE campaigns c SET slots_taken = c.slots_taken + 1 FROM app
          WHERE c.id = app.campaign_id AND c.status = 'live' AND c.slots_taken < c.quantity
          RETURNING c.id, c.owner_id, c.reward_p, c.fee_p, c.days
        ), ins AS (
          INSERT INTO assignments (campaign_id, application_id, worker_id, publisher_id, reward_p, fee_p, due_at)
          SELECT slot.id, app.app_id, app.worker_id, slot.owner_id, slot.reward_p, slot.fee_p, now() + (slot.days * interval '1 day')
          FROM slot JOIN app ON app.campaign_id = slot.id RETURNING id, campaign_id, worker_id, due_at
        ) SELECT id, campaign_id, worker_id, due_at FROM ins`)[0];
      if (!done) {
        // If the spot was taken at the same instant, put the application back so nothing is lost.
        await sql`UPDATE applications SET status = 'pending' WHERE id = ${appId}::int AND status = 'accepted'
          AND NOT EXISTS (SELECT 1 FROM assignments WHERE application_id = ${appId}::int)`;
        throw new HttpError(409, 'cannot_accept', 'This application can no longer be accepted. It may have expired, or every spot may be taken.');
      }
      await logEvent(done.id, done.campaign_id, user.id, 'assigned', 'Application accepted');
      await notify(done.worker_id, 'accepted', 'Application accepted', `You got the task: ${info.title}. Deliver it before the deadline.`, `/tasks/${done.id}`);
      return json({ assignmentId: done.id });
    }
    if (data.decision === 'decline') {
      const done = rowsOf(await sql`UPDATE applications SET status = 'declined' WHERE id = ${appId}::int AND status = 'pending' RETURNING id`);
      if (!done.length) throw new HttpError(409, 'cannot_decline', 'This application has already been answered or has expired.');
      await notify(info.worker_id, 'declined', 'Application declined', `The publisher chose someone else for ${info.title}.`, '/explore');
      return json({ ok: true });
    }
    throw new HttpError(400, 'invalid', 'Decision must be accept or decline.');
  }

  // assignments (the work itself)
  if (a === 'assignments') {
    const user = await requireMember(req);
    if (b === 'mine' && method === 'GET') {
      const rows = rowsOf(await sql`SELECT s.id, s.status, s.due_at, s.review_due_at, s.correction_due_at, s.reward_p, s.settled, c.id AS campaign_id, c.title, p.name AS publisher_name
        FROM assignments s JOIN campaigns c ON c.id = s.campaign_id JOIN users p ON p.id = s.publisher_id
        WHERE s.worker_id = ${user.id}::int
        ORDER BY (s.status IN ('assigned','correction_requested')) DESC, s.id DESC LIMIT 100`);
      return json({ assignments: rows.map((x) => ({
        id: x.id, status: x.status, dueAt: x.due_at, reviewDueAt: x.review_due_at, correctionDueAt: x.correction_due_at, reward: Number(x.reward_p) / 100,
        settled: x.settled, campaignId: x.campaign_id, title: x.title, publisherName: x.publisher_name,
      })) });
    }
    const id = Number(b);
    if (b && Number.isInteger(id)) {
      const row = rowsOf(await sql`SELECT s.*, c.title, c.description, c.deliverable, c.criteria, c.category, w.name AS worker_name, p.name AS publisher_name
        FROM assignments s JOIN campaigns c ON c.id = s.campaign_id JOIN users w ON w.id = s.worker_id JOIN users p ON p.id = s.publisher_id
        WHERE s.id = ${id}::int AND (s.worker_id = ${user.id}::int OR s.publisher_id = ${user.id}::int)`)[0];
      if (!row) throw new HttpError(404, 'not_found', 'Task not found.');
      const role = row.worker_id === user.id ? 'worker' : 'publisher';
      if (!c && method === 'GET') {
        const subs = rowsOf(await sql`SELECT round, link, note, created_at FROM submissions WHERE assignment_id = ${id}::int ORDER BY id`);
        const events = rowsOf(await sql`SELECT e.event, e.note, e.created_at, e.actor_id, u.name AS actor_name FROM task_events e LEFT JOIN users u ON u.id = e.actor_id WHERE e.assignment_id = ${id}::int ORDER BY e.id`);
        const dispute = rowsOf(await sql`SELECT d.id, d.status, d.reason, d.decision, d.worker_amount_p, d.admin_note, d.created_at, d.resolved_at, o.name AS opened_by_name
          FROM disputes d JOIN users o ON o.id = d.opened_by WHERE d.assignment_id = ${id}::int`)[0];
        const msgs = dispute ? rowsOf(await sql`SELECT m.id, m.body, m.created_at, m.user_id, u.name FROM dispute_messages m JOIN users u ON u.id = m.user_id WHERE m.dispute_id = ${dispute.id}::int ORDER BY m.id`) : [];
        return json({
          role,
          assignment: {
            id: row.id, campaignId: row.campaign_id, title: row.title, description: row.description, deliverable: row.deliverable, criteria: row.criteria, category: row.category,
            status: row.status, dueAt: row.due_at, reviewDueAt: row.review_due_at, correctionDueAt: row.correction_due_at, correctionUsed: row.correction_used, correctionReason: row.correction_reason,
            reward: Number(row.reward_p) / 100, fee: role === 'publisher' ? Number(row.fee_p) / 100 : null, settled: row.settled,
            workerName: row.worker_name, publisherName: row.publisher_name, createdAt: row.created_at, completedAt: row.completed_at,
          },
          submissions: subs.map((x) => ({ round: x.round, link: x.link, note: x.note, createdAt: x.created_at })),
          events: events.map((x) => ({ event: x.event, note: x.note, createdAt: x.created_at, actorName: x.actor_name ?? 'HUSTLA' })),
          dispute: dispute ? {
            id: dispute.id, status: dispute.status, reason: dispute.reason, decision: dispute.decision, workerAmount: dispute.worker_amount_p === null ? null : Number(dispute.worker_amount_p) / 100,
            adminNote: dispute.admin_note, createdAt: dispute.created_at, resolvedAt: dispute.resolved_at, openedByName: dispute.opened_by_name,
            messages: msgs.map((m) => ({ id: m.id, body: m.body, createdAt: m.created_at, name: m.name, mine: m.user_id === user.id })),
          } : null,
        });
      }
      if (c === 'submit' && method === 'POST') {
        if (role !== 'worker') throw new HttpError(403, 'forbidden', 'Only the worker can submit work.');
        const data = await body(req);
        const link = typeof data.link === 'string' ? data.link.trim() : '';
        const note = typeof data.note === 'string' ? data.note.trim() : '';
        if (link && (link.length > 500 || !/^https?:\/\/\S+$/i.test(link))) throw new HttpError(400, 'invalid', 'The link must start with http:// or https://.');
        if (note.length > 2000) throw new HttpError(400, 'invalid', 'The note is too long (2000 characters at most).');
        if (!link && note.length < 3) throw new HttpError(400, 'invalid', 'Add a link or a note that shows the finished work.');
        const done = rowsOf(await sql`WITH u AS (
            UPDATE assignments SET
              status = CASE WHEN status = 'assigned' THEN 'submitted' ELSE 'resubmitted' END,
              review_due_at = now() + CASE WHEN status = 'assigned' THEN interval '48 hours' ELSE interval '24 hours' END,
              reminded = false, updated_at = now()
            WHERE id = ${id}::int AND worker_id = ${user.id}::int
              AND ((status = 'assigned' AND due_at > now()) OR (status = 'correction_requested' AND correction_due_at > now()))
            RETURNING id, status, publisher_id, campaign_id, correction_used
          ), s AS (
            INSERT INTO submissions (assignment_id, round, link, note)
            SELECT id, CASE WHEN correction_used THEN 2 ELSE 1 END, ${link || null}, ${note || null} FROM u RETURNING id
          ) SELECT id, status, publisher_id, campaign_id FROM u`)[0];
        if (!done) throw new HttpError(409, 'cannot_submit', 'Work cannot be submitted for this task right now. The deadline may have passed.');
        await logEvent(id, done.campaign_id, user.id, done.status === 'submitted' ? 'submitted' : 'resubmitted', null);
        await notify(done.publisher_id, 'submission', done.status === 'submitted' ? 'Work submitted' : 'Corrected work submitted', `${user.name} sent work for ${row.title}. ${done.status === 'submitted' ? 'You have 48 hours to review it.' : 'You have 24 hours to review it.'}`, `/tasks/${id}`);
        return json({ ok: true, status: done.status });
      }
      if (c === 'review' && method === 'POST') {
        if (role !== 'publisher') throw new HttpError(403, 'forbidden', 'Only the publisher can review work.');
        const data = await body(req);
        if (data.action === 'approve') {
          const done = await settleAssignment({ id, guard: 'review', kind: 'release', actor: user.id, note: `Work approved: ${row.title}` });
          if (!done) throw new HttpError(409, 'cannot_review', 'This work is not waiting for your review.');
          await logEvent(id, done.campaign_id, user.id, 'approved', null);
          await notify(done.worker_id, 'task_approved', 'Work approved', `${cedis(done.workerP)} was added to your wallet for ${row.title}.`, `/tasks/${id}`);
          return json({ ok: true });
        }
        if (data.action === 'correction') {
          const reason = str(data.reason, 10, 1000, 'What needs to change');
          const done = rowsOf(await sql`UPDATE assignments SET status = 'correction_requested', correction_used = true, correction_reason = ${reason},
              correction_due_at = now() + interval '48 hours', review_due_at = NULL, reminded = false, updated_at = now()
            WHERE id = ${id}::int AND publisher_id = ${user.id}::int AND status = 'submitted' AND correction_used = false RETURNING id, campaign_id`)[0];
          if (!done) throw new HttpError(409, 'cannot_review', 'A correction can only be asked for once, on work that is waiting for review.');
          await logEvent(id, done.campaign_id, user.id, 'correction_requested', reason);
          await notify(row.worker_id, 'correction', 'Correction requested', `The publisher asked for one correction on ${row.title}. You have 48 hours to resubmit.`, `/tasks/${id}`);
          return json({ ok: true });
        }
        throw new HttpError(400, 'invalid', 'Action must be approve or correction.');
      }
      if (c === 'dispute' && method === 'POST') {
        const data = await body(req);
        const reason = str(data.reason, 10, 1000, 'Reason');
        const done = rowsOf(await sql`WITH a AS (
            UPDATE assignments SET status = 'under_dispute', updated_at = now()
            WHERE id = ${id}::int AND (worker_id = ${user.id}::int OR publisher_id = ${user.id}::int) AND status IN ('submitted','resubmitted','correction_requested')
            RETURNING id, campaign_id, worker_id, publisher_id
          ), d AS (
            INSERT INTO disputes (assignment_id, opened_by, reason) SELECT id, ${user.id}::int, ${reason}::text FROM a RETURNING id
          ) SELECT a.id, a.campaign_id, a.worker_id, a.publisher_id, d.id AS dispute_id FROM a, d`)[0];
        if (!done) throw new HttpError(409, 'cannot_dispute', 'A dispute can only be opened on work that has been submitted or sent back for correction, and only once.');
        await logEvent(id, done.campaign_id, user.id, 'dispute_opened', reason);
        const other = user.id === done.worker_id ? done.publisher_id : done.worker_id;
        await notify(other, 'dispute', 'A dispute was opened', `The money for ${row.title} is on hold while HUSTLA reviews it. You can add your side on the task page.`, `/tasks/${id}`);
        await notifyAdmins('dispute', 'New dispute', `${row.title}: ${reason}`, '/admin');
        return json({ ok: true });
      }
    }
  }
  if (a === 'disputes' && b && c === 'messages' && method === 'POST') {
    const user = await requireMember(req);
    throttle(`dispute-msg:${user.id}`, 30, 3600_000);
    const id = Number(b);
    const data = await body(req);
    const text = str(data.body, 2, 1500, 'Message');
    const done = rowsOf(await sql`INSERT INTO dispute_messages (dispute_id, user_id, body)
      SELECT d.id, ${user.id}::int, ${text}::text FROM disputes d JOIN assignments s ON s.id = d.assignment_id
      WHERE d.id = ${id}::int AND d.status = 'open' AND (s.worker_id = ${user.id}::int OR s.publisher_id = ${user.id}::int) RETURNING id`);
    if (!done.length) throw new HttpError(404, 'not_found', 'That dispute is not open.');
    return json({ ok: true });
  }

  // notifications (members and the admin)
  if (a === 'notifications') {
    const user = await requireUser(req);
    if (!b && method === 'GET') {
      const items = rowsOf(await sql`SELECT id, kind, title, body, href, read_at, created_at FROM notifications WHERE user_id = ${user.id}::int ORDER BY id DESC LIMIT 50`);
      const unread = rowsOf(await sql`SELECT COUNT(*) AS n FROM notifications WHERE user_id = ${user.id}::int AND read_at IS NULL`)[0];
      return json({ unread: Number(unread.n), items: items.map((x) => ({ id: Number(x.id), kind: x.kind, title: x.title, body: x.body, href: x.href, read: !!x.read_at, createdAt: x.created_at })) });
    }
    if (b === 'read' && method === 'POST') {
      const data = await body(req);
      if (data.all === true) await sql`UPDATE notifications SET read_at = now() WHERE user_id = ${user.id}::int AND read_at IS NULL`;
      else if (Number.isInteger(data.id)) await sql`UPDATE notifications SET read_at = now() WHERE user_id = ${user.id}::int AND id = ${data.id as number}::bigint AND read_at IS NULL`;
      return json({ ok: true });
    }
  }

  // admin
  if (a === 'admin' && b === 'campaigns') {
    await requireAdmin(req);
    if (!c && method === 'GET') {
      const status = new URL(req.url).searchParams.get('status') ?? 'pending_review';
      if (!['pending_review', 'live', 'declined', 'closed', 'all'].includes(status)) throw new HttpError(400, 'invalid', 'Bad status.');
      const rows = rowsOf(await sql`SELECT c.*, u.name AS owner_name, u.email AS owner_email,
          (SELECT COUNT(*) FROM applications a WHERE a.campaign_id = c.id) AS applicant_count,
          (SELECT COUNT(*) FROM reports r WHERE r.campaign_id = c.id) AS report_count
        FROM campaigns c JOIN users u ON u.id = c.owner_id
        WHERE (${status} = 'all' OR c.status = ${status}) ORDER BY c.created_at DESC LIMIT 200`);
      return json({ campaigns: rows.map(campaignView) });
    }
    if (b && path[3] === 'review' && method === 'POST') {
      const admin = await requireAdmin(req);
      const id = Number(c);
      if (!Number.isInteger(id)) throw new HttpError(400, 'invalid', 'Bad campaign id.');
      const data = await body(req);
      const decision = data.decision === 'approve' ? 'live' : data.decision === 'decline' ? 'declined' : null;
      if (!decision) throw new HttpError(400, 'invalid', 'Decision must be approve or decline.');
      const note = typeof data.note === 'string' ? data.note.trim().slice(0, 300) : '';
      if (decision === 'declined' && note.length < 3) throw new HttpError(400, 'invalid', 'Give the publisher a reason (at least 3 characters).');
      let rows;
      if (decision === 'live') {
        rows = rowsOf(await sql`UPDATE campaigns SET status = 'live', reviewed_at = now(), reviewed_by = ${admin.id}::int, review_note = ${note || null}
          WHERE id = ${id}::int AND status = 'pending_review' RETURNING *`);
      } else {
        // Declining gives the publisher the reserved money back in the same step.
        rows = rowsOf(await sql`WITH d AS (
            UPDATE campaigns SET status = 'declined', reviewed_at = now(), reviewed_by = ${admin.id}::int, review_note = ${note}
            WHERE id = ${id}::int AND status = 'pending_review' RETURNING *
          ), l AS (
            INSERT INTO wallet_ledger (user_id, bucket, amount_p, kind, ref_type, ref_id, note, actor_id)
            SELECT d.owner_id, 'reserved'::text, (-(d.quantity::bigint * (d.reward_p + d.fee_p)))::bigint, 'campaign_refund'::text, 'campaign'::text, d.id, 'Campaign declined in review'::text, ${admin.id}::int FROM d WHERE d.funded
            UNION ALL
            SELECT d.owner_id, 'available'::text, (d.quantity::bigint * (d.reward_p + d.fee_p))::bigint, 'campaign_refund'::text, 'campaign'::text, d.id, 'Campaign declined in review'::text, ${admin.id}::int FROM d WHERE d.funded
            RETURNING 1
          ) SELECT * FROM d`);
      }
      if (!rows[0]) throw new HttpError(409, 'not_pending', 'That campaign is no longer waiting for review.');
      await notify(rows[0].owner_id, decision === 'live' ? 'campaign_approved' : 'campaign_declined',
        decision === 'live' ? 'Your campaign is live' : 'Your campaign was declined',
        decision === 'live' ? `${rows[0].title} is now open for applications.` : `${rows[0].title} was declined: ${note}. Your reserved money is back in your wallet.`, `/campaigns/${rows[0].id}`);
      return json({ campaign: campaignView(rows[0]) });
    }
  }

  if (a === 'admin' && b === 'summary' && method === 'GET') {
    await requireAdmin(req);
    const row = rowsOf(await sql`SELECT
      (SELECT COUNT(*) FROM campaigns WHERE status = 'pending_review') AS pending,
      (SELECT COUNT(*) FROM campaigns WHERE status = 'live') AS live,
      (SELECT COUNT(*) FROM campaigns WHERE status = 'declined') AS declined,
      (SELECT COUNT(*) FROM users) AS users,
      (SELECT COUNT(*) FROM password_resets WHERE used_at IS NULL AND dismissed_at IS NULL) AS resets,
      (SELECT COUNT(*) FROM withdrawals WHERE status = 'requested') AS withdrawals,
      (SELECT COUNT(*) FROM payout_methods WHERE verified_at IS NULL) AS unverified,
      (SELECT COUNT(*) FROM deposits WHERE status = 'requested') AS deposits,
      (SELECT COUNT(*) FROM disputes WHERE status = 'open') AS disputes,
      (SELECT COALESCE(SUM(amount_p), 0) FROM wallet_ledger WHERE bucket = 'fee') AS fees_p`)[0];
    return json({
      pending: Number(row.pending), live: Number(row.live), declined: Number(row.declined),
      users: Number(row.users), resets: Number(row.resets), withdrawals: Number(row.withdrawals), unverified: Number(row.unverified), deposits: Number(row.deposits), disputes: Number(row.disputes), fees: ghs(Number(row.fees_p)), emailEnabled: emailEnabled(),
    });
  }
  if (a === 'admin' && b === 'users' && method === 'GET') {
    await requireAdmin(req);
    const rows = rowsOf(await sql`SELECT u.id, u.name, u.email, u.created_at,
        (SELECT COUNT(*) FROM campaigns c WHERE c.owner_id = u.id) AS campaigns,
        (SELECT COUNT(*) FROM applications a WHERE a.worker_id = u.id) AS applications
      FROM users u ORDER BY u.created_at DESC LIMIT 500`);
    return json({ users: rows.map((row) => ({
      id: row.id, name: row.name, email: row.email, createdAt: row.created_at,
      campaigns: Number(row.campaigns), applications: Number(row.applications), isAdmin: isAdminEmail(row.email),
    })) });
  }
  if (a === 'admin' && b === 'resets') {
    await requireAdmin(req);
    if (!c && method === 'GET') {
      const rows = rowsOf(await sql`SELECT r.id, r.created_at, r.token_hash, r.expires_at, r.used_at, r.dismissed_at, u.name, u.email
        FROM password_resets r JOIN users u ON u.id = r.user_id ORDER BY r.created_at DESC LIMIT 100`);
      const now = Date.now();
      return json({ requests: rows.map((row) => ({
        id: row.id, name: row.name, email: row.email, createdAt: row.created_at, isAdmin: isAdminEmail(row.email),
        status: row.used_at ? 'done' : row.dismissed_at ? 'dismissed'
          : row.token_hash ? (new Date(row.expires_at).getTime() > now ? 'link_ready' : 'expired') : 'waiting',
      })) });
    }
    const id = Number(c);
    if (c && Number.isInteger(id) && path[3] === 'link' && method === 'POST') {
      const row = rowsOf(await sql`SELECT r.id, u.email FROM password_resets r JOIN users u ON u.id = r.user_id
        WHERE r.id = ${id} AND r.used_at IS NULL AND r.dismissed_at IS NULL`)[0];
      if (!row) throw new HttpError(404, 'not_found', 'That request is already closed.');
      if (isAdminEmail(row.email)) throw new HttpError(400, 'admin_account', 'Admin accounts reset with the admin setup code, not a link.');
      const token = randomBytes(32).toString('base64url');
      const expires = new Date(Date.now() + RESET_HOURS * 3600_000).toISOString();
      await sql`UPDATE password_resets SET token_hash = ${sha256(token)}, expires_at = ${expires} WHERE id = ${id}`;
      return json({ link: `${appBase(req)}/reset-password?token=${token}`, expiresAt: expires });
    }
    if (c && Number.isInteger(id) && path[3] === 'dismiss' && method === 'POST') {
      await sql`UPDATE password_resets SET dismissed_at = now() WHERE id = ${id} AND used_at IS NULL`;
      return json({ ok: true });
    }
  }

  if (a === 'admin' && b === 'withdrawals') {
    const admin = await requireAdmin(req);
    if (!c && method === 'GET') {
      const status = new URL(req.url).searchParams.get('status') ?? 'requested';
      if (!['requested', 'paid', 'rejected', 'cancelled', 'all'].includes(status)) throw new HttpError(400, 'invalid', 'Bad status.');
      const rows = rowsOf(await sql`SELECT w.id, w.user_id, w.amount_p, w.network, w.number, w.account_name, w.status, w.reason, w.reference,
          to_char(w.payout_date, 'YYYY-MM-DD') AS payout_date, w.created_at, w.processed_at, u.name, u.email,
          (pm.verified_at IS NOT NULL AND pm.number = w.number) AS verified
        FROM withdrawals w JOIN users u ON u.id = w.user_id LEFT JOIN payout_methods pm ON pm.user_id = w.user_id
        WHERE (${status} = 'all' OR w.status = ${status})
        ORDER BY CASE WHEN w.status = 'requested' THEN 0 ELSE 1 END, w.payout_date ASC, w.id DESC LIMIT 200`);
      return json({ withdrawals: rows.map((row) => ({
        id: row.id, userId: row.user_id, name: row.name, email: row.email, amount: ghs(Number(row.amount_p)), network: row.network,
        number: row.number, accountName: row.account_name, status: row.status, reason: row.reason, reference: row.reference,
        payoutDate: row.payout_date, createdAt: row.created_at, processedAt: row.processed_at, verified: !!row.verified,
      })) });
    }
    const id = Number(c);
    if (c && Number.isInteger(id) && path[3] === 'paid' && method === 'POST') {
      const data = await body(req);
      const reference = typeof data.reference === 'string' ? data.reference.trim().slice(0, 80) : '';
      const done = rowsOf(await sql`WITH p AS (
          UPDATE withdrawals SET status = 'paid', reference = ${reference || null}, processed_at = now(), processed_by = ${admin.id}::int
          WHERE id = ${id}::int AND status = 'requested' RETURNING id, user_id, amount_p
        ), l AS (
          INSERT INTO wallet_ledger (user_id, bucket, amount_p, kind, ref_type, ref_id, note, actor_id)
          SELECT p.user_id, 'payout_hold'::text, (-p.amount_p)::bigint, 'withdrawal_paid'::text, 'withdrawal'::text, p.id, 'Withdrawal paid'::text, ${admin.id}::int FROM p
          RETURNING 1
        ) SELECT id FROM p`);
      if (!done.length) throw new HttpError(409, 'not_pending', 'That withdrawal is no longer waiting for payout.');
      return json({ ok: true });
    }
    if (c && Number.isInteger(id) && path[3] === 'reject' && method === 'POST') {
      const data = await body(req);
      const reason = str(data.reason, 3, 200, 'Reason');
      const done = rowsOf(await sql`WITH r AS (
          UPDATE withdrawals SET status = 'rejected', reason = ${reason}, processed_at = now(), processed_by = ${admin.id}::int
          WHERE id = ${id}::int AND status = 'requested' RETURNING id, user_id, amount_p
        ), l AS (
          INSERT INTO wallet_ledger (user_id, bucket, amount_p, kind, ref_type, ref_id, note, actor_id)
          SELECT r.user_id, 'payout_hold'::text, (-r.amount_p)::bigint, 'withdrawal_reject'::text, 'withdrawal'::text, r.id, ${reason}::text, ${admin.id}::int FROM r
          UNION ALL
          SELECT r.user_id, 'withdrawable'::text, r.amount_p::bigint, 'withdrawal_reject'::text, 'withdrawal'::text, r.id, ${reason}::text, ${admin.id}::int FROM r
          RETURNING 1
        ) SELECT id FROM r`);
      if (!done.length) throw new HttpError(409, 'not_pending', 'That withdrawal is no longer waiting for payout.');
      return json({ ok: true });
    }
  }
  if (a === 'admin' && b === 'payout-methods') {
    const admin = await requireAdmin(req);
    if (!c && method === 'GET') {
      const rows = rowsOf(await sql`SELECT pm.user_id, pm.network, pm.number, pm.account_name, pm.updated_at, u.name, u.email
        FROM payout_methods pm JOIN users u ON u.id = pm.user_id WHERE pm.verified_at IS NULL ORDER BY pm.updated_at ASC LIMIT 200`);
      return json({ methods: rows.map((row) => ({
        userId: row.user_id, name: row.name, email: row.email, network: row.network, number: row.number, accountName: row.account_name, updatedAt: row.updated_at,
      })) });
    }
    const userId = Number(c);
    if (c && Number.isInteger(userId) && path[3] === 'verify' && method === 'POST') {
      const done = rowsOf(await sql`UPDATE payout_methods SET verified_at = now(), verified_by = ${admin.id}::int
        WHERE user_id = ${userId}::int AND verified_at IS NULL RETURNING user_id`);
      if (!done.length) throw new HttpError(404, 'not_found', 'Nothing to verify for that member.');
      return json({ ok: true });
    }
  }
  if (a === 'admin' && b === 'deposits') {
    const admin = await requireAdmin(req);
    if (!c && method === 'GET') {
      const status = new URL(req.url).searchParams.get('status') ?? 'requested';
      if (!['requested', 'confirmed', 'rejected', 'all'].includes(status)) throw new HttpError(400, 'invalid', 'Bad status.');
      const rows = rowsOf(await sql`SELECT d.id, d.amount_p, d.reference, d.status, d.note, d.created_at, d.processed_at, u.name, u.email
        FROM deposits d JOIN users u ON u.id = d.user_id WHERE (${status} = 'all' OR d.status = ${status})
        ORDER BY CASE WHEN d.status = 'requested' THEN 0 ELSE 1 END, d.id DESC LIMIT 200`);
      return json({ deposits: rows.map((x) => ({ id: x.id, name: x.name, email: x.email, amount: ghs(Number(x.amount_p)), reference: x.reference, status: x.status, note: x.note, createdAt: x.created_at, processedAt: x.processed_at })) });
    }
    const id = Number(c);
    if (c && Number.isInteger(id) && path[3] === 'confirm' && method === 'POST') {
      const done = rowsOf(await sql`WITH d AS (
          UPDATE deposits SET status = 'confirmed', processed_at = now(), processed_by = ${admin.id}::int
          WHERE id = ${id}::int AND status = 'requested' RETURNING id, user_id, amount_p, reference
        ), l AS (
          INSERT INTO wallet_ledger (user_id, bucket, amount_p, kind, ref_type, ref_id, note, actor_id)
          SELECT d.user_id, 'available'::text, d.amount_p, 'deposit'::text, 'deposit'::text, d.id, ('Deposit confirmed. Reference: ' || d.reference)::text, ${admin.id}::int FROM d
          RETURNING 1
        ) SELECT id, user_id, amount_p FROM d`)[0];
      if (!done) throw new HttpError(409, 'not_pending', 'That deposit is no longer waiting for confirmation.');
      await notify(done.user_id, 'deposit_confirmed', 'Deposit confirmed', `${cedis(Number(done.amount_p))} was added to your available funds.`, '/wallet');
      return json({ ok: true });
    }
    if (c && Number.isInteger(id) && path[3] === 'reject' && method === 'POST') {
      const data = await body(req);
      const note = str(data.note, 3, 200, 'Reason');
      const done = rowsOf(await sql`UPDATE deposits SET status = 'rejected', note = ${note}, processed_at = now(), processed_by = ${admin.id}::int
        WHERE id = ${id}::int AND status = 'requested' RETURNING id, user_id, amount_p`)[0];
      if (!done) throw new HttpError(409, 'not_pending', 'That deposit is no longer waiting for confirmation.');
      await notify(done.user_id, 'deposit_rejected', 'Deposit not confirmed', `We could not confirm your ${cedis(Number(done.amount_p))} deposit: ${note}`, '/wallet');
      return json({ ok: true });
    }
  }
  if (a === 'admin' && b === 'disputes') {
    const admin = await requireAdmin(req);
    if (!c && method === 'GET') {
      const status = new URL(req.url).searchParams.get('status') ?? 'open';
      if (!['open', 'resolved', 'all'].includes(status)) throw new HttpError(400, 'invalid', 'Bad status.');
      const rows = rowsOf(await sql`SELECT d.id, d.status, d.reason, d.created_at, d.decision, s.id AS assignment_id, s.reward_p, s.fee_p, c.title,
          w.name AS worker_name, w.email AS worker_email, p.name AS publisher_name, p.email AS publisher_email, o.name AS opened_by_name,
          (SELECT COUNT(*) FROM dispute_messages m WHERE m.dispute_id = d.id) AS messages
        FROM disputes d JOIN assignments s ON s.id = d.assignment_id JOIN campaigns c ON c.id = s.campaign_id
        JOIN users w ON w.id = s.worker_id JOIN users p ON p.id = s.publisher_id JOIN users o ON o.id = d.opened_by
        WHERE (${status} = 'all' OR d.status = ${status}) ORDER BY CASE WHEN d.status = 'open' THEN 0 ELSE 1 END, d.created_at ASC LIMIT 200`);
      return json({ disputes: rows.map((x) => ({
        id: x.id, status: x.status, reason: x.reason, decision: x.decision, createdAt: x.created_at, assignmentId: x.assignment_id, title: x.title,
        reward: ghs(Number(x.reward_p)), fee: ghs(Number(x.fee_p)), workerName: x.worker_name, workerEmail: x.worker_email,
        publisherName: x.publisher_name, publisherEmail: x.publisher_email, openedByName: x.opened_by_name, messages: Number(x.messages),
      })) });
    }
    const id = Number(c);
    if (c && Number.isInteger(id) && !path[3] && method === 'GET') {
      const d = rowsOf(await sql`SELECT d.id, d.status, d.reason, d.assignment_id, d.decision, d.admin_note, c.title, c.description, c.deliverable, c.criteria
        FROM disputes d JOIN assignments s ON s.id = d.assignment_id JOIN campaigns c ON c.id = s.campaign_id WHERE d.id = ${id}::int`)[0];
      if (!d) throw new HttpError(404, 'not_found', 'Dispute not found.');
      const subs = rowsOf(await sql`SELECT round, link, note, created_at FROM submissions WHERE assignment_id = ${d.assignment_id}::int ORDER BY id`);
      const msgs = rowsOf(await sql`SELECT m.body, m.created_at, u.name FROM dispute_messages m JOIN users u ON u.id = m.user_id WHERE m.dispute_id = ${id}::int ORDER BY m.id`);
      const events = rowsOf(await sql`SELECT e.event, e.note, e.created_at, u.name FROM task_events e LEFT JOIN users u ON u.id = e.actor_id WHERE e.assignment_id = ${d.assignment_id}::int ORDER BY e.id`);
      const a2 = rowsOf(await sql`SELECT correction_reason FROM assignments WHERE id = ${d.assignment_id}::int`)[0];
      return json({
        dispute: { id: d.id, status: d.status, reason: d.reason, decision: d.decision, adminNote: d.admin_note, title: d.title, description: d.description, deliverable: d.deliverable, criteria: d.criteria, correctionReason: a2?.correction_reason ?? null },
        submissions: subs.map((x) => ({ round: x.round, link: x.link, note: x.note, createdAt: x.created_at })),
        messages: msgs.map((x) => ({ body: x.body, createdAt: x.created_at, name: x.name })),
        events: events.map((x) => ({ event: x.event, note: x.note, createdAt: x.created_at, actorName: x.name ?? 'HUSTLA' })),
      });
    }
    if (c && Number.isInteger(id) && path[3] === 'resolve' && method === 'POST') {
      const data = await body(req);
      const decision = typeof data.decision === 'string' ? data.decision : '';
      if (!['release', 'refund', 'split'].includes(decision)) throw new HttpError(400, 'invalid', 'Decision must be release, refund or split.');
      const note = str(data.note, 3, 500, 'Explanation for both sides');
      const d = rowsOf(await sql`SELECT d.id, d.assignment_id, d.status, s.reward_p FROM disputes d JOIN assignments s ON s.id = d.assignment_id WHERE d.id = ${id}::int`)[0];
      if (!d || d.status !== 'open') throw new HttpError(409, 'not_open', 'That dispute is already resolved.');
      let workerP: number | undefined;
      if (decision === 'split') {
        workerP = toPesewas(data.workerAmount) ?? undefined;
        if (!workerP || workerP >= Number(d.reward_p)) throw new HttpError(400, 'invalid', `For a split, the worker's share must be more than 0 and less than the full reward (${cedis(Number(d.reward_p))}).`);
      }
      const done = await settleAssignment({
        id: d.assignment_id, guard: 'dispute', kind: decision === 'release' ? 'release' : decision === 'refund' ? 'refund' : 'split', workerP,
        actor: admin.id, note: `Dispute decided: ${note}`, disputeId: d.id, decision, adminNote: note,
      });
      if (!done) throw new HttpError(409, 'not_open', 'That dispute is already resolved.');
      await logEvent(done.id, done.campaign_id, admin.id, 'dispute_resolved', `${decision}: ${note}`);
      const outcome = decision === 'release' ? 'The full reward was released to the worker.' : decision === 'refund' ? 'The money was returned to the publisher.' : `The worker received ${cedis(done.workerP)} and the publisher got ${cedis(done.refundP)} back.`;
      await notify(done.worker_id, 'dispute_resolved', 'Dispute decided', `${outcome} ${note}`, `/tasks/${done.id}`);
      await notify(done.publisher_id, 'dispute_resolved', 'Dispute decided', `${outcome} ${note}`, `/tasks/${done.id}`);
      return json({ ok: true });
    }
  }
  if (a === 'admin' && b === 'settings') {
    await requireAdmin(req);
    if (method === 'GET') {
      const row = rowsOf(await sql`SELECT value FROM app_settings WHERE key = 'deposit_instructions'`)[0];
      return json({ depositInstructions: row?.value ?? '' });
    }
    if (method === 'PUT') {
      const data = await body(req);
      const text = typeof data.depositInstructions === 'string' ? data.depositInstructions.trim() : '';
      if (text.length > 800) throw new HttpError(400, 'invalid', 'Keep the instructions under 800 characters.');
      await sql`INSERT INTO app_settings (key, value) VALUES ('deposit_instructions', ${text}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
      return json({ ok: true });
    }
  }
  if (a === 'admin' && b === 'wallet' && c === 'credit' && method === 'POST') {
    const admin = await requireAdmin(req);
    const data = await body(req);
    const email = (typeof data.email === 'string' ? data.email : '').trim().toLowerCase();
    const kind = typeof data.kind === 'string' ? data.kind : '';
    const amountP = toPesewas(data.amount);
    const note = str(data.note, 3, 200, 'Note');
    if (!amountP) throw new HttpError(400, 'invalid', 'Enter an amount in cedis, with at most 2 decimal places.');
    if (!['deposit', 'earning', 'pending', 'release'].includes(kind)) throw new HttpError(400, 'invalid', 'Pick what kind of credit this is.');
    const target = rowsOf(await sql`SELECT id, name FROM users WHERE email = ${email}`)[0];
    if (!target) throw new HttpError(404, 'not_found', 'No member has that email.');
    if (isAdminEmail(email)) throw new HttpError(400, 'admin_account', 'The admin account does not have a wallet.');
    if (kind === 'release') {
      for (let attempt = 0; attempt < 4; attempt++) {
        const snap = await walletSnapshot(target.id, 'pending');
        if (snap.balance < amountP) throw new HttpError(400, 'insufficient_funds', 'That member does not have that much pending.');
        const done = rowsOf(await sql`WITH bump AS (
            UPDATE users SET wallet_seq = wallet_seq + 1 WHERE id = ${target.id}::int AND wallet_seq = ${snap.seq}::int RETURNING id
          ), l AS (
            INSERT INTO wallet_ledger (user_id, bucket, amount_p, kind, note, actor_id)
            SELECT ${target.id}::int, 'pending'::text, (-(${amountP}::bigint)), 'release'::text, ${note}::text, ${admin.id}::int FROM bump
            UNION ALL
            SELECT ${target.id}::int, 'withdrawable'::text, ${amountP}::bigint, 'release'::text, ${note}::text, ${admin.id}::int FROM bump
            RETURNING 1
          ) SELECT id FROM bump`);
        if (done.length) return json({ ok: true, name: target.name });
      }
      throw new HttpError(409, 'busy', 'That wallet was updated at the same moment. Please try again.');
    }
    const bucket = kind === 'deposit' ? 'available' : kind === 'earning' ? 'withdrawable' : 'pending';
    await sql`INSERT INTO wallet_ledger (user_id, bucket, amount_p, kind, note, actor_id)
      VALUES (${target.id}::int, ${bucket}, ${amountP}::bigint, ${kind}, ${note}, ${admin.id}::int)`;
    return json({ ok: true, name: target.name });
  }

  throw new HttpError(404, 'not_found', 'No such endpoint.');
}

export default async (req: Request): Promise<Response> => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const origin = req.headers.get('origin');
      if (origin) {
        const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? new URL(req.url).host;
        if (new URL(origin).host !== host) throw new HttpError(403, 'forbidden', 'Cross-site request blocked.');
      }
    }
    await ensureSchema();
    await lazySweep();
    const path = new URL(req.url).pathname.replace(/^\/(?:\.netlify\/functions\/api|api)\/?/, '').split('/').filter(Boolean);
    return await route(req, path);
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.code, message: error.message }, error.status);
    if (error instanceof Error && error.name === 'MissingDatabaseConnectionError') {
      console.error('database connection is not configured yet');
      return json({ error: 'database_not_ready', message: 'The database is not connected yet. Please try again shortly.' }, 503);
    }
    console.error('api error', error);
    return json({ error: 'server_error', message: 'Something went wrong. Please try again.' }, 500);
  }
};

export const config = { path: '/api/*' };
