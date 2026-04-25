import { ProceduralMusicEngine } from '@/services/ProceduralMusicEngine';

const createMockAudioParam = (value = 0) => ({
  value,
  setValueAtTime: jest.fn(),
  setTargetAtTime: jest.fn(),
  linearRampToValueAtTime: jest.fn(),
  exponentialRampToValueAtTime: jest.fn(),
});

type MockAudioNode = AudioNode & {
  connect: jest.Mock;
  disconnect: jest.Mock;
};

const createMockNode = <T extends object>(extra?: T): MockAudioNode & T => ({
  connect: jest.fn(),
  disconnect: jest.fn(),
  ...(extra ?? {} as T),
} as MockAudioNode & T);

const createMockAudioContext = () => {
  const dynamicsNodes: MockAudioNode[] = [];

  const context = {
    currentTime: 0,
    sampleRate: 44100,
    createAnalyser: jest.fn(() => createMockNode({
      fftSize: 0,
      smoothingTimeConstant: 0,
      frequencyBinCount: 128,
      getByteFrequencyData: jest.fn(),
      getByteTimeDomainData: jest.fn(),
    })),
    createGain: jest.fn(() => createMockNode({
      gain: createMockAudioParam(1),
    })),
    createOscillator: jest.fn(() => createMockNode({
      type: 'sine' as OscillatorType,
      frequency: createMockAudioParam(440),
      detune: createMockAudioParam(0),
      start: jest.fn(),
      stop: jest.fn(),
    })),
    createBuffer: jest.fn((channels: number, length: number, sampleRate: number) => ({
      length,
      duration: length / sampleRate,
      sampleRate,
      numberOfChannels: channels,
      getChannelData: jest.fn(() => new Float32Array(length)),
      copyFromChannel: jest.fn(),
      copyToChannel: jest.fn(),
    })),
    createBufferSource: jest.fn(() => createMockNode({
      buffer: null,
      start: jest.fn(),
      stop: jest.fn(),
    })),
    createBiquadFilter: jest.fn(() => createMockNode({
      type: 'lowpass' as BiquadFilterType,
      frequency: createMockAudioParam(1000),
      Q: createMockAudioParam(1),
    })),
    createConvolver: jest.fn(() => createMockNode({
      buffer: null,
    })),
    createDelay: jest.fn(() => createMockNode({
      delayTime: createMockAudioParam(0),
    })),
    createDynamicsCompressor: jest.fn(() => {
      const node = createMockNode({
        threshold: createMockAudioParam(-16),
        knee: createMockAudioParam(18),
        ratio: createMockAudioParam(4),
        attack: createMockAudioParam(0.006),
        release: createMockAudioParam(0.18),
      });
      dynamicsNodes.push(node);
      return node;
    }),
    createStereoPanner: jest.fn(() => createMockNode({
      pan: createMockAudioParam(0),
    })),
  } as unknown as AudioContext;

  return {
    context,
    dynamicsNodes,
    masterGain: createMockNode({ gain: createMockAudioParam(1) }) as unknown as GainNode & MockAudioNode,
  };
};

describe('ProceduralMusicEngine routing', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  test('deferred cleanup from a previous track does not disconnect the new music bus', () => {
    const { context, masterGain, dynamicsNodes } = createMockAudioContext();
    const engine = new ProceduralMusicEngine(context, masterGain);

    engine.startTrack('hub_welcome', 0.1);
    expect(dynamicsNodes).toHaveLength(1);
    const previousTrackDynamics = dynamicsNodes[0];

    engine.startTrack('arcade_retro', 0.1);
    expect(dynamicsNodes).toHaveLength(2);
    const activeTrackDynamics = dynamicsNodes[1];

    jest.advanceTimersByTime(250);

    expect(previousTrackDynamics.disconnect).toHaveBeenCalled();
    expect(activeTrackDynamics.disconnect).not.toHaveBeenCalled();
    expect(engine.getIsPlaying()).toBe(true);

    engine.stopTrack(0);
  });
});
