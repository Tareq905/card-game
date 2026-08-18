import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
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

  // Refs — avoid stale closures inside audio event listeners
  const audioRef = useRef(null);
  const themeSongsRef = useRef([]);
  const isPlayingRef = useRef(false);
  const masterVolumeRef = useRef(masterVolume);
  const musicVolumeRef = useRef(musicVolume);
  const mutedRef = useRef(muted);
  const wasPlayingBeforeHide = useRef(false);
  const lastPlayedTypeRef = useRef('none');
  const playTimeoutRef = useRef(null);

  // Keep refs in sync with state
  useEffect(() => { themeSongsRef.current = themeSongs; }, [themeSongs]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { masterVolumeRef.current = masterVolume; }, [masterVolume]);
  useEffect(() => { musicVolumeRef.current = musicVolume; }, [musicVolume]);
  useEffect(() => { mutedRef.current = muted; }, [muted]);

  const getEffectiveVolume = (master, music, isMuted) =>
    isMuted ? 0 : Math.min(1, master * music);

  const applyVolume = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.volume = getEffectiveVolume(
        masterVolumeRef.current,
        musicVolumeRef.current,
        mutedRef.current
      );
    }
  }, []);

  // Fetch theme songs from backend
  const loadThemeSongs = useCallback(() => {
    fetch(`${API_URL}/api/theme-songs`)
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) {
          setThemeSongs(data);
          themeSongsRef.current = data;
        } else {
          const fallback = [{
            id: 0,
            title: 'Default Theme',
            file_path: '/assets/sounds/bg-music.mp3',
            is_active: true
          }];
          setThemeSongs(fallback);
          themeSongsRef.current = fallback;
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    loadThemeSongs();
    const handleGlobalUpdate = () => loadThemeSongs();
    window.addEventListener('global_update', handleGlobalUpdate);
    return () => window.removeEventListener('global_update', handleGlobalUpdate);
  }, [loadThemeSongs]);

  // Core play — reads only refs so it's always fresh inside any callback
  const playMusicFromRef = useCallback(() => {
    const songs = themeSongsRef.current;
    if (!songs || songs.length === 0) return;
    if (isPlayingRef.current) return;

    const audio = audioRef.current;
    if (!audio) return;

    if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current);

    // Primary = default fallback (id === 0), Extra = admin-uploaded (id > 0)
    const primarySongs = songs.filter(s => s.id === 0);
    const extraSongs   = songs.filter(s => s.id !== 0);

    let song;
    if (extraSongs.length === 0) {
      song = primarySongs[0] || songs[0];
      lastPlayedTypeRef.current = 'primary';
    } else if (lastPlayedTypeRef.current !== 'primary') {
      // Always start with primary
      song = primarySongs.length > 0 ? primarySongs[0] : songs[0];
      lastPlayedTypeRef.current = 'primary';
    } else {
      // Alternate: play a random extra
      song = extraSongs[Math.floor(Math.random() * extraSongs.length)];
      lastPlayedTypeRef.current = 'extra';
    }

    if (!song) return;

    setCurrentSong(song);

    const isBackendFile = song.id !== 0;
    const rawPath = song.file_path.startsWith('/') ? song.file_path : `/${song.file_path}`;
    const fullUrl  = isBackendFile ? `${API_URL}${rawPath}` : rawPath;

    if (audio.src !== fullUrl) {
      audio.src = fullUrl;
      audio.load(); // Required after setting src on a used element
    }

    applyVolume();
    audio.play().catch(e => {
      console.log('Music autoplay blocked:', e.message);
      isPlayingRef.current = false;
      setIsPlaying(false);
    });
  }, [applyVolume]);

  // Create single <audio> element once — all listeners use refs
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'none'; // Don't preload — stream on demand
    audioRef.current = audio;

    audio.addEventListener('play', () => {
      isPlayingRef.current = true;
      setIsPlaying(true);
    });
    audio.addEventListener('pause', () => {
      isPlayingRef.current = false;
      setIsPlaying(false);
    });
    audio.addEventListener('ended', () => {
      isPlayingRef.current = false;
      setIsPlaying(false);
      // 5-second gap then play next song in playlist
      if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current);
      playTimeoutRef.current = setTimeout(() => {
        if (!document.hidden) playMusicFromRef();
      }, 5000);
    });
    audio.addEventListener('error', () => {
      isPlayingRef.current = false;
      setIsPlaying(false);
    });

    return () => {
      if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current);
      audio.pause();
      audio.src = '';
    };
  }, [playMusicFromRef]);

  // Pause when tab hidden, resume when visible again
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
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Persist volume settings and apply to audio element
  useEffect(() => {
    localStorage.setItem('masterVolume', masterVolume);
    localStorage.setItem('musicVolume', musicVolume);
    localStorage.setItem('sfxVolume', sfxVolume);
    localStorage.setItem('muted', muted);
    applyVolume();
  }, [masterVolume, musicVolume, sfxVolume, muted, applyVolume]);

  // Public: reset playing state then start
  const playMusic = useCallback(() => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    playMusicFromRef();
  }, [playMusicFromRef]);

  const stopMusic = useCallback(() => {
    if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current);
    const audio = audioRef.current;
    if (!audio) return;
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
        applyVolume(); // Restore volume for next play session
      }
    }, fadeDuration / steps);
  }, [applyVolume]);

  const toggleMute = useCallback(() => {
    setMuted(prev => {
      const next = !prev;
      mutedRef.current = next;
      if (audioRef.current) {
        audioRef.current.volume = getEffectiveVolume(
          masterVolumeRef.current,
          musicVolumeRef.current,
          next
        );
      }
      return next;
    });
  }, []);

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