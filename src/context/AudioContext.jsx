import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { API_URL } from '../config/api';

const AudioContext = createContext(null);

export const AudioProvider = ({ children }) => {
  const [themeSongs, setThemeSongs] = useState([]);
  const [currentSong, setCurrentSong] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Settings — persist to localStorage
  const [masterVolume, setMasterVolume] = useState(() => parseFloat(localStorage.getItem('masterVolume')) || 1.0);
  const [musicVolume, setMusicVolume] = useState(() => parseFloat(localStorage.getItem('musicVolume')) || 0.6);
  const [sfxVolume, setSfxVolume] = useState(() => parseFloat(localStorage.getItem('sfxVolume')) || 0.9);
  const [muted, setMuted] = useState(() => localStorage.getItem('muted') === 'true');

  // Use a plain <audio> element for streaming — no download manager interception
  const audioRef = useRef(null);

  const getEffectiveVolume = (master, music, isMuted) =>
    isMuted ? 0 : Math.min(1, master * music);

  const applyVolume = () => {
    if (audioRef.current) {
      audioRef.current.volume = getEffectiveVolume(masterVolume, musicVolume, muted);
    }
  };

  // Fetch theme songs from backend
  const loadThemeSongs = () => {
    fetch(`${API_URL}/api/theme-songs`)
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) {
          setThemeSongs(data);
        } else {
          setThemeSongs([{
            id: 0,
            title: 'Default Theme',
            file_path: '/assets/sounds/bg-music.mp3',
            is_active: true
          }]);
        }
      })
      .catch(console.error);
  };

  useEffect(() => {
    loadThemeSongs();

    const handleGlobalUpdate = () => {
      loadThemeSongs();
    };

    window.addEventListener('global_update', handleGlobalUpdate);
    return () => {
      window.removeEventListener('global_update', handleGlobalUpdate);
    };
  }, []);

  const wasPlayingBeforeHide = useRef(false);
  const lastPlayedTypeRef = useRef('none');
  const playTimeoutRef = useRef(null);

  useEffect(() => {
    const handleVisibilityChange = () => {
      const audio = audioRef.current;
      if (!audio) return;
      
      if (document.hidden) {
        if (!audio.paused) {
          wasPlayingBeforeHide.current = true;
          audio.pause();
        } else {
          wasPlayingBeforeHide.current = false;
        }
      } else {
        if (wasPlayingBeforeHide.current) {
          audio.play().catch(e => console.log('Resume blocked:', e.message));
          wasPlayingBeforeHide.current = false;
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // Create a single <audio> element once — kept alive in ref
  useEffect(() => {
    const audio = new Audio();
    audio.loop = true;
    audio.preload = 'none'; // Don't preload — only stream when play() is called
    audioRef.current = audio;

    audio.addEventListener('play', () => setIsPlaying(true));
    audio.addEventListener('pause', () => setIsPlaying(false));
    audio.addEventListener('ended', () => {
      setIsPlaying(false);
      if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current);
      playTimeoutRef.current = setTimeout(() => {
        if (!document.hidden) playMusic();
      }, 5000); // 5-second interval between songs
    });

    return () => {
      if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current);
      audio.pause();
      audio.src = '';
    };
  }, []);

  // Sync volume whenever settings change
  useEffect(() => {
    localStorage.setItem('masterVolume', masterVolume);
    localStorage.setItem('musicVolume', musicVolume);
    localStorage.setItem('sfxVolume', sfxVolume);
    localStorage.setItem('muted', muted);
    applyVolume();
  }, [masterVolume, musicVolume, sfxVolume, muted]);

  const playMusic = () => {
    if (themeSongs.length === 0) return;
    if (isPlaying) return;
    if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current);

    const audio = audioRef.current;
    if (!audio) return;

    let song;
    const primarySongs = themeSongs.filter(s => s.id === 0);
    const extraSongs = themeSongs.filter(s => s.id !== 0);

    if (extraSongs.length === 0) {
      song = primarySongs[0] || themeSongs[0];
      lastPlayedTypeRef.current = 'primary';
    } else {
      if (lastPlayedTypeRef.current !== 'primary') {
        song = primarySongs[0] || themeSongs[0];
        lastPlayedTypeRef.current = 'primary';
      } else {
        song = extraSongs[Math.floor(Math.random() * extraSongs.length)];
        lastPlayedTypeRef.current = 'extra';
      }
    }

    if (!song) return;

    setCurrentSong(song);

    // Theme song files are served from the backend (uploaded), 
    // default fallback is served from the frontend's own /assets
    const isBackendFile = song.id !== 0;
    const url = song.file_path.startsWith('/') ? song.file_path : `/${song.file_path}`;
    const fullUrl = isBackendFile ? `${API_URL}${url}` : url;

    if (audio.src !== fullUrl) {
      audio.src = fullUrl;
    }

    applyVolume();
    audio.play().catch(e => {
      // Autoplay blocked by browser policy — fine, user gesture will trigger it
      console.log('Music autoplay blocked:', e.message);
      setIsPlaying(false);
    });
  };

  const stopMusic = () => {
    if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current);
    const audio = audioRef.current;
    if (!audio) return;
    // Short fade-out
    const fadeDuration = 1000;
    const steps = 20;
    const startVol = audio.volume;
    let step = 0;
    const interval = setInterval(() => {
      step++;
      audio.volume = Math.max(0, startVol * (1 - step / steps));
      if (step >= steps) {
        clearInterval(interval);
        audio.pause();
        audio.currentTime = 0;
        setCurrentSong(null);
        applyVolume(); // Restore volume for next play
      }
    }, fadeDuration / steps);
  };

  const toggleMute = () => {
    setMuted(prev => {
      const next = !prev;
      if (audioRef.current) {
        audioRef.current.volume = getEffectiveVolume(masterVolume, musicVolume, next);
      }
      return next;
    });
  };

  return (
    <AudioContext.Provider value={{
      masterVolume, setMasterVolume,
      musicVolume, setMusicVolume,
      sfxVolume, setSfxVolume,
      muted, setMuted, toggleMute,
      playMusic, stopMusic, currentSong, isPlaying,
    }}>
      {children}
    </AudioContext.Provider>
  );
};

export const useAudio = () => useContext(AudioContext);