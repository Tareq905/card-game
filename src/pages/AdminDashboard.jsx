import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Users, AlertTriangle, Music, DollarSign, Shield, X, Check, Trash2, Ban, Bot, Pause, Play, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config/api';

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('users');
  const [data, setData] = useState({ users: [], reports: [], revenue: null, themeSongs: [], songRequests: [], suspiciousTxns: [] });
  const [loading, setLoading] = useState(true);
  const [aiMonitor, setAiMonitor] = useState({ status: 'active', log: [] });
  const [aiLoading, setAiLoading] = useState(false);
  
  // Ban Modal State
  const [showBanModal, setShowBanModal] = useState(false);
  const [banTarget, setBanTarget] = useState(null);
  const [banReason, setBanReason] = useState("");
  const [banDuration, setBanDuration] = useState(1);
  const [customDays, setCustomDays] = useState("");
  const [warningText, setWarningText] = useState({});

  useEffect(() => {
    if (user && !user.is_admin) {
      navigate('/');
    } else if (user) {
      fetchData();
    }
  }, [user, activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${localStorage.getItem('token')}` };
      
      let res;
      if (activeTab === 'users') {
        res = await fetch(`${API_URL}/api/admin/users`, { headers });
        if (res.ok) { const users = await res.json(); setData(d => ({ ...d, users })); }
      } else if (activeTab === 'reports') {
        res = await fetch(`${API_URL}/api/admin/reports`, { headers });
        if (res.ok) { const reports = await res.json(); setData(d => ({ ...d, reports })); }
      } else if (activeTab === 'revenue') {
        res = await fetch(`${API_URL}/api/admin/revenue`, { headers });
        if (res.ok) { const revenue = await res.json(); setData(d => ({ ...d, revenue })); }
      } else if (activeTab === 'music') {
        const resThemes = await fetch(`${API_URL}/api/theme-songs`, { headers });
        const resReqs = await fetch(`${API_URL}/api/admin/song-requests`, { headers });
        if (resThemes.ok && resReqs.ok) {
          const themeSongs = await resThemes.json();
          const songRequests = await resReqs.json();
          setData(d => ({ ...d, themeSongs, songRequests }));
        }
      } else if (activeTab === 'suspicious') {
        res = await fetch(`${API_URL}/api/admin/suspicious-txns`, { headers });
        if (res.ok) { const suspiciousTxns = await res.json(); setData(d => ({ ...d, suspiciousTxns })); }
      } else if (activeTab === 'ai_monitor') {
        setAiLoading(true);
        try {
          const r = await fetch(`${API_URL}/api/admin/ai-monitor/status`, { headers });
          if (r.ok) setAiMonitor(await r.json());
        } finally { setAiLoading(false); }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const submitBan = async () => {
    let days = banDuration === 'custom' ? parseInt(customDays) : banDuration;
    if (!days || days <= 0) return alert("Invalid duration");
    
    const url = `${API_URL}/api/admin/ban/${banTarget.id}?reason=${encodeURIComponent(banReason)}&days=${days}`;
    try {
      await fetch(url, { method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }});
      setShowBanModal(false);
      setBanReason("");
      setBanDuration(1);
      fetchData();
    } catch (e) { alert(e.message); }
  };

  const handleUnbanUser = async (userId) => {
    try {
      await fetch(`${API_URL}/api/admin/unban/${userId}?reason=Admin action`, { method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }});
      fetchData();
    } catch (e) { alert(e.message); }
  };

  const handleDeleteUser = async (u) => {
    if (!window.confirm(`⚠️ Permanently delete "${u.display_name || u.email}"?\n\nThis will:\n• Delete their account forever\n• Blacklist their Gmail so they cannot re-register\n\nThis CANNOT be undone.`)) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${u.id}?reason=Deleted by admin`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) { const d = await res.json(); alert(d.detail || 'Delete failed'); return; }
      fetchData();
    } catch (e) { alert(e.message); }
  };

  const handleWarnUser = async (u) => {
    const msg = warningText[u.id];
    if (!msg || !msg.trim()) return alert("Please enter a warning message first.");
    
    try {
      const res = await fetch(`${API_URL}/api/admin/warn/${u.id}?message=${encodeURIComponent(msg)}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) { const d = await res.json(); alert(d.detail || 'Warning failed'); return; }
      alert("Warning broadcasted to all users!");
      setWarningText(prev => ({...prev, [u.id]: ''}));
    } catch (e) { alert(e.message); }
  };

  const handleUpdateReport = async (reportId, status) => {
    try {
      await fetch(`${API_URL}/api/admin/reports/${reportId}?new_status=${status}`, { method: 'PUT', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }});
      fetchData();
    } catch (e) { alert(e.message); }
  };

  const handleUploadTheme = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    try {
      const res = await fetch(`${API_URL}/api/admin/theme-songs`, { method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }, body: formData });
      if (res.ok) { fetchData(); e.target.reset(); }
      else alert((await res.json()).detail);
    } catch (e) { alert(e.message); }
  };

  const handleDeleteTheme = async (id) => {
    try {
      await fetch(`${API_URL}/api/admin/theme-songs/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }});
      fetchData();
    } catch (e) { alert(e.message); }
  };

  if (!user || !user.is_admin) return null;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-main)', padding: '30px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Shield color="var(--accent-purple)" /> Admin Dashboard
          </h1>
          <button onClick={() => navigate('/')} className="btn-secondary" style={{ padding: '10px 20px' }}>Back to Game</button>
        </div>

        <div style={{ display: 'flex', gap: '20px' }}>
          {/* Sidebar */}
          <div className="glass-panel" style={{ width: '250px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button onClick={() => setActiveTab('users')} className={activeTab === 'users' ? 'btn-primary' : 'btn-secondary'} style={{ padding: '12px', display: 'flex', justifyContent: 'flex-start', gap: '10px' }}>
              <Users size={18} /> Users
            </button>
            <button onClick={() => setActiveTab('reports')} className={activeTab === 'reports' ? 'btn-primary' : 'btn-secondary'} style={{ padding: '12px', display: 'flex', justifyContent: 'flex-start', gap: '10px' }}>
              <AlertTriangle size={18} /> Reports
            </button>
            <button onClick={() => setActiveTab('suspicious')} className={activeTab === 'suspicious' ? 'btn-primary' : 'btn-secondary'} style={{ padding: '12px', display: 'flex', justifyContent: 'flex-start', gap: '10px' }}>
              <Shield size={18} /> Suspicious Txns
            </button>
            <button onClick={() => setActiveTab('revenue')} className={activeTab === 'revenue' ? 'btn-primary' : 'btn-secondary'} style={{ padding: '12px', display: 'flex', justifyContent: 'flex-start', gap: '10px' }}>
              <DollarSign size={18} /> Revenue
            </button>
            <button onClick={() => setActiveTab('music')} className={activeTab === 'music' ? 'btn-primary' : 'btn-secondary'} style={{ padding: '12px', display: 'flex', justifyContent: 'flex-start', gap: '10px' }}>
              <Music size={18} /> Music
            </button>
            <button onClick={() => setActiveTab('ai_monitor')} className={activeTab === 'ai_monitor' ? 'btn-primary' : 'btn-secondary'} style={{ padding: '12px', display: 'flex', justifyContent: 'flex-start', gap: '10px' }}>
              <Bot size={18} /> AI Monitor
            </button>
          </div>

          {/* Main Content */}
          <div className="glass-panel" style={{ flex: 1, padding: '30px', minHeight: '600px' }}>
            {loading ? <p>Loading...</p> : (
              <>
                {/* USERS TAB */}
                {activeTab === 'users' && (
                  <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '20px' }}>User Management</h2>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
                          <th style={{ padding: '10px' }}>ID</th>
                          <th style={{ padding: '10px' }}>Email / Name</th>
                          <th style={{ padding: '10px' }}>Tokens</th>
                          <th style={{ padding: '10px' }}>Status</th>
                          <th style={{ padding: '10px' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.users.map(u => (
                          <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <td style={{ padding: '10px' }}>{u.id}</td>
                            <td style={{ padding: '10px' }}>{u.display_name || u.email}<br/><span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{u.phone}</span></td>
                            <td style={{ padding: '10px' }}>{u.tokens}</td>
                            <td style={{ padding: '10px' }}>
                              {u.is_admin ? <span style={{ color: 'var(--accent-purple)' }}>Admin</span> : 
                               u.is_banned ? <span style={{ color: 'var(--accent-red)' }}>Banned</span> : 'Active'}
                            </td>
                            <td style={{ padding: '10px' }}>
                              {!u.is_admin && (
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                  <input 
                                    type="text" 
                                    placeholder="Warning message..." 
                                    value={warningText[u.id] || ''}
                                    onChange={(e) => setWarningText({...warningText, [u.id]: e.target.value})}
                                    style={{ padding: '6px', fontSize: '12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: 'white', width: '130px' }}
                                  />
                                  <button onClick={() => handleWarnUser(u)} className="btn-primary" style={{ padding: '6px 10px', fontSize: '12px', borderRadius: '6px' }}>Warn</button>
                                  
                                  {u.is_banned ? 
                                  <button onClick={() => handleUnbanUser(u.id)} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>Unban</button> :
                                  <button onClick={() => {
                                    setBanTarget(u);
                                    setShowBanModal(true);
                                  }} className="btn-danger" style={{ padding: '6px 12px', fontSize: '12px' }}>Ban</button>
                                  }
                                  <button
                                    onClick={() => handleDeleteUser(u)}
                                    title="Permanently delete account & blacklist email"
                                    style={{
                                      padding: '6px 10px', fontSize: '12px', borderRadius: '8px',
                                      background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
                                      color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                                    }}
                                  >
                                    <Trash2 size={13} /> Delete
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* REPORTS TAB */}
                {activeTab === 'reports' && (
                  <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '20px' }}>In-Game Reports</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                      {data.reports.map(r => (
                        <div key={r.id} style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 600 }}>Reporter: {r.reporter_id} &rarr; Reported: {r.reported_id}</div>
                            <div style={{ color: 'var(--accent-red)', fontSize: '14px', marginTop: '5px' }}>Reason: {r.reason}</div>
                            {r.notes && <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Notes: {r.notes}</div>}
                            <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '5px' }}>Game ID: {r.game_id} • Status: {r.status}</div>
                          </div>
                          {r.status === 'pending' && (
                            <div style={{ display: 'flex', gap: '10px' }}>
                              <button onClick={() => handleUpdateReport(r.id, 'reviewed')} className="btn-primary" style={{ padding: '8px', borderRadius: '8px' }}><Check size={16} /></button>
                              <button onClick={() => handleUpdateReport(r.id, 'dismissed')} className="btn-secondary" style={{ padding: '8px', borderRadius: '8px' }}><X size={16} /></button>
                            </div>
                          )}
                        </div>
                      ))}
                      {data.reports.length === 0 && <p style={{ color: 'var(--text-secondary)' }}>No reports found.</p>}
                    </div>
                  </div>
                )}

                {/* REVENUE TAB */}
                {activeTab === 'revenue' && data.revenue && (
                  <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '20px' }}>Financial & Ad Metrics</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                      <div className="glass-panel" style={{ padding: '30px', textAlign: 'center', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                        <div style={{ color: 'var(--text-secondary)', marginBottom: '10px' }}>Real Revenue (bKash)</div>
                        <div style={{ fontSize: '36px', fontWeight: 800, color: 'var(--accent-green)' }}>৳{data.revenue.total_bdt || 0}</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '10px' }}>{data.revenue.transactions || 0} Successful Txns</div>
                      </div>
                      
                      <div className="glass-panel" style={{ padding: '30px', textAlign: 'center', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                        <div style={{ color: 'var(--text-secondary)', marginBottom: '10px' }}>Purchased Tokens</div>
                        <div style={{ fontSize: '36px', fontWeight: 800, color: 'var(--accent-yellow)' }}>{data.revenue.total_tokens_sold || 0}</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '10px' }}>Distributed to players</div>
                      </div>
                    </div>
                    
                    <h3 style={{ fontSize: '18px', fontWeight: 600, marginTop: '30px', marginBottom: '15px' }}>Adsterra Ad Views (Today)</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                      <div style={{ background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '16px' }}>Total Ad Rewards Claimed</div>
                          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Server-side limit (Max 5/day per user)</div>
                        </div>
                        <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--accent-blue)' }}>{data.revenue.total_ad_views_today || 0} views</div>
                      </div>
                      
                      <div style={{ background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '16px' }}>Self-Reported SmartLink Views</div>
                          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Views completed via the 30-second tab-focus flow</div>
                        </div>
                        <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--accent-purple)' }}>{data.revenue.self_reported_ad_views_today || 0} views</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* MUSIC TAB */}
                {activeTab === 'music' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                    <div>
                      <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '20px' }}>Manage Theme Songs</h2>
                      <form onSubmit={handleUploadTheme} style={{ display: 'flex', flexDirection: 'column', gap: '15px', background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '15px', marginBottom: '20px' }}>
                        <input type="text" name="title" placeholder="Song Title" required style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} />
                        <input type="file" name="file" accept="audio/*" required style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} />
                        <button type="submit" className="btn-primary" style={{ padding: '12px' }}>Upload Theme Song (Max 2)</button>
                      </form>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {data.themeSongs.map(song => (
                          <div key={song.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '10px' }}>
                            <div style={{ fontWeight: 600 }}>{song.title}</div>
                            <button onClick={() => handleDeleteTheme(song.id)} className="btn-danger" style={{ padding: '8px', borderRadius: '8px' }}><Trash2 size={16} /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '20px' }}>User Song Requests</h2>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {data.songRequests.map(req => (
                          <div key={req.id} style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '10px' }}>
                            <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '5px' }}>User {req.user_id} requested:</div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '14px', fontStyle: 'italic' }}>"{req.song_text}"</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '10px' }}>{new Date(req.created_at).toLocaleString()}</div>
                          </div>
                        ))}
                        {data.songRequests.length === 0 && <p style={{ color: 'var(--text-secondary)' }}>No song requests yet.</p>}
                      </div>
                    </div>
                  </div>
                )}
                {/* SUSPICIOUS TRANSACTIONS TAB */}
                {activeTab === 'suspicious' && (
                  <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '20px' }}>Suspicious Transactions</h2>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', overflow: 'hidden' }}>
                      <thead style={{ background: 'rgba(255,255,255,0.1)' }}>
                        <tr>
                          <th style={{ padding: '12px' }}>Invoice ID</th>
                          <th style={{ padding: '12px' }}>User ID</th>
                          <th style={{ padding: '12px' }}>Expected BDT</th>
                          <th style={{ padding: '12px' }}>Reported BDT</th>
                          <th style={{ padding: '12px' }}>Status</th>
                          <th style={{ padding: '12px' }}>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.suspiciousTxns.map(tx => (
                          <tr key={tx.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <td style={{ padding: '10px' }}>{tx.invoice_id}</td>
                            <td style={{ padding: '10px' }}>{tx.user_id}</td>
                            <td style={{ padding: '10px', color: 'var(--accent-green)' }}>৳{tx.amount}</td>
                            <td style={{ padding: '10px', color: tx.amount !== tx.bkash_reported_amount ? 'var(--accent-red)' : 'var(--text-primary)' }}>
                              {tx.bkash_reported_amount !== null ? `৳${tx.bkash_reported_amount}` : 'N/A'}
                            </td>
                            <td style={{ padding: '10px', color: 'var(--accent-red)' }}>{tx.status}</td>
                            <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>{new Date(tx.created_at).toLocaleDateString()}</td>
                          </tr>
                        ))}
                        {data.suspiciousTxns.length === 0 && (
                          <tr><td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>No suspicious transactions found.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
                {activeTab === 'ai_monitor' && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Bot size={22} color="var(--accent-purple)" /> AI Safety Monitor
                        </h2>
                        <span style={{
                          padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 700,
                          background: aiMonitor.status === 'active' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                          color: aiMonitor.status === 'active' ? 'var(--accent-green)' : 'var(--accent-red)',
                          border: `1px solid ${aiMonitor.status === 'active' ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`,
                        }}>
                          {aiMonitor.status === 'active' ? '🟢 ACTIVE' : '🔴 PAUSED'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={async () => {
                            const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
                            const endpoint = aiMonitor.status === 'active' ? 'pause' : 'resume';
                            await fetch(`${API_URL}/api/admin/ai-monitor/${endpoint}`, { method: 'POST', headers });
                            fetchData();
                          }}
                          className={aiMonitor.status === 'active' ? 'btn-danger' : 'btn-primary'}
                          style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
                        >
                          {aiMonitor.status === 'active' ? <><Pause size={14}/> Pause AI</> : <><Play size={14}/> Resume AI</>}
                        </button>
                        <button onClick={fetchData} className="btn-secondary" style={{ padding: '8px 12px' }}>
                          <RefreshCw size={14} />
                        </button>
                      </div>
                    </div>

                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px' }}>
                      AI Monitor automatically detects abusive language, harassment, gambling, and threats in game chat.
                      It issues progressive warnings (1→2→Ban) for conduct violations and instantly bans confirmed gambling activity.
                    </p>

                    <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>Recent Enforcement Actions ({aiMonitor.log.length})</h3>

                    {aiLoading ? (
                      <p style={{ color: 'var(--text-secondary)' }}>Loading enforcement log...</p>
                    ) : aiMonitor.log.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.03)', borderRadius: '12px' }}>
                        <Bot size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
                        <p>No violations detected yet. AI Monitor is watching.</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '500px', overflowY: 'auto' }}>
                        {aiMonitor.log.map((entry, i) => (
                          <div key={i} style={{
                            background: entry.action === 'ban' ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)',
                            border: `1px solid ${entry.action === 'ban' ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.25)'}`,
                            borderRadius: '10px', padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px'
                          }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                                <span style={{
                                  padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
                                  background: entry.action === 'ban' ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)',
                                  color: entry.action === 'ban' ? '#ef4444' : '#f59e0b'
                                }}>
                                  {entry.action === 'ban' ? '⛔ BANNED' : '⚠️ WARNED'}
                                </span>
                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>User #{entry.user_id}</span>
                                <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: '6px' }}>{entry.violation_type}</span>
                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
                                  {new Date(entry.timestamp * 1000).toLocaleTimeString()}
                                </span>
                              </div>
                              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontStyle: 'italic', marginBottom: '4px' }}>
                                "{entry.message}"
                              </div>
                              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                AI: {entry.reason} <span style={{ opacity: 0.6 }}>({Math.round((entry.confidence || 0) * 100)}% confidence)</span>
                              </div>
                            </div>
                            <button
                              onClick={async () => {
                                await fetch(`${API_URL}/api/admin/ai-monitor/clear-warnings/${entry.user_id}`, {
                                  method: 'DELETE',
                                  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                                });
                                alert(`Warnings cleared for User #${entry.user_id}`);
                              }}
                              title="Clear AI warnings for this user"
                              style={{ padding: '5px 8px', fontSize: '11px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap' }}
                            >
                              Clear Warnings
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Ban Modal */}
        {showBanModal && banTarget && (
          <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.85)', zIndex: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <div className="glass-panel" style={{ width: '400px', padding: '30px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '20px', color: 'var(--accent-red)' }}>
                Ban {banTarget.display_name || banTarget.email}
              </h3>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>Reason:</label>
                <input
                  type="text"
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                  placeholder="e.g. Exploiting bugs"
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>Duration:</label>
                <select
                  value={banDuration}
                  onChange={(e) => setBanDuration(e.target.value === 'custom' ? 'custom' : parseInt(e.target.value))}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', marginBottom: banDuration === 'custom' ? '10px' : '0' }}
                >
                  <option value={1} style={{ background: '#1e293b' }}>1 Day</option>
                  <option value={3} style={{ background: '#1e293b' }}>3 Days</option>
                  <option value={7} style={{ background: '#1e293b' }}>7 Days</option>
                  <option value={14} style={{ background: '#1e293b' }}>14 Days</option>
                  <option value={40} style={{ background: '#1e293b' }}>40 Days</option>
                  <option value={36500} style={{ background: '#1e293b' }}>100 Years (Permanent)</option>
                  <option value="custom" style={{ background: '#1e293b' }}>Custom Days...</option>
                </select>
                {banDuration === 'custom' && (
                  <input
                    type="number"
                    min="1"
                    value={customDays}
                    onChange={(e) => setCustomDays(e.target.value)}
                    placeholder="Enter number of days"
                    style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                  />
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn-secondary" style={{ flex: 1, padding: '12px' }} onClick={() => setShowBanModal(false)}>Cancel</button>
                <button
                  className="btn-danger"
                  style={{ flex: 1, padding: '12px' }}
                  onClick={submitBan}
                  disabled={!banReason || (banDuration === 'custom' && !customDays)}
                >
                  Confirm Ban
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
