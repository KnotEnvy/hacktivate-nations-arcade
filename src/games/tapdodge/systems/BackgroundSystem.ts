// ===== src/games/tapdodge/systems/BackgroundSystem.ts =====
// AAA-Quality Visual System with parallax layers, animated elements, and post-processing

interface NebulaCloud {
    x: number;
    y: number;
    radius: number;
    color: string;
    alpha: number;
    speed: number;
    phase: number;
}

interface FloatingOrb {
    x: number;
    y: number;
    size: number;
    speed: number;
    color: string;
    glowSize: number;
    phase: number;
}

interface LightningBolt {
    x: number;
    startY: number;
    endY: number;
    life: number;
    maxLife: number;
    branches: { x: number; y: number }[];
}

export class BackgroundSystem {
    private scrollOffset: number = 0;
    private gridOffset: number = 0;
    private time: number = 0;

    // Star field with depth layers
    private starField: { x: number; y: number; size: number; speed: number; alpha: number; twinklePhase: number }[] = [];

    // Nebula clouds (parallax layer 1)
    private nebulaClouds: NebulaCloud[] = [];

    // Floating orbs (parallax layer 2)
    private floatingOrbs: FloatingOrb[] = [];

    // Occasional lightning
    private lightningBolts: LightningBolt[] = [];
    private lightningTimer: number = 0;

    // Screen flash effect
    private flashIntensity: number = 0;
    private flashColor: string = '#FFFFFF';

    // Chromatic aberration on damage
    private chromaticIntensity: number = 0;

    private canvasWidth: number;
    private canvasHeight: number;

    constructor(canvasWidth: number, canvasHeight: number) {
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
        this.initStarField();
        this.initNebulaClouds();
        this.initFloatingOrbs();
    }

    private initStarField(): void {
        // Create layered star field with more stars
        for (let i = 0; i < 100; i++) {
            const layer = Math.floor(Math.random() * 4); // 0, 1, 2, 3 for depth
            this.starField.push({
                x: Math.random() * this.canvasWidth,
                y: Math.random() * this.canvasHeight,
                size: 0.5 + layer * 0.6,
                speed: 15 + layer * 25,
                alpha: 0.2 + layer * 0.2,
                twinklePhase: Math.random() * Math.PI * 2
            });
        }
    }

    private initNebulaClouds(): void {
        const colors = ['#7C3AED', '#EC4899', '#22D3EE', '#10B981', '#F59E0B'];
        for (let i = 0; i < 6; i++) {
            this.nebulaClouds.push({
                x: Math.random() * this.canvasWidth,
                y: Math.random() * this.canvasHeight * 0.6,
                radius: 80 + Math.random() * 120,
                color: colors[Math.floor(Math.random() * colors.length)],
                alpha: 0.03 + Math.random() * 0.04,
                speed: 5 + Math.random() * 10,
                phase: Math.random() * Math.PI * 2
            });
        }
    }

    private initFloatingOrbs(): void {
        for (let i = 0; i < 8; i++) {
            this.floatingOrbs.push({
                x: Math.random() * this.canvasWidth,
                y: Math.random() * this.canvasHeight,
                size: 3 + Math.random() * 5,
                speed: 30 + Math.random() * 40,
                color: Math.random() > 0.5 ? '#22D3EE' : '#A855F7',
                glowSize: 15 + Math.random() * 20,
                phase: Math.random() * Math.PI * 2
            });
        }
    }

    public update(dt: number, speedMultiplier: number = 1): void {
        this.time += dt;

        // Scroll grid
        this.gridOffset += 80 * speedMultiplier * dt;
        if (this.gridOffset > 40) this.gridOffset -= 40;

        // Update stars with twinkle
        for (const star of this.starField) {
            star.y += star.speed * speedMultiplier * dt;
            star.twinklePhase += dt * (2 + Math.random());
            if (star.y > this.canvasHeight) {
                star.y = -10;
                star.x = Math.random() * this.canvasWidth;
            }
        }

        // Update nebula clouds
        for (const cloud of this.nebulaClouds) {
            cloud.y += cloud.speed * speedMultiplier * dt;
            cloud.phase += dt * 0.5;
            cloud.x += Math.sin(cloud.phase) * 0.5;

            if (cloud.y - cloud.radius > this.canvasHeight) {
                cloud.y = -cloud.radius;
                cloud.x = Math.random() * this.canvasWidth;
            }
        }

        // Update floating orbs
        for (const orb of this.floatingOrbs) {
            orb.y += orb.speed * speedMultiplier * dt;
            orb.phase += dt * 3;
            orb.x += Math.sin(orb.phase) * 0.8;

            if (orb.y > this.canvasHeight + orb.glowSize) {
                orb.y = -orb.glowSize;
                orb.x = Math.random() * this.canvasWidth;
            }
        }

        // Lightning timer (random atmospheric lightning)
        this.lightningTimer -= dt;
        if (this.lightningTimer <= 0 && Math.random() < 0.01) {
            this.createLightning();
            this.lightningTimer = 3 + Math.random() * 5;
        }

        // Update lightning
        this.lightningBolts = this.lightningBolts.filter(bolt => {
            bolt.life -= dt;
            return bolt.life > 0;
        });

        // Decay effects
        this.flashIntensity *= 0.9;
        if (this.flashIntensity < 0.01) this.flashIntensity = 0;

        this.chromaticIntensity *= 0.95;
        if (this.chromaticIntensity < 0.01) this.chromaticIntensity = 0;

        this.scrollOffset += dt * 50 * speedMultiplier;
    }

    private createLightning(): void {
        const x = Math.random() * this.canvasWidth;
        const branches: { x: number; y: number }[] = [];
        let currentX = x;
        let currentY = 0;

        for (let i = 0; i < 8; i++) {
            currentX += (Math.random() - 0.5) * 40;
            currentY += this.canvasHeight / 8;
            branches.push({ x: currentX, y: currentY });
        }

        this.lightningBolts.push({
            x,
            startY: 0,
            endY: this.canvasHeight * 0.6,
            life: 0.15,
            maxLife: 0.15,
            branches
        });
    }

    public triggerFlash(color: string = '#FFFFFF', intensity: number = 0.5): void {
        this.flashColor = color;
        this.flashIntensity = intensity;
    }

    public triggerChromatic(intensity: number = 0.3): void {
        this.chromaticIntensity = intensity;
    }

    public render(ctx: CanvasRenderingContext2D, colors: { primary: string; secondary: string; accent: string }): void {
        // Background gradient with deeper colors
        const bgGradient = ctx.createLinearGradient(0, 0, 0, this.canvasHeight);
        bgGradient.addColorStop(0, this.darkenColor(colors.secondary, 0.3));
        bgGradient.addColorStop(0.3, colors.secondary);
        bgGradient.addColorStop(0.7, colors.primary);
        bgGradient.addColorStop(1, this.darkenColor(colors.secondary, 0.4));
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

        // Nebula clouds (behind everything)
        this.renderNebulaClouds(ctx);

        // Star field with twinkle
        this.renderStars(ctx, colors.accent);

        // Floating orbs with bloom
        this.renderFloatingOrbs(ctx);

        // Lightning
        this.renderLightning(ctx);

        // Grid lines (subtle)
        this.renderGrid(ctx, colors.accent);

        // Animated scan lines (subtle CRT effect)
        this.renderScanLines(ctx);

        // Vignette effect
        this.renderVignette(ctx);

        // Lane indicators with glow
        this.renderLaneIndicators(ctx, colors.accent);

        // Flash overlay
        if (this.flashIntensity > 0) {
            ctx.fillStyle = this.flashColor;
            ctx.globalAlpha = this.flashIntensity;
            ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
            ctx.globalAlpha = 1;
        }
    }

    private darkenColor(hex: string, amount: number): string {
        const num = parseInt(hex.replace('#', ''), 16);
        const r = Math.max(0, ((num >> 16) & 255) * (1 - amount));
        const g = Math.max(0, ((num >> 8) & 255) * (1 - amount));
        const b = Math.max(0, (num & 255) * (1 - amount));
        return `rgb(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)})`;
    }

    private renderNebulaClouds(ctx: CanvasRenderingContext2D): void {
        for (const cloud of this.nebulaClouds) {
            const pulseFactor = Math.sin(cloud.phase) * 0.2 + 1;
            const radius = cloud.radius * pulseFactor;

            const gradient = ctx.createRadialGradient(
                cloud.x, cloud.y, 0,
                cloud.x, cloud.y, radius
            );
            gradient.addColorStop(0, cloud.color);
            gradient.addColorStop(0.4, cloud.color);
            gradient.addColorStop(1, 'transparent');

            ctx.globalAlpha = cloud.alpha;
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(cloud.x, cloud.y, radius, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    private renderStars(ctx: CanvasRenderingContext2D, accentColor: string): void {
        for (const star of this.starField) {
            const twinkle = Math.sin(star.twinklePhase) * 0.4 + 0.6;
            ctx.globalAlpha = star.alpha * twinkle;

            // Subtle glow for larger stars
            if (star.size > 1.5) {
                const glowGradient = ctx.createRadialGradient(
                    star.x, star.y, 0,
                    star.x, star.y, star.size * 3
                );
                glowGradient.addColorStop(0, accentColor);
                glowGradient.addColorStop(1, 'transparent');
                ctx.fillStyle = glowGradient;
                ctx.beginPath();
                ctx.arc(star.x, star.y, star.size * 3, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    private renderFloatingOrbs(ctx: CanvasRenderingContext2D): void {
        for (const orb of this.floatingOrbs) {
            const pulse = Math.sin(orb.phase) * 0.3 + 0.7;

            // Outer glow
            const glowGradient = ctx.createRadialGradient(
                orb.x, orb.y, 0,
                orb.x, orb.y, orb.glowSize * pulse
            );
            glowGradient.addColorStop(0, orb.color);
            glowGradient.addColorStop(0.3, orb.color + '40');
            glowGradient.addColorStop(1, 'transparent');

            ctx.fillStyle = glowGradient;
            ctx.beginPath();
            ctx.arc(orb.x, orb.y, orb.glowSize * pulse, 0, Math.PI * 2);
            ctx.fill();

            // Core
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.arc(orb.x, orb.y, orb.size * pulse, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    private renderLightning(ctx: CanvasRenderingContext2D): void {
        for (const bolt of this.lightningBolts) {
            const alphaFactor = bolt.life / bolt.maxLife;

            ctx.strokeStyle = `rgba(255, 255, 255, ${alphaFactor * 0.8})`;
            ctx.lineWidth = 2;
            ctx.shadowColor = '#22D3EE';
            ctx.shadowBlur = 20;

            ctx.beginPath();
            ctx.moveTo(bolt.x, bolt.startY);
            for (const branch of bolt.branches) {
                ctx.lineTo(branch.x, branch.y);
            }
            ctx.stroke();

            ctx.shadowBlur = 0;
        }
    }

    private renderGrid(ctx: CanvasRenderingContext2D, accentColor: string): void {
        const gridSize = 40;

        // Vertical lines with gradient fade
        for (let x = 0; x <= this.canvasWidth; x += gridSize) {
            const gradient = ctx.createLinearGradient(0, 0, 0, this.canvasHeight);
            gradient.addColorStop(0, 'transparent');
            gradient.addColorStop(0.3, accentColor + '10');
            gradient.addColorStop(0.7, accentColor + '15');
            gradient.addColorStop(1, accentColor + '08');

            ctx.strokeStyle = gradient;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.canvasHeight);
            ctx.stroke();
        }

        // Horizontal lines (scrolling)
        for (let y = this.gridOffset; y < this.canvasHeight + gridSize; y += gridSize) {
            ctx.strokeStyle = accentColor + '10';
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.canvasWidth, y);
            ctx.stroke();
        }

        // Center line with glow
        const centerGradient = ctx.createLinearGradient(
            this.canvasWidth / 2 - 5, 0,
            this.canvasWidth / 2 + 5, 0
        );
        centerGradient.addColorStop(0, 'transparent');
        centerGradient.addColorStop(0.5, accentColor + '40');
        centerGradient.addColorStop(1, 'transparent');

        ctx.fillStyle = centerGradient;
        ctx.fillRect(this.canvasWidth / 2 - 5, 0, 10, this.canvasHeight);
    }

    private renderScanLines(ctx: CanvasRenderingContext2D): void {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
        for (let y = 0; y < this.canvasHeight; y += 3) {
            ctx.fillRect(0, y, this.canvasWidth, 1);
        }

        // Moving highlight line
        const highlightY = (this.time * 100) % (this.canvasHeight + 100) - 50;
        const highlightGradient = ctx.createLinearGradient(0, highlightY - 25, 0, highlightY + 25);
        highlightGradient.addColorStop(0, 'transparent');
        highlightGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.02)');
        highlightGradient.addColorStop(1, 'transparent');
        ctx.fillStyle = highlightGradient;
        ctx.fillRect(0, highlightY - 25, this.canvasWidth, 50);
    }

    private renderVignette(ctx: CanvasRenderingContext2D): void {
        const gradient = ctx.createRadialGradient(
            this.canvasWidth / 2, this.canvasHeight / 2, 0,
            this.canvasWidth / 2, this.canvasHeight / 2, this.canvasWidth * 0.8
        );
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(0.6, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(0.85, 'rgba(0, 0, 0, 0.3)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.7)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
    }

    private renderLaneIndicators(ctx: CanvasRenderingContext2D, accentColor: string): void {
        const laneCount = 5;
        const laneWidth = this.canvasWidth / laneCount;

        for (let i = 1; i < laneCount; i++) {
            const x = i * laneWidth;

            // Glowing lane divider
            const laneGradient = ctx.createLinearGradient(0, this.canvasHeight - 200, 0, this.canvasHeight);
            laneGradient.addColorStop(0, 'transparent');
            laneGradient.addColorStop(0.3, accentColor + '08');
            laneGradient.addColorStop(0.6, accentColor + '15');
            laneGradient.addColorStop(1, accentColor + '25');

            ctx.strokeStyle = laneGradient;
            ctx.lineWidth = 2;
            ctx.setLineDash([15, 10]);
            ctx.beginPath();
            ctx.moveTo(x, this.canvasHeight - 200);
            ctx.lineTo(x, this.canvasHeight);
            ctx.stroke();
        }

        ctx.setLineDash([]);
    }

    public renderDangerVignette(ctx: CanvasRenderingContext2D, intensity: number): void {
        if (intensity <= 0) return;

        // Animated pulse
        const pulse = Math.sin(this.time * 8) * 0.2 + 0.8;
        const finalIntensity = intensity * pulse;

        const gradient = ctx.createRadialGradient(
            this.canvasWidth / 2, this.canvasHeight / 2, 0,
            this.canvasWidth / 2, this.canvasHeight / 2, this.canvasWidth * 0.7
        );
        gradient.addColorStop(0, 'rgba(239, 68, 68, 0)');
        gradient.addColorStop(0.5, 'rgba(239, 68, 68, 0)');
        gradient.addColorStop(0.8, `rgba(239, 68, 68, ${finalIntensity * 0.3})`);
        gradient.addColorStop(1, `rgba(239, 68, 68, ${finalIntensity * 0.6})`);

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
    }

    public renderSlowMoVignette(ctx: CanvasRenderingContext2D, intensity: number): void {
        if (intensity <= 0) return;

        // Chromatic aberration-like effect
        ctx.fillStyle = `rgba(100, 150, 255, ${intensity * 0.1})`;
        ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

        // Radial blur simulation
        const gradient = ctx.createRadialGradient(
            this.canvasWidth / 2, this.canvasHeight / 2, 0,
            this.canvasWidth / 2, this.canvasHeight / 2, this.canvasWidth * 0.6
        );
        gradient.addColorStop(0, 'transparent');
        gradient.addColorStop(0.7, 'transparent');
        gradient.addColorStop(1, `rgba(147, 197, 253, ${intensity * 0.2})`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
    }

    public renderBossWarning(ctx: CanvasRenderingContext2D, time: number): void {
        const pulse = Math.sin(time * 10) * 0.5 + 0.5;
        const edgeWidth = 25 + pulse * 10;

        // Create animated edge glow
        const edgeGradientTop = ctx.createLinearGradient(0, 0, 0, edgeWidth);
        edgeGradientTop.addColorStop(0, `rgba(239, 68, 68, ${pulse * 0.8})`);
        edgeGradientTop.addColorStop(1, 'transparent');

        const edgeGradientBottom = ctx.createLinearGradient(0, this.canvasHeight, 0, this.canvasHeight - edgeWidth);
        edgeGradientBottom.addColorStop(0, `rgba(239, 68, 68, ${pulse * 0.8})`);
        edgeGradientBottom.addColorStop(1, 'transparent');

        const edgeGradientLeft = ctx.createLinearGradient(0, 0, edgeWidth, 0);
        edgeGradientLeft.addColorStop(0, `rgba(239, 68, 68, ${pulse * 0.6})`);
        edgeGradientLeft.addColorStop(1, 'transparent');

        const edgeGradientRight = ctx.createLinearGradient(this.canvasWidth, 0, this.canvasWidth - edgeWidth, 0);
        edgeGradientRight.addColorStop(0, `rgba(239, 68, 68, ${pulse * 0.6})`);
        edgeGradientRight.addColorStop(1, 'transparent');

        ctx.fillStyle = edgeGradientTop;
        ctx.fillRect(0, 0, this.canvasWidth, edgeWidth);
        ctx.fillStyle = edgeGradientBottom;
        ctx.fillRect(0, this.canvasHeight - edgeWidth, this.canvasWidth, edgeWidth);
        ctx.fillStyle = edgeGradientLeft;
        ctx.fillRect(0, 0, edgeWidth, this.canvasHeight);
        ctx.fillStyle = edgeGradientRight;
        ctx.fillRect(this.canvasWidth - edgeWidth, 0, edgeWidth, this.canvasHeight);
    }

    public resize(canvasWidth: number, canvasHeight: number): void {
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
        this.starField = [];
        this.nebulaClouds = [];
        this.floatingOrbs = [];
        this.initStarField();
        this.initNebulaClouds();
        this.initFloatingOrbs();
    }
}
