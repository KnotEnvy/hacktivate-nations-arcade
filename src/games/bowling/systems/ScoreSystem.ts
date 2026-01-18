// ===== src/games/bowling/systems/ScoreSystem.ts =====
// 10-frame bowling scoring system

export interface FrameScore {
  roll1: number | null;      // First roll pins knocked
  roll2: number | null;      // Second roll pins knocked
  roll3: number | null;      // Third roll (10th frame only)
  isStrike: boolean;
  isSpare: boolean;
  cumulativeScore: number | null;  // Running total (null if not yet calculable)
}

export interface ScoreResult {
  pinsKnocked: number;
  isStrike: boolean;
  isSpare: boolean;
  isSplit: boolean;
  isGutter: boolean;
  frameComplete: boolean;
  gameComplete: boolean;
  bonusMessage: string | null;
}

export class ScoreSystem {
  private frames: FrameScore[] = [];
  private currentFrame: number = 0;
  private currentRoll: number = 0;  // 0 = first roll, 1 = second, 2 = third (10th only)
  private standingPins: boolean[] = []; // Track which pins are standing

  // Combo tracking
  private consecutiveStrikes: number = 0;
  private cleanFrames: number = 0; // Strikes or spares

  constructor() {
    this.reset();
  }

  reset(): void {
    this.frames = [];
    for (let i = 0; i < 10; i++) {
      this.frames.push({
        roll1: null,
        roll2: null,
        roll3: null,
        isStrike: false,
        isSpare: false,
        cumulativeScore: null
      });
    }
    this.currentFrame = 0;
    this.currentRoll = 0;
    this.standingPins = new Array(10).fill(true);
    this.consecutiveStrikes = 0;
    this.cleanFrames = 0;
  }

  // Get standing pins for current roll
  getStandingPins(): boolean[] {
    return [...this.standingPins];
  }

  // Record a roll result
  recordRoll(knockedPins: boolean[]): ScoreResult {
    const pinsKnocked = knockedPins.filter(k => k).length;
    const previousStanding = this.standingPins.filter(s => s).length;
    const newlyKnocked = previousStanding - (10 - pinsKnocked);

    const frame = this.frames[this.currentFrame];
    const is10thFrame = this.currentFrame === 9;

    let isStrike = false;
    let isSpare = false;
    let isSplit = false;
    let isGutter = pinsKnocked === 0 && this.currentRoll === 0;
    let frameComplete = false;
    let gameComplete = false;
    let bonusMessage: string | null = null;

    // Update standing pins
    this.standingPins = knockedPins.map((knocked, i) => !knocked && this.standingPins[i]);

    if (this.currentRoll === 0) {
      // First roll
      frame.roll1 = newlyKnocked;

      if (newlyKnocked === 10) {
        // STRIKE!
        isStrike = true;
        frame.isStrike = true;
        this.consecutiveStrikes++;
        this.cleanFrames++;

        // Check for special combos
        if (this.consecutiveStrikes === 3) {
          bonusMessage = 'TURKEY!';
        } else if (this.consecutiveStrikes === 4) {
          bonusMessage = 'FOUR-BAGGER!';
        } else if (this.consecutiveStrikes === 5) {
          bonusMessage = 'FIVE-BAGGER!';
        } else if (this.consecutiveStrikes >= 6) {
          bonusMessage = 'ON FIRE!';
        }

        if (is10thFrame) {
          // Reset pins for next roll in 10th frame
          this.standingPins = new Array(10).fill(true);
          this.currentRoll = 1;
        } else {
          frameComplete = true;
        }
      } else {
        // Check for split (head pin down, gap between remaining pins)
        isSplit = this.checkForSplit();
        this.currentRoll = 1;
        this.consecutiveStrikes = 0;
      }
    } else if (this.currentRoll === 1) {
      // Second roll
      frame.roll2 = newlyKnocked;

      const totalFirstTwo = (frame.roll1 || 0) + newlyKnocked;

      if (is10thFrame) {
        if (frame.isStrike) {
          // After strike in 10th, check if this roll is also a strike
          if (newlyKnocked === 10) {
            isStrike = true;
            this.consecutiveStrikes++;
            if (this.consecutiveStrikes >= 3) {
              bonusMessage = this.consecutiveStrikes === 3 ? 'TURKEY!' : 'AMAZING!';
            }
          }
          // Reset pins for third roll
          this.standingPins = new Array(10).fill(true);
          this.currentRoll = 2;
        } else if (totalFirstTwo === 10) {
          // Spare in 10th frame
          isSpare = true;
          frame.isSpare = true;
          this.cleanFrames++;
          this.consecutiveStrikes = 0;
          // Reset pins for third roll
          this.standingPins = new Array(10).fill(true);
          this.currentRoll = 2;
        } else {
          // Open frame in 10th - game over
          frameComplete = true;
          gameComplete = true;
        }
      } else {
        if (totalFirstTwo === 10) {
          // SPARE!
          isSpare = true;
          frame.isSpare = true;
          this.cleanFrames++;
          bonusMessage = 'SPARE!';
        }
        this.consecutiveStrikes = 0;
        frameComplete = true;
      }
    } else if (this.currentRoll === 2 && is10thFrame) {
      // Third roll (10th frame only)
      frame.roll3 = newlyKnocked;

      if (newlyKnocked === 10) {
        isStrike = true;
        this.consecutiveStrikes++;
      }

      frameComplete = true;
      gameComplete = true;

      // Check for perfect game
      if (this.consecutiveStrikes >= 12) {
        bonusMessage = 'PERFECT GAME!!!';
      }
    }

    // Move to next frame if complete
    if (frameComplete && !gameComplete) {
      this.currentFrame++;
      this.currentRoll = 0;
      this.standingPins = new Array(10).fill(true);

      if (this.currentFrame >= 10) {
        gameComplete = true;
      }
    }

    // Recalculate scores
    this.calculateScores();

    return {
      pinsKnocked: newlyKnocked,
      isStrike,
      isSpare,
      isSplit,
      isGutter,
      frameComplete,
      gameComplete,
      bonusMessage
    };
  }

  // Check if current pin configuration is a split
  private checkForSplit(): boolean {
    // Split: head pin (pin 1) is down, and remaining pins have a gap
    if (this.standingPins[0]) return false; // Head pin still standing

    const standing = this.standingPins
      .map((s, i) => s ? i : -1)
      .filter(i => i >= 0);

    if (standing.length < 2) return false;

    // Check for gaps (simplified - just check if non-adjacent pins remain)
    // Pin adjacency map
    const adjacent: { [key: number]: number[] } = {
      1: [2, 3],
      2: [1, 4, 5],
      3: [1, 5, 6],
      4: [2, 7, 8],
      5: [2, 3, 8, 9],
      6: [3, 9, 10],
      7: [4, 8],
      8: [4, 5, 7, 9],
      9: [5, 6, 8, 10],
      10: [6, 9]
    };

    // Check if any two standing pins are non-adjacent
    for (let i = 0; i < standing.length; i++) {
      for (let j = i + 1; j < standing.length; j++) {
        const pinA = standing[i] + 1; // Convert to 1-based
        const pinB = standing[j] + 1;
        if (!adjacent[pinA]?.includes(pinB)) {
          return true; // Found non-adjacent pins = split
        }
      }
    }

    return false;
  }

  // Calculate cumulative scores
  private calculateScores(): void {
    let runningTotal = 0;

    for (let i = 0; i < 10; i++) {
      const frame = this.frames[i];

      if (frame.roll1 === null) {
        frame.cumulativeScore = null;
        continue;
      }

      if (i < 9) {
        // Frames 1-9
        if (frame.isStrike) {
          // Strike: need next two rolls
          const next = this.getNextTwoRolls(i);
          if (next !== null) {
            runningTotal += 10 + next;
            frame.cumulativeScore = runningTotal;
          } else {
            frame.cumulativeScore = null;
          }
        } else if (frame.isSpare) {
          // Spare: need next one roll
          const next = this.getNextRoll(i);
          if (next !== null) {
            runningTotal += 10 + next;
            frame.cumulativeScore = runningTotal;
          } else {
            frame.cumulativeScore = null;
          }
        } else if (frame.roll2 !== null) {
          // Open frame
          runningTotal += (frame.roll1 || 0) + (frame.roll2 || 0);
          frame.cumulativeScore = runningTotal;
        } else {
          frame.cumulativeScore = null;
        }
      } else {
        // 10th frame
        const r1 = frame.roll1 || 0;
        const r2 = frame.roll2 || 0;
        const r3 = frame.roll3 || 0;

        if (frame.isStrike || frame.isSpare) {
          // Need all three rolls
          if (frame.roll3 !== null) {
            runningTotal += r1 + r2 + r3;
            frame.cumulativeScore = runningTotal;
          } else {
            frame.cumulativeScore = null;
          }
        } else if (frame.roll2 !== null) {
          runningTotal += r1 + r2;
          frame.cumulativeScore = runningTotal;
        } else {
          frame.cumulativeScore = null;
        }
      }
    }
  }

  private getNextRoll(frameIndex: number): number | null {
    const nextFrame = this.frames[frameIndex + 1];
    if (!nextFrame || nextFrame.roll1 === null) return null;
    return nextFrame.roll1;
  }

  private getNextTwoRolls(frameIndex: number): number | null {
    const nextFrame = this.frames[frameIndex + 1];
    if (!nextFrame || nextFrame.roll1 === null) return null;

    if (nextFrame.isStrike && frameIndex + 1 < 9) {
      // Next frame is a strike, need the frame after
      const frameAfter = this.frames[frameIndex + 2];
      if (!frameAfter || frameAfter.roll1 === null) return null;
      return 10 + frameAfter.roll1;
    } else if (nextFrame.isStrike && frameIndex + 1 === 9) {
      // 10th frame strike
      if (nextFrame.roll2 === null) return null;
      return 10 + nextFrame.roll2;
    } else {
      if (nextFrame.roll2 === null) return null;
      return nextFrame.roll1 + nextFrame.roll2;
    }
  }

  // Getters
  getFrames(): FrameScore[] {
    return this.frames;
  }

  getCurrentFrame(): number {
    return this.currentFrame;
  }

  getCurrentRoll(): number {
    return this.currentRoll;
  }

  getTotalScore(): number {
    let total = 0;
    for (const frame of this.frames) {
      if (frame.cumulativeScore !== null) {
        total = frame.cumulativeScore;
      }
    }
    return total;
  }

  getConsecutiveStrikes(): number {
    return this.consecutiveStrikes;
  }

  getCleanFrames(): number {
    return this.cleanFrames;
  }

  isGameComplete(): boolean {
    return this.currentFrame >= 10 ||
           (this.currentFrame === 9 &&
            this.frames[9].roll2 !== null &&
            !this.frames[9].isStrike &&
            !this.frames[9].isSpare);
  }
}
