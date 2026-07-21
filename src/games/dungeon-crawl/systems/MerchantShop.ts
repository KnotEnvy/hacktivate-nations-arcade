// ===== src/games/dungeon-crawl/systems/MerchantShop.ts =====
// Wave N valve (handoff v4Notes.lineBudget) — the dungeon merchant extracted
// from the orchestrator behind a narrow host (ThiefSkills conventions:
// mechanics + pedestal state live here, the run's gold ledger and buy metrics
// stay in the game's callbacks). A pure move: the price haggle, the reach scan
// and the purchase gate read exactly as they did inline.

import { SoundName } from '@/services/AudioManager';
import { BOON_TUNING } from '../data/boons';
import { PALETTE, SHOP } from '../data/constants';
import { STAT_TUNING } from '../data/stats';
import type { ShopItemPlan, ShopProduct } from '../dungeon/DungeonGenerator';
import { Player } from '../entities/Player';
import type { HudRenderer } from '../rendering/HudRenderer';
import type { TileRenderer } from '../rendering/TileRenderer';
import { ParticleSystem } from './ParticleSystem';

// Live shop item (generator plan + sold state).
export interface LiveShopItem extends ShopItemPlan {
  sold: boolean;
}

export interface MerchantShopHost {
  player(): Player;
  /** The run wallet — dungeon merchants spend from goldBalance, never pickups. */
  goldBalance(): number;
  particles: ParticleSystem;
  playSound(name: SoundName, volume: number): void;
  /** Product effects resolve in Combat.applyShopPurchase. */
  applyPurchase(product: ShopProduct): void;
  /** Ledger + metric bookkeeping stays in the game (gold spent, items bought). */
  onPurchase(product: ShopProduct, price: number): void;
}

export class MerchantShop {
  private items: LiveShopItem[] = [];
  private merchantPos: { x: number; y: number } | null = null;
  private active: LiveShopItem | null = null;
  private deniedFlash = 0; // keyless-purse feedback tint on the buy prompt

  constructor(private host: MerchantShopHost) {}

  /** A new floor's shop (or nothing on floors without one). */
  loadFor(
    shop: { items: readonly ShopItemPlan[]; merchant: { x: number; y: number } } | null | undefined,
  ): void {
    this.items = shop ? shop.items.map(i => ({ ...i, sold: false })) : [];
    this.merchantPos = shop?.merchant ?? null;
    this.active = null;
    this.deniedFlash = 0;
  }

  /** Lastlight (or any shop-less floor): forget the stall. */
  reset(): void {
    this.items = [];
    this.merchantPos = null;
    this.active = null;
    this.deniedFlash = 0;
  }

  /** True while a pedestal is in reach — the game suppresses lower-priority E. */
  hasActive(): boolean {
    return this.active !== null;
  }

  merchant(): { x: number; y: number } | null {
    return this.merchantPos;
  }

  /** The buy prompt for the pedestal in reach (null = none); price haggled. */
  prompt(): { product: ShopProduct; price: number; canAfford: boolean; denied: number } | null {
    if (!this.active) return null;
    const price = this.hagglerPrice(this.active.price);
    return {
      product: this.active.product,
      price,
      canAfford: this.host.goldBalance() >= price,
      denied: this.deniedFlash,
    };
  }

  /** Wave K — the keyless-purse flash fades on REAL dt (called at the top of
   *  onUpdate beside bannerTimer, so hit-stop and menu states never stall it). */
  tickFlash(dt: number): void {
    this.deniedFlash = Math.max(0, this.deniedFlash - dt);
  }

  /** Per playing frame: find the nearest pedestal, buy on the E. */
  update(dt: number, interactDown: boolean, interactWas: boolean): void {
    this.active = null;
    if (this.items.length === 0) return;
    const player = this.host.player();
    let best: LiveShopItem | null = null;
    let bestDist = SHOP.INTERACT_RADIUS + player.size / 2;
    for (const item of this.items) {
      if (item.sold) continue;
      const dist = Math.hypot(item.x - player.x, item.y - player.y);
      if (dist < bestDist) {
        bestDist = dist;
        best = item;
      }
    }
    this.active = best;
    if (!best || !interactDown || interactWas) return;

    const price = this.hagglerPrice(best.price);
    if (this.host.goldBalance() < price) {
      this.deniedFlash = 0.8;
      this.host.playSound('error', 0.4);
      return;
    }
    best.sold = true;
    this.host.applyPurchase(best.product); // product effects resolve in Combat
    this.host.playSound('success', 0.5);
    this.host.particles.burst(best.x, best.y, PALETTE.gold, 12, 100, 0.6);
    this.host.onPurchase(best.product, price);
  }

  /** World-space stall (the merchant + their pedestals). Empty off shop floors. */
  render(ctx: CanvasRenderingContext2D, tiles: TileRenderer, gameTime: number): void {
    if (this.merchantPos) tiles.drawMerchant(ctx, this.merchantPos.x, this.merchantPos.y, gameTime);
    for (const item of this.items) tiles.drawShopItem(ctx, item, item.sold, gameTime);
  }

  /** Screen-space buy prompt when a pedestal is in reach; true if it drew. */
  renderPrompt(ctx: CanvasRenderingContext2D, hud: HudRenderer): boolean {
    const p = this.prompt();
    if (!p) return false;
    hud.renderShopItemPrompt(ctx, p.product, p.price, p.canAfford, p.denied);
    return true;
  }

  /** v4 — Haggler training (+ v5 Presence) talks merchants down, never below 1 gold. */
  hagglerPrice(base: number): number {
    const player = this.host.player();
    const discount =
      player.boonCount('haggler') * BOON_TUNING.HAGGLER_DISCOUNT +
      player.statMods.cha * STAT_TUNING.CHA_SHOP_DISCOUNT;
    if (discount === 0) return base;
    return Math.max(1, Math.round(base * (1 - discount)));
  }
}
