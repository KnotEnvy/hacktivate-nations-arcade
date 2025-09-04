# 🧪 **HacktivateNations Arcade - E2E Testing Plan**

## **Testing Strategy Overview**

### **Current Test Coverage Status**
- **Unit Tests**: ✅ 30.47% services, 27.27% lib, 100% gameThemes
- **Integration Tests**: ⚠️ Minimal 
- **E2E Tests**: ❌ Not implemented yet
- **Component Tests**: ❌ Not implemented yet

---

## **1. 🎯 E2E Testing Framework Setup**

### **Recommended Tools**
```bash
# Primary E2E Framework
npm install --save-dev @playwright/test

# Alternative options considered:
# - Cypress (good for component testing)
# - Puppeteer (lightweight but less features)
```

### **Test Environment Configuration**
- **Test Browser**: Chromium, Firefox, Safari
- **Test Data**: Isolated localStorage per test
- **Viewport**: Desktop (1920x1080) + Mobile (390x844)
- **Performance**: Lighthouse integration for performance testing

---

## **2. 🎮 Core User Journeys (Priority 1)**

### **Journey 1: First-Time User Experience**
```typescript
// tests/e2e/first-time-user.spec.ts
test('complete first-time user onboarding', async ({ page }) => {
  await page.goto('/');
  
  // 1. Onboarding appears for new user
  await expect(page.locator('[data-testid="onboarding-overlay"]')).toBeVisible();
  
  // 2. User can navigate through onboarding
  await page.click('[data-testid="onboarding-next"]');
  await page.click('[data-testid="onboarding-next"]');
  await page.click('[data-testid="onboarding-finish"]');
  
  // 3. Hub loads with default state
  await expect(page.locator('[data-testid="arcade-hub"]')).toBeVisible();
  await expect(page.locator('[data-testid="currency-display"]')).toContainText('0');
  await expect(page.locator('[data-testid="user-level"]')).toContainText('Level 1');
});
```

### **Journey 2: Game Selection and Play**
```typescript
// tests/e2e/game-play.spec.ts
test('select and play runner game with theme changes', async ({ page }) => {
  await page.goto('/');
  
  // 1. Navigate to games tab
  await page.click('[data-testid="tab-games"]');
  
  // 2. Select runner game
  const runnerCard = page.locator('[data-testid="game-card-runner"]');
  await runnerCard.hover();
  
  // 3. Verify theme preview appears
  await expect(page.locator('[data-testid="theme-preview"]')).toBeVisible();
  await expect(page.locator('[data-testid="theme-name"]')).toContainText('Neon Sprint');
  
  // 4. Start game
  await runnerCard.click();
  
  // 5. Verify themed game canvas loads
  await expect(page.locator('[data-testid="themed-game-canvas"]')).toBeVisible();
  
  // 6. Verify theme styling is applied
  const canvas = page.locator('[data-testid="game-canvas"]');
  const styles = await canvas.getAttribute('style');
  expect(styles).toContain('--theme-primary: #00FFFF'); // Neon cyan
  
  // 7. Play game briefly
  await page.keyboard.press('Space'); // Jump
  await page.waitForTimeout(2000);
  
  // 8. Return to hub
  await page.click('[data-testid="back-to-hub"]');
  await expect(page.locator('[data-testid="arcade-hub"]')).toBeVisible();
});
```

### **Journey 3: Currency and Progression System**
```typescript
// tests/e2e/progression.spec.ts  
test('earn coins and experience through gameplay', async ({ page }) => {
  await page.goto('/');
  
  // 1. Record initial state
  const initialCoins = await page.locator('[data-testid="currency-display"]').textContent();
  const initialLevel = await page.locator('[data-testid="user-level"]').textContent();
  
  // 2. Play a game to completion
  await page.click('[data-testid="game-card-runner"]');
  
  // Simulate gameplay
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);
  }
  
  // 3. Game ends, return to hub
  await page.waitForSelector('[data-testid="game-over-stats"]');
  await page.click('[data-testid="back-to-hub"]');
  
  // 4. Verify coins increased
  const newCoins = await page.locator('[data-testid="currency-display"]').textContent();
  expect(parseInt(newCoins!)).toBeGreaterThan(parseInt(initialCoins!));
  
  // 5. Check if level up occurred
  await expect(page.locator('[data-testid="user-profile"]')).toBeVisible();
});
```

---

## **3. 🎨 Theme System Testing (Priority 1)**

### **Theme Consistency Tests**
```typescript
// tests/e2e/theme-system.spec.ts
const GAMES_AND_THEMES = [
  { gameId: 'runner', themeName: 'Neon Sprint', primaryColor: '#00FFFF' },
  { gameId: 'snake', themeName: 'Retro Arcade', primaryColor: '#00FF00' },
  { gameId: 'puzzle', themeName: 'Neon Grid', primaryColor: '#FF1493' },
  { gameId: 'space', themeName: 'Cosmic Command', primaryColor: '#00AAFF' },
  { gameId: 'memory', themeName: 'Elegant Cards', primaryColor: '#800020' },
];

GAMES_AND_THEMES.forEach(({ gameId, themeName, primaryColor }) => {
  test(`${gameId} game applies ${themeName} theme correctly`, async ({ page }) => {
    await page.goto('/');
    
    // 1. Select game
    await page.click(`[data-testid="game-card-${gameId}"]`);
    
    // 2. Verify theme is applied to canvas
    const canvas = page.locator('[data-testid="themed-game-canvas"]');
    await expect(canvas).toHaveCSS('--theme-primary', primaryColor);
    
    // 3. Verify fonts are loaded
    const gameTitle = page.locator('[data-testid="game-title"]');
    const fontFamily = await gameTitle.evaluate(el => 
      getComputedStyle(el).fontFamily
    );
    expect(fontFamily).toBeTruthy();
    
    // 4. Verify theme effects
    if (themeName.includes('Neon')) {
      await expect(page.locator('[data-testid="glow-effects"]')).toBeVisible();
    }
  });
});
```

---

## **4. 📱 Responsive & Mobile Testing (Priority 2)**

### **Mobile Navigation Tests**
```typescript
// tests/e2e/mobile.spec.ts
test.describe('Mobile Experience', () => {
  test.use({ viewport: { width: 390, height: 844 } }); // iPhone 12
  
  test('mobile navigation works correctly', async ({ page }) => {
    await page.goto('/');
    
    // 1. Mobile tab bar should be visible
    await expect(page.locator('[data-testid="mobile-tab-bar"]')).toBeVisible();
    
    // 2. Desktop floating command center should be hidden
    await expect(page.locator('[data-testid="floating-command-center"]')).toBeHidden();
    
    // 3. Tab navigation works
    await page.click('[data-testid="mobile-tab-challenges"]');
    await expect(page.locator('[data-testid="challenges-content"]')).toBeVisible();
    
    // 4. Games are playable on mobile
    await page.click('[data-testid="mobile-tab-games"]');
    await page.click('[data-testid="game-card-snake"]'); // Good for mobile
    await expect(page.locator('[data-testid="game-canvas"]')).toBeVisible();
  });
});
```

---

## **5. 🔊 Audio System Testing (Priority 2)**

### **Audio Integration Tests**
```typescript
// tests/e2e/audio.spec.ts
test('audio system works correctly', async ({ page, context }) => {
  // Grant audio permissions
  await context.grantPermissions(['audio']);
  
  await page.goto('/');
  
  // 1. Audio settings modal
  await page.click('[data-testid="audio-settings-button"]');
  await expect(page.locator('[data-testid="audio-settings-modal"]')).toBeVisible();
  
  // 2. Volume controls work
  const volumeSlider = page.locator('[data-testid="master-volume-slider"]');
  await volumeSlider.fill('0.5');
  
  // 3. Sound effect test buttons work
  await page.click('[data-testid="test-coin-sound"]');
  // Note: Cannot easily test actual audio in E2E, but can test UI interactions
  
  // 4. Mute functionality
  await page.click('[data-testid="mute-toggle"]');
  await expect(page.locator('[data-testid="mute-indicator"]')).toBeVisible();
  
  await page.click('[data-testid="audio-settings-close"]');
});
```

---

## **6. 🏆 Achievement & Challenge System (Priority 2)**

### **Achievement Flow Tests**
```typescript
// tests/e2e/achievements.spec.ts
test('achievement system triggers correctly', async ({ page }) => {
  await page.goto('/');
  
  // 1. Navigate to achievements tab
  await page.click('[data-testid="tab-achievements"]');
  const initialAchievements = await page.locator('[data-testid="achievement-item"]').count();
  
  // 2. Play game to trigger achievement
  await page.click('[data-testid="tab-games"]');
  await page.click('[data-testid="game-card-runner"]');
  
  // First jump achievement
  await page.keyboard.press('Space');
  
  // 3. Check for achievement notification
  await expect(page.locator('[data-testid="achievement-notification"]')).toBeVisible();
  await expect(page.locator('[data-testid="achievement-title"]')).toContainText('Taking Flight');
  
  // 4. Return to achievements tab
  await page.click('[data-testid="back-to-hub"]');
  await page.click('[data-testid="tab-achievements"]');
  
  // 5. Verify achievement is now unlocked
  const newAchievements = await page.locator('[data-testid="achievement-item"]').count();
  expect(newAchievements).toBeGreaterThan(initialAchievements);
});
```

---

## **7. ⚡ Performance & Accessibility Testing (Priority 3)**

### **Performance Tests with Lighthouse**
```typescript
// tests/e2e/performance.spec.ts
import { test, expect } from '@playwright/test';

test('performance benchmarks', async ({ page }) => {
  await page.goto('/');
  
  // Run Lighthouse audit
  const lighthouse = await page.lighthouse({
    thresholds: {
      performance: 80,
      accessibility: 90,
      'best-practices': 80,
      seo: 70,
    },
  });
  
  expect(lighthouse.scores.performance).toBeGreaterThan(0.8);
  expect(lighthouse.scores.accessibility).toBeGreaterThan(0.9);
});
```

### **Accessibility Tests**
```typescript
// tests/e2e/accessibility.spec.ts
test('accessibility compliance', async ({ page }) => {
  await page.goto('/');
  
  // 1. Keyboard navigation works
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter'); // Should activate focused element
  
  // 2. Screen reader support
  const gameCards = page.locator('[data-testid="game-card"]');
  const firstCard = gameCards.first();
  
  await expect(firstCard).toHaveAttribute('aria-label');
  await expect(firstCard).toHaveAttribute('role', 'button');
  
  // 3. Color contrast (automated with axe-core)
  // This would be integrated with @axe-core/playwright
});
```

---

## **8. 🔄 State Persistence Testing (Priority 2)**

### **Data Persistence Tests**
```typescript
// tests/e2e/persistence.spec.ts
test('user data persists across sessions', async ({ page, context }) => {
  await page.goto('/');
  
  // 1. Play game and earn coins
  await page.click('[data-testid="game-card-runner"]');
  // ... simulate gameplay
  await page.click('[data-testid="back-to-hub"]');
  
  const coins = await page.locator('[data-testid="currency-display"]').textContent();
  const level = await page.locator('[data-testid="user-level"]').textContent();
  
  // 2. Reload page
  await page.reload();
  
  // 3. Verify data persisted
  await expect(page.locator('[data-testid="currency-display"]')).toContainText(coins!);
  await expect(page.locator('[data-testid="user-level"]')).toContainText(level!);
  
  // 4. Test with new browser context (simulates new user)
  const newContext = await context.browser()!.newContext();
  const newPage = await newContext.newPage();
  await newPage.goto('/');
  
  // Should have default state
  await expect(newPage.locator('[data-testid="currency-display"]')).toContainText('0');
  await expect(newPage.locator('[data-testid="user-level"]')).toContainText('Level 1');
});
```

---

## **9. 📊 Test Implementation Priorities**

### **Phase 1 (Immediate)** - Core Functionality
- [x] Unit test coverage for services (✅ Completed)
- [ ] Basic E2E setup with Playwright
- [ ] Game selection and theme testing
- [ ] Currency/progression system

### **Phase 2 (Short-term)** - Enhanced Features  
- [ ] Audio system integration tests
- [ ] Achievement/challenge flows
- [ ] Mobile responsiveness
- [ ] Cross-browser compatibility

### **Phase 3 (Long-term)** - Quality & Performance
- [ ] Performance benchmarks
- [ ] Accessibility compliance
- [ ] Visual regression testing
- [ ] Load testing for multiple simultaneous games

---

## **10. 🛠️ Test Infrastructure**

### **Data-testid Strategy**
```typescript
// Consistent naming convention
'data-testid="<component>-<element>-<identifier>"'

// Examples:
'data-testid="game-card-runner"'
'data-testid="theme-preview-overlay"'
'data-testid="currency-display-amount"'
'data-testid="user-profile-avatar"'
'data-testid="achievement-notification-title"'
```

### **Test Environment Setup**
```bash
# Install Playwright
npm install --save-dev @playwright/test

# Install accessibility testing
npm install --save-dev @axe-core/playwright

# Performance testing
npm install --save-dev lighthouse-ci

# Visual regression testing
npm install --save-dev @playwright/test percy-cli
```

### **CI/CD Integration**
```yaml
# .github/workflows/e2e.yml
name: E2E Tests
on: [push, pull_request]
jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx playwright install
      - run: npm run build
      - run: npx playwright test
      - uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

---

## **✅ Success Metrics**

### **Coverage Goals**
- **E2E Test Coverage**: 80% of critical user journeys
- **Cross-browser Support**: Chrome, Firefox, Safari
- **Mobile Coverage**: iOS Safari, Android Chrome
- **Performance**: LCP < 2.5s, FID < 100ms
- **Accessibility**: WCAG 2.1 AA compliance

### **Quality Gates**
- All E2E tests must pass before deployment
- Performance regression tests
- Visual regression detection
- Accessibility audit compliance

This comprehensive E2E testing plan ensures the HacktivateNations Arcade delivers a robust, accessible, and performant gaming experience across all platforms and user scenarios.