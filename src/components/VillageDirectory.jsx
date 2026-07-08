// Copyright (c) 2026 Sanjai. All rights reserved.

import React, { useState, useEffect } from 'react';
import { Search, UserCheck, Shield, HelpCircle, MapPin, Mail, Phone, Tag, Plus, X } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../utils/supabaseClient';

export default function VillageDirectory({ currentUser, users, addNotification, directoryEntries = [], setDirectoryEntries }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeArea, setActiveArea] = useState('All');
  const [bloodGroupSearch, setBloodGroupSearch] = useState('All');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [modalForm, setModalForm] = useState({
    name: '',
    phone: '',
    blood_group: 'O+',
    custom_blood_group: '',
    address: '',
    occupation: '',
    skills: '',
    volunteer: ''
  });

  const areas = ['All', 'Dharapuram'];
  const availableGroups = ['All', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  
  const suggestedGroups = availableGroups.filter(g => 
    g.toLowerCase().includes(bloodGroupSearch.toLowerCase())
  );

  const handleSaveEntry = async (e) => {
    e.preventDefault();
    if (!modalForm.name.trim()) return;

    const skillsArray = modalForm.skills.split(',').map(s => s.trim()).filter(Boolean);
    const volunteerArray = modalForm.volunteer.split(',').map(v => v.trim()).filter(Boolean);
    const bgValue = modalForm.blood_group === 'Other' ? modalForm.custom_blood_group : modalForm.blood_group;

    const entryData = {
      name: modalForm.name,
      phone: modalForm.phone,
      blood_group: bgValue,
      address: modalForm.address,
      occupation: modalForm.occupation,
      skills: skillsArray,
      volunteer: volunteerArray,
      created_by: currentUser.id
    };

    if (editingEntry) {
      // Editing Mode
      if (isSupabaseConfigured) {
        try {
          const { error } = await supabase
            .from('village_directory')
            .update({
              ...entryData,
              edit_permission: 'idle' // reset to idle after update
            })
            .eq('id', editingEntry.id);
          if (error) throw error;
          addNotification('Updated', 'Profile entry updated successfully.', 'success');
        } catch (err) {
          console.error(err);
          addNotification('Error', 'Failed to update entry.', 'danger');
        }
      } else {
        const updated = directoryEntries.map(e => e.id === editingEntry.id ? { ...e, ...entryData, edit_permission: 'idle' } : e);
        setDirectoryEntries(updated);
        localStorage.setItem('vc_custom_directory', JSON.stringify(updated));
        addNotification('Updated', 'Profile entry updated locally.', 'success');
      }
    } else {
      // Create Mode
      if (isSupabaseConfigured) {
        try {
          const { error } = await supabase
            .from('village_directory')
            .insert({
              ...entryData,
              edit_permission: 'idle'
            });
          if (error) throw error;
          addNotification('Added', 'Profile added to the village directory.', 'success');
        } catch (err) {
          console.error(err);
          addNotification('Error', 'Failed to save entry.', 'danger');
        }
      } else {
        const newEntry = {
          id: `dir_${Date.now()}`,
          ...entryData,
          edit_permission: 'idle',
          created_at: new Date().toISOString()
        };
        const updated = [newEntry, ...directoryEntries];
        setDirectoryEntries(updated);
        localStorage.setItem('vc_custom_directory', JSON.stringify(updated));
        addNotification('Added', 'Profile added locally.', 'success');
      }
    }

    setShowAddModal(false);
    setEditingEntry(null);
  };

  const handleDeleteEntry = async (entryId) => {
    if (window.confirm('Are you sure you want to remove this entry from the directory?')) {
      if (isSupabaseConfigured) {
        try {
          const { error } = await supabase
            .from('village_directory')
            .delete()
            .eq('id', entryId);
          if (error) throw error;
          addNotification('Deleted', 'Entry removed successfully.', 'success');
        } catch (err) {
          console.error(err);
        }
      } else {
        const updated = directoryEntries.filter(e => e.id !== entryId);
        setDirectoryEntries(updated);
        localStorage.setItem('vc_custom_directory', JSON.stringify(updated));
        addNotification('Deleted', 'Entry removed locally.', 'success');
      }
    }
  };

  const handleRequestEditPermission = async (entry) => {
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('village_directory')
          .update({ edit_permission: 'requested' })
          .eq('id', entry.id);
        if (error) throw error;
        addNotification('Request Submitted', 'Permission request submitted to Admin.', 'success');
      } catch (err) {
        console.error(err);
      }
    } else {
      const updated = directoryEntries.map(e => e.id === entry.id ? { ...e, edit_permission: 'requested' } : e);
      setDirectoryEntries(updated);
      localStorage.setItem('vc_custom_directory', JSON.stringify(updated));
      addNotification('Request Submitted', 'Permission request submitted locally.', 'success');
    }
  };

  const handleAdminPermissionResponse = async (entry, status) => {
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('village_directory')
          .update({ edit_permission: status })
          .eq('id', entry.id);
        if (error) throw error;
        addNotification('Request Processed', `Permission ${status === 'granted' ? 'granted' : 'declined'} successfully.`, 'success');
      } catch (err) {
        console.error(err);
      }
    } else {
      const updated = directoryEntries.map(e => e.id === entry.id ? { ...e, edit_permission: status } : e);
      setDirectoryEntries(updated);
      localStorage.setItem('vc_custom_directory', JSON.stringify(updated));
      addNotification('Request Processed', `Permission status updated locally.`, 'success');
    }
  };

  // Combine auth profiles list and village_directory table entries
  const allMembers = [
    ...users.map(u => ({
      ...u,
      isProfile: true,
      skills: Array.isArray(u.skills) ? u.skills : [],
      volunteer: Array.isArray(u.volunteer) ? u.volunteer : []
    })),
    ...directoryEntries.map(e => ({
      ...e,
      isProfile: false,
      skills: Array.isArray(e.skills) ? e.skills : [],
      volunteer: Array.isArray(e.volunteer) ? e.volunteer : []
    }))
  ];

  const filteredUsers = allMembers.filter(user => {
    // 1. Search term (matches name, skills, occupation)
    const matchesSearch = 
      (user.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.occupation || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.skills || []).some(skill => skill.toLowerCase().includes(searchTerm.toLowerCase()));

    // 2. Area match
    const matchesArea = activeArea === 'All' || (user.address || '').includes(activeArea);

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
      <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', width: '100%' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem', fontWeight: 700 }}>Village Directory</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Locate neighbors, contact skilled professionals (electricians, builders), and find community volunteers.</p>
        </div>
        <button 
          className="btn btn-accent" 
          onClick={() => {
            setEditingEntry(null);
            setModalForm({
              name: currentUser.id.startsWith('guest_') ? currentUser.name : '',
              phone: currentUser.phone || '',
              blood_group: 'O+',
              custom_blood_group: '',
              address: currentUser.address || '',
              occupation: '',
              skills: '',
              volunteer: ''
            });
            setShowAddModal(true);
          }}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Plus size={16} /> Add My Details
        </button>
      </div>

      {/* Admin Edit Requests Review Panel */}
      {currentUser.role === 'admin' && directoryEntries.some(e => e.edit_permission === 'requested') && (
        <div className="card" style={{ padding: '16px', marginBottom: '24px', backgroundColor: 'var(--primary-light)', borderLeft: '4px solid var(--primary)' }}>
          <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.95rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '8px' }}>
            🔔 Pending Directory Edit Requests
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {directoryEntries.filter(e => e.edit_permission === 'requested').map(entry => (
              <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', padding: '6px 10px', backgroundColor: 'var(--bg-card)', borderRadius: '4px' }}>
                <span>
                  <strong>{entry.name}</strong> ({entry.address || 'No Address'}) requests permission to update their profile.
                </span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button 
                    onClick={() => handleAdminPermissionResponse(entry, 'granted')}
                    className="btn btn-primary" 
                    style={{ padding: '4px 8px', fontSize: '0.75rem', borderRadius: '4px' }}
                  >
                    Approve
                  </button>
                  <button 
                    onClick={() => handleAdminPermissionResponse(entry, 'idle')}
                    className="btn btn-outline" 
                    style={{ padding: '4px 8px', fontSize: '0.75rem', borderRadius: '4px', color: 'var(--danger)', borderColor: 'rgba(231,111,81,0.2)' }}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
            <div key={user.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderLeft: isOfficerOrAdmin ? '4px solid var(--accent)' : '1px solid var(--border)', padding: '16px' }}>
              
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
                      {user.occupation || 'Resident'} • Blood Group: <strong>{user.bloodGroup || user.blood_group || 'N/A'}</strong>
                    </p>
                  </div>
                </div>

                {/* Profile Bio Details */}
                <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {user.address && (
                    <p style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <MapPin size={14} style={{ color: 'var(--text-muted)' }} /> {user.address}
                    </p>
                  )}
                  {user.phone && (
                    <p style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Phone size={14} style={{ color: 'var(--text-muted)' }} /> {user.phone}
                    </p>
                  )}
                  {user.email && (
                    <p style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Mail size={14} style={{ color: 'var(--text-muted)' }} /> {user.email}
                    </p>
                  )}
                </div>
              </div>

              {/* Skills and Volunteers Tags */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', paddingBottom: '12px' }}>
                {(user.skills && user.skills.length > 0) && (
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

                {(user.volunteer && user.volunteer.length > 0) && (
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

              {/* Card Actions Footer */}
              {!user.isProfile && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  {/* Admin controls */}
                  {currentUser.role === 'admin' && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingEntry(user);
                          setModalForm({
                            name: user.name,
                            phone: user.phone || '',
                            blood_group: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].includes(user.blood_group) ? user.blood_group : 'Other',
                            custom_blood_group: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].includes(user.blood_group) ? '' : user.blood_group || '',
                            address: user.address || '',
                            occupation: user.occupation || '',
                            skills: user.skills ? user.skills.join(', ') : '',
                            volunteer: user.volunteer ? user.volunteer.join(', ') : ''
                          });
                          setShowAddModal(true);
                        }}
                        className="role-btn"
                        style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteEntry(user.id)}
                        className="role-btn"
                        style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--danger)' }}
                      >
                        🗑️ Delete
                      </button>
                    </>
                  )}

                  {/* Resident owner controls */}
                  {user.created_by === currentUser.id && currentUser.role !== 'admin' && (
                    <>
                      {user.edit_permission === 'idle' && (
                        <button
                          type="button"
                          onClick={() => handleRequestEditPermission(user)}
                          className="btn btn-outline"
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                        >
                          🔒 Request to Edit
                        </button>
                      )}
                      {user.edit_permission === 'requested' && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', display: 'flex', alignItems: 'center' }}>
                          ⏳ Pending Admin Approval
                        </span>
                      )}
                      {user.edit_permission === 'granted' && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingEntry(user);
                            setModalForm({
                              name: user.name,
                              phone: user.phone || '',
                              blood_group: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].includes(user.blood_group) ? user.blood_group : 'Other',
                              custom_blood_group: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].includes(user.blood_group) ? '' : user.blood_group || '',
                              address: user.address || '',
                              occupation: user.occupation || '',
                              skills: user.skills ? user.skills.join(', ') : '',
                              volunteer: user.volunteer ? user.volunteer.join(', ') : ''
                            });
                            setShowAddModal(true);
                          }}
                          className="btn btn-primary"
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                        >
                          🔓 Edit Profile (Once)
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}

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

      {/* Add Custom Entry Modal */}
      {showAddModal && (
        <div className="modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="card" style={{ maxWidth: '450px', width: '100%', padding: '24px', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
            <button 
              onClick={() => { setShowAddModal(false); setEditingEntry(null); }}
              style={{ position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              <X size={20} />
            </button>
            <h3 style={{ fontFamily: 'var(--font-heading)', color: 'var(--primary)', marginBottom: '8px', fontSize: '1.25rem' }}>
              {editingEntry ? 'Edit My Details' : 'Add My Details to Directory'}
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Fill in your details below to list yourself in the village directory.
            </p>

            <form onSubmit={handleSaveEntry} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={modalForm.name} 
                  onChange={(e) => setModalForm({ ...modalForm, name: e.target.value })} 
                  required 
                />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input 
                    type="tel" 
                    className="form-input" 
                    placeholder="+91 XXXXX XXXXX" 
                    value={modalForm.phone} 
                    onChange={(e) => setModalForm({ ...modalForm, phone: e.target.value })} 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Blood Group</label>
                  <select 
                    className="form-select" 
                    value={modalForm.blood_group} 
                    onChange={(e) => setModalForm({ ...modalForm, blood_group: e.target.value })}
                  >
                    {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-', 'Other'].map(bg => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </select>
                </div>
              </div>

              {modalForm.blood_group === 'Other' && (
                <div className="form-group">
                  <label className="form-label">Specify Blood Group</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. Bombay Blood" 
                    value={modalForm.custom_blood_group} 
                    onChange={(e) => setModalForm({ ...modalForm, custom_blood_group: e.target.value })} 
                    required
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Address / House No.</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. 12 North Street" 
                  value={modalForm.address} 
                  onChange={(e) => setModalForm({ ...modalForm, address: e.target.value })} 
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Occupation</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Electrician, Farmer" 
                  value={modalForm.occupation} 
                  onChange={(e) => setModalForm({ ...modalForm, occupation: e.target.value })} 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Skills (comma separated)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Plumbing, Carpentry" 
                  value={modalForm.skills} 
                  onChange={(e) => setModalForm({ ...modalForm, skills: e.target.value })} 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Volunteer Interests (comma separated)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Emergency help, Event planning" 
                  value={modalForm.volunteer} 
                  onChange={(e) => setModalForm({ ...modalForm, volunteer: e.target.value })} 
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }}>
                Save Details
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
