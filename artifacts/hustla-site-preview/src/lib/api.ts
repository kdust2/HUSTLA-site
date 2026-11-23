export type ApiUser = { id: number; name: string; email: string; isAdmin: boolean };

export type CampaignStatus = 'pending_review' | 'live' | 'declined' | 'closed';
export type ApiCampaign = {
  id: number;
  title: string;
  description: string;
  category: string;
  quantity: number;
  reward: number;
  days: number;
  daysLeft: number;
  status: CampaignStatus;
  createdAt: string;
  deliverable: string;
  criteria: string;
  fee: number;
  budget: number;
  funded: boolean;
  slotsTaken: number;
  reviewNote: string | null;
  pendingApps?: number;
  toReview?: number;
  completed?: number;
  reportCount?: number;
  applicationStatus?: string | null;
  spotsOpen?: number;
  applicantCount?: number;
  applied?: boolean;
  isOwn?: boolean;
  ownerName?: string;
  ownerEmail?: string;
};

export const statusLabel: Record<CampaignStatus, string> = {
  pending_review: 'Pending review',
  live: 'Live',
  declined: 'Declined',
  closed: 'Closed',
};

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: options.method ?? (options.body !== undefined ? 'POST' : 'GET'),
      credentials: 'same-origin',
      headers: options.body !== undefined ? { 'content-type': 'application/json' } : undefined,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'network', 'Could not reach HUSTLA. Check your connection and try again.');
  }
  let data: any = null;
  try { data = await response.json(); } catch { /* empty or non-JSON body */ }
  if (!response.ok) {
    throw new ApiError(response.status, data?.error ?? 'error', data?.message ?? 'Something went wrong. Please try again.');
  }
  return data as T;
}

export type AdminSummary = { pending: number; live: number; declined: number; users: number; resets: number; withdrawals: number; unverified: number; deposits: number; disputes: number; fees: number; emailEnabled: boolean };
export type AdminUser = { id: number; name: string; email: string; createdAt: string; campaigns: number; applications: number; isAdmin: boolean };
export type ResetStatus = 'waiting' | 'link_ready' | 'expired' | 'done' | 'dismissed';
export type ResetRequest = { id: number; name: string; email: string; createdAt: string; isAdmin: boolean; status: ResetStatus };

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export type Network = 'mtn' | 'telecel' | 'at';
export const networkLabel: Record<Network, string> = { mtn: 'MTN MoMo', telecel: 'Telecel Cash', at: 'AT Money' };
export type WithdrawalStatus = 'requested' | 'paid' | 'rejected' | 'cancelled';
export type Wallet = {
  balances: { available: number; reserved: number; pending: number; withdrawable: number; inPayout: number };
  payoutMethod: { network: Network; number: string; accountName: string; verified: boolean } | null;
  ledger: { id: number; bucket: string; amount: number; kind: string; note: string | null; createdAt: string }[];
  withdrawals: { id: number; amount: number; network: Network; number: string; status: WithdrawalStatus; reason: string | null; reference: string | null; payoutDate: string; createdAt: string; processedAt: string | null }[];
  minWithdrawal: number;
  minDeposit: number;
  depositInstructions: string;
  deposits: { id: number; amount: number; reference: string; status: 'requested' | 'confirmed' | 'rejected'; note: string | null; createdAt: string }[];
  nextPayout: { date: string; cutoff: string };
};
export type AdminWithdrawal = {
  id: number; userId: number; name: string; email: string; amount: number; network: Network; number: string; accountName: string;
  status: WithdrawalStatus; reason: string | null; reference: string | null; payoutDate: string; createdAt: string; processedAt: string | null; verified: boolean;
};
export type AdminPayoutMethod = { userId: number; name: string; email: string; network: Network; number: string; accountName: string; updatedAt: string };

export function formatDay(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' });
}
export function formatMomo(number: string): string {
  return number.length === 10 ? `${number.slice(0, 4)} ${number.slice(4, 7)} ${number.slice(7)}` : number;
}

export type TaskStatus = 'assigned' | 'submitted' | 'correction_requested' | 'resubmitted' | 'completed' | 'cancelled' | 'expired' | 'under_dispute';
export const taskStatusLabel: Record<TaskStatus, string> = {
  assigned: 'In progress', submitted: 'Waiting for review', correction_requested: 'Correction requested', resubmitted: 'Corrected work waiting',
  completed: 'Completed', cancelled: 'Cancelled', expired: 'Expired', under_dispute: 'In dispute',
};
export type MyTask = {
  id: number; status: TaskStatus; dueAt: string; reviewDueAt: string | null; correctionDueAt: string | null; reward: number;
  settled: string | null; campaignId: number; title: string; publisherName: string;
};
export type TaskDetail = {
  role: 'worker' | 'publisher';
  assignment: {
    id: number; campaignId: number; title: string; description: string; deliverable: string; criteria: string; category: string; status: TaskStatus;
    dueAt: string; reviewDueAt: string | null; correctionDueAt: string | null; correctionUsed: boolean; correctionReason: string | null;
    reward: number; fee: number | null; settled: string | null; workerName: string; publisherName: string; createdAt: string; completedAt: string | null;
  };
  submissions: { round: number; link: string | null; note: string | null; createdAt: string }[];
  events: { event: string; note: string | null; createdAt: string; actorName: string }[];
  dispute: null | {
    id: number; status: 'open' | 'resolved'; reason: string; decision: string | null; workerAmount: number | null; adminNote: string | null;
    createdAt: string; resolvedAt: string | null; openedByName: string;
    messages: { id: number; body: string; createdAt: string; name: string; mine: boolean }[];
  };
};
export type CampaignDetail = {
  campaign: ApiCampaign;
  applications: { id: number; status: string; workerName: string; createdAt: string; expiresAt: string }[];
  assignments: { id: number; status: TaskStatus; workerName: string; dueAt: string; reviewDueAt: string | null; correctionDueAt: string | null; settled: string | null }[];
};
export type AppNotification = { id: number; kind: string; title: string; body: string | null; href: string | null; read: boolean; createdAt: string };
export type AdminDeposit = { id: number; name: string; email: string; amount: number; reference: string; status: 'requested' | 'confirmed' | 'rejected'; note: string | null; createdAt: string; processedAt: string | null };
export type AdminDispute = {
  id: number; status: 'open' | 'resolved'; reason: string; decision: string | null; createdAt: string; assignmentId: number; title: string; reward: number; fee: number;
  workerName: string; workerEmail: string; publisherName: string; publisherEmail: string; openedByName: string; messages: number;
};
export type AdminDisputeDetail = {
  dispute: { id: number; status: string; reason: string; decision: string | null; adminNote: string | null; title: string; description: string; deliverable: string; criteria: string; correctionReason: string | null };
  submissions: { round: number; link: string | null; note: string | null; createdAt: string }[];
  messages: { body: string; createdAt: string; name: string }[];
  events: { event: string; note: string | null; createdAt: string; actorName: string }[];
};

// "2 days left", "5 hours left", "40 min left" or "overdue"
export function timeLeft(iso: string | null | undefined): string {
  if (!iso) return '';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'overdue';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${Math.max(1, minutes)} min left`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} ${hours === 1 ? 'hour' : 'hours'} left`;
  return `${Math.floor(hours / 24)} days left`;
}
export function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
