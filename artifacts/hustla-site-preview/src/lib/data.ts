

export const categories = [
  'Business & Product Promotion', 'Social Media Growth', 'Music & Entertainment',
  'Content Creation & UGC', 'Design & Branding', 'Video & Photo Services',
  'Digital & Tech Services', 'Events & Experiences', 'Writing & Marketing',
  'Fashion & Lifestyle', 'Education & Learning', 'Other Tasks & Opportunities',
];

export type Task = { id: number; title: string; category: string; reward: number; days: number; spots: number; description: string };
export const initialTasks: Task[] = [
  { id: 1, title: 'Unboxing video for a Kumasi shea butter brand', category: categories[3], reward: 40, days: 3, spots: 3, description: 'Phone video, 30 seconds, honest first impressions.' },
  { id: 2, title: 'Usability test of a school fees portal', category: categories[6], reward: 60, days: 5, spots: 2, description: 'Complete five tasks and report what confused you.' },
  { id: 3, title: 'Cover art for an Afrobeats single', category: categories[2], reward: 120, days: 7, spots: 1, description: 'Original artwork, 3000 × 3000 px, two revision rounds.' },
  { id: 4, title: 'Thumbnail set for a cooking channel', category: categories[4], reward: 35, days: 2, spots: 4, description: 'Three thumbnails, 1280 × 720, brand colours provided.' },
  { id: 5, title: 'Event photos for a Takoradi pop-up market', category: categories[7], reward: 150, days: 9, spots: 2, description: '30 edited photos within 48 hours of the event.' },
  { id: 6, title: 'Caption writing for a fashion label', category: categories[8], reward: 25, days: 1, spots: 6, description: 'Ten captions in English, friendly tone, no fake claims.' },
  { id: 7, title: 'Product demo reel for a phone accessories shop', category: categories[0], reward: 80, days: 6, spots: 2, description: 'Vertical video, 20 to 40 seconds, shows the product in use.' },
  { id: 8, title: 'Survey on how students pay for data', category: categories[11], reward: 15, days: 4, spots: 20, description: 'Ten minutes. Honest answers only.' },
];
export const gh = (value: number) => `GH₵${value.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
