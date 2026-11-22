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
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    quantity: row.quantity,
    reward: Number(row.reward),
    days: row.days,
    daysLeft: Math.max(0, row.days - ageDays),
    status: row.status,
    createdAt: row.created_at,
    ...(row.spots_open !== undefined ? { spotsOpen: Math.max(0, Number(row.spots_open)) } : {}),
    ...(row.applicant_count !== undefined ? { applicantCount: Number(row.applicant_count) } : {}),
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
    WHERE user_id = ${userId}::int AND bucket <> 'payout_hold' ORDER BY id DESC LIMIT 50`);
  const wds = rowsOf(await sql`SELECT id, amount_p, network, number, status, reason, reference,
      to_char(payout_date, 'YYYY-MM-DD') AS payout_date, created_at, processed_at
    FROM withdrawals WHERE user_id = ${userId}::int ORDER BY id DESC LIMIT 30`);
  return {
    balances: { available: ghs(b.available), reserved: ghs(b.reserved), pending: ghs(b.pending), withdrawable: ghs(b.withdrawable), inPayout: ghs(b.payout_hold) },
    payoutMethod: pm ? { network: pm.network, number: pm.number, accountName: pm.account_name, verified: !!pm.verified_at } : null,
    ledger: ledger.map((row) => ({ id: Number(row.id), bucket: row.bucket, amount: ghs(Number(row.amount_p)), kind: row.kind, note: row.note, createdAt: row.created_at })),
    withdrawals: wds.map((row) => ({
      id: row.id, amount: ghs(Number(row.amount_p)), network: row.network, number: row.number, status: row.status,
      reason: row.reason, reference: row.reference, payoutDate: row.payout_date, createdAt: row.created_at, processedAt: row.processed_at,
    })),
    minWithdrawal: ghs(MIN_WITHDRAWAL_P),
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
      const data = await body(req);
      const title = str(data.title, 8, 120, 'Title');
      const description = str(data.description, 10, 2000, 'Brief');
      const category = typeof data.category === 'string' && CATEGORIES.includes(data.category) ? data.category : null;
      if (!category) throw new HttpError(400, 'invalid', 'Pick a valid category.');
      const quantity = Number(data.quantity);
      const reward = Math.round(Number(data.reward) * 100) / 100;
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) throw new HttpError(400, 'invalid', 'Tasks must be a whole number from 1 to 100.');
      if (!Number.isFinite(reward) || reward < 1 || reward > 100000) throw new HttpError(400, 'invalid', 'Reward must be at least GH₵1.');
      const rows = rowsOf(await sql`INSERT INTO campaigns (owner_id, title, description, category, quantity, reward)
        VALUES (${user.id}, ${title}, ${description}, ${category}, ${quantity}, ${reward}) RETURNING *`);
      return json({ campaign: campaignView(rows[0]) }, 201);
    }
    if (b === 'mine' && method === 'GET') {
      const user = await requireMember(req);
      const rows = rowsOf(await sql`SELECT c.*, (SELECT COUNT(*) FROM applications a WHERE a.campaign_id = c.id) AS applicant_count
        FROM campaigns c WHERE c.owner_id = ${user.id} ORDER BY c.created_at DESC`);
      return json({ campaigns: rows.map(campaignView) });
    }
    if (b === 'live' && method === 'GET') {
      const user = await requireMember(req);
      const rows = rowsOf(await sql`SELECT c.*,
          c.quantity - (SELECT COUNT(*) FROM applications a WHERE a.campaign_id = c.id AND a.status = 'accepted') AS spots_open,
          EXISTS (SELECT 1 FROM applications a WHERE a.campaign_id = c.id AND a.worker_id = ${user.id}) AS applied,
          (c.owner_id = ${user.id}) AS is_own
        FROM campaigns c WHERE c.status = 'live' ORDER BY c.reviewed_at DESC NULLS LAST, c.created_at DESC`);
      return json({ campaigns: rows.map(campaignView) });
    }
    if (b && c === 'apply' && method === 'POST') {
      const user = await requireMember(req);
      const id = Number(b);
      if (!Number.isInteger(id)) throw new HttpError(400, 'invalid', 'Bad campaign id.');
      const rows = rowsOf(await sql`SELECT id, owner_id, status FROM campaigns WHERE id = ${id}`);
      if (!rows[0] || rows[0].status !== 'live') throw new HttpError(404, 'not_found', 'That campaign is not open.');
      if (rows[0].owner_id === user.id) throw new HttpError(400, 'own_campaign', 'You cannot apply to your own campaign.');
      await sql`INSERT INTO applications (campaign_id, worker_id) VALUES (${id}, ${user.id}) ON CONFLICT (campaign_id, worker_id) DO NOTHING`;
      return json({ applied: true });
    }
  }

  // wallet
  if (a === 'wallet') {
    const user = await requireMember(req);
    if (!b && method === 'GET') return json(await walletView(user.id));
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
        if (done.length) return json(await walletView(user.id), 201);
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
    const rows = rowsOf(await sql`SELECT campaign_id, status FROM applications WHERE worker_id = ${user.id}`);
    return json({ applications: rows.map((row) => ({ campaignId: row.campaign_id, status: row.status })) });
  }

  // admin
  if (a === 'admin' && b === 'campaigns') {
    await requireAdmin(req);
    if (!c && method === 'GET') {
      const status = new URL(req.url).searchParams.get('status') ?? 'pending_review';
      if (!['pending_review', 'live', 'declined', 'closed', 'all'].includes(status)) throw new HttpError(400, 'invalid', 'Bad status.');
      const rows = rowsOf(await sql`SELECT c.*, u.name AS owner_name, u.email AS owner_email,
          (SELECT COUNT(*) FROM applications a WHERE a.campaign_id = c.id) AS applicant_count
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
      const rows = rowsOf(await sql`UPDATE campaigns SET status = ${decision}, reviewed_at = now(), reviewed_by = ${admin.id}
        WHERE id = ${id} AND status = 'pending_review' RETURNING *`);
      if (!rows[0]) throw new HttpError(409, 'not_pending', 'That campaign is no longer waiting for review.');
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
      (SELECT COUNT(*) FROM payout_methods WHERE verified_at IS NULL) AS unverified`)[0];
    return json({
      pending: Number(row.pending), live: Number(row.live), declined: Number(row.declined),
      users: Number(row.users), resets: Number(row.resets), withdrawals: Number(row.withdrawals), unverified: Number(row.unverified), emailEnabled: emailEnabled(),
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
