# Editing the HUSTLA site

Everything lives in `artifacts/hustla-site-preview/src/`. Edit a file on GitHub (open it, use the pencil/"Edit in place"), commit to `main`, and Netlify publishes it in a minute or two.

## Pages (one file each): `src/pages/`
| Page on the site | File |
| --- | --- |
| Home (landing) | `HomePage.tsx` |
| Dashboard | `DashboardPage.tsx` |
| Explore tasks | `ExplorePage.tsx` |
| New campaign (3 steps) | `NewCampaignPage.tsx` |
| Campaigns | `CampaignsPage.tsx` |
| Leaderboard | `LeaderboardPage.tsx` |
| How it works | `HowItWorksPage.tsx` |
| Pricing | `PricingPage.tsx` |
| Help | `HelpPage.tsx` |

## Text and sample data you may want to change: `src/lib/`
- `data.ts`: the task categories and the sample tasks on Explore.
- `content.ts`: the How it works steps (`businessSteps`, `workerSteps`) and the Help questions (`faqs`).
- `campaigns.ts`: how demo campaigns are saved in the browser.
- `motion.tsx`: scroll-reveal and count-up animations.
- `demoAuth.tsx`: the demo sign-in (no real accounts yet).

## Shared pieces: `src/components/`
- `layout.tsx`: the top bar, the hamburger menu (add or rename menu links in `navItems`), and the page header.
- `shared.tsx`: the numbered step list and the "no fake engagement" notice.

## Look and feel
- `src/index.css`: all colours, spacing, fonts, animations and mobile layout.
- Logo and images: `public/assets/`.
- Build settings: `netlify.toml` (repo root).

## Working together
- Work on a branch and merge into `main` when ready, because anything committed to `main` goes live.
- Pull the latest changes before you start editing, and tell each other which file you are changing.
