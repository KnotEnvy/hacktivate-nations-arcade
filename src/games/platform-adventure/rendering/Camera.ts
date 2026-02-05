// ===== src/games/platform-adventure/rendering/Camera.ts =====
// Smooth camera with look-ahead, vertical offset, and screen shake effects

export interface CameraTarget {
    centerX: number;
    centerY: number;
    facingRight: boolean;
    vy: number;
    isGrounded: boolean;
}

// Screen shake presets
export const SHAKE_PRESETS = {
    // Player hurt: sharp jolt
    PLAYER_HURT: { intensity: 5, duration: 0.2, frequency: 60 },
    // Guard death: small impact
    GUARD_DEATH: { intensity: 3, duration: 0.15, frequency: 60 },
    // Captain death: heavy impact
    CAPTAIN_DEATH: { intensity: 12, duration: 1.0, frequency: 30 },
    // Shadow death: massive low rumble
    SHADOW_DEATH: { intensity: 20, duration: 2.0, frequency: 15 },
    // Landing from high fall
    LANDING_IMPACT: { intensity: 4, duration: 0.15, frequency: 60 },
    // Blocked attack
    BLOCK_CLASH: { intensity: 3, duration: 0.08, frequency: 60 },
    // Hit enemy
    HIT_ENEMY: { intensity: 6, duration: 0.12, frequency: 50 },
    // Trap hit
    TRAP_HIT: { intensity: 10, duration: 0.18, frequency: 40 },
    // Boss phase change
    PHASE_CHANGE: { intensity: 10, duration: 0.4, frequency: 35 },
} as const;

export type ShakePreset = keyof typeof SHAKE_PRESETS;

export class Camera {
    // Position
    private x: number = 0;
    private y: number = 0;

    // Target tracking
    private targetX: number = 0;
    private targetY: number = 0;

    // Smooth follow settings
    private readonly lerpSpeed: number = 8;
    private readonly lookAheadDistance: number = 50;
    private readonly lookAheadSpeed: number = 4;

    // Current look-ahead offset
    private lookAheadX: number = 0;

    // Vertical offset for jumping/falling
    private verticalOffset: number = 0;
    private readonly verticalOffsetMax: number = 40;
    private readonly verticalOffsetSpeed: number = 3;

    // Screen shake
    private shakeOffsetX: number = 0;
    private shakeOffsetY: number = 0;
    private shakeTimer: number = 0;
    private shakeDuration: number = 0;
    private shakeIntensity: number = 0;
    private shakeFrequency: number = 60;
    private shakePhase: number = 0;

    // Canvas dimensions for centering
    private canvasWidth: number = 800;
    private canvasHeight: number = 600;

    // Level bounds
    private levelWidth: number = 0;
    private levelHeight: number = 0;

    constructor(canvasWidth: number = 800, canvasHeight: number = 600) {
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
    }

    /**
     * Set the level bounds for clamping camera position
     */
    setLevelBounds(width: number, height: number): void {
        this.levelWidth = width;
        this.levelHeight = height;
    }

    /**
     * Snap camera immediately to target (use on level start)
     */
    snapTo(target: CameraTarget): void {
        this.x = target.centerX - this.canvasWidth / 2;
        this.y = target.centerY - this.canvasHeight / 2;
        this.targetX = this.x;
        this.targetY = this.y;
        this.lookAheadX = target.facingRight ? this.lookAheadDistance : -this.lookAheadDistance;
        this.verticalOffset = 0;
        this.clampToBounds();
    }

    /**
     * Update camera position with smooth follow
     */
    update(dt: number, target: CameraTarget): void {
        // Update look-ahead based on facing direction
        const targetLookAhead = target.facingRight ? this.lookAheadDistance : -this.lookAheadDistance;
        this.lookAheadX = this.lerp(this.lookAheadX, targetLookAhead, this.lookAheadSpeed * dt);

        // Calculate target position with look-ahead
        this.targetX = target.centerX + this.lookAheadX - this.canvasWidth / 2;

        // Vertical offset when airborne
        if (!target.isGrounded) {
            // Look down when falling, up when jumping
            const offsetDirection = target.vy > 0 ? 1 : -1;
            const offsetTarget = offsetDirection * this.verticalOffsetMax;
            this.verticalOffset = this.lerp(this.verticalOffset, offsetTarget, this.verticalOffsetSpeed * dt);
        } else {
            // Return to center when grounded
            this.verticalOffset = this.lerp(this.verticalOffset, 0, this.verticalOffsetSpeed * dt);
        }

        this.targetY = target.centerY + this.verticalOffset - this.canvasHeight / 2;

        // Smooth follow
        this.x = this.lerp(this.x, this.targetX, this.lerpSpeed * dt);
        this.y = this.lerp(this.y, this.targetY, this.lerpSpeed * dt);

        // Clamp to level bounds
        this.clampToBounds();

        // Update screen shake
        this.updateShake(dt);
    }

    /**
     * Trigger screen shake effect
     */
    shake(intensity: number, duration: number, frequency: number = 60): void {
        // Allow stronger shakes to override weaker ones
        if (intensity >= this.shakeIntensity || this.shakeTimer <= 0) {
            this.shakeIntensity = intensity;
            this.shakeDuration = duration;
            this.shakeTimer = duration;
            this.shakeFrequency = frequency;
            this.shakePhase = Math.random() * Math.PI * 2;
        }
    }

    /**
     * Trigger shake using a preset
     */
    shakePreset(preset: ShakePreset): void {
        const config = SHAKE_PRESETS[preset];
        this.shake(config.intensity, config.duration, config.frequency);
    }

    /**
     * Get the camera offset for rendering (includes shake)
     */
    getOffset(): { x: number; y: number } {
        return {
            x: this.x + this.shakeOffsetX,
            y: this.y + this.shakeOffsetY,
        };
    }

    /**
     * Get raw camera position without shake
     */
    getPosition(): { x: number; y: number } {
        return { x: this.x, y: this.y };
    }

    /**
     * Check if shake is active
     */
    isShaking(): boolean {
        return this.shakeTimer > 0;
    }

    /**
     * Reset camera state
     */
    reset(): void {
        this.x = 0;
        this.y = 0;
        this.targetX = 0;
        this.targetY = 0;
        this.lookAheadX = 0;
        this.verticalOffset = 0;
        this.shakeOffsetX = 0;
        this.shakeOffsetY = 0;
        this.shakeTimer = 0;
        this.shakeDuration = 0;
        this.shakeIntensity = 0;
    }

    // Private methods

    private lerp(a: number, b: number, t: number): number {
        return a + (b - a) * Math.min(1, t);
    }

    private updateShake(dt: number): void {
        if (this.shakeTimer <= 0) {
            this.shakeOffsetX = 0;
            this.shakeOffsetY = 0;
            return;
        }

        this.shakeTimer = Math.max(0, this.shakeTimer - dt);
        this.shakePhase += dt * this.shakeFrequency;

        // Ease out: shake diminishes over time
        const progress = this.shakeDuration > 0 ? this.shakeTimer / this.shakeDuration : 0;
        const easeOut = progress * progress;

        // Use sine waves for smoother shake (frequency-based)
        const currentIntensity = this.shakeIntensity * easeOut;
        this.shakeOffsetX = Math.sin(this.shakePhase) * currentIntensity;
        this.shakeOffsetY = Math.cos(this.shakePhase * 1.3) * currentIntensity * 0.7;
    }

    private clampToBounds(): void {
        if (this.levelWidth <= 0 || this.levelHeight <= 0) return;

        const maxX = Math.max(0, this.levelWidth - this.canvasWidth);
        const maxY = Math.max(0, this.levelHeight - this.canvasHeight);

        this.x = Math.max(0, Math.min(maxX, this.x));
        this.y = Math.max(0, Math.min(maxY, this.y));
    }
}
