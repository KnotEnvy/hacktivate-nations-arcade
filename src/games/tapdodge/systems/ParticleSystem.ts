// ===== src/games/tapdodge/systems/ParticleSystem.ts =====
import { Particle, ParticleConfig } from '../entities/Particle';

export class ParticleSystem {
    private particles: Particle[] = [];
    private readonly MAX_PARTICLES = 300;

    public update(dt: number): void {
        // Update all particles and remove dead ones
        this.particles = this.particles.filter(p => p.update(dt));

        // Cap particle count
        if (this.particles.length > this.MAX_PARTICLES) {
            this.particles = this.particles.slice(-this.MAX_PARTICLES);
        }
    }

    public render(ctx: CanvasRenderingContext2D): void {
        for (const particle of this.particles) {
            particle.render(ctx);
        }
    }

    private spawn(config: ParticleConfig): void {
        this.particles.push(new Particle(config));
    }

    public clear(): void {
        this.particles = [];
    }

    // ===== Effect Presets =====

    public createCoinPickup(x: number, y: number): void {
        // Gold burst
        for (let i = 0; i < 12; i++) {
            const angle = (Math.PI * 2 * i) / 12;
            const speed = 80 + Math.random() * 60;
            this.spawn({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.5 + Math.random() * 0.3,
                color: '#FBBF24',
                size: 4 + Math.random() * 4,
                gravity: 100,
                shape: 'circle'
            });
        }

        // White sparkles
        for (let i = 0; i < 6; i++) {
            this.spawn({
                x: x + (Math.random() - 0.5) * 20,
                y: y + (Math.random() - 0.5) * 20,
                vx: (Math.random() - 0.5) * 40,
                vy: -60 - Math.random() * 40,
                life: 0.6,
                color: '#FFFFFF',
                size: 6,
                gravity: 50,
                shape: 'star'
            });
        }
    }

    public createPowerUpPickup(x: number, y: number, color: string): void {
        // Radial burst
        for (let i = 0; i < 16; i++) {
            const angle = (Math.PI * 2 * i) / 16;
            const speed = 100 + Math.random() * 80;
            this.spawn({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.8,
                color: color,
                size: 6 + Math.random() * 4,
                gravity: 50,
                shape: 'square'
            });
        }

        // Central flash
        for (let i = 0; i < 8; i++) {
            this.spawn({
                x,
                y,
                vx: (Math.random() - 0.5) * 150,
                vy: (Math.random() - 0.5) * 150,
                life: 0.4,
                color: '#FFFFFF',
                size: 10 + Math.random() * 8,
                gravity: 0,
                shrink: true,
                shape: 'star'
            });
        }
    }

    public createNearMiss(x: number, y: number): void {
        // Blue streak effect
        for (let i = 0; i < 8; i++) {
            this.spawn({
                x: x + (Math.random() - 0.5) * 30,
                y,
                vx: (Math.random() - 0.5) * 60,
                vy: -80 - Math.random() * 60,
                life: 0.4 + Math.random() * 0.2,
                color: '#60A5FA',
                size: 3 + Math.random() * 3,
                gravity: 80,
                shape: 'circle'
            });
        }

        // Speed lines
        for (let i = 0; i < 4; i++) {
            this.spawn({
                x: x + (Math.random() - 0.5) * 40,
                y: y + (Math.random() - 0.5) * 20,
                vx: 0,
                vy: 150 + Math.random() * 100,
                life: 0.3,
                color: '#93C5FD',
                size: 15,
                gravity: 0,
                friction: 1,
                shape: 'line'
            });
        }
    }

    public createExplosion(x: number, y: number, color: string = '#EF4444'): void {
        // Main explosion
        for (let i = 0; i < 24; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 100 + Math.random() * 150;
            this.spawn({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.6 + Math.random() * 0.4,
                color: color,
                size: 4 + Math.random() * 6,
                gravity: 200,
                shape: Math.random() > 0.5 ? 'square' : 'circle'
            });
        }

        // Ember sparks
        for (let i = 0; i < 12; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 60 + Math.random() * 80;
            this.spawn({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 100,
                life: 0.8 + Math.random() * 0.4,
                color: '#FCD34D',
                size: 2 + Math.random() * 2,
                gravity: 300,
                shape: 'circle'
            });
        }
    }

    public createTrail(x: number, y: number, color: string = '#22D3EE'): void {
        this.spawn({
            x: x + (Math.random() - 0.5) * 10,
            y: y + (Math.random() - 0.5) * 10,
            vx: (Math.random() - 0.5) * 20,
            vy: 30 + Math.random() * 20,
            life: 0.3,
            color: color,
            size: 4 + Math.random() * 4,
            gravity: 0,
            friction: 0.95,
            shrink: true,
            shape: 'circle'
        });
    }

    public createDeathExplosion(x: number, y: number, canvasWidth: number): void {
        // Multiple explosions across screen
        for (let i = 0; i < 6; i++) {
            const ex = (i + 0.5) * (canvasWidth / 6);
            const ey = y - 40 + Math.random() * 80;

            setTimeout(() => {
                this.createExplosion(ex, ey, '#EF4444');
            }, i * 100);
        }
    }

    public createBossWarning(canvasWidth: number, canvasHeight: number): void {
        // Warning particles from edges
        for (let i = 0; i < 20; i++) {
            // Left edge
            this.spawn({
                x: 0,
                y: Math.random() * canvasHeight,
                vx: 150 + Math.random() * 100,
                vy: (Math.random() - 0.5) * 50,
                life: 0.8,
                color: '#F97316',
                size: 4,
                gravity: 0,
                shape: 'square'
            });

            // Right edge
            this.spawn({
                x: canvasWidth,
                y: Math.random() * canvasHeight,
                vx: -150 - Math.random() * 100,
                vy: (Math.random() - 0.5) * 50,
                life: 0.8,
                color: '#F97316',
                size: 4,
                gravity: 0,
                shape: 'square'
            });
        }
    }

    public createCoinShower(canvasWidth: number): void {
        // Coins falling from top
        for (let i = 0; i < 30; i++) {
            setTimeout(() => {
                this.spawn({
                    x: Math.random() * canvasWidth,
                    y: -20,
                    vx: (Math.random() - 0.5) * 40,
                    vy: 100 + Math.random() * 100,
                    life: 2,
                    color: '#FBBF24',
                    size: 8,
                    gravity: 150,
                    friction: 0.99,
                    shape: 'circle'
                });
            }, i * 50);
        }
    }

    public createDroneShot(x: number, y: number): void {
        // Muzzle flash
        for (let i = 0; i < 6; i++) {
            const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.5;
            const speed = 60 + Math.random() * 40;
            this.spawn({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.2,
                color: '#60A5FA',
                size: 3,
                gravity: 0,
                shape: 'circle'
            });
        }
    }

    public createObstacleDestroy(x: number, y: number): void {
        // Debris
        for (let i = 0; i < 16; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 80 + Math.random() * 120;
            this.spawn({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.5 + Math.random() * 0.3,
                color: i % 2 === 0 ? '#DC2626' : '#7F1D1D',
                size: 5 + Math.random() * 5,
                gravity: 250,
                shape: 'square'
            });
        }

        // Sparks
        for (let i = 0; i < 8; i++) {
            this.spawn({
                x,
                y,
                vx: (Math.random() - 0.5) * 200,
                vy: -100 - Math.random() * 100,
                life: 0.4,
                color: '#F59E0B',
                size: 3,
                gravity: 400,
                shape: 'star'
            });
        }
    }
}
