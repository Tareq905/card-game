import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGame } from '../context/GameContext';
import { useAudio } from '../context/AudioContext';
import { Send, LogOut, MessageCircle, Volume2, VolumeX, ShieldAlert, Check, ShieldX, ChevronDown, ChevronUp } from 'lucide-react';

export default function GameRoom() {
  const { user } = useAuth();
  const { gameState, chatMessages, sendAction, quitGame, playSound } = useGame();
  const { stopMusic, setIsInGame } = useAudio();
  const [selectedCardId, setSelectedCardId] = useState(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [pendingWildCardId, setPendingWildCardId] = useState(null);
  const [chatInput, setChatInput] = useState('');
  const [muted, setMuted] = useState(localStorage.getItem('game_muted') === 'true');
  const [tableColor, setTableColor] = useState('rgba(16, 185, 129, 0.25)');
  const [showReport, setShowReport] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [pokerBonusToast, setPokerBonusToast] = useState(null);
  const prevPokerBonusRef = useRef(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [chatMinimized, setChatMinimized] = useState(false);
  const [chatMobileOpen, setChatMobileOpen] = useState(false);
  const [chatPos, setChatPos] = useState({ x: null, y: null }); // null = default CSS position
  const chatDragRef = useRef(null);
  const isDraggingChat = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const [draggedCardId, setDraggedCardId] = useState(null);
  const [mobileLayout, setMobileLayout] = useState(() => {
    return window.innerWidth < window.innerHeight ? 'vertical' : 'horizontal';
  });

  // Auto-rotate/resize orientation detector
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setMobileLayout(window.innerWidth < window.innerHeight ? 'vertical' : 'horizontal');
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Stop background music during gameplay
  useEffect(() => {
    setIsInGame(true);
    return () => {
      setIsInGame(false);
    };
  }, [setIsInGame]);

  // Draggable chat panel
  const onChatPointerDown = useCallback((e) => {
    // Only drag from header, ignore buttons inside
    if (e.target.closest('button')) return;
    isDraggingChat.current = true;
    const panel = chatDragRef.current;
    const rect = panel.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    panel.setPointerCapture(e.pointerId);
  }, []);

  const onChatPointerMove = useCallback((e) => {
    if (!isDraggingChat.current) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    const panel = chatDragRef.current;
    const pw = panel.offsetWidth, ph = panel.offsetHeight;
    const newX = Math.max(0, Math.min(e.clientX - dragOffset.current.x, vw - pw));
    const newY = Math.max(0, Math.min(e.clientY - dragOffset.current.y, vh - ph));
    setChatPos({ x: newX, y: newY });
  }, []);

  const onChatPointerUp = useCallback(() => {
    isDraggingChat.current = false;
  }, []);

  // Shuffled table ambient color per match
  useEffect(() => {
    if (gameState?.game_id) {
      const colors = [
        'rgba(16, 185, 129, 0.25)', // green
        'rgba(139, 92, 246, 0.25)', // purple
        'rgba(59, 130, 246, 0.25)',  // blue
        'rgba(245, 158, 11, 0.25)'   // yellow
      ];
      // Pick a semi-random color index based on the hash of game_id
      let hash = 0;
      for (let i = 0; i < gameState.game_id.length; i++) {
        hash = gameState.game_id.charCodeAt(i) + ((hash << 5) - hash);
      }
      const index = Math.abs(hash) % colors.length;
      setTableColor(colors[index]);
    }
  }, [gameState?.game_id]);

  // Set HTML root css variables for muted state
  useEffect(() => {
    localStorage.setItem('game_muted', muted ? 'true' : 'false');
    // If not muted, toggle audio volume
    // GameContext playSound handles this by checking browser policy/volume
  }, [muted]);

  // Keyboard Shortcuts handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore key events when typing in chat
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handleDrawCard();
      } else if (e.key.toLowerCase() === 'p') {
        handlePass();
      } else if (e.key.toLowerCase() === 'y') {
        handleYell();
      } else if (e.key === 'Escape') {
        setSelectedCardId(null);
      } else if (e.key >= '1' && e.key <= '9') {
        // Select card in hand by index
        const myPlayer = gameState?.players.find(p => p.id === user?.id);
        if (myPlayer) {
          const cardIndex = parseInt(e.key) - 1;
          if (cardIndex < myPlayer.hand.length) {
            setSelectedCardId(myPlayer.hand[cardIndex].id);
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, user]);

  // Show Poker Fusion bonus toast
  useEffect(() => {
    if (gameState?.poker_bonus_active && gameState.poker_bonus_active !== prevPokerBonusRef.current) {
      prevPokerBonusRef.current = gameState.poker_bonus_active;
      const b = gameState.poker_bonus_active;
      let msg = '';
      if (b.type === 'all_draw_1') msg = '🃏 Poker Fusion! All opponents draw 1 card!';
      else if (b.type === 'skip_next') msg = '🃏 Poker Fusion! Next player will be skipped!';
      setPokerBonusToast(msg);
      setTimeout(() => setPokerBonusToast(null), 4000);
    }
  }, [gameState?.poker_bonus_active]);

  if (!gameState) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0e17',
        gap: '20px'
      }}>
        <div style={{
          width: '50px',
          height: '50px',
          border: '3px solid rgba(255,255,255,0.05)',
          borderTopColor: 'var(--accent-blue)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <p style={{ color: 'var(--text-secondary)' }}>Connecting to match session...</p>
      </div>
    );
  }

  const myPlayer = gameState.players.find(p => p.id === user?.id);
  const otherPlayers = gameState.players.filter(p => p.id !== user?.id);
  const isMyTurn = gameState.current_turn_player_id === user?.id;

  const handleCardClick = (card) => {
    if (!isMyTurn) return;
    if (selectedCardId === card.id) {
      // Double click or click twice to play card
      playSelectedCard(card);
    } else {
      setSelectedCardId(card.id);
      playSound('click');
    }
  };

  const playSelectedCard = (card) => {
    if (card.color === 'wild') {
      setPendingWildCardId(card.id);
      setShowColorPicker(true);
    } else {
      try {
        sendAction('play_card', { card_id: card.id });
        setSelectedCardId(null);
      } catch (err) {
        alert(err.message);
      }
    }
  };

  const selectWildColor = (color) => {
    if (pendingWildCardId) {
      sendAction('play_card', { card_id: pendingWildCardId, wild_color: color });
      setPendingWildCardId(null);
      setShowColorPicker(false);
      setSelectedCardId(null);
    }
  };

  const handleDrawCard = () => {
    if (!isMyTurn) return;
    sendAction('draw_card');
  };

  const handlePass = () => {
    if (!isMyTurn) return;
    sendAction('pass');
  };

  const handleYell = () => {
    sendAction('yell_one_left');
  };

  const handleCatch = (targetId) => {
    sendAction('catch_player', { target_id: targetId });
  };

  const handleSendChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendAction('send_chat', { message: chatInput.trim() });
    setChatInput('');
  };

  // Card fan positions calculator — accepts isSelected to blend lift into the same transform
  const getCardStyle = (index, totalCards, isSelected = false) => {
    const angleStep = totalCards > 8 ? 4 : 6;
    const startAngle = -((totalCards - 1) * angleStep) / 2;
    const rotation = startAngle + index * angleStep;
    
    // Spread horizontal
    const spreadWidth = Math.min(25, 240 / totalCards);
    const translationX = (index - (totalCards - 1) / 2) * spreadWidth;
    // Arch effect
    const translationY = Math.abs(rotation) * 0.4;

    // Selection: lift the card from its exact fan position (no snapping to center)
    const liftY = isSelected ? -45 : 0;
    const scaleVal = isSelected ? 1.15 : 1;
    
    return {
      '--rot': `${rotation}deg`,
      transform: `translateX(calc(-50% + ${translationX}px)) translateY(${translationY + liftY}px) rotate(${rotation}deg) scale(${scaleVal})`,
      zIndex: isSelected ? 101 : index,
      left: '50%',
      transition: 'transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.18s ease',
    };
  };

  // Detect if someone ran away
  const playerRanAway = gameState?.system_messages?.includes('__PLAYER_RAN_AWAY__');
  const ranAwayPlayer = gameState?.system_messages?.find(m => m.startsWith('🏃'))?.replace('🏃 ', '').replace(' ran away from the game!', '') || 'A player';
  // Is this client the one who ran (they get quit_ack and gameState cleared)
  const iAmABystander = playerRanAway && gameState?.game_over;

  return (
    <div className={`game-table-container layout-${mobileLayout}`} style={{
      backgroundImage: `radial-gradient(circle at center, ${tableColor} 0%, rgba(10, 14, 23, 1) 75%), url('/assets/cards/back/table-bg.png')`
    }}>
      {/* Leave confirmation modal */}
      {showLeaveConfirm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="glass-panel" style={{ padding: '40px', maxWidth: '380px', width: '90%', textAlign: 'center', border: '1px solid rgba(239,68,68,0.3)' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚪</div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '12px' }}>Leave the Match?</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '30px', fontSize: '14px', lineHeight: 1.6 }}>
              Leaving will <strong style={{color:'var(--accent-red)'}}>end the game for everyone</strong>. Your opponents will know you ran away! 😅
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => { setShowLeaveConfirm(false); quitGame(); }}
                className="btn-danger"
                style={{ padding: '12px 28px', borderRadius: '12px', background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.5)', color: '#ef4444', fontWeight: 700, cursor: 'pointer' }}
              >
                Yes, Leave
              </button>
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="btn-primary"
                style={{ padding: '12px 28px', borderRadius: '12px' }}
              >
                Stay & Play
              </button>
            </div>
          </div>
        </div>
      )}

      {/* "Sigh! He ran away" popup for bystanders */}
      {iAmABystander && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9998,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="glass-panel" style={{ padding: '50px 40px', maxWidth: '440px', width: '90%', textAlign: 'center', border: '1px solid rgba(245,158,11,0.3)' }}>
            <div style={{ fontSize: '64px', marginBottom: '20px' }}>🏃💨</div>
            <h2 style={{ fontSize: '28px', fontWeight: 900, marginBottom: '12px', background: 'linear-gradient(135deg, #f59e0b, #ef4444)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Sigh!
            </h2>
            <p style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>He ran away.</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '16px', marginBottom: '30px' }}>The game is over!!!</p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginBottom: '30px' }}>({ranAwayPlayer} couldn't handle the pressure 😂)</p>
            <button
              onClick={quitGame}
              className="btn-primary"
              style={{ padding: '14px 36px', borderRadius: '14px', fontSize: '16px', fontWeight: 700 }}
            >
              Back to Lobby
            </button>
          </div>
        </div>
      )}

      {/* HUD Header */}
      <div className="hud-header" style={{
        width: '100%',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 50,
        flexShrink: 0,
      }}>
        {/* Left group */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => setShowLeaveConfirm(true)} className="btn-secondary" style={{ padding: '7px 12px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', fontSize: '13px' }}>
            <LogOut size={15} />
            <span className="hud-label-leave">Leave</span>
          </button>
          <button 
            onClick={() => setMobileLayout(prev => prev === 'vertical' ? 'horizontal' : 'vertical')}
            className="btn-secondary mobile-layout-toggle"
            style={{ 
              padding: '7px 12px', 
              borderRadius: '10px', 
              background: 'rgba(255,255,255,0.02)', 
              fontSize: '13px',
              display: 'none',
            }}
          >
            📱 {mobileLayout === 'vertical' ? 'Vertical' : 'Horizontal'}
          </button>
          {/* Game mode badge */}
          {gameState.mode === 'poker' && (
            <div style={{ fontSize: '11px', fontWeight: 700, background: 'rgba(139,92,246,0.2)', color: 'var(--accent-purple)', padding: '5px 10px', borderRadius: '8px', border: '1px solid rgba(139,92,246,0.3)', whiteSpace: 'nowrap' }}>
              🃏 Poker Fusion
            </div>
          )}
          <div style={{
            fontSize: '12px',
            color: isMyTurn ? 'var(--accent-green)' : 'var(--text-secondary)',
            fontWeight: 700,
            background: isMyTurn ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.02)',
            padding: '6px 12px',
            borderRadius: '8px',
            border: isMyTurn ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(255,255,255,0.05)',
            whiteSpace: 'nowrap',
          }}>
            {isMyTurn ? '🟢 YOUR TURN' : '⚪ WAITING...'}
          </div>
        </div>

        {/* Right group */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button
            onClick={() => setMuted(!muted)}
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: '10px',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#fff',
              flexShrink: 0,
            }}
          >
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          {gameState.active_color && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(255,255,255,0.03)',
              padding: '5px 10px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.05)',
              fontSize: '12px',
              whiteSpace: 'nowrap',
            }}>
              <span style={{ display: 'none' }} className="color-label">Color:</span>
              <span style={{
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                background: {
                  red: 'var(--accent-red)',
                  blue: 'var(--accent-blue)',
                  green: 'var(--accent-green)',
                  yellow: 'var(--accent-yellow)'
                }[gameState.active_color] || '#fff',
                display: 'inline-block',
                flexShrink: 0,
                boxShadow: '0 0 8px rgba(255,255,255,0.2)'
              }} />
              <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{gameState.active_color}</span>
            </div>
          )}
        </div>
      </div>

      {/* Opponents Layout on Table */}
      <div className="opponents-container" style={{
        position: 'absolute',
        top: '100px',
        left: '20px',
        right: '20px',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'flex-start',
        zIndex: 40,
        gap: '10px',
        flexWrap: 'wrap',
      }}>
        {otherPlayers.map((player) => {
          const isPlayerTurn = gameState.current_turn_player_id === player.id;
          const hasOneCard = player.card_count === 1;
          const yelled = gameState.yelled_one_left[player.id];

          // Generate a consistent color from the player's name/id
          const hue = Math.abs((player.phone || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), player.id || 0)) % 360;
          const avatarColor = `hsl(${hue}, 60%, 55%)`;
          const initials = (player.phone || '?').slice(0, 2).toUpperCase();

          return (
            <div key={player.id} style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              opacity: player.is_active ? 1 : 0.45,
              transition: 'opacity 0.3s ease',
              minWidth: '90px',
              position: 'relative',
            }}>
              {/* Avatar ring + circle */}
              <div style={{ position: 'relative' }}>
                {/* Animated ring when it's this player's turn */}
                {isPlayerTurn && (
                  <div className="opponent-avatar-ring" style={{
                    position: 'absolute',
                    inset: '-6px',
                    borderRadius: '50%',
                    border: '2.5px solid var(--accent-blue)',
                    boxShadow: '0 0 18px rgba(59,130,246,0.6)',
                    animation: 'spin 2s linear infinite',
                    zIndex: 1,
                  }} />
                )}

                {/* Card count badge */}
                <div className="opponent-card-count" style={{
                  position: 'absolute',
                  top: '-6px',
                  right: '-6px',
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  background: hasOneCard ? 'var(--accent-red)' : 'rgba(20,26,42,0.95)',
                  border: `2px solid ${hasOneCard ? 'var(--accent-red)' : 'rgba(255,255,255,0.15)'}`,
                  fontSize: '10px',
                  fontWeight: 800,
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 3,
                  boxShadow: hasOneCard ? '0 0 10px rgba(239,68,68,0.6)' : 'none',
                  animation: hasOneCard ? 'pulse-badge 1.2s ease-in-out infinite' : 'none',
                }}>
                  {player.card_count}
                </div>

                {/* Avatar circle */}
                <div className="opponent-avatar" style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  background: `linear-gradient(135deg, ${avatarColor}, hsl(${hue + 40}, 50%, 40%))`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                  fontWeight: 800,
                  color: '#fff',
                  boxShadow: `0 4px 14px hsla(${hue},60%,40%,0.4)`,
                  border: '2px solid rgba(255,255,255,0.12)',
                  userSelect: 'none',
                  zIndex: 2,
                  position: 'relative',
                }}>
                  {initials}
                </div>
              </div>

              {/* Player name */}
              <span className="opponent-name" style={{
                fontSize: '12px',
                fontWeight: 700,
                color: isPlayerTurn ? 'var(--accent-blue)' : '#fff',
                textAlign: 'center',
                maxWidth: '90px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                textShadow: isPlayerTurn ? '0 0 10px rgba(59,130,246,0.6)' : 'none',
              }}>
                {player.phone}{!player.is_active && ' 📴'}
              </span>

              {/* "Thinking..." status when it's their turn */}
              {isPlayerTurn && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  background: 'rgba(59,130,246,0.12)',
                  border: '1px solid rgba(59,130,246,0.3)',
                  borderRadius: '20px',
                  padding: '3px 10px',
                  fontSize: '11px',
                  color: 'var(--accent-blue)',
                  fontWeight: 600,
                  letterSpacing: '0.02em',
                }}>
                  <span style={{ animation: 'thinking-dot 1.4s ease-in-out infinite' }}>●</span>
                  <span>Thinking…</span>
                </div>
              )}

              {/* ONE LEFT badge */}
              {hasOneCard && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                  <span style={{
                    fontSize: '10px', fontWeight: 800, padding: '3px 8px', borderRadius: '20px',
                    background: yelled ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                    border: `1px solid ${yelled ? 'var(--accent-green)' : 'var(--accent-red)'}`,
                    color: yelled ? 'var(--accent-green)' : 'var(--accent-red)',
                    letterSpacing: '0.05em',
                  }}>
                    {yelled ? '✅ YELLED!' : '⚠️ ONE LEFT!'}
                  </span>
                  {!yelled && (
                    <button onClick={() => handleCatch(player.id)} className="btn-danger"
                      style={{ padding: '4px 10px', fontSize: '10px', borderRadius: '8px', fontWeight: 800 }}>
                      CATCH!
                    </button>
                  )}
                </div>
              )}

              {/* Report button */}
              {!player.is_bot && (
                <button
                  onClick={() => { setReportTarget(player); setShowReport(true); }}
                  style={{ background: 'none', border: 'none', color: 'rgba(239,68,68,0.4)', cursor: 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '3px' }}
                >
                  <ShieldX size={11} /> Report
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Discard & Draw Pile Central Area */}
      <div className="play-area">
        {/* Draw Pile */}
        <div onClick={handleDrawCard} className="deck-pile">
          <div className="deck-card-face" style={{
            backgroundImage: "url('/assets/cards/back/card-back.png')",
            border: isMyTurn ? '2px solid rgba(59, 130, 246, 0.4)' : '1px solid rgba(255,255,255,0.1)'
          }} />
          {isMyTurn && (
            <div className="draw-hint" style={{
              position: 'absolute',
              bottom: '-25px',
              fontSize: '11px',
              color: 'var(--accent-blue)',
              fontWeight: 700
            }}>
              DRAW (SPACE)
            </div>
          )}
        </div>

        {/* Discard Pile — also acts as drop target */}
        <div
          className="discard-pile-ui"
          onDragOver={(e) => { if (draggedCardId && isMyTurn) { e.preventDefault(); setDropHighlight(true); } }}
          onDragLeave={() => setDropHighlight(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDropHighlight(false);
            if (draggedCardId && isMyTurn) {
              const card = myPlayer?.hand.find(c => c.id === draggedCardId);
              if (card) playSelectedCard(card);
              setDraggedCardId(null);
              setSelectedCardId(null);
            }
          }}
          onTouchEnd={(e) => {
            // Touch drop: check if finger ended over discard area
            if (!draggedCardId || !isMyTurn) return;
            const touch = e.changedTouches[0];
            const el = document.elementFromPoint(touch.clientX, touch.clientY);
            if (el && el.closest('.discard-pile-ui')) {
              const card = myPlayer?.hand.find(c => c.id === draggedCardId);
              if (card) playSelectedCard(card);
              setDraggedCardId(null);
              setSelectedCardId(null);
            }
            setDropHighlight(false);
          }}
          style={dropHighlight ? { boxShadow: '0 0 30px rgba(16,185,129,0.7)', border: '2px solid var(--accent-green)' } : {}}
        >
          {gameState.discard_top ? (
            <div className="discard-top-card" style={{
              backgroundImage: `url(${gameState.discard_top.asset_path})`
            }} />
          ) : (
            <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Empty</div>
          )}
        </div>
      </div>

      {/* Chat Panel — draggable on desktop, bottom-sheet on mobile */}
      <div
        ref={chatDragRef}
        className={`glass-panel chat-drawer ${chatMobileOpen ? 'open' : ''}`}
        onPointerMove={onChatPointerMove}
        onPointerUp={onChatPointerUp}
        style={{
          position: 'fixed',
          // On mobile CSS overrides this; on desktop, use dragged pos or default
          ...(window.innerWidth > 768 && chatPos.x !== null
            ? { left: chatPos.x, top: chatPos.y }
            : window.innerWidth > 768
              ? { right: 20, top: 80 }
              : {}
          ),
          width: window.innerWidth > 768 ? '300px' : undefined,
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transition: isDraggingChat.current ? 'none' : 'height 0.2s ease',
          height: window.innerWidth > 768 ? (chatMinimized ? '48px' : '420px') : undefined,
          userSelect: 'none',
        }}
      >
        {/* Draggable Header */}
        <div
          onPointerDown={onChatPointerDown}
          style={{
            padding: '12px 16px',
            borderBottom: chatMinimized ? 'none' : '1px solid var(--bg-panel-border)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'grab',
            flexShrink: 0,
          }}
        >
          <MessageCircle size={16} />
          <h3 style={{ fontSize: '14px', fontWeight: 700, flex: 1 }}>Match Chat</h3>
          <button
            onClick={() => setChatMinimized(m => !m)}
            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
            title={chatMinimized ? 'Expand' : 'Minimize'}
          >
            {chatMinimized ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        </div>

        {!chatMinimized && (
          <>
            <div style={{
              flex: 1,
              padding: '12px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              {chatMessages.map((msg, idx) => (
                <div key={idx} style={{
                  background: 'rgba(255,255,255,0.02)',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  fontSize: '13px'
                }}>
                  <strong style={{ color: 'var(--accent-blue)', fontSize: '12px', display: 'block' }}>{msg.sender}</strong>
                  <span style={{ color: '#fff' }}>{msg.text}</span>
                </div>
              ))}
              {gameState.system_messages?.map((msg, idx) => (
                <div key={`sys_${idx}`} style={{
                  background: 'rgba(59, 130, 246, 0.05)',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  border: '1px solid rgba(59, 130, 246, 0.1)',
                  color: 'var(--text-secondary)'
                }}>
                  {msg}
                </div>
              ))}
            </div>
            <form onSubmit={handleSendChat} style={{
              padding: '10px',
              borderTop: '1px solid var(--bg-panel-border)',
              display: 'flex',
              gap: '8px',
              flexShrink: 0,
            }}>
              <input
                type="text"
                placeholder="Type message..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--bg-panel-border)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  color: 'white',
                  fontSize: '13px',
                  outline: 'none'
                }}
              />
              <button type="submit" className="btn-primary" style={{ padding: '8px 12px', borderRadius: '8px', flexShrink: 0 }}>
                <Send size={14} />
              </button>
            </form>
          </>
        )}
      </div>

      {/* User Hand and Bottom Actions */}
      <div style={{
        width: '100%',
        maxWidth: '800px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        alignItems: 'center',
        zIndex: 50,
        flexShrink: 0,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}>
        {/* Buttons Controls */}
        <div className="action-buttons-container" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={handleYell}
            className="btn-danger"
            style={{
              padding: '10px 18px',
              fontSize: '13px',
              borderRadius: '10px',
              fontWeight: 800,
              boxShadow: '0 0 15px rgba(239, 68, 68, 0.4)',
              whiteSpace: 'nowrap',
            }}
          >
            <span className="btn-full-label">YELL "ONE LEFT" (Y)</span>
            <span className="btn-short-label" style={{ display: 'none' }}>YELL ONE LEFT</span>
          </button>
          
          {isMyTurn && (
            <>
              {selectedCardId && (
                <button
                  onClick={() => {
                    const card = myPlayer.hand.find(c => c.id === selectedCardId);
                    if (card) playSelectedCard(card);
                  }}
                  className="btn-primary"
                  style={{ padding: '10px 18px', fontSize: '13px', borderRadius: '10px', whiteSpace: 'nowrap' }}
                >
                  ▶ Play Card
                </button>
              )}
              <button
                onClick={handlePass}
                className="btn-secondary"
                style={{ padding: '10px 18px', fontSize: '13px', borderRadius: '10px', whiteSpace: 'nowrap' }}
              >
                <span className="btn-full-label">Pass (P)</span>
                <span className="btn-short-label" style={{ display: 'none' }}>Pass</span>
              </button>
            </>
          )}
        </div>

        {/* Hand Cards */}
        <div className="card-hand-fan">
          {myPlayer?.hand.map((card, idx) => {
            const isSelected = selectedCardId === card.id;
            return (
              <div
                key={card.id}
                draggable={isMyTurn}
                onClick={() => handleCardClick(card)}
                onDoubleClick={() => {
                  if (isMyTurn) playSelectedCard(card);
                }}
                onDragStart={(e) => {
                  if (!isMyTurn) { e.preventDefault(); return; }
                  setDraggedCardId(card.id);
                  setSelectedCardId(card.id);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragEnd={() => setDraggedCardId(null)}
                // Touch drag support
                onTouchStart={() => {
                  if (!isMyTurn) return;
                  setDraggedCardId(card.id);
                  setSelectedCardId(card.id);
                }}
                onTouchEnd={() => {
                  // Touch drop handled on discard-pile-ui
                  setTimeout(() => setDraggedCardId(null), 100);
                }}
                className={`card-item ${isSelected ? 'selected' : ''} ${draggedCardId === card.id ? 'dragging' : ''}`}
                style={{
                  backgroundImage: `url(${card.asset_path})`,
                  ...getCardStyle(idx, myPlayer.hand.length, isSelected),
                  cursor: isMyTurn ? 'grab' : 'default',
                  opacity: draggedCardId === card.id ? 0.5 : 1,
                }}
              />
            );
          })}
        </div>

      </div>

      {/* Wild Color Picker Overlay Modal */}
      {showColorPicker && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 200
        }}>
          <div className="glass-panel" style={{
            padding: '30px 40px',
            textAlign: 'center',
            maxWidth: '360px'
          }}>
            <h3 style={{ marginBottom: '20px', fontSize: '18px', fontWeight: 700 }}>Choose Color</h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '15px',
              marginBottom: '20px'
            }}>
              <button
                onClick={() => selectWildColor('red')}
                style={{
                  background: 'var(--accent-red)',
                  color: 'white',
                  border: 'none',
                  padding: '20px',
                  borderRadius: '12px',
                  fontSize: '15px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(239, 68, 68, 0.4)'
                }}
              >
                Red
              </button>
              <button
                onClick={() => selectWildColor('blue')}
                style={{
                  background: 'var(--accent-blue)',
                  color: 'white',
                  border: 'none',
                  padding: '20px',
                  borderRadius: '12px',
                  fontSize: '15px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)'
                }}
              >
                Blue
              </button>
              <button
                onClick={() => selectWildColor('green')}
                style={{
                  background: 'var(--accent-green)',
                  color: 'white',
                  border: 'none',
                  padding: '20px',
                  borderRadius: '12px',
                  fontSize: '15px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)'
                }}
              >
                Green
              </button>
              <button
                onClick={() => selectWildColor('yellow')}
                style={{
                  background: 'var(--accent-yellow)',
                  color: 'white',
                  border: 'none',
                  padding: '20px',
                  borderRadius: '12px',
                  fontSize: '15px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(245, 158, 11, 0.4)'
                }}
              >
                Yellow
              </button>
            </div>
            <button
              onClick={() => {
                setShowColorPicker(false);
                setPendingWildCardId(null);
                setSelectedCardId(null);
              }}
              className="btn-secondary"
              style={{ width: '100%', padding: '10px' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Disconnect Warning Overlay */}
      {myPlayer && !myPlayer.is_active && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 300
        }}>
          <div className="glass-panel" style={{
            padding: '30px 40px',
            textAlign: 'center',
            maxWidth: '360px',
            borderColor: 'rgba(239,68,68,0.2)'
          }}>
            <ShieldAlert size={48} style={{ color: 'var(--accent-red)', marginBottom: '15px' }} />
            <h3 style={{ marginBottom: '10px', fontSize: '18px', fontWeight: 700 }}>Connection Lost</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '20px' }}>
              Attempting to reconnect. Do not leave the window to keep your spot in the match.
            </p>
          </div>
        </div>
      )}

      {/* Game Over / Victory Overlay */}
      {gameState.game_over && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 400
        }}>
          <div className="glass-panel" style={{
            padding: '40px 50px',
            textAlign: 'center',
            maxWidth: '500px',
            width: '100%'
          }}>
            <h2 style={{
              fontSize: '32px',
              fontWeight: 800,
              color: gameState.winner_id === user?.id ? 'var(--accent-green)' : 'var(--accent-red)',
              marginBottom: '15px'
            }}>
              {gameState.winner_id === user?.id ? 'VICTORY!' : 'DEFEAT'}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '15px', marginBottom: '20px' }}>
              {gameState.winner_id === user?.id 
                ? 'Excellent match! You shed all your cards successfully.' 
                : `Player ${gameState.players.find(p => p.id === gameState.winner_id)?.phone || 'Opponent'} won the match.`
              }
            </p>
            
            {/* Adsterra Impression Ad Banner Mock */}
            <div style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px dashed rgba(255,255,255,0.2)',
              borderRadius: '8px',
              padding: '20px',
              marginBottom: '30px',
              cursor: 'pointer'
            }} onClick={() => window.open('https://adsterra.com', '_blank')}>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginBottom: '5px' }}>ADVERTISEMENT</span>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--accent-yellow)' }}>
                Play More, Win More!
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Click here to claim your exclusive bonus.</div>
            </div>

            <button onClick={quitGame} className="btn-primary" style={{ width: '100%', padding: '12px' }}>
              Return to Dashboard
            </button>
          </div>
        </div>
      )}
      {/* Poker Fusion Bonus Toast */}
      {pokerBonusToast && (
        <div style={{
          position: 'absolute', top: '80px', left: '50%', transform: 'translateX(-50%)',
          background: 'linear-gradient(135deg, rgba(139,92,246,0.9), rgba(59,130,246,0.9))',
          padding: '14px 28px', borderRadius: '12px', zIndex: 500,
          fontWeight: 700, fontSize: '16px', whiteSpace: 'nowrap',
          boxShadow: '0 8px 30px rgba(139,92,246,0.5)',
          animation: 'fadeInDown 0.4s ease',
        }}>
          {pokerBonusToast}
        </div>
      )}

      {/* Report Player Modal */}
      {showReport && reportTarget && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)', zIndex: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="glass-panel" style={{ width: '380px', padding: '30px' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '10px', color: 'var(--accent-red)' }}>
              <ShieldAlert size={20} style={{ marginRight: '8px' }} />
              Report Player
            </h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '14px' }}>
              Reporting: <strong>{reportTarget.phone}</strong>
            </p>
            <select
              value={reportReason}
              onChange={e => setReportReason(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', marginBottom: '15px' }}
            >
              <option value="">Select a reason…</option>
              <option value="cheating">Cheating / Exploiting</option>
              <option value="harassment">Verbal Harassment</option>
              <option value="afk">Intentional AFK</option>
              <option value="bug_abuse">Bug Abuse</option>
              <option value="other">Other</option>
            </select>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn-secondary" style={{ flex: 1, padding: '12px' }} onClick={() => { setShowReport(false); setReportReason(''); }}>Cancel</button>
              <button
                className="btn-danger"
                style={{ flex: 1, padding: '12px' }}
                disabled={!reportReason}
                onClick={async () => {
                  try {
                    await fetch('/api/game/report', {
                      method: 'POST',
                      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
                      body: JSON.stringify({ game_id: gameState.game_id, reported_id: reportTarget.id, reason: reportReason })
                    });
                    setShowReport(false);
                    setReportReason('');
                    alert('Report submitted. Thank you.');
                  } catch (e) { alert('Failed to send report.'); }
                }}
              >
                Submit Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Chat FAB */}
      <button className="chat-fab" onClick={() => setChatMobileOpen(!chatMobileOpen)}>
        <MessageCircle size={24} />
      </button>
    </div>
  );
}
