import {
  TRACK_DEFINITIONS,
  buildMusicEventGrid,
  buildPhrasePlan,
  resolveTrackChord,
} from '@/services/ProceduralMusicEngine';

describe('ProceduralMusicEngine phrase composition', () => {
  test('builds deterministic phrase plans for the same seed and phrase', () => {
    const track = TRACK_DEFINITIONS.hub_welcome;

    expect(buildPhrasePlan(track, 2026, 0)).toEqual(buildPhrasePlan(track, 2026, 0));
  });

  test('creates section-aware A/B/fill/cadence phrase layouts', () => {
    const track = TRACK_DEFINITIONS.arcade_retro;

    expect(buildPhrasePlan(track, 99, 0).sections).toEqual(['intro', 'a', 'b', 'cadence']);
    expect(buildPhrasePlan(track, 99, 1).sections).toEqual(['a', 'b', 'fill', 'cadence']);
    expect(buildPhrasePlan(track, 99, 2).sections).toEqual(['a', 'a', 'fill', 'cadence']);
  });

  test('cadence resolves onto the active progression chord root', () => {
    const track = TRACK_DEFINITIONS.hub_welcome;
    const plan = buildPhrasePlan(track, 777, 0);
    const finalCadence = [...plan.notes].reverse().find(note => note.section === 'cadence')!;
    const finalChord = resolveTrackChord(track, 3);
    const expectedFrequency = 220 * Math.pow(2, finalChord.rootSemitone / 12);

    expect(Math.round(finalCadence.frequency * 100) / 100)
      .toBe(Math.round(expectedFrequency * 100) / 100);
  });

  test('lead events are generated from the phrase plan', () => {
    const track = TRACK_DEFINITIONS.hub_welcome;
    const plan = buildPhrasePlan(track, 101, 0);
    const events = buildMusicEventGrid(track, 101, 4);
    const leadEvents = events.filter(event => event.instrumentType === 'lead');

    expect(leadEvents).toHaveLength(plan.notes.length);
    expect(leadEvents[0].frequency).toBe(plan.notes[0].frequency * Math.pow(2, 1));
  });
});
