// ===== src/games/dungeon-crawl/rendering/TileRenderer.ts =====
// All retro drawing: tiles in camera space plus the chunky code-drawn sprites
// for hero, monsters, boss and loot. No assets — everything is fillRect art.

import { CLASSES } from '../data/classes';
import { BiomePalette, PALETTE, TILE } from '../data/constants';
import { ITEMS } from '../data/items';
import { ShopItemPlan } from '../dungeon/DungeonGenerator';
import { Tile, TileMap } from '../dungeon/TileMap';
import { Enemy } from '../entities/Enemy';
import { Boss } from '../entities/Boss';
import { Chest } from '../entities/Chest';
import { Hazard } from '../entities/Hazard';
import { Pickup } from '../entities/Pickup';
import { Player } from '../entities/Player';
import { Projectile } from '../entities/Projectile';
import { Urn } from '../entities/Urn';

/** Deterministic per-tile hash for floor variation. */
function tileHash(tx: number, ty: number): number {
  let h = (tx * 374761393 + ty * 668265263) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

export class TileRenderer {
  /** Bolts + daggers (mage mana bolts glow arcane; plain daggers stay steel). */
  drawProjectiles(ctx: CanvasRenderingContext2D, projectiles: readonly Projectile[]): void {
    for (const proj of projectiles) {
      // Wave K — motion trail: two fading chips back along the flight path.
      const speed = Math.hypot(proj.vx, proj.vy) || 1;
      const dirX = proj.vx / speed;
      const dirY = proj.vy / speed;
      ctx.fillStyle =
        proj.kind === 'bolt'
          ? proj.homing > 0 ? '#c99aff' : '#78beff'
          : proj.homing > 0 ? '#9ad8ff' : PALETTE.dagger;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(Math.round(proj.x - dirX * 7) - 2, Math.round(proj.y - dirY * 7) - 2, 4, 4);
      ctx.globalAlpha = 0.15;
      ctx.fillRect(Math.round(proj.x - dirX * 13) - 1, Math.round(proj.y - dirY * 13) - 1, 3, 3);
      ctx.globalAlpha = 1;
      if (proj.kind === 'bolt') {
        ctx.fillStyle = proj.homing > 0 ? '#c99aff' : '#78beff';
        ctx.fillRect(Math.round(proj.x) - 3, Math.round(proj.y) - 3, 6, 6);
        ctx.fillStyle = '#d8ecff';
        ctx.fillRect(Math.round(proj.x) - 1, Math.round(proj.y) - 1, 2, 2);
      } else {
        ctx.fillStyle = proj.homing > 0 ? '#9ad8ff' : PALETTE.dagger;
        ctx.fillRect(Math.round(proj.x) - 2, Math.round(proj.y) - 2, 4, 4);
        if (proj.homing > 0) {
          ctx.fillStyle = '#e8f6ff';
          ctx.fillRect(Math.round(proj.x) - 1, Math.round(proj.y) - 1, 2, 2);
        }
      }
    }
  }

  /** Draw the visible tile window. ctx is already camera-translated. */
  renderTiles(
    ctx: CanvasRenderingContext2D,
    map: TileMap,
    camX: number,
    camY: number,
    viewW: number,
    viewH: number,
    time: number,
    stairsLocked: boolean,
    biome: BiomePalette,
  ): void {
    const x0 = Math.max(0, Math.floor(camX / TILE));
    const y0 = Math.max(0, Math.floor(camY / TILE));
    const x1 = Math.min(map.cols - 1, Math.floor((camX + viewW) / TILE) + 1);
    const y1 = Math.min(map.rows - 1, Math.floor((camY + viewH) / TILE) + 1);

    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const tile = map.get(tx, ty);
        if (tile === Tile.Void) continue;
        const px = tx * TILE;
        const py = ty * TILE;
        switch (tile) {
          case Tile.Floor: {
            const h = tileHash(tx, ty);
            ctx.fillStyle = h < 0.5 ? biome.floorA : biome.floorB;
            ctx.fillRect(px, py, TILE, TILE);
            // Sparse cracks / rubble give the stone texture.
            if (h > 0.93) {
              ctx.fillStyle = biome.floorCrack;
              ctx.fillRect(px + 6 + Math.floor(h * 12), py + 10, 10, 2);
              ctx.fillRect(px + 10 + Math.floor(h * 8), py + 12, 2, 6);
            } else if (h < 0.04) {
              ctx.fillStyle = biome.floorCrack;
              ctx.fillRect(px + 12, py + 18, 4, 4);
            }
            break;
          }
          case Tile.Wall:
          case Tile.TorchWall: {
            ctx.fillStyle = biome.wallFace;
            ctx.fillRect(px, py, TILE, TILE);
            ctx.fillStyle = biome.wallTop;
            ctx.fillRect(px, py, TILE, 10);
            // Brick seams.
            ctx.fillStyle = biome.wallEdge;
            ctx.fillRect(px, py + 10, TILE, 2);
            ctx.fillRect(px, py + 22, TILE, 2);
            const offset = ty % 2 === 0 ? 8 : 20;
            ctx.fillRect(px + offset, py + 12, 2, 10);
            ctx.fillRect(px + ((offset + 14) % TILE), py + 24, 2, 8);
            if (tile === Tile.TorchWall) this.drawTorch(ctx, px, py, time, tx, ty, biome);
            break;
          }
          case Tile.CrackedWall: {
            // v4 Wave C — reads as a wall, but hairline fractures betray the
            // hollow behind it (a player-sourced blast breaks it open).
            ctx.fillStyle = biome.wallFace;
            ctx.fillRect(px, py, TILE, TILE);
            ctx.fillStyle = biome.wallTop;
            ctx.fillRect(px, py, TILE, 10);
            ctx.fillStyle = biome.wallEdge;
            ctx.fillRect(px, py + 10, TILE, 2);
            ctx.fillRect(px, py + 22, TILE, 2);
            // Hairline cracks branching from mid-face.
            ctx.fillStyle = biome.floorCrack;
            ctx.fillRect(px + 14, py + 6, 2, 10);
            ctx.fillRect(px + 10, py + 14, 6, 2);
            ctx.fillRect(px + 16, py + 16, 2, 8);
            ctx.fillRect(px + 18, py + 22, 6, 2);
            ctx.fillRect(px + 8, py + 24, 2, 6);
            break;
          }
          case Tile.Door: {
            ctx.fillStyle = biome.floorA;
            ctx.fillRect(px, py, TILE, TILE);
            ctx.fillStyle = PALETTE.doorWood;
            ctx.fillRect(px + 2, py, 4, TILE);
            ctx.fillRect(px + TILE - 6, py, 4, TILE);
            break;
          }
          case Tile.LockedDoor: {
            ctx.fillStyle = biome.wallFace;
            ctx.fillRect(px, py, TILE, TILE);
            ctx.fillStyle = PALETTE.doorWood;
            ctx.fillRect(px + 3, py + 2, TILE - 6, TILE - 4);
            ctx.fillStyle = PALETTE.wallEdge;
            ctx.fillRect(px + 3, py + 14, TILE - 6, 2);
            // Golden padlock.
            ctx.fillStyle = PALETTE.doorLocked;
            ctx.fillRect(px + 12, py + 16, 8, 8);
            ctx.fillStyle = PALETTE.keyGold;
            ctx.fillRect(px + 14, py + 18, 4, 4);
            break;
          }
          case Tile.Stairs: {
            ctx.fillStyle = biome.floorCrack;
            ctx.fillRect(px, py, TILE, TILE);
            // Descending steps.
            for (let step = 0; step < 4; step++) {
              const inset = step * 4;
              const shade = stairsLocked ? 40 - step * 8 : 70 - step * 12;
              ctx.fillStyle = `rgb(${shade + 90}, ${shade + 50}, ${shade + 10})`;
              ctx.fillRect(px + inset, py + inset, TILE - inset * 2, 4);
            }
            if (!stairsLocked) {
              const pulse = 0.5 + 0.5 * Math.sin(time * 4);
              ctx.fillStyle = `rgba(255, 184, 77, ${0.25 + 0.3 * pulse})`;
              ctx.fillRect(px + 8, py + 8, TILE - 16, TILE - 16);
              // Wave K — motes rise from the open stairwell, beckoning down.
              for (let m = 0; m < 3; m++) {
                const t = (time * 0.6 + m * 0.37) % 1;
                const mx = px + 6 + ((m * 11 + 3) % (TILE - 12));
                ctx.fillStyle = `rgba(255, 208, 120, ${(1 - t) * 0.65})`;
                ctx.fillRect(mx, Math.round(py + TILE - 6 - t * (TILE - 10)), 2, 2);
              }
            }
            break;
          }
        }
      }
    }
  }

  private drawTorch(
    ctx: CanvasRenderingContext2D,
    px: number,
    py: number,
    time: number,
    tx: number,
    ty: number,
    biome: BiomePalette,
  ): void {
    // Sconce.
    ctx.fillStyle = '#241a10';
    ctx.fillRect(px + 13, py + 16, 6, 10);
    // Animated flame — two stacked blocks that jitter deterministically.
    const flick = Math.sin(time * 11 + tx * 3.1 + ty * 1.7);
    ctx.fillStyle = biome.flameOuter;
    ctx.fillRect(px + 12, py + 8 + (flick > 0.3 ? 1 : 0), 8, 8);
    ctx.fillStyle = biome.flameInner;
    ctx.fillRect(px + 14, py + 10 + (flick > -0.2 ? 1 : 0), 4, 5);
  }

  // ------------------------------------------------------------- sprites

  drawPlayer(ctx: CanvasRenderingContext2D, player: Player, time: number): void {
    const { x, y } = player;
    // I-frame flicker: skip alternating frames.
    if (player.invuln > 0 && Math.floor(time * 16) % 2 === 0) return;

    const bob = player.moving ? Math.round(Math.sin(time * 12)) : 0;
    const swingProgress = player.swingAnim > 0 ? 1 - player.swingAnim / 0.22 : 0;
    // Wave K — the strike leans into the swing (a short forward lunge).
    const lunge = player.swingAnim > 0 ? Math.sin(Math.min(1, swingProgress) * Math.PI) * 3 : 0;
    const px = Math.round(x + player.faceX * lunge);
    const py = Math.round(y + player.faceY * lunge) + bob;

    // v3 — class recolor + silhouette; thief fades while hidden.
    const cls = player.classId ? CLASSES[player.classId] : null;
    const tunic = cls?.tunic ?? '#7a3b1e';
    const trim = cls?.trim ?? '#5c2c14';

    // Wave K — dash afterimages trail the sprint (derived from dash state).
    if (player.dashTimer > 0) {
      ctx.fillStyle = tunic;
      for (let g = 1; g <= 2; g++) {
        ctx.globalAlpha = g === 1 ? 0.3 : 0.14;
        ctx.fillRect(
          px - Math.round(player.dashDirX * 9 * g) - 8,
          py - Math.round(player.dashDirY * 9 * g) - 6,
          16,
          14,
        );
      }
      ctx.globalAlpha = 1;
    }

    // Sword slash arc (visual tail) + Wave K bright inner edge.
    if (player.swingAnim > 0) {
      const angle = Math.atan2(player.faceY, player.faceX);
      const sweep = (player.meleeArcDeg() * Math.PI) / 180;
      const from = angle - sweep / 2 + sweep * swingProgress * 0.4;
      const to = angle + sweep / 2 - sweep * (1 - swingProgress) * 0.1;
      ctx.strokeStyle = `rgba(255, 232, 200, ${0.9 - swingProgress * 0.8})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(px, py, player.meleeRange() - 6, from, to);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255, 255, 244, ${0.55 - swingProgress * 0.5})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, player.meleeRange() - 11, from, to);
      ctx.stroke();
      ctx.lineWidth = 1;
    }
    ctx.save();
    if (player.hiddenTimer > 0) ctx.globalAlpha = 0.4;

    // Cloak.
    ctx.fillStyle = player.hitFlash > 0 ? '#ff8f8f' : tunic;
    ctx.fillRect(px - 8, py - 6, 16, 14);
    // Head + hood.
    ctx.fillStyle = '#e8b98a';
    ctx.fillRect(px - 5, py - 13, 10, 8);
    ctx.fillStyle = trim;
    ctx.fillRect(px - 7, py - 15, 14, 4);
    if (cls?.id === 'thief') {
      // Low hood pulled over the brow.
      ctx.fillRect(px - 6, py - 12, 12, 2);
    } else if (cls?.id === 'mage') {
      // Pointed hat.
      ctx.fillRect(px - 4, py - 18, 8, 3);
      ctx.fillRect(px - 2, py - 21, 4, 3);
    }
    // Eyes track facing.
    ctx.fillStyle = '#1a0e06';
    const eyeShift = Math.round(player.faceX * 2);
    ctx.fillRect(px - 3 + eyeShift, py - 10, 2, 2);
    ctx.fillRect(px + 2 + eyeShift, py - 10, 2, 2);
    // Belt + boots.
    ctx.fillStyle = '#3d1d0c';
    ctx.fillRect(px - 8, py + 2, 16, 3);
    ctx.fillRect(px - 6, py + 8, 4, 4);
    ctx.fillRect(px + 2, py + 8, 4, 4);
    if (cls?.id === 'cleric') {
      // Chest sigil.
      ctx.fillStyle = trim;
      ctx.fillRect(px - 1, py - 5, 2, 8);
      ctx.fillRect(px - 3, py - 3, 6, 2);
    }
    // Idle weapon held at the side.
    if (player.swingAnim <= 0) {
      if (cls?.id === 'cleric') {
        // Mace: haft + heavy head.
        ctx.fillStyle = '#8a6a1e';
        ctx.fillRect(px + 7, py - 4, 3, 10);
        ctx.fillStyle = PALETTE.dagger;
        ctx.fillRect(px + 6, py - 9, 5, 5);
      } else if (cls?.id === 'mage') {
        // Staff with an arcane focus.
        ctx.fillStyle = '#6b4a2a';
        ctx.fillRect(px + 7, py - 8, 2, 16);
        ctx.fillStyle = cls.color;
        ctx.fillRect(px + 6, py - 11, 4, 4);
      } else {
        // Sword (the fighter's runs a touch broader).
        ctx.fillStyle = PALETTE.dagger;
        ctx.fillRect(px + 7, py - 8, cls?.id === 'fighter' ? 4 : 3, 12);
        ctx.fillStyle = '#8a6a1e';
        ctx.fillRect(px + 6, py + 3, 5, 3);
      }
    }
    ctx.restore();
  }

  drawEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy, time: number): void {
    const px = Math.round(enemy.x);
    const py = Math.round(enemy.y);
    const half = Math.round(enemy.radius);
    const body = enemy.flash > 0 ? '#ffffff' : enemy.config.color;
    const accent = enemy.config.accent;

    // v2 — elite aura: pulsing ground ring beneath the sprite.
    if (enemy.elite && !enemy.dormant) {
      const pulse = 0.55 + 0.45 * Math.sin(time * 6 + enemy.id);
      ctx.strokeStyle = enemy.elite.aura;
      ctx.globalAlpha = 0.35 + 0.35 * pulse;
      ctx.lineWidth = 2;
      ctx.strokeRect(px - half - 4, py - half - 4, half * 2 + 8, half * 2 + 8);
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1;
    }

    // v3 — Turn Undead stun: blinking halo over the frozen monster.
    if (enemy.stunned > 0 && Math.floor(time * 8) % 2 === 0) {
      ctx.strokeStyle = 'rgba(255, 224, 138, 0.9)';
      ctx.beginPath();
      ctx.arc(px, py - half - 7, 5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Wave K — hit squash: the blow visibly compresses the body (derived from
    // the same 0.15s flash timer that whitens it).
    const squash = enemy.flash > 0 ? enemy.flash / 0.15 : 0;
    if (squash > 0) {
      ctx.save();
      ctx.translate(px, py);
      ctx.scale(1 + 0.22 * squash, 1 - 0.18 * squash);
      ctx.translate(-px, -py);
    }

    switch (enemy.config.behavior) {
      case 'wander': // blobs amble; walkers chase
      case 'chase': {
        const id = enemy.config.id;
        if (id === 'slime' || id === 'slime-mini' || id === 'deep-ooze' || id === 'ooze-mini') {
          // Blob — slimes and deep oozes share the squish; palette tells them apart.
          const squish = Math.sin(time * 6 + enemy.id) * 2;
          ctx.fillStyle = body;
          ctx.fillRect(px - half, py - half + 3 + squish / 2, half * 2, half * 2 - 3 - squish);
          ctx.fillRect(px - half + 3, py - half + squish, half * 2 - 6, 4);
          ctx.fillStyle = accent;
          ctx.fillRect(px - 4, py - 2, 3, 3);
          ctx.fillRect(px + 2, py - 2, 3, 3);
        } else if (id === 'fire-beetle') {
          // v3 — fire beetle: domed carapace, mandibles, pulsing glow glands.
          const scuttle = Math.sin(time * 14 + enemy.id) > 0 ? 1 : 0;
          ctx.fillStyle = body;
          ctx.fillRect(px - half + 2, py - half + 4, half * 2 - 4, half * 2 - 6);
          ctx.fillRect(px - 3, py - half + 1, 6, 4); // head
          ctx.fillStyle = '#5c2014';
          ctx.fillRect(px - 5 - scuttle, py - half + 1, 3, 3); // mandibles
          ctx.fillRect(px + 3 + scuttle, py - half + 1, 3, 3);
          const glow = Math.floor(time * 6) % 2 === 0;
          ctx.fillStyle = glow ? accent : '#ff7a1a';
          ctx.fillRect(px - 4, py - 1, 3, 3); // the glands that light the warrens
          ctx.fillRect(px + 2, py - 1, 3, 3);
          ctx.fillRect(px - 1, py + half - 5, 3, 3);
        } else if (id === 'zombie') {
          // v3 — zombie: lurching shambler, arms out, one dead eye.
          const lurch = Math.round(Math.sin(time * 3 + enemy.id) * 2);
          ctx.fillStyle = body;
          ctx.fillRect(px - 6 + lurch, py - 4, 12, half * 2 - 6);
          ctx.fillRect(px - 4 + lurch, py - half, 9, 8); // head askew
          ctx.fillRect(px - 10 + lurch, py - 2, 5, 3); // reaching arms
          ctx.fillRect(px + 5 + lurch, py - 3, 5, 3);
          ctx.fillStyle = accent; // rotted rags
          ctx.fillRect(px - 6 + lurch, py + 2, 12, 3);
          ctx.fillStyle = '#e8f6d8';
          ctx.fillRect(px - 2 + lurch, py - half + 3, 2, 2);
        } else if (id === 'ghoul') {
          // v3 — ghoul: hunched low, long claws, pale hungry eyes.
          const crouch = Math.round(Math.abs(Math.sin(time * 10 + enemy.id)) * 2);
          ctx.fillStyle = body;
          ctx.fillRect(px - 6, py - half + 6 + crouch, 12, half * 2 - 8 - crouch);
          ctx.fillRect(px - 4, py - half + crouch, 8, 8); // low-slung head
          ctx.fillRect(px - 9, py + 2, 3, 2); // claws
          ctx.fillRect(px + 6, py + 2, 3, 2);
          ctx.fillStyle = accent;
          ctx.fillRect(px - 3, py - half + 2 + crouch, 2, 2);
          ctx.fillRect(px + 1, py - half + 2 + crouch, 2, 2);
        } else if (id === 'lizardman') {
          // v3 — lizardman: scaled marsh warrior with a spear.
          ctx.fillStyle = body;
          ctx.fillRect(px - 6, py - 4, 12, half * 2 - 6);
          ctx.fillRect(px - 4, py - half, 8, 7); // head
          ctx.fillRect(px + 2, py - half + 1, 5, 3); // snout
          ctx.fillStyle = '#2b5c34';
          ctx.fillRect(px - 6, py, 12, 2); // scale banding
          ctx.fillStyle = '#6b4a2a';
          ctx.fillRect(px + 7, py - half - 2, 2, half * 2 + 2); // spear haft
          ctx.fillStyle = accent;
          ctx.fillRect(px + 6, py - half - 5, 4, 4); // spearhead
          ctx.fillRect(px - 2, py - half + 2, 2, 2); // eye
        } else if (id === 'cinder-hound') {
          // v3 — cinder hound: low quadruped at a run, ember eye.
          const gait = Math.sin(time * 16 + enemy.id) > 0 ? 1 : -1;
          ctx.fillStyle = body;
          ctx.fillRect(px - half + 1, py - 3, half * 2 - 2, 7); // body
          ctx.fillRect(px + half - 7, py - 8, 7, 7); // head forward
          ctx.fillRect(px - half + 1, py - 7, 4, 4); // tail up
          ctx.fillRect(px - half + 2, py + 4, 3, 4 + gait); // legs
          ctx.fillRect(px + half - 5, py + 4, 3, 4 - gait);
          ctx.fillStyle = accent;
          ctx.fillRect(px + half - 4, py - 6, 2, 2);
        } else {
          // Skeleton: rib-cage stack + skull.
          ctx.fillStyle = body;
          ctx.fillRect(px - 5, py - half, 10, 8); // skull
          ctx.fillRect(px - 7, py - half + 9, 14, 3);
          ctx.fillRect(px - 6, py - half + 13, 12, 3);
          ctx.fillRect(px - 5, py - half + 17, 10, 3);
          ctx.fillStyle = accent;
          ctx.fillRect(px - 4, py - half + 2, 3, 3);
          ctx.fillRect(px + 1, py - half + 2, 3, 3);
        }
        break;
      }
      case 'flit': {
        // Bat — flapping wings.
        const flap = Math.sin(time * 18 + enemy.id) > 0 ? 3 : -1;
        ctx.fillStyle = body;
        ctx.fillRect(px - 4, py - 4, 8, 8);
        ctx.fillRect(px - 10, py - flap, 6, 4);
        ctx.fillRect(px + 4, py - flap, 6, 4);
        ctx.fillStyle = accent;
        ctx.fillRect(px - 3, py - 2, 2, 2);
        ctx.fillRect(px + 1, py - 2, 2, 2);
        break;
      }
      case 'ranged': {
        // Sorcerer — robe + hood; glows during windup.
        ctx.fillStyle = body;
        ctx.fillRect(px - 7, py - 4, 14, half * 2 - 6);
        ctx.fillRect(px - 5, py - half, 10, 8);
        ctx.fillStyle = accent;
        ctx.fillRect(px - 3, py - half + 3, 2, 2);
        ctx.fillRect(px + 2, py - half + 3, 2, 2);
        if (enemy.windup > 0) {
          const glow = 0.5 + 0.5 * Math.sin(time * 30);
          ctx.fillStyle = `rgba(120, 190, 255, ${0.4 + glow * 0.5})`;
          ctx.fillRect(px - 10, py - half - 6, 20, 4);
        }
        break;
      }
      case 'bomber': {
        // Goblin bomber — squat body, satchel, raises a fizzing bomb to throw.
        ctx.fillStyle = body;
        ctx.fillRect(px - 7, py - 3, 14, half * 2 - 8);
        ctx.fillRect(px - 6, py - half + 2, 12, 9); // head
        ctx.fillStyle = accent;
        ctx.fillRect(px - 4, py - half + 5, 3, 2); // eyes
        ctx.fillRect(px + 1, py - half + 5, 3, 2);
        ctx.fillStyle = '#4d3a20'; // satchel
        ctx.fillRect(px - 8, py + 4, 6, 6);
        if (enemy.windup > 0) {
          // Bomb overhead with a sparking fuse.
          ctx.fillStyle = '#22242b';
          ctx.fillRect(px + 2, py - half - 9, 8, 8);
          const spark = Math.floor(time * 20) % 2 === 0;
          ctx.fillStyle = spark ? '#ffd24a' : '#ff7a1a';
          ctx.fillRect(px + 8, py - half - 12, 3, 3);
        }
        break;
      }
      case 'wraith': {
        // Wraith — translucent shroud drifting with a sine hover.
        const hover = Math.sin(time * 3 + enemy.id) * 3;
        const wy = py + Math.round(hover);
        ctx.globalAlpha = 0.55 + 0.15 * Math.sin(time * 5 + enemy.id);
        ctx.fillStyle = body;
        ctx.fillRect(px - 7, wy - half, 14, half * 2 - 4);
        // Tattered hem.
        ctx.fillRect(px - 7, wy + half - 4, 4, 4);
        ctx.fillRect(px - 1, wy + half - 4, 4, 4);
        ctx.fillRect(px + 5, wy + half - 4, 2, 4);
        ctx.fillStyle = accent;
        ctx.fillRect(px - 4, wy - half + 4, 3, 3);
        ctx.fillRect(px + 2, wy - half + 4, 3, 3);
        ctx.globalAlpha = 1;
        break;
      }
      case 'armored': {
        // Knight — plate body, crest, and a shield on the facing side.
        ctx.fillStyle = body;
        ctx.fillRect(px - half + 2, py - half + 2, half * 2 - 4, half * 2 - 4);
        ctx.fillStyle = '#5f6673';
        ctx.fillRect(px - half + 2, py - half + 2, half * 2 - 4, 5);
        ctx.fillStyle = accent;
        ctx.fillRect(px - 2, py - half - 3, 4, 5); // crest
        ctx.fillStyle = '#2b2f38';
        ctx.fillRect(px - 4, py - 3, 3, 3);
        ctx.fillRect(px + 2, py - 3, 3, 3);
        // Shield square offset toward facing.
        const sx = px + Math.round(enemy.facingX * (half - 1));
        const sy = py + Math.round(enemy.facingY * (half - 1));
        ctx.fillStyle = '#c9cfd8';
        ctx.fillRect(sx - 4, sy - 6, 8, 12);
        break;
      }
      case 'mimic': {
        if (enemy.dormant) {
          // Innocent chest.
          ctx.fillStyle = body;
          ctx.fillRect(px - half, py - half + 4, half * 2, half * 2 - 6);
          ctx.fillStyle = '#6b4520';
          ctx.fillRect(px - half, py - half, half * 2, 7);
          ctx.fillStyle = PALETTE.gold;
          ctx.fillRect(px - 2, py - 1, 5, 6);
        } else {
          // The truth: open maw and teeth, hopping.
          const hop = Math.abs(Math.sin(time * 9 + enemy.id)) * 4;
          const by = py - Math.round(hop);
          ctx.fillStyle = body;
          ctx.fillRect(px - half, by - half, half * 2, half); // upper jaw
          ctx.fillRect(px - half, by + 3, half * 2, half - 3); // lower jaw
          ctx.fillStyle = '#3a1408';
          ctx.fillRect(px - half + 2, by - 2, half * 2 - 4, 6); // maw
          ctx.fillStyle = '#fff2d0';
          for (let t = 0; t < 4; t++) {
            ctx.fillRect(px - half + 3 + t * 6, by - 2, 3, 3);
          }
          ctx.fillStyle = PALETTE.gold;
          ctx.fillRect(px - 4, by - half + 2, 3, 3);
          ctx.fillRect(px + 2, by - half + 2, 3, 3);
        }
        break;
      }
    }

    if (squash > 0) ctx.restore(); // Wave K — undo the hit squash
  }

  drawBoss(ctx: CanvasRenderingContext2D, boss: Boss, time: number): void {
    const px = Math.round(boss.x);
    const py = Math.round(boss.y);
    const half = Math.round(boss.radius);
    const flash = boss.flash > 0;
    const telegraph = boss.phase === 'telegraph';
    const kit = boss.kit;

    // Teleport fade-in (Hollow King) — sprite ghosts back into existence.
    if (boss.fading > 0) ctx.globalAlpha = Math.max(0.15, 1 - boss.fading);

    // Wave K — the enrage flare: a blood ring erupts as the threshold breaks.
    if (boss.enrageFlash > 0) {
      const f = boss.enrageFlash; // 1 -> 0 over the flare second
      ctx.strokeStyle = `rgba(214, 61, 61, ${0.75 * f})`;
      ctx.lineWidth = 2 + 3 * f;
      ctx.beginPath();
      ctx.arc(px, py, half + 10 + (1 - f) * 34, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
    }

    // Telegraph ring — the dodge cue.
    if (telegraph) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 20);
      ctx.strokeStyle = kit.crackColor;
      ctx.globalAlpha = 0.35 + 0.5 * pulse;
      ctx.lineWidth = 3;
      ctx.strokeRect(px - half - 6, py - half - 6, half * 2 + 12, half * 2 + 12);
      ctx.globalAlpha = boss.fading > 0 ? Math.max(0.15, 1 - boss.fading) : 1;
      ctx.lineWidth = 1;
    }

    // Massive armored bulk.
    ctx.fillStyle = flash ? '#ffffff' : boss.enraged ? kit.enragedColor : kit.bodyColor;
    ctx.fillRect(px - half, py - half + 6, half * 2, half * 2 - 6);
    // Elemental cracks (molten / bone / void by kit).
    ctx.fillStyle = flash ? '#ffd9b0' : kit.crackColor;
    ctx.fillRect(px - half + 6, py - 2, half * 2 - 12, 3);
    ctx.fillRect(px - 4, py - half + 12, 3, half + 4);
    ctx.fillRect(px + half - 12, py + 6, 6, 3);
    // Horned helm.
    ctx.fillStyle = flash ? '#ffffff' : kit.helmColor;
    ctx.fillRect(px - half + 4, py - half, half * 2 - 8, 12);
    ctx.fillRect(px - half - 4, py - half - 6, 8, 12);
    ctx.fillRect(px + half - 4, py - half - 6, 8, 12);
    // Burning eyes.
    const glow = 0.6 + 0.4 * Math.sin(time * 8);
    ctx.save();
    ctx.globalAlpha *= glow;
    ctx.fillStyle = kit.eyeColor;
    ctx.fillRect(px - 8, py - half + 4, 5, 4);
    ctx.fillRect(px + 3, py - half + 4, 5, 4);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------- v2 sprites

  drawMerchant(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    time: number,
    robe = '#3d2f52', // v4 — town vendors reuse the sprite with their own colors
    hood = '#241a38',
  ): void {
    const px = Math.round(x);
    const py = Math.round(y);
    const bob = Math.round(Math.sin(time * 2) * 1.5);
    // Robe.
    ctx.fillStyle = robe;
    ctx.fillRect(px - 9, py - 6 + bob, 18, 18);
    // Deep hood — no face, just eyes.
    ctx.fillStyle = hood;
    ctx.fillRect(px - 7, py - 15 + bob, 14, 10);
    ctx.fillStyle = '#ffd24a';
    ctx.fillRect(px - 4, py - 11 + bob, 3, 2);
    ctx.fillRect(px + 2, py - 11 + bob, 3, 2);
    // Lantern held out.
    ctx.fillStyle = '#8a6a1e';
    ctx.fillRect(px + 9, py - 4 + bob, 2, 8);
    const flicker = 0.6 + 0.4 * Math.sin(time * 9);
    ctx.fillStyle = `rgba(255, 210, 74, ${flicker})`;
    ctx.fillRect(px + 7, py + 4 + bob, 6, 6);
  }

  /** v4 — Lastlight's quest board: post, plank, pinned parchments. */
  drawQuestBoard(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
    const px = Math.round(x);
    const py = Math.round(y);
    // Posts.
    ctx.fillStyle = '#54401f';
    ctx.fillRect(px - 12, py - 8, 3, 18);
    ctx.fillRect(px + 9, py - 8, 3, 18);
    // Plank.
    ctx.fillStyle = '#6b4a2a';
    ctx.fillRect(px - 14, py - 18, 28, 14);
    ctx.fillStyle = '#54401f';
    ctx.fillRect(px - 14, py - 18, 28, 2);
    // Pinned notices (one flutters).
    const flutter = Math.floor(time * 3) % 2 === 0 ? 0 : 1;
    ctx.fillStyle = '#e8dcbc';
    ctx.fillRect(px - 11, py - 15, 6, 8);
    ctx.fillRect(px - 3, py - 15, 6, 8 + flutter);
    ctx.fillRect(px + 5, py - 15, 6, 7);
    ctx.fillStyle = '#c22f2f';
    ctx.fillRect(px - 10, py - 15, 2, 2); // wax pins
    ctx.fillRect(px - 2, py - 15, 2, 2);
    ctx.fillRect(px + 6, py - 15, 2, 2);
  }

  drawShopItem(ctx: CanvasRenderingContext2D, item: ShopItemPlan, sold: boolean, time: number): void {
    const px = Math.round(item.x);
    const py = Math.round(item.y);
    // Pedestal.
    ctx.fillStyle = '#4d4238';
    ctx.fillRect(px - 8, py + 2, 16, 7);
    ctx.fillRect(px - 5, py - 2, 10, 5);
    if (sold) return;
    // Product hovers above the pedestal.
    const bob = Math.round(Math.sin(time * 4 + px) * 2);
    const iy = py - 12 + bob;
    switch (item.product) {
      case 'heart':
        ctx.fillStyle = PALETTE.heart;
        ctx.fillRect(px - 6, iy - 3, 5, 5);
        ctx.fillRect(px + 1, iy - 3, 5, 5);
        ctx.fillRect(px - 4, iy, 8, 5);
        ctx.fillRect(px - 2, iy + 5, 4, 3);
        break;
      case 'daggers':
        ctx.fillStyle = PALETTE.dagger;
        ctx.fillRect(px - 4, iy - 6, 3, 10);
        ctx.fillRect(px + 2, iy - 4, 3, 10);
        ctx.fillStyle = '#8a6a1e';
        ctx.fillRect(px - 6, iy + 3, 7, 2);
        ctx.fillRect(px, iy + 5, 7, 2);
        break;
      case 'potion':
        ctx.fillStyle = PALETTE.potion;
        ctx.fillRect(px - 4, iy - 2, 8, 8);
        ctx.fillStyle = '#cfe9f2';
        ctx.fillRect(px - 2, iy - 7, 4, 5);
        break;
      case 'relic': {
        const pulse = 0.5 + 0.5 * Math.sin(time * 5);
        ctx.fillStyle = `rgba(200, 120, 255, ${0.6 + 0.4 * pulse})`;
        ctx.fillRect(px - 4, iy - 4, 8, 8);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(px - 2, iy - 2, 2, 2);
        break;
      }
      case 'scroll': {
        // v3 — rolled parchment, ribbon-tied; contents unknown.
        ctx.fillStyle = '#e8dcbc';
        ctx.fillRect(px - 6, iy - 3, 12, 7);
        ctx.fillStyle = '#cfc09a';
        ctx.fillRect(px - 6, iy - 3, 12, 2);
        ctx.fillStyle = '#c22f2f';
        ctx.fillRect(px - 1, iy - 4, 2, 9);
        break;
      }
    }
    // Price tag under the pedestal.
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${item.price}g`, px, py + 20);
  }

  drawUrn(ctx: CanvasRenderingContext2D, urn: Urn): void {
    const px = Math.round(urn.x);
    const py = Math.round(urn.y);
    const clay = urn.variant === 2 ? '#7a5638' : '#8a6244';
    ctx.fillStyle = clay;
    if (urn.variant === 1) {
      // Squat pot.
      ctx.fillRect(px - 8, py - 4, 16, 12);
      ctx.fillRect(px - 5, py - 8, 10, 5);
    } else {
      // Tall urn.
      ctx.fillRect(px - 6, py - 8, 12, 17);
      ctx.fillRect(px - 8, py - 2, 16, 6);
    }
    ctx.fillStyle = '#54401f';
    ctx.fillRect(px - 6, py - 1, 12, 2); // band
    ctx.fillStyle = '#2b2118';
    ctx.fillRect(px - 4, py - 10, 8, 3); // mouth
  }

  /**
   * Wave M — locked strongboxes. A closed box deliberately echoes the mimic's
   * innocent disguise (approaching ANY chest should stay tense); the padlock
   * and keyhole are the honest tell once the torchlight reaches it.
   */
  drawChest(ctx: CanvasRenderingContext2D, chest: Chest, time: number): void {
    const jig = chest.jiggle > 0 ? Math.round(Math.sin(time * 40) * 2) : 0;
    const px = Math.round(chest.x) + jig;
    const py = Math.round(chest.y);
    if (chest.opened) {
      // Lid thrown back, dark and emptied.
      ctx.fillStyle = '#6b4520';
      ctx.fillRect(px - 11, py - 13, 22, 5);
      ctx.fillStyle = '#5c3d1e';
      ctx.fillRect(px - 11, py - 6, 22, 13);
      ctx.fillStyle = '#241407';
      ctx.fillRect(px - 9, py - 4, 18, 9);
      return;
    }
    ctx.fillStyle = '#7c5226';
    ctx.fillRect(px - 11, py - 7, 22, 16);
    ctx.fillStyle = '#6b4520';
    ctx.fillRect(px - 11, py - 11, 22, 7); // lid
    ctx.fillStyle = '#54401f';
    ctx.fillRect(px - 11, py - 1, 22, 2); // band
    // The padlock.
    ctx.fillStyle = PALETTE.gold;
    ctx.fillRect(px - 3, py - 3, 7, 8);
    ctx.fillStyle = '#241407';
    ctx.fillRect(px - 1, py - 1, 3, 3); // keyhole
    // A passing glint so the box catches the eye (Wave K idiom).
    if (Math.floor(time * 2.5 + (px % 7)) % 5 === 0) {
      ctx.fillStyle = '#fff6d8';
      ctx.fillRect(px - 9, py - 10, 2, 2);
    }
  }

  drawHazard(ctx: CanvasRenderingContext2D, hazard: Hazard, time: number): void {
    const px = Math.round(hazard.x);
    const py = Math.round(hazard.y);

    // Base plate marks the trap even when dormant — fair, learnable.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.30)';
    ctx.fillRect(px - 12, py - 12, 24, 24);

    // Wave M — a disarmed trap: the plate stays, the pulled works lie dead.
    if (hazard.disarmed) {
      ctx.fillStyle = '#77808c';
      ctx.fillRect(px - 8, py + 2, 6, 2);
      ctx.fillRect(px + 2, py + 4, 7, 2);
      return;
    }

    if (hazard.style === 'spikes') {
      if (hazard.phase === 'down') return;
      const h = hazard.phase === 'telegraph' ? 3 : 9;
      ctx.fillStyle = hazard.phase === 'up' ? '#cfd6e0' : '#77808c';
      for (let i = 0; i < 3; i++) {
        const sx = px - 9 + i * 8;
        ctx.fillRect(sx, py + 6 - h, 3, h);
        ctx.fillRect(sx + 1, py + 4 - h, 1, 2);
      }
    } else {
      // Ember vent: grate always visible; flame column during 'up'.
      ctx.fillStyle = '#3a3026';
      ctx.fillRect(px - 9, py - 3, 18, 6);
      ctx.fillStyle = '#15100c';
      ctx.fillRect(px - 7, py - 1, 3, 2);
      ctx.fillRect(px - 1, py - 1, 3, 2);
      ctx.fillRect(px + 5, py - 1, 3, 2);
      if (hazard.phase === 'telegraph') {
        const hiss = Math.floor(time * 16) % 2 === 0;
        if (hiss) {
          ctx.fillStyle = 'rgba(255, 122, 26, 0.5)';
          ctx.fillRect(px - 4, py - 8, 8, 5);
        }
      } else if (hazard.phase === 'up') {
        const flick = Math.sin(time * 22 + px) > 0 ? 1 : 0;
        ctx.fillStyle = PALETTE.ember;
        ctx.fillRect(px - 6, py - 16 - flick * 2, 12, 16);
        ctx.fillStyle = PALETTE.emberBright;
        ctx.fillRect(px - 3, py - 12 - flick * 2, 6, 10);
      }
    }
  }

  drawPickup(ctx: CanvasRenderingContext2D, pickup: Pickup, time: number): void {
    const bob = Math.round(Math.sin(pickup.bobPhase) * 2);
    const px = Math.round(pickup.x);
    const py = Math.round(pickup.y) + bob;

    switch (pickup.kind) {
      case 'gold': {
        ctx.fillStyle = PALETTE.gold;
        ctx.fillRect(px - 4, py - 4, 8, 8);
        ctx.fillStyle = '#b8860b';
        ctx.fillRect(px - 1, py - 3, 2, 6);
        // Wave K — a passing glint catches the torchlight.
        if (Math.floor(time * 3 + pickup.bobPhase) % 4 === 0) {
          ctx.fillStyle = '#fff6d8';
          ctx.fillRect(px - 3, py - 3, 2, 2);
        }
        break;
      }
      case 'heart': {
        // Wave K — a soft beat: the heart glows on its pulse.
        if (Math.sin(time * 4 + pickup.bobPhase) > 0.55) {
          ctx.globalAlpha = 0.25;
          ctx.fillStyle = PALETTE.heart;
          ctx.fillRect(px - 8, py - 6, 16, 15);
          ctx.globalAlpha = 1;
        }
        ctx.fillStyle = PALETTE.heart;
        ctx.fillRect(px - 6, py - 4, 5, 5);
        ctx.fillRect(px + 1, py - 4, 5, 5);
        ctx.fillRect(px - 4, py - 1, 8, 5);
        ctx.fillRect(px - 2, py + 4, 4, 3);
        break;
      }
      case 'dagger': {
        ctx.fillStyle = PALETTE.dagger;
        ctx.fillRect(px - 1, py - 7, 3, 10);
        ctx.fillStyle = '#8a6a1e';
        ctx.fillRect(px - 4, py + 3, 9, 3);
        break;
      }
      case 'potion': {
        ctx.fillStyle = PALETTE.potion;
        ctx.fillRect(px - 4, py - 2, 8, 8);
        ctx.fillStyle = '#cfe9f2';
        ctx.fillRect(px - 2, py - 7, 4, 5);
        break;
      }
      case 'key': {
        ctx.fillStyle = PALETTE.keyGold;
        ctx.fillRect(px - 5, py - 5, 6, 6);
        ctx.fillStyle = '#2b2118';
        ctx.fillRect(px - 3, py - 3, 2, 2);
        ctx.fillStyle = PALETTE.keyGold;
        ctx.fillRect(px + 1, py - 1, 6, 2);
        ctx.fillRect(px + 4, py + 1, 2, 3);
        break;
      }
      case 'relic-shrine': {
        // Pedestal with a pulsing gem.
        ctx.fillStyle = '#4d4238';
        ctx.fillRect(px - 8, py + 2, 16, 8);
        ctx.fillRect(px - 5, py - 2, 10, 5);
        const pulse = 0.5 + 0.5 * Math.sin(time * 5);
        ctx.fillStyle = `rgba(200, 120, 255, ${0.6 + 0.4 * pulse})`;
        ctx.fillRect(px - 4, py - 10, 8, 8);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(px - 2, py - 8, 2, 2);
        break;
      }
      case 'scroll': {
        // v3 — unidentified scroll: rolled parchment with a wax-red ribbon.
        ctx.fillStyle = '#e8dcbc';
        ctx.fillRect(px - 6, py - 3, 12, 7);
        ctx.fillStyle = '#cfc09a';
        ctx.fillRect(px - 6, py - 3, 12, 2);
        ctx.fillStyle = '#c22f2f';
        ctx.fillRect(px - 1, py - 4, 2, 9);
        const shimmer = Math.floor(time * 4 + pickup.bobPhase) % 3 === 0;
        if (shimmer) {
          ctx.fillStyle = 'rgba(255, 224, 138, 0.5)';
          ctx.fillRect(px - 7, py - 5, 2, 2);
        }
        break;
      }
      case 'item': {
        // v5 Wave F — a banded strongbox, its clasp glowing the find's color.
        const glow = pickup.itemId ? ITEMS[pickup.itemId].color : PALETTE.gold;
        ctx.fillStyle = '#5a3a22';
        ctx.fillRect(px - 7, py - 4, 14, 10);
        ctx.fillStyle = '#3a2414';
        ctx.fillRect(px - 7, py - 1, 14, 2);
        const pulse = 0.5 + 0.5 * Math.sin(time * 5 + pickup.bobPhase);
        ctx.globalAlpha = 0.6 + 0.4 * pulse;
        ctx.fillStyle = glow;
        ctx.fillRect(px - 2, py - 3, 4, 5);
        ctx.globalAlpha = 1;
        break;
      }
    }
  }
}
