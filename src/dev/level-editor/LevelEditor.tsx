'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ALL_LEVELS } from '@/games/platform-adventure/levels/LevelData';
import { TILE_COLORS, TileType } from '@/games/platform-adventure/data/TileTypes';

const CHAR_TO_TILE: Record<string, TileType> = {
  ' ': 'empty',
  '#': 'wall',
  '=': 'floor',
  '-': 'platform',
  '|': 'pillar',
  _: 'ledge',
  '^': 'spikes',
  X: 'chomper',
  '~': 'loose',
  G: 'gate',
  R: 'gate',
  B: 'gate',
  Y: 'gate',
  '*': 'switch',
  r: 'switch',
  b: 'switch',
  y: 'switch',
  D: 'door',
  T: 'torch',
  h: 'potion_hp',
  H: 'potion_max',
  g: 'gem',
  t: 'time',
  E: 'guard',
  P: 'player',
  O: 'owl',
  // Story/environmental tiles
  S: 'skeleton',
  I: 'inscription',
  C: 'spectral_crystal',
  F: 'fallen_seeker',
  J: 'journal',
  // Item progression tiles
  W: 'item_sword',
  A: 'item_armor',
  V: 'item_boots',
  K: 'item_heart',
};

const GATE_CHARS = ['G', 'R', 'B', 'Y'];
const SWITCH_CHARS = ['*', 'r', 'b', 'y'];

const CHAR_SWATCH: Record<string, string> = {
  G: '#6b6b5a',
  R: '#b04a4a',
  B: '#4a6ad1',
  Y: '#d1a84a',
  '*': '#6b6b5a',
  r: '#b04a4a',
  b: '#4a6ad1',
  y: '#d1a84a',
};

const SOLID_TILES = new Set(['#', '=', '-', ...GATE_CHARS]);

const PALETTE = [
  {
    label: 'Basics',
    tiles: [
      { char: ' ', label: 'Empty' },
      { char: '#', label: 'Wall' },
      { char: '=', label: 'Floor' },
      { char: '-', label: 'Platform' },
      { char: '|', label: 'Pillar' },
      { char: '_', label: 'Ledge' },
    ],
  },
  {
    label: 'Hazards',
    tiles: [
      { char: '^', label: 'Spikes' },
      { char: 'X', label: 'Chomper' },
      { char: '~', label: 'Loose Floor' },
    ],
  },
  {
    label: 'Interactables',
    tiles: [
      { char: 'G', label: 'Gate (Gray)' },
      { char: 'R', label: 'Gate (Red)' },
      { char: 'B', label: 'Gate (Blue)' },
      { char: 'Y', label: 'Gate (Gold)' },
      { char: '*', label: 'Switch (Gray)' },
      { char: 'r', label: 'Switch (Red)' },
      { char: 'b', label: 'Switch (Blue)' },
      { char: 'y', label: 'Switch (Gold)' },
      { char: 'D', label: 'Door' },
      { char: 'T', label: 'Torch' },
    ],
  },
  {
    label: 'Pickups',
    tiles: [
      { char: 'h', label: 'Health' },
      { char: 'H', label: 'Max Health' },
      { char: 'g', label: 'Gem' },
      { char: 't', label: 'Time' },
      { char: 'O', label: 'Owl' },
    ],
  },
  {
    label: 'Entities',
    tiles: [
      { char: 'P', label: 'Player Spawn' },
      { char: 'E', label: 'Guard' },
    ],
  },
  {
    label: 'Items',
    tiles: [
      { char: 'W', label: 'Ancient Blade' },
      { char: 'A', label: 'Iron Armor' },
      { char: 'V', label: 'Dash Boots' },
      { char: 'K', label: 'Crystal Heart' },
    ],
  },
  {
    label: 'Story',
    tiles: [
      { char: 'S', label: 'Skeleton' },
      { char: 'I', label: 'Inscription' },
      { char: 'C', label: 'Spectral Crystal' },
      { char: 'J', label: 'Journal' },
      { char: 'F', label: 'Fallen Seeker' },
    ],
  },
];

// Get swatch color for a tile char - uses actual game colors for consistency
const getTileSwatchColor = (char: string): string => {
  // Special colors for gate/switch variants
  if (CHAR_SWATCH[char]) return CHAR_SWATCH[char];
  // Use actual TILE_COLORS from the game
  const tileType = CHAR_TO_TILE[char] ?? 'empty';
  return TILE_COLORS[tileType]?.primary ?? '#000000';
};

const createGrid = (width: number, height: number, fill: string = ' ') =>
  Array.from({ length: height }, () => Array.from({ length: width }, () => fill));

const tilesToGrid = (tiles: string[], width: number): string[][] =>
  tiles.map((row) => row.padEnd(width, ' ').split(''));

const gridToAscii = (grid: string[][]): string => grid.map((row) => row.join('')).join('\n');

const gridToLevelDataRows = (grid: string[][]): string =>
  grid.map((row) => `'${row.join('')}',`).join('\n');

const cleanImportLines = (raw: string): string[] =>
  raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.replace(/^'+|'+,?$/g, ''));

const cloneGrid = (grid: string[][]): string[][] => grid.map((row) => [...row]);

const MAX_HISTORY = 50;

export default function LevelEditorPage() {
  const [width, setWidth] = useState(ALL_LEVELS[0]?.width ?? 50);
  const [height, setHeight] = useState(ALL_LEVELS[0]?.height ?? 15);
  const [grid, setGrid] = useState(() =>
    ALL_LEVELS[0]?.tiles ? tilesToGrid(ALL_LEVELS[0].tiles, ALL_LEVELS[0].width) : createGrid(50, 15)
  );
  const [cellSize, setCellSize] = useState(18);
  const [selectedChar, setSelectedChar] = useState(' ');
  const [activeTool, setActiveTool] = useState<'brush' | 'fill' | 'erase'>('brush');
  const [showRulers, setShowRulers] = useState(true);
  const [isPainting, setIsPainting] = useState(false);
  const [hoverCell, setHoverCell] = useState<{ row: number; col: number } | null>(null);
  const [importText, setImportText] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const [activeLevel, setActiveLevel] = useState(0);
  const [history, setHistory] = useState<string[][][]>([]);
  const [future, setFuture] = useState<string[][][]>([]);
  const gridRef = useRef(grid);

  const asciiRows = useMemo(() => gridToAscii(grid), [grid]);
  const levelRows = useMemo(() => gridToLevelDataRows(grid), [grid]);
  const labelStep = useMemo(() => {
    if (width > 80) return 10;
    if (width > 40) return 5;
    if (width > 20) return 2;
    return 1;
  }, [width]);

  useEffect(() => {
    gridRef.current = grid;
  }, [grid]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey) return;
      const key = event.key.toLowerCase();
      if (key === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if (key === 'y') {
        event.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [history, future]);

  const pushHistory = (snapshot: string[][]) => {
    setHistory((prev) => [cloneGrid(snapshot), ...prev].slice(0, MAX_HISTORY));
    setFuture([]);
  };

  const applyResize = () => {
    const newWidth = Math.max(5, Math.min(120, Math.floor(width)));
    const newHeight = Math.max(5, Math.min(60, Math.floor(height)));
    const next = createGrid(newWidth, newHeight);

    pushHistory(gridRef.current);
    for (let r = 0; r < Math.min(newHeight, grid.length); r++) {
      for (let c = 0; c < Math.min(newWidth, grid[r].length); c++) {
        next[r][c] = grid[r][c];
      }
    }

    setWidth(newWidth);
    setHeight(newHeight);
    setGrid(next);
  };

  const loadLevel = (index: number) => {
    const level = ALL_LEVELS[index];
    if (!level) return;
    setActiveLevel(index);
    setWidth(level.width);
    setHeight(level.height);
    setGrid(tilesToGrid(level.tiles, level.width));
    setHistory([]);
    setFuture([]);
  };

  const paintCell = (row: number, col: number, char: string) => {
    setGrid((prev) => {
      if (!prev[row] || prev[row][col] === char) return prev;
      const next = prev.map((r, i) => (i === row ? [...r] : r));
      next[row][col] = char;
      return next;
    });
  };

  const floodFill = (row: number, col: number, char: string) => {
    const current = gridRef.current;
    if (!current[row] || current[row][col] === char) return;
    const target = current[row][col];
    const next = cloneGrid(current);
    const stack: Array<[number, number]> = [[row, col]];
    while (stack.length > 0) {
      const [r, c] = stack.pop()!;
      if (r < 0 || r >= next.length || c < 0 || c >= next[r].length) continue;
      if (next[r][c] !== target) continue;
      next[r][c] = char;
      stack.push([r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]);
    }
    pushHistory(current);
    setGrid(next);
  };

  const handleUndo = () => {
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const [latest, ...rest] = prev;
      setFuture((futurePrev) => [cloneGrid(gridRef.current), ...futurePrev].slice(0, MAX_HISTORY));
      setGrid(cloneGrid(latest));
      return rest;
    });
  };

  const handleRedo = () => {
    setFuture((prev) => {
      if (prev.length === 0) return prev;
      const [latest, ...rest] = prev;
      setHistory((historyPrev) => [cloneGrid(gridRef.current), ...historyPrev].slice(0, MAX_HISTORY));
      setGrid(cloneGrid(latest));
      return rest;
    });
  };

  const handlePointerDown = (row: number, col: number, button: number, altKey: boolean) => {
    if (button !== 0 && button !== 2) return;
    if (altKey && button === 0) {
      const picked = gridRef.current[row]?.[col];
      if (picked) {
        setSelectedChar(picked);
        setActiveTool(picked === ' ' ? 'erase' : 'brush');
      }
      return;
    }

    if ((button === 0 && activeTool === 'fill') || (button === 2 && activeTool === 'fill')) {
      const char = button === 2 ? ' ' : selectedChar;
      floodFill(row, col, char);
      return;
    }

    const erase = button === 2;
    setIsPainting(true);
    pushHistory(gridRef.current);
    paintCell(row, col, erase || activeTool === 'erase' ? ' ' : selectedChar);
  };

  const handlePointerEnter = (row: number, col: number, buttons: number) => {
    if (!isPainting || buttons === 0) return;
    const erase = (buttons & 2) === 2;
    paintCell(row, col, erase || activeTool === 'erase' ? ' ' : selectedChar);
  };

  const handlePointerUp = () => setIsPainting(false);

  const handleImport = () => {
    const lines = cleanImportLines(importText);
    if (lines.length === 0) return;
    const newWidth = Math.max(...lines.map((line) => line.length));
    const newHeight = lines.length;
    const next = createGrid(newWidth, newHeight);
    lines.forEach((line, row) => {
      const chars = line.padEnd(newWidth, ' ').split('');
      chars.forEach((char, col) => {
        next[row][col] = CHAR_TO_TILE[char] ? char : ' ';
      });
    });
    pushHistory(gridRef.current);
    setWidth(newWidth);
    setHeight(newHeight);
    setGrid(next);
  };

  const handleCopy = async (payload: string) => {
    try {
      await navigator.clipboard.writeText(payload);
      setCopyStatus('Copied to clipboard.');
      setTimeout(() => setCopyStatus(''), 1500);
    } catch {
      setCopyStatus('Copy failed. Select and copy manually.');
      setTimeout(() => setCopyStatus(''), 2000);
    }
  };

  const snapGuardsToGround = () => {
    pushHistory(gridRef.current);
    setGrid((prev) => {
      const next = prev.map((row) => [...row]);
      for (let r = 0; r < next.length; r++) {
        for (let c = 0; c < next[r].length; c++) {
          if (next[r][c] !== 'E') continue;
          let targetRow = r;
          for (let rr = r + 1; rr < next.length; rr++) {
            if (SOLID_TILES.has(next[rr][c])) {
              targetRow = rr - 1;
              break;
            }
          }
          if (targetRow !== r && targetRow >= 0 && next[targetRow][c] === ' ') {
            next[r][c] = ' ';
            next[targetRow][c] = 'E';
          }
        }
      }
      return next;
    });
  };

  const counts = useMemo(() => {
    const tally: Record<string, number> = {};
    grid.forEach((row) =>
      row.forEach((cell) => {
        tally[cell] = (tally[cell] || 0) + 1;
      })
    );
    return tally;
  }, [grid]);

  const gateCount = useMemo(() => GATE_CHARS.reduce((sum, char) => sum + (counts[char] || 0), 0), [counts]);
  const switchCount = useMemo(() => SWITCH_CHARS.reduce((sum, char) => sum + (counts[char] || 0), 0), [counts]);

  const warnings = useMemo(() => {
    const messages: string[] = [];
    if ((counts.P || 0) === 0) messages.push('Missing player spawn (P).');
    if ((counts.P || 0) > 1) messages.push('Multiple player spawns.');
    if ((counts.D || 0) === 0) messages.push('Missing door (D).');
    if ((counts.O || 0) === 0) messages.push('Missing owl (O).');
    return messages;
  }, [counts]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-gray-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Crystal Caverns Level Editor</h1>
            <p className="text-purple-200 text-sm">
              Paint tiles, snap guards to ground, and export ASCII rows for LevelData.ts.
            </p>
          </div>
          <Link href="/" className="arcade-button">
            Back to Arcade
          </Link>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          <aside className="arcade-panel space-y-5">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-purple-200">Tools</h2>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="arcade-button text-sm py-2 px-4"
                  onClick={() => {
                    pushHistory(gridRef.current);
                    setGrid(createGrid(width, height));
                  }}
                >
                  Clear
                </button>
                <button type="button" className="arcade-button text-sm py-2 px-4" onClick={snapGuardsToGround}>
                  Snap Guards
                </button>
                <button type="button" className="arcade-button text-sm py-2 px-4" onClick={handleUndo} disabled={history.length === 0}>
                  Undo
                </button>
                <button type="button" className="arcade-button text-sm py-2 px-4" onClick={handleRedo} disabled={future.length === 0}>
                  Redo
                </button>
                <button type="button" className="arcade-button text-sm py-2 px-4" onClick={() => handleCopy(levelRows)}>
                  Copy Level Rows
                </button>
              </div>
              {copyStatus && <p className="text-xs text-purple-200">{copyStatus}</p>}
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-purple-200">Level Preset</h2>
              <select
                className="w-full rounded-lg border border-purple-500/40 bg-gray-900/70 px-3 py-2 text-sm"
                value={activeLevel}
                onChange={(e) => loadLevel(Number(e.target.value))}
              >
                {ALL_LEVELS.map((level, index) => (
                  <option key={level.name} value={index}>
                    {`Level ${index + 1}: ${level.name}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-purple-200">Grid</h2>
              <div className="flex items-center gap-2">
                <label className="text-xs text-purple-200">Width</label>
                <input
                  type="number"
                  className="w-20 rounded border border-purple-500/40 bg-gray-900/70 px-2 py-1 text-sm"
                  value={width}
                  onChange={(e) => setWidth(Number(e.target.value))}
                />
                <label className="text-xs text-purple-200">Height</label>
                <input
                  type="number"
                  className="w-20 rounded border border-purple-500/40 bg-gray-900/70 px-2 py-1 text-sm"
                  value={height}
                  onChange={(e) => setHeight(Number(e.target.value))}
                />
                <button type="button" className="arcade-button text-sm py-2 px-3" onClick={applyResize}>
                  Resize
                </button>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-purple-200">Zoom</label>
                <input
                  type="range"
                  min={12}
                  max={32}
                  value={cellSize}
                  onChange={(e) => setCellSize(Number(e.target.value))}
                />
                <span className="text-xs text-purple-200">{cellSize}px</span>
              </div>
              <label className="flex items-center gap-2 text-xs text-purple-200">
                <input
                  type="checkbox"
                  className="accent-purple-400"
                  checked={showRulers}
                  onChange={(event) => setShowRulers(event.target.checked)}
                />
                Show coordinate rulers
              </label>
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-purple-200">Palette</h2>
              <p className="text-xs text-purple-200">Left click paints, right click erases, Alt click picks tile.</p>
              <div className="flex gap-2">
                {(['brush', 'fill', 'erase'] as const).map((tool) => (
                  <button
                    key={tool}
                    type="button"
                    className={`px-3 py-1 rounded-lg text-xs border ${
                      activeTool === tool ? 'border-purple-300 bg-purple-500/30' : 'border-white/10 bg-white/5'
                    }`}
                    onClick={() => setActiveTool(tool)}
                  >
                    {tool === 'brush' ? 'Brush' : tool === 'fill' ? 'Fill' : 'Erase'}
                  </button>
                ))}
              </div>
              <div className="space-y-4">
                {PALETTE.map((group) => (
                  <div key={group.label} className="space-y-2">
                    <p className="text-xs uppercase tracking-wide text-purple-300">{group.label}</p>
                    <div className="space-y-1">
                      {group.tiles.map((tile) => {
                        const color = getTileSwatchColor(tile.char);
                        const isActive = selectedChar === tile.char;
                        return (
                          <button
                            key={`${group.label}-${tile.char}`}
                            type="button"
                            className={`w-full flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition ${
                              isActive
                                ? 'border-purple-300 bg-purple-500/30'
                                : 'border-white/10 bg-white/5 hover:border-purple-400/60'
                            }`}
                            onClick={() => setSelectedChar(tile.char)}
                          >
                            <span className="flex items-center gap-3">
                              <span className="font-mono text-xs bg-black/40 px-2 py-1 rounded">
                                {tile.char === ' ' ? '[space]' : tile.char}
                              </span>
                              <span>{tile.label}</span>
                            </span>
                            <span className="h-4 w-4 rounded" style={{ backgroundColor: color }} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-purple-200">Validation</h2>
              <p className="text-xs text-purple-200">Player: {counts.P || 0} | Door: {counts.D || 0} | Owl: {counts.O || 0}</p>
              <p className="text-xs text-purple-200">Guards: {counts.E || 0} | Gates: {gateCount} | Switches: {switchCount}</p>
              {warnings.length > 0 && (
                <div className="rounded-lg border border-red-400/40 bg-red-500/10 p-2 text-xs text-red-200">
                  {warnings.map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
                </div>
              )}
            </div>
          </aside>

          <section className="arcade-panel space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-purple-200">Canvas</h2>
                <p className="text-xs text-purple-200">
                  {width} x {height} tiles {hoverCell ? `| Hover ${hoverCell.col}, ${hoverCell.row}` : ''}
                </p>
              </div>
              <button type="button" className="arcade-button text-sm py-2 px-4" onClick={() => handleCopy(asciiRows)}>
                Copy ASCII
              </button>
            </div>

            <div
              className="overflow-auto border border-purple-500/40 rounded-lg bg-black/30"
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              onContextMenu={(event) => event.preventDefault()}
            >
              <div className="relative w-fit">
                {showRulers && (
                  <div className="pointer-events-none absolute inset-0 text-[10px] text-purple-200/70">
                    {Array.from({ length: width }).map((_, col) =>
                      col % labelStep === 0 ? (
                        <div
                          key={`col-${col}`}
                          className="absolute -top-5"
                          style={{ left: col * cellSize }}
                        >
                          {col}
                        </div>
                      ) : null
                    )}
                    {Array.from({ length: height }).map((_, row) =>
                      row % labelStep === 0 ? (
                        <div
                          key={`row-${row}`}
                          className="absolute -left-6"
                          style={{ top: row * cellSize }}
                        >
                          {row}
                        </div>
                      ) : null
                    )}
                  </div>
                )}
                <div
                  className="grid w-fit"
                  style={{ gridTemplateColumns: `repeat(${width}, ${cellSize}px)` }}
                >
                  {grid.map((row, r) =>
                    row.map((cell, c) => {
                      const tileType = CHAR_TO_TILE[cell] ?? 'empty';
                      const colors = TILE_COLORS[tileType];
                      const swatch = CHAR_SWATCH[cell];
                      const bg = swatch ?? (tileType === 'empty' ? 'rgba(0,0,0,0.2)' : colors.primary);
                      return (
                        <div
                          key={`${r}-${c}`}
                          className="border border-white/5 hover:border-purple-400/70"
                          style={{ width: cellSize, height: cellSize, backgroundColor: bg }}
                          onPointerDown={(event) => handlePointerDown(r, c, event.button, event.altKey)}
                          onPointerEnter={(event) => handlePointerEnter(r, c, event.buttons)}
                          onMouseEnter={() => setHoverCell({ row: r, col: c })}
                          onMouseLeave={() => setHoverCell(null)}
                        />
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-purple-200">ASCII Output</h3>
                  <button type="button" className="arcade-button text-xs py-1 px-3" onClick={() => handleCopy(asciiRows)}>
                    Copy
                  </button>
                </div>
                <textarea
                  className="w-full h-48 rounded-lg border border-purple-500/30 bg-gray-900/70 p-3 font-mono text-xs"
                  value={asciiRows}
                  readOnly
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-purple-200">LevelData Rows</h3>
                  <button type="button" className="arcade-button text-xs py-1 px-3" onClick={() => handleCopy(levelRows)}>
                    Copy
                  </button>
                </div>
                <textarea
                  className="w-full h-48 rounded-lg border border-purple-500/30 bg-gray-900/70 p-3 font-mono text-xs"
                  value={levelRows}
                  readOnly
                />
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-purple-200">Import Rows</h3>
              <textarea
                className="w-full h-32 rounded-lg border border-purple-500/30 bg-gray-900/70 p-3 font-mono text-xs"
                placeholder="Paste raw ASCII rows or LevelData strings, then click Import."
                value={importText}
                onChange={(event) => setImportText(event.target.value)}
              />
              <div className="flex items-center gap-2">
                <button type="button" className="arcade-button text-sm py-2 px-4" onClick={handleImport}>
                  Import
                </button>
                <p className="text-xs text-purple-200">Invalid chars are converted to spaces.</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
