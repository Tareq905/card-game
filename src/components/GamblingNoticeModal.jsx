import React, { useState } from 'react';
import { AlertOctagon, CheckSquare, Square } from 'lucide-react';

export default function GamblingNoticeModal({ onAgree }) {
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleAgree = async () => {
    if (!agreed) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/profile/agree_terms', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        onAgree();
      } else {
        throw new Error("Failed to record agreement.");
      }
    } catch (e) {
      alert(e.message);
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
      background: 'rgba(0,0,0,0.9)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(10px)'
    }}>
      <div className="glass-panel" style={{ width: '500px', maxWidth: '90%', padding: '40px', textAlign: 'center', border: '1px solid var(--accent-red)' }}>
        <AlertOctagon size={64} color="var(--accent-red)" style={{ margin: '0 auto 20px auto' }} />
        <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '20px', color: 'var(--accent-red)' }}>
          Important Notice
        </h2>
        
        <div style={{ textAlign: 'left', marginBottom: '30px', color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: '15px' }}>
          <p style={{ marginBottom: '15px' }}>
            <strong>One Left</strong> is strictly a recreational game. Real-money gambling, wagering, and side-betting are <strong>strictly prohibited</strong> on this platform.
          </p>
          <p style={{ marginBottom: '15px' }}>
            Tokens purchased in-game have <strong>no cash value</strong> and cannot be withdrawn, exchanged, or redeemed for real money.
          </p>
          <p>
            Any player found arranging real-money bets through the chat system or otherwise violating these terms will face an <strong>immediate permanent ban</strong>.
          </p>
        </div>

        <div 
          onClick={() => setAgreed(!agreed)}
          style={{ 
            display: 'flex', alignItems: 'center', gap: '15px', padding: '15px', 
            background: 'rgba(255,255,255,0.05)', borderRadius: '10px', marginBottom: '20px',
            cursor: 'pointer', border: agreed ? '1px solid var(--accent-green)' : '1px solid rgba(255,255,255,0.1)'
          }}
        >
          {agreed ? <CheckSquare size={24} color="var(--accent-green)" /> : <Square size={24} color="var(--text-secondary)" />}
          <span style={{ fontSize: '14px', textAlign: 'left' }}>
            I understand that real-money gambling is prohibited and agree to the terms of service.
          </span>
        </div>

        <button 
          className="btn-primary" 
          disabled={!agreed || submitting}
          onClick={handleAgree}
          style={{ width: '100%', padding: '15px', opacity: !agreed ? 0.5 : 1 }}
        >
          {submitting ? 'Recording...' : 'I Understand and Agree'}
        </button>
      </div>
    </div>
  );
}
