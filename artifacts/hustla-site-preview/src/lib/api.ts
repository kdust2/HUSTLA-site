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
