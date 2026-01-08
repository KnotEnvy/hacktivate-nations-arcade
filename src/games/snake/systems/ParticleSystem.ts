// ===== src/games/snake/systems/ParticleSystem.ts =====

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    lifetime: number;
    maxLifetime: number;
    color: string;
    size: number;
    type: 'burst' | 'sparkle' | 'trail' | 'explosion' | 'glow';
    rotation?: number;
    rotationSpeed?: number;
}

interface ScorePopup {
    x: number;
    y: number;
    text: string;
    color: string;
    lifetime: number;
    maxLifetime: number;
    scale: number;
}

export class ParticleSystem {
    private particles: Particle[] = [];
    private scorePopups: ScorePopup[] = [];

    update(dt: number): void {
        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.lifetime -= dt;

            // Apply gravity to explosions
            if (p.type === 'explosion') {
                p.vy += 300 * dt;
            }

            // Apply drag
            p.vx *= 0.98;
            p.vy *= 0.98;

            // Update rotation
            if (p.rotation !== undefined && p.rotationSpeed !== undefined) {
                p.rotation += p.rotationSpeed * dt;
            }

            if (p.lifetime <= 0) {
                this.particles.splice(i, 1);
            }
        }

        // Update score popups
        for (let i = this.scorePopups.length - 1; i >= 0; i--) {
            const popup = this.scorePopups[i];
            popup.y -= 60 * dt; // Float upward
            popup.lifetime -= dt;

            if (popup.lifetime <= 0) {
                this.scorePopups.splice(i, 1);
            }
        }
    }

    render(ctx: CanvasRenderingContext2D): void {
        // Render particles
        for (const p of this.particles) {
            const alpha = Math.min(1, p.lifetime / (p.maxLifetime * 0.3));
            ctx.save();
            ctx.globalAlpha = alpha;

            if (p.type === 'glow') {
                // Glow particles have blur
                ctx.shadowColor = p.color;
                ctx.shadowBlur = 10;
            }

            ctx.fillStyle = p.color;

            if (p.rotation !== undefined) {
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rotation);
                ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
            } else if (p.type === 'sparkle') {
                // Star shape for sparkles
                this.drawStar(ctx, p.x, p.y, 4, p.size, p.size / 2);
            } else {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        }

        // Render score popups
        for (const popup of this.scorePopups) {
            const alpha = Math.min(1, popup.lifetime / (popup.maxLifetime * 0.5));
            const scale = popup.scale * (1 + (1 - popup.lifetime / popup.maxLifetime) * 0.3);

            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.font = `bold ${Math.floor(16 * scale)}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillText(popup.text, popup.x + 2, popup.y + 2);

            // Main text
            ctx.fillStyle = popup.color;
            ctx.fillText(popup.text, popup.x, popup.y);

            ctx.restore();
        }
    }

    private drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number): void {
        let rot = Math.PI / 2 * 3;
        const step = Math.PI / spikes;

        ctx.beginPath();
        ctx.moveTo(cx, cy - outerRadius);

        for (let i = 0; i < spikes; i++) {
            let x = cx + Math.cos(rot) * outerRadius;
            let y = cy + Math.sin(rot) * outerRadius;
            ctx.lineTo(x, y);
            rot += step;

            x = cx + Math.cos(rot) * innerRadius;
            y = cy + Math.sin(rot) * innerRadius;
            ctx.lineTo(x, y);
            rot += step;
        }

        ctx.lineTo(cx, cy - outerRadius);
        ctx.closePath();
        ctx.fill();
    }

    // Burst effect when eating food
    createFoodBurst(x: number, y: number, color: string): void {
        const count = 12;
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
            const speed = 100 + Math.random() * 80;

            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                lifetime: 0.4 + Math.random() * 0.2,
                maxLifetime: 0.6,
                color,
                size: 3 + Math.random() * 3,
                type: 'burst',
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 10,
            });
        }
    }

    // Sparkle effect for coins
    createCoinSparkle(x: number, y: number): void {
        const count = 8;
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count;
            const speed = 60 + Math.random() * 40;

            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                lifetime: 0.5 + Math.random() * 0.3,
                maxLifetime: 0.8,
                color: Math.random() > 0.5 ? '#FCD34D' : '#FFFFFF',
                size: 4 + Math.random() * 3,
                type: 'sparkle',
            });
        }
    }

    // Power-up activation glow
    createPowerUpGlow(x: number, y: number, color: string): void {
        const count = 16;
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count;
            const speed = 80 + Math.random() * 60;

            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                lifetime: 0.6 + Math.random() * 0.3,
                maxLifetime: 0.9,
                color,
                size: 5 + Math.random() * 4,
                type: 'glow',
            });
        }
    }

    // Death explosion - segments scatter
    createDeathExplosion(segments: Array<{ x: number; y: number }>, segmentSize: number): void {
        for (const seg of segments) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 150 + Math.random() * 100;

            // Main segment piece
            this.particles.push({
                x: seg.x + segmentSize / 2,
                y: seg.y + segmentSize / 2,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 100, // Initial upward boost
                lifetime: 1 + Math.random() * 0.5,
                maxLifetime: 1.5,
                color: '#10b981',
                size: segmentSize * 0.6,
                type: 'explosion',
                rotation: 0,
                rotationSpeed: (Math.random() - 0.5) * 15,
            });

            // Small debris
            for (let j = 0; j < 3; j++) {
                const debrisAngle = Math.random() * Math.PI * 2;
                const debrisSpeed = 80 + Math.random() * 60;

                this.particles.push({
                    x: seg.x + segmentSize / 2,
                    y: seg.y + segmentSize / 2,
                    vx: Math.cos(debrisAngle) * debrisSpeed,
                    vy: Math.sin(debrisAngle) * debrisSpeed - 50,
                    lifetime: 0.5 + Math.random() * 0.3,
                    maxLifetime: 0.8,
                    color: '#4ade80',
                    size: 2 + Math.random() * 2,
                    type: 'explosion',
                });
            }
        }
    }

    // Trail effect for fast movement
    createTrail(x: number, y: number, color: string): void {
        this.particles.push({
            x: x + (Math.random() - 0.5) * 8,
            y: y + (Math.random() - 0.5) * 8,
            vx: (Math.random() - 0.5) * 20,
            vy: (Math.random() - 0.5) * 20,
            lifetime: 0.3,
            maxLifetime: 0.3,
            color,
            size: 3 + Math.random() * 2,
            type: 'trail',
        });
    }

    // Score popup
    addScorePopup(x: number, y: number, text: string, color: string): void {
        this.scorePopups.push({
            x,
            y,
            text,
            color,
            lifetime: 1.0,
            maxLifetime: 1.0,
            scale: 1.0,
        });
    }

    // Combo milestone effect
    createComboFlash(x: number, y: number, multiplier: number): void {
        const count = 20;
        const colors = ['#FBBF24', '#F59E0B', '#FFFFFF'];

        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count;
            const speed = 100 + multiplier * 20;

            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                lifetime: 0.4,
                maxLifetime: 0.4,
                color: colors[Math.floor(Math.random() * colors.length)],
                size: 4 + Math.random() * 3,
                type: 'sparkle',
            });
        }
    }

    clear(): void {
        this.particles = [];
        this.scorePopups = [];
    }
}
