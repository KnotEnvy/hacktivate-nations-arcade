// Floodlight's sound vocabulary, with a floor on how often any one cue can
// fire. Six balls ringing off a rail in the same frame is one bounce, not
// six stacked on top of each other.

import type { SoundName } from '@/services/AudioManager';

export interface SoundSink {
  playSound(name: SoundName, options?: { volume?: number }): void;
}

export class Sfx {
  private last = new Map<SoundName, number>();

  constructor(private sink: () => SoundSink | undefined) {}

  /** Play `name` unless it already played within `gap` seconds of `now`. */
  play(name: SoundName, now: number, gap = 0.05, volume?: number): void {
    const prev = this.last.get(name);
    if (prev !== undefined && now - prev < gap && now >= prev) return;
    this.last.set(name, now);
    const sink = this.sink();
    if (!sink) return;
    if (volume === undefined) sink.playSound(name);
    else sink.playSound(name, { volume });
  }

  reset(): void {
    this.last.clear();
  }
}
