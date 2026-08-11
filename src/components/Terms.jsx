import React from 'react';
import { ShieldCheck, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Terms() {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-main)',
      padding: '40px 20px',
      paddingBottom: '80px', // For footer
      color: 'white',
      fontFamily: 'var(--font-main)'
    }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', background: 'rgba(255,255,255,0.02)', padding: '40px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
        <button onClick={() => navigate('/')} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 15px', marginBottom: '30px' }}>
          <ArrowLeft size={16} /> Back to Game
        </button>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px' }}>
          <div style={{ background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))', padding: '15px', borderRadius: '15px' }}>
            <ShieldCheck size={32} />
          </div>
          <h1 style={{ fontSize: '32px', fontWeight: 800 }}>Terms & Conditions</h1>
        </div>

        <div style={{ lineHeight: '1.6', color: 'var(--text-secondary)' }}>
          <h2 style={{ color: 'white', fontSize: '20px', marginTop: '30px', marginBottom: '15px' }}>1. Entertainment Purposes Only</h2>
          <p style={{ marginBottom: '15px' }}>
            "One Left" is a virtual card game designed strictly for entertainment purposes. The in-game currency ("Tokens") has no real-world monetary value and cannot be exchanged, cashed out, or transferred for real money, goods, or services under any circumstances.
          </p>

          <h2 style={{ color: 'white', fontSize: '20px', marginTop: '30px', marginBottom: '15px' }}>2. No Real-Money Gambling</h2>
          <p style={{ marginBottom: '15px' }}>
            We strictly prohibit any form of real-money gambling. Purchasing tokens grants a limited, non-exclusive, revocable license to use virtual items within the game. You acknowledge that you do not acquire any ownership rights in the virtual tokens.
          </p>

          <h2 style={{ color: 'white', fontSize: '20px', marginTop: '30px', marginBottom: '15px' }}>3. Peer-to-Peer Transfers</h2>
          <p style={{ marginBottom: '15px' }}>
            To prevent abuse and illicit secondary markets, direct transfer of tokens between player accounts is technically disabled and strictly prohibited by our Terms of Service. Any attempts to circumvent this restriction may result in immediate and permanent account suspension.
          </p>

          <h2 style={{ color: 'white', fontSize: '20px', marginTop: '30px', marginBottom: '15px' }}>4. Code of Conduct</h2>
          <p style={{ marginBottom: '15px' }}>
            Players must treat others with respect. Harassment, use of exploits, or attempting to artificially manipulate game outcomes or leaderboards will result in account bans.
          </p>

          <h2 style={{ color: 'white', fontSize: '20px', marginTop: '30px', marginBottom: '15px' }}>5. Purchases and Refunds</h2>
          <p style={{ marginBottom: '15px' }}>
            All purchases of virtual tokens are final and non-refundable. If you experience technical issues with a transaction, please contact support.
          </p>
        </div>
      </div>
    </div>
  );
}
