// ===== src/games/tapdodge/systems/LaneWarningSystem.ts =====

interface LaneWarning {
    lane: number;
    timeToImpact: number;
    type: 'obstacle' | 'wall' | 'gem';
    intensity: number;
}

export class LaneWarningSystem {
    private warnings: LaneWarning[] = [];
    private readonly LANE_COUNT = 5;
    private readonly WARNING_THRESHOLD = 1.5; // seconds ahead to warn
    private canvasWidth: number;

    private pulsePhase: number = 0;

    constructor(canvasWidth: number) {
        this.canvasWidth = canvasWidth;
    }

    public update(dt: number): void {
        this.pulsePhase += dt * 8;

        // Decay warnings
        for (const warning of this.warnings) {
            warning.timeToImpact -= dt;
            warning.intensity = Math.min(1, (this.WARNING_THRESHOLD - warning.timeToImpact) / this.WARNING_THRESHOLD);
        }

        // Remove expired warnings
        this.warnings = this.warnings.filter(w => w.timeToImpact > 0);
    }

    public addWarning(lane: number, timeToImpact: number, type: 'obstacle' | 'wall' | 'gem'): void {
        // Don't add duplicates
        const existing = this.warnings.find(w => w.lane === lane && Math.abs(w.timeToImpact - timeToImpact) < 0.3);
        if (existing) return;

        if (timeToImpact <= this.WARNING_THRESHOLD) {
            this.warnings.push({
                lane,
                timeToImpact,
                type,
                intensity: 0
            });
        }
    }

    public clearWarnings(): void {
        this.warnings = [];
    }

    public render(ctx: CanvasRenderingContext2D): void {
        const laneWidth = this.canvasWidth / this.LANE_COUNT;
        const warningY = 20;
        const warningHeight = 30;

        // Group warnings by lane
        const laneWarnings: Map<number, LaneWarning[]> = new Map();
        for (const warning of this.warnings) {
            if (!laneWarnings.has(warning.lane)) {
                laneWarnings.set(warning.lane, []);
            }
            laneWarnings.get(warning.lane)!.push(warning);
        }

        // Render each lane's warnings
        for (const [lane, warnings] of laneWarnings) {
            const laneX = lane * laneWidth;
            const laneCenterX = laneX + laneWidth / 2;

            // Get most urgent warning
            const mostUrgent = warnings.reduce((a, b) => a.timeToImpact < b.timeToImpact ? a : b);
            const intensity = mostUrgent.intensity;
            const pulse = Math.sin(this.pulsePhase + lane) * 0.2 + 0.8;

            // Choose color based on type
            let color: string;
            let icon: string;
            switch (mostUrgent.type) {
                case 'gem':
                    color = '#A855F7'; // Purple for gems (good!)
                    icon = '💎';
                    break;
                case 'wall':
                    color = '#EF4444'; // Red for walls
                    icon = '⚠️';
                    break;
                default:
                    color = '#F97316'; // Orange for regular obstacles
                    icon = '▼';
            }

            // Warning background
            ctx.fillStyle = color + Math.floor(intensity * pulse * 100).toString(16).padStart(2, '0');
            ctx.fillRect(laneX + 2, warningY, laneWidth - 4, warningHeight);

            // Animated down arrow or icon
            ctx.font = mostUrgent.type === 'gem' ? '16px Arial' : 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            if (mostUrgent.type === 'obstacle') {
                // Animated arrow pointing down
                ctx.fillStyle = `rgba(255, 255, 255, ${intensity * pulse})`;
                const arrowY = warningY + warningHeight / 2 + Math.sin(this.pulsePhase * 2 + lane) * 3;

                ctx.beginPath();
                ctx.moveTo(laneCenterX, arrowY + 8);
                ctx.lineTo(laneCenterX - 8, arrowY - 4);
                ctx.lineTo(laneCenterX + 8, arrowY - 4);
                ctx.closePath();
                ctx.fill();
            } else {
                // Icon
                ctx.fillText(icon, laneCenterX, warningY + warningHeight / 2);
            }

            // Urgency indicator - flashing border when very close
            if (mostUrgent.timeToImpact < 0.5) {
                const flash = Math.sin(this.pulsePhase * 4) > 0;
                if (flash) {
                    ctx.strokeStyle = '#FFFFFF';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(laneX + 2, warningY, laneWidth - 4, warningHeight);
                }
            }
        }
    }

    public resize(canvasWidth: number): void {
        this.canvasWidth = canvasWidth;
    }
}
