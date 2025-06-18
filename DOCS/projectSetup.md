# HacktivateNations Arcade - Project Setup

## 🚀 Initial Setup Commands

```bash
# Create Next.js project with TypeScript
npx create-next-app@latest hacktivate-nations-arcade --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

cd hacktivate-nations-arcade

# Install additional dependencies
npm install zustand @types/node lucide-react clsx class-variance-authority

# Install development dependencies
npm install -D prettier eslint-config-prettier @typescript-eslint/eslint-plugin @typescript-eslint/parser

# Initialize git if not already done
git init
git add .
git commit -m "Initial project setup"
```

## 📁 Project Structure

Create this folder structure in your `src` directory:

```
src/
├── app/                    # Next.js 14 app router
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx
│   └── loading.tsx
├── components/            # Reusable UI components
│   ├── ui/               # Base UI components
│   ├── arcade/           # Arcade-specific components
│   │   ├── ArcadeHub.tsx
│   │   ├── GameCarousel.tsx
│   │   ├── GameCanvas.tsx
│   │   └── CurrencyDisplay.tsx
│   └── layout/           # Layout components
│       ├── Header.tsx
│       └── Footer.tsx
├── games/                # Game modules
│   ├── shared/          # Shared game utilities
│   │   ├── GameModule.ts
│   │   ├── BaseGame.ts
│   │   └── utils/
│   ├── runner/          # First game - endless runner
│   │   ├── RunnerGame.ts
│   │   ├── entities/
│   │   ├── assets/
│   │   └── index.ts
│   └── registry.ts      # Game registry
├── services/            # Shared services
│   ├── InputManager.ts
│   ├── AudioManager.ts
│   ├── Analytics.ts
│   ├── CurrencyService.ts
│   └── GameLoader.ts
├── stores/              # Zustand stores
│   ├── gameStore.ts
│   ├── currencyStore.ts
│   └── userStore.ts
├── lib/                 # Utilities & configs
│   ├── utils.ts
│   ├── constants.ts
│   └── types.ts
├── hooks/               # Custom React hooks
│   ├── useGameModule.ts
│   ├── useCanvas.ts
│   └── useInput.ts
└── assets/              # Static assets
    ├── images/
    ├── sounds/
    └── fonts/
```

## 🎯 Key Files to Create

After running the setup commands, you'll need to create several foundational files. I'll provide these in separate artifacts.

## 📋 Next Steps

1. Run the setup commands above
2. Create the folder structure
3. Add the configuration files (coming in next artifacts)
4. Set up the core interfaces and types
5. Create the basic game module system

Ready for the configuration files?