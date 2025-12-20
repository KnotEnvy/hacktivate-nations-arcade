import { AudioManager } from '@/services/AudioManager';

// Mock frequency property that allows both getter/setter and Web Audio methods
const createMockFrequency = () => ({
  _value: 440,
  get value() { return this._value; },
  set value(v: number) { this._value = v; },
  setValueAtTime: jest.fn(),
  exponentialRampToValueAtTime: jest.fn(),
  linearRampToValueAtTime: jest.fn(),
});

const createMockGainParam = () => ({
  _value: 1,
  get value() { return this._value; },
  set value(v: number) { this._value = v; },
  setValueAtTime: jest.fn(),
  exponentialRampToValueAtTime: jest.fn(),
  linearRampToValueAtTime: jest.fn(),
});

// Factory to create fresh mock oscillators
const createMockOscillator = () => ({
  connect: jest.fn(),
  start: jest.fn(),
  stop: jest.fn(),
  frequency: createMockFrequency(),
  type: 'sine' as OscillatorType,
  onended: null as any,
});

const createMockGain = () => ({
  connect: jest.fn(),
  gain: createMockGainParam(),
});

const createMockFilter = () => ({
  connect: jest.fn(),
  frequency: createMockFrequency(),
  Q: { value: 1 },
  type: 'lowpass' as BiquadFilterType,
});

const createMockBufferSource = () => ({
  connect: jest.fn(),
  start: jest.fn(),
  stop: jest.fn(),
  buffer: null as AudioBuffer | null,
});

const createMockBuffer = (length: number, sampleRate: number): AudioBuffer => ({
  length,
  duration: length / sampleRate,
  sampleRate,
  numberOfChannels: 1,
  getChannelData: jest.fn(() => new Float32Array(length)),
  copyFromChannel: jest.fn(),
  copyToChannel: jest.fn(),
});

// Tracked creations for test assertions
let oscillatorsCreated = 0;
let gainsCreated = 0;
let bufferSourcesCreated = 0;

const mockAudioContext = {
  createOscillator: jest.fn(() => {
    oscillatorsCreated++;
    return createMockOscillator();
  }),
  createGain: jest.fn(() => {
    gainsCreated++;
    return createMockGain();
  }),
  createBiquadFilter: jest.fn(() => createMockFilter()),
  createBufferSource: jest.fn(() => {
    bufferSourcesCreated++;
    return createMockBufferSource();
  }),
  createBuffer: jest.fn((channels: number, length: number, sampleRate: number) =>
    createMockBuffer(length, sampleRate)
  ),
  currentTime: 0,
  destination: {},
  sampleRate: 44100,
  state: 'suspended' as AudioContextState,
  resume: jest.fn(() => Promise.resolve()),
};

// Mock AudioContext globally
(global as any).AudioContext = jest.fn(() => mockAudioContext);

describe('AudioManager', () => {
  let audioManager: AudioManager;

  beforeEach(() => {
    audioManager = new AudioManager();
    jest.clearAllMocks();
    mockAudioContext.currentTime = 0;
    oscillatorsCreated = 0;
    gainsCreated = 0;
    bufferSourcesCreated = 0;
  });

  describe('initialization', () => {
    test('creates AudioContext on init', async () => {
      await audioManager.init();
      expect(global.AudioContext).toHaveBeenCalled();
    });

    test('handles initialization gracefully when AudioContext fails', async () => {
      (global as any).AudioContext = jest.fn(() => {
        throw new Error('AudioContext not supported');
      });

      const manager = new AudioManager();
      await expect(manager.init()).resolves.not.toThrow();
    });
  });

  describe('sound effects', () => {
    beforeEach(async () => {
      await audioManager.init();
    });

    test('plays coin sound with multiple oscillators for arpeggio', () => {
      audioManager.playSound('coin');

      // Coin sound uses 4 oscillators (3 for arpeggio + 1 sparkle)
      expect(mockAudioContext.createOscillator).toHaveBeenCalled();
      expect(oscillatorsCreated).toBeGreaterThanOrEqual(4);
    });

    test('plays jump sound with pitch sweep', () => {
      audioManager.playSound('jump');

      // Jump uses 2 oscillators with frequency ramps
      expect(mockAudioContext.createOscillator).toHaveBeenCalled();
      expect(oscillatorsCreated).toBeGreaterThanOrEqual(2);
    });

    test('respects mute state', () => {
      audioManager.setMute(true);
      audioManager.playSound('coin');

      // When muted, should not create any oscillators
      expect(oscillatorsCreated).toBe(0);
    });

    test('handles unknown sound effects with fallback', () => {
      expect(() => {
        audioManager.playSound('invalid_sound' as any);
      }).not.toThrow();

      // Fallback sound creates at least 1 oscillator
      expect(oscillatorsCreated).toBeGreaterThanOrEqual(1);
    });

    test('plays collision sound with noise buffer', () => {
      audioManager.playSound('collision');

      // Collision uses noise buffer + oscillator
      expect(mockAudioContext.createBuffer).toHaveBeenCalled();
      expect(mockAudioContext.createBufferSource).toHaveBeenCalled();
    });

    test('plays explosion sound with heavy noise', () => {
      audioManager.playSound('explosion');

      // Explosion uses noise + multiple oscillators
      expect(mockAudioContext.createBuffer).toHaveBeenCalled();
      expect(oscillatorsCreated).toBeGreaterThanOrEqual(2);
    });

    test('plays all new sound types without error', () => {
      const newSounds = ['hit', 'bounce', 'hole', 'splash', 'win', 'laser'] as const;

      newSounds.forEach(sound => {
        expect(() => audioManager.playSound(sound)).not.toThrow();
      });
    });
  });

  describe('background music', () => {
    beforeEach(async () => {
      await audioManager.init();
    });

    test('playMusic does not throw for hub_music', () => {
      expect(() => audioManager.playMusic('hub_music')).not.toThrow();
    });

    test('playMusic does not throw for game_music', () => {
      expect(() => audioManager.playMusic('game_music', 2.0)).not.toThrow();
    });

    test('stopMusic does not throw when no music is playing', () => {
      expect(() => audioManager.stopMusic(0.5)).not.toThrow();
    });

    test('music respects mute state', () => {
      audioManager.setMute(true);
      // Should not throw even when muted
      expect(() => audioManager.playMusic('hub_music')).not.toThrow();
    });
  });

  describe('volume controls', () => {
    beforeEach(async () => {
      await audioManager.init();
    });

    test('sets master volume correctly', () => {
      audioManager.setMasterVolume(0.7);
      expect(audioManager.getMasterVolume()).toBe(0.7);
    });

    test('mutes all audio when mute is enabled', () => {
      audioManager.setMute(true);
      expect(audioManager.isMutedState()).toBe(true);

      // Sounds should not play when muted
      audioManager.playSound('coin');
      expect(oscillatorsCreated).toBe(0);
    });

    test('restores volume when unmuted', () => {
      audioManager.setMasterVolume(0.8);
      audioManager.setMute(true);
      audioManager.setMute(false);

      expect(audioManager.getMasterVolume()).toBe(0.8);
      expect(audioManager.isMutedState()).toBe(false);
    });

    test('clamps volume to valid range', () => {
      audioManager.setMasterVolume(1.5);
      expect(audioManager.getMasterVolume()).toBe(1);

      audioManager.setMasterVolume(-0.5);
      expect(audioManager.getMasterVolume()).toBe(0);
    });
  });

  describe('settings persistence', () => {
    test('saves volume settings to localStorage', () => {
      const setItemSpy = jest.spyOn(localStorage, 'setItem');

      audioManager.setMasterVolume(0.6);

      expect(setItemSpy).toHaveBeenCalledWith('hacktivate-audio-volume', '0.6');
    });

    test('saves mute state to localStorage', () => {
      const setItemSpy = jest.spyOn(localStorage, 'setItem');

      audioManager.setMute(true);

      expect(setItemSpy).toHaveBeenCalledWith('hacktivate-audio-muted', 'true');
    });

    test('sfx volume is independent of master volume', () => {
      audioManager.setSfxVolume(0.5);
      expect(audioManager.getSfxVolume()).toBe(0.5);

      audioManager.setMasterVolume(0.8);
      expect(audioManager.getSfxVolume()).toBe(0.5);
    });

    test('music volume is independent of master volume', () => {
      audioManager.setMusicVolume(0.3);
      expect(audioManager.getMusicVolume()).toBe(0.3);

      audioManager.setMasterVolume(0.9);
      expect(audioManager.getMusicVolume()).toBe(0.3);
    });
  });
});
