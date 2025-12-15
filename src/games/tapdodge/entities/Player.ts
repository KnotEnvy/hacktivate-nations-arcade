// ===== src/games/tapdodge/entities/Player.ts =====
// AAA-Quality Player with afterimages, energy wings, and dynamic visuals

interface AfterImage {
    x: number;
    y: number;
    alpha: number;
    scale: number;
    rotation: number;
}

export class Player {
    // Position and movement
    public x: number;
    public y: number;
    public targetX: number;
    public readonly width: number = 40;
    public readonly height: number = 40;

    // Lane system
    private currentLane: number = 2; // 0-4, starting middle
    private readonly laneCount: number = 5;
    private canvasWidth: number;

    // Movement smoothing
    private readonly lerpSpeed: number = 12;
    private velocityX: number = 0;

    // Visual state
    private trailPoints: { x: number; y: number; alpha: number }[] = [];
    private afterImages: AfterImage[] = [];
    private pulsePhase: number = 0;
    private energyPhase: number = 0;
    private wingPhase: number = 0;

    // Damage state
    private invulnTime: number = 0;
    private blinkTimer: number = 0;

    // Vertical dodge state
    private isDucking: boolean = false;
    private isJumping: boolean = false;
    private dodgeTimer: number = 0;
    private readonly DODGE_DURATION: number = 0.5;

    constructor(canvasWidth: number, canvasHeight: number) {
        this.canvasWidth = canvasWidth;
        this.y = canvasHeight - 80;
        this.x = this.getLaneX(this.currentLane);
        this.targetX = this.x;
    }

    private getLaneX(lane: number): number {
        const laneWidth = this.canvasWidth / this.laneCount;
        return lane * laneWidth + (laneWidth - this.width) / 2;
    }

    public moveLeft(): void {
        if (this.currentLane > 0) {
            this.currentLane--;
            this.targetX = this.getLaneX(this.currentLane);
        }
    }

    public moveRight(): void {
        if (this.currentLane < this.laneCount - 1) {
            this.currentLane++;
            this.targetX = this.getLaneX(this.currentLane);
        }
    }

    public moveToPosition(targetX: number): void {
        const clampedX = Math.max(0, Math.min(this.canvasWidth - this.width, targetX - this.width / 2));
        this.targetX = clampedX;

        const laneWidth = this.canvasWidth / this.laneCount;
        this.currentLane = Math.floor((clampedX + this.width / 2) / laneWidth);
        this.currentLane = Math.max(0, Math.min(this.laneCount - 1, this.currentLane));
    }

    public getCurrentLane(): number {
        return this.currentLane;
    }

    public update(dt: number): void {
        // Smooth movement interpolation
        const dx = this.targetX - this.x;
        this.velocityX = dx * this.lerpSpeed;
        this.x += this.velocityX * dt;

        // Update trail
        this.trailPoints.push({
            x: this.x + this.width / 2,
            y: this.y + this.height / 2,
            alpha: 0.6
        });

        if (this.trailPoints.length > 20) {
            this.trailPoints.shift();
        }

        for (const point of this.trailPoints) {
            point.alpha = Math.max(0, point.alpha - dt * 1.8);
        }
        this.trailPoints = this.trailPoints.filter(p => p.alpha > 0);

        // Update after-images (create on movement)
        if (Math.abs(this.velocityX) > 50) {
            if (this.afterImages.length === 0 ||
                Math.abs(this.afterImages[this.afterImages.length - 1].x - this.x) > 15) {
                this.afterImages.push({
                    x: this.x,
                    y: this.y,
                    alpha: 0.6,
                    scale: 1,
                    rotation: (this.velocityX > 0 ? 0.1 : -0.1)
                });
            }
        }

        // Decay after-images
        for (const image of this.afterImages) {
            image.alpha -= dt * 2;
            image.scale *= 0.98;
        }
        this.afterImages = this.afterImages.filter(img => img.alpha > 0);

        // Update invulnerability
        if (this.invulnTime > 0) {
            this.invulnTime -= dt;
            this.blinkTimer += dt;
        }

        // Pulse animation
        this.pulsePhase += dt * 4;
        this.energyPhase += dt * 8;
        this.wingPhase += dt * 12;

        // Dodge timer
        if (this.dodgeTimer > 0) {
            this.dodgeTimer -= dt;
            if (this.dodgeTimer <= 0) {
                this.isDucking = false;
                this.isJumping = false;
            }
        }
    }

    public duck(): void {
        if (!this.isDucking && !this.isJumping) {
            this.isDucking = true;
            this.isJumping = false;
            this.dodgeTimer = this.DODGE_DURATION;
        }
    }

    public jump(): void {
        if (!this.isJumping && !this.isDucking) {
            this.isJumping = true;
            this.isDucking = false;
            this.dodgeTimer = this.DODGE_DURATION;
        }
    }

    public getIsDucking(): boolean {
        return this.isDucking;
    }

    public getIsJumping(): boolean {
        return this.isJumping;
    }

    public getDodgeTimeRemaining(): number {
        return this.dodgeTimer;
    }

    public takeDamage(): boolean {
        if (this.invulnTime > 0) {
            return false;
        }
        this.invulnTime = 1.0;
        this.blinkTimer = 0;
        return true;
    }

    public setInvulnerable(duration: number): void {
        this.invulnTime = Math.max(this.invulnTime, duration);
    }

    public isInvulnerable(): boolean {
        return this.invulnTime > 0;
    }

    public getInvulnTime(): number {
        return this.invulnTime;
    }

    public getBounds(): { x: number; y: number; w: number; h: number } {
        const margin = 4;
        return {
            x: this.x + margin,
            y: this.y + margin,
            w: this.width - margin * 2,
            h: this.height - margin * 2
        };
    }

    public getCenterX(): number {
        return this.x + this.width / 2;
    }

    public getCenterY(): number {
        return this.y + this.height / 2;
    }

    public render(ctx: CanvasRenderingContext2D, hasShield: boolean = false, hasGhost: boolean = false): void {
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;
        const pulse = Math.sin(this.pulsePhase) * 0.1 + 1;

        const primaryColor = hasGhost ? '#A78BFA' : '#22D3EE';
        const secondaryColor = hasGhost ? '#C4B5FD' : '#67E8F9';
        const glowColor = hasGhost ? 'rgba(167, 139, 250,' : 'rgba(34, 211, 238,';

        // ===== LAYER 1: After-images =====
        for (const image of this.afterImages) {
            ctx.save();
            ctx.globalAlpha = image.alpha * 0.4;
            ctx.translate(image.x + this.width / 2, image.y + this.height / 2);
            ctx.rotate(image.rotation);
            ctx.scale(image.scale, image.scale);

            ctx.fillStyle = primaryColor;
            ctx.beginPath();
            ctx.moveTo(0, -this.height / 2);
            ctx.lineTo(this.width / 2, 0);
            ctx.lineTo(0, this.height / 2);
            ctx.lineTo(-this.width / 2, 0);
            ctx.closePath();
            ctx.fill();

            ctx.restore();
        }

        // ===== LAYER 2: Motion trail with gradient =====
        if (this.trailPoints.length > 1) {
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            for (let i = 1; i < this.trailPoints.length; i++) {
                const p1 = this.trailPoints[i - 1];
                const p2 = this.trailPoints[i];
                const progress = i / this.trailPoints.length;

                ctx.globalAlpha = p2.alpha * 0.5;
                ctx.strokeStyle = primaryColor;
                ctx.lineWidth = 3 + progress * 6;
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
            }
        }
        ctx.globalAlpha = 1;

        // Blink during invulnerability
        if (this.invulnTime > 0) {
            const blink = Math.sin(this.blinkTimer * 20) > 0;
            ctx.globalAlpha = blink ? 0.4 : 0.9;
        }

        // Ghost effect
        if (hasGhost) {
            ctx.globalAlpha *= 0.6;
        }

        // ===== LAYER 3: Energy wings (during movement or shield) =====
        const showWings = hasShield || Math.abs(this.velocityX) > 100 || this.isDucking || this.isJumping;
        if (showWings) {
            this.renderEnergyWings(ctx, cx, cy, primaryColor, glowColor);
        }

        // ===== LAYER 4: Outer energy field =====
        const outerGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, this.width * 1.2);
        outerGlow.addColorStop(0, `${glowColor}0.4)`);
        outerGlow.addColorStop(0.4, `${glowColor}0.15)`);
        outerGlow.addColorStop(0.7, `${glowColor}0.05)`);
        outerGlow.addColorStop(1, `${glowColor}0)`);
        ctx.fillStyle = outerGlow;
        ctx.beginPath();
        ctx.arc(cx, cy, this.width * 1.2, 0, Math.PI * 2);
        ctx.fill();

        // ===== LAYER 5: Main body =====
        this.renderMainBody(ctx, cx, cy, primaryColor, secondaryColor, pulse);

        // ===== LAYER 6: Inner core with energy lines =====
        this.renderEnergyCore(ctx, cx, cy, secondaryColor, pulse);

        // ===== LAYER 7: Central eye/core =====
        const coreGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, 6);
        coreGradient.addColorStop(0, '#FFFFFF');
        coreGradient.addColorStop(0.5, secondaryColor);
        coreGradient.addColorStop(1, primaryColor);
        ctx.fillStyle = coreGradient;
        ctx.beginPath();
        ctx.arc(cx, cy, 6 * pulse, 0, Math.PI * 2);
        ctx.fill();

        // Core highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.beginPath();
        ctx.arc(cx - 2, cy - 2, 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 1;

        // ===== LAYER 8: Shield aura =====
        if (hasShield) {
            this.renderShieldAura(ctx, cx, cy);
        }

        // ===== LAYER 9: Speed lines during fast movement =====
        if (Math.abs(this.velocityX) > 150) {
            this.renderSpeedLines(ctx, cx, cy);
        }
    }

    private renderEnergyWings(ctx: CanvasRenderingContext2D, cx: number, cy: number, primaryColor: string, glowColor: string): void {
        ctx.save();

        const wingFlap = Math.sin(this.wingPhase) * 0.3;
        const wingSize = 25 + Math.sin(this.wingPhase * 0.5) * 5;

        // Left wing
        ctx.save();
        ctx.translate(cx - this.width / 2 - 5, cy);
        ctx.rotate(-0.4 - wingFlap);
        ctx.globalAlpha = 0.5;

        const leftWingGrad = ctx.createLinearGradient(0, -wingSize, 0, wingSize);
        leftWingGrad.addColorStop(0, 'transparent');
        leftWingGrad.addColorStop(0.5, primaryColor);
        leftWingGrad.addColorStop(1, 'transparent');

        ctx.fillStyle = leftWingGrad;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(-wingSize, -wingSize / 2, -wingSize * 0.8, -wingSize);
        ctx.lineTo(-wingSize * 0.5, 0);
        ctx.quadraticCurveTo(-wingSize, wingSize / 2, -wingSize * 0.8, wingSize);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Right wing
        ctx.save();
        ctx.translate(cx + this.width / 2 + 5, cy);
        ctx.rotate(0.4 + wingFlap);
        ctx.globalAlpha = 0.5;

        const rightWingGrad = ctx.createLinearGradient(0, -wingSize, 0, wingSize);
        rightWingGrad.addColorStop(0, 'transparent');
        rightWingGrad.addColorStop(0.5, primaryColor);
        rightWingGrad.addColorStop(1, 'transparent');

        ctx.fillStyle = rightWingGrad;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(wingSize, -wingSize / 2, wingSize * 0.8, -wingSize);
        ctx.lineTo(wingSize * 0.5, 0);
        ctx.quadraticCurveTo(wingSize, wingSize / 2, wingSize * 0.8, wingSize);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        ctx.restore();
    }

    private renderMainBody(ctx: CanvasRenderingContext2D, cx: number, cy: number, primaryColor: string, secondaryColor: string, pulse: number): void {
        // Outer edge glow
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = 3;
        ctx.shadowColor = primaryColor;
        ctx.shadowBlur = 15;

        ctx.beginPath();
        if (this.isDucking) {
            const duckOffset = this.height * 0.25;
            ctx.moveTo(cx, this.y + duckOffset + this.height * 0.25);
            ctx.lineTo(this.x + this.width, cy + duckOffset);
            ctx.lineTo(cx, this.y + this.height);
            ctx.lineTo(this.x, cy + duckOffset);
        } else if (this.isJumping) {
            const jumpOffset = -this.height * 0.3;
            ctx.moveTo(cx, this.y + jumpOffset);
            ctx.lineTo(this.x + this.width * 0.9, cy + jumpOffset * 0.5);
            ctx.lineTo(cx, this.y + this.height + jumpOffset * 0.2);
            ctx.lineTo(this.x + this.width * 0.1, cy + jumpOffset * 0.5);
        } else {
            ctx.moveTo(cx, this.y);
            ctx.lineTo(this.x + this.width, cy);
            ctx.lineTo(cx, this.y + this.height);
            ctx.lineTo(this.x, cy);
        }
        ctx.closePath();
        ctx.stroke();

        ctx.shadowBlur = 0;

        // Fill with gradient
        const bodyGradient = ctx.createLinearGradient(this.x, this.y, this.x + this.width, this.y + this.height);
        bodyGradient.addColorStop(0, secondaryColor);
        bodyGradient.addColorStop(0.5, primaryColor);
        bodyGradient.addColorStop(1, secondaryColor);
        ctx.fillStyle = bodyGradient;
        ctx.fill();
    }

    private renderEnergyCore(ctx: CanvasRenderingContext2D, cx: number, cy: number, secondaryColor: string, pulse: number): void {
        const innerSize = this.width * 0.35 * pulse;

        // Inner diamond
        ctx.fillStyle = secondaryColor;
        ctx.beginPath();
        ctx.moveTo(cx, cy - innerSize);
        ctx.lineTo(cx + innerSize, cy);
        ctx.lineTo(cx, cy + innerSize);
        ctx.lineTo(cx - innerSize, cy);
        ctx.closePath();
        ctx.fill();

        // Energy lines radiating from core
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1;

        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 * i) / 8 + this.energyPhase * 0.5;
            const innerR = 8;
            const outerR = 15 + Math.sin(this.energyPhase + i) * 3;

            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(angle) * innerR, cy + Math.sin(angle) * innerR);
            ctx.lineTo(cx + Math.cos(angle) * outerR, cy + Math.sin(angle) * outerR);
            ctx.stroke();
        }
    }

    private renderShieldAura(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
        // Outer shield ring
        const shieldRadius = 35 + Math.sin(this.pulsePhase * 2) * 4;

        ctx.strokeStyle = 'rgba(34, 211, 238, 0.7)';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#22D3EE';
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(cx, cy, shieldRadius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.shadowBlur = 0;

        // Hexagonal energy pattern
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI * 2 * i) / 6 + this.pulsePhase * 0.3;
            const x = cx + Math.cos(angle) * shieldRadius;
            const y = cy + Math.sin(angle) * shieldRadius;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();

        // Orbiting particles
        for (let i = 0; i < 8; i++) {
            const angle = this.pulsePhase * 1.5 + (Math.PI * 2 * i) / 8;
            const px = cx + Math.cos(angle) * shieldRadius;
            const py = cy + Math.sin(angle) * shieldRadius;
            const size = 3 + Math.sin(this.pulsePhase * 3 + i) * 1;

            const particleGrad = ctx.createRadialGradient(px, py, 0, px, py, size * 2);
            particleGrad.addColorStop(0, '#FFFFFF');
            particleGrad.addColorStop(0.5, '#22D3EE');
            particleGrad.addColorStop(1, 'transparent');

            ctx.fillStyle = particleGrad;
            ctx.beginPath();
            ctx.arc(px, py, size * 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    private renderSpeedLines(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
        const direction = this.velocityX > 0 ? -1 : 1;

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;

        for (let i = 0; i < 5; i++) {
            const offsetY = (i - 2) * 8;
            const startX = cx + direction * (this.width / 2 + 5);
            const endX = startX + direction * (20 + Math.random() * 15);

            ctx.globalAlpha = 0.2 + Math.random() * 0.3;
            ctx.beginPath();
            ctx.moveTo(startX, cy + offsetY);
            ctx.lineTo(endX, cy + offsetY);
            ctx.stroke();
        }

        ctx.globalAlpha = 1;
    }

    public resize(canvasWidth: number, canvasHeight: number): void {
        this.canvasWidth = canvasWidth;
        this.y = canvasHeight - 80;
        this.targetX = this.getLaneX(this.currentLane);
        this.x = this.targetX;
    }
}
