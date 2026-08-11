import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { AuthProvider } from './context/AuthContext'
import { GameProvider } from './context/GameContext'
import { AudioProvider } from './context/AudioContext'
import { GoogleOAuthProvider } from '@react-oauth/google'

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "dummy-client-id";

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={clientId}>
      <AuthProvider>
        <AudioProvider>
          <GameProvider>
            <App />
          </GameProvider>
        </AudioProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  </React.StrictMode>
)
