// ===== src/components/arcade/AudioSettings.tsx =====
'use client';

import { useState, useEffect, useCallback } from 'react';
import { AudioManager } from '@/services/AudioManager';
import { SCALES } from '@/services/ProceduralMusicEngine';

interface AudioSettingsProps {
  audioManager: AudioManager;
  isOpen: boolean;
  onClose: () => void;
}

// Track mood icons and colors
const MOOD_CONFIG: Record<string, { icon: string; color: string; description: string }> = {
  energetic: { icon: '⚡', color: 'text-yellow-400', description: 'High energy, upbeat' },
  chill: { icon: '🌙', color: 'text-blue-400', description: 'Relaxed, ambient' },
  intense: { icon: '🔥', color: 'text-red-500', description: 'Fast-paced, aggressive' },
  focus: { icon: '🎯', color: 'text-cyan-400', description: 'Concentrated, minimal' },
  retro: { icon: '👾', color: 'text-green-400', description: 'Classic arcade vibes' },
  mysterious: { icon: '🌌', color: 'text-purple-400', description: 'Dark, atmospheric' },
  epic: { icon: '⚔️', color: 'text-orange-400', description: 'Grand, heroic' },
  playful: { icon: '🎈', color: 'text-pink-400', description: 'Fun, lighthearted' },
};

// Scale display names
const SCALE_NAMES: Record<string, { name: string; emoji: string }> = {
  major: { name: 'Major', emoji: '🌞' },
  minor: { name: 'Minor', emoji: '🌙' },
  dorian: { name: 'Dorian', emoji: '🎷' },
  phrygian: { name: 'Phrygian', emoji: '🏜️' },
  lydian: { name: 'Lydian', emoji: '✨' },
  mixolydian: { name: 'Mixolydian', emoji: '🎸' },
  majorPentatonic: { name: 'Major Penta', emoji: '🎵' },
  minorPentatonic: { name: 'Minor Penta', emoji: '🎹' },
  japanese: { name: 'Japanese', emoji: '🎋' },
  hungarian: { name: 'Hungarian', emoji: '🎻' },
  blues: { name: 'Blues', emoji: '🎺' },
};

// Root note options
const ROOT_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Category icons
const CATEGORY_ICONS: Record<string, string> = {
  'Hub/Menu': '🏠',
  'Action': '💥',
  'Puzzle': '🧩',
  'Arcade': '🕹️',
  'Casual': '☀️',
  'Epic': '⚔️',
  'Sports': '🏆',
  'Rhythm': '🎵',
  'Space': '🚀',
  'Legacy': '📼',
};

export function AudioSettings({ audioManager, isOpen, onClose }: AudioSettingsProps) {
  // Volume state
  const [masterVolume, setMasterVolume] = useState(0.7);
  const [sfxVolume, setSfxVolume] = useState(1.0);
  const [musicVolume, setMusicVolume] = useState(0.4);
  const [isMuted, setIsMuted] = useState(false);

  // Track browser state
  const [activeTab, setActiveTab] = useState<'volume' | 'tracks' | 'lab'>('volume');
  const [selectedCategory, setSelectedCategory] = useState<string>('Hub/Menu');
  const [currentTrack, setCurrentTrack] = useState<string | null>(null);

  // Music Laboratory state (hidden feature!)
  const [labUnlocked, setLabUnlocked] = useState(false);
  const [titleClickCount, setTitleClickCount] = useState(0);
  const [customSeed, setCustomSeed] = useState<string>('');
  const [selectedMood, setSelectedMood] = useState<string>('energetic');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSeeds, setGeneratedSeeds] = useState<number[]>([]);
  const [showLabIntro, setShowLabIntro] = useState(false);

  // Enhanced Lab controls
  const [customBpm, setCustomBpm] = useState<number>(120);
  const [customIntensity, setCustomIntensity] = useState<number>(0.6);
  const [selectedScale, setSelectedScale] = useState<string>('minorPentatonic');
  const [selectedRootNote, setSelectedRootNote] = useState<string>('A');
  const [labMode, setLabMode] = useState<'simple' | 'advanced'>('simple');

  // Playback state
  const [isPaused, setIsPaused] = useState(false);

  // Load state from audio manager
  useEffect(() => {
    if (audioManager && isOpen) {
      setMasterVolume(audioManager.getMasterVolume());
      setSfxVolume(audioManager.getSfxVolume());
      setMusicVolume(audioManager.getMusicVolume());
      setIsMuted(audioManager.isMutedState());
      setCurrentTrack(audioManager.getCurrentTrackName());
    }
  }, [audioManager, isOpen]);

  // Update current track and pause state periodically
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      if (audioManager) {
        setCurrentTrack(audioManager.getCurrentTrackName());
        setIsPaused(audioManager.isMusicPaused());
      }
    }, 500);
    return () => clearInterval(interval);
  }, [audioManager, isOpen]);

  // Handle title click for secret lab unlock
  const handleTitleClick = useCallback(() => {
    const newCount = titleClickCount + 1;
    setTitleClickCount(newCount);

    if (newCount >= 5 && !labUnlocked) {
      setLabUnlocked(true);
      setShowLabIntro(true);
      audioManager?.playSound('unlock');
      // Reset after showing intro
      setTimeout(() => setShowLabIntro(false), 3000);
    } else if (newCount < 5) {
      // Subtle feedback for clicks
      audioManager?.playSound('click');
    }
  }, [titleClickCount, labUnlocked, audioManager]);

  // Volume handlers
  const handleMasterVolumeChange = (value: number) => {
    setMasterVolume(value);
    audioManager?.setMasterVolume(value);
  };

  const handleSfxVolumeChange = (value: number) => {
    setSfxVolume(value);
    audioManager?.setSfxVolume(value);
    setTimeout(() => audioManager?.playSound('coin'), 100);
  };

  const handleMusicVolumeChange = (value: number) => {
    setMusicVolume(value);
    audioManager?.setMusicVolume(value);
  };

  const handleMuteToggle = () => {
    const newMutedState = audioManager?.toggleMute();
    setIsMuted(newMutedState || false);
  };

  // Track selection handler
  const handleTrackSelect = (trackName: string) => {
    audioManager?.playTrackByName(trackName, 0.5);
    setCurrentTrack(trackName);
    setIsPaused(false);
  };

  // Pause/play toggle handler
  const handlePauseToggle = () => {
    if (audioManager) {
      const newPausedState = audioManager.togglePause();
      setIsPaused(newPausedState);
      audioManager.playSound('click');
    }
  };

  // Generate random seed
  const generateRandomSeed = () => {
    const seed = Math.floor(Math.random() * 999999999);
    setCustomSeed(seed.toString());
    return seed;
  };

  // Play custom generated track
  const handleGenerateTrack = async () => {
    setIsGenerating(true);
    audioManager?.playSound('powerup');

    // Dramatic delay for effect
    await new Promise(resolve => setTimeout(resolve, 800));

    const seed = customSeed ? parseInt(customSeed) : generateRandomSeed();

    audioManager?.playCustomTrack({
      seed,
      mood: selectedMood,
      bpm: customBpm,
      intensity: customIntensity,
    });

    // Save to history
    if (!generatedSeeds.includes(seed)) {
      setGeneratedSeeds(prev => [seed, ...prev.slice(0, 4)]);
    }

    setIsGenerating(false);
    setIsPaused(false);
    setCurrentTrack(`custom_${selectedMood}`);
  };

  // Get track info
  const getTrackInfo = (trackName: string) => {
    return audioManager?.getTrackInfo(trackName);
  };

  // Get tracks by category
  const getTracksByCategory = () => {
    return audioManager?.getTracksByCategory() || {};
  };

  if (!isOpen) return null;

  const tracksByCategory = getTracksByCategory();
  const currentTrackInfo = currentTrack ? getTrackInfo(currentTrack) : null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 backdrop-blur-sm" data-testid="audio-settings-modal">
      <div className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-xl p-6 max-w-lg w-full mx-4 border border-purple-500/50 shadow-2xl shadow-purple-500/20 max-h-[90vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h3
            className="text-xl font-bold text-white cursor-pointer select-none hover:text-purple-300 transition-colors"
            onClick={handleTitleClick}
            title={labUnlocked ? "Music Laboratory Unlocked!" : undefined}
          >
            {labUnlocked ? '🎛️ Audio Studio' : '🔊 Audio Settings'}
            {titleClickCount > 0 && titleClickCount < 5 && (
              <span className="ml-2 text-xs text-purple-400 animate-pulse">
                {'🎵'.repeat(titleClickCount)}
              </span>
            )}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Lab Unlock Animation */}
        {showLabIntro && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10 animate-pulse">
            <div className="text-center">
              <div className="text-6xl mb-4 animate-bounce">🔬</div>
              <div className="text-2xl font-bold text-purple-400 mb-2">SECRET UNLOCKED!</div>
              <div className="text-gray-300">Music Laboratory is now available</div>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-4 border-b border-gray-700 pb-2">
          <button
            onClick={() => setActiveTab('volume')}
            className={`px-4 py-2 rounded-t-lg font-medium transition-all ${
              activeTab === 'volume'
                ? 'bg-purple-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            🔊 Volume
          </button>
          <button
            onClick={() => setActiveTab('tracks')}
            className={`px-4 py-2 rounded-t-lg font-medium transition-all ${
              activeTab === 'tracks'
                ? 'bg-purple-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            🎵 Tracks
          </button>
          {labUnlocked && (
            <button
              onClick={() => setActiveTab('lab')}
              className={`px-4 py-2 rounded-t-lg font-medium transition-all ${
                activeTab === 'lab'
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              🔬 Lab
            </button>
          )}
        </div>

        {/* Now Playing Banner with Pause/Play */}
        {currentTrack && currentTrackInfo && (
          <div className="mb-4 p-3 bg-gradient-to-r from-purple-900/50 to-pink-900/50 rounded-lg border border-purple-500/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Pause/Play Button */}
                <button
                  onClick={handlePauseToggle}
                  className={`w-12 h-12 rounded-lg flex items-center justify-center transition-all transform hover:scale-105 ${
                    isPaused
                      ? 'bg-green-600 hover:bg-green-500'
                      : 'bg-purple-600 hover:bg-purple-500'
                  }`}
                  title={isPaused ? 'Resume music' : 'Pause music'}
                >
                  {isPaused ? (
                    <span className="text-2xl">▶</span>
                  ) : (
                    <span className="text-2xl">⏸</span>
                  )}
                </button>
                <div>
                  <div className="text-white font-medium flex items-center gap-2">
                    {currentTrackInfo.name}
                    {isPaused && (
                      <span className="text-xs text-yellow-400 bg-yellow-400/20 px-2 py-0.5 rounded">
                        PAUSED
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400">
                    {currentTrackInfo.bpm} BPM • {currentTrackInfo.scale} • {currentTrackInfo.mood}
                  </div>
                </div>
              </div>
              {/* Equalizer Bars - only animate when playing */}
              <div className="flex items-center gap-1">
                {[0, 150, 300, 450].map((delay, i) => (
                  <div
                    key={i}
                    className={`w-1 rounded transition-all ${
                      isPaused
                        ? 'bg-gray-600 h-2'
                        : `bg-purple-${i % 2 === 0 ? '500' : '400'} animate-pulse`
                    }`}
                    style={{
                      height: isPaused ? '8px' : `${[16, 24, 12, 20][i]}px`,
                      animationDelay: isPaused ? '0ms' : `${delay}ms`
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">

          {/* Volume Tab */}
          {activeTab === 'volume' && (
            <div className="space-y-5">
              {/* Master Volume */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-white font-medium">🔊 Master Volume</label>
                  <span className="text-purple-400 font-mono">{Math.round(masterVolume * 100)}%</span>
                </div>
                <input
                  data-testid="master-volume-slider"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={masterVolume}
                  onChange={(e) => handleMasterVolumeChange(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
              </div>

              {/* SFX Volume */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-white font-medium">💥 Sound Effects</label>
                  <span className="text-purple-400 font-mono">{Math.round(sfxVolume * 100)}%</span>
                </div>
                <input
                  data-testid="sfx-volume-slider"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={sfxVolume}
                  onChange={(e) => handleSfxVolumeChange(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
              </div>

              {/* Music Volume */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-white font-medium">🎵 Background Music</label>
                  <span className="text-purple-400 font-mono">{Math.round(musicVolume * 100)}%</span>
                </div>
                <input
                  data-testid="music-volume-slider"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={musicVolume}
                  onChange={(e) => handleMusicVolumeChange(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
              </div>

              {/* Mute Toggle */}
              <div className="flex items-center justify-between py-2 px-3 bg-gray-800/50 rounded-lg">
                <span className="text-white font-medium">🔇 Mute All Audio</span>
                <button
                  data-testid="mute-toggle"
                  onClick={handleMuteToggle}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                    isMuted ? 'bg-gray-600' : 'bg-purple-600'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-lg ${
                      isMuted ? 'translate-x-1' : 'translate-x-6'
                    }`}
                  />
                </button>
              </div>

              {/* Test Sounds */}
              <div className="border-t border-gray-700 pt-4">
                <p className="text-sm text-gray-400 mb-3">Test Sound Effects:</p>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => audioManager?.playSound('coin')}
                    className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 text-white text-sm rounded-lg transition-colors"
                  >
                    🪙 Coin
                  </button>
                  <button
                    onClick={() => audioManager?.playSound('jump')}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors"
                  >
                    🦘 Jump
                  </button>
                  <button
                    onClick={() => audioManager?.playSound('powerup')}
                    className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-sm rounded-lg transition-colors"
                  >
                    ⬆️ Power-up
                  </button>
                  <button
                    onClick={() => audioManager?.playSound('explosion')}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-sm rounded-lg transition-colors"
                  >
                    💥 Boom
                  </button>
                  <button
                    onClick={() => audioManager?.playSound('success')}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-lg transition-colors"
                  >
                    ✨ Success
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tracks Tab */}
          {activeTab === 'tracks' && (
            <div className="space-y-4">
              {/* Category Selector */}
              <div className="flex flex-wrap gap-2">
                {Object.keys(tracksByCategory).map((category) => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      selectedCategory === category
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {CATEGORY_ICONS[category]} {category}
                  </button>
                ))}
              </div>

              {/* Track List */}
              <div className="space-y-2">
                {tracksByCategory[selectedCategory]?.map((trackName) => {
                  const info = getTrackInfo(trackName);
                  const isPlaying = currentTrack === trackName;
                  const isLegacy = trackName === 'hub_music' || trackName === 'game_music';

                  return (
                    <button
                      key={trackName}
                      onClick={() => handleTrackSelect(trackName)}
                      className={`w-full p-3 rounded-lg text-left transition-all ${
                        isPlaying
                          ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                          : 'bg-gray-800 hover:bg-gray-700 text-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">
                            {isLegacy ? '📼' : (MOOD_CONFIG[info?.mood || '']?.icon || '🎵')}
                          </span>
                          <div>
                            <div className="font-medium">
                              {info?.name || trackName}
                              {isLegacy && <span className="ml-2 text-xs text-yellow-400">(Original)</span>}
                            </div>
                            {info && (
                              <div className="text-xs opacity-70">
                                {info.bpm} BPM • {info.scale} • {info.mood}
                              </div>
                            )}
                          </div>
                        </div>
                        {isPlaying && (
                          <div className="flex items-center gap-0.5">
                            <div className="w-1 h-3 bg-white rounded animate-pulse" />
                            <div className="w-1 h-4 bg-white rounded animate-pulse" style={{ animationDelay: '100ms' }} />
                            <div className="w-1 h-2 bg-white rounded animate-pulse" style={{ animationDelay: '200ms' }} />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Info text */}
              <p className="text-xs text-gray-500 text-center mt-4">
                All tracks are procedurally generated and unique every time!
              </p>
            </div>
          )}

          {/* Music Laboratory Tab (Hidden Feature!) */}
          {activeTab === 'lab' && labUnlocked && (
            <div className="space-y-4">
              {/* Lab Header with Mode Toggle */}
              <div className="text-center p-4 bg-gradient-to-r from-purple-900/50 to-pink-900/50 rounded-lg border border-purple-500/30">
                <div className="text-3xl mb-2">🔬🎵✨</div>
                <h4 className="text-lg font-bold text-white">Music Laboratory</h4>
                <p className="text-sm text-gray-400 mb-3">Create your own procedural masterpiece!</p>

                {/* Mode Toggle */}
                <div className="flex justify-center gap-2">
                  <button
                    onClick={() => setLabMode('simple')}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      labMode === 'simple'
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    🎚️ Simple
                  </button>
                  <button
                    onClick={() => setLabMode('advanced')}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      labMode === 'advanced'
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    🔧 Advanced
                  </button>
                </div>
              </div>

              {/* Seed Input */}
              <div>
                <label className="block text-white font-medium mb-2">
                  🌱 Music Seed
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customSeed}
                    onChange={(e) => setCustomSeed(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter a number or generate random"
                    className="flex-1 px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none font-mono"
                  />
                  <button
                    onClick={() => setCustomSeed(generateRandomSeed().toString())}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors"
                    title="Generate random seed"
                  >
                    🎲
                  </button>
                </div>
              </div>

              {/* BPM Slider */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-white font-medium">🥁 BPM (Tempo)</label>
                  <span className="text-purple-400 font-mono bg-gray-800 px-2 py-0.5 rounded">{customBpm}</span>
                </div>
                <input
                  type="range"
                  min="60"
                  max="180"
                  step="5"
                  value={customBpm}
                  onChange={(e) => setCustomBpm(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>60 (Chill)</span>
                  <span>120 (Groove)</span>
                  <span>180 (Intense)</span>
                </div>
              </div>

              {/* Intensity Slider */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-white font-medium">🔥 Intensity</label>
                  <span className="text-purple-400 font-mono bg-gray-800 px-2 py-0.5 rounded">
                    {Math.round(customIntensity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.1"
                  value={customIntensity}
                  onChange={(e) => setCustomIntensity(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>🌙 Ambient</span>
                  <span>⚡ Medium</span>
                  <span>🔥 Maximum</span>
                </div>
              </div>

              {/* Mood Selector */}
              <div>
                <label className="block text-white font-medium mb-2">
                  🎭 Mood
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(MOOD_CONFIG).map(([mood, config]) => (
                    <button
                      key={mood}
                      onClick={() => setSelectedMood(mood)}
                      className={`p-2.5 rounded-lg text-left transition-all ${
                        selectedMood === mood
                          ? 'bg-purple-600 text-white ring-2 ring-purple-400'
                          : 'bg-gray-800 hover:bg-gray-700 text-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{config.icon}</span>
                        <div>
                          <div className="font-medium capitalize text-sm">{mood}</div>
                          {labMode === 'advanced' && (
                            <div className="text-xs opacity-70">{config.description}</div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Advanced Controls */}
              {labMode === 'advanced' && (
                <>
                  {/* Scale Selector */}
                  <div>
                    <label className="block text-white font-medium mb-2">
                      🎼 Scale / Mode
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {Object.keys(SCALES).filter(s => SCALE_NAMES[s]).map((scale) => (
                        <button
                          key={scale}
                          onClick={() => setSelectedScale(scale)}
                          className={`p-2 rounded-lg text-center transition-all ${
                            selectedScale === scale
                              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white ring-2 ring-purple-400'
                              : 'bg-gray-800 hover:bg-gray-700 text-gray-200'
                          }`}
                        >
                          <span className="text-lg">{SCALE_NAMES[scale]?.emoji}</span>
                          <div className="text-xs font-medium mt-1">{SCALE_NAMES[scale]?.name}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Root Note Selector */}
                  <div>
                    <label className="block text-white font-medium mb-2">
                      🎹 Root Note (Key)
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {ROOT_NOTES.map((note) => (
                        <button
                          key={note}
                          onClick={() => setSelectedRootNote(note)}
                          className={`w-10 h-10 rounded-lg font-bold transition-all ${
                            selectedRootNote === note
                              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                              : note.includes('#')
                                ? 'bg-gray-900 text-gray-300 hover:bg-gray-700'
                                : 'bg-gray-700 text-white hover:bg-gray-600'
                          }`}
                        >
                          {note}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Current Configuration Display */}
                  <div className="p-3 bg-gray-800/70 rounded-lg border border-purple-500/20">
                    <h5 className="text-sm font-medium text-purple-400 mb-2">🎛️ Current Configuration</h5>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Seed:</span>
                        <span className="text-white font-mono">{customSeed || 'Random'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">BPM:</span>
                        <span className="text-white">{customBpm}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Key:</span>
                        <span className="text-white">{selectedRootNote} {SCALE_NAMES[selectedScale]?.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Intensity:</span>
                        <span className="text-white">{Math.round(customIntensity * 100)}%</span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Generate Button */}
              <button
                onClick={handleGenerateTrack}
                disabled={isGenerating}
                className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
                  isGenerating
                    ? 'bg-gray-700 text-gray-400 cursor-wait'
                    : 'bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 bg-size-200 animate-gradient text-white hover:shadow-lg hover:shadow-purple-500/50 hover:scale-[1.02]'
                }`}
              >
                {isGenerating ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin">🎵</span>
                    Generating...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    ✨ Generate Music ✨
                    {labMode === 'advanced' && (
                      <span className="text-xs bg-white/20 px-2 py-0.5 rounded">
                        {selectedRootNote} {SCALE_NAMES[selectedScale]?.name} @ {customBpm}bpm
                      </span>
                    )}
                  </span>
                )}
              </button>

              {/* Recent Seeds */}
              {generatedSeeds.length > 0 && (
                <div>
                  <label className="block text-white font-medium mb-2">
                    🕐 Recent Seeds
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {generatedSeeds.map((seed) => (
                      <button
                        key={seed}
                        onClick={() => {
                          setCustomSeed(seed.toString());
                          audioManager?.playSound('click');
                        }}
                        className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-mono transition-colors border border-gray-700 hover:border-purple-500"
                      >
                        {seed}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Lab Tips */}
              <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                <h5 className="text-sm font-medium text-purple-400 mb-2">💡 Lab Tips</h5>
                <ul className="text-xs text-gray-400 space-y-1">
                  <li>• Try your birthday as a seed for personalized music!</li>
                  <li>• Same seed + same settings = identical track every time</li>
                  {labMode === 'simple' ? (
                    <li>• Switch to <span className="text-pink-400">Advanced</span> mode for scale and key controls!</li>
                  ) : (
                    <>
                      <li>• <span className="text-purple-400">Minor Pentatonic</span> is great for retro games</li>
                      <li>• <span className="text-purple-400">Japanese</span> scale for peaceful, zen vibes</li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 mt-4 pt-4 border-t border-gray-700">
          <button
            onClick={onClose}
            data-testid="audio-settings-close"
            className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 18px;
          width: 18px;
          border-radius: 50%;
          background: linear-gradient(135deg, #a855f7, #ec4899);
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(168, 85, 247, 0.5);
          transition: transform 0.1s;
        }
        .slider::-webkit-slider-thumb:hover {
          transform: scale(1.1);
        }
        .slider::-moz-range-thumb {
          height: 18px;
          width: 18px;
          border-radius: 50%;
          background: linear-gradient(135deg, #a855f7, #ec4899);
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 6px rgba(168, 85, 247, 0.5);
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(168, 85, 247, 0.5);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(168, 85, 247, 0.8);
        }
        .bg-size-200 {
          background-size: 200% 200%;
        }
        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-gradient {
          animation: gradient 3s ease infinite;
        }
      `}</style>
    </div>
  );
}
