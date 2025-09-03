# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Commands
- `npm run dev` - Start development server (runs on http://localhost:3000)
- `npm run build` - Create production build
- `npm run start` - Serve production build locally
- `npm run lint` - Run ESLint (extends Next.js, TypeScript, Prettier configs)
- `npm run lint:fix` - Auto-fix ESLint issues
- `npm run type-check` - Verify TypeScript compilation (uses `tsc --noEmit`)
- `npm run test` - Run Jest tests
- `npm run test:watch` - Run tests in watch mode
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting

### Testing
- Jest configured with ts-jest preset and jsdom environment
- Tests located in `src/**/__tests__/` directories
- Uses `@/` path mapping for imports

## Architecture Overview

### Project Structure
This is a **modular arcade game platform** built with Next.js 15, React 19, and TypeScript. The core concept is a plug-and-play system where games implement a common `GameModule` interface and integrate with shared services.

### Key Directories
- `src/games/` - Individual game modules (runner, snake, block, breakout, memory, etc.)
- `src/games/shared/` - Common game interfaces (`GameModule.ts`, `BaseGame.ts`) and utilities
- `src/services/` - Shared platform services (InputManager, AudioManager, GameLoader, etc.)
- `src/stores/` - Zustand state management (gameStore, currencyStore, userStore)
- `src/components/arcade/` - Arcade hub UI components
- `src/hooks/` - Custom React hooks (useCanvas, useInput, useGameModule)

### Game Module System
Games must implement the `GameModule` interface from `src/games/shared/GameModule.ts`:
- `init(canvas, services)` - Initialize game with canvas and shared services
- `update(dt)` - Update game logic (delta time in milliseconds)
- `render(ctx)` - Render game to 2D canvas context
- Optional lifecycle hooks: `pause()`, `resume()`, `resize()`, `destroy()`
- `manifest` - Game metadata (id, title, thumbnail, etc.)

### Game Registration
New games are registered in `src/games/registry.ts` using the `GameLoader` service with dynamic imports for code splitting.

### Shared Services Architecture
- **InputManager** (`src/services/InputManager.ts`) - Unified keyboard, touch, gamepad input
- **AudioManager** (`src/services/AudioManager.ts`) - WebAudio-based sound system
- **CurrencyService** - Universal coin economy across games
- **AchievementService** - Cross-game achievement system
- **Analytics** - Game metrics and user behavior tracking

### State Management
Uses Zustand for lightweight state management:
- Game state, user progress, and currency are managed centrally
- Stores are located in `src/stores/`

### Styling & UI
- Tailwind CSS v4 with custom configuration
- Component library with class-variance-authority for variant styling
- Responsive design with mobile-first approach
- Uses `@/` path mapping configured in `tsconfig.json`

## Development Guidelines

### Adding New Games
1. Create game folder in `src/games/[game-name]/`
2. Implement `GameModule` interface or extend `BaseGame` class
3. Register in `src/games/registry.ts` with lazy loading
4. Add game metadata to appropriate data files
5. Keep asset budget under 300KB per game

### Code Style
- ESLint configured with TypeScript and Next.js rules
- Prettier for consistent formatting
- Strict TypeScript settings enabled
- No unused variables (`@typescript-eslint/no-unused-vars`: "error")
- Warn on `any` usage (`@typescript-eslint/no-explicit-any`: "warn")

### Canvas & Rendering
- All games use HTML5 Canvas with 2D context
- Canvas management handled by `useCanvas` hook
- Responsive canvas sizing with proper DPI handling

### Input Handling
- Use `useInput` hook for consistent input across games
- Supports keyboard, mouse, touch, and gamepad
- Input schema defined per game for auto-configuration