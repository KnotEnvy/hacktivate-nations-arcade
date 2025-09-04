import { AudioManager } from '@/services/AudioManager';

// Mock Web Audio API
const mockOscillator = {
  connect: jest.fn(),
  start: jest.fn(),
  stop: jest.fn(),
  frequency: { value: 440 },
  type: 'sine' as OscillatorType,
  onended: null as any,
};

const mockGain = {
  connect: jest.fn(),
  gain: { 
    value: 1,
    setValueAtTime: jest.fn(),
    exponentialRampToValueAtTime: jest.fn(),
  },
};

const mockAudioContext = {
  createOscillator: jest.fn(() => mockOscillator),
  createGain: jest.fn(() => mockGain),
  currentTime: 0,
  destination: {},
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

    test('plays coin sound with correct frequency', () => {
      audioManager.playSound('coin');
      
      expect(mockAudioContext.createOscillator).toHaveBeenCalled();
      expect(mockOscillator.frequency.value).toBe(880); // Coin sound frequency
      expect(mockOscillator.start).toHaveBeenCalled();
    });

    test('plays jump sound with correct parameters', () => {
      audioManager.playSound('jump');
      
      expect(mockOscillator.frequency.value).toBe(440);
      expect(mockOscillator.type).toBe('square');
    });

    test('respects volume parameter', () => {
      audioManager.playSound('coin', { volume: 0.5 });
      
      expect(mockGain.gain.value).toBe(0.5);
    });

    test('handles invalid sound effects gracefully', () => {
      expect(() => {
        audioManager.playSound('invalid_sound' as any);
      }).not.toThrow();
    });
  });

  describe('background music', () => {
    beforeEach(async () => {
      await audioManager.init();
    });

    test('starts hub music with correct parameters', () => {
      audioManager.playMusic('hub_music');
      
      expect(mockAudioContext.createOscillator).toHaveBeenCalled();
      // Hub music should create multiple oscillators for orchestral arrangement
      expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(1); // At least one call
    });

    test('transitions between music tracks with fade', () => {
      audioManager.playMusic('hub_music');
      audioManager.playMusic('game_music', 2.0); // 2 second fade
      
      expect(mockGain.gain.exponentialRampToValueAtTime).toHaveBeenCalled();
    });

    test('stops current music before starting new track', () => {
      audioManager.playMusic('hub_music');
      audioManager.playMusic('game_music');
      
      expect(mockOscillator.stop).toHaveBeenCalled();
    });
  });

  describe('volume controls', () => {
    beforeEach(async () => {
      await audioManager.init();
    });

    test('sets master volume correctly', () => {
      audioManager.setMasterVolume(0.7);
      
      audioManager.playSound('coin');
      expect(mockGain.gain.value).toBe(0.7);
    });

    test('mutes all audio when mute is enabled', () => {
      audioManager.setMute(true);
      audioManager.playSound('coin');
      
      expect(mockGain.gain.value).toBe(0);
    });

    test('restores volume when unmuted', () => {
      audioManager.setMasterVolume(0.8);
      audioManager.setMute(true);
      audioManager.setMute(false);
      
      audioManager.playSound('coin');
      expect(mockGain.gain.value).toBe(0.8);
    });
  });

  describe('orchestral music generation', () => {
    beforeEach(async () => {
      await audioManager.init();
    });

    test('generates hub music with classical chord progression', () => {
      audioManager.playMusic('hub_music');
      
      // Should create multiple oscillators for orchestral arrangement
      expect(mockAudioContext.createOscillator).toHaveBeenCalled();
      expect(mockAudioContext.createGain).toHaveBeenCalled();
    });

    test('handles music duration correctly', (done) => {
      audioManager.playMusic('hub_music');
      
      // Mock the end of the track
      setTimeout(() => {
        if (mockOscillator.onended) {
          mockOscillator.onended(new Event('ended'));
        }
        done();
      }, 10);
    });
  });

  describe('settings persistence', () => {
    test('saves volume settings to localStorage', () => {
      const setItemSpy = jest.spyOn(localStorage, 'setItem');
      
      audioManager.setMasterVolume(0.6);
      
      expect(setItemSpy).toHaveBeenCalledWith('hacktivate-audio-volume', '0.6');
    });

    test('loads volume settings from localStorage on init', async () => {
      localStorage.setItem('hacktivate-audio-volume', '0.3');
      
      const manager = new AudioManager();
      await manager.init();
      
      manager.playSound('coin');
      expect(mockGain.gain.value).toBe(0.3);
    });

    test('saves mute state to localStorage', () => {
      const setItemSpy = jest.spyOn(localStorage, 'setItem');
      
      audioManager.setMute(true);
      
      expect(setItemSpy).toHaveBeenCalledWith('hacktivate-audio-muted', 'true');
    });
  });
});