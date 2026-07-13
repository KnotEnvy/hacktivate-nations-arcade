// ===== src/games/dungeon-crawl/systems/Inventory.ts =====
// v5 Wave F — the hero's found equipment: a run SATCHEL of finds, the worn
// set, and the banking rules. Mid-run everything is run-local (die and the
// unbanked finds are gone, like carried gold); in town the screen edits the
// SAVED hero directly (equipment/stash), so the death path never needs to
// touch the save. Reaches the run only through the narrow InventoryHost.

import { SoundName } from '@/services/AudioManager';
import {
  ALL_EQUIP_SLOTS,
  EquipSlot,
  ITEM_TUNING,
  ITEMS,
  ItemId,
  mergeItemEffects,
} from '../data/items';
import { SavedHero } from '../persistence/CharacterStore';

export interface InventoryInput {
  isKeyPressed(code: string): boolean;
  isUpPressed(): boolean;
  isDownPressed(): boolean;
}

export interface InventoryHost {
  hero(): SavedHero | null;
  /** True when the screen is browsing the town (save-backed) side. */
  inTown(): boolean;
  save(): void;
  playSound(name: SoundName, volume: number): void;
  showBanner(text: string, sub: string): void;
  /** Re-fold worn effects + effective scores into the live Player. */
  refreshFolds(): void;
  onItemFound(): void;
}

export class Inventory {
  /** Run finds not yet worn — lost with the hero's death. */
  satchel: ItemId[] = [];
  /** Worn mid-run (run-local; becomes hero.equipment only at victory). */
  equipped: Partial<Record<EquipSlot, ItemId>> = {};
  index = 0;

  constructor(private host: InventoryHost) {}

  reset(): void {
    this.satchel = [];
    this.equipped = {};
    this.index = 0;
  }

  /** Depart: wear what the save says; the satchel starts empty. */
  armFromHero(hero: SavedHero): void {
    this.equipped = { ...hero.equipment };
    this.satchel = [];
    this.index = 0;
  }

  /** The worn set the current mode is looking at. */
  wornMap(): Partial<Record<EquipSlot, ItemId>> {
    return this.host.inTown() ? (this.host.hero()?.equipment ?? {}) : this.equipped;
  }

  equippedIds(): ItemId[] {
    const worn = this.wornMap();
    return ALL_EQUIP_SLOTS.map(slot => worn[slot]).filter((id): id is ItemId => !!id);
  }

  /** Merged flat effects of the RUN's worn set (Player folds read this). */
  mergedEffects(): ReturnType<typeof mergeItemEffects> {
    return mergeItemEffects(
      ALL_EQUIP_SLOTS.map(slot => this.equipped[slot]).filter((id): id is ItemId => !!id),
    );
  }

  /** What the screen browses: the run satchel below, the stash in town. */
  browseList(): ItemId[] {
    return this.host.inTown() ? [...(this.host.hero()?.stash ?? [])] : [...this.satchel];
  }

  /** Floor pickup intake. False = satchel full, the find stays put. */
  tryCollect(id: ItemId): boolean {
    if (this.satchel.length >= ITEM_TUNING.SATCHEL_MAX) {
      this.host.showBanner('SATCHEL FULL', `${ITEMS[id].name} STAYS WHERE IT LIES`);
      this.host.playSound('error', 0.35);
      return false;
    }
    this.satchel.push(id);
    this.host.onItemFound();
    this.host.playSound('unlock', 0.55);
    this.host.showBanner(ITEMS[id].name, `${ITEMS[id].blurb} — I TO EQUIP`);
    return true;
  }

  /** Inventory-screen input (world frozen underneath). */
  update(
    input: InventoryInput | undefined,
    edges: { navUpWas: boolean; navDownWas: boolean; confirmWas: boolean },
  ): void {
    if (!input) return;
    const list = this.browseList();
    if (list.length === 0) return;
    if (this.index >= list.length) this.index = list.length - 1;
    if (input.isUpPressed() && !edges.navUpWas) {
      this.index = (this.index + list.length - 1) % list.length;
      this.host.playSound('click', 0.3);
    }
    if (input.isDownPressed() && !edges.navDownWas) {
      this.index = (this.index + 1) % list.length;
      this.host.playSound('click', 0.3);
    }
    const confirm =
      input.isKeyPressed('Space') || input.isKeyPressed('Enter') || input.isKeyPressed('KeyJ');
    if (confirm && !edges.confirmWas) this.wear(list[this.index]);
  }

  /** Wear a browsed item; the displaced piece returns whence the new one came. */
  private wear(id: ItemId): void {
    const slot = ITEMS[id].slot;
    if (this.host.inTown()) {
      const hero = this.host.hero();
      if (!hero) return;
      const prev = hero.equipment[slot] ?? null;
      const at = hero.stash.indexOf(id);
      if (at >= 0) hero.stash.splice(at, 1);
      if (prev) hero.stash.push(prev);
      hero.equipment[slot] = id;
      this.host.save();
    } else {
      const prev = this.equipped[slot] ?? null;
      const at = this.satchel.indexOf(id);
      if (at >= 0) this.satchel.splice(at, 1);
      if (prev) this.satchel.push(prev);
      this.equipped[slot] = id;
    }
    this.host.refreshFolds();
    this.host.playSound('powerup', 0.45);
    this.host.showBanner(ITEMS[id].name, 'WORN');
  }

  /**
   * VICTORY — the only moment run finds become permanent: the worn set is
   * saved, satchel finds join the stash, and duplicates or overflow convert
   * to gold (the caller folds it into `banked` BEFORE the ledger renders).
   */
  bankOnVictory(hero: SavedHero): { bankedCount: number; dupeGold: number } {
    hero.equipment = { ...this.equipped };
    const owned = new Set<ItemId>([
      ...(Object.values(hero.equipment) as ItemId[]),
      ...hero.stash,
    ]);
    let bankedCount = 0;
    let dupeGold = 0;
    for (const id of this.satchel) {
      if (owned.has(id) || hero.stash.length >= ITEM_TUNING.STASH_MAX) {
        dupeGold += ITEM_TUNING.DUPE_GOLD[ITEMS[id].rarity];
      } else {
        hero.stash.push(id);
        owned.add(id);
        bankedCount++;
      }
    }
    this.satchel = [];
    return { bankedCount, dupeGold };
  }

  /** Death: how many run finds died unbanked (for the recap line). */
  lostCount(hero: SavedHero | null): number {
    const banked = new Set<string>([
      ...(Object.values(hero?.equipment ?? {}) as string[]),
      ...(hero?.stash ?? []),
    ]);
    let lost = this.satchel.length;
    for (const slot of ALL_EQUIP_SLOTS) {
      const id = this.equipped[slot];
      if (id && !banked.has(id)) lost++;
    }
    return lost;
  }
}
