// ===== src/services/GameSaveSync.ts =====
// Cloud promotion for owner-scoped localStorage game saves (Dungeon Crawl's
// hero roster today; any future game joins via SYNCED_GAME_SAVES). The local
// save stays the offline cache and the game keeps reading/writing it exactly
// as before — this layer only mirrors it to the game_saves table for
// signed-in players.
//
// Sync contract:
// - A sidecar meta key per (owner, game) records the last-synced payload hash
//   and the server's updated_at, so both "local changed" and "server changed"
//   are detectable without touching game code.
// - Reconcile (once per sign-in, after account hydration):
//     no server + local        -> push (first promotion)
//     server + no local        -> adopt server
//     only local changed       -> push
//     only server changed      -> adopt server
//     both changed (2 devices) -> SERVER WINS (newer updated_at is authoritative)
//     no server + no local     -> offer a one-time guest-save migration
// - Pushes are state-idempotent, so failures just warn and self-heal at the
//   next trigger (game end, back to hub, pagehide, next sign-in) — they never
//   ride the trusted-mutation outbox.
// - Saves are STATE, never currency: rewards ride trusted session metrics.

import type { Json } from '@/lib/supabase.types';
import type { SupabaseArcadeService } from '@/services/SupabaseArcadeService';

const META_PREFIX = 'hacktivate-game-save-sync-v1';
const GUEST_OWNER = 'guest';
// Mirrors the upsert_game_save RPC's payload guard.
const MAX_PAYLOAD_BYTES = 65536;

export interface SyncedGameSave {
  gameId: string;
  /** Shown in the guest-migration offer. */
  title: string;
  storageKeyFor: (ownerId: string) => string;
}

export const SYNCED_GAME_SAVES: SyncedGameSave[] = [
  {
    gameId: 'dungeon-crawl',
    title: 'Dungeon Crawl',
    storageKeyFor: owner => `dungeon-crawl-save:${owner}`,
  },
];

export interface GuestSaveOffer {
  gameId: string;
  title: string;
}

interface SyncMeta {
  lastSyncedHash: string | null;
  serverUpdatedAt: string | null;
  guestMigrationResolved: boolean;
}

const EMPTY_META: SyncMeta = {
  lastSyncedHash: null,
  serverUpdatedAt: null,
  guestMigrationResolved: false,
};

/** djb2 — cheap change detection for the sidecar, not a security boundary. */
export const hashSavePayload = (text: string): string => {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16);
};

const canUseStorage = (): boolean =>
  typeof window !== 'undefined' && Boolean(window.localStorage);

const readStorage = (key: string): string | null => {
  try {
    return canUseStorage() ? window.localStorage.getItem(key) : null;
  } catch {
    return null;
  }
};

const writeStorage = (key: string, value: string): void => {
  try {
    if (canUseStorage()) window.localStorage.setItem(key, value);
  } catch {
    // Storage full / blocked — degrade silently like the game stores do.
  }
};

/** A pushable payload must be a modest-sized JSON object. */
const parsePayload = (raw: string): Json | null => {
  if (raw.length > MAX_PAYLOAD_BYTES) return null;
  try {
    const parsed = JSON.parse(raw) as Json;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export class GameSaveSync {
  constructor(
    private readonly userId: string,
    private readonly games: SyncedGameSave[] = SYNCED_GAME_SAVES
  ) {}

  private metaKey(gameId: string): string {
    return `${META_PREFIX}:${this.userId}:${gameId}`;
  }

  private readMeta(gameId: string): SyncMeta {
    const raw = readStorage(this.metaKey(gameId));
    if (!raw) return { ...EMPTY_META };
    try {
      const parsed = JSON.parse(raw) as Partial<SyncMeta>;
      return {
        lastSyncedHash:
          typeof parsed.lastSyncedHash === 'string' ? parsed.lastSyncedHash : null,
        serverUpdatedAt:
          typeof parsed.serverUpdatedAt === 'string' ? parsed.serverUpdatedAt : null,
        guestMigrationResolved: parsed.guestMigrationResolved === true,
      };
    } catch {
      return { ...EMPTY_META };
    }
  }

  private writeMeta(gameId: string, meta: SyncMeta): void {
    writeStorage(this.metaKey(gameId), JSON.stringify(meta));
  }

  private async push(
    service: SupabaseArcadeService,
    accessToken: string,
    game: SyncedGameSave,
    localRaw: string
  ): Promise<void> {
    const payload = parsePayload(localRaw);
    if (!payload) return;
    const updatedAt = await service.upsertGameSave(game.gameId, payload, { accessToken });
    this.writeMeta(game.gameId, {
      ...this.readMeta(game.gameId),
      lastSyncedHash: hashSavePayload(localRaw),
      serverUpdatedAt: updatedAt,
    });
  }

  private adopt(
    game: SyncedGameSave,
    payload: Json,
    serverUpdatedAt: string
  ): void {
    const text = JSON.stringify(payload);
    writeStorage(game.storageKeyFor(this.userId), text);
    this.writeMeta(game.gameId, {
      ...this.readMeta(game.gameId),
      lastSyncedHash: hashSavePayload(text),
      serverUpdatedAt,
    });
  }

  /**
   * Sign-in reconciliation for every registered game. Returns any pending
   * one-time guest-save migration offers for the UI to surface.
   */
  async reconcile(
    service: SupabaseArcadeService,
    accessToken: string
  ): Promise<GuestSaveOffer[]> {
    const offers: GuestSaveOffer[] = [];

    for (const game of this.games) {
      try {
        const server = await service.fetchGameSave(this.userId, game.gameId, {
          accessToken,
        });
        const localRaw = readStorage(game.storageKeyFor(this.userId));
        const meta = this.readMeta(game.gameId);
        const localChanged =
          localRaw !== null && hashSavePayload(localRaw) !== meta.lastSyncedHash;
        const serverChanged = server !== null && server.updated_at !== meta.serverUpdatedAt;

        if (!server) {
          if (localRaw) {
            await this.push(service, accessToken, game, localRaw);
          } else if (
            !meta.guestMigrationResolved &&
            readStorage(game.storageKeyFor(GUEST_OWNER))
          ) {
            offers.push({ gameId: game.gameId, title: game.title });
          }
        } else if (!localRaw || (serverChanged && !localChanged)) {
          this.adopt(game, server.payload, server.updated_at);
        } else if (localChanged && !serverChanged) {
          await this.push(service, accessToken, game, localRaw);
        } else if (localChanged && serverChanged) {
          // Two devices diverged: the server copy carries the newer
          // updated_at, so it wins; the stale local becomes the cache.
          this.adopt(game, server.payload, server.updated_at);
        }
      } catch (error) {
        console.warn(`Game save reconcile failed for ${game.gameId}:`, error);
      }
    }

    return offers;
  }

  /** Push any local saves whose content changed since the last sync. */
  async pushIfChanged(
    service: SupabaseArcadeService,
    accessToken: string,
    gameId?: string
  ): Promise<void> {
    for (const game of this.games) {
      if (gameId && game.gameId !== gameId) continue;
      try {
        const localRaw = readStorage(game.storageKeyFor(this.userId));
        if (!localRaw) continue;
        if (hashSavePayload(localRaw) === this.readMeta(game.gameId).lastSyncedHash) {
          continue;
        }
        await this.push(service, accessToken, game, localRaw);
      } catch (error) {
        console.warn(`Game save push failed for ${game.gameId}:`, error);
      }
    }
  }

  /**
   * Adopt this device's guest save into the signed-in account's local slot.
   * Returns true when a valid guest save was copied (caller then pushes).
   */
  adoptGuestSave(gameId: string): boolean {
    const game = this.games.find(entry => entry.gameId === gameId);
    if (!game) return false;

    const guestRaw = readStorage(game.storageKeyFor(GUEST_OWNER));
    const meta = this.readMeta(gameId);
    this.writeMeta(gameId, { ...meta, guestMigrationResolved: true });
    if (!guestRaw || !parsePayload(guestRaw)) return false;

    writeStorage(game.storageKeyFor(this.userId), guestRaw);
    return true;
  }

  /** Decline the offer — it never comes back for this account. */
  declineGuestSave(gameId: string): void {
    this.writeMeta(gameId, {
      ...this.readMeta(gameId),
      guestMigrationResolved: true,
    });
  }
}
