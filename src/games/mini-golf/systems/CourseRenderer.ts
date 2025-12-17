// ===== src/games/minigolf/systems/CourseRenderer.ts =====

import { CourseData } from '../data/courses';

export class CourseRenderer {
  private canvasWidth: number;
  private canvasHeight: number;
  
  // Cached grass pattern
  private grassPattern: CanvasPattern | null = null;

  constructor(width: number, height: number) {
    this.canvasWidth = width;
    this.canvasHeight = height;
  }

  render(ctx: CanvasRenderingContext2D, course: CourseData): void {
    // Draw base background
    this.renderBackground(ctx, course);
    
    // Draw course shape (fairway)
    this.renderFairway(ctx, course);
    
    // Draw course border
    this.renderBorder(ctx, course);
    
    // Draw decorations
    this.renderDecorations(ctx, course);
  }

  private renderBackground(ctx: CanvasRenderingContext2D, course: CourseData): void {
    // Sky or base color
    const gradient = ctx.createLinearGradient(0, 0, 0, this.canvasHeight);
    
    if (course.theme === 'outdoor') {
      gradient.addColorStop(0, '#87CEEB');
      gradient.addColorStop(0.4, '#98D8C8');
      gradient.addColorStop(1, '#2E7D32');
    } else if (course.theme === 'desert') {
      gradient.addColorStop(0, '#F4A460');
      gradient.addColorStop(0.3, '#DEB887');
      gradient.addColorStop(1, '#C19A6B');
    } else if (course.theme === 'night') {
      gradient.addColorStop(0, '#1a1a2e');
      gradient.addColorStop(0.5, '#16213e');
      gradient.addColorStop(1, '#0f3460');
    } else {
      // Indoor
      gradient.addColorStop(0, '#3d5c3d');
      gradient.addColorStop(1, '#2d4a2d');
    }
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
    
    // Add subtle pattern
    if (course.theme === 'outdoor' || course.theme === 'desert') {
      this.renderGrassTexture(ctx, course);
    } else if (course.theme === 'night') {
      this.renderStars(ctx);
    }
  }

  private renderGrassTexture(ctx: CanvasRenderingContext2D, course: CourseData): void {
    const baseColor = course.theme === 'desert' ? '#C19A6B' : '#228B22';
    const darkColor = course.theme === 'desert' ? '#A67B5B' : '#1E7B1E';
    
    ctx.save();
    ctx.globalAlpha = 0.3;
    
    // Random grass blades
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * this.canvasWidth;
      const y = 200 + Math.random() * (this.canvasHeight - 200);
      const height = 3 + Math.random() * 5;
      
      ctx.strokeStyle = Math.random() > 0.5 ? baseColor : darkColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (Math.random() - 0.5) * 3, y - height);
      ctx.stroke();
    }
    
    ctx.restore();
  }

  private renderStars(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    
    // Static stars (seeded by canvas size for consistency)
    const seed = this.canvasWidth * this.canvasHeight;
    for (let i = 0; i < 50; i++) {
      const x = ((seed + i * 127) % this.canvasWidth);
      const y = ((seed + i * 73) % (this.canvasHeight * 0.4));
      const size = 1 + (i % 3);
      const alpha = 0.3 + (i % 5) * 0.1;
      
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.fill();
    }
    
    // Moon
    ctx.beginPath();
    ctx.arc(this.canvasWidth - 60, 80, 25, 0, Math.PI * 2);
    ctx.fillStyle = '#F5F5DC';
    ctx.fill();
    
    // Moon glow
    ctx.beginPath();
    ctx.arc(this.canvasWidth - 60, 80, 35, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(245, 245, 220, 0.1)';
    ctx.fill();
    
    ctx.restore();
  }

  private renderFairway(ctx: CanvasRenderingContext2D, course: CourseData): void {
    const bounds = course.bounds.points;
    if (bounds.length < 3) return;
    
    ctx.save();
    
    // Fairway base
    ctx.beginPath();
    ctx.moveTo(bounds[0].x, bounds[0].y);
    for (let i = 1; i < bounds.length; i++) {
      ctx.lineTo(bounds[i].x, bounds[i].y);
    }
    ctx.closePath();
    
    // Gradient fill for fairway
    const gradient = ctx.createLinearGradient(
      0, Math.min(...bounds.map(p => p.y)),
      0, Math.max(...bounds.map(p => p.y))
    );
    
    if (course.theme === 'desert') {
      gradient.addColorStop(0, '#8B7355');
      gradient.addColorStop(0.5, '#9C8565');
      gradient.addColorStop(1, '#8B7355');
    } else if (course.theme === 'night') {
      gradient.addColorStop(0, '#1B4332');
      gradient.addColorStop(0.5, '#2D6A4F');
      gradient.addColorStop(1, '#1B4332');
    } else {
      gradient.addColorStop(0, '#228B22');
      gradient.addColorStop(0.5, '#32CD32');
      gradient.addColorStop(1, '#228B22');
    }
    
    ctx.fillStyle = gradient;
    ctx.fill();
    
    // Fairway texture (mowing pattern)
    this.renderMowingPattern(ctx, course);
    
    ctx.restore();
  }

  private renderMowingPattern(ctx: CanvasRenderingContext2D, course: CourseData): void {
    const bounds = course.bounds.points;
    if (bounds.length < 3) return;
    
    ctx.save();
    
    // Clip to fairway shape
    ctx.beginPath();
    ctx.moveTo(bounds[0].x, bounds[0].y);
    for (let i = 1; i < bounds.length; i++) {
      ctx.lineTo(bounds[i].x, bounds[i].y);
    }
    ctx.closePath();
    ctx.clip();
    
    // Draw alternating stripes
    const stripeWidth = 20;
    const minY = Math.min(...bounds.map(p => p.y));
    const maxY = Math.max(...bounds.map(p => p.y));
    
    ctx.globalAlpha = 0.1;
    let stripe = 0;
    
    for (let y = minY; y < maxY; y += stripeWidth) {
      if (stripe % 2 === 0) {
        ctx.fillStyle = course.theme === 'night' ? '#ffffff' : '#000000';
        ctx.fillRect(0, y, this.canvasWidth, stripeWidth);
      }
      stripe++;
    }
    
    ctx.restore();
  }

  private renderBorder(ctx: CanvasRenderingContext2D, course: CourseData): void {
    const bounds = course.bounds.points;
    if (bounds.length < 3) return;
    
    ctx.save();
    
    // Outer border (rough/out of bounds indicator)
    ctx.beginPath();
    ctx.moveTo(bounds[0].x, bounds[0].y);
    for (let i = 1; i < bounds.length; i++) {
      ctx.lineTo(bounds[i].x, bounds[i].y);
    }
    ctx.closePath();
    
    // Dark border
    ctx.strokeStyle = '#1a3a1a';
    ctx.lineWidth = 8;
    ctx.stroke();
    
    // Inner highlight
    ctx.strokeStyle = '#3d7a3d';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    ctx.restore();
  }

  private renderDecorations(ctx: CanvasRenderingContext2D, course: CourseData): void {
    if (!course.decorations) return;
    
    ctx.save();
    
    for (const deco of course.decorations) {
      switch (deco.type) {
        case 'tree':
          this.renderTree(ctx, deco.x, deco.y, deco.size || 1);
          break;
        case 'rock':
          this.renderRock(ctx, deco.x, deco.y, deco.size || 1);
          break;
        case 'flower':
          this.renderFlower(ctx, deco.x, deco.y);
          break;
        case 'cactus':
          this.renderCactus(ctx, deco.x, deco.y, deco.size || 1);
          break;
        case 'lamp':
          this.renderLamp(ctx, deco.x, deco.y);
          break;
      }
    }
    
    ctx.restore();
  }

  private renderTree(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    const trunkWidth = 8 * size;
    const trunkHeight = 25 * size;
    const foliageRadius = 20 * size;
    
    // Shadow
    ctx.beginPath();
    ctx.ellipse(x + 5, y + 5, foliageRadius * 0.8, foliageRadius * 0.3, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fill();
    
    // Trunk
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(x - trunkWidth / 2, y - trunkHeight, trunkWidth, trunkHeight);
    
    // Foliage (multiple circles)
    ctx.fillStyle = '#228B22';
    ctx.beginPath();
    ctx.arc(x, y - trunkHeight - foliageRadius * 0.5, foliageRadius, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#2E8B2E';
    ctx.beginPath();
    ctx.arc(x - foliageRadius * 0.5, y - trunkHeight - foliageRadius * 0.3, foliageRadius * 0.8, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(x + foliageRadius * 0.5, y - trunkHeight - foliageRadius * 0.3, foliageRadius * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }

  private renderRock(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    const w = 20 * size;
    const h = 15 * size;
    
    // Shadow
    ctx.beginPath();
    ctx.ellipse(x + 3, y + 3, w * 0.6, h * 0.3, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fill();
    
    // Rock body
    ctx.beginPath();
    ctx.ellipse(x, y - h * 0.3, w * 0.5, h * 0.5, 0, 0, Math.PI * 2);
    
    const gradient = ctx.createRadialGradient(x - w * 0.2, y - h * 0.5, 0, x, y, w);
    gradient.addColorStop(0, '#A0A0A0');
    gradient.addColorStop(0.5, '#808080');
    gradient.addColorStop(1, '#606060');
    
    ctx.fillStyle = gradient;
    ctx.fill();
    
    ctx.strokeStyle = '#505050';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  private renderFlower(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    // Stem
    ctx.strokeStyle = '#228B22';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 15);
    ctx.stroke();
    
    // Petals
    const colors = ['#FF69B4', '#FFD700', '#FF6B6B', '#87CEEB'];
    const color = colors[Math.floor((x + y) % colors.length)];
    
    ctx.fillStyle = color;
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const px = x + Math.cos(angle) * 5;
      const py = y - 15 + Math.sin(angle) * 5;
      
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Center
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(x, y - 15, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  private renderCactus(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    const h = 40 * size;
    const w = 12 * size;
    
    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.ellipse(x + 3, y + 2, w * 0.8, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Main body
    ctx.fillStyle = '#2E8B57';
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - h, w, h, w / 2);
    ctx.fill();
    
    // Left arm
    ctx.beginPath();
    ctx.roundRect(x - w * 1.5, y - h * 0.6, w * 0.8, h * 0.4, w / 3);
    ctx.fill();
    
    // Right arm
    ctx.beginPath();
    ctx.roundRect(x + w * 0.7, y - h * 0.7, w * 0.8, h * 0.3, w / 3);
    ctx.fill();
    
    // Highlight
    ctx.strokeStyle = '#3CB371';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - h + 5);
    ctx.lineTo(x, y - 5);
    ctx.stroke();
  }

  private renderLamp(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    // Post
    ctx.fillStyle = '#333333';
    ctx.fillRect(x - 3, y - 60, 6, 60);
    
    // Lamp head
    ctx.fillStyle = '#444444';
    ctx.beginPath();
    ctx.moveTo(x - 12, y - 60);
    ctx.lineTo(x + 12, y - 60);
    ctx.lineTo(x + 8, y - 70);
    ctx.lineTo(x - 8, y - 70);
    ctx.closePath();
    ctx.fill();
    
    // Light glow
    const gradient = ctx.createRadialGradient(x, y - 55, 0, x, y - 55, 40);
    gradient.addColorStop(0, 'rgba(255, 255, 200, 0.4)');
    gradient.addColorStop(1, 'rgba(255, 255, 200, 0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y - 55, 40, 0, Math.PI * 2);
    ctx.fill();
    
    // Light bulb
    ctx.fillStyle = '#FFFFD0';
    ctx.beginPath();
    ctx.arc(x, y - 55, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}
