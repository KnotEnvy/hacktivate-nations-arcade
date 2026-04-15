import type {
  PlayerStateUpsertInput,
  ProfileUpsertInput,
  SupabaseArcadeService,
  TrustedChallengeSyncInput,
  TrustedSessionMetrics,
} from '@/services/SupabaseArcadeService';

const OUTBOX_STORAGE_KEY = 'hacktivate-supabase-sync-outbox-v1';

type OutboxOperation =
  | {
      kind: 'profile-sync';
      payload: ProfileUpsertInput;
    }
  | {
      kind: 'player-state-sync';
      payload: PlayerStateUpsertInput;
    }
  | {
      kind: 'trusted-challenge-sync';
      payload: TrustedChallengeSyncInput[];
    }
    | {
        kind: 'trusted-session-record';
        payload: {
          gameId: string;
          score: number;
          pickups: number;
          timePlayedMs: number;
          metrics?: TrustedSessionMetrics;
          clientMutationId: string;
        };
      }
  | {
      kind: 'trusted-achievement-claim';
      payload: {
        achievementIds: string[];
      };
    }
  | {
      kind: 'trusted-challenge-claim';
      payload: {
        challengeId: string;
        progress: number;
      };
    }
  | {
      kind: 'trusted-tier-unlock';
      payload: {
        tier: number;
      };
    }
  | {
      kind: 'trusted-game-unlock';
      payload: {
        gameId: string;
      };
    };

export type StoredOutboxOperation = OutboxOperation & {
  id: string;
  createdAt: string;
  updatedAt: string;
  retryCount: number;
  lastError?: string;
};

interface FlushCallbacks {
  onBalanceReconciled?: (balance: number) => void;
  onUnlockStateReconciled?: (unlockedTiers: number[], unlockedGames: string[]) => void;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const createOperationId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export class SupabaseSyncOutbox {
  private queue: StoredOutboxOperation[] = [];
  private listeners: Array<(queue: StoredOutboxOperation[]) => void> = [];
  private loaded = false;

  private ensureLoaded() {
    if (this.loaded || typeof window === 'undefined') {
      return;
    }

    this.loaded = true;
    const raw = localStorage.getItem(OUTBOX_STORAGE_KEY);
    if (!raw) {
      this.queue = [];
      return;
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        this.queue = [];
        return;
      }

      this.queue = parsed.filter(isRecord).map(entry => entry as StoredOutboxOperation);
    } catch (error) {
      console.warn('Failed to load Supabase sync outbox:', error);
      this.queue = [];
    }
  }

  private persist() {
    if (typeof window === 'undefined') {
      return;
    }

    localStorage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(this.queue));
  }

  private notify() {
    const snapshot = this.getItems();
    this.listeners.forEach(listener => listener(snapshot));
  }

  getItems(): StoredOutboxOperation[] {
    this.ensureLoaded();
    return [...this.queue];
  }

  getPendingCount(): number {
    this.ensureLoaded();
    return this.queue.length;
  }

  onChanged(callback: (queue: StoredOutboxOperation[]) => void): () => void {
    this.ensureLoaded();
    this.listeners.push(callback);
    callback(this.getItems());

    return () => {
      const index = this.listeners.indexOf(callback);
      if (index >= 0) {
        this.listeners.splice(index, 1);
      }
    };
  }

  enqueue(operation: OutboxOperation): StoredOutboxOperation {
    this.ensureLoaded();
    const timestamp = new Date().toISOString();
    const existingIndex = this.findMergeCandidateIndex(operation);

    if (existingIndex >= 0) {
      const merged = this.mergeOperations(this.queue[existingIndex], operation, timestamp);
      this.queue[existingIndex] = merged;
      this.persist();
      this.notify();
      return merged;
    }

    const entry: StoredOutboxOperation = {
      ...operation,
      id: createOperationId(),
      createdAt: timestamp,
      updatedAt: timestamp,
      retryCount: 0,
    };
    this.queue.push(entry);
    this.persist();
    this.notify();
    return entry;
  }

  private findMergeCandidateIndex(operation: OutboxOperation): number {
    return this.queue.findIndex(entry => {
      if (entry.kind !== operation.kind) {
        return false;
      }

      switch (operation.kind) {
        case 'profile-sync': {
          const existing = entry as Extract<
            StoredOutboxOperation,
            { kind: 'profile-sync' }
          >;
          return existing.payload.id === operation.payload.id;
        }
        case 'player-state-sync': {
          const existing = entry as Extract<
            StoredOutboxOperation,
            { kind: 'player-state-sync' }
          >;
          return existing.payload.userId === operation.payload.userId;
        }
        case 'trusted-challenge-sync':
          return true;
        case 'trusted-achievement-claim':
          return true;
        case 'trusted-challenge-claim': {
          const existing = entry as Extract<
            StoredOutboxOperation,
            { kind: 'trusted-challenge-claim' }
          >;
          return existing.payload.challengeId === operation.payload.challengeId;
        }
        case 'trusted-tier-unlock': {
          const existing = entry as Extract<
            StoredOutboxOperation,
            { kind: 'trusted-tier-unlock' }
          >;
          return existing.payload.tier === operation.payload.tier;
        }
        case 'trusted-game-unlock': {
          const existing = entry as Extract<
            StoredOutboxOperation,
            { kind: 'trusted-game-unlock' }
          >;
          return existing.payload.gameId === operation.payload.gameId;
        }
        case 'trusted-session-record': {
          const existing = entry as Extract<
            StoredOutboxOperation,
            { kind: 'trusted-session-record' }
          >;
          return (
            existing.payload.clientMutationId === operation.payload.clientMutationId
          );
        }
        default:
          return false;
      }
    });
  }

  private mergeOperations(
    existing: StoredOutboxOperation,
    incoming: OutboxOperation,
    timestamp: string
  ): StoredOutboxOperation {
    if (existing.kind !== incoming.kind) {
      return {
        ...existing,
        ...incoming,
        updatedAt: timestamp,
      } as StoredOutboxOperation;
    }

    switch (incoming.kind) {
      case 'trusted-achievement-claim': {
        const previous = existing as Extract<
          StoredOutboxOperation,
          { kind: 'trusted-achievement-claim' }
        >;
        return {
          ...previous,
          payload: {
            achievementIds: Array.from(
              new Set([
                ...previous.payload.achievementIds,
                ...incoming.payload.achievementIds,
              ])
            ),
          },
          updatedAt: timestamp,
        };
      }
      case 'trusted-challenge-claim': {
        const previous = existing as Extract<
          StoredOutboxOperation,
          { kind: 'trusted-challenge-claim' }
        >;
        return {
          ...previous,
          payload: {
            challengeId: incoming.payload.challengeId,
            progress: Math.max(previous.payload.progress, incoming.payload.progress),
          },
          updatedAt: timestamp,
        };
      }
      default:
        return {
          ...existing,
          payload: incoming.payload,
          updatedAt: timestamp,
        } as StoredOutboxOperation;
    }
  }

  private remove(id: string) {
    this.queue = this.queue.filter(entry => entry.id !== id);
    this.persist();
    this.notify();
  }

  private markFailure(id: string, error: unknown) {
    const entry = this.queue.find(item => item.id === id);
    if (!entry) {
      return;
    }

    entry.retryCount += 1;
    entry.updatedAt = new Date().toISOString();
    entry.lastError = error instanceof Error ? error.message : String(error);
    this.persist();
    this.notify();
  }

  async flush(
    service: SupabaseArcadeService,
    accessToken: string,
    callbacks?: FlushCallbacks
  ) {
    this.ensureLoaded();
    let processed = 0;

    for (const entry of [...this.queue]) {
      try {
        switch (entry.kind) {
          case 'profile-sync':
            await service.upsertProfile(entry.payload, { accessToken });
            break;
          case 'player-state-sync':
            await service.upsertPlayerState(entry.payload, { accessToken });
            break;
          case 'trusted-challenge-sync':
            await service.syncChallengesTrusted(entry.payload, { accessToken });
            break;
          case 'trusted-session-record': {
            const result = await service.recordTrustedGameSession(entry.payload, {
              accessToken,
            });
            callbacks?.onBalanceReconciled?.(result.balance);
            break;
          }
          case 'trusted-achievement-claim': {
            const result = await service.claimAchievements(
              entry.payload.achievementIds,
              { accessToken }
            );
            callbacks?.onBalanceReconciled?.(result.balance);
            break;
          }
          case 'trusted-challenge-claim': {
            const result = await service.claimChallenge(
              entry.payload.challengeId,
              entry.payload.progress,
              { accessToken }
            );
            callbacks?.onBalanceReconciled?.(result.balance);
            break;
          }
          case 'trusted-tier-unlock': {
            const result = await service.unlockTierTrusted(entry.payload.tier, {
              accessToken,
            });
            callbacks?.onBalanceReconciled?.(result.balance);
            callbacks?.onUnlockStateReconciled?.(
              result.unlockedTiers,
              result.unlockedGames
            );
            break;
          }
          case 'trusted-game-unlock': {
            const result = await service.unlockGameTrusted(entry.payload.gameId, {
              accessToken,
            });
            callbacks?.onBalanceReconciled?.(result.balance);
            callbacks?.onUnlockStateReconciled?.(
              result.unlockedTiers,
              result.unlockedGames
            );
            break;
          }
        }

        processed += 1;
        this.remove(entry.id);
      } catch (error) {
        this.markFailure(entry.id, error);
        break;
      }
    }

    return {
      processed,
      remaining: this.queue.length,
    };
  }
}
