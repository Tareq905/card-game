import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Trophy, Medal, Star, ArrowLeft, User, Target, Zap, Shield, Crown } from 'lucide-react';
import { API_URL } from '../config/api';

const ACHIEVEMENTS_META = {
  first_win:       { label: 'First Win',         icon: '🏆', desc: 'Win your first match' },
  win_5:           { label: 'On a Roll',          icon: '🔥', desc: 'Win 5 matches' },
  win_25:          { label: 'Veteran Player',     icon: '⭐', desc: 'Win 25 matches' },
  poker_bonus:     { label: 'Poker Master',       icon: '🃏', desc: 'Trigger a Poker Fusion bonus' },
  caught_someone:  { label: 'Sharp Eye',          icon: '👁️', desc: 'Successfully catch a player with 1 card' },
  survived_draw4:  { label: 'Tank',               icon: '🛡️', desc: 'Survive a Wild Draw 4' },
  flawless:        { label: 'Flawless Victory',   icon: '✨', desc: 'Win without drawing any penalty cards' },
};

export default function Profile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
  }, [activeTab]);

  // Live-refresh: backend fires a 'global_update' event (via GameContext's websocket
  // handler) whenever one of this user's matches finishes, so stats/achievements
  // update without needing to leave and revisit the Profile page.
  useEffect(() => {
    const handleGlobalUpdate = () => {
      fetchAll();
    };
    window.addEventListener('global_update', handleGlobalUpdate);
    return () => window.removeEventListener('global_update', handleGlobalUpdate);
  }, [activeTab]);

  const fetchAll = async () => {
    setLoading(true);
    const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
    try {
      if (activeTab === 'profile') {
        const [pRes, hRes, aRes] = await Promise.all([
          fetch(`${API_URL}/api/profile`, { headers }),
          fetch(`${API_URL}/api/profile/history`, { headers }),
          fetch(`${API_URL}/api/profile/achievements`, { headers }),
        ]);
        if (pRes.ok && hRes.ok) {
          const pData = await pRes.json();
          const hData = await hRes.json();
          setProfile({ ...pData, ...hData });
        }
        if (aRes.ok) setAchievements(await aRes.json());
      } else {
        const res = await fetch(`${API_URL}/api/leaderboard`, { headers });
        if (res.ok) {
          const data = await res.json();
          setLeaderboard(data.leaderboard || []);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-main)', padding: '30px 20px', paddingBottom: '80px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '30px' }}>
          <button onClick={() => navigate('/')} className="btn-secondary" style={{ padding: '10px', borderRadius: '12px' }}>
            <ArrowLeft size={18} />
          </button>
          <h1 style={{ fontSize: '28px', fontWeight: 800 }}>
            {activeTab === 'profile' ? 'My Profile' : 'Leaderboard'}
          </h1>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '30px' }}>
          {[
            { key: 'profile', icon: <User size={16} />, label: 'Profile' },
            { key: 'leaderboard', icon: <Trophy size={16} />, label: 'Leaderboard' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={activeTab === tab.key ? 'btn-primary' : 'btn-secondary'}
              style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '12px' }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="glass-panel" style={{ padding: '60px', textAlign: 'center' }}>
            <div style={{ color: 'var(--text-secondary)' }}>Loading…</div>
          </div>
        ) : (
          <>
            {activeTab === 'profile' && profile && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className="glass-panel" style={{ padding: '30px', gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '25px' }}>
                  {profile.profile_picture_url ? (
                    <img src={profile.profile_picture_url} alt="avatar" style={{ width: '80px', height: '80px', borderRadius: '50%', border: '3px solid var(--accent-blue)' }} />
                  ) : (
                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: 800 }}>
                      {(profile.display_name || profile.email || '?')[0].toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '5px' }}>{profile.display_name || profile.email}</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>{profile.email}</p>
                    {profile.phone && <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>📞 {profile.phone}</p>}
                  </div>
                </div>

                {[
                  { label: 'Total Wins', value: profile.stats?.wins ?? 0, icon: <Trophy size={24} color="var(--accent-yellow)" />, color: 'var(--accent-yellow)' },
                  { label: 'Total Losses', value: profile.stats?.losses ?? 0, icon: <Target size={24} color="var(--accent-red)" />, color: 'var(--accent-red)' },
                  { label: 'Total Games', value: profile.stats?.total_games ?? 0, icon: <Zap size={24} color="var(--accent-blue)" />, color: 'var(--accent-blue)' },
                  { label: 'Win Rate', value: profile.stats?.total_games ? `${Math.round((profile.stats.wins / profile.stats.total_games) * 100)}%` : '—', icon: <Star size={24} color="var(--accent-green)" />, color: 'var(--accent-green)' },
                ].map((stat, i) => (
                  <div key={i} className="glass-panel" style={{ padding: '25px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ background: `${stat.color}22`, padding: '15px', borderRadius: '15px' }}>{stat.icon}</div>
                    <div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '4px' }}>{stat.label}</div>
                      <div style={{ fontSize: '28px', fontWeight: 800, color: stat.color }}>{stat.value}</div>
                    </div>
                  </div>
                ))}

                <div className="glass-panel" style={{ padding: '30px', gridColumn: '1 / -1' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Medal color="var(--accent-yellow)" size={20} /> Achievements
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '15px' }}>
                    {Object.entries(ACHIEVEMENTS_META).map(([key, meta]) => {
                      const unlocked = achievements.some(a => a.achievement_key === key);
                      return (
                        <div key={key} style={{
                          padding: '15px', borderRadius: '12px',
                          background: unlocked ? 'rgba(245, 158, 11, 0.1)' : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${unlocked ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.06)'}`,
                          opacity: unlocked ? 1 : 0.4,
                          textAlign: 'center'
                        }}>
                          <div style={{ fontSize: '32px', marginBottom: '8px' }}>{meta.icon}</div>
                          <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '4px' }}>{meta.label}</div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>{meta.desc}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {profile.history?.length > 0 && (
                  <div className="glass-panel" style={{ padding: '30px', gridColumn: '1 / -1' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>Recent Matches</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {profile.history.slice(0, 10).map((h, i) => {
                        const won = h.winner_id === user?.id;
                        return (
                          <div key={i} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '14px 18px', borderRadius: '10px',
                            background: 'rgba(255,255,255,0.03)',
                            borderLeft: `4px solid ${won ? 'var(--accent-green)' : 'var(--accent-red)'}`
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <span style={{ fontWeight: 700, color: won ? 'var(--accent-green)' : 'var(--accent-red)' }}>{won ? 'WIN' : 'LOSS'}</span>
                              <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Game #{h.game_id?.slice(-8)}</span>
                              {h.mode === 'poker' && <span style={{ background: 'rgba(139,92,246,0.2)', color: 'var(--accent-purple)', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 600 }}>Poker Fusion</span>}
                            </div>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{new Date(h.created_at).toLocaleDateString()}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'leaderboard' && (
              <div className="glass-panel" style={{ padding: '30px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {leaderboard.length === 0 && (
                    <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px' }}>No data yet. Play some matches!</p>
                  )}
                  {leaderboard.map((entry, i) => {
                    const isMe = entry.id === user?.id;
                    const rankColors = ['var(--accent-yellow)', 'rgba(192,192,192,1)', 'rgba(205,127,50,1)'];
                    return (
                      <div key={entry.id} style={{
                        display: 'flex', alignItems: 'center', gap: '20px',
                        padding: '16px 20px', borderRadius: '12px',
                        background: isMe ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.03)',
                        border: isMe ? '1px solid rgba(59,130,246,0.3)' : '1px solid rgba(255,255,255,0.05)',
                        transition: 'all 0.2s'
                      }}>
                        <div style={{
                          width: '36px', height: '36px', borderRadius: '50%',
                          background: i < 3 ? `${rankColors[i]}22` : 'rgba(255,255,255,0.05)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 800, fontSize: '16px',
                          color: i < 3 ? rankColors[i] : 'var(--text-secondary)'
                        }}>
                          {i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}
                        </div>
                        {entry.profile_picture_url ? (
                          <img src={entry.profile_picture_url} alt="" style={{ width: '42px', height: '42px', borderRadius: '50%' }} />
                        ) : (
                          <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'var(--accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                            {(entry.display_name || entry.email || '?')[0].toUpperCase()}
                          </div>
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: '15px' }}>
                            {entry.display_name || entry.email}
                            {isMe && <span style={{ marginLeft: '8px', fontSize: '11px', background: 'var(--accent-blue)', padding: '2px 8px', borderRadius: '10px' }}>YOU</span>}
                          </div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{entry.total_games} games played</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--accent-yellow)' }}>{entry.wins}</div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>wins</div>
                        </div>
                        <div style={{ textAlign: 'right', minWidth: '60px' }}>
                          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--accent-green)' }}>
                            {entry.total_games ? Math.round((entry.wins / entry.total_games) * 100) : 0}%
                          </div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>win rate</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
