// ===== src/games/runner/systems/ParallaxSystem.ts (FULL DETAIL - ANIMATION FIXED) =====
import { EnvironmentTheme } from './EnvironmentSystem';

interface ParallaxLayer {
  speed: number;
  zIndex: number;
  name: string;
  renderMethod: (ctx: CanvasRenderingContext2D, offset: number, theme: EnvironmentTheme) => void;
}

export class ParallaxSystem {
  private layers: ParallaxLayer[] = [];
  private canvasWidth: number;
  private canvasHeight: number;
  private groundY: number;
  private distance: number = 0;
  
  constructor(canvasWidth: number, canvasHeight: number, groundY: number) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.groundY = groundY;
    this.initializeLayers();
  }
  
  private initializeLayers(): void {
    // Layer 1: Far Background Mountains/Skyline - Full panoramic view
    this.layers.push({
      name: 'background',
      speed: 0.05,
      zIndex: 1,
      renderMethod: this.renderBackgroundLayer.bind(this)
    });
    
    // Layer 2: Mid-distance detailed landscape
    this.layers.push({
      name: 'midground',
      speed: 0.15,
      zIndex: 2,
      renderMethod: this.renderMidgroundLayer.bind(this)
    });
    
    // Layer 3: Detailed cloud formations
    this.layers.push({
      name: 'clouds',
      speed: 0.25,
      zIndex: 3,
      renderMethod: this.renderCloudLayer.bind(this)
    });
    
    // Layer 4: Rich foreground elements
    this.layers.push({
      name: 'foreground',
      speed: 0.4,
      zIndex: 4,
      renderMethod: this.renderForegroundLayer.bind(this)
    });
    
    // Layer 5: Detailed ground textures
    this.layers.push({
      name: 'ground-details',
      speed: 1.0,
      zIndex: 5,
      renderMethod: this.renderGroundDetailLayer.bind(this)
    });
  }
  
  /**
   * Advance the parallax layers by the given distance delta.
   * Using a delta keeps the internal distance small and avoids
   * precision issues when the game runs for a long time.
   */
  update(delta: number): void {
    this.distance += delta;
  }

  /** Reset parallax scroll distance. */
    reset(): void {
    this.distance = 0;
  }
  
  render(ctx: CanvasRenderingContext2D, theme: EnvironmentTheme): void {
    this.layers.forEach(layer => {
      const layerWidth = this.canvasWidth * 2; // Same as before
      const offset = (this.distance * layer.speed) % layerWidth; // Same calculation
      
      ctx.save();
      layer.renderMethod(ctx, offset, theme);
      ctx.restore();
    });
  }
  
  // LAYER 1: Far Background - Full panoramic mountains/skylines (SAME DETAIL, FIXED ANIMATION)
  private renderBackgroundLayer(ctx: CanvasRenderingContext2D, offset: number, theme: EnvironmentTheme): void {
    const layerWidth = this.canvasWidth * 2;
    const colors = this.getBackgroundColors(theme);
    
    ctx.globalAlpha = 0.8; // Much more visible (was 0.4)
    
    // Render the background twice for seamless tiling (SAME AS BEFORE)
    for (let tile = 0; tile < 2; tile++) {
      const tileX = -offset + (tile * layerWidth);
      
      switch (theme) {
        case 'day':
          this.renderDayMountains(ctx, tileX, colors);
          break;
        case 'sunset':
          this.renderSunsetMountains(ctx, tileX, colors);
          break;
        case 'night':
          this.renderNightSkyline(ctx, tileX, colors);
          break;
        case 'desert':
          this.renderDesertDunes(ctx, tileX, colors);
          break;
        case 'forest':
          this.renderForestRidges(ctx, tileX, colors);
          break;
      }
    }
    
    ctx.globalAlpha = 1;
  }
  
  private renderDayMountains(ctx: CanvasRenderingContext2D, x: number, colors: any): void {
    // Multiple overlapping mountain ranges - MUCH LARGER SCALE
    const ranges = [
      { peaks: 4, height: 180, color: colors.far },      // Was 60, now 180
      { peaks: 5, height: 240, color: colors.mid },      // Was 80, now 240  
      { peaks: 3, height: 300, color: colors.near }      // Was 100, now 300
    ];
    
    ranges.forEach((range, rangeIndex) => {
      ctx.fillStyle = range.color;
      ctx.globalAlpha = 0.5 + rangeIndex * 0.15; // Much more visible (was 0.2 + rangeIndex * 0.1)
      
      ctx.beginPath();
      ctx.moveTo(x, this.groundY);
      
      for (let i = 0; i <= range.peaks; i++) {
        // FIXED: Use consistent seed for deterministic peaks
        const peakX = x + (i / range.peaks) * this.canvasWidth * 2;
        const seedValue = Math.floor(peakX / 100) * 1.3; // Deterministic seed
        const peakY = this.groundY - range.height - Math.sin(seedValue) * 30;
        const valleyY = this.groundY - range.height * 0.6 - Math.cos(seedValue * 0.8) * 20;
        
        ctx.lineTo(peakX, peakY);
        if (i < range.peaks) {
          ctx.lineTo(peakX + this.canvasWidth / range.peaks * 0.5, valleyY);
        }
      }
      
      ctx.lineTo(x + this.canvasWidth * 2, this.groundY);
      ctx.closePath();
      ctx.fill();
    });
  }
  
  private renderSunsetMountains(ctx: CanvasRenderingContext2D, x: number, colors: any): void {
    // Dramatic silhouettes with sun disk (SAME AS BEFORE)
    
    // Sun disk
    const sunX = x + this.canvasWidth * 1.5;
    const sunY = this.groundY - 120;
    const gradient = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 50);
    gradient.addColorStop(0, 'rgba(255, 200, 100, 0.8)');
    gradient.addColorStop(1, 'rgba(255, 100, 50, 0.3)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 50, 0, Math.PI * 2);
    ctx.fill();
    
    // Layered mountain silhouettes - MUCH TALLER
    const layers = [
      { height: 360, opacity: 0.8 },  // Was 120, now 360
      { height: 270, opacity: 0.6 },  // Was 90, now 270
      { height: 180, opacity: 0.4 }   // Was 60, now 180
    ];
    
    layers.forEach((layer, i) => {
      ctx.fillStyle = colors.silhouette;
      ctx.globalAlpha = layer.opacity;
      
      ctx.beginPath();
      ctx.moveTo(x, this.groundY);
      
      // Create dramatic jagged peaks (FIXED: deterministic)
      for (let px = 0; px <= this.canvasWidth * 2; px += 80) {
        const seedValue = Math.floor((x + px) / 100) * 0.01 + i; // Deterministic
        const peakHeight = layer.height + Math.sin(seedValue) * 40;
        ctx.lineTo(x + px, this.groundY - peakHeight);
      }
      
      ctx.lineTo(x + this.canvasWidth * 2, this.groundY);
      ctx.closePath();
      ctx.fill();
    });
  }
  
  private renderNightSkyline(ctx: CanvasRenderingContext2D, x: number, colors: any): void {
    // City skyline with lit windows (SAME AS BEFORE)
    ctx.fillStyle = colors.buildings;
    ctx.globalAlpha = 0.8;
    
    // Create building silhouettes
    for (let bx = 0; bx < this.canvasWidth * 2; bx += 40) {
      // FIXED: Deterministic building heights - MUCH TALLER
      const buildingIndex = Math.floor((x + bx) / 40);
      const buildingHeight = 180 + (buildingIndex % 7) * 45; // Was 60 + % 7 * 15, now much taller
      const buildingWidth = 30 + (buildingIndex % 3) * 8; // Deterministic
      
      // Building outline
      ctx.fillRect(x + bx, this.groundY - buildingHeight, buildingWidth, buildingHeight);
      
      // Lit windows
      ctx.fillStyle = 'rgba(255, 255, 200, 0.6)';
      for (let floor = 0; floor < buildingHeight; floor += 12) {
        for (let window = 0; window < buildingWidth; window += 8) {
          // FIXED: Deterministic window lighting
          if ((buildingIndex + Math.floor(floor/12) + Math.floor(window/8)) % 3 !== 0) {
            ctx.fillRect(x + bx + window + 2, this.groundY - buildingHeight + floor + 2, 4, 6);
          }
        }
      }
      
      ctx.fillStyle = colors.buildings;
    }
    
    // Add stars (FIXED: deterministic pattern)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    for (let star = 0; star < 30; star++) {
      const starX = x + (star * 43) % (this.canvasWidth * 2);
      const starY = 20 + (star * 17) % (this.groundY - 150);
      const size = (star % 5 === 0) ? 2 : 1; // Deterministic size
      ctx.fillRect(starX, starY, size, size);
    }
  }
  
  private renderDesertDunes(ctx: CanvasRenderingContext2D, x: number, colors: any): void {
    // Rolling sand dunes (SAME AS BEFORE)
    ctx.fillStyle = colors.dunes;
    
    const duneCount = 6;
    for (let d = 0; d < duneCount; d++) {
      const duneWidth = this.canvasWidth / duneCount * 2;
      // FIXED: Deterministic dune height - MUCH LARGER
      const seedValue = Math.floor((x + d * duneWidth) / 200) * 0.7;
      const duneHeight = 120 + Math.sin(seedValue) * 90; // Was 40 + sin * 30, now much larger
      
      ctx.globalAlpha = 0.3 + d * 0.05;
      ctx.beginPath();
      ctx.moveTo(x + d * duneWidth * 0.7, this.groundY);
      
      // Smooth dune curves
      ctx.quadraticCurveTo(
        x + d * duneWidth * 0.7 + duneWidth * 0.5,
        this.groundY - duneHeight,
        x + d * duneWidth * 0.7 + duneWidth,
        this.groundY - duneHeight * 0.3
      );
      
      ctx.lineTo(x + d * duneWidth * 0.7 + duneWidth, this.groundY);
      ctx.closePath();
      ctx.fill();
    }
  }
  
  private renderForestRidges(ctx: CanvasRenderingContext2D, x: number, colors: any): void {
    // Forested ridges with dense tree line - MUCH TALLER
    const ridges = [
      { height: 300, density: 0.8 }, // Was 100, now 300
      { height: 210, density: 0.6 }, // Was 70, now 210
      { height: 150, density: 0.4 }  // Was 50, now 150
    ];
    
    ridges.forEach((ridge, ridgeIndex) => {
      ctx.fillStyle = colors.ridges[ridgeIndex];
      ctx.globalAlpha = 0.7 - ridgeIndex * 0.15; // More visible (was 0.4 - ridgeIndex * 0.1)
      
      // Base ridge shape
      ctx.beginPath();
      ctx.moveTo(x, this.groundY);
      
      for (let rx = 0; rx <= this.canvasWidth * 2; rx += 20) {
        // FIXED: Deterministic ridge shape
        const seedValue = Math.floor((x + rx) / 100) * 0.02;
        const ridgeY = this.groundY - ridge.height - Math.sin(seedValue) * 20;
        ctx.lineTo(x + rx, ridgeY);
      }
      
      ctx.lineTo(x + this.canvasWidth * 2, this.groundY);
      ctx.closePath();
      ctx.fill();
      
      // Tree line on ridge
      ctx.fillStyle = colors.trees;
      for (let tx = 0; tx < this.canvasWidth * 2; tx += 8) {
        // FIXED: Deterministic tree placement
        const treeIndex = Math.floor((x + tx) / 8);
        if ((treeIndex % 10) < ridge.density * 10) { // Deterministic density
          const seedValue = Math.floor((x + tx) / 100) * 0.02;
          const baseY = this.groundY - ridge.height - Math.sin(seedValue) * 20;
          const treeHeight = 45 + (treeIndex % 3) * 15; // Deterministic height - MUCH TALLER (was 15 + % 3 * 5)
          ctx.fillRect(x + tx, baseY - treeHeight, 2, treeHeight);
        }
      }
    });
  }
  
  // LAYER 2: Mid-ground detailed landscape (ALL ORIGINAL DETAIL PRESERVED)
  private renderMidgroundLayer(ctx: CanvasRenderingContext2D, offset: number, theme: EnvironmentTheme): void {
    const layerWidth = this.canvasWidth * 2;
    ctx.globalAlpha = 0.85; // More visible (was 0.7)
    
    for (let tile = 0; tile < 2; tile++) {
      const tileX = -offset + (tile * layerWidth);
      this.renderMidgroundElements(ctx, tileX, theme);
    }
    
    ctx.globalAlpha = 1;
  }
  
  private renderMidgroundElements(ctx: CanvasRenderingContext2D, x: number, theme: EnvironmentTheme): void {
    const colors = this.getMidgroundColors(theme);
    
    // Create varied landscape elements across the full width (SAME AS BEFORE)
    for (let mx = 0; mx < this.canvasWidth * 2; mx += 60) {
      const elementIndex = Math.floor((x + mx) / 60); // FIXED: Deterministic based on world position
      const elementType = elementIndex % 4;
      
      switch (elementType) {
        case 0: // Large trees - BIGGER TREES
          const treeSize = 45 + (elementIndex % 3) * 15; // FIXED: Much larger (was 25 + % 3 * 5)
          this.renderDetailedTree(ctx, x + mx, colors, treeSize);
          break;
        case 1: // Rock formations
          this.renderRockFormation(ctx, x + mx, colors);
          break;
        case 2: // Small grove
          if (theme === 'forest') {
            this.renderTreeGrove(ctx, x + mx, colors);
          }
          break;
        case 3: // Theme-specific elements
          this.renderThemeElement(ctx, x + mx, theme, colors);
          break;
      }
    }
  }
  
  private renderDetailedTree(ctx: CanvasRenderingContext2D, x: number, colors: any, size: number): void {
    const treeY = this.groundY - size * 1.5;
    
    // Trunk with texture (SAME AS BEFORE)
    ctx.fillStyle = colors.trunk;
    const trunkWidth = size * 0.15;
    ctx.fillRect(x - trunkWidth/2, treeY + size, trunkWidth, size * 0.5);
    
    // Trunk texture lines
    ctx.strokeStyle = colors.trunkDark;
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(x - trunkWidth/4, treeY + size + i * 8);
      ctx.lineTo(x + trunkWidth/4, treeY + size + i * 8);
      ctx.stroke();
    }
    
    // Layered canopy (SAME AS BEFORE)
    const canopyLayers = [
      { radius: size * 0.6, offset: 0, color: colors.canopyDark },
      { radius: size * 0.5, offset: -3, color: colors.canopyMid },
      { radius: size * 0.4, offset: -6, color: colors.canopyLight }
    ];
    
    canopyLayers.forEach(layer => {
      ctx.fillStyle = layer.color;
      ctx.beginPath();
      ctx.arc(x, treeY + layer.offset, layer.radius, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  
  private renderRockFormation(ctx: CanvasRenderingContext2D, x: number, colors: any): void {
    // Multiple rock clusters (SAME AS BEFORE)
    for (let r = 0; r < 3; r++) {
      const rockX = x + r * 8;
      const rockIndex = Math.floor(rockX / 8); // FIXED: Deterministic size
      const rockSize = 8 + (rockIndex % 3) * 4;
      const rockY = this.groundY - rockSize;
      
      ctx.fillStyle = colors.rock;
      ctx.fillRect(rockX, rockY, rockSize, rockSize);
      
      // Rock highlight
      ctx.fillStyle = colors.rockHighlight;
      ctx.fillRect(rockX, rockY, rockSize * 0.3, rockSize * 0.3);
    }
  }
  
  private renderTreeGrove(ctx: CanvasRenderingContext2D, x: number, colors: any): void {
    // Cluster of small trees (SAME AS BEFORE)
    for (let t = 0; t < 4; t++) {
      const treeX = x + t * 12;
      const treeIndex = Math.floor(treeX / 12); // FIXED: Deterministic size
      const treeSize = 15 + (treeIndex % 3) * 3;
      this.renderDetailedTree(ctx, treeX, colors, treeSize);
    }
  }
  
  private renderThemeElement(ctx: CanvasRenderingContext2D, x: number, theme: EnvironmentTheme, colors: any): void {
    switch (theme) {
      case 'desert':
        // Cactus (SAME AS BEFORE)
        ctx.fillStyle = colors.cactus;
        const cactusIndex = Math.floor(x / 60); // FIXED: Deterministic height
        const cactusHeight = 60 + (cactusIndex % 3) * 20; // MUCH TALLER (was 30 + % 3 * 10)
        ctx.fillRect(x, this.groundY - cactusHeight, 6, cactusHeight);
        // Cactus arms
        ctx.fillRect(x - 8, this.groundY - cactusHeight * 0.7, 8, 4);
        ctx.fillRect(x + 6, this.groundY - cactusHeight * 0.5, 8, 4);
        break;
      case 'night':
        // Lamp post (SAME AS BEFORE)
        ctx.fillStyle = colors.post;
        ctx.fillRect(x, this.groundY - 60, 3, 60); // TALLER lamp post (was 40)
        // Light
        ctx.fillStyle = 'rgba(255, 255, 200, 0.8)';
        ctx.beginPath();
        ctx.arc(x + 1.5, this.groundY - 55, 8, 0, Math.PI * 2); // Adjusted light position
        ctx.fill();
        break;
    }
  }
  
  // LAYER 3: Enhanced cloud formations (ALL DETAIL PRESERVED)
  private renderCloudLayer(ctx: CanvasRenderingContext2D, offset: number, theme: EnvironmentTheme): void {
    const layerWidth = this.canvasWidth * 2;
    const cloudColors = this.getCloudColors(theme);
    
    ctx.globalAlpha = theme === 'night' ? 0.5 : 0.8; // More visible (was 0.3 : 0.6)
    
    for (let tile = 0; tile < 2; tile++) {
      const tileX = -offset + (tile * layerWidth);
      this.renderDetailedClouds(ctx, tileX, cloudColors, theme);
    }
    
    ctx.globalAlpha = 1;
  }
  
  private renderDetailedClouds(ctx: CanvasRenderingContext2D, x: number, cloudColors: any, theme: EnvironmentTheme): void {
    // Large, detailed cloud formations (SAME POSITIONS AS BEFORE)
    const cloudPositions = [
      { x: 100, y: 40, size: 1.2, type: 'cumulus' },
      { x: 300, y: 60, size: 0.8, type: 'wispy' },
      { x: 500, y: 30, size: 1.5, type: 'cumulus' },
      { x: 750, y: 70, size: 1.0, type: 'scattered' },
      { x: 950, y: 45, size: 0.9, type: 'wispy' }
    ];
    
    cloudPositions.forEach(cloud => {
      const cloudX = x + cloud.x;
      const cloudY = cloud.y;
      
      switch (cloud.type) {
        case 'cumulus':
          this.renderCumulusCloud(ctx, cloudX, cloudY, cloud.size, cloudColors);
          break;
        case 'wispy':
          this.renderWispyCloud(ctx, cloudX, cloudY, cloud.size, cloudColors);
          break;
        case 'scattered':
          this.renderScatteredClouds(ctx, cloudX, cloudY, cloud.size, cloudColors);
          break;
      }
    });
  }
  
  private renderCumulusCloud(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, colors: any): void {
    const baseRadius = 25 * size;
    
    // Cloud shadow/depth (SAME AS BEFORE)
    ctx.fillStyle = colors.shadow;
    const bubbles = [
      { x: x - 10, y: y + 5, r: baseRadius * 0.8 },
      { x: x + 20, y: y + 3, r: baseRadius },
      { x: x + 50, y: y + 5, r: baseRadius * 0.7 },
      { x: x + 15, y: y - 8, r: baseRadius * 0.6 }
    ];
    
    bubbles.forEach(bubble => {
      ctx.beginPath();
      ctx.arc(bubble.x, bubble.y, bubble.r, 0, Math.PI * 2);
      ctx.fill();
    });
    
    // Cloud highlights
    ctx.fillStyle = colors.highlight;
    bubbles.forEach(bubble => {
      ctx.beginPath();
      ctx.arc(bubble.x - 3, bubble.y - 3, bubble.r * 0.9, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  
  private renderWispyCloud(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, colors: any): void {
    ctx.fillStyle = colors.wispy;
    
    // Elongated wispy shape (SAME AS BEFORE)
    ctx.beginPath();
    ctx.ellipse(x, y, 60 * size, 8 * size, 0.2, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.beginPath();
    ctx.ellipse(x + 30, y - 5, 40 * size, 6 * size, -0.1, 0, Math.PI * 2);
    ctx.fill();
  }
  
  private renderScatteredClouds(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, colors: any): void {
    // Multiple small cloud puffs (SAME AS BEFORE)
    for (let i = 0; i < 4; i++) {
      const puffX = x + i * 20;
      const puffY = y + Math.sin(i) * 8;
      const puffSize = (12 + (i % 3) * 3) * size; // FIXED: Deterministic size
      
      ctx.fillStyle = colors.puff;
      ctx.beginPath();
      ctx.arc(puffX, puffY, puffSize, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  // LAYER 4: Rich foreground elements (ALL DETAIL PRESERVED)
  private renderForegroundLayer(ctx: CanvasRenderingContext2D, offset: number, theme: EnvironmentTheme): void {
    const layerWidth = this.canvasWidth * 2;
    ctx.globalAlpha = 0.8;
    
    for (let tile = 0; tile < 2; tile++) {
      const tileX = -offset + (tile * layerWidth);
      this.renderForegroundElements(ctx, tileX, theme);
    }
    
    ctx.globalAlpha = 1;
  }
  
  private renderForegroundElements(ctx: CanvasRenderingContext2D, x: number, theme: EnvironmentTheme): void {
    const colors = this.getForegroundColors(theme);
    
    // Dense foreground details every 30 pixels (SAME AS BEFORE)
    for (let fx = 0; fx < this.canvasWidth * 2; fx += 30) {
      const elementIndex = Math.floor((x + fx) / 30); // FIXED: Deterministic
      const elementChance = (elementIndex % 10) / 10; // FIXED: Deterministic chance
      
      if (elementChance > 0.4) {
        this.renderDetailedBush(ctx, x + fx, colors, theme);
      } else if (elementChance > 0.2) {
        this.renderForegroundPost(ctx, x + fx, colors, theme);
      } else {
        this.renderSmallRocks(ctx, x + fx, colors);
      }
    }
  }
  
  private renderDetailedBush(ctx: CanvasRenderingContext2D, x: number, colors: any, theme: EnvironmentTheme): void {
    const bushIndex = Math.floor(x / 30); // FIXED: Deterministic size
    const bushSize = 12 + (bushIndex % 3) * 3;
    const bushY = this.groundY - bushSize;
    
    // Bush base (SAME AS BEFORE)
    ctx.fillStyle = colors.bushDark;
    ctx.beginPath();
    ctx.arc(x, bushY + bushSize * 0.7, bushSize * 0.8, 0, Math.PI * 2);
    ctx.fill();
    
    // Bush highlights
    ctx.fillStyle = colors.bushLight;
    for (let i = 0; i < 3; i++) {
      // FIXED: Deterministic leaf positions
      const leafSeed = (bushIndex + i) * 0.7;
      const leafX = x + Math.sin(leafSeed) * bushSize * 0.5;
      const leafY = bushY + Math.cos(leafSeed) * bushSize * 0.4;
      const leafSize = 3 + (i % 2) * 2;
      
      ctx.beginPath();
      ctx.arc(leafX, leafY, leafSize, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Theme-specific additions (SAME AS BEFORE)
    if (theme === 'forest') {
      // Berries
      ctx.fillStyle = '#DC143C';
      ctx.beginPath();
      ctx.arc(x + 3, bushY + 2, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  private renderForegroundPost(ctx: CanvasRenderingContext2D, x: number, colors: any, theme: EnvironmentTheme): void {
    // Fence post or sign (SAME AS BEFORE)
    ctx.fillStyle = colors.post;
    ctx.fillRect(x, this.groundY - 25, 4, 25);
    
    // Post details
    ctx.fillStyle = colors.postTop;
    ctx.fillRect(x - 1, this.groundY - 25, 6, 3);
    
    if (theme === 'desert') {
      // Weathered post
      ctx.fillStyle = colors.weathered;
      ctx.fillRect(x + 1, this.groundY - 20, 1, 15);
    }
  }
  
  private renderSmallRocks(ctx: CanvasRenderingContext2D, x: number, colors: any): void {
    // Cluster of small stones (SAME AS BEFORE)
    const rockIndex = Math.floor(x / 30);
    const rockCount = 2 + (rockIndex % 2); // FIXED: Deterministic count
    
    for (let r = 0; r < rockCount; r++) {
      const rockX = x + r * 4;
      const rockSize = 2 + (r % 2) * 2; // FIXED: Deterministic size
      
      ctx.fillStyle = colors.rock;
      ctx.fillRect(rockX, this.groundY - rockSize, rockSize, rockSize);
    }
  }
  
  // LAYER 5: Detailed ground textures (ALL DETAIL PRESERVED)
  private renderGroundDetailLayer(ctx: CanvasRenderingContext2D, offset: number, theme: EnvironmentTheme): void {
    const layerWidth = this.canvasWidth * 2;
    const groundColors = this.getGroundColors(theme);
    
    ctx.globalAlpha = 0.6;
    
    for (let tile = 0; tile < 2; tile++) {
      const tileX = -offset + (tile * layerWidth);
      this.renderDetailedGround(ctx, tileX, groundColors, theme);
    }
    
    ctx.globalAlpha = 1;
  }
  
  private renderDetailedGround(ctx: CanvasRenderingContext2D, x: number, colors: any, theme: EnvironmentTheme): void {
    // Rich ground texture details every 8 pixels (SAME AS BEFORE)
    for (let gx = 0; gx < this.canvasWidth * 2; gx += 8) {
      const elementIndex = Math.floor((x + gx) / 8); // FIXED: Deterministic
      const detailChance = (elementIndex % 10) / 10; // FIXED: Deterministic chance
      
      if (detailChance > 0.3) {
        this.renderGrassCluster(ctx, x + gx, colors, theme);
      } else if (detailChance > 0.1) {
        this.renderGroundTexture(ctx, x + gx, colors, theme);
      }
    }
  }
  
  private renderGrassCluster(ctx: CanvasRenderingContext2D, x: number, colors: any, theme: EnvironmentTheme): void {
    const grassIndex = Math.floor(x / 8);
    const grassCount = 2 + (grassIndex % 3); // FIXED: Deterministic count
    
    for (let g = 0; g < grassCount; g++) {
      const grassX = x + g * 2;
      const grassHeight = 4 + (g % 3) * 2; // FIXED: Deterministic height
      const grassY = this.groundY + 2;
      
      ctx.strokeStyle = colors.grass;
      ctx.lineWidth = 1;
      
      // Curved grass blade (FIXED: Deterministic curve)
      ctx.beginPath();
      ctx.moveTo(grassX, grassY + grassHeight);
      const curveSeed = (grassIndex + g) * 0.5;
      ctx.quadraticCurveTo(
        grassX + 1 + Math.sin(curveSeed),
        grassY + grassHeight * 0.5,
        grassX + Math.cos(curveSeed) * 2,
        grassY
      );
      ctx.stroke();
    }
  }
  
  private renderGroundTexture(ctx: CanvasRenderingContext2D, x: number, colors: any, theme: EnvironmentTheme): void {
    switch (theme) {
      case 'desert':
        // Sand ripples (SAME AS BEFORE)
        ctx.strokeStyle = colors.sandRipple;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, this.groundY + 5);
        ctx.lineTo(x + 6, this.groundY + 5);
        ctx.stroke();
        break;
      case 'forest':
        // Fallen leaves (SAME AS BEFORE)
        ctx.fillStyle = colors.leaf;
        const leafIndex = Math.floor(x / 8);
        const leafSize = 2 + (leafIndex % 2); // FIXED: Deterministic size
        ctx.fillRect(x, this.groundY + 3, leafSize, leafSize);
        break;
      default:
        // Small pebbles (SAME AS BEFORE)
        ctx.fillStyle = colors.pebble;
        ctx.fillRect(x, this.groundY + 4, 1, 1);
        break;
    }
  }
  
  // Color scheme methods for each theme and layer (SAME AS BEFORE)
  private getBackgroundColors(theme: EnvironmentTheme): any {
    switch (theme) {
      case 'day':
        return { far: '#A0A0A0', mid: '#8B8B8B', near: '#707070' };
      case 'sunset':
        return { silhouette: '#8B4513', sun: '#FFA500' };
      case 'night':
        return { buildings: '#2F2F2F', windows: '#FFFF99' };
      case 'desert':
        return { dunes: '#DEB887' };
      case 'forest':
        return { 
          ridges: ['#556B2F', '#6B8E23', '#8FBC8F'], 
          trees: '#2F4F2F' 
        };
      default:
        return { far: '#A0A0A0', mid: '#8B8B8B', near: '#707070' };
    }
  }
  
  private getMidgroundColors(theme: EnvironmentTheme): any {
    switch (theme) {
      case 'day':
        return {
          trunk: '#8B4513', trunkDark: '#654321',
          canopyDark: '#228B22', canopyMid: '#32CD32', canopyLight: '#90EE90',
          rock: '#696969', rockHighlight: '#A9A9A9'
        };
      case 'sunset':
        return {
          trunk: '#A0522D', trunkDark: '#8B4513',
          canopyDark: '#B8860B', canopyMid: '#DAA520', canopyLight: '#FFD700',
          rock: '#8B7D6B', rockHighlight: '#D2B48C'
        };
      case 'night':
        return {
          trunk: '#2F2F2F', trunkDark: '#1C1C1C',
          canopyDark: '#006400', canopyMid: '#228B22', canopyLight: '#32CD32',
          rock: '#2F2F2F', rockHighlight: '#404040',
          post: '#8B4513'
        };
      case 'desert':
        return {
          trunk: '#D2B48C', trunkDark: '#BC9A6A',
          canopyDark: '#9ACD32', canopyMid: '#ADFF2F', canopyLight: '#F0E68C',
          rock: '#D2B48C', rockHighlight: '#F5DEB3',
          cactus: '#228B22'
        };
      case 'forest':
        return {
          trunk: '#654321', trunkDark: '#4A4A4A',
          canopyDark: '#006400', canopyMid: '#228B22', canopyLight: '#32CD32',
          rock: '#556B2F', rockHighlight: '#6B8E23'
        };
      default:
        return {
          trunk: '#8B4513', trunkDark: '#654321',
          canopyDark: '#228B22', canopyMid: '#32CD32', canopyLight: '#90EE90',
          rock: '#696969', rockHighlight: '#A9A9A9'
        };
    }
  }
  
  private getCloudColors(theme: EnvironmentTheme): any {
    switch (theme) {
      case 'day':
        return { highlight: 'rgba(255, 255, 255, 0.8)', shadow: 'rgba(200, 200, 200, 0.6)', wispy: 'rgba(240, 240, 240, 0.7)', puff: 'rgba(255, 255, 255, 0.6)' };
      case 'sunset':
        return { highlight: 'rgba(255, 200, 150, 0.8)', shadow: 'rgba(200, 150, 100, 0.6)', wispy: 'rgba(255, 180, 120, 0.7)', puff: 'rgba(255, 200, 150, 0.6)' };
      case 'night':
        return { highlight: 'rgba(100, 100, 120, 0.4)', shadow: 'rgba(60, 60, 80, 0.3)', wispy: 'rgba(80, 80, 100, 0.4)', puff: 'rgba(100, 100, 120, 0.3)' };
      case 'desert':
        return { highlight: 'rgba(255, 240, 200, 0.6)', shadow: 'rgba(200, 180, 140, 0.4)', wispy: 'rgba(240, 220, 180, 0.5)', puff: 'rgba(255, 240, 200, 0.5)' };
      case 'forest':
        return { highlight: 'rgba(240, 255, 240, 0.7)', shadow: 'rgba(180, 200, 180, 0.5)', wispy: 'rgba(220, 240, 220, 0.6)', puff: 'rgba(240, 255, 240, 0.6)' };
      default:
        return { highlight: 'rgba(255, 255, 255, 0.8)', shadow: 'rgba(200, 200, 200, 0.6)', wispy: 'rgba(240, 240, 240, 0.7)', puff: 'rgba(255, 255, 255, 0.6)' };
    }
  }
  
  private getForegroundColors(theme: EnvironmentTheme): any {
    switch (theme) {
      case 'day':
        return { bushDark: '#228B22', bushLight: '#90EE90', post: '#8B4513', postTop: '#A0522D', rock: '#696969' };
      case 'sunset':
        return { bushDark: '#9ACD32', bushLight: '#ADFF2F', post: '#A0522D', postTop: '#D2691E', rock: '#8B7D6B' };
      case 'night':
        return { bushDark: '#006400', bushLight: '#228B22', post: '#2F2F2F', postTop: '#404040', rock: '#2F2F2F' };
      case 'desert':
        return { bushDark: '#DAA520', bushLight: '#F0E68C', post: '#D2B48C', postTop: '#DEB887', rock: '#D2B48C', weathered: '#BC9A6A' };
      case 'forest':
        return { bushDark: '#228B22', bushLight: '#32CD32', post: '#654321', postTop: '#8B4513', rock: '#556B2F' };
      default:
        return { bushDark: '#228B22', bushLight: '#90EE90', post: '#8B4513', postTop: '#A0522D', rock: '#696969' };
    }
  }
  
  private getGroundColors(theme: EnvironmentTheme): any {
    switch (theme) {
      case 'day':
        return { grass: '#32CD32', pebble: '#A9A9A9' };
      case 'sunset':
        return { grass: '#9ACD32', pebble: '#D2B48C' };
      case 'night':
        return { grass: '#006400', pebble: '#2F2F2F' };
      case 'desert':
        return { grass: '#DAA520', pebble: '#DEB887', sandRipple: 'rgba(222, 184, 135, 0.5)' };
      case 'forest':
        return { grass: '#228B22', pebble: '#556B2F', leaf: '#8B4513' };
      default:
        return { grass: '#32CD32', pebble: '#A9A9A9' };
    }
  }
}