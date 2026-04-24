import {
  TRACK_DEFINITIONS,
  buildMusicEventGrid,
  resolveChordSymbol,
  resolveTrackChord,
} from '@/services/ProceduralMusicEngine';

describe('ProceduralMusicEngine harmony resolution', () => {
  test('parses major-key Roman numerals with chord qualities', () => {
    expect(resolveChordSymbol('Imaj7')).toMatchObject({
      tonalMode: 'major',
      degree: 0,
      rootSemitone: 0,
      quality: 'major7',
      tones: [0, 4, 7, 11],
    });

    expect(resolveChordSymbol('vi7')).toMatchObject({
      tonalMode: 'major',
      degree: 5,
      rootSemitone: 9,
      quality: 'minor7',
      tones: [9, 12, 16, 19],
    });

    expect(resolveChordSymbol('bVII')).toMatchObject({
      tonalMode: 'major',
      degree: 6,
      rootSemitone: 10,
      quality: 'major',
      tones: [10, 14, 17],
    });
  });

  test('parses minor-key progressions and diminished symbols', () => {
    expect(resolveChordSymbol('VI', 'minor')).toMatchObject({
      tonalMode: 'minor',
      degree: 5,
      rootSemitone: 8,
      quality: 'major',
      tones: [8, 12, 15],
    });

    expect(resolveChordSymbol('iiÂ°', 'minor')).toMatchObject({
      tonalMode: 'minor',
      degree: 1,
      rootSemitone: 2,
      quality: 'diminished',
      tones: [2, 5, 8],
    });
  });

  test('resolves track chords from the declared progression', () => {
    const chillTrack = TRACK_DEFINITIONS.hub_welcome;
    const epicTrack = TRACK_DEFINITIONS.hub_energetic;

    expect([0, 1, 2, 3].map(bar => resolveTrackChord(chillTrack, bar).rootSemitone))
      .toEqual([0, 9, 5, 7]);
    expect([0, 1, 2, 3].map(bar => resolveTrackChord(epicTrack, bar).rootSemitone))
      .toEqual([0, 8, 3, 10]);
  });

  test('event grid uses chord-aware bass roots', () => {
    const events = buildMusicEventGrid(TRACK_DEFINITIONS.hub_welcome, 101, 4);
    const bassRoots = events
      .filter(event => event.instrumentType === 'bass' && event.beat === 0)
      .map(event => Math.round((event.frequency ?? 0) * 100) / 100);

    expect(bassRoots).toEqual([110, 185, 146.83, 164.81]);
  });
});
