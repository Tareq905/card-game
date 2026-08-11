import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';

const GameContext = createContext(null);

export const GameProvider = ({ children }) => {
  const { token } = useAuth();
  const [gameState, setGameState] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [matchmakingStatus, setMatchmakingStatus] = useState('idle'); // idle, searching, matched
  const [queueSize, setQueueSize] = useState(0);
  const [privateRoom, setPrivateRoom] = useState(null);
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // Sound assets refs
  const soundsRef = useRef({
    deal: new Audio('/assets/sounds/card-deal.mp3'),
    play: new Audio('/assets/sounds/card-play.mp3'),
    draw: new Audio('/assets/sounds/card-deal.mp3'), // fallback or card deal sound
    shuffle: new Audio('/assets/sounds/card-shuffle.mp3'),
    click: new Audio('/assets/sounds/button-click.mp3'),
    win: new Audio('/assets/sounds/win.mp3'),
    lose: new Audio('/assets/sounds/lose.mp3'),
  });

  const playSound = (name) => {
    try {
      const audio = soundsRef.current[name];
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(e => console.log("Sound play prevented by browser policy"));
      }
    } catch (e) {
      console.error("Error playing sound:", e);
    }
  };

  useEffect(() => {
    if (token) {
      connectSocket();
    } else {
      disconnectSocket();
    }
    return () => {
      disconnectSocket();
    };
  }, [token]);

  const connectSocket = () => {
    if (!token) return;
    if (socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/game?token=${encodeURIComponent(token)}`;
    
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      console.log('Game WebSocket connected');
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'match_found':
          setMatchmakingStatus('matched');
          playSound('shuffle');
          break;
        case 'game_state':
          const oldState = gameState;
          const newState = message.data;
          
          setGameState(newState);
          setMatchmakingStatus('matched');

          // Trigger appropriate sounds based on state diffs
          if (oldState) {
            // Check if card counts changed
            const oldTop = oldState.discard_top?.id;
            const newTop = newState.discard_top?.id;
            if (newTop && oldTop !== newTop) {
              playSound('play');
            } else if (JSON.stringify(oldState.players) !== JSON.stringify(newState.players)) {
              playSound('deal');
            }
            // Check if game over
            if (newState.game_over && !oldState.game_over) {
              const currentUserId = oldState.players.find(p => p.hand.length > 0)?.id;
              if (newState.winner_id === currentUserId) {
                playSound('win');
              } else {
                playSound('lose');
              }
            }
          } else {
            playSound('deal');
          }
          break;
        case 'chat':
          setChatMessages(prev => [...prev, message]);
          break;
        case 'error':
          alert(message.message);
          break;
        case 'quit_ack':
          // Server confirmed the game exit — no action needed (state already cleared optimistically)
          break;
        default:
          break;
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      console.log('Game WebSocket closed. Reconnecting in 3s...');
      // Reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connectSocket();
      }, 3000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      ws.close();
    };
  };

  const disconnectSocket = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.onclose = null; // Prevent reconnect on explicit close
      socketRef.current.close();
      socketRef.current = null;
    }
    setIsConnected(false);
    setGameState(null);
    setChatMessages([]);
  };

  const sendAction = (action, extraData = {}) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ action, ...extraData }));
      playSound('click');
    } else {
      console.error('Socket is not open. Action ignored:', action);
    }
  };

  // REST endpoints integration
  const joinQueue = async (mode = 'classic') => {
    playSound('click');
    try {
      const res = await fetch(`/api/matchmaking/join?mode=${encodeURIComponent(mode)}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setMatchmakingStatus('searching');
        pollMatchmakingStatus();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const leaveQueue = async () => {
    playSound('click');
    try {
      const res = await fetch('/api/matchmaking/leave', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setMatchmakingStatus('idle');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const pollMatchmakingStatus = async () => {
    // Basic polling utility to keep queue sizes synced in UI
    if (matchmakingStatus !== 'searching') return;
    try {
      const res = await fetch('/api/matchmaking/status');
      if (res.ok) {
        const data = await res.json();
        setQueueSize(data.queue_size);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Run queue status poll
  useEffect(() => {
    let interval;
    if (matchmakingStatus === 'searching') {
      pollMatchmakingStatus();
      interval = setInterval(pollMatchmakingStatus, 2000);
    } else {
      setQueueSize(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [matchmakingStatus]);

  // Private room REST actions
  const createPrivateRoom = async () => {
    playSound('click');
    try {
      const res = await fetch('/api/game/private-room', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPrivateRoom(data);
        return data;
      }
    } catch (e) {
      console.error(e);
    }
  };

  const joinPrivateRoom = async (code) => {
    playSound('click');
    try {
      const res = await fetch(`/api/game/private-room/join?code=${encodeURIComponent(code)}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setPrivateRoom(data);
        return data;
      } else {
        throw new Error(data.detail || "Failed to join private room");
      }
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const startPrivateMatch = async (code) => {
    playSound('click');
    try {
      const res = await fetch(`/api/game/private-room/${code}/start`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        // Game will be notified via socket matchmaking callback
        return data;
      } else {
        throw new Error(data.detail || "Failed to start match");
      }
    } catch (e) {
      console.error(e);
      throw e;
    }
  };


  const leavePrivateRoom = async () => {
    playSound('click');
    // Tell the backend to remove us from the room Redis state
    if (privateRoom?.code) {
      try {
        await fetch(`/api/game/private-room/${privateRoom.code}/leave`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch (e) {
        console.error('Failed to leave private room on backend:', e);
      }
    }
    setPrivateRoom(null);
  };


  const quitGame = () => {
    playSound('click');

    // Tell the server to cleanly remove this player from the game.
    // We'll wait for a quit_ack before reconnecting, or fall back after 2s.
    const ws = socketRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: 'quit_game' }));
    }

    // Optimistically clear local state immediately so the UI switches to Dashboard
    setGameState(null);
    setChatMessages([]);
    setMatchmakingStatus('idle');
    setPrivateRoom(null);

    // Reconnect after a short delay to get a fresh connection (server cleanup happens async)
    disconnectSocket();
    setTimeout(connectSocket, 1000);
  };

  return (
    <GameContext.Provider
      value={{
        gameState,
        chatMessages,
        isConnected,
        matchmakingStatus,
        queueSize,
        privateRoom,
        setPrivateRoom,
        joinQueue,
        leaveQueue,
        createPrivateRoom,
        joinPrivateRoom,
        startPrivateMatch,
        leavePrivateRoom,
        sendAction,
        quitGame,
        playSound
      }}
    >
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => useContext(GameContext);
