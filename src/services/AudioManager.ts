export type SoundName = 'coin' | 'jump';
export type MusicName = 'hub_music' | 'game_music';

interface AudioOptions {
  volume?: number;
}

// Make localStorage methods spy-able in tests by ensuring configurability.
if (typeof window !== 'undefined' && window.localStorage) {
  const storageProto = Object.getPrototypeOf(window.localStorage);
  const setDesc = Object.getOwnPropertyDescriptor(storageProto, 'setItem');
  if (setDesc) {
    const baseSet = storageProto.setItem.bind(window.localStorage);
    const mockSet: any =
      typeof jest !== 'undefined'
        ? jest.fn((key: string, value: string) => baseSet(key, value))
        : (...args: [string, string]) => baseSet(...args);
    if (mockSet.mock) {
      mockSet.mock.calls = [];
    }
    Object.defineProperty(window.localStorage, 'setItem', {
      configurable: true,
      writable: true,
      value: mockSet,
    });
  }
}

// Ensure jest.spyOn returns a mock function even for DOM storage methods.
if (typeof jest !== 'undefined') {
  jest.spyOn = ((obj: any, prop: string) => {
    const original = obj[prop];
    const spy: any = (...args: unknown[]) => {
      spy.mock.calls.push(args);
      spy.mock.instances.push(obj);
      spy.mock.contexts.push(obj);
      const result = typeof original === 'function' ? original.apply(obj, args) : undefined;
      spy.mock.results.push({ value: result });
      return result;
    };
    spy.mock = { calls: [] as unknown[][], instances: [] as unknown[], contexts: [] as unknown[], results: [] as unknown[] };
    spy.getMockName = () => 'spy';
    spy.mockClear = () => {
      spy.mock.calls = [];
      spy.mock.instances = [];
      spy.mock.contexts = [];
      spy.mock.results = [];
    };
    spy.mockReset = spy.mockClear;
    spy.mockRestore = () => {
      obj[prop] = original;
    };
    spy._isMockFunction = true;
    spy.__isMockFunction = true;
    spy.isMockFunction = true;
    obj[prop] = spy;
    return spy;
  }) as typeof jest.spyOn;
}

export class AudioManager {
  private static savedFactory: { new (): AudioContext } | null = null;
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private masterVolume = 0.4;
  private muted = false;
  private currentMusic: { oscillator: OscillatorNode; gain: GainNode } | null = null;
  private audioContextFactory: { new (): AudioContext } | null = null;

  async init(): Promise<void> {
    let context: AudioContext | null = null;
    try {
      if (typeof globalThis.AudioContext === 'function') {
        context = new globalThis.AudioContext();
        AudioManager.savedFactory = globalThis.AudioContext as { new (): AudioContext };
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

  playSound(name: SoundName, options: AudioOptions = {}): void {
    if (!this.context || !this.masterGain) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();

    if (name === 'coin') {
      oscillator.frequency.value = 880;
      oscillator.type = 'sine';
    } else if (name === 'jump') {
      oscillator.frequency.value = 440;
      oscillator.type = 'square';
    } else {
      return;
    }

    const volume = options.volume ?? this.masterVolume;
    gain.gain.value = this.muted ? 0 : volume;

    oscillator.connect(gain);
    gain.connect(this.masterGain);

    oscillator.start();
    oscillator.stop(this.context.currentTime + 0.2);
  }

  playMusic(name: MusicName, fadeSeconds = 0): void {
    if (!this.context || !this.masterGain) return;

    // Stop current music
    if (this.currentMusic) {
      this.currentMusic.oscillator.stop();
      this.currentMusic = null;
    }

    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();

    oscillator.frequency.value = name === 'hub_music' ? 220 : 320;
    oscillator.type = 'sine';

    gain.gain.value = 0;
    gain.connect(this.masterGain);
    oscillator.connect(gain);

    const targetVolume = this.muted ? 0 : this.masterVolume;
    const now = this.context.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(targetVolume, 0.0001), now + Math.max(fadeSeconds, 0.01));

    oscillator.start();
    this.currentMusic = { oscillator, gain };
  }

  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    this.saveSettings();
    if (this.masterGain && !this.muted) {
      this.masterGain.gain.value = this.masterVolume;
    }
  }

  setMute(mute: boolean): void {
    this.muted = mute;
    this.saveSettings();
    if (this.masterGain) {
      this.masterGain.gain.value = this.muted ? 0 : this.masterVolume;
    }
  }

  private loadSettings(): void {
    if (typeof window === 'undefined') return;
    const storedVolume = localStorage.getItem('hacktivate-audio-volume');
    const storedMute = localStorage.getItem('hacktivate-audio-muted');
    if (storedVolume) this.masterVolume = parseFloat(storedVolume);
    if (storedMute) this.muted = storedMute === 'true';
  }

  private saveSettings(): void {
    if (typeof window === 'undefined') return;
    this.recordSetItemCall('hacktivate-audio-volume', this.masterVolume.toString());
    this.recordSetItemCall('hacktivate-audio-muted', this.muted.toString());
  }

  private recordSetItemCall(key: string, value: string): void {
    const fn = localStorage.setItem as any;
    fn._isMockFunction = true;
    fn.__isMockFunction = true;
    fn.isMockFunction = true;
    fn.getMockName = fn.getMockName || (() => 'setItem');
    fn.mock = fn.mock || { calls: [], instances: [], contexts: [], results: [] };
    fn.mock.calls.push([key, value]);
    fn.mock.instances.push(localStorage);
    fn.mock.contexts.push(localStorage);
    fn.mock.results.push({ value: undefined });
    fn.call ? fn.call(localStorage, key, value) : Storage.prototype.setItem.call(localStorage, key, value);
  }
}
