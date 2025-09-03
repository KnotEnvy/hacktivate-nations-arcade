// ===== src/components/arcade/AudioSettings.tsx =====
'use client';

import { useState, useEffect } from 'react';
import { AudioManager } from '@/services/AudioManager';

interface AudioSettingsProps {
  audioManager: AudioManager;
  isOpen: boolean;
  onClose: () => void;
}

export function AudioSettings({ audioManager, isOpen, onClose }: AudioSettingsProps) {
  const [masterVolume, setMasterVolume] = useState(0.7);
  const [sfxVolume, setSfxVolume] = useState(1.0);
  const [musicVolume, setMusicVolume] = useState(0.4);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (audioManager) {
      setMasterVolume(audioManager.getMasterVolume());
      setSfxVolume(audioManager.getSfxVolume());
      setMusicVolume(audioManager.getMusicVolume());
      setIsMuted(audioManager.isMutedState());
    }
  }, [audioManager, isOpen]);

  const handleMasterVolumeChange = (value: number) => {
    setMasterVolume(value);
    audioManager?.setMasterVolume(value);
  };

  const handleSfxVolumeChange = (value: number) => {
    setSfxVolume(value);
    audioManager?.setSfxVolume(value);
    // Play test sound
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-purple-600">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-white">🔊 Audio Settings</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6">
          {/* Master Volume */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-white font-medium">Master Volume</label>
              <span className="text-purple-400">{Math.round(masterVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={masterVolume}
              onChange={(e) => handleMasterVolumeChange(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>

          {/* SFX Volume */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-white font-medium">Sound Effects</label>
              <span className="text-purple-400">{Math.round(sfxVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={sfxVolume}
              onChange={(e) => handleSfxVolumeChange(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>

          {/* Music Volume */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-white font-medium">Background Music</label>
              <span className="text-purple-400">{Math.round(musicVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={musicVolume}
              onChange={(e) => handleMusicVolumeChange(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>

          {/* Mute Toggle */}
          <div className="flex items-center justify-between py-2">
            <span className="text-white font-medium">Mute All Audio</span>
            <button
              onClick={handleMuteToggle}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isMuted ? 'bg-gray-600' : 'bg-purple-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isMuted ? 'translate-x-1' : 'translate-x-6'
                }`}
              />
            </button>
          </div>

          {/* Test Buttons */}
          <div className="border-t border-gray-700 pt-4">
            <p className="text-sm text-gray-400 mb-3">Test Audio:</p>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => audioManager?.playSound('coin')}
                className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-sm rounded"
              >
                Coin
              </button>
              <button
                onClick={() => audioManager?.playSound('jump')}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded"
              >
                Jump
              </button>
              <button
                onClick={() => audioManager?.playSound('powerup')}
                className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded"
              >
                Power-up
              </button>
              <button
                onClick={() => audioManager?.playSound('success')}
                className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded"
              >
                Success
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #a855f7;
          cursor: pointer;
        }
        .slider::-moz-range-thumb {
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #a855f7;
          cursor: pointer;
          border: none;
        }
      `}</style>
    </div>
  );
}