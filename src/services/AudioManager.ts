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
  private musicGain: GainNode | null = null;
  private sounds: Map<string, AudioBuffer> = new Map();
  private playing: Map<string, AudioBufferSourceNode> = new Map();
  private currentMusic: AudioBufferSourceNode | null = null;
  private currentMusicName: string | null = null;
  
  private masterVolume: number = 0.7;
  private sfxVolume: number = 1.0;
  private musicVolume: number = 0.4;
  private isInitialized: boolean = false;
  private isMuted: boolean = false;

  async init(): Promise<void> {
    try {
      // Create audio context
      this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Create gain nodes
      this.masterGain = this.context.createGain();
      this.sfxGain = this.context.createGain();
      this.musicGain = this.context.createGain();
      
      // Connect gain nodes
      this.sfxGain.connect(this.masterGain);
      this.musicGain.connect(this.masterGain);
      this.masterGain.connect(this.context.destination);
      
      // Set initial volumes
      this.masterGain.gain.value = this.masterVolume;
      this.sfxGain.gain.value = this.sfxVolume;
      this.musicGain.gain.value = this.musicVolume;
      
      // Load saved volume preferences
      this.loadVolumePreferences();
      
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
      
      // Generate background music tracks
      this.sounds.set('hub_music', this.generateHubMusic());
      this.sounds.set('game_music', this.generateGameMusic());
      
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

  // Generate powerup sound - magical orchestral ascension
  private generatePowerupSound(): AudioBuffer {
    if (!this.context) throw new Error('No audio context');
    
    const duration = 0.7;
    const sampleRate = this.context.sampleRate;
    const buffer = this.context.createBuffer(2, sampleRate * duration, sampleRate);
    const leftData = buffer.getChannelData(0);
    const rightData = buffer.getChannelData(1);
    
    // Ascending magical scale: C - E - G - C - E (pentatonic rise)
    const magicalScale = [
      261.63, // C4
      329.63, // E4
      392.00, // G4
      523.25, // C5
      659.25  // E5
    ];
    
    for (let i = 0; i < leftData.length; i++) {
      const t = i / sampleRate;
      const scaleProgress = Math.min(4, t * 7); // Move through scale
      const noteIndex = Math.floor(scaleProgress);
      const noteBlend = scaleProgress % 1;
      
      // Current and next note for smooth gliding
      const currentFreq = magicalScale[noteIndex];
      const nextFreq = magicalScale[Math.min(4, noteIndex + 1)];
      const glideFreq = currentFreq + (nextFreq - currentFreq) * noteBlend;
      
      let sample = 0;
      
      // Harp-like arpeggiation
      const harpEnvelope = Math.sin(t * Math.PI) * Math.exp(-t * 2);
      sample += Math.sin(2 * Math.PI * glideFreq * t) * harpEnvelope * 0.4;
      sample += Math.sin(2 * Math.PI * glideFreq * 2 * t) * harpEnvelope * 0.2; // Octave
      
      // Celesta sparkle (high bells)
      const celestaFreq = glideFreq * 4;
      const celestaEnvelope = Math.exp(-t * 5) * Math.sin(t * Math.PI * 1.5);
      sample += Math.sin(2 * Math.PI * celestaFreq * t) * celestaEnvelope * 0.25;
      
      // String section sustain
      const stringFreq = glideFreq * 0.5;
      const stringEnvelope = Math.sin(t * Math.PI) * 0.8;
      const stringVibrato = 1 + Math.sin(t * 12) * 0.01;
      sample += Math.sin(2 * Math.PI * stringFreq * stringVibrato * t) * stringEnvelope * 0.3;
      
      // Flute doubling for ethereal quality
      const fluteFreq = glideFreq * 1.5;
      const fluteEnvelope = Math.sin(t * Math.PI) * (0.7 + 0.3 * Math.cos(t * 8));
      sample += Math.sin(2 * Math.PI * fluteFreq * t + Math.sin(t * 4) * 0.05) * fluteEnvelope * 0.2;
      
      // Magical shimmer effect
      const shimmerFreq = glideFreq * 3;
      const shimmerEnvelope = Math.exp(-t * 3) * Math.sin(t * 15) * 0.5;
      sample += Math.sin(2 * Math.PI * shimmerFreq * t) * shimmerEnvelope * 0.15;
      
      leftData[i] = sample * 0.6;
      rightData[i] = sample * 0.58; // Slight stereo spread
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

  // Generate unlock sound - majestic orchestral fanfare
  private generateUnlockSound(): AudioBuffer {
    if (!this.context) throw new Error('No audio context');
    
    const duration = 1.2;
    const sampleRate = this.context.sampleRate;
    const buffer = this.context.createBuffer(2, sampleRate * duration, sampleRate);
    const leftData = buffer.getChannelData(0);
    const rightData = buffer.getChannelData(1);
    
    // Triumphant fanfare progression: C - F - G - C (I - IV - V - I)
    const fanfareNotes = [
      261.63, // C4
      329.63, // E4  
      392.00, // G4
      523.25  // C5
    ];
    
    for (let i = 0; i < leftData.length; i++) {
      const t = i / sampleRate;
      const noteIndex = Math.min(3, Math.floor(t * 4)); // 4 notes over duration
      const noteTime = (t * 4) % 1;
      
      let sample = 0;
      
      // Brass fanfare - Trumpets in harmony
      const trumpetFreq = fanfareNotes[noteIndex];
      const trumpetEnvelope = Math.exp(-noteTime * 3) * (0.6 + 0.3 * Math.sin(t * 12));
      sample += Math.sin(2 * Math.PI * trumpetFreq * t) * trumpetEnvelope * 0.4;
      sample += Math.sin(2 * Math.PI * trumpetFreq * 1.5 * t) * trumpetEnvelope * 0.3; // Harmonic
      
      // French Horn doubling
      const hornFreq = trumpetFreq * 0.75;
      const hornEnvelope = Math.exp(-noteTime * 2.5) * (0.7 + 0.2 * Math.cos(t * 8));
      sample += Math.sin(2 * Math.PI * hornFreq * t + Math.sin(t * 0.5) * 0.1) * hornEnvelope * 0.3;
      
      // Timpani roll underneath
      const timpaniFreq = 65.41; // C2
      const rollIntensity = 0.4 * Math.exp(-t * 2) * (Math.random() * 0.4 + 0.6);
      sample += Math.sin(2 * Math.PI * timpaniFreq * t) * rollIntensity;
      
      // Bell-like chimes for sparkle
      const chimeFreq = trumpetFreq * 2;
      const chimeEnvelope = Math.exp(-t * 4) * Math.sin(noteTime * Math.PI);
      sample += Math.sin(2 * Math.PI * chimeFreq * t) * chimeEnvelope * 0.2;
      
      leftData[i] = sample * 0.5;
      rightData[i] = sample * 0.48; // Slight stereo width
    }
    
    return buffer;
  }

  // Generate success sound - warm orchestral chord
  private generateSuccessSound(): AudioBuffer {
    if (!this.context) throw new Error('No audio context');
    
    const duration = 0.8;
    const sampleRate = this.context.sampleRate;
    const buffer = this.context.createBuffer(2, sampleRate * duration, sampleRate);
    const leftData = buffer.getChannelData(0);
    const rightData = buffer.getChannelData(1);
    
    // Rich major chord voicing: C major with extensions
    const chordVoicing = [
      130.81, // C3 (Bass)
      164.81, // E3 (Tenor)
      196.00, // G3 (Alto)
      261.63, // C4 (Soprano)
      329.63, // E4 (Extension)
      523.25  // C5 (Octave)
    ];
    
    for (let i = 0; i < leftData.length; i++) {
      const t = i / sampleRate;
      const envelope = Math.exp(-t * 4) * (0.8 + 0.2 * Math.sin(t * 8));
      let sample = 0;
      
      // String section - warm and full
      chordVoicing.forEach((freq, idx) => {
        const stringWeight = idx < 4 ? 0.25 : 0.15; // Emphasize lower voices
        const vibrato = 1 + Math.sin(t * 4.5 + idx) * 0.005; // Slight vibrato
        sample += Math.sin(2 * Math.PI * freq * vibrato * t) * stringWeight;
      });
      
      // Warm brass pad
      const brassRoot = 261.63;
      const brassThird = 329.63;
      const brassFifth = 392.00;
      const brassEnvelope = envelope * 0.3 * (0.9 + 0.1 * Math.cos(t * 6));
      
      sample += Math.sin(2 * Math.PI * brassRoot * t + Math.sin(t * 0.3) * 0.02) * brassEnvelope;
      sample += Math.sin(2 * Math.PI * brassThird * t + Math.cos(t * 0.4) * 0.02) * brassEnvelope;
      sample += Math.sin(2 * Math.PI * brassFifth * t + Math.sin(t * 0.5) * 0.02) * brassEnvelope;
      
      // High sparkle from flutes/violins
      const sparkleFreq = 1046.50; // C6
      const sparkleEnvelope = envelope * 0.2 * Math.sin(t * Math.PI * 2);
      sample += Math.sin(2 * Math.PI * sparkleFreq * t) * sparkleEnvelope;
      
      leftData[i] = sample * envelope * 0.4;
      rightData[i] = sample * envelope * 0.38; // Slight stereo separation
    }
    
    return buffer;
  }

  // Generate hub background music - symphonic and majestic
  private generateHubMusic(): AudioBuffer {
    if (!this.context) throw new Error('No audio context');
    
    const duration = 48; // Extended to 48 seconds for fuller development
    const sampleRate = this.context.sampleRate;
    const buffer = this.context.createBuffer(2, sampleRate * duration, sampleRate);
    const leftData = buffer.getChannelData(0);
    const rightData = buffer.getChannelData(1);
    
    // Classical chord progression in C major with voice leading
    // I - vi - IV - V - I - iii - vi - V7 - I (extended cadential progression)
    const chordProgression = [
      // Measure 1-2: I (C major)
      { root: 261.63, third: 329.63, fifth: 392.00, seventh: null },
      // Measure 3-4: vi (A minor) 
      { root: 220.00, third: 261.63, fifth: 329.63, seventh: null },
      // Measure 5-6: IV (F major)
      { root: 174.61, third: 220.00, fifth: 261.63, seventh: null },
      // Measure 7-8: V (G major) 
      { root: 196.00, third: 246.94, fifth: 293.66, seventh: null },
      // Measure 9-10: I (C major)
      { root: 261.63, third: 329.63, fifth: 392.00, seventh: null },
      // Measure 11-12: iii (E minor)
      { root: 164.81, third: 196.00, fifth: 246.94, seventh: null },
      // Measure 13-14: vi (A minor)
      { root: 220.00, third: 261.63, fifth: 329.63, seventh: null },
      // Measure 15-16: V7 (G dominant 7th)
      { root: 196.00, third: 246.94, fifth: 293.66, seventh: 369.99 }
    ];
    
    for (let i = 0; i < leftData.length; i++) {
      const t = i / sampleRate;
      const measureLength = 6; // 6 seconds per measure pair
      const chordIndex = Math.floor((t / measureLength) % chordProgression.length);
      const chordTime = (t % measureLength) / measureLength;
      
      const chord = chordProgression[chordIndex];
      
      // Orchestral envelope with natural breathing
      const phrasePosition = (t % (measureLength * 4)) / (measureLength * 4); // 4 measure phrases
      const breathingEnvelope = 0.7 + 0.3 * Math.sin(phrasePosition * Math.PI * 2);
      const dynamicSwells = 1 + 0.2 * Math.sin(t * 0.1) * Math.cos(t * 0.07);
      
      let sample = 0;
      
      // Bass Section (Cellos & Double Basses) - Root note in lower octave
      const bassFreq = chord.root * 0.5;
      const bassEnvelope = 0.4 * breathingEnvelope;
      sample += Math.sin(2 * Math.PI * bassFreq * t) * bassEnvelope;
      sample += Math.sin(2 * Math.PI * bassFreq * t + Math.PI/4) * bassEnvelope * 0.7; // Slight detuning
      
      // Viola Section (Middle voices) - Third and Fifth
      const violaThird = chord.third * 0.75; // Lower register
      const violaFifth = chord.fifth * 0.75;
      const violaEnvelope = 0.25 * breathingEnvelope * dynamicSwells;
      sample += Math.sin(2 * Math.PI * violaThird * t + Math.sin(t * 0.5) * 0.02) * violaEnvelope;
      sample += Math.sin(2 * Math.PI * violaFifth * t + Math.cos(t * 0.3) * 0.02) * violaEnvelope;
      
      // Violin Section (Melody line with embellishments)
      const violinRoot = chord.root;
      const violinThird = chord.third;
      const violinEnvelope = 0.3 * breathingEnvelope * dynamicSwells;
      
      // Lead melody with classical ornamentation
      const ornamentPhase = Math.sin(t * 3.7) * 0.05; // Grace notes and trills
      sample += Math.sin(2 * Math.PI * violinRoot * (1 + ornamentPhase) * t) * violinEnvelope;
      sample += Math.sin(2 * Math.PI * violinThird * (1 + ornamentPhase * 0.7) * t) * violinEnvelope * 0.8;
      
      // Horn Section (Warm brass harmony)
      if (chord.seventh) {
        const hornSeventh = chord.seventh * 0.6; // Mid register
        const hornEnvelope = 0.2 * breathingEnvelope;
        sample += Math.sin(2 * Math.PI * hornSeventh * t + Math.sin(t * 0.2) * 0.03) * hornEnvelope;
      }
      
      // Woodwind doubling (Flutes and Oboes) - High octave sparkle
      const fluteFreq = chord.root * 2;
      const fluteEnvelope = 0.15 * breathingEnvelope * (0.7 + 0.3 * Math.sin(t * 0.8));
      sample += Math.sin(2 * Math.PI * fluteFreq * t + Math.sin(t * 1.1) * 0.04) * fluteEnvelope;
      
      // Timpani on strong beats (every 3 seconds)
      const beatTime = t % 3;
      if (beatTime < 0.1) {
        const timpaniFreq = chord.root * 0.25; // Very low
        const timpaniEnvelope = 0.5 * Math.exp(-beatTime * 30) * breathingEnvelope;
        sample += Math.sin(2 * Math.PI * timpaniFreq * t) * timpaniEnvelope;
      }
      
      // Final mix with classical stereo imaging
      leftData[i] = sample * 0.4;
      rightData[i] = sample * 0.4 * 0.95; // Slight stereo separation for concert hall effect
    }
    
    return buffer;
  }

  // Generate game background music - epic orchestral battle theme
  private generateGameMusic(): AudioBuffer {
    if (!this.context) throw new Error('No audio context');
    
    const duration = 36; // Extended battle theme
    const sampleRate = this.context.sampleRate;
    const buffer = this.context.createBuffer(2, sampleRate * duration, sampleRate);
    const leftData = buffer.getChannelData(0);
    const rightData = buffer.getChannelData(1);
    
    // Epic progression in D minor (the saddest key): i - VII - VI - VII - i - iv - V - i
    // Perfect for heroic battle music
    const battleProgression = [
      // Measure 1-2: i (D minor) - Heroic statement
      { root: 146.83, third: 174.61, fifth: 220.00, seventh: null },
      // Measure 3-4: VII (C major) - Rising tension
      { root: 130.81, third: 164.81, fifth: 196.00, seventh: null },
      // Measure 5-6: VI (Bb major) - Majestic lift
      { root: 116.54, third: 146.83, fifth: 174.61, seventh: null },
      // Measure 7-8: VII (C major) - Building energy
      { root: 130.81, third: 164.81, fifth: 196.00, seventh: null },
      // Measure 9-10: i (D minor) - Return with power
      { root: 146.83, third: 174.61, fifth: 220.00, seventh: null },
      // Measure 11-12: iv (G minor) - Dark turn
      { root: 98.00, third: 116.54, fifth: 146.83, seventh: null },
      // Measure 13-14: V (A major) - Dominant tension
      { root: 110.00, third: 138.59, fifth: 164.81, seventh: null },
      // Measure 15-16: i (D minor) - Triumphant resolution
      { root: 146.83, third: 174.61, fifth: 220.00, seventh: null },
      // Measure 17-18: Extended ending - V7 to i
      { root: 110.00, third: 138.59, fifth: 164.81, seventh: 207.65 }
    ];
    
    for (let i = 0; i < leftData.length; i++) {
      const t = i / sampleRate;
      const measureLength = 4; // 4 seconds per measure pair for urgency
      const chordIndex = Math.floor((t / measureLength) % battleProgression.length);
      const measureTime = (t % measureLength) / measureLength;
      
      const chord = battleProgression[chordIndex];
      
      // Battle intensity envelope with dramatic peaks
      const battleIntensity = 0.8 + 0.2 * Math.cos(t * 0.3); // Slow intensity waves
      const urgencyPulse = 1 + 0.3 * Math.sin(t * 2.5); // Quick rhythmic pulse
      const dramaticSwells = 1 + 0.4 * Math.sin(t * 0.08) * Math.cos(t * 0.12); // Epic swells
      
      let sample = 0;
      
      // Timpani and Bass Drums - Driving rhythm (every 0.75 seconds)
      const beatInterval = 0.75;
      const beatTime = t % beatInterval;
      if (beatTime < 0.1) {
        const timpaniFreq = chord.root * 0.25;
        const timpaniPower = 0.8 * Math.exp(-beatTime * 20) * battleIntensity;
        sample += Math.sin(2 * Math.PI * timpaniFreq * t) * timpaniPower;
        
        // Add bass drum boom
        sample += (Math.random() * 2 - 1) * 0.3 * Math.exp(-beatTime * 50) * battleIntensity;
      }
      
      // Cello and Double Bass - Powerful low foundation
      const bassFreq = chord.root * 0.5;
      const bassEnvelope = 0.5 * battleIntensity * urgencyPulse;
      sample += Math.sin(2 * Math.PI * bassFreq * t) * bassEnvelope;
      sample += Math.sin(2 * Math.PI * bassFreq * t + Math.PI/3) * bassEnvelope * 0.8; // Tremolo effect
      
      // French Horns - Heroic mid-range harmony
      const hornRoot = chord.root * 0.75;
      const hornFifth = chord.fifth * 0.75;
      const hornEnvelope = 0.4 * battleIntensity * dramaticSwells;
      sample += Math.sin(2 * Math.PI * hornRoot * t + Math.sin(t * 0.4) * 0.05) * hornEnvelope;
      sample += Math.sin(2 * Math.PI * hornFifth * t + Math.cos(t * 0.6) * 0.05) * hornEnvelope * 0.9;
      
      // Trumpets - Brilliant melodic line with fanfare figures
      const trumpetMelody = chord.root * 1.5; // Higher octave
      const fanfarePattern = 1 + 0.1 * Math.sin(t * 8) * Math.cos(t * 6); // Rapid ornaments
      const trumpetEnvelope = 0.35 * battleIntensity * urgencyPulse * fanfarePattern;
      sample += Math.sin(2 * Math.PI * trumpetMelody * t) * trumpetEnvelope;
      
      // Violin Section - Soaring melody with dramatic runs
      const violinMelody = chord.third * 1.2;
      const violinRuns = 1 + 0.2 * Math.sin(t * 12) * Math.sin(t * 7); // Scale passages
      const violinEnvelope = 0.3 * battleIntensity * dramaticSwells * violinRuns;
      sample += Math.sin(2 * Math.PI * violinMelody * t + Math.sin(t * 4) * 0.08) * violinEnvelope;
      
      // Brass stabs and punctuation
      const punctuationTime = t % 2;
      if (punctuationTime < 0.08) {
        const brassChordFreq = chord.fifth;
        const brassStab = 0.6 * Math.exp(-punctuationTime * 25) * battleIntensity;
        sample += Math.sin(2 * Math.PI * brassChordFreq * t) * brassStab;
        sample += Math.sin(2 * Math.PI * brassChordFreq * 1.5 * t) * brassStab * 0.7;
      }
      
      // Snare drum rolls on tension points
      if (chordIndex === 6 || chordIndex === 8) { // On dominant and final chords
        const snareRoll = (Math.random() * 2 - 1) * 0.2 * battleIntensity;
        sample += snareRoll;
      }
      
      // Cymbals on climactic moments (every 8 seconds)
      const cymbalTime = t % 8;
      if (cymbalTime < 0.2) {
        const cymbalCrash = (Math.random() * 2 - 1) * 0.4 * Math.exp(-cymbalTime * 10) * battleIntensity;
        sample += cymbalCrash;
      }
      
      // Final mix with concert hall reverb simulation
      const reverbDecay = sample * 0.1 * Math.exp(-((t * 10) % 1));
      sample = sample * 0.5 + reverbDecay;
      
      leftData[i] = sample * 0.6;
      rightData[i] = sample * 0.6 * 0.92; // Stereo imaging for orchestral width
    }
    
    return buffer;
  }

  // Play background music with crossfade
  playMusic(name: string, fadeTime: number = 2.0): void {
    if (!this.context || !this.musicGain || this.isMuted) return;
    
    const buffer = this.sounds.get(name);
    if (!buffer) {
      console.warn(`Music track "${name}" not found`);
      return;
    }
    
    // Stop current music with fade out
    if (this.currentMusic && this.currentMusicName !== name) {
      this.fadeOutMusic(fadeTime / 2);
    }
    
    // Don't restart the same track
    if (this.currentMusicName === name) return;
    
    try {
      const source = this.context.createBufferSource();
      const fadeGain = this.context.createGain();
      
      source.buffer = buffer;
      source.loop = true;
      fadeGain.gain.value = 0; // Start silent
      
      source.connect(fadeGain);
      fadeGain.connect(this.musicGain);
      
      // Fade in
      fadeGain.gain.linearRampToValueAtTime(1, this.context.currentTime + fadeTime);
      
      source.start();
      
      this.currentMusic = source;
      this.currentMusicName = name;
      
      source.onended = () => {
        if (this.currentMusic === source) {
          this.currentMusic = null;
          this.currentMusicName = null;
        }
      };
      
      console.log(`🎵 Playing background music: ${name}`);
    } catch (error) {
      console.warn(`Failed to play music "${name}":`, error);
    }
  }

  // Stop music with fade out
  stopMusic(fadeTime: number = 2.0): void {
    this.fadeOutMusic(fadeTime);
  }

  private fadeOutMusic(fadeTime: number): void {
    if (!this.currentMusic || !this.context) return;
    
    const source = this.currentMusic;
    const fadeGain = this.context.createGain();
    
    try {
      // Reconnect with fade gain
      source.disconnect();
      source.connect(fadeGain);
      if (this.musicGain) {
        fadeGain.connect(this.musicGain);
      }
      
      fadeGain.gain.value = 1;
      fadeGain.gain.linearRampToValueAtTime(0, this.context.currentTime + fadeTime);
      
      // Stop after fade completes
      setTimeout(() => {
        try {
          source.stop();
        } catch (e) {
          // Source might already be stopped
        }
      }, fadeTime * 1000 + 100);
      
      this.currentMusic = null;
      this.currentMusicName = null;
    } catch (error) {
      console.warn('Error during music fade out:', error);
    }
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
      if (this.sfxGain) {
        gainNode.connect(this.sfxGain);
      }
      
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
    this.saveVolumePreferences();
  }

  setSfxVolume(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
    if (this.sfxGain) {
      this.sfxGain.gain.value = this.sfxVolume;
    }
    this.saveVolumePreferences();
  }

  setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    if (this.musicGain) {
      this.musicGain.gain.value = this.musicVolume;
    }
    this.saveVolumePreferences();
  }

  getMasterVolume(): number {
    return this.masterVolume;
  }

  getSfxVolume(): number {
    return this.sfxVolume;
  }

  getMusicVolume(): number {
    return this.musicVolume;
  }

  toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    const volume = this.isMuted ? 0 : this.masterVolume;
    if (this.masterGain) {
      this.masterGain.gain.value = volume;
    }
    this.saveVolumePreferences();
    return this.isMuted;
  }

  isMutedState(): boolean {
    return this.isMuted;
  }

  private saveVolumePreferences(): void {
    const preferences = {
      masterVolume: this.masterVolume,
      sfxVolume: this.sfxVolume,
      musicVolume: this.musicVolume,
      isMuted: this.isMuted
    };
    localStorage.setItem('hacktivate-audio-preferences', JSON.stringify(preferences));
  }

  private loadVolumePreferences(): void {
    try {
      const saved = localStorage.getItem('hacktivate-audio-preferences');
      if (saved) {
        const preferences = JSON.parse(saved);
        this.masterVolume = preferences.masterVolume ?? 0.7;
        this.sfxVolume = preferences.sfxVolume ?? 1.0;
        this.musicVolume = preferences.musicVolume ?? 0.4;
        this.isMuted = preferences.isMuted ?? false;

        // Apply loaded values to gain nodes if they exist
        if (this.masterGain) {
          this.masterGain.gain.value = this.isMuted ? 0 : this.masterVolume;
        }
        if (this.sfxGain) {
          this.sfxGain.gain.value = this.sfxVolume;
        }
        if (this.musicGain) {
          this.musicGain.gain.value = this.musicVolume;
        }
      }
    } catch (error) {
      console.warn('Failed to load audio preferences:', error);
    }
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