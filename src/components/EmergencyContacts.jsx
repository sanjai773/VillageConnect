import React, { useState } from 'react';
import { Phone, ShieldCheck, AlertOctagon } from 'lucide-react';
import { EMERGENCY_CONTACTS } from '../utils/MockData';

export default function EmergencyContacts() {
  const [filter, setFilter] = useState('All');
  const categories = ['All', 'Medical', 'Safety', 'Utilities', 'Governance'];

  const filteredContacts = filter === 'All' 
    ? EMERGENCY_CONTACTS 
    : EMERGENCY_CONTACTS.filter(c => c.category === filter);

  return (
    <div className="emergency-container">
      {/* Header */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '24px', backgroundColor: 'var(--danger-light)', padding: '16px', borderRadius: '12px', border: '1px solid var(--danger)' }}>
        <AlertOctagon size={36} style={{ color: 'var(--danger)', flexShrink: 0 }} />
        <div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--danger)' }}>Emergency Helpline</h2>
          <p style={{ color: 'var(--text-main)', fontSize: '0.9rem' }}>One-tap calling for fire department, ambulance, medical care, electricity board, and village administration.</p>
        </div>
      </div>

      {/* Categories Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '8px' }}>
        {categories.map(cat => (
          <button
            key={cat}
            className={`role-btn ${filter === cat ? 'active' : ''}`}
            onClick={() => setFilter(cat)}
            style={{ fontSize: '0.85rem' }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Contacts List Grid */}
      <div className="grid-2">
        {filteredContacts.map(contact => (
          <div key={contact.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderLeft: '5px solid var(--danger)' }}>
            
            <div style={{ flexGrow: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {contact.name}
                </h3>
                {contact.verified && (
                  <ShieldCheck size={14} style={{ color: 'var(--success)' }} title="Panchayat Verified Hotline" />
                )}
              </div>
              
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Category: <strong>{contact.category}</strong>
              </p>

              <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '2px', color: 'var(--text-main)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>📞 {contact.phone} {contact.altPhone && ` / ${contact.altPhone}`}</span>
                {contact.location && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }}>📍 {contact.location}</span>
                )}
              </div>
            </div>

            {/* Quick Dial Action Button */}
            <a 
              href={`tel:${contact.phone}`} 
              className="btn"
              style={{
                backgroundColor: 'var(--danger)',
                color: '#fff',
                borderRadius: '50%',
                width: '42px',
                height: '42px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: 'var(--shadow-sm)'
              }}
              title={`Call ${contact.name}`}
            >
              <Phone size={18} />
            </a>

          </div>
        ))}
      </div>

    </div>
  );
}
