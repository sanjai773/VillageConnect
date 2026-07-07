import React, { useState, useRef, useEffect } from 'react';
import { Heart, ThumbsUp, HelpCircle, MessageSquare, Send, Flag, Pin, AlertTriangle, Image as ImageIcon, X } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../utils/supabaseClient';

export default function FeedView({ 
  currentUser, 
  posts, 
  setPosts, 
  announcements, 
  addNotification,
  reportPost 
}) {
  const [newPostText, setNewPostText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [commentInputs, setCommentInputs] = useState({});
  const [uploading, setUploading] = useState(false);

  // Custom Camera Modal state
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [videoStream, setVideoStream] = useState(null);
  const [cameraError, setCameraError] = useState(null);

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);

  // Bind the camera stream to the video element when rendered
  useEffect(() => {
    if (showCameraModal && videoRef.current && videoStream) {
      videoRef.current.srcObject = videoStream;
    }
  }, [showCameraModal, videoStream]);

  // Clean up stream on unmount
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

      // Convert Data URL to file object for Supabase upload
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

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newPostText.trim()) return;

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
        const { error } = await supabase.from('posts').insert({
          author_name: currentUser.name,
          author_role: currentUser.role,
          author_avatar: currentUser.role === 'admin' ? '🏛️' : currentUser.role === 'officer' ? '💼' : '👤',
          content: newPostText,
          image: imageUrl,
          author_id: currentUser.id
        });

        if (error) throw error;
        
        setNewPostText('');
        handleRemoveImage();
        addNotification('Success', 'Your post has been published to the community feed!', 'success');
      } else {
        const newPost = {
          id: `p_${Date.now()}`,
          authorName: currentUser.name,
          authorRole: currentUser.role,
          authorAvatar: currentUser.role === 'admin' ? '🏛️' : currentUser.role === 'officer' ? '💼' : '👤',
          content: newPostText,
          image: imageUrl,
          likes: 0,
          reactions: { like: 0, love: 0, support: 0 },
          hasReacted: null,
          comments: [],
          timestamp: new Date().toISOString()
        };

        setPosts([newPost, ...posts]);
        setNewPostText('');
        handleRemoveImage();
        addNotification('Success', 'Your post has been published to the community feed!', 'success');
      }
    } catch (err) {
      console.error(err);
      addNotification('Error', 'Failed to publish post.', 'danger');
    } finally {
      setUploading(false);
    }
  };

  const handleReact = async (postId, reactionType) => {
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    const updatedReactions = { ...post.reactions };
    let newHasReacted = reactionType;
    let likesDelta = 0;

    if (post.hasReacted === reactionType) {
      updatedReactions[reactionType] = Math.max(0, (updatedReactions[reactionType] || 1) - 1);
      newHasReacted = null;
      likesDelta = -1;
    } else {
      if (post.hasReacted) {
        updatedReactions[post.hasReacted] = Math.max(0, (updatedReactions[post.hasReacted] || 1) - 1);
      } else {
        likesDelta = 1;
      }
      updatedReactions[reactionType] = (updatedReactions[reactionType] || 0) + 1;
    }

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from('posts').update({
          reactions: updatedReactions,
          likes: (post.likes || 0) + likesDelta
        }).eq('id', postId);

        if (error) throw error;
      } catch (err) {
        console.error(err);
      }
    }

    setPosts(posts.map(p => {
      if (p.id !== postId) return p;
      return {
        ...p,
        reactions: updatedReactions,
        likes: (p.likes || 0) + likesDelta,
        hasReacted: newHasReacted
      };
    }));
  };

  const handleAddComment = async (postId) => {
    const commentText = commentInputs[postId];
    if (!commentText || !commentText.trim()) return;

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from('comments').insert({
          post_id: postId,
          author_name: currentUser.name,
          text: commentText
        });

        if (error) throw error;
        setCommentInputs({ ...commentInputs, [postId]: '' });
      } catch (err) {
        console.error(err);
        addNotification('Error', 'Failed to publish comment to database.', 'danger');
      }
    } else {
      setPosts(posts.map(post => {
        if (post.id !== postId) return post;
        return {
          ...post,
          comments: [
            ...post.comments,
            {
              id: `c_${Date.now()}`,
              author: currentUser.name,
              text: commentText,
              time: new Date().toISOString()
            }
          ]
        };
      }));
      setCommentInputs({ ...commentInputs, [postId]: '' });
    }
  };

  const formatTime = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="feed-container">
      {/* Pinned Announcements */}
      {announcements.length > 0 && (
        <div className="announcements-section" style={{ marginBottom: '24px' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Pin size={18} style={{ transform: 'rotate(45deg)' }} /> Pinned Announcements
          </h3>
          {announcements.filter(a => a.pinned).map(announce => {
            let displayContent = announce.content;
            let attachedImage = announce.image;

            if (!attachedImage && announce.content && announce.content.includes('\n\n[Attachment](')) {
              const parts = announce.content.split('\n\n[Attachment](');
              displayContent = parts[0];
              attachedImage = parts[1].replace(')', '');
            }

            return (
              <div key={announce.id} className={`card announcement-card border-${announce.priority}`} style={{
                borderLeft: `5px solid ${announce.priority === 'urgent' ? 'var(--danger)' : announce.priority === 'important' ? 'var(--accent)' : 'var(--primary)'}`,
                padding: '16px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <span className={`badge ${announce.priority}`}>{announce.priority}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatTime(announce.date)}</span>
                </div>
                <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 600, marginBottom: '6px' }}>{announce.title}</h4>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '8px', whiteSpace: 'pre-line' }}>{displayContent}</p>
                
                {attachedImage && (
                  <div style={{ marginTop: '12px', maxHeight: '300px', overflow: 'hidden', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <img src={attachedImage} alt="Announcement attachment" style={{ width: '100%', height: 'auto', objectFit: 'cover' }} />
                  </div>
                )}

                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: '16px', marginTop: '12px' }}>
                  <span>By: <strong>{announce.author}</strong></span>
                  <span>Category: <strong>{announce.category}</strong></span>
                  <span>Views: <strong>{announce.views}</strong></span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Post Section */}
      <div className="card create-post-card" style={{ padding: '16px' }}>
        <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '12px', fontSize: '1.1rem' }}>Share with Community</h3>
        <form onSubmit={handleCreatePost}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <div className="user-avatar" style={{ fontSize: '1.25rem', width: '36px', height: '36px' }}>
              {currentUser.role === 'admin' ? '🏛️' : currentUser.role === 'officer' ? '💼' : '👤'}
            </div>
            <div style={{ flexGrow: 1 }}>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder={`What's happening in the village, ${currentUser.name}?`}
                value={newPostText}
                onChange={(e) => setNewPostText(e.target.value)}
                style={{ resize: 'none', padding: '10px', fontSize: '0.95rem' }}
                disabled={uploading}
              />
              
              {/* Image upload preview */}
              {imagePreview && (
                <div style={{ position: 'relative', marginTop: '12px', borderRadius: '8px', overflow: 'hidden', maxHeight: '180px', width: 'fit-content', border: '1px solid var(--border)' }}>
                  <img src={imagePreview} alt="Selected upload preview" style={{ maxHeight: '180px', maxWidth: '100%', objectFit: 'contain', display: 'block' }} />
                  <button 
                    type="button" 
                    onClick={handleRemoveImage}
                    style={{
                      position: 'absolute', top: '8px', right: '8px', 
                      backgroundColor: 'rgba(0,0,0,0.6)', color: '#fff', 
                      border: 'none', borderRadius: '50%', width: '24px', height: '24px', 
                      display: 'flex', alignItems: 'center', justifyTime: 'center', justifyContent: 'center', cursor: 'pointer',
                      boxShadow: 'var(--shadow-sm)'
                    }}
                    title="Remove Image"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Hidden HTML file inputs */}
          <input 
            type="file" 
            accept="image/*" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            style={{ display: 'none' }} 
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => fileInputRef.current.click()}
                style={{ padding: '6px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                disabled={uploading}
              >
                📁 Select File
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleOpenCamera}
                style={{ padding: '6px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                disabled={uploading}
              >
                📸 Open Camera
              </button>
            </div>
            
            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ padding: '6px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              disabled={uploading || !newPostText.trim()}
            >
              {uploading ? 'Publishing...' : 'Publish Post'}
            </button>
          </div>
        </form>
      </div>

      {/* Camera Capture Modal Overlay */}
      {showCameraModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1100,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '20px'
        }}>
          <div className="card" style={{ maxWidth: '500px', width: '100%', padding: '24px', textAlign: 'center', position: 'relative' }}>
            <button 
              type="button"
              onClick={handleCloseCamera}
              style={{ position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              <X size={20} />
            </button>
            <h3 style={{ fontFamily: 'var(--font-heading)', color: 'var(--primary)', marginBottom: '12px', fontSize: '1.25rem' }}>Capture Photo</h3>
            
            {cameraError ? (
              <div className="auth-error" style={{ marginBottom: '16px' }}>{cameraError}</div>
            ) : (
              <div style={{ borderRadius: '8px', overflow: 'hidden', backgroundColor: '#000', marginBottom: '16px', position: 'relative', width: '100%', aspectRatio: '4/3' }}>
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              {!cameraError && (
                <button 
                  type="button" 
                  className="btn btn-primary"
                  onClick={handleCapturePhoto}
                  style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  📸 Capture Photo
                </button>
              )}
              <button 
                type="button" 
                className="btn btn-outline"
                onClick={handleCloseCamera}
                style={{ padding: '8px 16px' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* News Feed Timeline */}
      <div className="feed-posts">
        {posts.map(post => (
          <div key={post.id} className="card feed-card" style={{ padding: '20px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div className="user-avatar" style={{ fontSize: '1.25rem', width: '36px', height: '36px' }}>
                  {post.authorAvatar || post.author_avatar || '👤'}
                </div>
                <div>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 600 }}>{post.authorName || post.author_name}</h4>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                    {(post.authorRole || post.author_role)} • {formatTime(post.timestamp)}
                  </span>
                </div>
              </div>
              <button 
                className="theme-toggle" 
                title="Report Content"
                onClick={() => {
                  reportPost(post.id, 'post');
                  addNotification('Reported', 'Post sent to moderation queue.', 'warning');
                }}
              >
                <Flag size={16} />
              </button>
            </div>

            {/* Content */}
            <p style={{ fontSize: '0.95rem', marginBottom: '12px', whiteSpace: 'pre-wrap' }}>{post.content}</p>
            
            {post.image && (
              <div style={{ borderRadius: '8px', overflow: 'hidden', marginBottom: '12px', maxHeight: '350px' }}>
                <img src={post.image} alt="Post Attachment" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}

            {/* Action Bar */}
            <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '8px 0', marginBottom: '12px' }}>
              <button 
                className={`btn btn-outline ${post.hasReacted === 'like' ? 'active' : ''}`}
                onClick={() => handleReact(post.id, 'like')}
                style={{ flexGrow: 1, border: 'none', padding: '6px', borderRadius: '4px', fontSize: '0.85rem' }}
              >
                <ThumbsUp size={16} /> Like ({post.reactions?.like || 0})
              </button>
              <button 
                className={`btn btn-outline ${post.hasReacted === 'love' ? 'active' : ''}`}
                onClick={() => handleReact(post.id, 'love')}
                style={{ flexGrow: 1, border: 'none', padding: '6px', borderRadius: '4px', fontSize: '0.85rem' }}
              >
                <Heart size={16} style={{ fill: post.hasReacted === 'love' ? 'var(--danger)' : 'none', color: post.hasReacted === 'love' ? 'var(--danger)' : 'currentColor' }} /> Love ({post.reactions?.love || 0})
              </button>
              <button 
                className={`btn btn-outline ${post.hasReacted === 'support' ? 'active' : ''}`}
                onClick={() => handleReact(post.id, 'support')}
                style={{ flexGrow: 1, border: 'none', padding: '6px', borderRadius: '4px', fontSize: '0.85rem' }}
              >
                <HelpCircle size={16} /> Support ({post.reactions?.support || 0})
              </button>
            </div>

            {/* Comments Thread */}
            <div className="comments-section" style={{ backgroundColor: 'var(--primary-light)', padding: '12px', borderRadius: '8px' }}>
              <h5 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <MessageSquare size={12} /> Discussion ({post.comments?.length || 0})
              </h5>
              
              {post.comments?.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                  {post.comments.map(c => (
                    <div key={c.id} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '0.85rem', backgroundColor: 'var(--bg-card)', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                      <div className="user-avatar" style={{ fontSize: '0.9rem', width: '24px', height: '24px', flexShrink: 0 }}>👤</div>
                      <div style={{ flexGrow: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                          <strong>{c.author}</strong>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatTime(c.time)}</span>
                        </div>
                        <p style={{ color: 'var(--text-main)' }}>{c.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Comment Input */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Write a comment..."
                  value={commentInputs[post.id] || ''}
                  onChange={(e) => setCommentInputs({ ...commentInputs, [post.id]: e.target.value })}
                  style={{ fontSize: '0.85rem', padding: '6px 10px', borderRadius: '4px' }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddComment(post.id);
                  }}
                />
                <button 
                  className="btn btn-primary"
                  onClick={() => handleAddComment(post.id)}
                  style={{ padding: '6px 12px', borderRadius: '4px' }}
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
