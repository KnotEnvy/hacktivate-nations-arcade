// ===== src/games/platform-adventure/rendering/ParallaxBackground.ts =====
// Parallax background system with level-specific theming for Crystal Caverns

/**
 * Individual element within a parallax layer
 */
export interface ParallaxElement {
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    opacity: number;
    type: string;
    seed: number;           // For deterministic procedural variation
    animOffset?: number;    // Animation phase offset
}

/**
 * A single parallax layer containing multiple elements
 */
export interface ParallaxLayer {
    name: string;
    scrollFactor: number;   // 0.0 = fixed, 1.0 = moves with camera
    yOffset: number;        // Vertical offset from top
    opacity: number;        // Base opacity for the layer
    elements: ParallaxElement[];
}

/**
 * Level theme configuration
 */
interface LevelTheme {
    name: string;
    backgroundColor: { top: string; bottom: string };
    ambientColor: string;
    layers: {
        distant_glow: LayerConfig;
        far_crystals: LayerConfig;
        mid_stalactites: LayerConfig;
        near_chains: LayerConfig;
    };
}

interface LayerConfig {
    elementCount: number;
    colors: string[];
    types: string[];
    sizeRange: [number, number];
    yRange: [number, number];
    animationSpeed?: number;
}

// Hash-based noise for deterministic random values
function hashNoise(seed: number): number {
    const s = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453;
    return s - Math.floor(s);
}

/**
 * Level themes for Crystal Caverns
 */
const LEVEL_THEMES: LevelTheme[] = [
    // Level 1: Ancient Entry - crumbling arches, distant torchlight, dust motes
    {
        name: 'Ancient Entry',
        backgroundColor: { top: '#3a2830', bottom: '#1a1018' },
        ambientColor: 'rgba(255, 180, 100, 0.03)',
        layers: {
            distant_glow: {
                elementCount: 8,
                colors: ['#ff8844', '#ffaa44', '#ff6622'],
                types: ['torchlight', 'ember'],
                sizeRange: [40, 80],
                yRange: [0.1, 0.5],
                animationSpeed: 1.5,
            },
            far_crystals: {
                elementCount: 12,
                colors: ['#5a4a3a', '#6a5a4a', '#4a3a28'],
                types: ['arch', 'pillar_ruin'],
                sizeRange: [60, 120],
                yRange: [0.2, 0.8],
            },
            mid_stalactites: {
                elementCount: 15,
                colors: ['#4a3838', '#5a4a4a'],
                types: ['stalactite', 'dust_cloud'],
                sizeRange: [30, 70],
                yRange: [0, 0.4],
                animationSpeed: 0.5,
            },
            near_chains: {
                elementCount: 10,
                colors: ['rgba(100, 80, 60, 0.6)', 'rgba(80, 60, 40, 0.5)'],
                types: ['chain', 'dust_mote'],
                sizeRange: [80, 180],
                yRange: [0, 0.6],
                animationSpeed: 2.0,
            },
        },
    },
    // Level 2: Crystal Forest - towering crystals, ethereal mist
    {
        name: 'Crystal Forest',
        backgroundColor: { top: '#1a2a4a', bottom: '#0d1525' },
        ambientColor: 'rgba(100, 150, 255, 0.04)',
        layers: {
            distant_glow: {
                elementCount: 15,
                colors: ['#4466aa', '#5588cc', '#3355aa', '#6699dd'],
                types: ['crystal_glow', 'ethereal_orb'],
                sizeRange: [50, 100],
                yRange: [0.1, 0.7],
                animationSpeed: 0.8,
            },
            far_crystals: {
                elementCount: 20,
                colors: ['#2244aa', '#3366cc', '#1133aa', '#4477dd'],
                types: ['crystal_tower', 'crystal_cluster'],
                sizeRange: [80, 200],
                yRange: [0.3, 1.0],
            },
            mid_stalactites: {
                elementCount: 12,
                colors: ['#1a2a4a', '#2a3a5a'],
                types: ['mist_wisp', 'stalactite'],
                sizeRange: [40, 90],
                yRange: [0, 0.5],
                animationSpeed: 0.3,
            },
            near_chains: {
                elementCount: 8,
                colors: ['rgba(100, 150, 220, 0.4)', 'rgba(120, 180, 255, 0.3)'],
                types: ['mist_layer', 'crystal_shard'],
                sizeRange: [100, 250],
                yRange: [0.4, 0.9],
                animationSpeed: 0.2,
            },
        },
    },
    // Level 3: Fallen Hall - broken pillars, scattered weapons, ghostly silhouettes
    {
        name: 'Fallen Hall',
        backgroundColor: { top: '#2a1520', bottom: '#150a10' },
        ambientColor: 'rgba(180, 100, 100, 0.03)',
        layers: {
            distant_glow: {
                elementCount: 6,
                colors: ['#442222', '#553333', '#331111'],
                types: ['blood_glow', 'fading_ember'],
                sizeRange: [60, 100],
                yRange: [0.2, 0.6],
                animationSpeed: 1.0,
            },
            far_crystals: {
                elementCount: 18,
                colors: ['#2a1a1a', '#3a2222', '#1a1010'],
                types: ['broken_pillar', 'fallen_statue', 'weapon_pile'],
                sizeRange: [50, 140],
                yRange: [0.3, 0.9],
            },
            mid_stalactites: {
                elementCount: 10,
                colors: ['rgba(100, 80, 80, 0.4)', 'rgba(80, 60, 60, 0.3)'],
                types: ['ghost_silhouette', 'dust_cloud'],
                sizeRange: [60, 120],
                yRange: [0.1, 0.7],
                animationSpeed: 0.4,
            },
            near_chains: {
                elementCount: 12,
                colors: ['rgba(60, 50, 50, 0.6)', 'rgba(80, 60, 60, 0.4)'],
                types: ['chain', 'hanging_banner'],
                sizeRange: [100, 200],
                yRange: [0, 0.5],
                animationSpeed: 1.5,
            },
        },
    },
    // Level 4: Labyrinth Depths - twisting passages, ancient machinery
    {
        name: 'Labyrinth Depths',
        backgroundColor: { top: '#22222e', bottom: '#101015' },
        ambientColor: 'rgba(150, 150, 180, 0.03)',
        layers: {
            distant_glow: {
                elementCount: 10,
                colors: ['#4a4a5a', '#5a5a6a', '#3a3a4a'],
                types: ['machine_light', 'gear_glow'],
                sizeRange: [30, 70],
                yRange: [0.1, 0.8],
                animationSpeed: 2.0,
            },
            far_crystals: {
                elementCount: 25,
                colors: ['#2a2a3a', '#3a3a4a', '#1a1a2a'],
                types: ['gear_large', 'pipe', 'passage_opening'],
                sizeRange: [60, 150],
                yRange: [0.2, 0.9],
            },
            mid_stalactites: {
                elementCount: 15,
                colors: ['#252530', '#303040'],
                types: ['gear_small', 'chain', 'stalactite'],
                sizeRange: [30, 80],
                yRange: [0, 0.6],
                animationSpeed: 1.0,
            },
            near_chains: {
                elementCount: 14,
                colors: ['rgba(100, 100, 120, 0.5)', 'rgba(80, 80, 100, 0.4)'],
                types: ['chain', 'pipe_near', 'steam_vent'],
                sizeRange: [80, 200],
                yRange: [0, 0.7],
                animationSpeed: 3.0,
            },
        },
    },
    // Level 5: Heart Chamber - massive central crystal, golden light rays
    {
        name: 'Heart Chamber',
        backgroundColor: { top: '#2a2518', bottom: '#15100a' },
        ambientColor: 'rgba(255, 215, 100, 0.05)',
        layers: {
            distant_glow: {
                elementCount: 20,
                colors: ['#ffd700', '#ffaa00', '#ffee55', '#ffcc33'],
                types: ['light_ray', 'golden_sparkle'],
                sizeRange: [80, 200],
                yRange: [0, 1.0],
                animationSpeed: 0.5,
            },
            far_crystals: {
                elementCount: 15,
                colors: ['#4a3a10', '#5a4a20', '#3a2a05'],
                types: ['crystal_tower', 'golden_pillar'],
                sizeRange: [100, 250],
                yRange: [0.2, 1.0],
            },
            mid_stalactites: {
                elementCount: 12,
                colors: ['#3a3020', '#4a4030'],
                types: ['stalactite', 'golden_dust'],
                sizeRange: [40, 100],
                yRange: [0, 0.4],
                animationSpeed: 0.3,
            },
            near_chains: {
                elementCount: 8,
                colors: ['rgba(255, 200, 100, 0.3)', 'rgba(255, 180, 80, 0.2)'],
                types: ['light_beam', 'golden_mote'],
                sizeRange: [150, 300],
                yRange: [0, 1.0],
                animationSpeed: 0.8,
            },
        },
    },
];

/**
 * Parallax background system for Crystal Caverns
 * Renders multiple depth layers with level-specific themes
 */
export class ParallaxBackground {
    private layers: ParallaxLayer[] = [];
    private currentLevel: number = 0;
    private theme: LevelTheme;
    private time: number = 0;

    // Viewport dimensions (set during render)
    private viewWidth: number = 800;
    private viewHeight: number = 480;

    constructor() {
        this.theme = LEVEL_THEMES[0];
        this.generateLayers();
    }

    /**
     * Set the current level and regenerate appropriate background elements
     */
    setLevel(levelIndex: number): void {
        this.currentLevel = Math.max(0, Math.min(levelIndex, LEVEL_THEMES.length - 1));
        this.theme = LEVEL_THEMES[this.currentLevel];
        this.generateLayers();
    }

    /**
     * Generate all parallax layers based on current theme
     */
    private generateLayers(): void {
        this.layers = [
            this.createLayer('distant_glow', 0.05, this.theme.layers.distant_glow),
            this.createLayer('far_crystals', 0.15, this.theme.layers.far_crystals),
            this.createLayer('mid_stalactites', 0.3, this.theme.layers.mid_stalactites),
            this.createLayer('near_chains', 0.5, this.theme.layers.near_chains),
        ];
    }

    /**
     * Create a single parallax layer with elements
     */
    private createLayer(name: string, scrollFactor: number, config: LayerConfig): ParallaxLayer {
        const elements: ParallaxElement[] = [];
        const layerSeed = this.currentLevel * 1000 + scrollFactor * 100;

        for (let i = 0; i < config.elementCount; i++) {
            const seed = layerSeed + i * 7.31;
            const noise1 = hashNoise(seed);
            const noise2 = hashNoise(seed + 0.5);
            const noise3 = hashNoise(seed + 1.0);
            const noise4 = hashNoise(seed + 1.5);

            // Spread elements across a wider area for scrolling
            const x = noise1 * 2000 - 200;
            const yRange = config.yRange[1] - config.yRange[0];
            const y = config.yRange[0] + noise2 * yRange;

            const sizeRange = config.sizeRange[1] - config.sizeRange[0];
            const size = config.sizeRange[0] + noise3 * sizeRange;

            const colorIndex = Math.floor(noise4 * config.colors.length);
            const typeIndex = Math.floor(hashNoise(seed + 2.0) * config.types.length);

            elements.push({
                x,
                y,
                width: size,
                height: size * (0.5 + noise4 * 1.5), // Varied aspect ratios
                color: config.colors[colorIndex],
                opacity: 0.3 + noise3 * 0.5,
                type: config.types[typeIndex],
                seed,
                animOffset: noise2 * Math.PI * 2,
            });
        }

        return {
            name,
            scrollFactor,
            yOffset: 0,
            opacity: 1.0,
            elements,
        };
    }

    /**
     * Update animation state
     */
    update(dt: number): void {
        this.time += dt;
    }

    /**
     * Render all parallax layers
     */
    render(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
        this.viewWidth = ctx.canvas.width;
        this.viewHeight = ctx.canvas.height;

        // Draw gradient background
        this.renderGradientBackground(ctx);

        // Render each layer back to front
        for (const layer of this.layers) {
            this.renderLayer(ctx, layer, camX, camY);
        }

        // Add ambient overlay
        this.renderAmbientOverlay(ctx);
    }

    /**
     * Render the base gradient background
     */
    private renderGradientBackground(ctx: CanvasRenderingContext2D): void {
        const gradient = ctx.createLinearGradient(0, 0, 0, this.viewHeight);
        gradient.addColorStop(0, this.theme.backgroundColor.top);
        gradient.addColorStop(1, this.theme.backgroundColor.bottom);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);
    }

    /**
     * Render a single parallax layer
     */
    private renderLayer(ctx: CanvasRenderingContext2D, layer: ParallaxLayer, camX: number, camY: number): void {
        const offsetX = camX * layer.scrollFactor;
        const offsetY = camY * layer.scrollFactor * 0.5; // Reduced vertical parallax

        ctx.save();
        ctx.globalAlpha = layer.opacity;

        for (const element of layer.elements) {
            // Calculate screen position with parallax offset
            const screenX = element.x - offsetX;
            const screenY = element.y * this.viewHeight + layer.yOffset - offsetY;

            // Wrap horizontally for infinite scrolling effect
            const wrappedX = ((screenX % 2000) + 2000) % 2000 - 200;

            // Culling: only render if potentially visible
            if (wrappedX > -element.width && wrappedX < this.viewWidth + element.width) {
                this.renderElement(ctx, element, wrappedX, screenY, layer);
            }
        }

        ctx.restore();
    }

    /**
     * Render a single element based on its type
     */
    private renderElement(
        ctx: CanvasRenderingContext2D,
        element: ParallaxElement,
        x: number,
        y: number,
        layer: ParallaxLayer
    ): void {
        const config = this.theme.layers[layer.name as keyof typeof this.theme.layers];
        const animSpeed = config?.animationSpeed ?? 0;
        const anim = this.time * animSpeed + (element.animOffset ?? 0);

        ctx.globalAlpha = element.opacity * layer.opacity;
        ctx.fillStyle = element.color;

        switch (element.type) {
            // ===== Light and glow effects =====
            case 'torchlight':
            case 'blood_glow':
            case 'crystal_glow':
            case 'machine_light':
            case 'gear_glow':
                this.drawGlow(ctx, x, y, element, anim);
                break;

            case 'ember':
            case 'fading_ember':
                this.drawEmber(ctx, x, y, element, anim);
                break;

            case 'ethereal_orb':
                this.drawEtherealOrb(ctx, x, y, element, anim);
                break;

            case 'light_ray':
            case 'light_beam':
                this.drawLightRay(ctx, x, y, element, anim);
                break;

            case 'golden_sparkle':
            case 'golden_mote':
                this.drawSparkle(ctx, x, y, element, anim);
                break;

            // ===== Structural elements =====
            case 'arch':
                this.drawArch(ctx, x, y, element);
                break;

            case 'pillar_ruin':
            case 'broken_pillar':
            case 'golden_pillar':
                this.drawBrokenPillar(ctx, x, y, element);
                break;

            case 'fallen_statue':
                this.drawFallenStatue(ctx, x, y, element);
                break;

            case 'crystal_tower':
            case 'crystal_cluster':
            case 'crystal_shard':
                this.drawCrystal(ctx, x, y, element, anim);
                break;

            case 'stalactite':
                this.drawStalactite(ctx, x, y, element);
                break;

            // ===== Atmospheric elements =====
            case 'dust_cloud':
            case 'dust_mote':
            case 'golden_dust':
                this.drawDustMote(ctx, x, y, element, anim);
                break;

            case 'mist_wisp':
            case 'mist_layer':
                this.drawMist(ctx, x, y, element, anim);
                break;

            case 'ghost_silhouette':
                this.drawGhostSilhouette(ctx, x, y, element, anim);
                break;

            // ===== Mechanical elements =====
            case 'chain':
                this.drawChain(ctx, x, y, element, anim);
                break;

            case 'hanging_banner':
                this.drawHangingBanner(ctx, x, y, element, anim);
                break;

            case 'gear_large':
            case 'gear_small':
                this.drawGear(ctx, x, y, element, anim);
                break;

            case 'pipe':
            case 'pipe_near':
                this.drawPipe(ctx, x, y, element);
                break;

            case 'passage_opening':
                this.drawPassageOpening(ctx, x, y, element);
                break;

            case 'steam_vent':
                this.drawSteamVent(ctx, x, y, element, anim);
                break;

            case 'weapon_pile':
                this.drawWeaponPile(ctx, x, y, element);
                break;

            default:
                // Fallback: simple rectangle
                ctx.fillRect(x, y, element.width, element.height);
        }
    }

    // ===== Drawing methods for different element types =====

    private drawGlow(ctx: CanvasRenderingContext2D, x: number, y: number, el: ParallaxElement, anim: number): void {
        const flicker = 0.7 + Math.sin(anim * 3) * 0.3;
        const radius = el.width * 0.5 * flicker;

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, el.color);
        gradient.addColorStop(0.5, this.adjustAlpha(el.color, 0.3));
        gradient.addColorStop(1, 'transparent');

        ctx.fillStyle = gradient;
        ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }

    private drawEmber(ctx: CanvasRenderingContext2D, x: number, y: number, el: ParallaxElement, anim: number): void {
        const floatY = y + Math.sin(anim * 2) * 10;
        const floatX = x + Math.cos(anim * 1.5) * 5;
        const size = el.width * 0.2 * (0.5 + Math.sin(anim * 4) * 0.5);

        ctx.beginPath();
        ctx.arc(floatX, floatY, size, 0, Math.PI * 2);
        ctx.fillStyle = el.color;
        ctx.fill();
    }

    private drawEtherealOrb(ctx: CanvasRenderingContext2D, x: number, y: number, el: ParallaxElement, anim: number): void {
        const floatY = y + Math.sin(anim * 0.8) * 15;
        const pulse = 0.8 + Math.sin(anim * 2) * 0.2;
        const radius = el.width * 0.3 * pulse;

        const gradient = ctx.createRadialGradient(x, floatY, 0, x, floatY, radius);
        gradient.addColorStop(0, 'rgba(150, 200, 255, 0.8)');
        gradient.addColorStop(0.5, this.adjustAlpha(el.color, 0.4));
        gradient.addColorStop(1, 'transparent');

        ctx.fillStyle = gradient;
        ctx.fillRect(x - radius, floatY - radius, radius * 2, radius * 2);
    }

    private drawLightRay(ctx: CanvasRenderingContext2D, x: number, y: number, el: ParallaxElement, anim: number): void {
        const shimmer = 0.3 + Math.sin(anim * 0.5 + el.seed) * 0.2;

        ctx.save();
        ctx.globalAlpha = shimmer;

        const gradient = ctx.createLinearGradient(x, 0, x + el.width * 0.3, this.viewHeight);
        gradient.addColorStop(0, el.color);
        gradient.addColorStop(0.5, this.adjustAlpha(el.color, 0.3));
        gradient.addColorStop(1, 'transparent');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + el.width * 0.1, 0);
        ctx.lineTo(x + el.width * 0.4, this.viewHeight);
        ctx.lineTo(x + el.width * 0.2, this.viewHeight);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    private drawSparkle(ctx: CanvasRenderingContext2D, x: number, y: number, el: ParallaxElement, anim: number): void {
        const twinkle = Math.max(0, Math.sin(anim * 3 + el.seed * 5));
        if (twinkle < 0.3) return; // Only show when bright

        const floatY = y + Math.sin(anim + el.seed) * 20;
        const floatX = x + Math.cos(anim * 0.7 + el.seed) * 15;
        const size = el.width * 0.15 * twinkle;

        ctx.save();
        ctx.globalAlpha = twinkle * el.opacity;
        ctx.fillStyle = el.color;

        // Draw star shape
        ctx.beginPath();
        ctx.moveTo(floatX, floatY - size);
        ctx.lineTo(floatX + size * 0.3, floatY - size * 0.3);
        ctx.lineTo(floatX + size, floatY);
        ctx.lineTo(floatX + size * 0.3, floatY + size * 0.3);
        ctx.lineTo(floatX, floatY + size);
        ctx.lineTo(floatX - size * 0.3, floatY + size * 0.3);
        ctx.lineTo(floatX - size, floatY);
        ctx.lineTo(floatX - size * 0.3, floatY - size * 0.3);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    private drawArch(ctx: CanvasRenderingContext2D, x: number, y: number, el: ParallaxElement): void {
        const w = el.width;
        const h = el.height;

        ctx.fillStyle = el.color;

        // Left pillar
        ctx.fillRect(x, y, w * 0.2, h);
        // Right pillar
        ctx.fillRect(x + w * 0.8, y, w * 0.2, h);

        // Arch top (simplified)
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + h * 0.3);
        ctx.quadraticCurveTo(x + w * 0.5, y - h * 0.1, x + w, y + h * 0.3);
        ctx.lineTo(x + w, y);
        ctx.closePath();
        ctx.fill();

        // Add crumbling detail
        const crumbleColor = this.adjustBrightness(el.color, 0.7);
        ctx.fillStyle = crumbleColor;
        for (let i = 0; i < 5; i++) {
            const cx = x + hashNoise(el.seed + i) * w;
            const cy = y + h * 0.7 + hashNoise(el.seed + i + 0.5) * h * 0.3;
            const cs = 3 + hashNoise(el.seed + i + 1) * 8;
            ctx.fillRect(cx, cy, cs, cs);
        }
    }

    private drawBrokenPillar(ctx: CanvasRenderingContext2D, x: number, y: number, el: ParallaxElement): void {
        const w = el.width * 0.4;
        const h = el.height;

        ctx.fillStyle = el.color;
        ctx.fillRect(x, y + h * 0.3, w, h * 0.7);

        // Broken top
        ctx.beginPath();
        ctx.moveTo(x, y + h * 0.3);
        ctx.lineTo(x + w * 0.3, y + h * 0.15);
        ctx.lineTo(x + w * 0.5, y + h * 0.35);
        ctx.lineTo(x + w * 0.7, y + h * 0.1);
        ctx.lineTo(x + w, y + h * 0.3);
        ctx.closePath();
        ctx.fill();

        // Rubble at base
        const rubbleColor = this.adjustBrightness(el.color, 0.8);
        ctx.fillStyle = rubbleColor;
        for (let i = 0; i < 4; i++) {
            const rx = x - w * 0.2 + hashNoise(el.seed + i * 2) * w * 1.4;
            const ry = y + h - 5 - hashNoise(el.seed + i * 2 + 1) * 10;
            const rs = 5 + hashNoise(el.seed + i * 2 + 2) * 10;
            ctx.fillRect(rx, ry, rs, rs * 0.6);
        }
    }

    private drawFallenStatue(ctx: CanvasRenderingContext2D, x: number, y: number, el: ParallaxElement): void {
        const w = el.width;
        const h = el.height * 0.4;

        ctx.fillStyle = el.color;

        // Fallen body shape
        ctx.beginPath();
        ctx.ellipse(x + w * 0.5, y + h * 0.7, w * 0.4, h * 0.3, 0.2, 0, Math.PI * 2);
        ctx.fill();

        // Head
        ctx.beginPath();
        ctx.arc(x + w * 0.15, y + h * 0.5, w * 0.12, 0, Math.PI * 2);
        ctx.fill();
    }

    private drawCrystal(ctx: CanvasRenderingContext2D, x: number, y: number, el: ParallaxElement, anim: number): void {
        const w = el.width;
        const h = el.height;
        const glow = 0.6 + Math.sin(anim * 0.5 + el.seed) * 0.4;

        // Main crystal body
        ctx.fillStyle = el.color;
        ctx.beginPath();
        ctx.moveTo(x + w * 0.5, y);
        ctx.lineTo(x + w * 0.8, y + h * 0.3);
        ctx.lineTo(x + w * 0.7, y + h);
        ctx.lineTo(x + w * 0.3, y + h);
        ctx.lineTo(x + w * 0.2, y + h * 0.3);
        ctx.closePath();
        ctx.fill();

        // Highlight
        ctx.save();
        ctx.globalAlpha = glow * 0.5;
        ctx.fillStyle = this.adjustBrightness(el.color, 1.5);
        ctx.beginPath();
        ctx.moveTo(x + w * 0.5, y + h * 0.1);
        ctx.lineTo(x + w * 0.6, y + h * 0.35);
        ctx.lineTo(x + w * 0.5, y + h * 0.6);
        ctx.lineTo(x + w * 0.4, y + h * 0.35);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    private drawStalactite(ctx: CanvasRenderingContext2D, x: number, y: number, el: ParallaxElement): void {
        const w = el.width;
        const h = el.height;

        ctx.fillStyle = el.color;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + w, y);
        ctx.lineTo(x + w * 0.5, y + h);
        ctx.closePath();
        ctx.fill();
    }

    private drawDustMote(ctx: CanvasRenderingContext2D, x: number, y: number, el: ParallaxElement, anim: number): void {
        const floatY = y + Math.sin(anim * 0.5 + el.seed * 3) * 30;
        const floatX = x + Math.cos(anim * 0.3 + el.seed * 2) * 20;
        const size = el.width * 0.1 * (0.5 + Math.sin(anim + el.seed) * 0.5);

        ctx.beginPath();
        ctx.arc(floatX, floatY, size, 0, Math.PI * 2);
        ctx.fillStyle = el.color;
        ctx.fill();
    }

    private drawMist(ctx: CanvasRenderingContext2D, x: number, y: number, el: ParallaxElement, anim: number): void {
        const drift = Math.sin(anim * 0.2 + el.seed) * 30;
        const w = el.width;
        const h = el.height * 0.3;

        const gradient = ctx.createLinearGradient(x + drift, y, x + drift + w, y);
        gradient.addColorStop(0, 'transparent');
        gradient.addColorStop(0.3, el.color);
        gradient.addColorStop(0.7, el.color);
        gradient.addColorStop(1, 'transparent');

        ctx.fillStyle = gradient;
        ctx.fillRect(x + drift, y, w, h);
    }

    private drawGhostSilhouette(ctx: CanvasRenderingContext2D, x: number, y: number, el: ParallaxElement, anim: number): void {
        const drift = Math.sin(anim * 0.3 + el.seed) * 10;
        const fade = 0.3 + Math.sin(anim * 0.5 + el.seed * 2) * 0.2;
        const w = el.width * 0.4;
        const h = el.height;

        ctx.save();
        ctx.globalAlpha = fade * el.opacity;
        ctx.fillStyle = el.color;

        // Simple humanoid silhouette
        ctx.beginPath();
        // Head
        ctx.arc(x + drift + w * 0.5, y + h * 0.1, w * 0.25, 0, Math.PI * 2);
        ctx.fill();

        // Body
        ctx.beginPath();
        ctx.moveTo(x + drift + w * 0.3, y + h * 0.2);
        ctx.lineTo(x + drift + w * 0.7, y + h * 0.2);
        ctx.lineTo(x + drift + w * 0.8, y + h);
        ctx.lineTo(x + drift + w * 0.2, y + h);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    private drawChain(ctx: CanvasRenderingContext2D, x: number, y: number, el: ParallaxElement, anim: number): void {
        const sway = Math.sin(anim * 1.5 + el.seed) * 3;
        const linkCount = Math.floor(el.height / 12);
        const linkWidth = 6;
        const linkHeight = 10;

        ctx.strokeStyle = el.color;
        ctx.lineWidth = 2;

        for (let i = 0; i < linkCount; i++) {
            const ly = y + i * linkHeight;
            const lx = x + sway * (i / linkCount);

            ctx.beginPath();
            if (i % 2 === 0) {
                ctx.ellipse(lx, ly + linkHeight * 0.5, linkWidth * 0.5, linkHeight * 0.4, 0, 0, Math.PI * 2);
            } else {
                ctx.ellipse(lx, ly + linkHeight * 0.5, linkWidth * 0.3, linkHeight * 0.5, 0, 0, Math.PI * 2);
            }
            ctx.stroke();
        }
    }

    private drawHangingBanner(ctx: CanvasRenderingContext2D, x: number, y: number, el: ParallaxElement, anim: number): void {
        const sway = Math.sin(anim * 0.8 + el.seed) * 5;
        const w = el.width * 0.3;
        const h = el.height;

        ctx.fillStyle = el.color;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + w, y);
        ctx.quadraticCurveTo(x + w + sway * 0.5, y + h * 0.5, x + w * 0.8, y + h);
        ctx.lineTo(x + w * 0.5, y + h * 0.85);
        ctx.lineTo(x + w * 0.2, y + h);
        ctx.quadraticCurveTo(x + sway * 0.5, y + h * 0.5, x, y);
        ctx.closePath();
        ctx.fill();
    }

    private drawGear(ctx: CanvasRenderingContext2D, x: number, y: number, el: ParallaxElement, anim: number): void {
        const rotation = anim * 0.5 + el.seed;
        const radius = el.width * 0.35;
        const teeth = el.type === 'gear_large' ? 12 : 8;
        const toothHeight = radius * 0.25;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);

        ctx.fillStyle = el.color;
        ctx.beginPath();

        // Draw gear teeth
        for (let i = 0; i < teeth; i++) {
            const angle = (i / teeth) * Math.PI * 2;
            const nextAngle = ((i + 0.5) / teeth) * Math.PI * 2;

            const innerX = Math.cos(angle) * (radius - toothHeight);
            const innerY = Math.sin(angle) * (radius - toothHeight);
            const outerX = Math.cos(angle) * radius;
            const outerY = Math.sin(angle) * radius;
            const nextOuterX = Math.cos(nextAngle) * radius;
            const nextOuterY = Math.sin(nextAngle) * radius;
            const nextInnerX = Math.cos(nextAngle) * (radius - toothHeight);
            const nextInnerY = Math.sin(nextAngle) * (radius - toothHeight);

            if (i === 0) {
                ctx.moveTo(innerX, innerY);
            }
            ctx.lineTo(outerX, outerY);
            ctx.lineTo(nextOuterX, nextOuterY);
            ctx.lineTo(nextInnerX, nextInnerY);
        }
        ctx.closePath();
        ctx.fill();

        // Center hole
        ctx.fillStyle = this.adjustBrightness(el.color, 0.5);
        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    private drawPipe(ctx: CanvasRenderingContext2D, x: number, y: number, el: ParallaxElement): void {
        const w = el.width;
        const h = el.height * 0.15;

        // Main pipe
        ctx.fillStyle = el.color;
        ctx.fillRect(x, y, w, h);

        // Rivets
        ctx.fillStyle = this.adjustBrightness(el.color, 1.3);
        const rivetCount = Math.floor(w / 30);
        for (let i = 0; i < rivetCount; i++) {
            const rx = x + (i + 0.5) * (w / rivetCount);
            ctx.beginPath();
            ctx.arc(rx, y + h * 0.5, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    private drawPassageOpening(ctx: CanvasRenderingContext2D, x: number, y: number, el: ParallaxElement): void {
        const w = el.width;
        const h = el.height;

        // Dark opening
        const gradient = ctx.createRadialGradient(
            x + w * 0.5, y + h * 0.5, 0,
            x + w * 0.5, y + h * 0.5, w * 0.4
        );
        gradient.addColorStop(0, '#000000');
        gradient.addColorStop(0.7, el.color);
        gradient.addColorStop(1, 'transparent');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(x + w * 0.5, y + h * 0.5, w * 0.4, h * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    private drawSteamVent(ctx: CanvasRenderingContext2D, x: number, y: number, el: ParallaxElement, anim: number): void {
        // Only emit steam occasionally
        const phase = (anim + el.seed * 10) % 5;
        if (phase > 2) return;

        const steamY = y - phase * 30;
        const spread = phase * 10;
        const opacity = Math.max(0, 1 - phase * 0.5);

        ctx.save();
        ctx.globalAlpha = opacity * el.opacity * 0.5;

        const gradient = ctx.createRadialGradient(x, steamY, 0, x, steamY, 20 + spread);
        gradient.addColorStop(0, 'rgba(200, 200, 210, 0.8)');
        gradient.addColorStop(1, 'transparent');

        ctx.fillStyle = gradient;
        ctx.fillRect(x - 20 - spread, steamY - 20 - spread, 40 + spread * 2, 40 + spread * 2);

        ctx.restore();
    }

    private drawWeaponPile(ctx: CanvasRenderingContext2D, x: number, y: number, el: ParallaxElement): void {
        const w = el.width;
        const h = el.height * 0.4;

        ctx.fillStyle = el.color;

        // Draw several weapon shapes
        for (let i = 0; i < 4; i++) {
            const wx = x + hashNoise(el.seed + i) * w * 0.8;
            const wy = y + h * 0.5 + hashNoise(el.seed + i + 1) * h * 0.5;
            const angle = hashNoise(el.seed + i + 2) * Math.PI - Math.PI * 0.5;
            const length = 15 + hashNoise(el.seed + i + 3) * 25;

            ctx.save();
            ctx.translate(wx, wy);
            ctx.rotate(angle);

            // Sword blade
            ctx.fillRect(-2, -length * 0.8, 4, length);
            // Handle
            ctx.fillRect(-3, 0, 6, 8);

            ctx.restore();
        }
    }

    /**
     * Render subtle ambient overlay
     */
    private renderAmbientOverlay(ctx: CanvasRenderingContext2D): void {
        ctx.fillStyle = this.theme.ambientColor;
        ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);
    }

    // ===== Utility methods =====

    private adjustAlpha(color: string, alpha: number): string {
        // Handle rgba colors
        if (color.startsWith('rgba')) {
            return color.replace(/[\d.]+\)$/, `${alpha})`);
        }
        // Handle hex colors
        if (color.startsWith('#')) {
            const r = parseInt(color.slice(1, 3), 16);
            const g = parseInt(color.slice(3, 5), 16);
            const b = parseInt(color.slice(5, 7), 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }
        return color;
    }

    private adjustBrightness(color: string, factor: number): string {
        // Handle hex colors
        if (color.startsWith('#')) {
            const r = Math.min(255, Math.floor(parseInt(color.slice(1, 3), 16) * factor));
            const g = Math.min(255, Math.floor(parseInt(color.slice(3, 5), 16) * factor));
            const b = Math.min(255, Math.floor(parseInt(color.slice(5, 7), 16) * factor));
            return `rgb(${r}, ${g}, ${b})`;
        }
        // Handle rgba colors
        if (color.startsWith('rgba')) {
            const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
            if (match) {
                const r = Math.min(255, Math.floor(parseInt(match[1]) * factor));
                const g = Math.min(255, Math.floor(parseInt(match[2]) * factor));
                const b = Math.min(255, Math.floor(parseInt(match[3]) * factor));
                return `rgb(${r}, ${g}, ${b})`;
            }
        }
        return color;
    }
}
