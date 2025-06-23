// ===== src/services/AudioManager.ts (FIXED) =====
export interface AudioOptions {
  volume?: number;
  loop?: boolean;
  fade?: boolean;
}

export class AudioManager {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private sounds: Map<string, AudioBuffer> = new Map();
  private playing: Map<string, AudioBufferSourceNode> = new Map();
  
  private masterVolume: number = 1.0;
  private sfxVolume: number = 1.0;
  private isInitialized: boolean = false;

  async init(): Promise<void> {
    try {
      // Create audio context
      this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Create gain nodes
      this.masterGain = this.context.createGain();
      this.sfxGain = this.context.createGain();
      
      // Connect gain nodes
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.context.destination);
      
      // Set initial volumes
      this.masterGain.gain.value = this.masterVolume;
      this.sfxGain.gain.value = this.sfxVolume;
      
      // Handle browser audio policy
      if (this.context.state === 'suspended') {
        const resumeAudio = () => {
          this.context?.resume().then(() => {
            if (!this.isInitialized) {
              this.generateSounds();
            }
          });
          document.removeEventListener('click', resumeAudio);
          document.removeEventListener('touchstart', resumeAudio);
          document.removeEventListener('keydown', resumeAudio);
        };
        
        document.addEventListener('click', resumeAudio, { once: true });
        document.addEventListener('touchstart', resumeAudio, { once: true });
        document.addEventListener('keydown', resumeAudio, { once: true });
      } else {
        // Context is ready, generate sounds immediately
        this.generateSounds();
      }
      
      console.log('🔊 AudioManager initialized');
    } catch (error) {
      console.warn('🔇 AudioManager initialization failed:', error);
    }
  }

  private generateSounds(): void {
    if (!this.context || this.isInitialized) return;
    
    try {
      // Generate all the sounds the games expect
      this.sounds.set('jump', this.generateJumpSound());
      this.sounds.set('coin', this.generateCoinSound());
      this.sounds.set('collision', this.generateCollisionSound());
      this.sounds.set('game_over', this.generateGameOverSound());
      this.sounds.set('powerup', this.generatePowerupSound());
      this.sounds.set('click', this.generateClickSound());
      this.sounds.set('unlock', this.generateUnlockSound());
      this.sounds.set('success', this.generateSuccessSound());
      
      this.isInitialized = true;
      console.log('🎵 Generated procedural sounds:', Array.from(this.sounds.keys()));
    } catch (error) {
      console.warn('Failed to generate sounds:', error);
    }
  }

  // Generate jump sound - quick rising pitch
  private generateJumpSound(): AudioBuffer {
    if (!this.context) throw new Error('No audio context');
    
    const duration = 0.2;
    const sampleRate = this.context.sampleRate;
    const buffer = this.context.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const frequency = 200 + (400 * Math.exp(-t * 8)); // Rising then falling
      const envelope = Math.exp(-t * 10); // Quick decay
      data[i] = Math.sin(2 * Math.PI * frequency * t) * envelope * 0.3;
    }
    
    return buffer;
  }

  // Generate coin sound - bright chime
  private generateCoinSound(): AudioBuffer {
    if (!this.context) throw new Error('No audio context');
    
    const duration = 0.3;
    const sampleRate = this.context.sampleRate;
    const buffer = this.context.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const frequency = 800 + (400 * Math.sin(t * 30)); // Vibrato effect
      const envelope = Math.exp(-t * 6);
      data[i] = Math.sin(2 * Math.PI * frequency * t) * envelope * 0.4;
    }
    
    return buffer;
  }

  // Generate collision sound - harsh impact
  private generateCollisionSound(): AudioBuffer {
    if (!this.context) throw new Error('No audio context');
    
    const duration = 0.4;
    const sampleRate = this.context.sampleRate;
    const buffer = this.context.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const frequency = 100 + (50 * Math.exp(-t * 5)); // Low rumble
      const noise = (Math.random() * 2 - 1) * 0.3; // Add noise
      const envelope = Math.exp(-t * 5);
      const tone = Math.sin(2 * Math.PI * frequency * t) * 0.7;
      data[i] = (tone + noise) * envelope * 0.6;
    }
    
    return buffer;
  }

  // Generate game over sound - descending sad tone
  private generateGameOverSound(): AudioBuffer {
    if (!this.context) throw new Error('No audio context');
    
    const duration = 1.0;
    const sampleRate = this.context.sampleRate;
    const buffer = this.context.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const frequency = 300 - (150 * t); // Descending
      const envelope = Math.exp(-t * 2);
      data[i] = Math.sin(2 * Math.PI * frequency * t) * envelope * 0.5;
    }
    
    return buffer;
  }

  // Generate powerup sound - ascending magical
  private generatePowerupSound(): AudioBuffer {
    if (!this.context) throw new Error('No audio context');
    
    const duration = 0.5;
    const sampleRate = this.context.sampleRate;
    const buffer = this.context.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const frequency = 400 + (800 * t); // Rising
      const envelope = Math.sin(t * Math.PI); // Bell curve
      data[i] = Math.sin(2 * Math.PI * frequency * t) * envelope * 0.5;
    }
    
    return buffer;
  }

  // Generate click sound - short noise burst
  private generateClickSound(): AudioBuffer {
    if (!this.context) throw new Error('No audio context');
    
    const duration = 0.1;
    const sampleRate = this.context.sampleRate;
    const buffer = this.context.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const envelope = Math.exp(-t * 50);
      data[i] = (Math.random() * 2 - 1) * envelope * 0.2;
    }
    
    return buffer;
  }

  // Generate unlock sound - triumphant fanfare
  private generateUnlockSound(): AudioBuffer {
    if (!this.context) throw new Error('No audio context');
    
    const duration = 0.8;
    const sampleRate = this.context.sampleRate;
    const buffer = this.context.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const frequency = 440 * Math.pow(2, t * 2); // Rising major scale
      const envelope = Math.sin(t * Math.PI * 3) * Math.exp(-t * 2);
      data[i] = Math.sin(2 * Math.PI * frequency * t) * envelope * 0.4;
    }
    
    return buffer;
  }

  // Generate success sound - pleasant chord
  private generateSuccessSound(): AudioBuffer {
    if (!this.context) throw new Error('No audio context');
    
    const duration = 0.6;
    const sampleRate = this.context.sampleRate;
    const buffer = this.context.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);
    
    // Major chord: C, E, G
    const frequencies = [261.63, 329.63, 392.00];
    
    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const envelope = Math.exp(-t * 3);
      let sample = 0;
      
      // Mix the chord frequencies
      for (const freq of frequencies) {
        sample += Math.sin(2 * Math.PI * freq * t) * 0.33;
      }
      
      data[i] = sample * envelope * 0.5;
    }
    
    return buffer;
  }

  // Main playSound method - this is what games call
  playSound(name: string, options: AudioOptions = {}): void {
    if (!this.context || !this.masterGain) {
      console.warn(`AudioManager: Context not ready for sound ${name}`);
      return;
    }

    // If sounds aren't generated yet, try to generate them
    if (!this.isInitialized) {
      this.generateSounds();
    }

    const buffer = this.sounds.get(name);
    if (!buffer) {
      console.warn(`AudioManager: Sound "${name}" not found. Available: ${Array.from(this.sounds.keys()).join(', ')}`);
      return;
    }

    try {
      const source = this.context.createBufferSource();
      const gainNode = this.context.createGain();
      
      source.buffer = buffer;
      source.loop = options.loop || false;
      gainNode.gain.value = (options.volume || 1.0);
      
      source.connect(gainNode);
      gainNode.connect(this.sfxGain);
      
      if (options.loop) {
        this.playing.set(name, source);
      }
      
      source.start();
      
      // Auto-cleanup for non-looping sounds
      if (!options.loop) {
        source.onended = () => {
          source.disconnect();
          gainNode.disconnect();
        };
      }
    } catch (error) {
      console.warn(`AudioManager: Failed to play sound "${name}":`, error);
    }
  }

  // Keep existing methods for compatibility
  async loadSound(name: string, url: string): Promise<void> {
    if (!this.context) return;

    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
      this.sounds.set(name, audioBuffer);
      console.log(`🎵 Loaded external sound: ${name}`);
    } catch (error) {
      console.warn(`AudioManager: Failed to load sound ${name} from ${url}:`, error);
    }
  }

  stopSound(name: string): void {
    const source = this.playing.get(name);
    if (source) {
      try {
        source.stop();
      } catch (error) {
        // Source might already be stopped
      }
      this.playing.delete(name);
    }
  }

  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    if (this.masterGain) {
      this.masterGain.gain.value = this.masterVolume;
    }
  }

  setSfxVolume(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
    if (this.sfxGain) {
      this.sfxGain.gain.value = this.sfxVolume;
    }
  }

  getMasterVolume(): number {
    return this.masterVolume;
  }

  getSfxVolume(): number {
    return this.sfxVolume;
  }

  // Add method to manually trigger sound generation (useful for debugging)
  regenerateSounds(): void {
    if (this.context) {
      this.isInitialized = false;
      this.sounds.clear();
      this.generateSounds();
    }
  }

  // Get list of available sounds (useful for debugging)
  getAvailableSounds(): string[] {
    return Array.from(this.sounds.keys());
  }
}