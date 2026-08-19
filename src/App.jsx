import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { useGame } from './context/GameContext'
import LoginRegister from './pages/LoginRegister'
import Dashboard from './pages/Dashboard'
import GameRoom from './pages/GameRoom'
import AdminDashboard from './pages/AdminDashboard'
import AdminLogin from './pages/AdminLogin'
import Profile from './pages/Profile'
import Chatbot from './components/Chatbot'
import Terms from './components/Terms'
import GamblingNoticeModal from './components/GamblingNoticeModal'

function AppRoutes() {
  const { user, loading, fetchProfile } = useAuth()
  const { gameState } = useGame()
  const [showNotice, setShowNotice] = useState(() => {
    return localStorage.getItem('dismissed_gambling_notice') !== 'true';
  });

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Loading One Left...</p>
      </div>
    )
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="*" element={<LoginRegister />} />
      </Routes>
    )
  }

  return (
    <>
      <Routes>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="*" element={gameState ? <GameRoom /> : <Dashboard />} />
      </Routes>
      <Chatbot />
      
      {user && !user.has_agreed_to_terms && (
        <GamblingNoticeModal onAgree={fetchProfile} />
      )}
      
      {/* Global Gambling Notice Footer — hide during active gameplay to avoid covering controls */}
      {showNotice && !gameState && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          width: '100%',
          background: 'rgba(0,0,0,0.85)',
          color: 'rgba(255,255,255,0.6)',
          fontSize: '11px',
          textAlign: 'center',
          padding: '8px 45px 8px 15px', // extra right padding to prevent overlapping with close button
          zIndex: 9999,
          borderTop: '1px solid rgba(255,255,255,0.1)',
          backdropFilter: 'blur(4px)',
          boxShadow: '0 -2px 10px rgba(0,0,0,0.3)',
        }}>
          <strong>Notice:</strong> One Left is for entertainment purposes only and does not support real-money gambling or peer-to-peer transfers. 
          <a href="/terms" style={{ color: 'var(--accent-blue)', marginLeft: '10px', textDecoration: 'none' }}>Terms & Conditions</a>
          <button
            onClick={() => {
              localStorage.setItem('dismissed_gambling_notice', 'true');
              setShowNotice(false);
            }}
            style={{
              position: 'absolute',
              right: '15px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.5)',
              fontSize: '15px',
              cursor: 'pointer',
              fontWeight: 'bold',
              padding: '2px 6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Dismiss Notice"
          >
            ✕
          </button>
        </div>
      )}
    </>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}

export default App
