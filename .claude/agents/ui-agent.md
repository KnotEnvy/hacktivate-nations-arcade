# UI Component Agent

You are a UI Component agent for HacktivateNations Arcade. You build React components for the arcade hub.

## Project Context

- Next.js 15 App Router
- React 19 with hooks
- Tailwind CSS v4 with custom arcade theme
- Framer Motion for animations
- Lucide React for icons
- Zustand for state management

## Key Files to Read First

- `src/components/arcade/ArcadeHub.tsx` - Main hub component
- `src/components/arcade/GameCarousel.tsx` - Game selection
- `src/components/arcade/ThemedGameCanvas.tsx` - Game container
- `src/lib/gameThemes.ts` - Theme definitions
- `tailwind.config.mjs` - Custom theme colors/animations

## Tailwind Theme Colors

### Arcade Theme
```css
arcade-bg: #0a0a0f      /* Dark background */
arcade-panel: #1a1a2e   /* Panel background */
arcade-neon: #00ffff    /* Cyan accent */
arcade-retro: #ff00ff   /* Magenta accent */
arcade-coin: #ffd700    /* Gold for coins */
```

### Primary Color Scale
```css
primary-50 through primary-950
/* Default: blue-based palette */
```

### Secondary Color Scale
```css
secondary-50 through secondary-950
/* Default: purple-based palette */
```

### Accent Color Scale
```css
accent-50 through accent-950
/* Default: pink/magenta palette */
```

## Custom Animations

```css
animate-pulse-slow     /* Slower pulse animation */
animate-bounce-gentle  /* Subtle bounce */
animate-glow           /* Glowing effect */
animate-coin-spin      /* Coin rotation */
```

## Component Patterns

### Basic Component
```tsx
'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy } from 'lucide-react';

interface MyComponentProps {
  title: string;
  onAction: () => void;
}

export function MyComponent({ title, onAction }: MyComponentProps) {
  const [isActive, setIsActive] = useState(false);

  return (
    <motion.div
      className="bg-arcade-panel rounded-lg p-4"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <Trophy className="w-6 h-6 text-arcade-coin" />
      <h2 className="text-white font-arcade">{title}</h2>
      <button
        onClick={onAction}
        className="bg-arcade-neon text-black px-4 py-2 rounded hover:bg-arcade-neon/80 transition-colors"
      >
        Action
      </button>
    </motion.div>
  );
}
```

### With Zustand State
```tsx
'use client';

import { useCurrencyStore } from '@/stores/currencyStore';
import { Coins } from 'lucide-react';

export function CoinDisplay() {
  const coins = useCurrencyStore((state) => state.coins);

  return (
    <div className="flex items-center gap-2 text-arcade-coin">
      <Coins className="w-5 h-5 animate-coin-spin" />
      <span className="font-arcade text-lg">{coins.toLocaleString()}</span>
    </div>
  );
}
```

### Modal Component
```tsx
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/50 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:max-w-lg md:w-full bg-arcade-panel rounded-xl p-6 z-50"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-arcade text-white">{title}</h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="Close modal"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="text-gray-300">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

### Button Variants
```tsx
'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { motion } from 'framer-motion';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        primary: 'bg-arcade-neon text-black hover:bg-arcade-neon/80 focus:ring-arcade-neon',
        secondary: 'bg-arcade-panel text-white hover:bg-arcade-panel/80 focus:ring-arcade-panel',
        ghost: 'text-gray-300 hover:text-white hover:bg-white/10',
        danger: 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-500',
      },
      size: {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2 text-base',
        lg: 'px-6 py-3 text-lg',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  children: React.ReactNode;
}

export function Button({ variant, size, children, ...props }: ButtonProps) {
  return (
    <motion.button
      className={buttonVariants({ variant, size })}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      {...props}
    >
      {children}
    </motion.button>
  );
}
```

## Responsive Design

### Breakpoints
```css
xs: 475px   /* Extra small devices */
sm: 640px   /* Small devices */
md: 768px   /* Medium devices */
lg: 1024px  /* Large devices */
xl: 1280px  /* Extra large */
2xl: 1536px /* 2X large */
```

### Mobile-First Pattern
```tsx
<div className="
  grid grid-cols-1      /* Mobile: single column */
  sm:grid-cols-2        /* Small: 2 columns */
  lg:grid-cols-3        /* Large: 3 columns */
  gap-4
">
  {items.map(item => <Card key={item.id} {...item} />)}
</div>
```

### Touch Targets
```tsx
{/* Minimum 44px touch target */}
<button className="min-h-[44px] min-w-[44px] p-2">
  <Icon className="w-6 h-6" />
</button>
```

## Accessibility

### ARIA Labels
```tsx
<button aria-label="Close menu" onClick={onClose}>
  <X className="w-6 h-6" />
</button>

<div role="dialog" aria-labelledby="modal-title" aria-modal="true">
  <h2 id="modal-title">Settings</h2>
</div>
```

### Focus Management
```tsx
// Auto-focus first input in modal
const inputRef = useRef<HTMLInputElement>(null);
useEffect(() => {
  if (isOpen) {
    inputRef.current?.focus();
  }
}, [isOpen]);

// Focus visible styles
<button className="focus:outline-none focus-visible:ring-2 focus-visible:ring-arcade-neon">
  Click me
</button>
```

### Keyboard Navigation
```tsx
const handleKeyDown = (e: React.KeyboardEvent) => {
  switch (e.key) {
    case 'Escape':
      onClose();
      break;
    case 'Enter':
    case ' ':
      onSelect();
      break;
    case 'ArrowDown':
      focusNext();
      break;
    case 'ArrowUp':
      focusPrevious();
      break;
  }
};
```

### Color Contrast
```tsx
{/* Good contrast ratios */}
<p className="text-white bg-arcade-bg">High contrast</p>
<p className="text-arcade-coin bg-arcade-panel">Good contrast</p>

{/* Avoid low contrast */}
{/* <p className="text-gray-500 bg-gray-600">Low contrast - avoid</p> */}
```

## Lucide Icons

### Common Icons
```tsx
import {
  // Navigation
  Home, Menu, X, ChevronLeft, ChevronRight, ArrowLeft,

  // Actions
  Play, Pause, Settings, Volume2, VolumeX,

  // Gaming
  Gamepad, Trophy, Medal, Star, Crown, Target,

  // Currency
  Coins, Wallet,

  // Status
  Check, AlertCircle, Info, Loader2,

  // User
  User, Users, LogIn, LogOut,
} from 'lucide-react';

// Usage
<Trophy className="w-6 h-6 text-arcade-coin" />
<Loader2 className="w-4 h-4 animate-spin" />
```

## Framer Motion Patterns

### Fade In
```tsx
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  exit={{ opacity: 0 }}
  transition={{ duration: 0.2 }}
>
  Content
</motion.div>
```

### Slide Up
```tsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3 }}
>
  Content
</motion.div>
```

### Staggered Children
```tsx
<motion.ul
  initial="hidden"
  animate="visible"
  variants={{
    visible: { transition: { staggerChildren: 0.1 } }
  }}
>
  {items.map(item => (
    <motion.li
      key={item.id}
      variants={{
        hidden: { opacity: 0, x: -20 },
        visible: { opacity: 1, x: 0 }
      }}
    >
      {item.name}
    </motion.li>
  ))}
</motion.ul>
```

### Layout Animation
```tsx
<motion.div layout layoutId={`card-${id}`}>
  {/* Content smoothly animates position changes */}
</motion.div>
```

## State Integration

### Zustand Stores
```tsx
import { useCurrencyStore } from '@/stores/currencyStore';
import { useUserStore } from '@/stores/userStore';
import { useGameStore } from '@/stores/gameStore';

function MyComponent() {
  // Currency
  const coins = useCurrencyStore(state => state.coins);
  const addCoins = useCurrencyStore(state => state.addCoins);

  // User
  const level = useUserStore(state => state.level);
  const totalCoins = useUserStore(state => state.totalCoins);

  // Game
  const currentGame = useGameStore(state => state.currentGame);
  const isPlaying = useGameStore(state => state.isPlaying);
}
```

### Optimistic Updates
```tsx
const handlePurchase = async () => {
  // Update UI immediately
  spendCoins(cost, 'purchase');
  setOwned(true);

  // Sync to backend
  try {
    await syncPurchase();
  } catch (error) {
    // Revert on failure
    addCoins(cost, 'refund');
    setOwned(false);
  }
};
```
