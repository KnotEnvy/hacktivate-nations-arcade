// ===== src/games/platform-adventure/data/TileTypes.ts =====

export const TILE_SIZE = 48;

export type TileType =
    | 'empty'       // Air
    | 'floor'       // Solid floor tile
    | 'wall'        // Solid wall
    | 'pillar'      // Climbable pillar
    | 'platform'    // Thin platform (can drop through)
    | 'ledge'       // Grabbable ledge
    | 'spikes'      // Instant death spikes
    | 'chomper'     // Timed blade trap
    | 'loose'       // Crumbling floor
    | 'gate'        // Openable gate
    | 'switch'      // Pressure plate switch
    | 'door'        // Level exit/entrance
    | 'torch'       // Decorative torch
    | 'potion_hp'   // Health potion spawn
    | 'potion_max'  // Max HP increase spawn
    | 'gem'         // Score gem spawn
    | 'time'        // Time crystal spawn
    | 'guard'       // Guard spawn point
    | 'player'      // Player spawn point
    | 'owl';        // Golden Owl (final goal)

export interface TileDefinition {
    solid: boolean;
    deadly: boolean;
    climbable: boolean;
    interactive: boolean;
    animated: boolean;
}

export const TILE_DEFS: Record<TileType, TileDefinition> = {
    empty: { solid: false, deadly: false, climbable: false, interactive: false, animated: false },
    floor: { solid: true, deadly: false, climbable: false, interactive: false, animated: false },
    wall: { solid: true, deadly: false, climbable: false, interactive: false, animated: false },
    pillar: { solid: false, deadly: false, climbable: true, interactive: false, animated: false },
    platform: { solid: true, deadly: false, climbable: false, interactive: false, animated: false },
    ledge: { solid: false, deadly: false, climbable: true, interactive: false, animated: false },
    spikes: { solid: false, deadly: true, climbable: false, interactive: false, animated: true },
    chomper: { solid: false, deadly: true, climbable: false, interactive: false, animated: true },
    loose: { solid: true, deadly: false, climbable: false, interactive: true, animated: true },
    gate: { solid: true, deadly: false, climbable: false, interactive: true, animated: true },
    switch: { solid: false, deadly: false, climbable: false, interactive: true, animated: false },
    door: { solid: false, deadly: false, climbable: false, interactive: true, animated: false },
    torch: { solid: false, deadly: false, climbable: false, interactive: false, animated: true },
    potion_hp: { solid: false, deadly: false, climbable: false, interactive: true, animated: false },
    potion_max: { solid: false, deadly: false, climbable: false, interactive: true, animated: false },
    gem: { solid: false, deadly: false, climbable: false, interactive: true, animated: true },
    time: { solid: false, deadly: false, climbable: false, interactive: true, animated: true },
    guard: { solid: false, deadly: false, climbable: false, interactive: false, animated: false },
    player: { solid: false, deadly: false, climbable: false, interactive: false, animated: false },
    owl: { solid: false, deadly: false, climbable: false, interactive: true, animated: true },
};

// Visual rendering colors/patterns
export const TILE_COLORS: Record<TileType, { primary: string; secondary: string; accent: string }> = {
    empty: { primary: '#0a0a15', secondary: '#0a0a15', accent: '#0a0a15' },
    floor: { primary: '#4a3a2a', secondary: '#5a4a3a', accent: '#3a2a1a' },
    wall: { primary: '#3a3a4a', secondary: '#4a4a5a', accent: '#2a2a3a' },
    pillar: { primary: '#5a5a6a', secondary: '#6a6a7a', accent: '#4a4a5a' },
    platform: { primary: '#5a4a3a', secondary: '#6a5a4a', accent: '#4a3a2a' },
    ledge: { primary: '#6a5a4a', secondary: '#7a6a5a', accent: '#5a4a3a' },
    spikes: { primary: '#555555', secondary: '#666666', accent: '#cc2222' },
    chomper: { primary: '#444444', secondary: '#555555', accent: '#883333' },
    loose: { primary: '#4a3a2a', secondary: '#5a4a3a', accent: '#6a5a4a' },
    gate: { primary: '#555544', secondary: '#666655', accent: '#444433' },
    switch: { primary: '#666655', secondary: '#777766', accent: '#888877' },
    door: { primary: '#554433', secondary: '#665544', accent: '#443322' },
    torch: { primary: '#443322', secondary: '#554433', accent: '#ff8833' },
    potion_hp: { primary: '#ff4444', secondary: '#ff6666', accent: '#cc2222' },
    potion_max: { primary: '#44ff44', secondary: '#66ff66', accent: '#22cc22' },
    gem: { primary: '#4488ff', secondary: '#66aaff', accent: '#2266cc' },
    time: { primary: '#ffdd44', secondary: '#ffee66', accent: '#ccaa22' },
    guard: { primary: '#aa3333', secondary: '#cc4444', accent: '#882222' },
    player: { primary: '#4488ff', secondary: '#66aaff', accent: '#2266cc' },
    owl: { primary: '#ffd700', secondary: '#ffea00', accent: '#cca500' },
};
