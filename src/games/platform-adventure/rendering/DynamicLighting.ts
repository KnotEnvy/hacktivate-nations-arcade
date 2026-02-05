// ===== src/games/platform-adventure/rendering/DynamicLighting.ts =====
// Dynamic lighting system with torch flicker and ambient darkness

/**
 * Light source types with different behaviors
 */
export type LightType = 'torch' | 'crystal' | 'spectral_crystal' | 'owl' | 'player_torch' | 'moonlight';

/**
 * Individual light source
 */
export interface LightSource {
    x: number;
    y: number;
    type: LightType;
    baseRadius: number;
    color: string;
    colorInner: string;
    flickerAmount: number;
    flickerSpeed: number;
    pulseAmount: number;
    pulseSpeed: number;
    // Runtime state
    flickerPhase: number;
    currentRadius: number;
}

/**
 * Light configuration by type
 */
const LIGHT_CONFIG: Record<LightType, {
    baseRadius: number;
    color: string;
    colorInner: string;
    flickerAmount: number;
    flickerSpeed: number;
    pulseAmount: number;
    pulseSpeed: number;
}> = {
    torch: {
        baseRadius: 180,
        color: 'rgba(255, 150, 50, 0)',
        colorInner: 'rgba(255, 200, 100, 1)',
        flickerAmount: 15,
        flickerSpeed: 8,
        pulseAmount: 8,
        pulseSpeed: 2,
    },
    crystal: {
        baseRadius: 80,
        color: 'rgba(68, 136, 255, 0)',
        colorInner: 'rgba(120, 180, 255, 0.9)',
        flickerAmount: 3,
        flickerSpeed: 1,
        pulseAmount: 10,
        pulseSpeed: 1.5,
    },
    spectral_crystal: {
        baseRadius: 100,
        color: 'rgba(136, 68, 255, 0)',
        colorInner: 'rgba(180, 120, 255, 0.9)',
        flickerAmount: 5,
        flickerSpeed: 2,
        pulseAmount: 15,
        pulseSpeed: 0.8,
    },
    owl: {
        baseRadius: 200,
        color: 'rgba(255, 215, 0, 0)',
        colorInner: 'rgba(255, 235, 150, 1)',
        flickerAmount: 0,
        flickerSpeed: 0,
        pulseAmount: 8,
        pulseSpeed: 0.5,
    },
    player_torch: {
        baseRadius: 200,
        color: 'rgba(255, 200, 130, 0)',
        colorInner: 'rgba(255, 220, 160, 0.9)',
        flickerAmount: 8,
        flickerSpeed: 6,
        pulseAmount: 5,
        pulseSpeed: 1.5,
    },
    moonlight: {
        baseRadius: 280,
        color: 'rgba(180, 200, 230, 0)',
        colorInner: 'rgba(200, 220, 245, 0.7)',
        flickerAmount: 0,
        flickerSpeed: 0,
        pulseAmount: 6,
        pulseSpeed: 0.3,
    },
};

/**
 * Ambient darkness levels per level (0 = bright, 1 = pitch black)
 * Levels get progressively darker to simulate descending deeper into caves.
 * The player's torch cuts through this darkness.
 *
 * NOTE: The parallax background renders UNDER this overlay, so even
 * small values will tint the background. Keep L1 very low so
 * players can see the cave environment clearly.
 */
const LEVEL_DARKNESS: number[] = [
    0.05, // Level 1: Ancient Entry - bright entrance, barely any overlay
    0.12, // Level 2: Crystal Forest - slight darkness, crystals glow
    0.22, // Level 3: Fallen Hall - noticeably darker
    0.35, // Level 4: Labyrinth Depths - dark, reliant on torches
    0.45, // Level 5: Heart Chamber - deep darkness, owl provides relief
];

/**
 * Dynamic lighting system for Crystal Caverns
 * Creates atmospheric darkness with light sources cutting through.
 *
 * Player Torch Mechanic:
 * - Player always carries a torch that emits light
 * - Torch brightness dims over time (full -> dim over TORCH_DRAIN_TIME seconds)
 * - Walking near a wall torch resets brightness to full
 * - Each level starts with a fresh torch
 * - Deeper levels have more ambient darkness, making the torch more critical
 */
export class DynamicLighting {
    private lights: LightSource[] = [];
    private ambientDarkness: number = 0.15;
    private currentLevel: number = 0;
    private enabled: boolean = true;

    // Player torch state
    private playerLightIndex: number = -1;
    private playerTorchBrightness: number = 1.0;     // 1.0 = full, 0.0 = extinguished
    private readonly TORCH_MIN_BRIGHTNESS = 0.25;     // Never fully dark (can always see a little)
    private readonly TORCH_MAX_RADIUS = 200;           // Full brightness radius
    private readonly TORCH_MIN_RADIUS = 70;            // Dimmest radius
    private readonly TORCH_DRAIN_TIME = 45;            // Seconds to drain from full to min
    private readonly TORCH_RELIGHT_RADIUS = 80;        // How close to a torch to relight

    // Offscreen canvas for lighting (performance optimization)
    private lightCanvas: HTMLCanvasElement | null = null;
    private lightCtx: CanvasRenderingContext2D | null = null;

    constructor() {
        // Create offscreen canvas for lighting effects
        if (typeof document !== 'undefined') {
            this.lightCanvas = document.createElement('canvas');
            this.lightCtx = this.lightCanvas.getContext('2d');
        }
    }

    /**
     * Enable or disable the lighting system
     */
    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }

    /**
     * Set the current level and update ambient darkness
     */
    setLevel(levelIndex: number): void {
        this.currentLevel = levelIndex;
        this.ambientDarkness = LEVEL_DARKNESS[levelIndex] ?? 0.25;
        this.lights = [];
        this.playerLightIndex = -1;
        this.playerTorchBrightness = 1.0; // Fresh torch each level
    }

    /**
     * Clear all light sources
     */
    clearLights(): void {
        this.lights = [];
        this.playerLightIndex = -1;
    }

    /**
     * Manually relight the player's torch (e.g., from a torch pickup or interaction)
     */
    relightPlayerTorch(): void {
        this.playerTorchBrightness = 1.0;
    }

    /**
     * Add a light source
     */
    addLight(x: number, y: number, type: LightType): void {
        const config = LIGHT_CONFIG[type];
        this.lights.push({
            x,
            y,
            type,
            baseRadius: config.baseRadius,
            color: config.color,
            colorInner: config.colorInner,
            flickerAmount: config.flickerAmount,
            flickerSpeed: config.flickerSpeed,
            pulseAmount: config.pulseAmount,
            pulseSpeed: config.pulseSpeed,
            flickerPhase: Math.random() * Math.PI * 2,
            currentRadius: config.baseRadius,
        });
    }

    /**
     * Add a torch light at the specified position
     */
    addTorch(x: number, y: number): void {
        this.addLight(x, y, 'torch');
    }

    /**
     * Add a crystal light (blue glow)
     */
    addCrystal(x: number, y: number): void {
        this.addLight(x, y, 'crystal');
    }

    /**
     * Add a spectral crystal light (purple pulsing)
     */
    addSpectralCrystal(x: number, y: number): void {
        this.addLight(x, y, 'spectral_crystal');
    }

    /**
     * Add the golden owl light
     */
    addOwlLight(x: number, y: number): void {
        this.addLight(x, y, 'owl');
    }

    /**
     * Add a moonlight shaft (large, soft, cool light for key areas)
     */
    addMoonlight(x: number, y: number): void {
        this.addLight(x, y, 'moonlight');
    }

    /**
     * Update player torch position (always on - player carries a torch)
     */
    updatePlayerLight(x: number, y: number): void {
        if (this.playerLightIndex >= 0 && this.playerLightIndex < this.lights.length) {
            // Update existing player light position
            const light = this.lights[this.playerLightIndex];
            light.x = x;
            light.y = y;
        } else {
            // Create player torch light
            this.addLight(x, y, 'player_torch');
            this.playerLightIndex = this.lights.length - 1;
        }

        // Apply torch brightness to the player's light radius
        if (this.playerLightIndex >= 0 && this.playerLightIndex < this.lights.length) {
            const light = this.lights[this.playerLightIndex];
            const radiusRange = this.TORCH_MAX_RADIUS - this.TORCH_MIN_RADIUS;
            light.baseRadius = this.TORCH_MIN_RADIUS + radiusRange * this.playerTorchBrightness;
        }
    }

    /**
     * Check if player is near a wall torch and relight their torch
     */
    private checkTorchRelight(playerX: number, playerY: number): void {
        for (const light of this.lights) {
            if (light.type !== 'torch') continue;
            const dx = playerX - light.x;
            const dy = playerY - light.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < this.TORCH_RELIGHT_RADIUS) {
                this.playerTorchBrightness = 1.0; // Relight!
                return;
            }
        }
    }

    /**
     * Get current player torch brightness (0-1)
     */
    getPlayerTorchBrightness(): number {
        return this.playerTorchBrightness;
    }

    /**
     * Update all light sources (call every frame)
     */
    update(dt: number): void {
        // Drain player torch over time
        const drainRate = (1.0 - this.TORCH_MIN_BRIGHTNESS) / this.TORCH_DRAIN_TIME;
        this.playerTorchBrightness = Math.max(
            this.TORCH_MIN_BRIGHTNESS,
            this.playerTorchBrightness - drainRate * dt
        );

        // Check if player is near a wall torch to relight
        if (this.playerLightIndex >= 0 && this.playerLightIndex < this.lights.length) {
            const playerLight = this.lights[this.playerLightIndex];
            this.checkTorchRelight(playerLight.x, playerLight.y);
        }

        for (const light of this.lights) {
            // Update flicker phase
            light.flickerPhase += dt * light.flickerSpeed;

            // Calculate current radius with flicker and pulse
            const flicker = Math.sin(light.flickerPhase) * light.flickerAmount +
                           Math.sin(light.flickerPhase * 2.3) * (light.flickerAmount * 0.5) +
                           (Math.random() - 0.5) * (light.flickerAmount * 0.3);

            const pulse = Math.sin(light.flickerPhase * light.pulseSpeed) * light.pulseAmount;

            light.currentRadius = light.baseRadius + flicker + pulse;
        }
    }

    /**
     * Render the lighting overlay
     * Call this AFTER rendering all game objects
     */
    renderLightingOverlay(
        ctx: CanvasRenderingContext2D,
        camX: number,
        camY: number
    ): void {
        if (!this.enabled) return;

        const width = ctx.canvas.width;
        const height = ctx.canvas.height;

        // Ensure offscreen canvas matches size
        if (this.lightCanvas && this.lightCtx) {
            if (this.lightCanvas.width !== width || this.lightCanvas.height !== height) {
                this.lightCanvas.width = width;
                this.lightCanvas.height = height;
            }

            const lctx = this.lightCtx;

            // Fill with darkness
            lctx.fillStyle = `rgba(0, 0, 0, ${this.ambientDarkness})`;
            lctx.fillRect(0, 0, width, height);

            // Cut out light circles using destination-out
            lctx.globalCompositeOperation = 'destination-out';

            for (const light of this.lights) {
                const screenX = light.x - camX;
                const screenY = light.y - camY;

                // Culling: skip lights that are off-screen
                if (screenX < -light.currentRadius || screenX > width + light.currentRadius ||
                    screenY < -light.currentRadius || screenY > height + light.currentRadius) {
                    continue;
                }

                this.renderLight(lctx, light, screenX, screenY);
            }

            // Reset composite operation
            lctx.globalCompositeOperation = 'source-over';

            // Draw the lighting canvas onto the main canvas
            ctx.drawImage(this.lightCanvas, 0, 0);

            // Add colored light glows on top (additive)
            this.renderLightGlows(ctx, camX, camY);
        } else {
            // Fallback: direct rendering (less performant)
            this.renderLightingDirect(ctx, camX, camY);
        }
    }

    /**
     * Render a single light source (cuts through darkness)
     */
    private renderLight(
        ctx: CanvasRenderingContext2D,
        light: LightSource,
        screenX: number,
        screenY: number
    ): void {
        const radius = light.currentRadius;

        // Create radial gradient for soft light falloff
        const gradient = ctx.createRadialGradient(
            screenX, screenY, 0,
            screenX, screenY, radius
        );

        // Gradient from fully opaque (cuts through) to transparent (no cut)
        // More generous center = more visibility near light sources
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.9)');
        gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.5)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
        ctx.fill();
    }

    /**
     * Render colored light glows (additive color on top)
     */
    private renderLightGlows(
        ctx: CanvasRenderingContext2D,
        camX: number,
        camY: number
    ): void {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';

        for (const light of this.lights) {
            const screenX = light.x - camX;
            const screenY = light.y - camY;
            const radius = light.currentRadius * 0.6;

            // Skip off-screen lights
            if (screenX < -radius || screenX > ctx.canvas.width + radius ||
                screenY < -radius || screenY > ctx.canvas.height + radius) {
                continue;
            }

            // Create colored glow gradient
            const gradient = ctx.createRadialGradient(
                screenX, screenY, 0,
                screenX, screenY, radius
            );

            // Extract base color and create gradient
            const innerColor = this.adjustAlpha(light.colorInner, 0.3);
            const outerColor = this.adjustAlpha(light.colorInner, 0);

            gradient.addColorStop(0, innerColor);
            gradient.addColorStop(0.5, this.adjustAlpha(light.colorInner, 0.1));
            gradient.addColorStop(1, outerColor);

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    /**
     * Fallback direct rendering (for when offscreen canvas isn't available)
     */
    private renderLightingDirect(
        ctx: CanvasRenderingContext2D,
        camX: number,
        camY: number
    ): void {
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;

        // Create darkness layer
        ctx.save();
        ctx.fillStyle = `rgba(0, 0, 0, ${this.ambientDarkness})`;
        ctx.fillRect(0, 0, width, height);

        // Cut out lights
        ctx.globalCompositeOperation = 'destination-out';

        for (const light of this.lights) {
            const screenX = light.x - camX;
            const screenY = light.y - camY;

            if (screenX < -light.currentRadius || screenX > width + light.currentRadius ||
                screenY < -light.currentRadius || screenY > height + light.currentRadius) {
                continue;
            }

            this.renderLight(ctx, light, screenX, screenY);
        }

        ctx.restore();
    }

    /**
     * Adjust alpha of an rgba color string
     */
    private adjustAlpha(color: string, alpha: number): string {
        if (color.startsWith('rgba')) {
            return color.replace(/[\d.]+\)$/, `${alpha})`);
        }
        // Handle rgb
        if (color.startsWith('rgb(')) {
            return color.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
        }
        return color;
    }

    /**
     * Get number of active lights
     */
    getLightCount(): number {
        return this.lights.length;
    }

    /**
     * Get current ambient darkness level
     */
    getAmbientDarkness(): number {
        return this.ambientDarkness;
    }
}
