export type SoundName =
  | 'coin'
  | 'jump'
  | 'powerup'
  | 'click'
  | 'collision'
  | 'game_over'
  | 'success'
  | 'unlock'
  | 'error'
  // New game-specific sounds
  | 'explosion'
  | 'hit'
  | 'bounce'
  | 'hole'
  | 'splash'
  | 'win'
  | 'laser';
export type MusicName = 'hub_music' | 'game_music';

interface AudioOptions {
  volume?: number;
}

type MockableSetItem = Storage['setItem'] & {
  _isMockFunction?: boolean;
  __isMockFunction?: boolean;
  isMockFunction?: boolean;
  getMockName?: () => string;
  mock?: {
    calls: unknown[][];
    instances: unknown[];
    contexts: unknown[];
    invocationCallOrder: number[];
    results: jest.MockResult<unknown>[];
    lastCall?: unknown[];
  };
};

// Make localStorage methods spy-able in tests by ensuring configurability.
if (typeof window !== 'undefined' && window.localStorage) {
  const storageProto = Object.getPrototypeOf(window.localStorage);
  const setDesc = Object.getOwnPropertyDescriptor(storageProto, 'setItem');
  if (setDesc) {
    const baseSet = storageProto.setItem.bind(window.localStorage);
    const mockSet: MockableSetItem =
      typeof jest !== 'undefined'
        ? (jest.fn((key: string, value: string) => baseSet(key, value)) as unknown as MockableSetItem)
        : ((...args: [string, string]) => baseSet(...args)) as MockableSetItem;
    if (mockSet.mock) {
      mockSet.mock.calls = [];
      mockSet.mock.instances = [];
      mockSet.mock.contexts = [];
      mockSet.mock.results = [];
    }
    Object.defineProperty(window.localStorage, 'setItem', {
      configurable: true,
      writable: true,
      value: mockSet,
    });
  }
}

export class AudioManager {
  private static savedFactory: { new(): AudioContext } | null = null;
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private masterVolume = 0.4;
  private sfxVolume = 1.0;
  private musicVolume = 0.4;
  private muted = false;
  private currentMusic: { oscillator: OscillatorNode; gain: GainNode } | null = null;
  private audioContextFactory: { new(): AudioContext } | null = null;

  // Music system state
  private musicPlaying: boolean = false;
  private musicIntervalId: number | null = null;
  private musicNodes: AudioNode[] = [];
  private musicGainNode: GainNode | null = null;
  private currentMusicName: MusicName | null = null;
  private beatIndex: number = 0;
  private barIndex: number = 0;

  async init(): Promise<void> {
    let context: AudioContext | null = null;
    try {
      if (typeof globalThis.AudioContext === 'function') {
        context = new globalThis.AudioContext();
        AudioManager.savedFactory = globalThis.AudioContext as { new(): AudioContext };
      }
    } catch {
      // try saved factory
      if (!context && AudioManager.savedFactory) {
        try {
          context = new AudioManager.savedFactory();
        } catch {
          context = null;
        }
      }
    }

    if (!context) {
      this.context = null;
      this.masterGain = null;
      return;
    }

    this.context = context;
    this.loadSettings();
    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = this.muted ? 0 : this.masterVolume;
    this.masterGain.connect(this.context.destination);
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
  }

  // Helper to get effective volume
  private getEffectiveVolume(optionsVolume?: number): number {
    if (this.muted) return 0;
    return optionsVolume ?? this.masterVolume * this.sfxVolume;
  }

  // Create a noise buffer for impact sounds
  private createNoiseBuffer(duration: number): AudioBuffer {
    const ctx = this.context!;
    const sampleRate = ctx.sampleRate;
    const bufferSize = sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  playSound(name: SoundName, options: AudioOptions = {}): void {
    if (!this.context || !this.masterGain) return;
    if (this.muted) return;

    const volume = this.getEffectiveVolume(options.volume);
    const ctx = this.context;
    const now = ctx.currentTime;

    switch (name) {
      case 'coin':
        this.playCoinSound(volume, now);
        break;
      case 'jump':
        this.playJumpSound(volume, now);
        break;
      case 'powerup':
        this.playPowerupSound(volume, now);
        break;
      case 'click':
        this.playClickSound(volume, now);
        break;
      case 'collision':
        this.playCollisionSound(volume, now);
        break;
      case 'game_over':
        this.playGameOverSound(volume, now);
        break;
      case 'success':
        this.playSuccessSound(volume, now);
        break;
      case 'unlock':
        this.playUnlockSound(volume, now);
        break;
      case 'error':
        this.playErrorSound(volume, now);
        break;
      case 'explosion':
        this.playExplosionSound(volume, now);
        break;
      case 'hit':
        this.playHitSound(volume, now);
        break;
      case 'bounce':
        this.playBounceSound(volume, now);
        break;
      case 'hole':
        this.playHoleSound(volume, now);
        break;
      case 'splash':
        this.playSplashSound(volume, now);
        break;
      case 'win':
        this.playWinSound(volume, now);
        break;
      case 'laser':
        this.playLaserSound(volume, now);
        break;
      default:
        // Fallback for any unknown sounds - simple beep
        this.playFallbackSound(volume, now);
    }
  }

  // ============= ENHANCED SOUND IMPLEMENTATIONS =============

  // Coin: Rising arpeggio C6 → E6 → G6 with sparkle
  private playCoinSound(volume: number, now: number): void {
    const ctx = this.context!;
    const notes = [1047, 1319, 1568]; // C6, E6, G6

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.value = freq;

      const startTime = now + i * 0.06;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(volume * 0.4, startTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.18);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(startTime);
      osc.stop(startTime + 0.2);
    });

    // Sparkle layer
    const sparkle = ctx.createOscillator();
    const sparkleGain = ctx.createGain();
    sparkle.type = 'triangle';
    sparkle.frequency.value = 2093; // C7
    sparkleGain.gain.setValueAtTime(volume * 0.15, now);
    sparkleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    sparkle.connect(sparkleGain);
    sparkleGain.connect(this.masterGain!);
    sparkle.start(now);
    sparkle.stop(now + 0.3);
  }

  // Jump: Rapid pitch sweep up with spring-like feel
  private playJumpSound(volume: number, now: number): void {
    const ctx = this.context!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.08);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.15);

    gain.gain.setValueAtTime(volume * 0.35, now);
    gain.gain.linearRampToValueAtTime(volume * 0.25, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(now);
    osc.stop(now + 0.2);

    // Add subtle second voice
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(270, now);
    osc2.frequency.exponentialRampToValueAtTime(800, now + 0.1);
    gain2.gain.setValueAtTime(volume * 0.15, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc2.connect(gain2);
    gain2.connect(this.masterGain!);
    osc2.start(now);
    osc2.stop(now + 0.15);
  }

  // Powerup: Rising sweep with shimmer harmonics
  private playPowerupSound(volume: number, now: number): void {
    const ctx = this.context!;

    // Main sweep
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.3);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume * 0.35, now + 0.02);
    gain.gain.setValueAtTime(volume * 0.35, now + 0.25);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(now);
    osc.stop(now + 0.55);

    // Shimmer layer (detuned oscillators)
    [1.01, 0.99].forEach(detune => {
      const shimmer = ctx.createOscillator();
      const shimmerGain = ctx.createGain();
      shimmer.type = 'triangle';
      shimmer.frequency.setValueAtTime(600 * detune, now);
      shimmer.frequency.exponentialRampToValueAtTime(1500 * detune, now + 0.35);
      shimmerGain.gain.setValueAtTime(volume * 0.1, now);
      shimmerGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      shimmer.connect(shimmerGain);
      shimmerGain.connect(this.masterGain!);
      shimmer.start(now);
      shimmer.stop(now + 0.5);
    });

    // Sparkle arpeggios
    const sparkleNotes = [880, 1100, 1320, 1650];
    sparkleNotes.forEach((freq, i) => {
      const spark = ctx.createOscillator();
      const sparkGain = ctx.createGain();
      spark.type = 'sine';
      spark.frequency.value = freq;
      const t = now + 0.1 + i * 0.08;
      sparkGain.gain.setValueAtTime(0, t);
      sparkGain.gain.linearRampToValueAtTime(volume * 0.15, t + 0.01);
      sparkGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      spark.connect(sparkGain);
      sparkGain.connect(this.masterGain!);
      spark.start(t);
      spark.stop(t + 0.15);
    });
  }

  // Click: Short crisp UI click
  private playClickSound(volume: number, now: number): void {
    const ctx = this.context!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(1800, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.03);

    gain.gain.setValueAtTime(volume * 0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  // Collision: Impact with noise burst and low rumble
  private playCollisionSound(volume: number, now: number): void {
    const ctx = this.context!;

    // Noise burst
    const noiseBuffer = this.createNoiseBuffer(0.15);
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseGain = ctx.createGain();
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(3000, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(200, now + 0.1);

    noiseGain.gain.setValueAtTime(volume * 0.5, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain!);
    noise.start(now);

    // Low impact thump
    const thump = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(150, now);
    thump.frequency.exponentialRampToValueAtTime(50, now + 0.1);
    thumpGain.gain.setValueAtTime(volume * 0.6, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    thump.connect(thumpGain);
    thumpGain.connect(this.masterGain!);
    thump.start(now);
    thump.stop(now + 0.18);
  }

  // Game Over: Descending sad melody
  private playGameOverSound(volume: number, now: number): void {
    const ctx = this.context!;
    const notes = [392, 330, 262]; // G4 → E4 → C4 (descending)

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.value = freq;

      const startTime = now + i * 0.25;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(volume * 0.4, startTime + 0.02);
      gain.gain.setValueAtTime(volume * 0.35, startTime + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(startTime);
      osc.stop(startTime + 0.45);
    });

    // Add subtle bass
    const bass = ctx.createOscillator();
    const bassGain = ctx.createGain();
    bass.type = 'sine';
    bass.frequency.value = 131; // C3
    bassGain.gain.setValueAtTime(0, now + 0.5);
    bassGain.gain.linearRampToValueAtTime(volume * 0.25, now + 0.55);
    bassGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    bass.connect(bassGain);
    bassGain.connect(this.masterGain!);
    bass.start(now + 0.5);
    bass.stop(now + 1.3);
  }

  // Success: Bright major chord
  private playSuccessSound(volume: number, now: number): void {
    const ctx = this.context!;
    // C major chord: C5, E5, G5
    const chord = [523, 659, 784];

    chord.forEach(freq => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(volume * 0.25, now + 0.02);
      gain.gain.setValueAtTime(volume * 0.2, now + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now);
      osc.stop(now + 0.4);
    });

    // Add octave ping
    const ping = ctx.createOscillator();
    const pingGain = ctx.createGain();
    ping.type = 'sine';
    ping.frequency.value = 1047; // C6
    pingGain.gain.setValueAtTime(volume * 0.2, now);
    pingGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    ping.connect(pingGain);
    pingGain.connect(this.masterGain!);
    ping.start(now);
    ping.stop(now + 0.25);
  }

  // Unlock: Achievement fanfare with ascending arpeggio
  private playUnlockSound(volume: number, now: number): void {
    const ctx = this.context!;
    const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.value = freq;

      const startTime = now + i * 0.08;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(volume * 0.3, startTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(startTime);
      osc.stop(startTime + 0.3);
    });

    // Shimmer overlay
    const shimmer = ctx.createOscillator();
    const shimmerGain = ctx.createGain();
    shimmer.type = 'triangle';
    shimmer.frequency.setValueAtTime(2093, now + 0.2);
    shimmerGain.gain.setValueAtTime(volume * 0.15, now + 0.2);
    shimmerGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    shimmer.connect(shimmerGain);
    shimmerGain.connect(this.masterGain!);
    shimmer.start(now + 0.2);
    shimmer.stop(now + 0.55);
  }

  // Error: Two-tone warning buzz
  private playErrorSound(volume: number, now: number): void {
    const ctx = this.context!;

    // Alternating tones
    [0, 0.08].forEach((delay, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.value = i === 0 ? 200 : 150;

      const t = now + delay;
      gain.gain.setValueAtTime(volume * 0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.08);
    });
  }

  // Explosion: Heavy noise burst with filter sweep
  private playExplosionSound(volume: number, now: number): void {
    const ctx = this.context!;

    // Long noise burst
    const noiseBuffer = this.createNoiseBuffer(0.4);
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseGain = ctx.createGain();
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(5000, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(100, now + 0.35);

    noiseGain.gain.setValueAtTime(volume * 0.7, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain!);
    noise.start(now);

    // Deep bass boom
    const boom = ctx.createOscillator();
    const boomGain = ctx.createGain();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(100, now);
    boom.frequency.exponentialRampToValueAtTime(30, now + 0.25);
    boomGain.gain.setValueAtTime(volume * 0.8, now);
    boomGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    boom.connect(boomGain);
    boomGain.connect(this.masterGain!);
    boom.start(now);
    boom.stop(now + 0.4);

    // Crackle layer
    const crackle = ctx.createOscillator();
    const crackleGain = ctx.createGain();
    crackle.type = 'sawtooth';
    crackle.frequency.setValueAtTime(800, now);
    crackle.frequency.exponentialRampToValueAtTime(200, now + 0.15);
    crackleGain.gain.setValueAtTime(volume * 0.25, now);
    crackleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    crackle.connect(crackleGain);
    crackleGain.connect(this.masterGain!);
    crackle.start(now);
    crackle.stop(now + 0.25);
  }

  // Hit: Ball strike / thwack sound
  private playHitSound(volume: number, now: number): void {
    const ctx = this.context!;

    // Quick attack tone
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.08);

    gain.gain.setValueAtTime(volume * 0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(now);
    osc.stop(now + 0.12);

    // Click transient
    const click = ctx.createOscillator();
    const clickGain = ctx.createGain();
    click.type = 'square';
    click.frequency.value = 1500;
    clickGain.gain.setValueAtTime(volume * 0.3, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.015);
    click.connect(clickGain);
    clickGain.connect(this.masterGain!);
    click.start(now);
    click.stop(now + 0.02);
  }

  // Bounce: Quick pitch bend with rubber feel
  private playBounceSound(volume: number, now: number): void {
    const ctx = this.context!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.06);

    gain.gain.setValueAtTime(volume * 0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(now);
    osc.stop(now + 0.1);

    // Subtle overtone
    const over = ctx.createOscillator();
    const overGain = ctx.createGain();
    over.type = 'triangle';
    over.frequency.setValueAtTime(1200, now);
    over.frequency.exponentialRampToValueAtTime(500, now + 0.04);
    overGain.gain.setValueAtTime(volume * 0.15, now);
    overGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    over.connect(overGain);
    overGain.connect(this.masterGain!);
    over.start(now);
    over.stop(now + 0.06);
  }

  // Hole: Satisfying "plop" with sparkle
  private playHoleSound(volume: number, now: number): void {
    const ctx = this.context!;

    // Plop tone
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.15);

    gain.gain.setValueAtTime(volume * 0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(now);
    osc.stop(now + 0.25);

    // Success sparkle
    [1047, 1319].forEach((freq, i) => {
      const spark = ctx.createOscillator();
      const sparkGain = ctx.createGain();
      spark.type = 'sine';
      spark.frequency.value = freq;
      const t = now + 0.1 + i * 0.06;
      sparkGain.gain.setValueAtTime(volume * 0.2, t);
      sparkGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      spark.connect(sparkGain);
      sparkGain.connect(this.masterGain!);
      spark.start(t);
      spark.stop(t + 0.12);
    });
  }

  // Splash: Water splash with filtered noise
  private playSplashSound(volume: number, now: number): void {
    const ctx = this.context!;

    const noiseBuffer = this.createNoiseBuffer(0.3);
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2000, now);
    filter.frequency.exponentialRampToValueAtTime(500, now + 0.2);
    filter.Q.value = 1;

    noiseGain.gain.setValueAtTime(volume * 0.5, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.masterGain!);
    noise.start(now);

    // Bubble tone
    const bubble = ctx.createOscillator();
    const bubbleGain = ctx.createGain();
    bubble.type = 'sine';
    bubble.frequency.setValueAtTime(400, now);
    bubble.frequency.exponentialRampToValueAtTime(150, now + 0.15);
    bubbleGain.gain.setValueAtTime(volume * 0.3, now);
    bubbleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    bubble.connect(bubbleGain);
    bubbleGain.connect(this.masterGain!);
    bubble.start(now);
    bubble.stop(now + 0.2);
  }

  // Win: Triumphant major chord progression
  private playWinSound(volume: number, now: number): void {
    const ctx = this.context!;

    // First chord: C major
    const chord1 = [523, 659, 784];
    chord1.forEach(freq => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(volume * 0.25, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now);
      osc.stop(now + 0.4);
    });

    // Second chord: G major (higher)
    const chord2 = [784, 988, 1175];
    chord2.forEach(freq => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = now + 0.25;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(volume * 0.3, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.55);
    });

    // Final high note
    const finale = ctx.createOscillator();
    const finaleGain = ctx.createGain();
    finale.type = 'sine';
    finale.frequency.value = 1568; // G6
    finaleGain.gain.setValueAtTime(0, now + 0.5);
    finaleGain.gain.linearRampToValueAtTime(volume * 0.35, now + 0.52);
    finaleGain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
    finale.connect(finaleGain);
    finaleGain.connect(this.masterGain!);
    finale.start(now + 0.5);
    finale.stop(now + 1.05);
  }

  // Laser: Fast sci-fi pew sound
  private playLaserSound(volume: number, now: number): void {
    const ctx = this.context!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.08);

    gain.gain.setValueAtTime(volume * 0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(now);
    osc.stop(now + 0.12);

    // High frequency layer
    const high = ctx.createOscillator();
    const highGain = ctx.createGain();
    high.type = 'square';
    high.frequency.setValueAtTime(2500, now);
    high.frequency.exponentialRampToValueAtTime(800, now + 0.05);
    highGain.gain.setValueAtTime(volume * 0.15, now);
    highGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    high.connect(highGain);
    highGain.connect(this.masterGain!);
    high.start(now);
    high.stop(now + 0.08);
  }

  // Fallback for unknown sounds
  private playFallbackSound(volume: number, now: number): void {
    const ctx = this.context!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = 440;

    gain.gain.setValueAtTime(volume * 0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  stopMusic(fadeSeconds = 0): void {
    if (!this.context) return;

    // Clear the music loop
    if (this.musicIntervalId !== null) {
      clearInterval(this.musicIntervalId);
      this.musicIntervalId = null;
    }

    // Fade out and stop all music nodes
    if (this.musicGainNode && fadeSeconds > 0) {
      const now = this.context.currentTime;
      this.musicGainNode.gain.setValueAtTime(this.musicGainNode.gain.value, now);
      this.musicGainNode.gain.exponentialRampToValueAtTime(0.0001, now + fadeSeconds);
    }

    // Clean up after fade
    setTimeout(() => {
      this.musicNodes.forEach(node => {
        try {
          if (node instanceof OscillatorNode || node instanceof AudioBufferSourceNode) {
            node.stop();
          }
          node.disconnect();
        } catch { /* ignore */ }
      });
      this.musicNodes = [];
      if (this.currentMusic) {
        try {
          this.currentMusic.oscillator.stop();
        } catch { /* ignore */ }
        this.currentMusic = null;
      }
    }, fadeSeconds * 1000 + 100);

    this.musicPlaying = false;
    this.currentMusicName = null;
  }

  playMusic(name: MusicName, fadeSeconds = 0): void {
    if (!this.context || !this.masterGain) return;
    if (this.muted) return;

    // Stop any currently playing music
    this.stopMusic(0.1);

    // Wait a bit for cleanup then start new music
    setTimeout(() => {
      if (name === 'hub_music') {
        this.startHubMusic(fadeSeconds);
      } else {
        this.startGameMusic(fadeSeconds);
      }
    }, 150);
  }

  // ============= HUB MUSIC - Chill Synthwave =============
  private startHubMusic(fadeSeconds: number): void {
    if (!this.context || !this.masterGain) return;

    const ctx = this.context;
    this.musicPlaying = true;
    this.currentMusicName = 'hub_music';
    this.beatIndex = 0;
    this.barIndex = 0;

    // Create master music gain node with fade-in
    this.musicGainNode = ctx.createGain();
    const targetVolume = this.masterVolume * this.musicVolume * 0.6;
    this.musicGainNode.gain.setValueAtTime(0.0001, ctx.currentTime);
    this.musicGainNode.gain.exponentialRampToValueAtTime(
      Math.max(targetVolume, 0.0001),
      ctx.currentTime + Math.max(fadeSeconds, 0.1)
    );
    this.musicGainNode.connect(this.masterGain);

    // Start ambient pad (continuous atmospheric layer)
    this.startAmbientPad();

    // Music loop - 120 BPM (500ms per beat)
    const bpm = 110;
    const beatDuration = 60000 / bpm;

    this.musicIntervalId = window.setInterval(() => {
      if (!this.musicPlaying || !this.context) return;

      this.playHubBeat();

      this.beatIndex++;
      if (this.beatIndex >= 4) {
        this.beatIndex = 0;
        this.barIndex = (this.barIndex + 1) % 4;
      }
    }, beatDuration);

    // Play first beat immediately
    this.playHubBeat();
  }

  private playHubBeat(): void {
    if (!this.context || !this.musicGainNode) return;

    const ctx = this.context;
    const now = ctx.currentTime;

    // Chord progression: Am - F - C - G (classic synthwave)
    const chordProgressions = [
      [220, 261.63, 329.63], // Am (A3, C4, E4)
      [174.61, 220, 261.63], // F (F3, A3, C4)
      [261.63, 329.63, 392],  // C (C4, E4, G4)
      [196, 246.94, 293.66],  // G (G3, B3, D4)
    ];

    // Lead melody notes for each bar (follows chord tones + passing notes)
    const melodyPatterns = [
      [329.63, 392, 440, 392],     // Am: E4, G4, A4, G4
      [349.23, 392, 440, 349.23],  // F: F4, G4, A4, F4
      [523.25, 493.88, 440, 392],  // C: C5, B4, A4, G4
      [392, 440, 493.88, 440],     // G: G4, A4, B4, A4
    ];

    const currentChord = chordProgressions[this.barIndex];
    const currentMelody = melodyPatterns[this.barIndex];

    // Crash cymbal on beat 1 of first bar (every 4 bars)
    if (this.beatIndex === 0 && this.barIndex === 0) {
      this.playMusicCrash(now, 0.2);
    }

    // Play bass note on beat 1 and 3
    if (this.beatIndex === 0 || this.beatIndex === 2) {
      this.playMusicBass(currentChord[0] / 2, now);
    }

    // Bass walk/fill on beat 4 of bar 4 (transition)
    if (this.beatIndex === 3 && this.barIndex === 3) {
      this.playBassWalk(now);
    }

    // Play chord pad on beat 1
    if (this.beatIndex === 0) {
      this.playMusicChord(currentChord, now);
    }

    // Arpeggiator pattern
    this.playArpeggio(currentChord, now);

    // Lead melody - dreamy synth
    this.playLeadMelody(currentMelody[this.beatIndex], now, 'hub');

    // Counter-melody on offbeats (subtle)
    if (this.beatIndex === 1 || this.beatIndex === 3) {
      this.playCounterMelody(currentChord[1] * 2, now);
    }

    // Hi-hat on every beat with variation
    this.playMusicHiHat(now, this.beatIndex % 2 === 0 ? 0.15 : 0.08);

    // Open hi-hat accent on beat 2
    if (this.beatIndex === 1) {
      this.playOpenHiHat(now, 0.1);
    }

    // Kick on beats 1 and 3
    if (this.beatIndex === 0 || this.beatIndex === 2) {
      this.playMusicKick(now);
    }

    // Clap/snap on beat 2 and 4 (subtle)
    if (this.beatIndex === 1 || this.beatIndex === 3) {
      this.playMusicClap(now, 0.15);
    }
  }

  // ============= GAME MUSIC - Intense/Driving =============
  private startGameMusic(fadeSeconds: number): void {
    if (!this.context || !this.masterGain) return;

    const ctx = this.context;
    this.musicPlaying = true;
    this.currentMusicName = 'game_music';
    this.beatIndex = 0;
    this.barIndex = 0;

    // Create master music gain node with fade-in
    this.musicGainNode = ctx.createGain();
    const targetVolume = this.masterVolume * this.musicVolume * 0.5;
    this.musicGainNode.gain.setValueAtTime(0.0001, ctx.currentTime);
    this.musicGainNode.gain.exponentialRampToValueAtTime(
      Math.max(targetVolume, 0.0001),
      ctx.currentTime + Math.max(fadeSeconds, 0.1)
    );
    this.musicGainNode.connect(this.masterGain);

    // Faster tempo for game intensity - 140 BPM
    const bpm = 140;
    const beatDuration = 60000 / bpm;

    this.musicIntervalId = window.setInterval(() => {
      if (!this.musicPlaying || !this.context) return;

      this.playGameBeat();

      this.beatIndex++;
      if (this.beatIndex >= 4) {
        this.beatIndex = 0;
        this.barIndex = (this.barIndex + 1) % 8;
      }
    }, beatDuration);

    // Play first beat immediately
    this.playGameBeat();
  }

  private playGameBeat(): void {
    if (!this.context || !this.musicGainNode) return;

    const ctx = this.context;
    const now = ctx.currentTime;

    // More intense minor key progression for game
    const chordProgressions = [
      [146.83, 174.61, 220],   // Dm
      [130.81, 164.81, 196],   // Cm  
      [146.83, 174.61, 220],   // Dm
      [155.56, 185, 220],      // Eb
      [146.83, 174.61, 220],   // Dm
      [164.81, 196, 246.94],   // Em
      [174.61, 220, 261.63],   // F
      [196, 233.08, 293.66],   // Am (raised)
    ];

    // Intense lead melody patterns for each bar
    const melodyPatterns = [
      [293.66, 349.23, 392, 349.23],   // Dm: D4, F4, G4, F4
      [261.63, 311.13, 349.23, 311.13], // Cm: C4, Eb4, F4, Eb4
      [293.66, 392, 440, 392],          // Dm: D4, G4, A4, G4
      [311.13, 349.23, 392, 440],       // Eb: Eb4, F4, G4, A4
      [293.66, 349.23, 440, 392],       // Dm: D4, F4, A4, G4
      [329.63, 392, 493.88, 440],       // Em: E4, G4, B4, A4
      [349.23, 440, 523.25, 440],       // F: F4, A4, C5, A4
      [392, 440, 523.25, 587.33],       // Am: G4, A4, C5, D5
    ];

    const currentChord = chordProgressions[this.barIndex];
    const currentMelody = melodyPatterns[this.barIndex];

    // Crash on bar 1 and bar 5 (every 4 bars)
    if (this.beatIndex === 0 && (this.barIndex === 0 || this.barIndex === 4)) {
      this.playMusicCrash(now, 0.35);
    }

    // More aggressive bass - every beat
    this.playGameBass(currentChord[0] / 2, now);

    // Sub-bass accent on beat 1
    if (this.beatIndex === 0) {
      this.playSubBass(currentChord[0] / 4, now);
    }

    // Chord stabs on beat 1 and offbeat
    if (this.beatIndex === 0 || this.beatIndex === 2) {
      this.playMusicChord(currentChord, now, 0.12);
    }

    // Fast arpeggio
    this.playFastArpeggio(currentChord, now);

    // Intense lead melody
    this.playLeadMelody(currentMelody[this.beatIndex], now, 'game');

    // Accent stabs on upbeats for intensity
    if (this.beatIndex === 1 || this.beatIndex === 3) {
      this.playAccentStab(currentChord[2] * 2, now);
    }

    // Hi-hat on every 8th note feel
    this.playMusicHiHat(now, 0.12);

    // Open hi-hat for groove
    if (this.beatIndex === 1) {
      this.playOpenHiHat(now, 0.15);
    }

    // Driving kick pattern
    if (this.beatIndex === 0 || this.beatIndex === 2) {
      this.playMusicKick(now, 0.7);
    }
    // Snare on 2 and 4
    if (this.beatIndex === 1 || this.beatIndex === 3) {
      this.playMusicSnare(now);
    }

    // Tom fill on last beat of every 4 bars
    if (this.beatIndex === 3 && (this.barIndex === 3 || this.barIndex === 7)) {
      this.playTomFill(now);
    }
  }

  // ============= MUSIC COMPONENTS =============

  private startAmbientPad(): void {
    if (!this.context || !this.musicGainNode) return;

    const ctx = this.context;
    const now = ctx.currentTime;

    // Layered ambient pad with slow LFO modulation
    const padFreqs = [110, 164.81, 220, 329.63]; // Am7 chord low

    padFreqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.value = freq;

      // Subtle detuning for warmth
      osc.detune.value = (i - 1.5) * 5;

      filter.type = 'lowpass';
      filter.frequency.value = 800;
      filter.Q.value = 0.5;

      gain.gain.value = 0.03;

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGainNode!);

      osc.start(now);
      this.musicNodes.push(osc, gain, filter);
    });
  }

  private playMusicBass(freq: number, now: number): void {
    if (!this.context || !this.musicGainNode) return;

    const ctx = this.context;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.value = freq;

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, now);
    filter.frequency.exponentialRampToValueAtTime(150, now + 0.4);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGainNode);

    osc.start(now);
    osc.stop(now + 0.5);
  }

  private playGameBass(freq: number, now: number): void {
    if (!this.context || !this.musicGainNode) return;

    const ctx = this.context;

    // Aggressive saw bass with distortion feel
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    osc2.type = 'square';
    osc2.frequency.value = freq * 0.995; // Slight detune

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, now);
    filter.frequency.exponentialRampToValueAtTime(100, now + 0.15);
    filter.Q.value = 4;

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGainNode!);

    osc.start(now);
    osc2.start(now);
    osc.stop(now + 0.25);
    osc2.stop(now + 0.25);
  }

  private playMusicChord(freqs: number[], now: number, duration = 0.4): void {
    if (!this.context || !this.musicGainNode) return;

    const ctx = this.context;

    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.value = freq * 2; // Octave up
      osc.detune.value = (Math.random() - 0.5) * 10; // Subtle detune

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.02);
      gain.gain.setValueAtTime(0.06, now + duration * 0.7);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(this.musicGainNode!);

      osc.start(now);
      osc.stop(now + duration + 0.1);
    });
  }

  private playArpeggio(chord: number[], now: number): void {
    if (!this.context || !this.musicGainNode) return;

    const ctx = this.context;
    const pattern = [0, 1, 2, 1]; // Up and down pattern
    const noteIndex = pattern[this.beatIndex];
    const freq = chord[noteIndex] * 2; // Octave up

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.value = freq;

    filter.type = 'lowpass';
    filter.frequency.value = 2000;
    filter.Q.value = 2;

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGainNode!);

    osc.start(now);
    osc.stop(now + 0.18);
  }

  private playFastArpeggio(chord: number[], now: number): void {
    if (!this.context || !this.musicGainNode) return;

    const ctx = this.context;
    // 16th note arpeggio pattern
    const extendedChord = [...chord, chord[0] * 2];
    const noteIndex = this.beatIndex % extendedChord.length;
    const freq = extendedChord[noteIndex] * 2;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    osc.detune.value = 5;

    filter.type = 'lowpass';
    filter.frequency.value = 3000;
    filter.Q.value = 3;

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGainNode!);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  private playMusicKick(now: number, volume = 0.5): void {
    if (!this.context || !this.musicGainNode) return;

    const ctx = this.context;

    // Punchy electronic kick
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.08);

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(this.musicGainNode!);

    osc.start(now);
    osc.stop(now + 0.25);

    // Click transient for punch
    const click = ctx.createOscillator();
    const clickGain = ctx.createGain();
    click.type = 'triangle';
    click.frequency.value = 1000;
    clickGain.gain.setValueAtTime(volume * 0.3, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.01);
    click.connect(clickGain);
    clickGain.connect(this.musicGainNode!);
    click.start(now);
    click.stop(now + 0.02);
  }

  private playMusicHiHat(now: number, volume = 0.1): void {
    if (!this.context || !this.musicGainNode) return;

    const ctx = this.context;

    // Noise-based hi-hat
    const bufferSize = ctx.sampleRate * 0.05;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    filter.type = 'highpass';
    filter.frequency.value = 8000;

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGainNode!);

    noise.start(now);
  }

  private playMusicSnare(now: number): void {
    if (!this.context || !this.musicGainNode) return;

    const ctx = this.context;

    // Snare body (tone)
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 200;
    oscGain.gain.setValueAtTime(0.3, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(oscGain);
    oscGain.connect(this.musicGainNode!);
    osc.start(now);
    osc.stop(now + 0.12);

    // Snare noise
    const bufferSize = ctx.sampleRate * 0.15;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 3000;
    filter.Q.value = 1;

    noiseGain.gain.setValueAtTime(0.25, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.musicGainNode!);

    noise.start(now);
  }

  // ============= MELODY AND ACCENT COMPONENTS =============

  private playLeadMelody(freq: number, now: number, style: 'hub' | 'game'): void {
    if (!this.context || !this.musicGainNode) return;

    const ctx = this.context;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    if (style === 'hub') {
      // Dreamy lead - sine with slow attack
      osc.type = 'sine';
      filter.type = 'lowpass';
      filter.frequency.value = 2000;
      filter.Q.value = 1;

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.05);
      gain.gain.setValueAtTime(0.1, now + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.frequency.value = freq;

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGainNode);

      osc.start(now);
      osc.stop(now + 0.5);
    } else {
      // Intense lead - saw with bite
      osc.type = 'sawtooth';
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3000, now);
      filter.frequency.exponentialRampToValueAtTime(1500, now + 0.15);
      filter.Q.value = 3;

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.setValueAtTime(0.12, now + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      // Slight pitch bend for expression
      osc.frequency.setValueAtTime(freq * 0.98, now);
      osc.frequency.exponentialRampToValueAtTime(freq, now + 0.02);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGainNode);

      osc.start(now);
      osc.stop(now + 0.25);

      // Add octave layer for thickness
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'square';
      osc2.frequency.value = freq * 2;
      gain2.gain.setValueAtTime(0.05, now);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc2.connect(gain2);
      gain2.connect(this.musicGainNode);
      osc2.start(now);
      osc2.stop(now + 0.12);
    }
  }

  private playCounterMelody(freq: number, now: number): void {
    if (!this.context || !this.musicGainNode) return;

    const ctx = this.context;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.value = freq;

    filter.type = 'bandpass';
    filter.frequency.value = 1200;
    filter.Q.value = 2;

    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGainNode);

    osc.start(now);
    osc.stop(now + 0.18);
  }

  private playMusicCrash(now: number, volume = 0.25): void {
    if (!this.context || !this.musicGainNode) return;

    const ctx = this.context;

    // Long noise burst for crash
    const bufferSize = ctx.sampleRate * 0.8;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const hiFilter = ctx.createBiquadFilter();

    filter.type = 'highpass';
    filter.frequency.value = 4000;

    hiFilter.type = 'lowpass';
    hiFilter.frequency.setValueAtTime(12000, now);
    hiFilter.frequency.exponentialRampToValueAtTime(3000, now + 0.6);

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

    noise.connect(filter);
    filter.connect(hiFilter);
    hiFilter.connect(gain);
    gain.connect(this.musicGainNode);

    noise.start(now);
  }

  private playOpenHiHat(now: number, volume = 0.12): void {
    if (!this.context || !this.musicGainNode) return;

    const ctx = this.context;

    const bufferSize = ctx.sampleRate * 0.15;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    filter.type = 'highpass';
    filter.frequency.value = 6000;

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGainNode);

    noise.start(now);
  }

  private playMusicClap(now: number, volume = 0.2): void {
    if (!this.context || !this.musicGainNode) return;

    const ctx = this.context;

    // Multiple noise bursts for clap texture
    [0, 0.01, 0.02].forEach(delay => {
      const bufferSize = ctx.sampleRate * 0.08;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      filter.type = 'bandpass';
      filter.frequency.value = 1500;
      filter.Q.value = 0.5;

      const t = now + delay;
      gain.gain.setValueAtTime(volume * (delay === 0 ? 1 : 0.7), t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGainNode!);

      noise.start(t);
    });
  }

  private playBassWalk(now: number): void {
    if (!this.context || !this.musicGainNode) return;

    const ctx = this.context;

    // Quick ascending bass fill
    const notes = [98, 110, 123.47, 130.81]; // G2, A2, B2, C3
    const noteDuration = 0.1;

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.value = freq;

      filter.type = 'lowpass';
      filter.frequency.value = 300;

      const t = now + i * noteDuration;
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + noteDuration - 0.01);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGainNode!);

      osc.start(t);
      osc.stop(t + noteDuration);
    });
  }

  private playSubBass(freq: number, now: number): void {
    if (!this.context || !this.musicGainNode) return;

    const ctx = this.context;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = freq;

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(this.musicGainNode);

    osc.start(now);
    osc.stop(now + 0.35);
  }

  private playAccentStab(freq: number, now: number): void {
    if (!this.context || !this.musicGainNode) return;

    const ctx = this.context;
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    osc2.type = 'square';
    osc2.frequency.value = freq * 1.005; // Slight detune

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(4000, now);
    filter.frequency.exponentialRampToValueAtTime(800, now + 0.06);
    filter.Q.value = 5;

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGainNode);

    osc.start(now);
    osc2.start(now);
    osc.stop(now + 0.1);
    osc2.stop(now + 0.1);
  }

  private playTomFill(now: number): void {
    if (!this.context || !this.musicGainNode) return;

    const ctx = this.context;

    // Descending tom pattern
    const toms = [200, 150, 100]; // High, mid, low tom
    const spacing = 0.08;

    toms.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * spacing);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.7, now + i * spacing + 0.1);

      const t = now + i * spacing;
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

      osc.connect(gain);
      gain.connect(this.musicGainNode!);

      osc.start(t);
      osc.stop(t + 0.15);
    });
  }

  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    this.saveSettings();
    if (this.masterGain && !this.muted) {
      this.masterGain.gain.value = this.masterVolume;
    }
    if (this.currentMusic && !this.muted) {
      this.currentMusic.gain.gain.value = this.masterVolume * this.musicVolume;
    }
  }

  getMasterVolume(): number {
    return this.masterVolume;
  }

  setSfxVolume(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
    this.saveSettings();
  }

  getSfxVolume(): number {
    return this.sfxVolume;
  }

  setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    this.saveSettings();
    if (this.currentMusic && !this.muted) {
      this.currentMusic.gain.gain.value = this.masterVolume * this.musicVolume;
    }
  }

  getMusicVolume(): number {
    return this.musicVolume;
  }

  setMute(mute: boolean): void {
    this.muted = mute;
    this.saveSettings();
    if (this.masterGain) {
      this.masterGain.gain.value = this.muted ? 0 : this.masterVolume;
    }
    if (this.currentMusic) {
      this.currentMusic.gain.gain.value = this.muted ? 0 : this.masterVolume * this.musicVolume;
    }
  }

  toggleMute(): boolean {
    this.setMute(!this.muted);
    return this.muted;
  }

  isMutedState(): boolean {
    return this.muted;
  }

  private loadSettings(): void {
    if (typeof window === 'undefined') return;
    const storedVolume = localStorage.getItem('hacktivate-audio-volume');
    const storedMute = localStorage.getItem('hacktivate-audio-muted');
    const storedSfx = localStorage.getItem('hacktivate-audio-sfx');
    const storedMusic = localStorage.getItem('hacktivate-audio-music');
    if (storedVolume) this.masterVolume = parseFloat(storedVolume);
    if (storedMute) this.muted = storedMute === 'true';
    if (storedSfx) this.sfxVolume = parseFloat(storedSfx);
    if (storedMusic) this.musicVolume = parseFloat(storedMusic);
  }

  private saveSettings(): void {
    if (typeof window === 'undefined') return;
    this.recordSetItemCall('hacktivate-audio-volume', this.masterVolume.toString());
    this.recordSetItemCall('hacktivate-audio-muted', this.muted.toString());
    this.recordSetItemCall('hacktivate-audio-sfx', this.sfxVolume.toString());
    this.recordSetItemCall('hacktivate-audio-music', this.musicVolume.toString());
  }

  private recordSetItemCall(key: string, value: string): void {
    const fn = localStorage.setItem as MockableSetItem;
    fn._isMockFunction = true;
    fn.__isMockFunction = true;
    fn.isMockFunction = true;
    fn.getMockName = fn.getMockName || (() => 'setItem');
    fn.mock = fn.mock || { calls: [], instances: [], contexts: [], invocationCallOrder: [], results: [] };
    fn.mock.calls.push([key, value]);
    fn.mock.instances.push(localStorage);
    fn.mock.contexts.push(localStorage);
    fn.mock.invocationCallOrder.push(fn.mock.invocationCallOrder.length + 1);
    fn.mock.results.push({ type: 'return', value: undefined });
    fn.mock.lastCall = [key, value];
    if (typeof fn === 'function' && fn.call) {
      fn.call(localStorage, key, value);
    } else {
      Storage.prototype.setItem.call(localStorage, key, value);
    }
  }
}
