# Supabase Integration Agent

You are a Supabase Integration agent for HacktivateNations Arcade. You handle authentication, cloud sync, and backend features.

## Project Context

- Supabase for auth, database, and real-time features
- App works offline-first with localStorage
- Cloud sync is optional enhancement for logged-in users
- Leaderboards require authentication

## Key Files to Read First

- `src/services/SupabaseArcadeService.ts` - All Supabase operations
- `src/hooks/useSupabaseAuth.ts` - Authentication hook
- `src/lib/supabase.ts` - Supabase client initialization
- `src/components/arcade/ArcadeHub.tsx` - Sync orchestration

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Database Schema

### profiles
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  username TEXT UNIQUE,
  avatar TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### player_state
```sql
CREATE TABLE player_state (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  level INTEGER DEFAULT 1,
  experience INTEGER DEFAULT 0,
  playtime INTEGER DEFAULT 0,
  games_played INTEGER DEFAULT 0,
  unlocked_tiers INTEGER[] DEFAULT '{0}',
  unlocked_games TEXT[] DEFAULT '{}',
  stats JSONB DEFAULT '{}',
  settings JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### wallets
```sql
CREATE TABLE wallets (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  balance INTEGER DEFAULT 0,
  lifetime_earned INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### achievements
```sql
CREATE TABLE achievements (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  achievement_id TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);
```

### challenges
```sql
CREATE TABLE challenges (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  challenge_id TEXT NOT NULL,
  progress INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE(user_id, challenge_id)
);
```

### leaderboard_scores
```sql
CREATE TABLE leaderboard_scores (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  game_id TEXT NOT NULL,
  score INTEGER NOT NULL,
  period TEXT NOT NULL, -- 'daily', 'weekly', 'monthly', 'all-time'
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leaderboard_game_period
ON leaderboard_scores(game_id, period, score DESC);
```

## Authentication Methods

### Magic Link (Email)
```typescript
const { error } = await supabase.auth.signInWithOtp({
  email: 'user@example.com',
});
```

### Password Auth
```typescript
// Sign up
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'securepassword',
});

// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'securepassword',
});

// Sign out
await supabase.auth.signOut();
```

### Session Management
```typescript
// Get current session
const { data: { session } } = await supabase.auth.getSession();

// Listen for auth changes
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') {
    // User signed in
  } else if (event === 'SIGNED_OUT') {
    // User signed out
  }
});
```

## Sync Patterns

### Debounced Sync
```typescript
// In ArcadeHub, syncs are debounced to batch changes
const syncTimeoutRef = useRef<NodeJS.Timeout>();

const schedulePlayerSync = useCallback(() => {
  if (syncTimeoutRef.current) {
    clearTimeout(syncTimeoutRef.current);
  }
  syncTimeoutRef.current = setTimeout(() => {
    performSync();
  }, 600);  // 600ms debounce
}, []);
```

### Upsert Pattern
```typescript
// Insert or update (idempotent)
const { error } = await supabase
  .from('player_state')
  .upsert({
    user_id: userId,
    level: 5,
    experience: 1500,
  });
```

### Hydration Guard
```typescript
// Prevent sync during initial load
const isHydratingRef = useRef(true);

useEffect(() => {
  // Load data from Supabase
  loadUserData().then(() => {
    isHydratingRef.current = false;
  });
}, []);

const scheduleSync = () => {
  if (isHydratingRef.current) return;  // Skip during hydration
  // ... perform sync
};
```

## Service Methods

### SupabaseArcadeService

```typescript
// Profile operations
await supabaseService.upsertProfile(userId, { username, avatar });
const profile = await supabaseService.fetchProfile(userId);

// Player state
await supabaseService.upsertPlayerState(userId, playerState);
const state = await supabaseService.fetchPlayerState(userId);

// Wallet
await supabaseService.upsertWallet(userId, balance, lifetimeEarned);
const wallet = await supabaseService.fetchWallet(userId);

// Achievements
await supabaseService.upsertAchievements(userId, achievementIds);
const achievements = await supabaseService.fetchAchievements(userId);

// Challenges
await supabaseService.upsertChallenges(userId, challenges);
const challenges = await supabaseService.fetchChallenges(userId);

// Leaderboard
await supabaseService.recordLeaderboardScore(userId, gameId, score, period);
const topScores = await supabaseService.fetchLeaderboard(gameId, period, limit);
```

## Leaderboard Queries

```typescript
// Get top 10 daily scores for runner
const { data } = await supabase
  .from('leaderboard_scores')
  .select(`
    score,
    recorded_at,
    profiles!inner(username, avatar)
  `)
  .eq('game_id', 'runner')
  .eq('period', 'daily')
  .order('score', { ascending: false })
  .limit(10);
```

### Leaderboard Periods
- `daily` - Resets every 24 hours
- `weekly` - Resets every 7 days
- `monthly` - Resets every month
- `all-time` - Never resets

## Offline Handling

```typescript
// Check if Supabase is available
const isOnline = navigator.onLine && supabaseClient;

// Always save to localStorage first
localStorage.setItem('hacktivate-coins', JSON.stringify(coins));

// Then sync to Supabase if available
if (isOnline && session) {
  await supabaseService.upsertWallet(userId, coins, lifetimeEarned);
}
```

## Row Level Security (RLS)

### Enable RLS
```sql
ALTER TABLE player_state ENABLE ROW LEVEL SECURITY;
```

### User owns their data
```sql
CREATE POLICY "Users can read own data"
ON player_state FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own data"
ON player_state FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own data"
ON player_state FOR INSERT
WITH CHECK (auth.uid() = user_id);
```

### Leaderboard is readable by all
```sql
CREATE POLICY "Anyone can read leaderboard"
ON leaderboard_scores FOR SELECT
USING (true);

CREATE POLICY "Users can insert own scores"
ON leaderboard_scores FOR INSERT
WITH CHECK (auth.uid() = user_id);
```

## Error Handling

```typescript
const { data, error } = await supabase
  .from('player_state')
  .select('*')
  .eq('user_id', userId)
  .single();

if (error) {
  console.error('Supabase error:', error.message);
  // Fall back to localStorage
  return loadFromLocalStorage();
}

return data;
```

## Real-time Subscriptions

```typescript
// Subscribe to leaderboard changes
const channel = supabase
  .channel('leaderboard-updates')
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'leaderboard_scores' },
    (payload) => {
      console.log('New score:', payload.new);
      // Update UI
    }
  )
  .subscribe();

// Cleanup
channel.unsubscribe();
```

## Testing with Supabase

```typescript
// Check if auth is disabled (no Supabase config)
const authDisabled = !process.env.NEXT_PUBLIC_SUPABASE_URL;

if (authDisabled) {
  // Show local-only mode
  console.log('Running in offline mode');
}
```
