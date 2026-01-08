// ===== src/games/minesweeper/systems/ParticleSystem.ts =====

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    lifetime: number;
    maxLifetime: number;
    color: string;
    size: number;
    type: 'dust' | 'sparkle' | 'debris' | 'confetti' | 'shockwave';
    rotation?: number;
    rotationSpeed?: number;
    scale?: number;
}

interface RevealWave {
    x: number;
    y: number;
    radius: number;
    maxRadius: number;
    speed: number;
    color: string;
}

export class ParticleSystem {
    private particles: Particle[] = [];
    private waves: RevealWave[] = [];

    update(dt: number): void {
        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.lifetime -= dt;

            // Gravity for debris/confetti
            if (p.type === 'debris' || p.type === 'confetti') {
                p.vy += 400 * dt;
            }

            // Rotation
            if (p.rotation !== undefined && p.rotationSpeed !== undefined) {
                p.rotation += p.rotationSpeed * dt;
            }

            // Shockwave expansion
            if (p.type === 'shockwave' && p.scale !== undefined) {
                p.scale += dt * 3;
            }

            if (p.lifetime <= 0) {
                this.particles.splice(i, 1);
            }
        }

        // Update waves
        for (let i = this.waves.length - 1; i >= 0; i--) {
            const w = this.waves[i];
            w.radius += w.speed * dt;
            if (w.radius >= w.maxRadius) {
                this.waves.splice(i, 1);
            }
        }
    }

    render(ctx: CanvasRenderingContext2D): void {
        // Render waves first (behind particles)
        for (const w of this.waves) {
            const alpha = 1 - (w.radius / w.maxRadius);
            ctx.save();
            ctx.strokeStyle = w.color;
            ctx.globalAlpha = alpha * 0.5;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(w.x, w.y, w.radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        // Render particles
        for (const p of this.particles) {
            const alpha = Math.min(1, p.lifetime / (p.maxLifetime * 0.3));
            ctx.save();
            ctx.globalAlpha = alpha;

            if (p.type === 'shockwave') {
                const scale = p.scale || 1;
                ctx.strokeStyle = p.color;
                ctx.lineWidth = 4 * (1 - scale / 3);
                ctx.beginPath();
                ctx.arc(p.x, p.y, 20 * scale, 0, Math.PI * 2);
                ctx.stroke();
            } else if (p.type === 'sparkle') {
                this.drawStar(ctx, p.x, p.y, 4, p.size, p.size / 2, p.color);
            } else if (p.type === 'confetti') {
                ctx.fillStyle = p.color;
                ctx.translate(p.x, p.y);
                if (p.rotation) ctx.rotate(p.rotation);
                ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.5);
            } else {
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        }
    }

    private drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number, color: string): void {
        ctx.fillStyle = color;
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

    // Cell reveal dust
    createRevealDust(x: number, y: number, cellSize: number): void {
        const count = 6;
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
            const speed = 40 + Math.random() * 30;

            this.particles.push({
                x: x + cellSize / 2,
                y: y + cellSize / 2,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                lifetime: 0.3 + Math.random() * 0.2,
                maxLifetime: 0.5,
                color: '#9CA3AF',
                size: 2 + Math.random() * 2,
                type: 'dust',
            });
        }
    }

    // Cascade wave effect 
    createCascadeWave(x: number, y: number): void {
        this.waves.push({
            x,
            y,
            radius: 0,
            maxRadius: 100,
            speed: 200,
            color: '#34D399',
        });
    }

    // Flag sparkle
    createFlagSparkle(x: number, y: number): void {
        const count = 8;
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count;
            const speed = 30 + Math.random() * 20;

            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                lifetime: 0.4 + Math.random() * 0.2,
                maxLifetime: 0.6,
                color: Math.random() > 0.5 ? '#FACC15' : '#FFFFFF',
                size: 4 + Math.random() * 2,
                type: 'sparkle',
            });
        }
    }

    // Mine explosion
    createExplosion(x: number, y: number): void {
        // Shockwave
        this.particles.push({
            x,
            y,
            vx: 0,
            vy: 0,
            lifetime: 0.4,
            maxLifetime: 0.4,
            color: '#EF4444',
            size: 0,
            type: 'shockwave',
            scale: 0,
        });

        // Debris
        const count = 16;
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
            const speed = 100 + Math.random() * 100;

            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 50,
                lifetime: 0.6 + Math.random() * 0.4,
                maxLifetime: 1.0,
                color: Math.random() > 0.5 ? '#DC2626' : '#FCA5A5',
                size: 3 + Math.random() * 4,
                type: 'debris',
                rotation: 0,
                rotationSpeed: (Math.random() - 0.5) * 10,
            });
        }
    }

    // Victory confetti
    createConfetti(canvasWidth: number): void {
        const colors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899'];
        const count = 50;

        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: Math.random() * canvasWidth,
                y: -20 - Math.random() * 100,
                vx: (Math.random() - 0.5) * 100,
                vy: 100 + Math.random() * 50,
                lifetime: 3 + Math.random() * 2,
                maxLifetime: 5,
                color: colors[Math.floor(Math.random() * colors.length)],
                size: 6 + Math.random() * 4,
                type: 'confetti',
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 8,
            });
        }
    }

    clear(): void {
        this.particles = [];
        this.waves = [];
    }
}
