import {
  MusicEventScheduler,
  TRACK_DEFINITIONS,
  buildMusicEventGrid,
} from '@/services/ProceduralMusicEngine';

describe('MusicEventScheduler', () => {
  test('emits deterministic beat events inside the lookahead window', () => {
    const scheduler = new MusicEventScheduler({
      bpm: 120,
      startTime: 10,
      scheduleAheadSeconds: 1,
    });

    expect(scheduler.poll(10)).toEqual([
      {
        type: 'beat',
        beatNumber: 0,
        beatIndex: 0,
        barIndex: 0,
        phraseIndex: 0,
        scheduledTime: 10,
      },
      {
        type: 'beat',
        beatNumber: 1,
        beatIndex: 1,
        barIndex: 0,
        phraseIndex: 0,
        scheduledTime: 10.5,
      },
    ]);

    expect(scheduler.poll(10.1)).toEqual([
      {
        type: 'beat',
        beatNumber: 2,
        beatIndex: 2,
        barIndex: 0,
        phraseIndex: 0,
        scheduledTime: 11,
      },
    ]);
    expect(scheduler.poll(10.5)).toEqual([]);
    expect(scheduler.poll(10.51)).toEqual([
      {
        type: 'beat',
        beatNumber: 3,
        beatIndex: 3,
        barIndex: 0,
        phraseIndex: 0,
        scheduledTime: 11.5,
      },
    ]);
  });

  test('tracks bar and phrase positions from absolute beat number', () => {
    const scheduler = new MusicEventScheduler({
      bpm: 60,
      startTime: 0,
      scheduleAheadSeconds: 17,
    });

    const events = scheduler.poll(0);

    expect(events[4]).toMatchObject({
      beatNumber: 4,
      beatIndex: 0,
      barIndex: 1,
      phraseIndex: 0,
    });
    expect(events[16]).toMatchObject({
      beatNumber: 16,
      beatIndex: 0,
      barIndex: 0,
      phraseIndex: 1,
    });
  });

  test('applies BPM changes without resetting beat order', () => {
    const scheduler = new MusicEventScheduler({
      bpm: 120,
      startTime: 0,
      scheduleAheadSeconds: 0.6,
    });

    expect(scheduler.poll(0).map(event => event.scheduledTime)).toEqual([0, 0.5]);

    scheduler.setBpm(240);

    expect(scheduler.poll(0.5)).toEqual([
      expect.objectContaining({
        beatNumber: 2,
        scheduledTime: 1,
      }),
    ]);

    expect(scheduler.poll(0.75)).toEqual([
      expect.objectContaining({
        beatNumber: 3,
        scheduledTime: 1.25,
      }),
    ]);
  });

  test('builds deterministic event grids for the same track and seed', () => {
    const track = TRACK_DEFINITIONS.arcade_retro;

    expect(buildMusicEventGrid(track, 12345, 4)).toEqual(
      buildMusicEventGrid(track, 12345, 4),
    );
  });

  test('event grid contains musical roles with increasing schedule times', () => {
    const events = buildMusicEventGrid(TRACK_DEFINITIONS.hub_welcome, 101, 2);
    const roles = new Set(events.map(event => event.instrumentType));

    expect(roles.has('bass')).toBe(true);
    expect(roles.has('drums')).toBe(true);
    expect(roles.has('lead')).toBe(true);

    for (let i = 1; i < events.length; i++) {
      expect(events[i].scheduledTime).toBeGreaterThanOrEqual(events[i - 1].scheduledTime);
    }
  });
});
