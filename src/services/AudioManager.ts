// ===== src/services/AudioManager.ts =====
export interface AudioOptions {
  volume?: number;
  loop?: boolean;
  fade?: boolean;
}

export class AudioManager {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sounds: Map<string, AudioBuffer> = new Map();
  private playing: Map<string, AudioBufferSourceNode> = new Map();

  async init(): Promise<void> {
    try {
      this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.context.createGain();
      this.masterGain.connect(this.context.destination);
      
      // Resume context on user interaction (Chrome requirement)
      if (this.context.state === 'suspended') {
        document.addEventListener('click', this.resumeContext.bind(this), { once: true });
        document.addEventListener('touchstart', this.resumeContext.bind(this), { once: true });
      }
    } catch (error) {
      console.warn('AudioManager: Web Audio not supported', error);
    }
  }

  private async resumeContext(): Promise<void> {
    if (this.context?.state === 'suspended') {
      await this.context.resume();
    }
  }

  async loadSound(name: string, url: string): Promise<void> {
    if (!this.context) return;

    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
      this.sounds.set(name, audioBuffer);
    } catch (error) {
      console.warn(`AudioManager: Failed to load sound ${name}`, error);
    }
  }

  playSound(name: string, options: AudioOptions = {}): void {
    if (!this.context || !this.masterGain) return;

    const buffer = this.sounds.get(name);
    if (!buffer) {
      console.warn(`AudioManager: Sound ${name} not found`);
      return;
    }

    const source = this.context.createBufferSource();
    const gainNode = this.context.createGain();
    
    source.buffer = buffer;
    source.loop = options.loop || false;
    gainNode.gain.value = options.volume || 1.0;

    source.connect(gainNode);
    gainNode.connect(this.masterGain);

    if (options.loop) {
      this.playing.set(name, source);
    }

    source.start();
  }

  stopSound(name: string): void {
    const source = this.playing.get(name);
    if (source) {
      source.stop();
      this.playing.delete(name);
    }
  }

  setMasterVolume(volume: number): void {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  getMasterVolume(): number {
    return this.masterGain?.gain.value || 0;
  }
}
