// ===== src/games/tapdodge/systems/WaveSystem.ts =====

export type ZoneType = 'calm' | 'rising' | 'intense' | 'chaos';

export interface ZoneConfig {
    name: string;
    type: ZoneType;
    spawnInterval: number; // base spawn interval in seconds
    speedMultiplier: number;
    obstacleTypes: ('block' | 'spike' | 'wall' | 'moving')[];
    powerUpChance: number;
    wallChance: number; // chance for wall-with-gap patterns
    movingChance: number;
    colors: {
        primary: string;
        secondary: string;
        accent: string;
    };
}

const ZONE_CONFIGS: ZoneConfig[] = [
    {
        name: 'Zone 1: Calm Waters',
        type: 'calm',
        spawnInterval: 1.2,
        speedMultiplier: 1.0,
        obstacleTypes: ['block'],
        powerUpChance: 0.08,
        wallChance: 0.1,
        movingChance: 0,
        colors: {
            primary: '#1E3A5F',
            secondary: '#0D1B2A',
            accent: '#22D3EE'
        }
    },
    {
        name: 'Zone 2: Rising Tide',
        type: 'rising',
        spawnInterval: 0.9,
        speedMultiplier: 1.25,
        obstacleTypes: ['block', 'spike'],
        powerUpChance: 0.1,
        wallChance: 0.25,
        movingChance: 0.1,
        colors: {
            primary: '#2D1B4E',
            secondary: '#1A0F2E',
            accent: '#A78BFA'
        }
    },
    {
        name: 'Zone 3: Storm Front',
        type: 'intense',
        spawnInterval: 0.7,
        speedMultiplier: 1.5,
        obstacleTypes: ['block', 'spike', 'wall'],
        powerUpChance: 0.12,
        wallChance: 0.35,
        movingChance: 0.2,
        colors: {
            primary: '#4A1D1D',
            secondary: '#2D0F0F',
            accent: '#F97316'
        }
    },
    {
        name: 'Zone 4: Chaos Realm',
        type: 'chaos',
        spawnInterval: 0.55,
        speedMultiplier: 1.75,
        obstacleTypes: ['block', 'spike', 'wall', 'moving'],
        powerUpChance: 0.15,
        wallChance: 0.4,
        movingChance: 0.3,
        colors: {
            primary: '#4A0F2E',
            secondary: '#2D0A1D',
            accent: '#EF4444'
        }
    }
];

export class WaveSystem {
    private gameTime: number = 0;
    private currentZoneIndex: number = 0;

    // Zone timing
    private readonly ZONE_DURATION = 30; // seconds per zone

    // Boss wave system
    private bossWaveActive: boolean = false;
    private bossWaveTimer: number = 0;
    private bossWaveWarningTimer: number = 0;
    private lastBossWaveTime: number = 0;
    private bossesCleared: number = 0;

    private readonly BOSS_WAVE_INTERVAL = 45; // seconds between boss waves
    private readonly BOSS_WAVE_WARNING_DURATION = 3; // warning before boss
    private readonly BOSS_WAVE_DURATION = 10; // boss wave length

    // Callbacks
    private onZoneChange?: (zone: ZoneConfig, index: number) => void;
    private onBossWaveStart?: () => void;
    private onBossWaveEnd?: (survived: boolean) => void;
    private onBossWaveWarning?: (countdown: number) => void;

    public update(dt: number): void {
        this.gameTime += dt;

        // Update zone based on time
        const newZoneIndex = Math.min(
            ZONE_CONFIGS.length - 1,
            Math.floor(this.gameTime / this.ZONE_DURATION)
        );

        if (newZoneIndex !== this.currentZoneIndex) {
            this.currentZoneIndex = newZoneIndex;
            this.onZoneChange?.(this.getCurrentZone(), this.currentZoneIndex);
        }

        // Boss wave logic
        if (this.bossWaveActive) {
            this.bossWaveTimer -= dt;
            if (this.bossWaveTimer <= 0) {
                this.endBossWave(true);
            }
        } else if (this.bossWaveWarningTimer > 0) {
            // Warning countdown
            const prevSecond = Math.ceil(this.bossWaveWarningTimer);
            this.bossWaveWarningTimer -= dt;
            const currSecond = Math.ceil(this.bossWaveWarningTimer);

            if (currSecond !== prevSecond) {
                this.onBossWaveWarning?.(currSecond);
            }

            if (this.bossWaveWarningTimer <= 0) {
                this.startBossWave();
            }
        } else {
            // Check if it's time for a boss wave
            const timeSinceLastBoss = this.gameTime - this.lastBossWaveTime;
            if (timeSinceLastBoss >= this.BOSS_WAVE_INTERVAL && this.gameTime > 10) {
                this.beginBossWarning();
            }
        }
    }

    // ===== Zone System =====

    public getCurrentZone(): ZoneConfig {
        return ZONE_CONFIGS[this.currentZoneIndex];
    }

    public getZoneIndex(): number {
        return this.currentZoneIndex;
    }

    public getZoneProgress(): number {
        // Progress within current zone (0-1)
        return (this.gameTime % this.ZONE_DURATION) / this.ZONE_DURATION;
    }

    public getSpawnInterval(): number {
        const zone = this.getCurrentZone();
        // Boss waves spawn faster
        const bossMultiplier = this.bossWaveActive ? 0.5 : 1;
        return zone.spawnInterval * bossMultiplier;
    }

    public getSpeedMultiplier(): number {
        const zone = this.getCurrentZone();
        // Boss waves are faster
        const bossMultiplier = this.bossWaveActive ? 1.3 : 1;
        return zone.speedMultiplier * bossMultiplier;
    }

    public shouldSpawnWall(): boolean {
        const zone = this.getCurrentZone();
        return Math.random() < zone.wallChance;
    }

    public shouldSpawnMoving(): boolean {
        const zone = this.getCurrentZone();
        return Math.random() < zone.movingChance;
    }

    public shouldSpawnPowerUp(): boolean {
        if (this.bossWaveActive) return false; // No power-ups during boss
        const zone = this.getCurrentZone();
        return Math.random() < zone.powerUpChance;
    }

    public getRandomObstacleType(): 'block' | 'spike' | 'wall' | 'moving' {
        const zone = this.getCurrentZone();
        const types = zone.obstacleTypes;
        return types[Math.floor(Math.random() * types.length)];
    }

    // ===== Boss Wave System =====

    private beginBossWarning(): void {
        this.bossWaveWarningTimer = this.BOSS_WAVE_WARNING_DURATION;
        this.onBossWaveWarning?.(3);
    }

    private startBossWave(): void {
        this.bossWaveActive = true;
        this.bossWaveTimer = this.BOSS_WAVE_DURATION;
        this.onBossWaveStart?.();
    }

    private endBossWave(survived: boolean): void {
        this.bossWaveActive = false;
        this.bossWaveTimer = 0;
        this.lastBossWaveTime = this.gameTime;
        if (survived) {
            this.bossesCleared++;
        }
        this.onBossWaveEnd?.(survived);
    }

    public isBossWaveActive(): boolean {
        return this.bossWaveActive;
    }

    public isBossWarningActive(): boolean {
        return this.bossWaveWarningTimer > 0;
    }

    public getBossWaveTimeLeft(): number {
        return this.bossWaveTimer;
    }

    public getBossWarningTimeLeft(): number {
        return this.bossWaveWarningTimer;
    }

    public failBossWave(): void {
        if (this.bossWaveActive) {
            this.endBossWave(false);
        }
    }

    // ===== Callbacks =====

    public setOnZoneChange(callback: (zone: ZoneConfig, index: number) => void): void {
        this.onZoneChange = callback;
    }

    public setOnBossWaveStart(callback: () => void): void {
        this.onBossWaveStart = callback;
    }

    public setOnBossWaveEnd(callback: (survived: boolean) => void): void {
        this.onBossWaveEnd = callback;
    }

    public setOnBossWaveWarning(callback: (countdown: number) => void): void {
        this.onBossWaveWarning = callback;
    }

    // ===== Utility =====

    public getGameTime(): number {
        return this.gameTime;
    }

    public reset(): void {
        this.gameTime = 0;
        this.currentZoneIndex = 0;
        this.bossWaveActive = false;
        this.bossWaveTimer = 0;
        this.bossWaveWarningTimer = 0;
        this.lastBossWaveTime = 0;
        this.bossesCleared = 0;
    }

    public getBossesCleared(): number {
        return this.bossesCleared;
    }
}
