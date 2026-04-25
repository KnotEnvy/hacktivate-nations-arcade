import {
  buildCustomTrackDefinition,
  buildPhrasePlan,
} from '@/services/ProceduralMusicEngine';

describe('ProceduralMusicEngine custom track generation', () => {
  test('uses Music Lab scale, root, BPM, intensity, and mood directly', () => {
    const track = buildCustomTrackDefinition({
      seed: 4242,
      bpm: 137,
      mood: 'mysterious',
      intensity: 0.72,
      scale: 'hirajoshi',
      rootNote: 'F#',
    });

    expect(track).toMatchObject({
      bpm: 137,
      mood: 'mysterious',
      intensity: 0.72,
      scale: 'hirajoshi',
      rootNote: 'F#3',
    });
  });

  test('clamps unsafe numeric controls and falls back invalid music values', () => {
    const track = buildCustomTrackDefinition({
      seed: 1,
      bpm: 999,
      mood: 'not-a-mood',
      intensity: -5,
      scale: 'not-a-scale',
      rootNote: 'not-a-note',
    });

    expect(track.bpm).toBe(200);
    expect(track.mood).toBe('energetic');
    expect(track.intensity).toBe(0.1);
    expect(track.scale).toBe('minor');
    expect(track.rootNote).toBe('A3');
  });

  test('custom track definitions feed deterministic phrase plans', () => {
    const track = buildCustomTrackDefinition({
      seed: 999,
      bpm: 88,
      mood: 'focus',
      intensity: 0.45,
      scale: 'dorian',
      rootNote: 'D',
    });

    expect(buildPhrasePlan(track, 999, 1)).toEqual(buildPhrasePlan(track, 999, 1));
  });
});
