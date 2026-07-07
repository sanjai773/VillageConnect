import React, { useState, useRef, useEffect } from 'react';
import { Calendar, Clock, MapPin, CheckCircle, Users, QrCode, Plus, X } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../utils/supabaseClient';

export default function EventsView({ 
  currentUser, 
  events, 
  setEvents, 
  addNotification 
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [venue, setVenue] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [organizer, setOrganizer] = useState('');
  const [editingEvent, setEditingEvent] = useState(null);

  // QR modal state
  const [activeQrEvent, setActiveQrEvent] = useState(null);

  // Media capture and upload states
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [videoStream, setVideoStream] = useState(null);
  const [cameraError, setCameraError] = useState(null);

  // Cropper states
  const [cropBox, setCropBox] = useState({ x: 10, y: 10, w: 80, h: 45 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, boxX: 0, boxY: 0 });
  const [rawImageSrc, setRawImageSrc] = useState(null);

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);

  // Bind camera stream
  useEffect(() => {
    if (showCameraModal && videoRef.current && videoStream) {
      videoRef.current.srcObject = videoStream;
    }
  }, [showCameraModal, videoStream]);

  // Cleanup stream
  useEffect(() => {
    return () => {
      if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [videoStream]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setRawImageSrc(reader.result);
      setCropBox({ x: 10, y: 10, w: 80, h: 45 });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setSelectedFile(null);
    setImagePreview(null);
    setRawImageSrc(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleOpenCamera = async () => {
    setShowCameraModal(true);
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      setVideoStream(stream);
    } catch (err) {
      console.error('Camera access error:', err);
      setCameraError('Could not access camera. Please check permissions.');
    }
  };

  const handleCloseCamera = () => {
    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
      setVideoStream(null);
    }
    setShowCameraModal(false);
  };

  const handleCapturePhoto = () => {
    if (!videoRef.current) return;

    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const dataUrl = canvas.toDataURL('image/jpeg');
      setRawImageSrc(dataUrl);
      setCropBox({ x: 10, y: 10, w: 80, h: 45 });

      handleCloseCamera();
      addNotification('Captured', 'Photo captured, please crop and apply.', 'success');
    } catch (err) {
      console.error('Capture error:', err);
      addNotification('Error', 'Failed to capture photo.', 'danger');
    }
  };

  // Dragging event handlers for crop box
  const handleBoxMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      boxX: cropBox.x,
      boxY: cropBox.y
    });
  };

  const handleContainerMouseMove = (e) => {
    if (!isDragging) return;
    const container = e.currentTarget.getBoundingClientRect();
    
    const deltaXPercent = ((e.clientX - dragStart.x) / container.width) * 100;
    const deltaYPercent = ((e.clientY - dragStart.y) / container.height) * 100;
    
    setCropBox(prev => {
      const newX = Math.max(0, Math.min(100 - prev.w, dragStart.boxX + deltaXPercent));
      const newY = Math.max(0, Math.min(100 - prev.h, dragStart.boxY + deltaYPercent));
      return { ...prev, x: newX, y: newY };
    });
  };

  const handleBoxTouchStart = (e) => {
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStart({
      x: touch.clientX,
      y: touch.clientY,
      boxX: cropBox.x,
      boxY: cropBox.y
    });
  };

  const handleContainerTouchMove = (e) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    const container = e.currentTarget.getBoundingClientRect();
    
    const deltaXPercent = ((touch.clientX - dragStart.x) / container.width) * 100;
    const deltaYPercent = ((touch.clientY - dragStart.y) / container.height) * 100;
    
    setCropBox(prev => {
      const newX = Math.max(0, Math.min(100 - prev.w, dragStart.boxX + deltaXPercent));
      const newY = Math.max(0, Math.min(100 - prev.h, dragStart.boxY + deltaYPercent));
      return { ...prev, x: newX, y: newY };
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleApplyCrop = () => {
    if (!rawImageSrc) return;

    const img = new Image();
    img.src = rawImageSrc;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 450; // standard 16:9 banner
      const ctx = canvas.getContext('2d');

      // Map percentage values of cropBox to actual pixel coordinates of the original image
      const srcX = (cropBox.x / 100) * img.width;
      const srcY = (cropBox.y / 100) * img.height;
      const srcWidth = (cropBox.w / 100) * img.width;
      const srcHeight = (cropBox.h / 100) * img.height;

      ctx.drawImage(img, srcX, srcY, srcWidth, srcHeight, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      setImagePreview(dataUrl);
      
      fetch(dataUrl)
        .then(res => res.blob())
        .then(blob => {
          const file = new File([blob], `cropped_cover_${Date.now()}.jpg`, { type: 'image/jpeg' });
          setSelectedFile(file);
          setRawImageSrc(null); // Close crop editor
          addNotification('Cropped', 'Image cropped successfully!', 'success');
        });
    };
  };

  const uploadImageToSupabase = async (file) => {
    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 10)}.${fileExt}`;
    const filePath = `public/${fileName}`;

    const { error } = await supabase.storage
      .from('post-images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.warn('Supabase storage upload failed, falling back to base64 encoding. Error:', error.message);
      return imagePreview;
    }

    const { data: publicUrlData } = supabase.storage
      .from('post-images')
      .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
  };

  const handleStartEdit = (event) => {
    setEditingEvent(event);
    setTitle(event.title);
    setDate(event.date);
    setTime(event.time || '');
    setVenue(event.venue);
    setOrganizer(event.organizer || '');
    
    // Check if the event already has an image (prioritize description fallback attachment)
    let attachedImage = null;
    let cleanDescription = event.description || '';
    if (cleanDescription.includes('\n\n[Attachment](')) {
      const parts = cleanDescription.split('\n\n[Attachment](');
      cleanDescription = parts[0];
      attachedImage = parts[1].replace(')', '');
    } else {
      attachedImage = event.cover_image || event.coverImage;
    }
    
    setDescription(cleanDescription);
    setImagePreview(attachedImage);
    setShowAddForm(true);
  };

  const handleCancelForm = () => {
    setShowAddForm(false);
    setEditingEvent(null);
    setTitle('');
    setDescription('');
    setDate('');
    setTime('');
    setVenue('');
    setOrganizer('');
    setSelectedFile(null);
    setImagePreview(null);
  };

  const handleSaveEvent = async (e) => {
    e.preventDefault();
    if (!title.trim() || !date || !venue) return;

    setUploading(true);
    let imageUrl = imagePreview; // Keep existing image if not changed

    try {
      if (selectedFile) {
        if (isSupabaseConfigured) {
          imageUrl = await uploadImageToSupabase(selectedFile);
        } else {
          imageUrl = imagePreview;
        }
      }

      if (editingEvent) {
        if (isSupabaseConfigured) {
          // Try updating with 'cover_image' column first
          const updateData = {
            title,
            description,
            date,
            time: time || 'All Day',
            venue,
            organizer,
            cover_image: imageUrl
          };

          const { error } = await supabase
            .from('events')
            .update(updateData)
            .eq('id', editingEvent.id);

          if (error) {
            console.warn('Cover image save failed with standard column. Trying description attachment fallback. Error:', error.message);
            // Fallback if column 'cover_image' does not exist
            const fallbackUpdateData = {
              title,
              description: imageUrl ? `${description}\n\n[Attachment](${imageUrl})` : description,
              date,
              time: time || 'All Day',
              venue,
              organizer
            };
            const { error: fallbackError } = await supabase
              .from('events')
              .update(fallbackUpdateData)
              .eq('id', editingEvent.id);
            if (fallbackError) throw fallbackError;

            // Update state with fallback description and clear stale properties
            setEvents(prev => prev.map(ev => ev.id === editingEvent.id ? {
              ...ev,
              title,
              description: imageUrl ? `${description}\n\n[Attachment](${imageUrl})` : description,
              date,
              time: time || 'All Day',
              venue,
              organizer,
              coverImage: null,
              cover_image: null
            } : ev));
          } else {
            // Update state with standard column image
            setEvents(prev => prev.map(ev => ev.id === editingEvent.id ? {
              ...ev,
              title,
              description,
              date,
              time: time || 'All Day',
              venue,
              organizer,
              cover_image: imageUrl,
              coverImage: imageUrl
            } : ev));
          }
          handleCancelForm();
          addNotification('Event Updated', 'Successfully updated the community event.', 'success');
        } else {
          // Offline fallback
          setEvents(events.map(ev => ev.id === editingEvent.id ? {
            ...ev,
            title,
            description,
            date,
            time: time || 'All Day',
            venue,
            organizer,
            coverImage: imageUrl
          } : ev));
          handleCancelForm();
          addNotification('Event Updated', 'Successfully updated the community event.', 'success');
        }
      } else {
        // Create Mode
        if (isSupabaseConfigured) {
          const insertData = {
            title,
            description,
            date,
            time: time || 'All Day',
            venue,
            organizer: organizer || currentUser.name,
            category: 'Community',
            cover_image: imageUrl
          };

          const { data, error } = await supabase.from('events').insert(insertData).select();

          if (error) {
            console.warn('Cover image insert failed with standard column. Trying description attachment fallback. Error:', error.message);
            // Fallback if column 'cover_image' does not exist
            const fallbackInsertData = {
              title,
              description: imageUrl ? `${description}\n\n[Attachment](${imageUrl})` : description,
              date,
              time: time || 'All Day',
              venue,
              organizer: organizer || currentUser.name,
              category: 'Community'
            };
            const { data: fallbackData, error: fallbackError } = await supabase.from('events').insert(fallbackInsertData).select();
            if (fallbackError) throw fallbackError;

            const insertedRow = (fallbackData && fallbackData[0]) || {
              id: `db_${Date.now()}`,
              title,
              description: imageUrl ? `${description}\n\n[Attachment](${imageUrl})` : description,
              date,
              time: time || 'All Day',
              venue,
              organizer: organizer || currentUser.name,
              category: 'Community'
            };
            setEvents(prev => [insertedRow, ...prev]);
          } else {
            const insertedRow = (data && data[0]) || {
              id: `db_${Date.now()}`,
              title,
              description,
              date,
              time: time || 'All Day',
              venue,
              organizer: organizer || currentUser.name,
              category: 'Community',
              cover_image: imageUrl,
              coverImage: imageUrl
            };
            setEvents(prev => [insertedRow, ...prev]);
          }
          handleCancelForm();
          addNotification('Event Created', 'Successfully scheduled the new community event.', 'success');
        } else {
          // Offline fallback
          const newEvent = {
            id: `e_${Date.now()}`,
            title,
            description,
            date,
            time: time || 'All Day',
            venue,
            organizer: organizer || currentUser.name
          };

          setEvents([newEvent, ...events]);
          handleCancelForm();
          addNotification('Event Created', 'Successfully scheduled the new community event.', 'success');
        }
      }
    } catch (err) {
      console.error(err);
      addNotification('Error', 'Failed to save event.', 'danger');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteEvent = async (eventId) => {
    if (!window.confirm('Are you sure you want to delete this event?')) return;

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('events')
          .delete()
          .eq('id', eventId);

        if (error) throw error;
        setEvents(prev => prev.filter(ev => ev.id !== eventId));
        addNotification('Event Deleted', 'The event has been deleted from database.', 'warning');
      } catch (err) {
        console.error(err);
        addNotification('Error', 'Failed to delete event.', 'danger');
      }
    } else {
      // Offline fallback
      setEvents(events.filter(ev => ev.id !== eventId));
      addNotification('Event Deleted', 'The event has been deleted.', 'warning');
    }
  };

  const handleRsvp = async (eventId, rsvpType) => {
    const event = events.find(e => e.id === eventId);
    if (!event) return;

    if (isSupabaseConfigured) {
      let updatedRsvpsList = [];
      if (Array.isArray(event.rsvps)) {
        updatedRsvpsList = event.rsvps.filter(r => r.user_id !== currentUser.id);
      }
      updatedRsvpsList.push({
        user_id: currentUser.id,
        name: currentUser.name,
        rsvp: rsvpType
      });

      try {
        const { error } = await supabase
          .from('events')
          .update({ rsvps: updatedRsvpsList })
          .eq('id', eventId);

        if (error) throw error;
        addNotification('RSVP Submitted', `Marked as ${rsvpType} for this event.`, 'success');
      } catch (err) {
        console.error(err);
        addNotification('Error', 'Failed to submit RSVP.', 'danger');
      }
    } else {
      // Offline fallback
      setEvents(events.map(ev => {
        if (ev.id !== eventId) return ev;

        const updatedRsvps = { ...ev.rsvps };
        const oldRsvp = ev.userRsvp;

        if (oldRsvp) {
          updatedRsvps[oldRsvp] = Math.max(0, updatedRsvps[oldRsvp] - 1);
        }

        updatedRsvps[rsvpType] = (updatedRsvps[rsvpType] || 0) + 1;

        return {
          ...ev,
          rsvps: updatedRsvps,
          userRsvp: rsvpType
        };
      }));

      addNotification('RSVP Submitted', `Marked as ${rsvpType} for this event.`, 'success');
    }
  };

  const getRsvpStats = (event) => {
    if (Array.isArray(event.rsvps)) {
      const list = event.rsvps;
      const userRsvpObj = list.find(r => r.user_id === currentUser.id);
      return {
        userRsvp: userRsvpObj ? userRsvpObj.rsvp : null,
        stats: {
          going: list.filter(r => r.rsvp === 'going').length,
          interested: list.filter(r => r.rsvp === 'interested').length,
          notGoing: list.filter(r => r.rsvp === 'notGoing').length
        }
      };
    } else {
      return {
        userRsvp: event.userRsvp || null,
        stats: event.rsvps || { going: 0, interested: 0, notGoing: 0 }
      };
    }
  };

  const todayStr = new Date().toISOString().split('T')[0]; // e.g. '2026-07-07'

  const upcomingEvents = events
    .filter(e => e.date >= todayStr)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const completedEvents = events
    .filter(e => e.date < todayStr)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const renderEventCard = (event) => {
    const { userRsvp, stats } = getRsvpStats(event);
    let attachedImage = null;
    let displayDescription = event.description || '';

    if (displayDescription.includes('\n\n[Attachment](')) {
      const parts = displayDescription.split('\n\n[Attachment](');
      displayDescription = parts[0];
      attachedImage = parts[1].replace(')', '');
    } else {
      attachedImage = event.cover_image || event.coverImage;
    }

    return (
      <div key={event.id} className="card event-card" style={{ display: 'flex', flexDirection: 'column', padding: '0px', overflow: 'hidden' }}>
        {/* Cover Banner */}
        <div style={{ height: '220px', backgroundColor: 'var(--primary-light)', position: 'relative' }}>
          <img 
            src={attachedImage || 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=600'} 
            alt="Event banner" 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
          />
          <div style={{ position: 'absolute', top: '12px', right: '12px' }}>
            <span className="badge urgent" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--primary)', fontWeight: 700 }}>
              📅 {new Date(event.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>

          {/* Edit/Delete options for Admin & Officer */}
          {(currentUser.role === 'admin' || currentUser.role === 'officer') && (
            <div style={{ position: 'absolute', top: '12px', left: '12px', display: 'flex', gap: '6px' }}>
              <button 
                onClick={() => handleStartEdit(event)}
                style={{
                  backgroundColor: 'var(--bg-card)', color: 'var(--primary)',
                  border: 'none', borderRadius: '4px', padding: '4px 8px',
                  cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: '4px',
                  boxShadow: 'var(--shadow-sm)'
                }}
                title="Edit Event"
              >
                ✏️ Edit
              </button>
              <button 
                onClick={() => handleDeleteEvent(event.id)}
                style={{
                  backgroundColor: 'rgba(231, 111, 81, 0.15)', color: 'var(--danger)',
                  border: '1px solid rgba(231, 111, 81, 0.3)', borderRadius: '4px', padding: '4px 8px',
                  cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: '4px',
                  boxShadow: 'var(--shadow-sm)'
                }}
                title="Delete Event"
              >
                🗑️ Delete
              </button>
            </div>
          )}
        </div>

        {/* Body Details */}
        <div style={{ padding: '20px', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '8px' }}>
            {event.title}
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px', flexGrow: 1, whiteSpace: 'pre-line' }}>
            {displayDescription}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem', marginTop: 'auto' }}>
            <p style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={14} style={{ color: 'var(--text-muted)' }} /> 
              <strong>Time:</strong> {event.time}
            </p>
            <p style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MapPin size={14} style={{ color: 'var(--text-muted)' }} /> 
              <strong>Venue:</strong> {event.venue}
            </p>
            <p style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Users size={14} style={{ color: 'var(--text-muted)' }} />
              <strong>Organizer:</strong> {event.organizer || 'Panchayat Council'}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="events-container">
      {/* View Header */}
      <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', width: '100%' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem', fontWeight: 700 }}>Village Events</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Stay informed about festivals, Gram Sabhas, sports meets, and camps.</p>
        </div>
        {!showAddForm && (currentUser.role === 'admin' || currentUser.role === 'officer') && (
          <button className="btn btn-accent" onClick={() => setShowAddForm(true)}>
            <Plus size={16} /> Schedule Event
          </button>
        )}
      </div>

      {/* Add Event Form */}
      {showAddForm && (
        <div className="card" style={{ animation: 'slideIn 0.2s ease' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>{editingEvent ? 'Edit Community Event' : 'Schedule Community Event'}</h3>
            <button type="button" className="role-btn" onClick={handleCancelForm}>Cancel</button>
          </div>
          <form onSubmit={handleSaveEvent}>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Event Title</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Gram Sabha Council Briefing" 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)} 
                  required 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Venue / Location</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Panchayat Union Hall" 
                  value={venue} 
                  onChange={(e) => setVenue(e.target.value)} 
                  required 
                />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Event Date</label>
                <input 
                  type="date" 
                  className="form-input" 
                  value={date} 
                  onChange={(e) => setDate(e.target.value)} 
                  required 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Event Time</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. 10:00 AM" 
                  value={time} 
                  onChange={(e) => setTime(e.target.value)} 
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Event Organizer</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="e.g. Panchayat Council / Sports Committee" 
                value={organizer} 
                onChange={(e) => setOrganizer(e.target.value)} 
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea 
                className="form-input" 
                rows={3} 
                placeholder="Give details about the event schedule, agenda, guest officials, etc." 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Attachment options (Select file / Camera) for Event Cover Image */}
            <div className="form-group" style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', marginTop: '4px' }}>
              <label className="form-label">Event Cover Image (Optional)</label>
              
              {/* Image Cropper/Editor if rawImageSrc is set */}
              {rawImageSrc ? (
                <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', backgroundColor: 'var(--bg-light)', marginBottom: '12px' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'var(--primary)' }}>Drag crop frame to position & adjust size</h4>
                  
                  {/* Crop View Container */}
                  <div 
                    onMouseMove={handleContainerMouseMove}
                    onTouchMove={handleContainerTouchMove}
                    onMouseUp={handleMouseUp}
                    onTouchEnd={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    style={{ 
                      width: '100%', 
                      position: 'relative', 
                      overflow: 'hidden', 
                      backgroundColor: '#222', 
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      cursor: isDragging ? 'move' : 'default',
                      userSelect: 'none'
                    }}
                  >
                    <img 
                      src={rawImageSrc} 
                      alt="Crop raw" 
                      draggable="false"
                      style={{ 
                        width: '100%', 
                        height: 'auto', 
                        display: 'block',
                        pointerEvents: 'none',
                        userSelect: 'none'
                      }} 
                    />
                    
                    {/* Draggable Crop Box Overlay */}
                    <div 
                      onMouseDown={handleBoxMouseDown}
                      onTouchStart={handleBoxTouchStart}
                      style={{
                        position: 'absolute',
                        left: `${cropBox.x}%`,
                        top: `${cropBox.y}%`,
                        width: `${cropBox.w}%`,
                        height: `${cropBox.h}%`,
                        border: '2px solid #fff',
                        boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)',
                        cursor: 'move',
                        zIndex: 10,
                        boxSizing: 'border-box'
                      }}
                    >
                      {/* Corner crop marks to look exactly like gallery crop tool */}
                      <div style={{ position: 'absolute', top: -3, left: -3, width: 12, height: 12, borderTop: '3px solid #fff', borderLeft: '3px solid #fff' }} />
                      <div style={{ position: 'absolute', top: -3, right: -3, width: 12, height: 12, borderTop: '3px solid #fff', borderRight: '3px solid #fff' }} />
                      <div style={{ position: 'absolute', bottom: -3, left: -3, width: 12, height: 12, borderBottom: '3px solid #fff', borderLeft: '3px solid #fff' }} />
                      <div style={{ position: 'absolute', bottom: -3, right: -3, width: 12, height: 12, borderBottom: '3px solid #fff', borderRight: '3px solid #fff' }} />
                    </div>
                  </div>

                  {/* Size Slider */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', width: '90px' }}>📏 Crop Size</span>
                    <input 
                      type="range" min="20" max="100" value={cropBox.w} 
                      onChange={(e) => {
                        const newW = parseFloat(e.target.value);
                        const newH = newW * (9 / 16);
                        setCropBox(prev => {
                          const nextX = Math.min(prev.x, 100 - newW);
                          const nextY = Math.min(prev.y, 100 - newH);
                          return { x: nextX, y: nextY, w: newW, h: newH };
                        });
                      }}
                      style={{ flex: 1, height: '4px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <button 
                      type="button" className="btn btn-primary" onClick={handleApplyCrop}
                      style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                    >
                      ✂️ Crop & Apply
                    </button>
                    <button 
                      type="button" className="btn btn-outline" onClick={() => setRawImageSrc(null)}
                      style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Main controls (Select Photo / Open Camera) */}
              {!rawImageSrc && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => fileInputRef.current?.click()}
                    style={{ fontSize: '0.8rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    📁 Select Photo
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={handleOpenCamera}
                    style={{ fontSize: '0.8rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    📸 Open Camera
                  </button>
                  
                  {imagePreview && (
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={handleRemoveImage}
                      style={{ fontSize: '0.8rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}
                    >
                      Remove Photo
                    </button>
                  )}
                </div>
              )}

              {/* Cropped Image Preview Container */}
              {imagePreview && !rawImageSrc && (
                <div style={{ position: 'relative', marginTop: '12px', borderRadius: '8px', overflow: 'hidden', maxHeight: '160px', border: '1px solid var(--border)' }}>
                  <img src={imagePreview} alt="Preview" style={{ width: '100%', height: '140px', objectFit: 'cover' }} />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    style={{
                      position: 'absolute', top: '8px', right: '8px',
                      backgroundColor: 'rgba(0,0,0,0.6)', color: '#fff',
                      border: 'none', borderRadius: '50%',
                      width: '24px', height: '24px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            <button type="submit" className="btn btn-primary" disabled={uploading} style={{ width: '100%', marginTop: '10px' }}>
              {uploading ? 'Uploading & Saving...' : (editingEvent ? 'Update Event' : 'Create Event')}
            </button>
          </form>
        </div>
      )}

      {/* Events Listing Divided by Section */}
      {events.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <Calendar size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
          <h4 style={{ fontWeight: 600 }}>No Events Scheduled</h4>
          <p style={{ color: 'var(--text-muted)' }}>There are no community events currently listed. Check back later!</p>
        </div>
      ) : (
        <>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: 600, marginTop: '24px', marginBottom: '16px', borderBottom: '2px solid var(--border)', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
            📅 Upcoming Events ({upcomingEvents.length})
          </h3>
          <div className="grid-2" style={{ marginBottom: '40px' }}>
            {upcomingEvents.length === 0 ? (
              <div className="card span-2" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                <Calendar size={32} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
                <p>No upcoming events scheduled at this time.</p>
              </div>
            ) : (
              upcomingEvents.map(event => renderEventCard(event))
            )}
          </div>

          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: 600, marginTop: '24px', marginBottom: '16px', borderBottom: '2px solid var(--border)', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
            ✅ Completed & Past Events ({completedEvents.length})
          </h3>
          <div className="grid-2">
            {completedEvents.length === 0 ? (
              <div className="card span-2" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                <Calendar size={32} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
                <p>No completed or past events found.</p>
              </div>
            ) : (
              completedEvents.map(event => renderEventCard(event))
            )}
          </div>
        </>
      )}



      {/* Camera Capture Modal Overlay */}
      {showCameraModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="card" style={{ maxWidth: '400px', width: '100%', padding: '20px', position: 'relative', textAlign: 'center' }}>
            <button 
              type="button"
              onClick={handleCloseCamera}
              style={{ position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              ✕
            </button>
            <h3 style={{ fontFamily: 'var(--font-heading)', color: 'var(--primary)', marginBottom: '16px' }}>Take Photo</h3>
            
            {cameraError ? (
              <div className="auth-error" style={{ marginBottom: '16px' }}>{cameraError}</div>
            ) : (
              <div style={{ backgroundColor: '#000', borderRadius: '8px', overflow: 'hidden', height: '280px', marginBottom: '16px', position: 'relative' }}>
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button 
                type="button"
                className="btn btn-outline" 
                onClick={handleCloseCamera}
              >
                Cancel
              </button>
              {!cameraError && (
                <button 
                  type="button"
                  className="btn btn-primary" 
                  onClick={handleCapturePhoto}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  Capture Photo
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
