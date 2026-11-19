

export const categories = [
  'Business & Product Promotion', 'Social Media Growth', 'Music & Entertainment',
  'Content Creation & UGC', 'Design & Branding', 'Video & Photo Services',
  'Digital & Tech Services', 'Events & Experiences', 'Writing & Marketing',
  'Fashion & Lifestyle', 'Education & Learning', 'Other Tasks & Opportunities',
];

export type Task = { id: number; title: string; category: string; reward: number; days: number; spots: number; description: string };
export const gh = (value: number) => `GH₵${value.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
