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
      
      {/* Global Gambling Notice Footer */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        width: '100%',
        background: 'rgba(0,0,0,0.8)',
        color: 'rgba(255,255,255,0.6)',
        fontSize: '11px',
        textAlign: 'center',
        padding: '8px',
        zIndex: 9999,
        borderTop: '1px solid rgba(255,255,255,0.1)'
      }}>
        <strong>Notice:</strong> One Left is for entertainment purposes only and does not support real-money gambling or peer-to-peer transfers. 
        <a href="/terms" style={{ color: 'var(--accent-blue)', marginLeft: '10px', textDecoration: 'none' }}>Terms & Conditions</a>
      </div>
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
