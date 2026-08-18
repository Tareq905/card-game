import React from 'react';
import { X, Info } from 'lucide-react';

export default function PokerFusionRules({ onClose }) {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
      background: 'rgba(0,0,0,0.8)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div className="glass-panel" style={{ width: '450px', padding: '30px', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
          <X size={20} />
        </button>
        <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Info color="var(--accent-purple)" /> Poker Fusion Rules
        </h2>
        
        <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: '1.5' }}>
          Poker Fusion combines the shedding mechanics of Classic mode with Poker hands! 
          Whenever your hand size reaches exactly <strong>5 cards</strong> (after drawing), your hand is automatically evaluated as a Poker hand.
        </p>
        
        <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: '1.5', fontSize: '13px' }}>
          <strong>How are hands formed?</strong><br/>
          Because our cards don't have standard suits, we map them as follows (Action cards and Wilds are ignored in hand evaluation):<br/>
          &bull; <strong>Suit</strong> = Card Color (Red, Blue, Green, Yellow)<br/>
          &bull; <strong>Rank</strong> = Card Number (0-9)
        </p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '10px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--accent-yellow)', marginBottom: '5px' }}>Three of a Kind</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Definition: 3 cards with the exact same number.</p>
            <p style={{ fontSize: '13px', color: 'var(--accent-green)', fontWeight: 600 }}>Bonus: Skips the next player's turn.</p>
          </div>
          
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '10px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--accent-purple)', marginBottom: '5px' }}>Flush</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Definition: 4 or more cards of the exact same color.</p>
            <p style={{ fontSize: '13px', color: 'var(--accent-green)', fontWeight: 600 }}>Bonus: All opponents draw 1 penalty card.</p>
          </div>
          
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '10px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--accent-blue)', marginBottom: '5px' }}>Full House / Four of a Kind</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Definition: 3 of one number & 2 of another / 4 of the same number.</p>
            <p style={{ fontSize: '13px', color: 'var(--accent-green)', fontWeight: 600 }}>Bonus: All opponents draw 1 penalty card.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
