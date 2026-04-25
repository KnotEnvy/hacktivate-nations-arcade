import { getActiveMusicLayersForIntensity } from '@/services/ProceduralMusicEngine';

describe('ProceduralMusicEngine adaptive music layers', () => {
  test('keeps only foundational layers at low intensity', () => {
    expect(getActiveMusicLayersForIntensity(0.2)).toEqual({
      bass: true,
      drums: true,
      chords: false,
      arpeggio: false,
      melody: false,
      ambience: false,
    });
  });

  test('adds harmonic and melodic density as intensity rises', () => {
    expect(getActiveMusicLayersForIntensity(0.5)).toMatchObject({
      bass: true,
      drums: true,
      chords: true,
      arpeggio: true,
      melody: false,
    });

    expect(getActiveMusicLayersForIntensity(0.8)).toEqual({
      bass: true,
      drums: true,
      chords: true,
      arpeggio: true,
      melody: true,
      ambience: true,
    });
  });

  test('clamps intensity before deriving layers', () => {
    expect(getActiveMusicLayersForIntensity(-10).bass).toBe(false);
    expect(getActiveMusicLayersForIntensity(10).ambience).toBe(true);
  });
});
