import { BaseGame } from '@/games/shared/BaseGame';
import { GameManifest } from '@/lib/types';
import { PlayerCar } from './entities/PlayerCar';
import { RoadRenderer } from './systems/RoadRenderer';
import { RoadProfile, StraightRoadGeometry } from './systems/RoadProfile';
import { WeaponSystem } from './systems/WeaponSystem';
import { EnemySpawner, SpawnerOptions } from './systems/EnemySpawner';
import { SecondaryWeaponSystem } from './systems/SecondaryWeaponSystem';
import { ParticleSystem } from './systems/Particles';
import { CameraShake } from './systems/CameraShake';
import { BossSpawner } from './systems/BossSpawner';
import { TerrainHazardSystem } from './systems/TerrainHazards';
import { WeatherSystem } from './systems/Weather';
import { TouchControls } from './systems/TouchControls';
import { CHOPPER_SCORE_REWARD, CHOPPER_COIN_REWARD } from './entities/BombChopper';
import {
  TANK_SCORE_REWARD,
  TANK_COIN_REWARD,
  DRONE_SCORE_REWARD,
  DRONE_COIN_REWARD,
} from './entities/BossEnemies';
import { SECONDARY_CONFIGS } from './data/secondaryWeapons';
import { PLAYER } from './data/constants';
import { SECTIONS, getSection, TERRAIN_HANDLING, type SectionDef } from './data/sections';

interface AABB {
  x: number;
  y: number;
  w: number;
  h: number;
}

function aabb(a: AABB, b: AABB): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

const COMBO_DECAY_TIME = 4.0;
const MAX_COMBO_MULTIPLIER = 5;
const CIVILIANS_LOST_GAME_OVER = 3;
const SMOKE_SLOW_FACTOR = 0.4;
const SMOKE_SLOW_DURATION = 1.5;
const RECAP_INPUT_LOCKOUT = 1.2; // seconds before player can dismiss recap
const RECAP_AUTO_DISMISS = 12; // seconds before recap auto-finalizes

// Section banner animation timing (seconds)
const BANNER_FADE_IN = 0.45;
const BANNER_HOLD = 1.6;
const BANNER_FADE_OUT = 0.55;
const BANNER_TOTAL = BANNER_FADE_IN + BANNER_HOLD + BANNER_FADE_OUT;

// Lives + extra-life thresholds
const STARTING_LIVES = 1;
const MAX_LIVES = 5;
// First extra life comes early so rookie runs still get to see a second section.
const LIFE_BONUS_SCORES: readonly number[] = [2500, 10000, 25000, 50000, 100000];
const RESPAWN_INVULN_DURATION = 2.0; // seconds of post-respawn invulnerability
const LIFE_LOST_FLASH_DURATION = 1.2; // seconds the "LIFE LOST" overlay holds
const LIFE_BONUS_FLASH_DURATION = 1.6; // seconds the "EXTRA LIFE" overlay holds
const MOTION_LINE_OFFSETS = [0.12, 0.68, 0.31, 0.84, 0.45, 0.94] as const;

// Chassis HP — each life can soak MAX_HP lethal hits before dying. Gives the
// player a tactile "damage meter" rather than one-shot kills.
const MAX_HP = 3;
const HIT_INVULN_DURATION = 1.1; // seconds of post-hit invulnerability (shorter than full respawn)
const HIT_FLASH_DURATION = 0.5; // damage meter red-flash length after a hit

// Bump mechanic — Spy-Hunter knockoff loop. Side-swipes don't damage either
// party and don't directly destroy enemies; instead they inject lateral
// impulse into the enemy's bumpVx. The enemy dies once it slides past the
// road edge. Force scales linearly from brake → boost; per-vehicle
// bumpResistance (set in ENEMY_CONFIGS) divides the impulse on the receiving
// side so soft cars skid easily and SWAT trucks barely budge.
const BUMP_FORCE_MIN = 80;          // px/sec impulse at PLAYER.BRAKE_SPEED
const BUMP_FORCE_MAX = 520;         // px/sec impulse at PLAYER.BOOST_SPEED
const BUMP_OFF_ROAD_MARGIN = 30;    // px past road edge before the enemy is credited as a kill

// Section-clear reward (§5.4)
const SECTION_CLEAR_BONUS_BASE = 500;
const SECTION_CLEAR_BONUS_PER_COMBO_LIFE = 250; // bonus = base + combo * lives * this
const SECTION_CLEAR_FLASH_DURATION = 1.8;
const SECTION_CLEAR_VAN_DELAY = 2.2; // seconds into next section before guaranteed van

type DeathCause =
  | 'enemy_ram'
  | 'enemy_bullet'
  | 'civilian_spree'
  | 'self_end'
  | 'chopper_bomb'
  | 'tank_shell'
  | 'drone_swoop';

interface RecapStats {
  cause: DeathCause;
  distance: number;
  score: number;
  kills: number;
  civilians: number;
  combo: number;
  vanPickups: number;
  secondaryUsed: number;
  topSpeed: number;
  timeMs: number;
}

export class SpeedRacerGame extends BaseGame {
  manifest: GameManifest = {
    id: 'speed-racer',
    title: 'Speed Racer',
    thumbnail: '/games/speed-racer/speed-racer-thumb.svg',
    inputSchema: ['keyboard', 'touch'],
    assetBudgetKB: 130,
    tier: 2,
    description:
      'Spy-Hunter style vehicular combat racer. Dodge enemies, collect weapons, survive the highway.',
  };

  private player!: PlayerCar;
  private road!: RoadRenderer;
  private roadProfile!: RoadProfile;
  // worldScroll snapshot at the start of the current section. RoadProfile uses
  // it to convert absolute scroll into section-relative worldY so per-section
  // geometry profiles can be defined in section-local units.
  private sectionStartScroll = 0;
  private weapon!: WeaponSystem;
  private spawner!: EnemySpawner;
  private secondary!: SecondaryWeaponSystem;
  private particles!: ParticleSystem;
  private shake!: CameraShake;
  private boss!: BossSpawner;
  private terrainHazards!: TerrainHazardSystem;
  private weather!: WeatherSystem;
  private touch!: TouchControls;
  private muzzleTimer = 0;

  private distance = 0;
  private maxSpeed = 0;
  private enemiesDestroyed = 0;
  private civiliansLost = 0;
  private combo = 1;
  private maxCombo = 1;
  private comboTimer = 0;
  private vanPickups = 0;
  private secondaryFireWasDown = false;
  // Achievement-pass v2 trackers
  private shotsFired = 0;
  private pacifistDistance = 0; // longest streak of distance without firing primary
  private pacifistCurrent = 0;  // live accumulator for the current no-fire streak
  private choppersKilled = 0;
  private civiliansLostThisSection = 0;
  private perfectSectionsCleared = 0; // sections cleared with 0 civilian losses
  private visitedSections = new Set<number>();
  private endHandler?: (e: KeyboardEvent) => void;
  private slowedEnemies = new WeakMap<object, number>(); // enemy -> time remaining slowed

  // Death recap state
  private recapMode = false;
  private recapTimer = 0;
  private recapStats: RecapStats | null = null;
  private recapDismissArmed = false;

  // Section progression state
  private sectionIndex = 0;
  private sectionProgress = 0; // pixel-units accumulated within the active section
  private sectionsCleared = 0;
  // How many times the section list has wrapped back to section 0. Loop 1
  // (first time through) is 0; each subsequent loop adds 1. Drives lap-scaled
  // spawner difficulty — see applyLapScaling().
  private wraparounds = 0;
  private currentSection: SectionDef = SECTIONS[0];
  private bannerTimer = 0; // counts up; <= 0 means no banner showing
  private bannerSection: SectionDef | null = null;

  // Lives system
  private lives = STARTING_LIVES;
  private nextLifeBonusIndex = 0; // index into LIFE_BONUS_SCORES we have not yet awarded
  private respawnInvuln = 0; // seconds remaining where player ignores collisions
  private lifeLostFlash = 0; // counts down; > 0 means LIFE LOST overlay shows
  private lifeBonusFlash = 0; // counts down; > 0 means EXTRA LIFE overlay shows

  // Chassis HP — per-life damage buffer. Hits chip away at HP; only when HP
  // would go below zero does triggerDeath actually fire.
  private hp = MAX_HP;
  private hitFlash = 0; // damage-meter red flash timer

  // Section-clear flash state
  private sectionClearFlash = 0; // counts down; > 0 means SECTION CLEAR overlay shows
  private sectionClearBonusLast = 0; // most recent bonus amount (for overlay text)

  protected onInit(): void {
    this.roadProfile = new RoadProfile();
    this.sectionStartScroll = 0;
    this.player = new PlayerCar(this.roadProfile);
    this.road = new RoadRenderer();
    this.weapon = new WeaponSystem();
    this.spawner = new EnemySpawner(this.roadProfile);
    this.secondary = new SecondaryWeaponSystem();
    this.particles = new ParticleSystem();
    this.shake = new CameraShake();
    this.boss = new BossSpawner(this.roadProfile);
    this.terrainHazards = new TerrainHazardSystem(this.roadProfile);
    this.weather = new WeatherSystem();
    this.touch = new TouchControls();
    this.muzzleTimer = 0;
    this.sectionIndex = 0;
    this.sectionProgress = 0;
    this.sectionsCleared = 0;
    this.wraparounds = 0;
    this.currentSection = getSection(this.sectionIndex);
    this.spawner.configure(this.currentSection.spawnerConfig);
    this.applyTerrainHandling();
    this.applyRoadProfile();
    this.armBanner(this.currentSection);
    this.distance = 0;
    this.maxSpeed = 0;
    this.enemiesDestroyed = 0;
    this.civiliansLost = 0;
    this.combo = 1;
    this.maxCombo = 1;
    this.comboTimer = 0;
    this.vanPickups = 0;
    this.secondaryFireWasDown = false;
    this.shotsFired = 0;
    this.pacifistDistance = 0;
    this.pacifistCurrent = 0;
    this.choppersKilled = 0;
    this.civiliansLostThisSection = 0;
    this.perfectSectionsCleared = 0;
    this.visitedSections = new Set<number>();
    this.visitedSections.add(this.sectionIndex);
    this.slowedEnemies = new WeakMap();
    this.recapMode = false;
    this.recapTimer = 0;
    this.recapStats = null;
    this.recapDismissArmed = false;
    this.lives = STARTING_LIVES;
    this.nextLifeBonusIndex = 0;
    this.respawnInvuln = 0;
    this.lifeLostFlash = 0;
    this.lifeBonusFlash = 0;
    this.sectionClearFlash = 0;
    this.sectionClearBonusLast = 0;
    this.hp = MAX_HP;
    this.hitFlash = 0;

    // Make sure the first section delivers a weapon van early so new players
    // see the pickup loop during the tutorial stretch.
    this.spawner.scheduleVanIn(6);

    this.endHandler = (e) => {
      if (!this.isRunning || this.isPaused) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        if (!this.recapMode) {
          this.triggerDeath('self_end');
        }
      }
    };
    window.addEventListener('keydown', this.endHandler);
  }

  protected onUpdate(dt: number): void {
    if (this.recapMode) {
      this.updateRecap(dt);
      return;
    }
    const input = this.services.input;
    this.touch.update(input.getTouches());
    const tc = this.touch;
    const playerInput = {
      isLeftPressed: () => input.isLeftPressed() || tc.leftHeld(),
      isRightPressed: () => input.isRightPressed() || tc.rightHeld(),
      isUpPressed: () => input.isUpPressed() || tc.upHeld(),
      isDownPressed: () => input.isDownPressed() || tc.downHeld(),
    };
    this.player.update(dt, playerInput);
    // Cosmetic damage tier tracks hp. MAX_HP=3 → tier 0/1/2 map to pristine/scorched/critical.
    this.player.setDamageLevel(Math.max(0, Math.min(2, MAX_HP - this.hp)) as 0 | 1 | 2);
    // Snapshot secondary weapon state for the trunk-mounted attachment.
    const secActive = this.secondary.active;
    if (secActive) {
      const secCfg = SECONDARY_CONFIGS[secActive];
      this.player.setSecondary({
        type: secActive,
        ammo: this.secondary.ammo,
        maxAmmo: secCfg.ammo,
        cooldownPct: secCfg.cooldown > 0 ? this.secondary.cooldown / secCfg.cooldown : 0,
      });
    } else {
      this.player.setSecondary({ type: null, ammo: 0, maxAmmo: 0, cooldownPct: 0 });
    }
    this.road.update(this.player.speed, dt);
    this.roadProfile.setScroll(this.road.getScroll());

    const firing = input.isKeyPressed('Space') || tc.fireHeld();
    const bulletsBefore = this.weapon.getProjectiles().filter((b) => b.alive).length;
    this.weapon.update(dt, firing, this.player.x, this.player.y);
    const bulletsAfter = this.weapon.getProjectiles().filter((b) => b.alive).length;
    if (firing) {
      this.muzzleTimer -= dt;
      if (this.muzzleTimer <= 0 && bulletsAfter > bulletsBefore) {
        this.particles.burstMuzzle(this.player.x - 10, this.player.y - this.player.height / 2 - 4);
        this.particles.burstMuzzle(this.player.x + 10, this.player.y - this.player.height / 2 - 4);
        this.services?.audio?.playSound?.('shoot', { volume: 0.25 });
        this.player.pulseGunRecoil();
        this.muzzleTimer = 0.08;
      }
    } else {
      this.muzzleTimer = 0;
    }
    // Pacifist-mile tracking: any new primary bullet this frame resets the streak.
    if (bulletsAfter > bulletsBefore) {
      this.shotsFired += bulletsAfter - bulletsBefore;
      if (this.pacifistCurrent > this.pacifistDistance) {
        this.pacifistDistance = this.pacifistCurrent;
      }
      this.pacifistCurrent = 0;
    }

    // Edge-detect Q for secondary weapon (or virtual WEAPON button)
    const secondaryDown = input.isKeyPressed('KeyQ');
    const touchSecondary = tc.consumeSecondaryPress();
    const secondaryEdge = touchSecondary || (secondaryDown && !this.secondaryFireWasDown);
    if (secondaryEdge) {
      const result = this.secondary.fire(this.player.x, this.player.y, this.player.height);
      if (result.fired) {
        this.services?.audio?.playSound?.(result.missile ? 'laser' : 'whoosh', { volume: 0.4 });
        if (result.missile) this.shake.add(0.15);
      }
    }
    this.secondaryFireWasDown = secondaryDown;
    this.secondary.update(dt, this.player.speed);

    this.spawner.update(
      dt,
      this.player.speed,
      this.player.x,
      this.player.y,
      this.player.vx,
    );

    // Off-road bump kills — credit any enemy whose slide has carried it past
    // either road edge. Done immediately after spawner.update (before its
    // alive-filter on the next frame) so the kill is attributed to the player
    // rather than just disappearing as scenery. Profile is queried per enemy
    // so dynamic-width sections measure "off the road" against the local edge.
    for (const enemy of this.spawner.getEnemies()) {
      if (!enemy.alive) continue;
      const halfW = enemy.config.width / 2;
      const shape = this.roadProfile.shapeAtScreen(enemy.y);
      const offLeft = enemy.x + halfW < shape.xMin - BUMP_OFF_ROAD_MARGIN;
      const offRight = enemy.x - halfW > shape.xMax + BUMP_OFF_ROAD_MARGIN;
      if (offLeft || offRight) {
        enemy.alive = false;
        this.enemiesDestroyed += 1;
        this.score += enemy.config.scoreValue * this.combo;
        this.pickups += enemy.config.coinDrop;
        this.bumpCombo();
        this.particles.burstExplosion(enemy.x, enemy.y, 1.0);
        this.shake.add(0.32);
        this.services?.audio?.playSound?.('explosion', { volume: 0.5 });
      }
    }

    this.boss.update(
      dt,
      this.sectionsCleared,
      this.player.x,
      this.player.y,
      this.player.speed,
      this.currentSection.id,
    );
    this.terrainHazards.update(dt, this.player.speed);
    this.weather.update(dt);

    this.particles.update(dt);
    this.shake.update(dt);

    if (this.combo > 1) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 1;
      }
    }

    this.resolveCollisions(dt);

    const traveled = this.player.speed * dt;
    this.distance += traveled;
    this.sectionProgress += traveled;
    this.pacifistCurrent += traveled;
    if (this.pacifistCurrent > this.pacifistDistance) {
      this.pacifistDistance = this.pacifistCurrent;
    }
    if (this.player.speed > this.maxSpeed) this.maxSpeed = this.player.speed;
    this.score = Math.floor(this.distance / 10) + this.enemiesDestroyed * 100;

    if (this.sectionProgress >= this.currentSection.lengthMeters) {
      this.advanceSection();
    }

    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) {
        this.bannerTimer = 0;
        this.bannerSection = null;
      }
    }

    // Tick life timers
    if (this.respawnInvuln > 0) this.respawnInvuln = Math.max(0, this.respawnInvuln - dt);
    if (this.lifeLostFlash > 0) this.lifeLostFlash = Math.max(0, this.lifeLostFlash - dt);
    if (this.lifeBonusFlash > 0) this.lifeBonusFlash = Math.max(0, this.lifeBonusFlash - dt);
    if (this.sectionClearFlash > 0) this.sectionClearFlash = Math.max(0, this.sectionClearFlash - dt);
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt);

    // Award extra life when score crosses next threshold
    while (
      this.nextLifeBonusIndex < LIFE_BONUS_SCORES.length &&
      this.score >= LIFE_BONUS_SCORES[this.nextLifeBonusIndex]
    ) {
      this.nextLifeBonusIndex += 1;
      if (this.lives < MAX_LIVES) {
        this.lives += 1;
        this.lifeBonusFlash = LIFE_BONUS_FLASH_DURATION;
        this.services?.audio?.playSound?.('powerUp', { volume: 0.6 });
      }
    }

    this.extendedGameData = {
      distance: Math.floor(this.distance),
      speed: Math.floor(this.maxSpeed),
      combo: this.maxCombo,
      powerups_used: this.secondary.totalUsed,
      enemies_destroyed: this.enemiesDestroyed,
      civilians_lost: this.civiliansLost,
      van_pickups: this.vanPickups,
      sections_cleared: this.sectionsCleared,
      pacifist_distance: Math.floor(this.pacifistDistance),
      choppers_killed: this.choppersKilled,
      perfect_sections: this.perfectSectionsCleared,
      unique_sections_visited: this.visitedSections.size,
      shots_fired: this.shotsFired,
    };
  }

  private advanceSection(): void {
    this.sectionsCleared += 1;
    if (this.civiliansLostThisSection === 0) {
      this.perfectSectionsCleared += 1;
    }
    this.civiliansLostThisSection = 0;
    // Award clear bonus before swapping section so the just-finished run's
    // combo and lives determine the payout.
    const bonus =
      SECTION_CLEAR_BONUS_BASE +
      this.combo * this.lives * SECTION_CLEAR_BONUS_PER_COMBO_LIFE;
    this.score += bonus;
    this.sectionClearBonusLast = bonus;
    this.sectionClearFlash = SECTION_CLEAR_FLASH_DURATION;

    const nextIndex = (this.sectionIndex + 1) % SECTIONS.length;
    if (nextIndex === 0) this.wraparounds += 1;
    this.sectionIndex = nextIndex;
    this.sectionProgress = 0;
    this.currentSection = getSection(this.sectionIndex);
    this.visitedSections.add(this.sectionIndex);
    this.spawner.configure(this.applyLapScaling(this.currentSection.spawnerConfig));
    this.applyTerrainHandling();
    this.applyRoadProfile();
    this.armBanner(this.currentSection);
    // Guarantee a weapon van early in the next section so the reward loop
    // always pays out something tangible.
    this.spawner.scheduleVanIn(SECTION_CLEAR_VAN_DELAY);
    // Subtle visual punctuation for the transition
    this.shake.add(0.18);
    this.services?.audio?.playSound?.('powerUp', { volume: 0.35 });
  }

  // Lap scaling — each full loop through the section list tightens spawns
  // and bumps burst/formation chances. Clamps prevent runaway on loop 5+.
  private applyLapScaling(base: Partial<SpawnerOptions>): Partial<SpawnerOptions> {
    if (this.wraparounds === 0) return base;
    const w = this.wraparounds;
    const scaled: Partial<SpawnerOptions> = { ...base };
    if (base.spawnInterval !== undefined) {
      scaled.spawnInterval = Math.max(0.6, base.spawnInterval * Math.pow(0.9, w));
    }
    const burstBase = base.shooterBurstChance ?? 0;
    scaled.shooterBurstChance = Math.min(0.6, burstBase + 0.08 * w);
    const formationBase = base.formationChance ?? 0;
    scaled.formationChance = Math.min(0.35, formationBase + 0.05 * w);
    return scaled;
  }

  private applyTerrainHandling(): void {
    const terrain = this.currentSection.terrain ?? 'road';
    const profile = TERRAIN_HANDLING[terrain];
    this.player.setHandling(profile.steerMul, profile.decelMul);
    this.player.setVisual(terrain === 'water' ? 'boat' : 'car');
    this.terrainHazards.setTerrain(terrain);
    this.weather.setWeather(this.currentSection.weather ?? 'none');
  }

  // Snapshot the scroll value at section start and install the section's road
  // geometry on the live profile. Until per-section geometries are introduced
  // in Step 2, every section reuses StraightRoadGeometry — behavior identical
  // to v5, but every consumer now goes through the profile pipeline.
  private applyRoadProfile(): void {
    this.sectionStartScroll = this.road.getScroll();
    const geometry = this.currentSection.roadGeometry ?? new StraightRoadGeometry();
    this.roadProfile.setGeometry(geometry, this.sectionStartScroll);
  }

  private armBanner(section: SectionDef): void {
    this.bannerSection = section;
    this.bannerTimer = BANNER_TOTAL;
  }

  // Funnel every lethal-hit site through here so the chassis HP system and
  // respawn logic stay in one place. Returns true if the hit actually ended
  // the run (so callers can early-out on `return`).
  private takeDamage(cause: DeathCause): boolean {
    if (this.recapMode || !this.isRunning) return true;
    // Player-initiated end bypasses the HP system.
    if (cause === 'self_end') {
      this.triggerDeath(cause);
      return true;
    }
    // Ignore damage during post-hit or post-respawn invulnerability.
    if (this.respawnInvuln > 0) return false;

    this.hp -= 1;
    this.hitFlash = HIT_FLASH_DURATION;
    this.respawnInvuln = HIT_INVULN_DURATION;
    // A glancing hit breaks the combo — you lost control for a moment.
    this.dropCombo();
    this.shake.add(0.45);
    this.services?.audio?.playSound?.('hit', { volume: 0.55 });

    if (this.hp <= 0) {
      this.triggerDeath(cause);
      return true;
    }
    return false;
  }

  private triggerDeath(cause: DeathCause): void {
    if (this.recapMode || !this.isRunning) return;

    // Use an extra life if available (player-initiated 'self_end' always ends the run)
    if (this.lives > 1 && cause !== 'self_end') {
      this.lives -= 1;
      this.respawn();
      return;
    }

    this.recapMode = true;
    this.recapTimer = 0;
    this.recapDismissArmed = false;
    this.recapStats = {
      cause,
      distance: Math.floor(this.distance),
      score: this.score,
      kills: this.enemiesDestroyed,
      civilians: this.civiliansLost,
      combo: this.maxCombo,
      vanPickups: this.vanPickups,
      secondaryUsed: this.secondary.totalUsed,
      topSpeed: Math.floor(this.maxSpeed),
      timeMs: Date.now() - this.startTime,
    };
    // Make sure final extendedGameData reflects the run for the official end-of-game flow
    // Bake in the final pacifist streak before freezing the payload.
    if (this.pacifistCurrent > this.pacifistDistance) {
      this.pacifistDistance = this.pacifistCurrent;
    }
    this.extendedGameData = {
      distance: this.recapStats.distance,
      speed: this.recapStats.topSpeed,
      combo: this.recapStats.combo,
      powerups_used: this.recapStats.secondaryUsed,
      enemies_destroyed: this.recapStats.kills,
      civilians_lost: this.recapStats.civilians,
      van_pickups: this.recapStats.vanPickups,
      sections_cleared: this.sectionsCleared,
      pacifist_distance: Math.floor(this.pacifistDistance),
      choppers_killed: this.choppersKilled,
      perfect_sections: this.perfectSectionsCleared,
      unique_sections_visited: this.visitedSections.size,
      shots_fired: this.shotsFired,
    };
  }

  private respawn(): void {
    // Clear immediate threats so the player isn't instantly killed again
    for (const e of this.spawner.getEnemies()) e.alive = false;
    for (const p of this.spawner.getProjectiles()) p.alive = false;
    this.boss.reset();
    // Reset civilian-spree counter so the next civilian doesn't end the run
    this.civiliansLost = 0;
    // Drop combo — death always breaks the chain
    this.dropCombo();
    // Full chassis restore on a new life.
    this.hp = MAX_HP;
    this.hitFlash = 0;
    // Arm invulnerability + UI flash
    this.respawnInvuln = RESPAWN_INVULN_DURATION;
    this.lifeLostFlash = LIFE_LOST_FLASH_DURATION;
  }

  private updateRecap(dt: number): void {
    this.recapTimer += dt;
    // Keep the canvas alive: still tick particles + shake so the screen looks dynamic
    this.particles.update(dt);
    this.shake.update(dt);

    const input = this.services.input;
    // Wait for any-key release before arming dismissal to prevent the same Space
    // press that killed the player from immediately closing the recap.
    const anyDown =
      input.isKeyPressed('Space') ||
      input.isKeyPressed('Enter') ||
      input.isKeyPressed('KeyR') ||
      input.isKeyPressed('Escape');
    if (!this.recapDismissArmed) {
      if (this.recapTimer >= RECAP_INPUT_LOCKOUT && !anyDown) {
        this.recapDismissArmed = true;
      }
    } else if (anyDown || this.recapTimer >= RECAP_AUTO_DISMISS) {
      this.finalizeRecap();
    }
  }

  private finalizeRecap(): void {
    // Leave recapMode true so render() keeps showing recap until the
    // outer ThemedGameCanvas overlay takes over (no blank-screen gap).
    this.endGame();
  }

  private bumpCombo(): void {
    if (this.combo < MAX_COMBO_MULTIPLIER) this.combo += 1;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    this.comboTimer = COMBO_DECAY_TIME;
  }

  private dropCombo(): void {
    this.combo = 1;
    this.comboTimer = 0;
  }

  private killEnemy(enemy: ReturnType<EnemySpawner['getEnemies']>[number], force = false): void {
    if (!enemy.alive) return;
    if (enemy.config.bulletproof && !force) return;
    enemy.alive = false;
    this.enemiesDestroyed += 1;
    const reward = enemy.config.scoreValue * this.combo;
    this.score += reward;
    this.pickups += enemy.config.coinDrop;
    this.bumpCombo();
    const scale = enemy.config.bulletproof ? 1.6 : 1;
    this.particles.burstExplosion(enemy.x, enemy.y, scale);
    this.shake.add(enemy.config.bulletproof ? 0.45 : 0.18);
    this.services?.audio?.playSound?.('explosion', { volume: enemy.config.bulletproof ? 0.55 : 0.4 });
  }

  private resolveCollisions(dt: number): void {
    const pb = this.player.getBounds();
    const playerVulnerable = this.respawnInvuln <= 0;

    // Terrain hazards — ice patches apply slip while overlapping, wake streaks
    // push the player laterally on contact. Clear slip each frame; the ice
    // overlap below re-sets it.
    this.player.setSlipping(false);
    for (const h of this.terrainHazards.getHazards()) {
      if (!h.alive) continue;
      const overlaps = aabb(pb, h.getBounds());
      const impact = h.contact(overlaps);
      if (impact.slip) this.player.setSlipping(true);
      if (impact.nudgeX !== 0) this.player.vx += impact.nudgeX;
    }

    // Player bullets vs civilians/enemies
    for (const bullet of this.weapon.getProjectiles()) {
      if (!bullet.alive) continue;
      const bb = bullet.getBounds();

      let hitCiv = false;
      for (const civ of this.spawner.getCivilians()) {
        if (!civ.alive) continue;
        if (aabb(bb, civ.getBounds())) {
          bullet.alive = false;
          civ.alive = false;
          this.civiliansLost += 1;
          this.civiliansLostThisSection += 1;
          this.dropCombo();
          this.particles.burstExplosion(civ.x, civ.y, 0.8);
          this.shake.add(0.25);
          this.services?.audio?.playSound?.('hit', { volume: 0.4 });
          if (this.civiliansLost >= CIVILIANS_LOST_GAME_OVER) {
            this.triggerDeath('civilian_spree');
            return;
          }
          hitCiv = true;
          break;
        }
      }
      if (hitCiv) continue;

      let hitEnemy = false;
      for (const enemy of this.spawner.getEnemies()) {
        if (!enemy.alive) continue;
        if (aabb(bb, enemy.getBounds())) {
          bullet.alive = false;
          if (enemy.config.bulletproof) {
            this.particles.burstHit(bullet.x, bullet.y);
            this.services?.audio?.playSound?.('hit', { volume: 0.2 });
            hitEnemy = true;
            break;
          }
          const killed = enemy.takeHit(bullet.damage);
          if (killed) {
            this.enemiesDestroyed += 1;
            const reward = enemy.config.scoreValue * this.combo;
            this.score += reward;
            this.pickups += enemy.config.coinDrop;
            this.bumpCombo();
            this.particles.burstExplosion(enemy.x, enemy.y, 1);
            this.shake.add(0.18);
            this.services?.audio?.playSound?.('explosion', { volume: 0.4 });
          } else {
            this.particles.burstHit(bullet.x, bullet.y);
            this.services?.audio?.playSound?.('hit', { volume: 0.2 });
          }
          hitEnemy = true;
          break;
        }
      }
      if (hitEnemy) continue;

      // Bullets vs drones (bullets kill them)
      let hitDrone = false;
      for (const drone of this.boss.getDrones()) {
        if (!drone.alive) continue;
        if (aabb(bb, drone.getBounds())) {
          bullet.alive = false;
          if (drone.takeHit()) {
            this.enemiesDestroyed += 1;
            this.score += DRONE_SCORE_REWARD * this.combo;
            this.pickups += DRONE_COIN_REWARD;
            this.bumpCombo();
            this.particles.burstExplosion(drone.x, drone.y, 0.8);
            this.shake.add(0.15);
            this.services?.audio?.playSound?.('explosion', { volume: 0.35 });
          }
          hitDrone = true;
          break;
        }
      }
      if (hitDrone) continue;

      // Bullets vs tanks — bounce (need missiles)
      for (const tank of this.boss.getTanks()) {
        if (!tank.alive) continue;
        if (aabb(bb, tank.getBounds())) {
          bullet.alive = false;
          this.particles.burstHit(bullet.x, bullet.y);
          this.services?.audio?.playSound?.('hit', { volume: 0.25 });
          break;
        }
      }
    }

    // Missiles vs enemies (one-shot armored)
    for (const missile of this.secondary.getMissiles()) {
      if (!missile.alive) continue;
      const mb = missile.getBounds();
      for (const enemy of this.spawner.getEnemies()) {
        if (!enemy.alive) continue;
        if (aabb(mb, enemy.getBounds())) {
          missile.alive = false;
          this.killEnemy(enemy, true);
          break;
        }
      }
      if (!missile.alive) continue;
      // Missiles vs Bomb Chopper — high reward kill
      for (const chopper of this.boss.getChoppers()) {
        if (!chopper.alive) continue;
        if (aabb(mb, chopper.getBounds())) {
          missile.alive = false;
          if (chopper.takeHit()) {
            this.enemiesDestroyed += 1;
            this.choppersKilled += 1;
            this.score += CHOPPER_SCORE_REWARD * this.combo;
            this.pickups += CHOPPER_COIN_REWARD;
            this.bumpCombo();
            this.particles.burstExplosion(chopper.x, chopper.y, 2.2);
            this.shake.add(0.6);
            this.services?.audio?.playSound?.('explosion', { volume: 0.7 });
          }
          break;
        }
      }
      if (!missile.alive) continue;
      // Missiles vs Tank (3 missiles to kill, armored)
      for (const tank of this.boss.getTanks()) {
        if (!tank.alive) continue;
        if (aabb(mb, tank.getBounds())) {
          missile.alive = false;
          const killed = tank.takeHit(true);
          if (killed) {
            this.enemiesDestroyed += 1;
            this.score += TANK_SCORE_REWARD * this.combo;
            this.pickups += TANK_COIN_REWARD;
            this.bumpCombo();
            this.particles.burstExplosion(tank.x, tank.y, 2.6);
            this.shake.add(0.7);
            this.services?.audio?.playSound?.('explosion', { volume: 0.75 });
          } else {
            this.particles.burstHit(missile.x, missile.y);
            this.shake.add(0.25);
            this.services?.audio?.playSound?.('hit', { volume: 0.35 });
          }
          break;
        }
      }
      if (!missile.alive) continue;
      // Missiles vs Drones (overkill but allowed)
      for (const drone of this.boss.getDrones()) {
        if (!drone.alive) continue;
        if (aabb(mb, drone.getBounds())) {
          missile.alive = false;
          if (drone.takeHit()) {
            this.enemiesDestroyed += 1;
            this.score += DRONE_SCORE_REWARD * this.combo;
            this.pickups += DRONE_COIN_REWARD;
            this.bumpCombo();
            this.particles.burstExplosion(drone.x, drone.y, 0.9);
            this.shake.add(0.18);
            this.services?.audio?.playSound?.('explosion', { volume: 0.4 });
          }
          break;
        }
      }
    }

    // Bomb explosions vs player — single damage check on the frame they detonate
    if (playerVulnerable) {
      for (const bomb of this.boss.getBombs()) {
        if (!bomb.justExploded) continue;
        const c = bomb.getExplosionCenter();
        const dx = this.player.x - c.x;
        const dy = this.player.y - c.y;
        if (dx * dx + dy * dy <= c.r * c.r) {
          this.particles.burstExplosion(this.player.x, this.player.y, 1.8);
          this.services?.audio?.playSound?.('explosion', { volume: 0.7 });
          if (this.takeDamage('chopper_bomb')) return;
        }
      }
    }

    // Hazards (oil/smoke) vs enemies
    for (const hz of this.secondary.getHazards()) {
      if (!hz.alive) continue;
      const hb = hz.getBounds();
      for (const enemy of this.spawner.getEnemies()) {
        if (!enemy.alive) continue;
        if (!aabb(hb, enemy.getBounds())) continue;
        if (hz.type === 'oil') {
          // Oil destroys non-armored, spins out armored (unaffected)
          if (!enemy.config.bulletproof) {
            this.killEnemy(enemy);
          }
        } else if (hz.type === 'smoke') {
          // Smoke slows enemy temporarily
          this.slowedEnemies.set(enemy, SMOKE_SLOW_DURATION);
        }
      }
    }

    // Apply slow effect
    for (const enemy of this.spawner.getEnemies()) {
      const remaining = this.slowedEnemies.get(enemy) ?? 0;
      if (remaining > 0) {
        // Roll back enemy y movement to simulate slow
        enemy.y -= enemy.vy * dt * (1 - SMOKE_SLOW_FACTOR);
        const next = remaining - dt;
        if (next > 0) this.slowedEnemies.set(enemy, next);
        else this.slowedEnemies.delete(enemy);
      }
    }

    // Player vs enemy collision — Spy-Hunter knockoff loop.
    //   side-swipe (penX < penY): inject bump impulse, no immediate damage or
    //                              kill on either side. Enemy dies later if
    //                              its slide carries it off the road (handled
    //                              after spawner.update).
    //   head-on / rear-end:        chassis hit — chips player HP, removes the
    //                              enemy so it can't re-hit through i-frames.
    if (playerVulnerable) {
      for (const enemy of this.spawner.getEnemies()) {
        if (!enemy.alive) continue;
        const eb = enemy.getBounds();
        if (!aabb(pb, eb)) continue;

        const dx = this.player.x - enemy.x;
        const dy = this.player.y - enemy.y;
        const penX = (this.player.width + enemy.config.width) / 2 - Math.abs(dx);
        const penY = (this.player.height + enemy.config.height) / 2 - Math.abs(dy);
        const isSideSwipe = penX < penY;

        if (isSideSwipe) {
          // Force scales linearly with player speed — coasting at brake barely
          // nudges anyone, full boost shoves rams clean off the road in one hit.
          const speedRatio = Math.max(
            0,
            Math.min(
              1,
              (this.player.speed - PLAYER.BRAKE_SPEED) /
                (PLAYER.BOOST_SPEED - PLAYER.BRAKE_SPEED),
            ),
          );
          const force = BUMP_FORCE_MIN + (BUMP_FORCE_MAX - BUMP_FORCE_MIN) * speedRatio;
          // Push enemy AWAY from player; recoil player AWAY from enemy. Heavier
          // vehicles shove the player back harder (bumpResistance amplifies recoil).
          enemy.applyBump(-Math.sign(dx) * force);
          this.player.vx += Math.sign(dx) * (50 + enemy.config.bumpResistance * 30);
          this.particles.burstExplosion(
            (this.player.x + enemy.x) / 2,
            (this.player.y + enemy.y) / 2,
            0.4 + Math.min(0.8, enemy.config.bumpResistance * 0.1),
          );
          this.shake.add(0.12 + Math.min(0.2, enemy.config.bumpResistance * 0.04));
          this.services?.audio?.playSound?.('collision', {
            volume: 0.32 + Math.min(0.3, enemy.config.bumpResistance * 0.04),
          });
          continue;
        }

        // Chassis hit — head-on or rear-end. Chips HP and removes the enemy
        // so we're not instantly re-hit after i-frames end.
        this.particles.burstExplosion(this.player.x, this.player.y, 1.4);
        this.services?.audio?.playSound?.('collision', { volume: 0.6 });
        if (this.takeDamage('enemy_ram')) return;
        enemy.alive = false;
        return;
      }
    }

    // Player vs civilian — collateral
    if (playerVulnerable) {
      for (const civ of this.spawner.getCivilians()) {
        if (!civ.alive) continue;
        if (aabb(pb, civ.getBounds())) {
          civ.alive = false;
          this.civiliansLost += 1;
          this.civiliansLostThisSection += 1;
          this.dropCombo();
          this.particles.burstExplosion(civ.x, civ.y, 0.9);
          this.shake.add(0.35);
          this.services?.audio?.playSound?.('collision', { volume: 0.45 });
          if (this.civiliansLost >= CIVILIANS_LOST_GAME_OVER) {
            this.triggerDeath('civilian_spree');
            return;
          }
        }
      }
    }

    // Player vs Weapon Van — dock pickup
    for (const van of this.spawner.getVans()) {
      if (!van.alive || van.docked) continue;
      if (aabb(pb, van.getDockBounds())) {
        van.docked = true;
        van.alive = false;
        this.secondary.equip(van.payload);
        this.vanPickups += 1;
        const cfg = SECONDARY_CONFIGS[van.payload];
        this.particles.burstPickup(this.player.x, this.player.y, cfg.hudColor);
        this.services?.audio?.playSound?.('powerUp', { volume: 0.5 });
      }
    }

    // Enemy bullets vs player = game over
    if (playerVulnerable) {
      for (const proj of this.spawner.getProjectiles()) {
        if (!proj.alive) continue;
        if (aabb(proj.getBounds(), pb)) {
          proj.alive = false;
          this.particles.burstExplosion(this.player.x, this.player.y, 1.2);
          this.services?.audio?.playSound?.('explosion', { volume: 0.55 });
          if (this.takeDamage('enemy_bullet')) return;
        }
      }
    }

    // Tank body vs player — lethal head-on contact
    if (playerVulnerable) {
      for (const tank of this.boss.getTanks()) {
        if (!tank.alive) continue;
        if (aabb(pb, tank.getBounds())) {
          this.particles.burstExplosion(this.player.x, this.player.y, 1.6);
          this.services?.audio?.playSound?.('collision', { volume: 0.7 });
          if (this.takeDamage('tank_shell')) return;
        }
      }
    }

    // Tank shells vs player — lethal
    if (playerVulnerable) {
      for (const shell of this.boss.getShells()) {
        if (!shell.alive) continue;
        if (aabb(shell.getBounds(), pb)) {
          shell.alive = false;
          this.particles.burstExplosion(this.player.x, this.player.y, 1.3);
          this.services?.audio?.playSound?.('explosion', { volume: 0.6 });
          if (this.takeDamage('tank_shell')) return;
        }
      }
    }

    // Drone swoops vs player — only lethal while actively swooping
    if (playerVulnerable) {
      for (const drone of this.boss.getDrones()) {
        if (!drone.alive || !drone.isSwooping()) continue;
        if (aabb(drone.getBounds(), pb)) {
          drone.alive = false;
          this.particles.burstExplosion(this.player.x, this.player.y, 1.2);
          this.services?.audio?.playSound?.('explosion', { volume: 0.55 });
          if (this.takeDamage('drone_swoop')) return;
        }
      }
    }
  }

  protected onRender(ctx: CanvasRenderingContext2D): void {
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.save();
    this.shake.apply(ctx);
    this.road.render(ctx, w, h, this.currentSection.palette, this.roadProfile);
    this.renderMotionLines(ctx, w, h);
    this.terrainHazards.render(ctx);
    this.secondary.render(ctx);
    this.spawner.render(ctx);
    this.boss.render(ctx);
    if (!this.recapMode) {
      // Flicker player while invulnerable post-respawn
      const visible = this.respawnInvuln <= 0 || Math.floor(this.respawnInvuln * 12) % 2 === 0;
      if (visible) this.player.render(ctx);
    }
    this.weapon.render(ctx);
    this.particles.render(ctx);
    this.weather.render(ctx);
    ctx.restore();

    // Vignette on top of shake transform (so it doesn't jitter with the camera)
    this.weather.renderVignette(ctx);

    if (this.recapMode) this.renderRecap(ctx, w, h);
  }

  private renderRecap(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const stats = this.recapStats;
    if (!stats) return;

    // Dim the scene
    ctx.save();
    ctx.fillStyle = 'rgba(13,0,26,0.78)';
    ctx.fillRect(0, 0, w, h);

    // Animated entry — slide/scale from 0 to 1 over 0.5s
    const t = Math.min(1, this.recapTimer / 0.45);
    const eased = 1 - Math.pow(1 - t, 3);
    const scale = 0.85 + 0.15 * eased;
    const alpha = eased;
    ctx.globalAlpha = alpha;
    ctx.translate(w / 2, h / 2);
    ctx.scale(scale, scale);
    ctx.translate(-w / 2, -h / 2);

    // Panel
    const panelW = 460;
    const panelH = 380;
    const px = (w - panelW) / 2;
    const py = (h - panelH) / 2;

    // Glow border
    ctx.shadowColor = '#FF0080';
    ctx.shadowBlur = 24;
    ctx.fillStyle = '#1A0033';
    this.drawRoundRect(ctx, px, py, panelW, panelH, 14);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = '#FF0080';
    ctx.lineWidth = 2;
    this.drawRoundRect(ctx, px, py, panelW, panelH, 14);
    ctx.stroke();

    // Header
    const causeLabel: Record<DeathCause, string> = {
      enemy_ram: 'WRECKED BY ENEMY',
      enemy_bullet: 'GUNNED DOWN',
      civilian_spree: 'TOO MANY CIVILIANS',
      self_end: 'RUN ABANDONED',
      chopper_bomb: 'BOMBED FROM ABOVE',
      tank_shell: 'SHELLED BY TANK',
      drone_swoop: 'DRONE KAMIKAZE',
    };
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FF0080';
    ctx.font = 'bold 32px Arial';
    ctx.fillText('RUN COMPLETE', w / 2, py + 50);
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 14px Arial';
    ctx.fillText(causeLabel[stats.cause], w / 2, py + 72);

    // Score row
    ctx.fillStyle = '#00FFFF';
    ctx.font = 'bold 14px Arial';
    ctx.fillText('SCORE', w / 2, py + 110);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 42px Arial';
    ctx.fillText(stats.score.toLocaleString(), w / 2, py + 150);

    // Stats grid
    const rows: { label: string; value: string; color: string }[] = [
      { label: 'DISTANCE', value: `${stats.distance} m`, color: '#00FFFF' },
      { label: 'TOP SPEED', value: `${stats.topSpeed}`, color: '#00FFFF' },
      { label: 'ENEMIES', value: `${stats.kills}`, color: '#FF6347' },
      { label: 'BEST COMBO', value: `x${stats.combo}`, color: '#FF0080' },
      { label: 'VAN PICKUPS', value: `${stats.vanPickups}`, color: '#FFD700' },
      { label: 'CIVILIANS', value: `${stats.civilians}/${CIVILIANS_LOST_GAME_OVER}`, color: '#FF6347' },
    ];
    const colW = panelW / 3;
    for (let i = 0; i < rows.length; i++) {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const cx = px + colW * col + colW / 2;
      const cy = py + 190 + row * 56;
      ctx.fillStyle = '#A0A0C0';
      ctx.font = 'bold 11px Arial';
      ctx.fillText(rows[i].label, cx, cy);
      ctx.fillStyle = rows[i].color;
      ctx.font = 'bold 22px Arial';
      ctx.fillText(rows[i].value, cx, cy + 24);
    }

    // Hint / call-to-improve
    ctx.fillStyle = '#FFFFFFAA';
    ctx.font = 'italic 12px Arial';
    ctx.fillText(this.improvementHint(stats), w / 2, py + panelH - 56);

    // Dismiss prompt — pulse once armed
    const armed = this.recapDismissArmed;
    if (armed) {
      const pulse = 0.7 + 0.3 * Math.sin(this.recapTimer * 5);
      ctx.globalAlpha = alpha * pulse;
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 14px Arial';
      ctx.fillText('PRESS SPACE / ENTER TO CONTINUE', w / 2, py + panelH - 24);
    } else {
      ctx.globalAlpha = alpha * 0.5;
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '12px Arial';
      ctx.fillText('...', w / 2, py + panelH - 24);
    }

    ctx.restore();
  }

  private improvementHint(s: RecapStats): string {
    // Cause-specific hints come first — they speak to what just killed you.
    switch (s.cause) {
      case 'chopper_bomb':
        return 'Watch the reticle — bombs lock to a fixed spot. Keep moving.';
      case 'civilian_spree':
        return 'Hold fire when civilians are in your lane.';
      case 'enemy_bullet':
        return 'Strafe early — Shooter bullets track your last position.';
      case 'enemy_ram':
        return 'Side-swipe cars to shove them off the road — head-on still totals you.';
      case 'tank_shell':
        return 'Missile the tank fast — its shells will wear you down otherwise.';
      case 'drone_swoop':
        return 'Drones telegraph with a red ring before they swoop — move then.';
      case 'self_end':
        // Fall through to generic advice below.
        break;
    }
    if (s.vanPickups === 0) return 'Find weapon vans for missiles, oil, and smoke.';
    if (s.combo < 3) return 'Chain kills without civilian hits to multiply your score.';
    if (s.kills < 5) return 'Hold SPACE to autofire — clear the road.';
    if (s.topSpeed < 600) return 'Hold W to push your top speed and rack distance.';
    return 'Solid run! Push for a bigger combo next time.';
  }

  private drawRoundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  private renderMotionLines(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // Speed lines along sides — intensity scales with player speed above base
    const intensity = Math.max(0, (this.player.speed - PLAYER.BASE_SPEED) / (PLAYER.BOOST_SPEED - PLAYER.BASE_SPEED));
    if (intensity <= 0.05) return;
    ctx.save();
    ctx.fillStyle = `rgba(0,255,255,${0.35 * intensity})`;
    const lineCount = 6;
    const t = this.gameTime * 6;
    for (let i = 0; i < lineCount; i++) {
      const yOff = ((i / lineCount) * h + ((t * 220) % h)) % h;
      const len = 30 + intensity * 60;
      const wobble = MOTION_LINE_OFFSETS[i % MOTION_LINE_OFFSETS.length] * 30;
      // Left side
      ctx.fillRect(20 + wobble, yOff, 2, len);
      // Right side
      ctx.fillRect(w - 22 - wobble, (yOff + 80) % h, 2, len);
    }
    ctx.restore();
  }

  protected onRenderUI(ctx: CanvasRenderingContext2D): void {
    if (this.recapMode) return; // recap panel takes over the screen
    ctx.save();
    ctx.fillStyle = '#00FFFF';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`SPEED ${Math.round(this.player.speed)}`, this.canvas.width - 20, 40);
    ctx.fillText(`DIST ${Math.round(this.distance)}m`, this.canvas.width - 20, 65);
    ctx.fillText(`KILLS ${this.enemiesDestroyed}`, this.canvas.width - 20, 90);

    // Section indicator + progress bar (right HUD)
    const sectIdx = this.sectionIndex + 1;
    const sectTotal = SECTIONS.length;
    const sectColor = this.currentSection.palette.bannerColor;
    ctx.fillStyle = sectColor;
    ctx.font = 'bold 12px Arial';
    ctx.fillText(`SECTION ${sectIdx}/${sectTotal}`, this.canvas.width - 20, 114);
    const barW = 110;
    const barH = 4;
    const barX = this.canvas.width - 20 - barW;
    const barY = 120;
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(barX, barY, barW, barH);
    const pct = Math.min(1, this.sectionProgress / this.currentSection.lengthMeters);
    ctx.fillStyle = sectColor;
    ctx.fillRect(barX, barY, barW * pct, barH);
    ctx.textAlign = 'right';

    // Combo meter
    ctx.textAlign = 'left';
    if (this.combo > 1) {
      ctx.fillStyle = '#FF1493';
      ctx.font = 'bold 22px Arial';
      ctx.fillText(`x${this.combo}`, 20, 40);
      ctx.fillStyle = '#FFFFFF88';
      ctx.font = '11px Arial';
      const barW = 60;
      const filled = Math.max(0, this.comboTimer / COMBO_DECAY_TIME) * barW;
      ctx.fillRect(20, 46, barW, 3);
      ctx.fillStyle = '#FF1493';
      ctx.fillRect(20, 46, filled, 3);
    }

    // Civilian danger
    ctx.fillStyle = this.civiliansLost > 0 ? '#FF6347' : '#FFFFFF88';
    ctx.font = 'bold 14px Arial';
    ctx.fillText(`CIVS ${this.civiliansLost}/${CIVILIANS_LOST_GAME_OVER}`, 20, 70);

    // Lives indicator — small car icons
    this.renderLivesIcons(ctx, 130, 60);

    // Chassis integrity — stylized armor-plate meter below the lives icons.
    this.renderChassisMeter(ctx, 130, 78);

    // Secondary weapon
    if (this.secondary.active) {
      const cfg = SECONDARY_CONFIGS[this.secondary.active];
      ctx.fillStyle = cfg.hudColor;
      ctx.font = 'bold 14px Arial';
      ctx.fillText(`[Q] ${cfg.label} ×${this.secondary.ammo}`, 20, 92);
    } else {
      ctx.fillStyle = '#FFFFFF44';
      ctx.font = '12px Arial';
      ctx.fillText('NO SECONDARY — find a weapon van', 20, 92);
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFFAA';
    ctx.font = '12px Arial';
    ctx.fillText(
      'A/D steer · W accel · S brake · SPACE fire · Q secondary · ESC end',
      this.canvas.width / 2,
      this.canvas.height - 12,
    );
    ctx.restore();

    if (this.bannerTimer > 0 && this.bannerSection) {
      this.renderSectionBanner(ctx, this.bannerSection);
    }

    if (this.lifeLostFlash > 0) this.renderLifeLostOverlay(ctx);
    if (this.lifeBonusFlash > 0) this.renderExtraLifeOverlay(ctx);
    if (this.sectionClearFlash > 0) this.renderSectionClearOverlay(ctx);

    this.touch.render(ctx);
  }

  // Chassis integrity meter — three angled armor plates that fill with neon
  // green when healthy and shift to amber/red as you take hits. The most
  // recently damaged plate glitches/flashes red briefly for impact feedback.
  private renderChassisMeter(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const plates = MAX_HP;
    const plateW = 16;
    const plateH = 10;
    const gap = 3;
    const skew = 4; // parallelogram slant for stylized "armor panel" look
    const flashT = this.hitFlash > 0 ? this.hitFlash / HIT_FLASH_DURATION : 0;

    ctx.save();
    ctx.font = 'bold 9px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#FFFFFF88';
    ctx.fillText('CHASSIS', x, y - 10);

    for (let i = 0; i < plates; i++) {
      const px = x + i * (plateW + gap);
      const intact = i < this.hp;
      const isMostRecent = i === this.hp; // the plate we just lost

      // Base plate (parallelogram)
      ctx.beginPath();
      ctx.moveTo(px + skew, y);
      ctx.lineTo(px + plateW + skew, y);
      ctx.lineTo(px + plateW, y + plateH);
      ctx.lineTo(px, y + plateH);
      ctx.closePath();

      if (intact) {
        // Green→amber gradient based on how much HP is left (panic colour as HP drops)
        const hpRatio = this.hp / MAX_HP;
        const fill =
          hpRatio > 0.66 ? '#00FFA8' : hpRatio > 0.33 ? '#FFD700' : '#FF8040';
        ctx.fillStyle = fill;
        ctx.shadowColor = fill;
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;
        // Rivet highlights
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fillRect(px + skew + 2, y + 2, 1, 1);
        ctx.fillRect(px + plateW + skew - 3, y + 2, 1, 1);
      } else {
        // Destroyed plate — dim red silhouette with a cracked diagonal line
        ctx.fillStyle = isMostRecent && flashT > 0
          ? `rgba(255,60,90,${0.4 + 0.5 * flashT})`
          : 'rgba(60,20,30,0.55)';
        ctx.fill();
        ctx.strokeStyle = isMostRecent && flashT > 0 ? '#FF4060' : '#883344';
        ctx.lineWidth = 1;
        ctx.stroke();
        // Crack line
        ctx.beginPath();
        ctx.moveTo(px + 2, y + plateH - 2);
        ctx.lineTo(px + plateW - 2, y + 2);
        ctx.strokeStyle = isMostRecent && flashT > 0 ? '#FFCCDD' : '#552233';
        ctx.stroke();
      }
    }

    // Global post-hit red sweep across the whole meter
    if (flashT > 0) {
      const totalW = plates * plateW + (plates - 1) * gap + skew;
      ctx.globalAlpha = 0.45 * flashT;
      ctx.fillStyle = '#FF2040';
      ctx.fillRect(x - 2, y - 2, totalW + 4, plateH + 4);
    }

    ctx.restore();
  }

  private renderLivesIcons(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    const iconW = 8;
    const iconH = 12;
    const gap = 4;
    for (let i = 0; i < MAX_LIVES; i++) {
      const ix = x + i * (iconW + gap);
      const owned = i < this.lives;
      ctx.fillStyle = owned ? '#FF1493' : '#33334455';
      ctx.fillRect(ix, y, iconW, iconH);
      if (owned) {
        // Pink windshield highlight to read as a tiny car
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(ix + 2, y + 3, iconW - 4, 3);
      }
    }
    ctx.restore();
  }

  private renderLifeLostOverlay(ctx: CanvasRenderingContext2D): void {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const t = this.lifeLostFlash / LIFE_LOST_FLASH_DURATION; // 1 → 0
    // Red vignette pulse
    ctx.save();
    ctx.globalAlpha = 0.35 * t;
    const grad = ctx.createRadialGradient(w / 2, h / 2, h * 0.15, w / 2, h / 2, h * 0.7);
    grad.addColorStop(0, 'rgba(255,40,80,0)');
    grad.addColorStop(1, 'rgba(255,20,60,1)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    // Headline
    ctx.globalAlpha = t;
    ctx.textAlign = 'center';
    ctx.shadowColor = '#FF003C';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#FF6680';
    ctx.font = 'bold 38px Arial';
    ctx.fillText('LIFE LOST', w / 2, h / 2 - 10);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#FFFFFFAA';
    ctx.font = 'bold 14px Arial';
    ctx.fillText(`${this.lives} ${this.lives === 1 ? 'life' : 'lives'} remaining`, w / 2, h / 2 + 18);
    ctx.restore();
  }

  private renderSectionClearOverlay(ctx: CanvasRenderingContext2D): void {
    const w = this.canvas.width;
    const t = this.sectionClearFlash / SECTION_CLEAR_FLASH_DURATION; // 1 → 0
    const eased = Math.sin(t * Math.PI); // peaks mid-flash
    ctx.save();
    ctx.globalAlpha = eased;
    ctx.textAlign = 'center';
    ctx.shadowColor = '#00FFCC';
    ctx.shadowBlur = 22;
    ctx.fillStyle = '#00FFCC';
    ctx.font = 'bold 28px Arial';
    ctx.fillText('SECTION CLEAR', w / 2, 260);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 22px Arial';
    ctx.fillText(`+${this.sectionClearBonusLast.toLocaleString()}`, w / 2, 288);
    ctx.restore();
  }

  private renderExtraLifeOverlay(ctx: CanvasRenderingContext2D): void {
    const w = this.canvas.width;
    const t = this.lifeBonusFlash / LIFE_BONUS_FLASH_DURATION; // 1 → 0
    const eased = Math.sin(t * Math.PI); // peaks mid-flash
    ctx.save();
    ctx.globalAlpha = eased;
    ctx.textAlign = 'center';
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 24;
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 32px Arial';
    ctx.fillText('★ EXTRA LIFE ★', w / 2, 230);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#FFFFFFCC';
    ctx.font = 'bold 12px Arial';
    ctx.fillText(`${this.lives} / ${MAX_LIVES}`, w / 2, 250);
    ctx.restore();
  }

  private renderSectionBanner(ctx: CanvasRenderingContext2D, section: SectionDef): void {
    const elapsed = BANNER_TOTAL - this.bannerTimer;
    let alpha = 1;
    let slide = 0; // px offset, slides up from below
    if (elapsed < BANNER_FADE_IN) {
      const t = elapsed / BANNER_FADE_IN;
      const eased = 1 - Math.pow(1 - t, 3);
      alpha = eased;
      slide = (1 - eased) * 24;
    } else if (elapsed > BANNER_FADE_IN + BANNER_HOLD) {
      const t = (elapsed - BANNER_FADE_IN - BANNER_HOLD) / BANNER_FADE_OUT;
      const eased = Math.pow(t, 2);
      alpha = 1 - eased;
      slide = -eased * 12;
    }
    if (alpha <= 0.01) return;

    const w = this.canvas.width;
    const cx = w / 2;
    const cy = 168 + slide;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    // Eyebrow: "SECTION N/M"
    const sectIdx = this.sectionIndex + 1;
    ctx.fillStyle = '#FFFFFFCC';
    ctx.font = 'bold 12px Arial';
    ctx.fillText(`SECTION ${sectIdx} / ${SECTIONS.length}`, cx, cy - 36);

    // Big headline with neon glow
    ctx.shadowColor = section.palette.bannerGlow;
    ctx.shadowBlur = 22;
    ctx.fillStyle = section.palette.bannerColor;
    ctx.font = 'bold 44px Arial';
    ctx.fillText(section.name, cx, cy);

    // Second pass for extra glow punch
    ctx.shadowBlur = 12;
    ctx.fillText(section.name, cx, cy);
    ctx.shadowBlur = 0;

    // Animated underline — draws in during fade-in, stays during hold, fades during fade-out
    let underlinePct = 1;
    if (elapsed < BANNER_FADE_IN) {
      underlinePct = elapsed / BANNER_FADE_IN;
    }
    const headlineWidth = ctx.measureText(section.name).width;
    const underlineMax = Math.max(160, Math.min(headlineWidth + 60, w - 80));
    const underlineW = underlineMax * underlinePct;
    ctx.fillStyle = section.palette.bannerColor;
    ctx.fillRect(cx - underlineW / 2, cy + 10, underlineW, 2);

    // Subtitle — append LOOP N on repeat playthroughs so the player can read
    // the difficulty jump. First loop prints the section's base subtitle only.
    ctx.fillStyle = '#FFFFFFAA';
    ctx.font = '13px Arial';
    const subtitle =
      this.wraparounds > 0
        ? `${section.subtitle} · LOOP ${this.wraparounds + 1}`
        : section.subtitle;
    ctx.fillText(subtitle, cx, cy + 32);

    ctx.restore();
  }

  protected onDestroy(): void {
    if (this.endHandler) {
      window.removeEventListener('keydown', this.endHandler);
      this.endHandler = undefined;
    }
  }

  protected onRestart(): void {
    this.roadProfile.reset();
    this.sectionStartScroll = 0;
    this.player.reset();
    this.road.reset();
    this.weapon.reset();
    this.spawner.reset();
    this.secondary.reset();
    this.particles.reset();
    this.shake.reset();
    this.boss.reset();
    this.terrainHazards.reset();
    this.weather.reset();
    this.touch.reset();
    this.muzzleTimer = 0;
    this.distance = 0;
    this.maxSpeed = 0;
    this.enemiesDestroyed = 0;
    this.civiliansLost = 0;
    this.combo = 1;
    this.maxCombo = 1;
    this.comboTimer = 0;
    this.vanPickups = 0;
    this.secondaryFireWasDown = false;
    this.shotsFired = 0;
    this.pacifistDistance = 0;
    this.pacifistCurrent = 0;
    this.choppersKilled = 0;
    this.civiliansLostThisSection = 0;
    this.perfectSectionsCleared = 0;
    this.visitedSections = new Set<number>();
    this.slowedEnemies = new WeakMap();
    this.recapMode = false;
    this.recapTimer = 0;
    this.recapStats = null;
    this.recapDismissArmed = false;
    this.sectionIndex = 0;
    this.sectionProgress = 0;
    this.sectionsCleared = 0;
    this.wraparounds = 0;
    this.currentSection = getSection(0);
    this.visitedSections.add(this.sectionIndex);
    this.spawner.configure(this.currentSection.spawnerConfig);
    this.applyTerrainHandling();
    this.applyRoadProfile();
    this.armBanner(this.currentSection);
    this.lives = STARTING_LIVES;
    this.nextLifeBonusIndex = 0;
    this.respawnInvuln = 0;
    this.lifeLostFlash = 0;
    this.lifeBonusFlash = 0;
    this.sectionClearFlash = 0;
    this.sectionClearBonusLast = 0;
    this.hp = MAX_HP;
    this.hitFlash = 0;
    this.spawner.scheduleVanIn(6);
  }
}
