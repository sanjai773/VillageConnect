import React, { useState } from 'react';
import { Search, UserCheck, Shield, HelpCircle, MapPin, Mail, Phone, Tag } from 'lucide-react';

export default function VillageDirectory({ currentUser, users, addNotification }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeArea, setActiveArea] = useState('All');
  const [bloodGroupSearch, setBloodGroupSearch] = useState('All');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const areas = ['All', 'Dharapuram'];
  const availableGroups = ['All', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  
  const suggestedGroups = availableGroups.filter(g => 
    g.toLowerCase().includes(bloodGroupSearch.toLowerCase())
  );

  const filteredUsers = users.filter(user => {
    // 1. Search term (matches name, skills, occupation)
    const matchesSearch = 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.occupation.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.skills.some(skill => skill.toLowerCase().includes(searchTerm.toLowerCase()));

    // 2. Area match
    const matchesArea = activeArea === 'All' || user.address.includes(activeArea);

    // 3. Blood group match
    const userBlood = (user.bloodGroup || user.blood_group || '').trim().toUpperCase();
    const filterBlood = bloodGroupSearch.trim().toUpperCase();
    
    const standardGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
    const isStandardFilter = standardGroups.includes(filterBlood);
    
    let matchesBlood = false;
    if (!filterBlood || filterBlood === 'ALL') {
      matchesBlood = true;
    } else if (isStandardFilter) {
      matchesBlood = userBlood === filterBlood;
    } else {
      const filterType = filterBlood.replace(/[+-]/g, '');
      const filterRh = filterBlood.includes('+') ? '+' : (filterBlood.includes('-') ? '-' : '');
      
      const userType = userBlood.replace(/[+-]/g, '');
      const userRh = userBlood.includes('+') ? '+' : (userBlood.includes('-') ? '-' : '');
      
      const isStandardType = ['A', 'B', 'AB', 'O'].includes(filterType);
      
      if (isStandardType) {
        const matchesType = userType === filterType;
        const matchesRh = !filterRh || userRh === filterRh;
        matchesBlood = matchesType && matchesRh;
      } else {
        matchesBlood = userBlood.includes(filterBlood);
      }
    }

    return matchesSearch && matchesArea && matchesBlood;
  });

  return (
    <div className="directory-container">
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem', fontWeight: 700 }}>Village Directory</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Locate neighbors, contact skilled professionals (electricians, builders), and find community volunteers.</p>
      </div>

      {/* Search & Filter Card */}
      <div className="card" style={{ padding: '16px', marginBottom: '24px' }}>
        <div className="form-group" style={{ position: 'relative', marginBottom: '16px' }}>
          <span style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }}>
            <Search size={18} />
          </span>
          <input
            type="text"
            className="form-input"
            placeholder="Search by name, skill (e.g. electrical), or occupation..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '40px' }}
          />
        </div>

        <div className="grid-2">
          {/* Area Filter */}
          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.8rem' }}>Filter by Street/Area</label>
            <select className="form-select" value={activeArea} onChange={(e) => setActiveArea(e.target.value)} style={{ fontSize: '0.85rem', padding: '8px 12px' }}>
              {areas.map(area => (
                <option key={area}>{area}</option>
              ))}
            </select>
          </div>

          {/* Blood Group Filter with autocomplete */}
          <div className="form-group" style={{ position: 'relative' }}>
            <label className="form-label" style={{ fontSize: '0.8rem' }}>Filter by Blood Group</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Type or select blood group (e.g. A+, O-)..."
                value={bloodGroupSearch}
                onChange={(e) => {
                  setBloodGroupSearch(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => {
                  // Delay hiding suggestions so that click on suggestion can register
                  setTimeout(() => setShowSuggestions(false), 200);
                }}
                style={{ fontSize: '0.85rem', padding: '8px 12px' }}
              />
              {showSuggestions && suggestedGroups.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, width: '100%',
                  backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: '4px', zIndex: 100, maxHeight: '200px', overflowY: 'auto',
                  boxShadow: 'var(--shadow-md)', marginTop: '4px'
                }}>
                  {suggestedGroups.map(group => (
                    <div
                      key={group}
                      onClick={() => {
                        setBloodGroupSearch(group);
                        setShowSuggestions(false);
                      }}
                      style={{
                        padding: '8px 12px', cursor: 'pointer', fontSize: '0.85rem',
                        borderBottom: '1px solid var(--border-light)',
                        backgroundColor: bloodGroupSearch === group ? 'var(--primary-light)' : 'transparent',
                        color: bloodGroupSearch === group ? 'var(--primary)' : 'var(--text-main)'
                      }}
                      onMouseDown={(e) => {
                        // Prevent input blur from firing before onClick triggers
                        e.preventDefault();
                      }}
                    >
                      {group}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Directory Grid */}
      <div className="grid-2">
        {filteredUsers.map(user => {
          const isOfficerOrAdmin = user.role === 'officer' || user.role === 'admin';
          return (
            <div key={user.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderLeft: isOfficerOrAdmin ? '4px solid var(--accent)' : '1px solid var(--border)' }}>
              
              <div>
                {/* Profile Header */}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
                  <div className="user-avatar" style={{ fontSize: '1.5rem', width: '44px', height: '44px' }}>
                    {user.role === 'admin' ? '🏛️' : user.role === 'officer' ? '💼' : '👤'}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {user.name} 
                      {isOfficerOrAdmin && (
                        <Shield size={14} style={{ color: 'var(--accent)' }} title="Panchayat Authority" />
                      )}
                    </h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {user.occupation} • Blood Group: <strong>{user.bloodGroup || user.blood_group || 'N/A'}</strong>
                    </p>
                  </div>
                </div>

                {/* Profile Bio Details */}
                <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <p style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MapPin size={14} style={{ color: 'var(--text-muted)' }} /> {user.address}
                  </p>
                  <p style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Phone size={14} style={{ color: 'var(--text-muted)' }} /> {user.phone}
                  </p>
                  <p style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Mail size={14} style={{ color: 'var(--text-muted)' }} /> {user.email}
                  </p>
                </div>
              </div>

              {/* Skills and Volunteers Tags */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                {user.skills.length > 0 && (
                  <div style={{ marginBottom: '8px' }}>
                    <strong style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Skills:</strong>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {user.skills.map(skill => (
                        <span key={skill} style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 500 }}>
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {user.volunteer.length > 0 && (
                  <div>
                    <strong style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Volunteer Roles:</strong>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {user.volunteer.map(tag => (
                        <span key={tag} style={{ backgroundColor: 'var(--success-light)', color: 'var(--success)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px' }}>
                          <UserCheck size={10} /> {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

            </div>
          );
        })}

        {filteredUsers.length === 0 && (
          <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px' }}>
            <HelpCircle size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
            <h4 style={{ fontWeight: 600 }}>No Neighbors Found</h4>
            <p style={{ color: 'var(--text-muted)' }}>Try refining your search terms or street area filter inputs.</p>
          </div>
        )}
      </div>

    </div>
  );
}
