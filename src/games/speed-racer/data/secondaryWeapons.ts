export type SecondaryWeaponType = 'missile' | 'oil' | 'smoke';

export interface SecondaryWeaponConfig {
  type: SecondaryWeaponType;
  label: string;
  ammo: number;
  hudColor: string;
  cooldown: number; // seconds between uses
}

export const SECONDARY_CONFIGS: Record<SecondaryWeaponType, SecondaryWeaponConfig> = {
  missile: {
    type: 'missile',
    label: 'MISSILES',
    ammo: 3,
    hudColor: '#FF6347',
    cooldown: 0.6,
  },
  oil: {
    type: 'oil',
    label: 'OIL SLICK',
    ammo: 4,
    hudColor: '#9C27B0',
    cooldown: 0.8,
  },
  smoke: {
    type: 'smoke',
    label: 'SMOKE',
    ammo: 4,
    hudColor: '#607D8B',
    cooldown: 0.8,
  },
};

export function pickRandomSecondary(): SecondaryWeaponType {
  const types: SecondaryWeaponType[] = ['missile', 'oil', 'smoke'];
  return types[Math.floor(Math.random() * types.length)];
}
