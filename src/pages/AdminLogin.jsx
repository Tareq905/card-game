import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, Lock, Mail, ArrowRight } from 'lucide-react';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { fetchProfile } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (res.ok) {
        localStorage.setItem('token', data.access_token);
        // This will update the user context and trigger redirect in App.jsx
        await fetchProfile();
      } else {
        setError(data.detail || 'Login failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at 50% 20%, #1e293b 0%, #0f172a 100%)',
      padding: '20px'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '400px',
        padding: '40px 30px',
        display: 'flex',
        flexDirection: 'column',
        gap: '25px',
        borderTop: '3px solid var(--accent-purple)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <Shield size={48} color="var(--accent-purple)" style={{ margin: '0 auto 15px auto' }} />
          <h2 style={{ fontSize: '24px', fontWeight: 800, fontFamily: 'var(--font-main)' }}>Admin Portal</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '5px' }}>
            Authorized personnel only
          </p>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: 'var(--accent-red)',
            padding: '12px',
            borderRadius: '8px',
            fontSize: '14px',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>
              Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input 
                type="email" 
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '10px',
                  padding: '12px 12px 12px 40px',
                  color: 'white',
                  fontSize: '15px',
                  outline: 'none',
                  transition: 'border 0.2s ease'
                }}
                placeholder="admin@example.com"
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input 
                type="password" 
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '10px',
                  padding: '12px 12px 12px 40px',
                  color: 'white',
                  fontSize: '15px',
                  outline: 'none',
                  transition: 'border 0.2s ease'
                }}
                placeholder="••••••••"
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="btn-primary" 
            style={{ 
              marginTop: '10px', 
              padding: '14px', 
              borderRadius: '10px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '10px',
              background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
              border: 'none'
            }}
          >
            {loading ? 'Authenticating...' : (
              <>
                Login to Dashboard
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>
        
        <div style={{ textAlign: 'center', marginTop: '10px' }}>
          <a href="/" style={{ color: 'var(--text-secondary)', fontSize: '13px', textDecoration: 'none' }}>
            &larr; Back to Player Login
          </a>
        </div>
      </div>
    </div>
  );
}
