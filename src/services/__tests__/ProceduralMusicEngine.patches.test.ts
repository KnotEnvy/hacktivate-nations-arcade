import {
  SB32_PATCHES,
  TRACK_DEFINITIONS,
  getPatchMixProfile,
  getPatchForInstrument,
} from '@/services/ProceduralMusicEngine';

describe('SB32 procedural patch library', () => {
  test('defines layered patches with safe mix metadata', () => {
    Object.values(SB32_PATCHES).forEach((patch) => {
      expect(patch.layers.length).toBeGreaterThan(0);
      expect(patch.brightness).toBeGreaterThanOrEqual(0);
      expect(patch.brightness).toBeLessThanOrEqual(1);
      expect(patch.chorusSend).toBeGreaterThanOrEqual(0);
      expect(patch.chorusSend).toBeLessThanOrEqual(1);

      patch.layers.forEach((layer) => {
        expect(layer.gain).toBeGreaterThan(0);
        expect(layer.attack).toBeGreaterThanOrEqual(0);
        expect(layer.decay).toBeGreaterThanOrEqual(0);
        expect(layer.sustain).toBeGreaterThanOrEqual(0);
        expect(layer.sustain).toBeLessThanOrEqual(1);
        expect(layer.release).toBeGreaterThanOrEqual(0);
      });
    });
  });

  test('selects bass, pad, arpeggio, and lead patches by musical role', () => {
    const track = TRACK_DEFINITIONS.hub_welcome;

    expect(getPatchForInstrument(track.instruments.find(instrument => instrument.type === 'bass')!, track).name)
      .toBe('fm_bass');
    expect(getPatchForInstrument(track.instruments.find(instrument => instrument.type === 'pad')!, track).name)
      .toBe('warm_pad');
    expect(getPatchForInstrument(track.instruments.find(instrument => instrument.type === 'arp')!, track).name)
      .toBe('bell');
    expect(getPatchForInstrument(track.instruments.find(instrument => instrument.type === 'lead')!, track).name)
      .toBe('synth_brass');
  });

  test('uses darker pad colors for mysterious tracks', () => {
    const track = TRACK_DEFINITIONS.epic_tension;
    const pad = track.instruments.find(instrument => instrument.type === 'pad')!;

    expect(getPatchForInstrument(pad, track).name).toBe('choir_pad');
  });

  test('derives safe channel gain and chorus send values for every patch', () => {
    Object.values(SB32_PATCHES).forEach((patch) => {
      const profile = getPatchMixProfile(patch);

      expect(profile.channelGain).toBeGreaterThanOrEqual(0.2);
      expect(profile.channelGain).toBeLessThanOrEqual(1);
      expect(profile.chorusSend).toBeGreaterThanOrEqual(0);
      expect(profile.chorusSend).toBeLessThanOrEqual(0.75);
    });
  });
});
