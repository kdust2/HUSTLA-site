

export type Campaign = { id: number; title: string; category: string; status: string; quantity: number; reward: number };

export const CAMPAIGN_KEY = 'hustla-demo-campaigns';
export const FLASH_KEY = 'hustla-flash';
export function loadSavedCampaigns(): Campaign[] {
  try {
    const raw = window.localStorage.getItem(CAMPAIGN_KEY);
    return raw ? (JSON.parse(raw) as Campaign[]) : [];
  } catch {
    return [];
  }
}
export function saveCampaign(campaign: Campaign) {
  try { window.localStorage.setItem(CAMPAIGN_KEY, JSON.stringify([campaign, ...loadSavedCampaigns()])); } catch { /* storage can be unavailable */ }
}
