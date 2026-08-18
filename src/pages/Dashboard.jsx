import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGame } from '../context/GameContext';
import { useAudio } from '../context/AudioContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { LogOut, Coins, Play, Plus, Users, Trophy, Music, Volume2, VolumeX, Pause, X, Video, Settings, Info, User } from 'lucide-react';
import PokerFusionRules from '../components/PokerFusionRules';
import { apiFetch } from '../config/api';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const {
    matchmakingStatus,
    queueSize,
    joinQueue,
    leaveQueue,
    createPrivateRoom,
    joinPrivateRoom,
    startPrivateMatch,
    privateRoom,
    setPrivateRoom,
    leavePrivateRoom
  } = useGame();
  
  const { showToast } = useToast();
  
  const {
    playMusic, currentSong, isPlaying, muted, toggleMute,
    masterVolume, setMasterVolume, musicVolume, setMusicVolume, sfxVolume, setSfxVolume
  } = useAudio();

  const [historyData, setHistoryData] = useState({ history: [], stats: { wins: 0, losses: 0, total_games: 0 } });
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [roomError, setRoomError] = useState('');
  const [startingRoom, setStartingRoom] = useState(false);
  
  // Modals
  const [showSettings, setShowSettings] = useState(false);
  const [showWallet, setShowWallet] = useState(false);
  const [showRules, setShowRules] = useState(false);
  
  const [processingPayment, setProcessingPayment] = useState(false);
  const [tokenBalance, setTokenBalance] = useState(user?.tokens || 0);

  const [themeSongsList] = useState([]); // managed via AdminDashboard
  
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [pendingAmount, setPendingAmount] = useState(null);
  const [showLeaveLobbyConfirm, setShowLeaveLobbyConfirm] = useState(false);
  const [adCountdown, setAdCountdown] = useState(null);

  useEffect(() => {
    fetchHistory();
    // Try to play immediately on dashboard entry
    playMusic();
    
    // Start theme song only on interactions within the dashboard (fallback for browser policy)
    const handleInteraction = (e) => {
      if (e.target.closest('.dashboard-container')) {
        playMusic();
        document.removeEventListener('click', handleInteraction);
      }
    };
    document.addEventListener('click', handleInteraction);
    return () => document.removeEventListener('click', handleInteraction);
  }, []);

  useEffect(() => {
    if (user) setTokenBalance(user.tokens);
  }, [user]);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const data = await apiFetch('/api/profile/history', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      setHistoryData(data);
    } catch (e) {
      console.error("Error fetching match history:", e.message);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleJoinPrivate = async (e) => {
    e.preventDefault();
    setRoomError('');
    if (!roomCodeInput) return;
    try {
      await joinPrivateRoom(roomCodeInput.trim().toUpperCase());
      setRoomCodeInput('');
    } catch (err) {
      setRoomError(err.message || 'Failed to join private room.');
    }
  };

  const handleStartPrivate = async () => {
    if (!privateRoom) return;
    setStartingRoom(true);
    try {
      await startPrivateMatch(privateRoom.code);
    } catch (err) {
      showToast(err.message || 'Could not start match.', 'error');
      setStartingRoom(false);
    }
  };

  // Poll private room updates
  useEffect(() => {
    let interval;
    let cancelled = false;

    if (privateRoom && matchmakingStatus === 'idle') {
      const pollRoom = async () => {
        try {
          const data = await apiFetch(`/api/game/private-room/${privateRoom.code}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          });
          if (!cancelled) setPrivateRoom(data);
        } catch (e) {
          // Only drop the room on a real "not found" (404) or auth (401/403) response.
          // Network hiccups / temporary server issues should NOT kick the player out.
          if (e.status === 404 || e.status === 401 || e.status === 403) {
            if (!cancelled) setPrivateRoom(null);
          } else {
            console.error('Room poll failed (will retry):', e.message);
          }
        }
      };
      interval = setInterval(pollRoom, 2000);
    }
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [privateRoom, matchmakingStatus]);
  
  // Wallet functions
  const handleBuyTokens = async (tier_id) => {
    setProcessingPayment(true);
    try {
      // 1. Create Payment
      let data;
      try {
        data = await apiFetch(`/api/payments/bkash/create?tier_id=${tier_id}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
      } catch (err) {
        if (err.data?.detail === "PHONE_REQUIRED") {
          setPendingAmount(tier_id);
          setShowPhoneModal(true);
          setShowWallet(false);
          setProcessingPayment(false);
          return;
        }
        throw err;
      }

      const paymentID = data.paymentID;
      
      // Simulate user redirect delay for sandbox
      await new Promise(r => setTimeout(r, 1500));
      
      // 2. Execute Payment
      data = await apiFetch(`/api/payments/bkash/execute?paymentID=${paymentID}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      setTokenBalance(data.tokens);
      showToast("Tokens added successfully!", 'success');
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setProcessingPayment(false);
    }
  };

  const submitPhone = async () => {
    try {
      await apiFetch(`/api/profile/phone?phone=${encodeURIComponent(phoneInput)}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      // Refresh user context or just proceed
      setShowPhoneModal(false);
      setShowWallet(true);
      if (pendingAmount) {
        handleBuyTokens(pendingAmount);
        setPendingAmount(null);
      }
    } catch (e) {
      alert(e.message);
    }
  };
  
  // Ad-reward flow — server-verified:
  // 1. /api/ads/start issues a one-time, server-timestamped token BEFORE the ad opens.
  // 2. We open the ad and wait (countdown + focus check).
  // 3. /api/ads/reward is called WITH that token; the backend checks it's unused,
  //    belongs to this user, and that enough time has actually elapsed server-side
  //    before granting tokens. This closes the old client-side-trust hole where
  //    /api/ads/reward could be called directly (e.g. via devtools) to farm tokens.
  const handleWatchAd = async () => {
    let adToken;
    try {
      const startData = await apiFetch('/api/ads/start', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      adToken = startData.token;
    } catch (e) {
      showToast(e.message || 'Could not start ad. Please try again.', 'error');
      return;
    }

    // Open Adsterra direct link in a new tab
    const ADSTERRA_LINK = 'https://www.effectivecpmnetwork.com/efg5sxzhuz?key=5c582272c64ee9504631bcd19055c01e';
    window.open(ADSTERRA_LINK, '_blank', 'noopener,noreferrer');

    // Countdown 30 seconds, then wait for focus to reward the user
    let count = 30;
    setAdCountdown(count);
    const timer = setInterval(() => {
      count -= 1;
      if (count > 0) {
        setAdCountdown(count);
      } else {
        clearInterval(timer);
        
        // Wait for the user to return to this tab
        const checkFocus = () => {
          if (document.visibilityState === 'visible' && document.hasFocus()) {
            window.removeEventListener('focus', checkFocus);
            document.removeEventListener('visibilitychange', checkFocus);
            setAdCountdown(null);
            
            // Grant tokens — backend validates the ad session token
            (async () => {
              try {
                const data = await apiFetch(`/api/ads/reward?token=${encodeURIComponent(adToken)}`, {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                setTokenBalance(data.tokens);
                showToast(`✅ Ad reward claimed! +20 tokens. (${data.views_today}/5 today)`, 'success');
              } catch (e) {
                showToast(e.message || 'Could not claim reward.', 'error');
              }
            })();
          }
        };

        if (document.visibilityState === 'visible' && document.hasFocus()) {
           checkFocus();
        } else {
           setAdCountdown("Waiting for you to return...");
           window.addEventListener('focus', checkFocus);
           document.addEventListener('visibilitychange', checkFocus);
        }
      }
    }, 1000);
  };


  // Admin logic moved to AdminDashboard.jsx

  return (
    <div className="dashboard-container" style={{
      minHeight: '100vh',
      background: 'radial-gradient(circle at 50% 20%, #1e293b 0%, #0f172a 100%)',
      padding: '30px 20px',
    }}>
      {/* Header */}
      <div style={{
        maxWidth: '1000px',
        margin: '0 auto 40px auto',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, fontFamily: 'var(--font-main)' }}>One Left</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Welcome, {user?.display_name || user?.email || 'Player'}</p>
        </div>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          {/* Now Playing Widget */}
          {currentSong && (
            <div className="glass-panel" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '6px 12px',
              borderRadius: '20px',
              cursor: 'pointer'
            }} onClick={() => setShowSettings(true)}>
              {isPlaying ? <Music size={14} className="spin" color="var(--accent-blue)"/> : <Pause size={14} />}
              <span style={{ fontSize: '12px', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentSong.title}
              </span>
              <button onClick={(e) => { e.stopPropagation(); toggleMute(); }} style={{ background: 'none', border: 'none', color: 'white', padding: 0 }}>
                {muted ? <VolumeX size={14} color="var(--accent-red)"/> : <Volume2 size={14} />}
              </button>
            </div>
          )}
          
          <div className="glass-panel" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '12px',
            fontWeight: 700,
            fontSize: '15px',
            color: 'var(--accent-yellow)',
            borderColor: 'rgba(245, 158, 11, 0.2)',
            cursor: 'pointer'
          }} onClick={() => setShowWallet(true)}>
            <Coins size={18} />
            <span>{tokenBalance} Tokens</span>
            <Plus size={14} style={{ marginLeft: '4px', opacity: 0.7 }} />
          </div>

          {user?.is_admin && (
            <button onClick={() => navigate('/admin')} className="btn-secondary" style={{ padding: '10px', borderRadius: '12px' }} title="Admin Panel">
              <Settings size={16} />
            </button>
          )}
          <button onClick={() => navigate('/profile')} className="btn-secondary" style={{ padding: '10px', borderRadius: '12px' }} title="My Profile">
            <User size={16} />
          </button>
          
          <button onClick={logout} className="btn-secondary" style={{ padding: '10px', borderRadius: '12px' }} title="Logout">
            <LogOut size={16} />
          </button>
        </div>
      </div>

      <div style={{
        maxWidth: '1000px',
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: '30px',
      }}>
        {matchmakingStatus === 'idle' && !privateRoom ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }} className="dashboard-grid">
            {/* ONLINE MODE */}
            <div className="glass-panel mode-card" style={{
              padding: '40px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(30,41,59,0.8))'
            }}>
              <div style={{ background: 'var(--accent-blue)', padding: '20px', borderRadius: '50%', marginBottom: '20px' }}>
                <Play size={40} fill="white" />
              </div>
              <h2 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '10px' }}>ONLINE</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>Match with random players worldwide.</p>
              
              <div style={{ display: 'flex', gap: '10px', width: '100%', marginBottom: '15px' }}>
                <button onClick={() => joinQueue('classic')} className="btn-primary" style={{ flex: 1, padding: '12px' }}>
                  Classic
                </button>
                <div style={{ display: 'flex', gap: '5px', flex: 1 }}>
                  <button onClick={() => joinQueue('poker')} className="btn-secondary" style={{ flex: 1, padding: '12px', background: 'rgba(139, 92, 246, 0.2)', borderColor: 'var(--accent-purple)' }}>
                    Poker Fusion
                  </button>
                  <button onClick={() => setShowRules(true)} className="btn-secondary" style={{ padding: '0 12px' }} title="Poker Fusion Rules">
                    <Info size={18} color="var(--accent-purple)" />
                  </button>
                </div>
              </div>
              
              <div style={{ color: 'var(--accent-yellow)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Coins size={16} /> Entry: 20 Tokens
              </div>
            </div>

            {/* PLAY WITH FRIEND */}
            <div className="glass-panel mode-card" style={{
              padding: '40px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(30,41,59,0.8))'
            }}>
              <div style={{ background: 'var(--accent-purple)', padding: '20px', borderRadius: '50%', marginBottom: '20px' }}>
                <Users size={40} color="white" />
              </div>
              <h2 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '10px' }}>PLAY WITH FRIEND</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>Create or join a private room.</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
                <button onClick={createPrivateRoom} className="btn-primary" style={{ padding: '12px' }}>
                  Create Room (-20 Tokens)
                </button>
                <form onSubmit={handleJoinPrivate} style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    placeholder="Enter Code"
                    value={roomCodeInput}
                    onChange={(e) => setRoomCodeInput(e.target.value)}
                    style={{
                      flex: 1,
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '10px',
                      padding: '10px',
                      color: 'white',
                      textAlign: 'center',
                      fontFamily: 'var(--font-mono)'
                    }}
                  />
                  <button type="submit" className="btn-secondary" style={{ padding: '10px 14px' }}>Join</button>
                </form>
                {roomError && <p style={{ color: 'var(--accent-red)', fontSize: '12px' }}>{roomError}</p>}
              </div>
            </div>
          </div>
        ) : (
          <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
            {matchmakingStatus === 'searching' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div className="searching-spinner" style={{
                  width: '60px', height: '60px', borderRadius: '50%',
                  border: '3px solid rgba(59, 130, 246, 0.1)', borderTopColor: 'var(--accent-blue)',
                  animation: 'spin 1s linear infinite', marginBottom: '20px'
                }} />
                <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '10px' }}>Finding players...</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>Players in Queue: <strong>{queueSize}/4</strong></p>
                <button onClick={() => setShowLeaveLobbyConfirm(true)} className="btn-danger" style={{ padding: '10px 24px', borderRadius: '10px' }}>Cancel Search</button>
              </div>
            )}
            
            {privateRoom && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '10px' }}>Private Room Lobby</h2>
                <div style={{
                  fontSize: '32px', fontWeight: 800, color: 'var(--accent-blue)',
                  letterSpacing: '5px', background: 'rgba(255,255,255,0.05)',
                  padding: '15px 30px', borderRadius: '12px', fontFamily: 'var(--font-mono)',
                  marginBottom: '30px'
                }}>{privateRoom.code}</div>
                
                <div style={{ width: '100%', maxWidth: '400px', marginBottom: '30px', textAlign: 'left' }}>
                  <p style={{ fontWeight: 600, marginBottom: '10px' }}>Players ({privateRoom.players.length}/4):</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {privateRoom.players.map((p, idx) => (
                      <div key={idx} style={{ background: 'rgba(255,255,255,0.05)', padding: '12px 16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{p.phone}</span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{p.id === privateRoom.creator_id ? 'Host' : 'Joined'}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '15px' }}>
                  {user?.id === privateRoom.creator_id ? (
                    <button onClick={handleStartPrivate} className="btn-primary" disabled={privateRoom.players.length < 2 || startingRoom} style={{ padding: '12px 24px' }}>
                      {startingRoom ? 'Starting...' : 'Start Match'}
                    </button>
                  ) : <div style={{ color: 'var(--text-secondary)' }}>Waiting for host to start...</div>}
                  <button onClick={() => setShowLeaveLobbyConfirm(true)} className="btn-secondary" style={{ padding: '12px 24px' }}>Leave Lobby</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* History Widget */}
        <div className="glass-panel" style={{ padding: '30px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Trophy size={18} style={{ color: 'var(--accent-yellow)' }} /> Match History
            </h3>
            <div style={{ display: 'flex', gap: '15px', color: 'var(--text-secondary)', fontSize: '14px' }}>
              <span>Wins: <strong style={{color: 'var(--accent-green)'}}>{historyData.stats.wins}</strong></span>
              <span>Losses: <strong style={{color: 'var(--accent-red)'}}>{historyData.stats.losses}</strong></span>
            </div>
          </div>

          {loadingHistory ? (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>Loading...</p>
          ) : historyData.history.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>No matches played yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {historyData.history.slice(0, 5).map((h, idx) => {
                const won = h.winner_id === user?.id;
                return (
                  <div key={idx} style={{
                    display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)',
                    padding: '12px 16px', borderRadius: '10px', borderLeft: `4px solid ${won ? 'var(--accent-green)' : 'var(--accent-red)'}`
                  }}>
                    <div>
                      <span style={{ fontWeight: 600, marginRight: '10px' }}>{won ? 'Victory' : 'Defeat'}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{h.game_id}</span>
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{new Date(h.created_at).toLocaleDateString()}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      
      {/* Phone Modal */}
      {showPhoneModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="glass-panel" style={{ width: '400px', padding: '30px', position: 'relative' }}>
            <button onClick={() => { setShowPhoneModal(false); setShowWallet(true); }} style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
              <X size={20} />
            </button>
            <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '10px' }}>Verify Phone</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '20px' }}>
              We need your phone number for secure bKash payments. You only need to do this once.
            </p>
            <input 
              type="text" 
              placeholder="e.g. 01700000000" 
              value={phoneInput} 
              onChange={e => setPhoneInput(e.target.value)}
              style={{
                width: '100%', padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--bg-panel-border)', color: 'white', marginBottom: '20px'
              }}
            />
            <button onClick={submitPhone} className="btn-primary" style={{ width: '100%', padding: '12px' }}>
              Verify & Continue
            </button>
          </div>
        </div>
      )}

      {/* Wallet Modal */}
      {showWallet && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="glass-panel" style={{ width: '400px', padding: '30px', position: 'relative' }}>
            <button onClick={() => setShowWallet(false)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
              <X size={20} />
            </button>
            <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Coins color="var(--accent-yellow)" /> Buy Tokens
            </h2>
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '10px', marginBottom: '20px', textAlign: 'center' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Current Balance</span>
              <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--accent-yellow)' }}>{tokenBalance}</div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              {[
                { id: 'tier_1', tokens: 100, bdt: 10 },
                { id: 'tier_2', tokens: 500, bdt: 20 },
                { id: 'tier_3', tokens: 10000, bdt: 50 },
                { id: 'tier_4', tokens: 100000, bdt: 100 }
              ].map(tier => (
                <button key={tier.id} onClick={() => handleBuyTokens(tier.id)} disabled={processingPayment} className="btn-secondary" style={{ display: 'flex', justifyContent: 'space-between', padding: '15px', borderRadius: '10px' }}>
                  <span style={{ fontWeight: 600 }}>{tier.tokens} Tokens</span>
                  <span style={{ color: 'var(--accent-blue)', fontWeight: 700 }}>৳{tier.bdt} (bKash)</span>
                </button>
              ))}
            </div>
            
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px' }}>
              <button
                onClick={handleWatchAd}
                disabled={adCountdown !== null}
                className="btn-primary"
                style={{ width: '100%', padding: '15px', display: 'flex', justifyContent: 'center', gap: '10px', opacity: adCountdown !== null ? 0.7 : 1 }}
              >
                <Video size={18} />
                {adCountdown !== null
                  ? (typeof adCountdown === 'number' ? `⏳ Reward in ${adCountdown}s... (keep the ad tab open!)` : `👀 ${adCountdown}`)
                  : 'Watch Ad for +20 Tokens'}
              </button>
              <p style={{ color: 'var(--text-secondary)', fontSize: '11px', textAlign: 'center', marginTop: '8px' }}>
                ⚠️ Ad content is filtered. No 18+, gambling, or alcohol ads.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="glass-panel" style={{ width: '350px', padding: '30px', position: 'relative' }}>
            <button onClick={() => setShowSettings(false)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
              <X size={20} />
            </button>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '20px' }}>Audio Settings</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                  <span>Master Volume</span>
                  <span>{Math.round(masterVolume * 100)}%</span>
                </label>
                <input type="range" min="0" max="1" step="0.01" value={masterVolume} onChange={e => setMasterVolume(parseFloat(e.target.value))} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                  <span>Music Volume</span>
                  <span>{Math.round(musicVolume * 100)}%</span>
                </label>
                <input type="range" min="0" max="1" step="0.01" value={musicVolume} onChange={e => setMusicVolume(parseFloat(e.target.value))} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                  <span>SFX Volume</span>
                  <span>{Math.round(sfxVolume * 100)}%</span>
                </label>
                <input type="range" min="0" max="1" step="0.01" value={sfxVolume} onChange={e => setSfxVolume(parseFloat(e.target.value))} style={{ width: '100%' }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {showRules && <PokerFusionRules onClose={() => setShowRules(false)} />}

      {/* Leave Lobby / Cancel Search Confirmation */}
      {showLeaveLobbyConfirm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="glass-panel" style={{ padding: '40px', maxWidth: '360px', width: '90%', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚪</div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '12px' }}>Are you sure?</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '28px', lineHeight: 1.6 }}>
              {privateRoom ? 'Leaving will remove you from the lobby.' : 'Canceling will remove you from the matchmaking queue.'}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => {
                  setShowLeaveLobbyConfirm(false);
                  if (privateRoom) leavePrivateRoom();
                  else leaveQueue();
                }}
                style={{ padding: '12px 24px', borderRadius: '12px', background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.5)', color: '#ef4444', fontWeight: 700, cursor: 'pointer' }}
              >
                Yes, Leave
              </button>
              <button
                onClick={() => setShowLeaveLobbyConfirm(false)}
                className="btn-primary"
                style={{ padding: '12px 24px', borderRadius: '12px' }}
              >
                Stay
              </button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @media(max-width: 768px) {
          .dashboard-grid { grid-template-columns: 1fr !important; }
        }
        .spin { animation: spin 2s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .mode-card:hover { transform: translateY(-5px); box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
      `}} />
    </div>
  );
}
