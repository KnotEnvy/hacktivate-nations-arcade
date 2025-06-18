# **HacktivateNations Arcade – Product Requirements Document (v2 – 2025‑06‑17)**

## **1\. Vision & Goals**

HacktivateNations Arcade will be a **single‑page, plug‑and‑play web hub** where modular retro‑inspired mini‑games live under one roof. Players earn a universal currency, chase daily challenges, and unlock fresh games without ever refreshing the page—whether online or offline.

*"A Netflix‑style carousel for pick‑up‑and‑play games, built for rapid community contribution."*

### **Success KPIs**

| Metric | Target @ public beta | Stretch @ v1.0 |
| ----- | ----- | ----- |
| First Contentful Paint | \< **2.0 s** on 4G | 1.2 s |
| Avg. Session Length | **6 min** | 10 min |
| d7 Retention | **25 %** | 35 % |
| Daily Challenges Completed / DAU | **1.2** | 1.8 |

## **2\. Player Personas**

* **Explorer** – samples every game, seeks achievements.

* **Competitor** – optimises scores, climbs leaderboards.

* **Creator** – wants to drop in a new mini‑game via PR and see it live.

## **3\. Gameplay & Progression**

### **3.1 Arcade Hub**

* React carousel showcasing unlocked games.

* **Daily Quest panel** exposing 3 randomised goals (cross‑game where possible).

* Persistent header with currency, level, avatar.

### **3.2 Universal Economy**

* **Currency Formula**: `floor(runScore/100) + pickups + questBonus`.

* **Unlock Costs** (tunable via Supabase JSON):

| Tier | Games Unlocked | Cost (coins) |
| ----- | ----- | ----- |
| 0 | Runner (default) | 0 |
| 1 | \+1 game | 2 000 |
| 2 | \+2 games | 5 000 |

*   
  Expected earn‑rate: **250 coins / active minute** (balance sheet in `/docs/economy.xlsx`).

* **Seasonal reset** every 90 days → cosmetic badges only.

### **3.3 Achievements & Challenges**

* **Achievements**: static set, one‑time rewards.

* **Daily/Weekly Challenges**: server‑seeded JSON; completion grants currency multiplier.

## **4\. GameModule Contract (SDK v0.2)**

interface GameModule {

  init(canvas: HTMLCanvasElement, services: Services): void;

  update(dt: number): void;

  render(ctx: CanvasRenderingContext2D): void;

  /\*\* Lifecycle hooks \*/

  pause?(): void;

  resume?(): void;

  resize?(w: number, h: number): void;

  destroy?(): void;

  /\*\* Metadata \*/

  manifest: {

    id: string;             // unique kebab‑case

    title: string;

    thumbnail: string;      // 512×512 png

    inputSchema: InputType\[\]; // auto‑wired by InputManager

    assetBudgetKB: number;  // ≤ 300

  };

}

### **Shared Services**

* `InputManager` – unifies keyboard, touch, gamepad.

* `AudioManager` – WebAudio global mixer.

* `Analytics` – PostHog proxy.

## **5\. Technical Architecture**

* **Frontend**: Next.js 14 \+/React 18 \+ TypeScript.

* **Rendering**: HTML5 Canvas; fallback to WebGL/OffscreenCanvas where available.

* **Backend**: Vercel Edge Functions \+ Supabase (auth, realtime, storage, SQL, PostHog).

* **Offline PWA**: Workbox runtime caching of shell \+ per‑game bundles.

* **CI/CD**: GitHub Actions → Vercel preview; OWASP scan, Lighthouse 90+ gate, Jest \> 90 % coverage.

## **6\. Accessibility & I18n**

* WCAG 2.1 AA menus & UI.

* All actions operable via keyboard.

* Colour‑blind safe palettes & contrast toggle.

* Text externalised to `/public/i18n` (en, es initial).

## **7\. Analytics & A/B Testing**

* PostHog self‑hosted on Supabase.

* `NEXT_PUBLIC_FEATURE_…` flags drive experiments.

* Funnel: Hub → Game select → First score → Challenge redeemed.

## **8\. Roadmap & Milestones**

| Milestone | Scope | ETA |
| ----- | ----- | ----- |
| **M0 – Setup** | Repo scaffolding, Storybook, shared services stubs | 2 wks |
| **M1 – Runner Beta** | First game playable, hub shell, currency accrual | \+4 wks |
| **M2 – Unlock Flow** | Second game stub, economy tuning sheet, Supabase persistence | \+3 wks |
| **M3 – Daily Challenges** | Serverless endpoints, UI widgets, analytics dashboards | \+2 wks |
| **M4 – PWA & Offline** | Service‑worker, add‑to‑home, Lighthouse PWA pass | \+2 wks |
| **M5 – Public Beta** | Second game finished, contributor guide, marketing site | \+3 wks |

## **9\. Contributor Guide (Appendix A)**

* `pnpm create game my‑cool‑game` scaffolds boilerplate.

* Sprite sheets ≤ 64×64 per frame; PNG‑8 w/ transparency.

* Only open‑source or self‑created assets (CC‑BY‑4.0 min).

* Submit PR \+ fill Game Review checklist.

## **10\. Risks & Mitigations**

| Risk | Impact | Mitigation |
| ----- | ----- | ----- |
| Asset bloat slows FCP | High | Enforce 300 KB per game lint rule. |
| Infinite currency exploit | Med | Server‑side validation \+ per‑session rate caps. |
| Supabase downtime | Med | Graceful offline mode, localStorage cache, queue sync. |
| Accessibility gaps | Low | Monthly axe‑core audits \+ player feedback form. |

## **11\. Open Questions**

1. Real‑time multiplayer: Supabase Realtime vs dedicated WebSocket edge gateway?

2. Monetisation—purely cosmetic or ad‑supported?

3. Long‑term creator revenue share model?

---

*Prepared by Knot Envy & ChatGPT, 17 Jun 2025.*

