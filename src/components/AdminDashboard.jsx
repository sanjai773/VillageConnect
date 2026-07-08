import React, { useState, useRef, useEffect } from 'react';
import { Shield, Users, AlertTriangle, Settings, BarChart2, Check, Trash2, ToggleLeft, ToggleRight, UserCheck, UserX, ShieldCheck, Pin, Plus } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../utils/supabaseClient';

export default function AdminDashboard({ 
  currentUser, 
  users, 
  setUsers, 
  posts, 
  setPosts, 
  reportedItems, 
  setReportedItems, 
  complaints,
  addNotification,
  announcements = [],
  setAnnouncements
}) {
  const isOfficer = currentUser?.role === 'officer';
  const defaultTab = !isOfficer && isSupabaseConfigured ? 'requests' : 'moderation';
  const [activeTab, setActiveTab] = useState(defaultTab);

  // Custom directory entries (to review profile edit requests)
  const [directoryEntries, setDirectoryEntries] = useState([]);

  useEffect(() => {
    const fetchEntries = async () => {
      if (isSupabaseConfigured) {
        try {
          const { data, error } = await supabase
            .from('village_directory')
            .select('*')
            .order('created_at', { ascending: false });
          if (data) setDirectoryEntries(data);
        } catch (e) {
          console.error(e);
        }
      } else {
        const saved = localStorage.getItem('vc_custom_directory');
        if (saved) {
          try {
            setDirectoryEntries(JSON.parse(saved));
          } catch (e) {}
        }
      }
    };
    fetchEntries();

    if (isSupabaseConfigured) {
      const sub = supabase
        .channel('admin_dashboard_directory')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'village_directory' }, (payload) => {
          if (payload.eventType === 'INSERT') {
            setDirectoryEntries(prev => {
              if (prev.some(e => e.id === payload.new.id)) return prev;
              return [payload.new, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            setDirectoryEntries(prev => prev.map(e => e.id === payload.new.id ? payload.new : e));
          } else if (payload.eventType === 'DELETE') {
            setDirectoryEntries(prev => prev.filter(e => e.id !== payload.old.id));
          }
        })
        .subscribe();
      return () => {
        supabase.removeChannel(sub);
      };
    }
  }, []);

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
  
  // Settings values
  const [waterSla, setWaterSla] = useState(24);
  const [powerSla, setPowerSla] = useState(12);
  const [roadSla, setRoadSla] = useState(72);
  const [features, setFeatures] = useState({
    tamilI18n: true,
    lowBandwidth: false,
    autoEscalation: true
  });

  // Announcements form state
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [annPriority, setAnnPriority] = useState('Normal');
  const [annCategory, setAnnCategory] = useState('General');
  const [annPinned, setAnnPinned] = useState(true);

  // Announcement media state
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [videoStream, setVideoStream] = useState(null);
  const [cameraError, setCameraError] = useState(null);

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

    setSelectedFile(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setSelectedFile(null);
    setImagePreview(null);
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
      setImagePreview(dataUrl);

      fetch(dataUrl)
        .then(res => res.blob())
        .then(blob => {
          const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
          setSelectedFile(file);
        });

      handleCloseCamera();
      addNotification('Captured', 'Photo taken successfully!', 'success');
    } catch (err) {
      console.error('Capture error:', err);
      addNotification('Error', 'Failed to capture photo.', 'danger');
    }
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

  const handleToggleFeature = (key) => {
    if (currentUser?.role !== 'admin') {
      addNotification('Access Denied', 'Only admins can change settings.', 'danger');
      return;
    }
    setFeatures({ ...features, [key]: !features[key] });
    addNotification('Setting Saved', `System setting updated.`, 'info');
  };

  // Moderation
  const handleModerate = async (itemId, type, action) => {
    if (isSupabaseConfigured) {
      try {
        if (action === 'delete') {
          if (type === 'post') {
            const { error } = await supabase.from('posts').delete().eq('id', itemId);
            if (error) throw error;
          }
          addNotification('Content Deleted', 'The reported post has been removed from database.', 'warning');
        } else {
          addNotification('Report Dismissed', 'Post approved and report cleared.', 'success');
        }
      } catch (err) {
        console.error(err);
        addNotification('Error', 'Failed to update database content.', 'danger');
      }
    } else {
      // Offline fallback logic
      if (action === 'delete') {
        if (type === 'post') {
          setPosts(posts.filter(p => p.id !== itemId));
        }
        addNotification('Content Deleted', 'The reported post has been removed.', 'warning');
      } else {
        addNotification('Report Dismissed', 'Post approved and report cleared.', 'success');
      }
    }
    setReportedItems(reportedItems.filter(item => item.id !== itemId));
  };

  // User Action: Verify / Suspend (Offline flow)
  const handleToggleVerifyUser = (userId) => {
    setUsers(users.map(u => {
      if (u.id !== userId) return u;
      const nextVerify = !u.isVerified;
      addNotification('User Status', `${u.name} is now ${nextVerify ? 'Verified' : 'Unverified'}.`, 'success');
      return { ...u, isVerified: nextVerify };
    }));
  };

  const handleToggleSuspendUser = (userId) => {
    setUsers(users.map(u => {
      if (u.id !== userId) return u;
      const nextSuspend = !u.isSuspended;
      addNotification('User Status', `${u.name} has been ${nextSuspend ? 'Suspended' : 'Un-suspended'}.`, 'warning');
      return { ...u, isSuspended: nextSuspend };
    }));
  };

  // Online Action: Approve / Reject Officer Registrations
  const handleOfficerApproval = async (userId, approveAction) => {
    if (!isSupabaseConfigured) {
      addNotification('Offline Mode', 'Approval flows require a live Supabase connection.', 'warning');
      return;
    }

    if (currentUser?.role !== 'admin') {
      addNotification('Access Denied', 'Only admins can approve officer requests.', 'danger');
      return;
    }

    const status = approveAction === 'approve' ? 'approved' : 'rejected';
    const targetUser = users.find(u => u.id === userId);
    const nameStr = targetUser ? targetUser.name : 'Officer';

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ approval_status: status })
        .eq('id', userId);

      if (error) throw error;
      
      addNotification(
        approveAction === 'approve' ? 'Request Approved' : 'Request Rejected', 
        `Officer ${nameStr} has been ${status}.`, 
        approveAction === 'approve' ? 'success' : 'warning'
      );
    } catch (err) {
      console.error(err);
      addNotification('Error', 'Failed to update officer status in database.', 'danger');
    }
  };

  // Remove Officer
  const handleRemoveOfficer = async (userId) => {
    if (currentUser?.role !== 'admin') {
      addNotification('Access Denied', 'Only admins can remove officers.', 'danger');
      return;
    }

    const targetUser = users.find(u => u.id === userId);
    const nameStr = targetUser ? targetUser.name : 'Officer';

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('profiles')
          .delete()
          .eq('id', userId);

        if (error) throw error;
        
        addNotification('Officer Removed', `Officer ${nameStr} has been removed.`, 'warning');
        setUsers(users.filter(u => u.id !== userId));
      } catch (err) {
        console.error(err);
        addNotification('Error', 'Failed to remove officer from database.', 'danger');
      }
    } else {
      // Offline fallback
      setUsers(users.filter(u => u.id !== userId));
      addNotification('Officer Removed', `Officer ${nameStr} has been removed.`, 'warning');
    }
  };

  // Announcements CRUD
  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    if (!annTitle.trim() || !annContent.trim()) return;

    setUploading(true);
    let imageUrl = null;

    try {
      if (selectedFile) {
        if (isSupabaseConfigured) {
          imageUrl = await uploadImageToSupabase(selectedFile);
        } else {
          imageUrl = imagePreview;
        }
      }

      if (isSupabaseConfigured) {
        // Try inserting with 'image' column
        const newAnnouncementObj = {
          title: annTitle,
          content: annContent,
          priority: annPriority.toLowerCase(),
          category: annCategory,
          pinned: annPinned,
          author: currentUser.name,
          created_by: currentUser.id,
          image: imageUrl
        };

        const { error } = await supabase.from('announcements').insert(newAnnouncementObj);

        if (error) {
          // If column 'image' does not exist, fall back to appending it to content
          if (error.message && error.message.includes('column "image" of relation "announcements" does not exist')) {
            console.warn('Image column does not exist on announcements table. Appending image URL to content as fallback.');
            const fallbackAnnouncementObj = {
              title: annTitle,
              content: imageUrl ? `${annContent}\n\n[Attachment](${imageUrl})` : annContent,
              priority: annPriority.toLowerCase(),
              category: annCategory,
              pinned: annPinned,
              author: currentUser.name,
              created_by: currentUser.id
            };
            const { error: fallbackError } = await supabase.from('announcements').insert(fallbackAnnouncementObj);
            if (fallbackError) throw fallbackError;
          } else {
            throw error;
          }
        }
        
        setAnnTitle('');
        setAnnContent('');
        setAnnPriority('Normal');
        setAnnCategory('General');
        setAnnPinned(true);
        handleRemoveImage();
        addNotification('Published', 'Announcement posted successfully!', 'success');
      } else {
        // Offline fallback
        const newAnn = {
          id: `a_${Date.now()}`,
          title: annTitle,
          content: annContent,
          priority: annPriority.toLowerCase(),
          category: annCategory,
          pinned: annPinned,
          date: new Date().toISOString(),
          author: currentUser.name,
          views: 0,
          image: imageUrl
        };

        setAnnouncements([newAnn, ...announcements]);
        setAnnTitle('');
        setAnnContent('');
        setAnnPriority('Normal');
        setAnnCategory('General');
        setAnnPinned(true);
        handleRemoveImage();
        addNotification('Published', 'Announcement posted locally!', 'success');
      }
    } catch (err) {
      console.error(err);
      addNotification('Error', 'Failed to publish announcement.', 'danger');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAnnouncement = async (annId) => {
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from('announcements').delete().eq('id', annId);
        if (error) throw error;
        addNotification('Deleted', 'Announcement removed from database.', 'warning');
      } catch (err) {
        console.error(err);
        addNotification('Error', 'Failed to delete announcement.', 'danger');
      }
    } else {
      setAnnouncements(announcements.filter(a => a.id !== annId));
      addNotification('Deleted', 'Announcement removed.', 'warning');
    }
  };

  // Filter pending requests for approval tab
  const pendingOfficers = users.filter(u => u.role === 'officer' && u.approval_status === 'pending');

  // Count metrics for analytics
  const totalComplaints = complaints.length;
  const resolvedCount = complaints.filter(c => c.status === 'Resolved' || c.status === 'Closed').length;
  const pendingCount = totalComplaints - resolvedCount;
  
  // Parse ratings from complaint updates or base rating attributes
  const ratedComplaints = complaints.filter(c => {
    const timelineValue = c.updates || c.timeline || [];
    const closedStep = timelineValue.find(t => t.status === 'Closed');
    return c.rating || (closedStep && closedStep.rating);
  });

  const averageRating = ratedComplaints.length > 0
    ? (ratedComplaints.reduce((sum, c) => {
        const timelineValue = c.updates || c.timeline || [];
        const closedStep = timelineValue.find(t => t.status === 'Closed');
        const val = c.rating || (closedStep ? closedStep.rating : 0);
        return sum + val;
      }, 0) / ratedComplaints.length).toFixed(1)
    : 'N/A';

  // Categorized breakdown
  const categoryCounts = complaints.reduce((acc, c) => {
    acc[c.category] = (acc[c.category] || 0) + 1;
    return acc;
  }, {});

  // Tabs layout builder
  const pendingEditsCount = directoryEntries.filter(e => e.edit_permission === 'requested').length;
  const totalRequestsCount = pendingOfficers.length + pendingEditsCount;

  const tabs = [
    { id: 'moderation', label: 'Moderation Queue', icon: <AlertTriangle size={16} /> },
    ...(!isOfficer && isSupabaseConfigured ? [{ id: 'requests', label: `Approval Requests (${totalRequestsCount})`, icon: <ShieldCheck size={16} /> }] : []),
    { id: 'announcements', label: 'Announcements Manager', icon: <Pin size={16} /> },
    { id: 'users', label: 'Resident Directory', icon: <Users size={16} /> },
    { id: 'analytics', label: 'Civic Analytics', icon: <BarChart2 size={16} /> },
    ...(!isOfficer ? [{ id: 'settings', label: 'System Settings', icon: <Settings size={16} /> }] : [])
  ];

  return (
    <div className="admin-container">
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Shield style={{ color: 'var(--accent)' }} /> Panchayat Admin Panel
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          {isSupabaseConfigured 
            ? 'Manage secure officer verification requests, moderate live posts, analyze village metrics, and customize settings.' 
            : 'Moderate community posts, verify citizens, configure SLAs, and review analytics dashboards.'}
        </p>
      </div>

      {/* Admin Tabs */}
      <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid var(--border)', paddingBottom: '1px', marginBottom: '20px', overflowX: 'auto' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 16px',
              cursor: 'pointer',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.id ? '3px solid var(--accent)' : '3px solid transparent',
              color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: activeTab === tab.id ? 600 : 500,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.9rem',
              transition: 'var(--transition)',
              whiteSpace: 'nowrap'
            }}
            className="dark-theme-tab"
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Approval Requests (Live DB only) */}
      {activeTab === 'requests' && isSupabaseConfigured && !isOfficer && (
        <div style={{ animation: 'slideIn 0.2s ease', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Section 1: Officer Sign-up Requests */}
          <div>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              👤 Officer Signup Requests ({pendingOfficers.length})
            </h3>
            {pendingOfficers.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '24px' }}>
                <Check size={32} style={{ color: 'var(--success)', marginBottom: '8px', display: 'inline-block' }} />
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No pending officer signup requests.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {pendingOfficers.map(officer => (
                  <div key={officer.id} className="card" style={{ borderLeft: '5px solid var(--accent)', padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
                      <div>
                        <h4 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--primary)' }}>{officer.name}</h4>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Email: {officer.email} | Phone: {officer.phone || 'N/A'}</p>
                      </div>
                      <span className="badge urgent" style={{ fontSize: '0.7rem' }}>Pending Approval</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.85rem', backgroundColor: 'var(--primary-light)', padding: '12px', borderRadius: 'var(--radius-sm)', marginBottom: '16px' }}>
                      <p><strong>Address:</strong> {officer.address || 'N/A'}</p>
                      <p><strong>Occupation:</strong> {officer.occupation || 'N/A'}</p>
                      <p><strong>Blood Group:</strong> {officer.blood_group || 'N/A'}</p>
                      <p><strong>Skills:</strong> {officer.skills ? officer.skills.join(', ') : 'None'}</p>
                      <p className="span-2"><strong>Volunteer Interests:</strong> {officer.volunteer ? officer.volunteer.join(', ') : 'None'}</p>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button 
                        className="btn btn-outline" 
                        onClick={() => handleOfficerApproval(officer.id, 'reject')}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '8px 16px', color: 'var(--danger)', borderColor: 'var(--danger)' }}
                      >
                        <UserX size={14} /> Reject Request
                      </button>
                      <button 
                        className="btn btn-primary" 
                        onClick={() => handleOfficerApproval(officer.id, 'approve')}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '8px 16px' }}
                      >
                        <UserCheck size={14} /> Approve & Clear
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Directory Profile Edit Requests */}
          <div>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              📝 Directory Profile Edit Requests ({pendingEditsCount})
            </h3>
            {pendingEditsCount === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '24px' }}>
                <Check size={32} style={{ color: 'var(--success)', marginBottom: '8px', display: 'inline-block' }} />
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No pending directory edit requests.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {directoryEntries.filter(e => e.edit_permission === 'requested').map(entry => (
                  <div key={entry.id} className="card" style={{ borderLeft: '5px solid var(--primary)', padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
                      <div>
                        <h4 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--primary)' }}>{entry.name}</h4>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Phone: {entry.phone || 'N/A'} | Occupation: {entry.occupation || 'Resident'}</p>
                      </div>
                      <span className="badge urgent" style={{ fontSize: '0.7rem', backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>Wants to Edit</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.85rem', backgroundColor: 'var(--primary-light)', padding: '12px', borderRadius: 'var(--radius-sm)', marginBottom: '16px' }}>
                      <p><strong>Address:</strong> {entry.address || 'N/A'}</p>
                      <p><strong>Blood Group:</strong> {entry.blood_group || 'N/A'}</p>
                      <p><strong>Skills:</strong> {entry.skills ? entry.skills.join(', ') : 'None'}</p>
                      <p className="span-2"><strong>Volunteer Interests:</strong> {entry.volunteer ? entry.volunteer.join(', ') : 'None'}</p>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button 
                        className="btn btn-outline" 
                        onClick={() => handleAdminPermissionResponse(entry, 'idle')}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '8px 16px', color: 'var(--danger)', borderColor: 'var(--danger)' }}
                      >
                        Reject & Lock
                      </button>
                      <button 
                        className="btn btn-primary" 
                        onClick={() => handleAdminPermissionResponse(entry, 'granted')}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '8px 16px' }}
                      >
                        Grant Edit Rights
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* Tab: Announcements Manager */}
      {activeTab === 'announcements' && (
        <div style={{ animation: 'slideIn 0.2s ease', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Create Announcement Form */}
          <div className="card">
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Plus size={18} /> Publish New Announcement
            </h3>
            
            <form onSubmit={handleCreateAnnouncement} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Announcement Title</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. Free Eye Screening Camp details" 
                    value={annTitle} 
                    onChange={(e) => setAnnTitle(e.target.value)} 
                    required 
                  />
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select className="form-select" value={annCategory} onChange={(e) => setAnnCategory(e.target.value)}>
                      <option>General</option>
                      <option>Water Supply</option>
                      <option>Power Supply</option>
                      <option>Sanitation</option>
                      <option>Health</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Priority</label>
                    <select className="form-select" value={annPriority} onChange={(e) => setAnnPriority(e.target.value)}>
                      <option>Normal</option>
                      <option>Important</option>
                      <option>Urgent</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Content Description</label>
                <textarea 
                  className="form-input" 
                  rows={3} 
                  placeholder="Detail the announcement information, timings, contact officers, etc..." 
                  value={annContent}
                  onChange={(e) => setAnnContent(e.target.value)}
                  required
                />
              </div>

              {/* Attachment options (Select file / Camera) */}
              <div className="form-group" style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', marginTop: '4px' }}>
                <label className="form-label">Attachment (Optional)</label>
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

                {imagePreview && (
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

              <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
                <input 
                  type="checkbox" 
                  id="ann-pin" 
                  checked={annPinned} 
                  onChange={(e) => setAnnPinned(e.target.checked)} 
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="ann-pin" style={{ fontSize: '0.9rem', cursor: 'pointer', userSelect: 'none' }}>
                  Pin announcement to top of community feed
                </label>
              </div>

              <button type="submit" className="btn btn-primary" disabled={uploading} style={{ alignSelf: 'flex-start', padding: '10px 24px' }}>
                {uploading ? 'Publishing...' : 'Publish Announcement'}
              </button>
            </form>
          </div>

          {/* Announcements Directory list */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>
              Active Announcements ({announcements.length})
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--primary-light)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '12px 16px' }}>Title & Author</th>
                  <th style={{ padding: '12px 16px' }}>Category</th>
                  <th style={{ padding: '12px 16px' }}>Priority</th>
                  <th style={{ padding: '12px 16px' }}>Pinned</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {announcements.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No announcements posted yet.
                    </td>
                  </tr>
                ) : (
                  announcements.map(ann => {
                    let attachedImage = ann.image;
                    if (!attachedImage && ann.content && ann.content.includes('\n\n[Attachment](')) {
                      const parts = ann.content.split('\n\n[Attachment](');
                      attachedImage = parts[1].replace(')', '');
                    }
                    return (
                      <tr key={ann.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {attachedImage && (
                              <img 
                                src={attachedImage} 
                                alt="thumb" 
                                style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--border)', flexShrink: 0 }} 
                              />
                            )}
                            <div>
                              <strong>{ann.title}</strong> <br />
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>By: {ann.author} | {new Date(ann.date || Date.now()).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </td>
                      <td style={{ padding: '12px 16px' }}>{ann.category}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span className={`badge ${ann.priority}`} style={{ fontSize: '0.7rem' }}>{ann.priority}</span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>{ann.pinned ? '📌 Yes' : 'No'}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button 
                          className="sidebar-logout-btn" 
                          onClick={() => handleDeleteAnnouncement(ann.id)}
                          style={{
                            padding: '4px 8px',
                            backgroundColor: 'rgba(231, 111, 81, 0.1)',
                            color: 'var(--danger)',
                            border: '1px solid rgba(231, 111, 81, 0.2)',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.75rem'
                          }}
                        >
                          <Trash2 size={12} style={{ marginRight: '4px' }} /> Delete
                        </button>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* Tab: Moderation */}
      {activeTab === 'moderation' && (
        <div style={{ animation: 'slideIn 0.2s ease' }}>
          {reportedItems.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
              <Check size={40} style={{ color: 'var(--success)', marginBottom: '12px' }} />
              <h4 style={{ fontWeight: 600 }}>Moderation Queue Empty</h4>
              <p style={{ color: 'var(--text-muted)' }}>Excellent! No content has been reported by residents recently.</p>
            </div>
          ) : (
            reportedItems.map(item => (
              <div key={item.id} className="card" style={{ borderLeft: '5px solid var(--danger)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span className="badge urgent">Flagged {item.type}</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ID: {item.id}</span>
                </div>
                
                <div style={{ padding: '12px', backgroundColor: 'var(--primary-light)', borderRadius: '6px', fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '16px' }}>
                  <p><strong>Reporter Note:</strong> Content flagged as inappropriate/spam.</p>
                  <blockquote style={{ borderLeft: '3px solid var(--border)', paddingLeft: '10px', marginTop: '6px', fontStyle: 'italic', color: 'var(--text-muted)' }}>
                    "{item.content}"
                  </blockquote>
                </div>

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button className="btn btn-outline" onClick={() => handleModerate(item.id, item.type, 'approve')} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                    <Check size={14} /> Dismiss Report
                  </button>
                  <button className="btn btn-danger" onClick={() => handleModerate(item.id, item.type, 'delete')} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                    <Trash2 size={14} /> Delete Content
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab: User Account Management */}
      {activeTab === 'users' && (
        <div className="card" style={{ padding: '0px', overflow: 'hidden', animation: 'slideIn 0.2s ease' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--primary-light)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '12px 16px' }}>Resident/Officer</th>
                <th style={{ padding: '12px 16px' }}>Address</th>
                <th style={{ padding: '12px 16px' }}>Role</th>
                <th style={{ padding: '12px 16px' }}>Status</th>
                {!isOfficer && <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--border)', backgroundColor: u.isSuspended ? 'rgba(231, 111, 81, 0.05)' : 'transparent' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <strong>{u.name}</strong> <br />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{u.phone || u.email || 'No contact'}</span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>{u.address || 'N/A'}</td>
                  <td style={{ padding: '12px 16px', textTransform: 'capitalize' }}>
                    {u.role}
                    {u.role === 'officer' && u.approval_status && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '6px' }}>
                        ({u.approval_status})
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {u.isSuspended ? (
                      <span className="badge urgent" style={{ fontSize: '0.65rem' }}>Suspended</span>
                    ) : u.isVerified || u.approval_status === 'approved' ? (
                      <span className="badge resolved" style={{ fontSize: '0.65rem' }}>Verified</span>
                    ) : u.approval_status === 'pending' ? (
                      <span className="badge urgent" style={{ fontSize: '0.65rem', backgroundColor: 'var(--accent-light)', color: 'var(--accent-hover)' }}>Pending</span>
                    ) : (
                      <span className="badge normal" style={{ fontSize: '0.65rem' }}>Unverified</span>
                    )}
                  </td>
                  {!isOfficer && (
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                        {!isSupabaseConfigured && (
                          <>
                            <button 
                              className="role-btn" 
                              onClick={() => handleToggleVerifyUser(u.id)}
                              style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                            >
                              {u.isVerified ? 'Revoke Verify' : 'Verify'}
                            </button>
                            <button 
                              className="role-btn" 
                              onClick={() => handleToggleSuspendUser(u.id)}
                              style={{
                                fontSize: '0.75rem', 
                                padding: '4px 8px',
                                backgroundColor: u.isSuspended ? 'var(--success-light)' : 'var(--danger-light)',
                                color: u.isSuspended ? 'var(--success)' : 'var(--danger)',
                                border: 'none'
                              }}
                            >
                              {u.isSuspended ? 'Reactivate' : 'Suspend'}
                            </button>
                          </>
                        )}
                        {u.role === 'officer' && (
                          <button 
                            className="btn btn-outline" 
                            onClick={() => handleRemoveOfficer(u.id)}
                            style={{
                              fontSize: '0.75rem', 
                              padding: '4px 8px',
                              color: 'var(--danger)',
                              borderColor: 'var(--danger)',
                              backgroundColor: 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <UserX size={12} style={{ color: 'var(--danger)' }} /> Remove Officer
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Civic Analytics Dashboard */}
      {activeTab === 'analytics' && (
        <div style={{ animation: 'slideIn 0.2s ease' }}>
          {/* Quick Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '24px' }}>
            <div className="card" style={{ padding: '16px', borderLeft: '4px solid var(--primary)' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Complaints Filed</span>
              <h2 style={{ fontSize: '2rem', fontWeight: 700, margin: '4px 0' }}>{totalComplaints}</h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--success)' }}>100% submission tracking</span>
            </div>
            <div className="card" style={{ padding: '16px', borderLeft: '4px solid var(--success)' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Resolved Complaints</span>
              <h2 style={{ fontSize: '2rem', fontWeight: 700, margin: '4px 0' }}>{resolvedCount}</h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--success)' }}>
                {totalComplaints > 0 ? `${Math.round((resolvedCount / totalComplaints) * 100)}%` : '0%'} resolution efficiency
              </span>
            </div>
            <div className="card" style={{ padding: '16px', borderLeft: '4px solid var(--accent)' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pending Investigation</span>
              <h2 style={{ fontSize: '2rem', fontWeight: 700, margin: '4px 0' }}>{pendingCount}</h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--danger)' }}>Active SLA timers in progress</span>
            </div>
            <div className="card" style={{ padding: '16px', borderLeft: '4px solid gold' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Citizen Satisfaction Rating</span>
              <h2 style={{ fontSize: '2rem', fontWeight: 700, margin: '4px 0', display: 'flex', alignItems: 'center', gap: '6px', color: averageRating !== 'N/A' ? 'gold' : 'inherit' }}>
                ⭐ {averageRating}
              </h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Based on {ratedComplaints.length} rating feedbacks
              </span>
            </div>
          </div>

          {/* Graphical Analytics (Custom CSS graphs) */}
          <div className="grid-2">
            
            {/* Chart 1: Complaint Breakdown */}
            <div className="card">
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', fontWeight: 600, marginBottom: '16px' }}>
                Complaints Volume by Category
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {['Water Supply', 'Power Supply', 'Roads & Streets', 'Sanitation', 'Health'].map(cat => {
                  const count = categoryCounts[cat] || 0;
                  const percent = totalComplaints > 0 ? (count / totalComplaints) * 100 : 0;
                  return (
                    <div key={cat}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                        <span>{cat}</span>
                        <strong>{count} ({Math.round(percent)}%)</strong>
                      </div>
                      <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${percent}%`, height: '100%', backgroundColor: 'var(--primary)', transition: 'width 0.3s ease' }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Chart 2: Resolution Progress */}
            <div className="card">
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', fontWeight: 600, marginBottom: '16px' }}>
                Resolution Progress Indicators
              </h3>
              <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end', height: '120px', paddingBottom: '10px' }}>
                {[
                  { label: 'Pending', count: pendingCount, height: totalComplaints > 0 ? (pendingCount / totalComplaints) * 100 : 0, color: 'var(--danger)' },
                  { label: 'In Progress', count: complaints.filter(c => c.status === 'In Progress').length, height: totalComplaints > 0 ? (complaints.filter(c => c.status === 'In Progress').length / totalComplaints) * 100 : 0, color: 'var(--accent)' },
                  { label: 'Resolved', count: resolvedCount, height: totalComplaints > 0 ? (resolvedCount / totalComplaints) * 100 : 0, color: 'var(--success)' }
                ].map(bar => (
                  <div key={bar.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>{bar.count}</span>
                    <div style={{ width: '32px', height: `${Math.max(5, bar.height)}px`, backgroundColor: bar.color, borderRadius: '4px 4px 0 0', transition: 'height 0.3s ease' }}></div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{bar.label}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Tab: System Settings */}
      {activeTab === 'settings' && !isOfficer && (
        <div style={{ animation: 'slideIn 0.2s ease' }}>
          
          {/* SLA Settings */}
          <div className="card">
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px' }}>
              Configure Category SLA Rules (Hours)
            </h3>
            
            <div className="grid-3">
              <div className="form-group">
                <label className="form-label">Water Supply SLA</label>
                <input 
                  type="number" 
                  className="form-input" 
                  value={waterSla} 
                  onChange={(e) => setWaterSla(parseInt(e.target.value) || 24)} 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Power Supply SLA</label>
                <input 
                  type="number" 
                  className="form-input" 
                  value={powerSla} 
                  onChange={(e) => setPowerSla(parseInt(e.target.value) || 12)} 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Roads & Streets SLA</label>
                <input 
                  type="number" 
                  className="form-input" 
                  value={roadSla} 
                  onChange={(e) => setRoadSla(parseInt(e.target.value) || 72)} 
                />
              </div>
            </div>
            
            <button className="btn btn-primary" onClick={() => addNotification('Settings Saved', 'SLA timers configured successfully.', 'success')}>
              Save SLA Configuration
            </button>
          </div>

          {/* Feature Toggles */}
          <div className="card">
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px' }}>
              Feature Toggles (PRD Requirements)
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {[
                { key: 'tamilI18n', label: 'Multilingual support (English + Tamil UI translation)', desc: 'Enables strings and toggles for localization.' },
                { key: 'lowBandwidth', label: 'Offline / Low-bandwidth loading optimization', desc: 'Minimizes image payloads and enables offline caching.' },
                { key: 'autoEscalation', label: 'Automated Panchayat escalation (when SLA breaches)', desc: 'Automatically flags overdue tasks to the president.' }
              ].map(feat => (
                <div key={feat.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ minWidth: 0, paddingRight: '12px' }}>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 600 }}>{feat.label}</h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{feat.desc}</p>
                  </div>
                  <button 
                    onClick={() => handleToggleFeature(feat.key)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: features[feat.key] ? 'var(--success)' : 'var(--text-muted)' }}
                  >
                    {features[feat.key] ? <ToggleRight size={38} /> : <ToggleLeft size={38} />}
                  </button>
                </div>
              ))}
            </div>
          </div>

        </div>
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

      {/* Styles details overrides */}
      <style dangerouslySetInnerHTML={{__html: `
        th, td {
          border-bottom: 1px solid var(--border);
        }
        tr:hover {
          background-color: var(--primary-light);
        }
        .dark-theme .dark-theme-tab {
          border-bottom-color: transparent;
        }
      `}} />

    </div>
  );
}
