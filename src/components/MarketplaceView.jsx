// Copyright (c) 2026 Sanjai. All rights reserved.

import React, { useState, useRef, useEffect } from 'react';
import { ShoppingBag, Heart, MessageSquare, Phone, Plus, Tag, Trash2, Edit } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../utils/supabaseClient';

export default function MarketplaceView({ 
  currentUser, 
  items, 
  setItems, 
  addNotification, 
  startConversation 
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  const [editingItem, setEditingItem] = useState(null);

  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('Produce');
  const [phone, setPhone] = useState(currentUser.phone || '');

  // Media capture and upload states
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

  // Media helper methods
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
      addNotification('Captured', 'Photo captured successfully!', 'success');
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
      console.warn('Supabase storage upload failed, falling back to base64. Error:', error.message);
      return imagePreview;
    }

    const { data: publicUrlData } = supabase.storage
      .from('post-images')
      .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
  };

  const categories = ['All', 'Produce', 'Household', 'Vehicles', 'Tools', 'General'];

  // Helper to validate UUID format
  const isValidUUID = (str) => {
    if (typeof str !== 'string') return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
  };

  const handleCancelForm = () => {
    setShowAddForm(false);
    setEditingItem(null);
    setTitle('');
    setDescription('');
    setPrice('');
    setPhone(currentUser.phone || '');
    setSelectedFile(null);
    setImagePreview(null);
  };

  const handleStartEdit = (item) => {
    setEditingItem(item);
    setTitle(item.title);
    setDescription(item.description || '');
    setPrice(item.price.replace('₹', '').trim());
    setCategory(item.category);
    setPhone(item.seller_phone || item.phone || '');
    setImagePreview(item.image);
    setSelectedFile(null);
    setShowAddForm(true);
  };

  const handleCreateListing = async (e) => {
    e.preventDefault();
    if (!title.trim() || !price || !phone) return;

    setUploading(true);
    let imageUrl = imagePreview;

    try {
      if (selectedFile) {
        if (isSupabaseConfigured) {
          imageUrl = await uploadImageToSupabase(selectedFile);
        } else {
          imageUrl = imagePreview;
        }
      }

      const finalImage = imageUrl || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&auto=format&fit=crop&q=60';
      const isRealUser = isSupabaseConfigured && isValidUUID(currentUser.id);

      if (isSupabaseConfigured) {
        const { error } = await supabase.from('marketplace').insert({
          title,
          description: description || '',
          price: price.toString(),
          category,
          seller_name: currentUser.name,
          seller_phone: phone,
          ...(isRealUser ? { seller_id: currentUser.id } : {}),
          image: finalImage
        });

        if (error) throw error;
      } else {
        // Offline fallback
        const newItem = {
          id: `m_${Date.now()}`,
          title,
          description,
          price: parseFloat(price).toString(),
          category,
          sellerName: currentUser.name,
          sellerId: currentUser.id || 'u1',
          phone,
          image: finalImage,
          wishlisted: false,
          dateAdded: new Date().toISOString().split('T')[0]
        };

        setItems([newItem, ...items]);
      }

      handleCancelForm();
      addNotification('Listing Added', 'Your item is now live in the village marketplace.', 'success');
    } catch (err) {
      console.error(err);
      addNotification('Error', `Failed to publish listing: ${err.message || err}`, 'danger');
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateListing = async (e) => {
    e.preventDefault();
    if (!title.trim() || !price || !phone || !editingItem) return;

    setUploading(true);
    let imageUrl = imagePreview;

    try {
      if (selectedFile) {
        if (isSupabaseConfigured) {
          imageUrl = await uploadImageToSupabase(selectedFile);
        } else {
          imageUrl = imagePreview;
        }
      }

      const isRealDbRow = isSupabaseConfigured && isValidUUID(editingItem.id);

      if (isRealDbRow) {
        const { error } = await supabase
          .from('marketplace')
          .update({
            title,
            description: description || '',
            price: price.toString(),
            category,
            seller_phone: phone,
            image: imageUrl
          })
          .eq('id', editingItem.id);

        if (error) throw error;
      }

      // Always update local state
      setItems(items.map(item => {
        if (item.id !== editingItem.id) return item;
        return {
          ...item,
          title,
          description,
          price: price.toString(),
          category,
          phone: phone,
          seller_phone: phone,
          image: imageUrl
        };
      }));

      handleCancelForm();
      addNotification('Listing Updated', 'Your item listing has been updated.', 'success');
    } catch (err) {
      console.error(err);
      addNotification('Error', `Failed to update listing: ${err.message || err}`, 'danger');
    } finally {
      setUploading(false);
    }
  };

  const toggleWishlist = (itemId) => {
    setItems(items.map(item => {
      if (item.id !== itemId) return item;
      const nextState = !item.wishlisted;
      addNotification(
        nextState ? 'Added to Wishlist' : 'Removed from Wishlist', 
        `"${item.title}" updated.`, 
        'info'
      );
      return { ...item, wishlisted: nextState };
    }));
  };

  const handleContactSeller = (sellerId, sellerName) => {
    if (sellerId === currentUser.id) {
      addNotification('Error', 'You cannot chat with yourself.', 'danger');
      return;
    }
    startConversation(sellerId, sellerName);
  };

  const handleDeleteListing = async (itemId) => {
    const isRealDbRow = isSupabaseConfigured && isValidUUID(itemId);

    if (isRealDbRow) {
      try {
        const { error } = await supabase.from('marketplace').delete().eq('id', itemId);
        if (error) throw error;
      } catch (err) {
        console.error(err);
        addNotification('Error', `Failed to delete listing: ${err.message || err}`, 'danger');
        return;
      }
    }

    setItems(items.filter(item => item.id !== itemId));
    addNotification('Deleted', 'Marketplace listing removed.', 'warning');
  };

  const filteredItems = activeCategory === 'All' 
    ? items 
    : items.filter(item => item.category === activeCategory);

  return (
    <div className="marketplace-container">
      {/* Header */}
      <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', width: '100%' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem', fontWeight: 700 }}>Village Marketplace</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Buy and sell homegrown fresh produce, handicrafts, tools, and vehicles within our community.</p>
        </div>
        {!showAddForm && (
          <button className="btn btn-accent" onClick={() => setShowAddForm(true)}>
            <Plus size={16} /> List an Item
          </button>
        )}
      </div>

      {/* Add Listing Form */}
      {showAddForm && (
        <div className="card" style={{ animation: 'slideIn 0.2s ease' }}>
          <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>
              {editingItem ? 'Edit Sale Listing' : 'Create Sale Listing'}
            </h3>
            <button className="role-btn" onClick={handleCancelForm}>Cancel</button>
          </div>
          <form onSubmit={editingItem ? handleUpdateListing : handleCreateListing}>
            <div className="grid-3">
              <div className="form-group">
                <label className="form-label">Item Title</label>
                <input type="text" className="form-input" placeholder="e.g. Fresh Mangoes (1 box)" value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Price (INR or per unit)</label>
                <input type="text" className="form-input" placeholder="e.g. 120 or 50/kg" value={price} onChange={(e) => setPrice(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                  {categories.slice(1).map(cat => (
                    <option key={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Item Description</label>
              <textarea className="form-input" rows={2} placeholder="Describe quality, size, delivery options, etc..." value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Contact Phone</label>
                <input type="text" className="form-input" value={phone} onChange={(e) => setPhone(e.target.value)} required />
              </div>
            </div>

            <div className="form-group" style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', marginTop: '12px', marginBottom: '16px' }}>
              <label className="form-label">Item Photo (Select or Capture)</label>
              
              {/* File picker & camera controls */}
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

              {/* Preview Container */}
              {imagePreview && (
                <div style={{ position: 'relative', marginTop: '12px', borderRadius: '8px', overflow: 'hidden', maxHeight: '160px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-light)' }}>
                  <img src={imagePreview} alt="Item Preview" style={{ width: '100%', height: '140px', objectFit: 'contain' }} />
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
              {uploading ? 'Uploading & Saving...' : (editingItem ? 'Save Changes' : 'Publish Listing')}
            </button>
          </form>
        </div>
      )}

      {/* Category Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '8px' }}>
        {categories.map(cat => (
          <button
            key={cat}
            className={`role-btn ${activeCategory === cat ? 'active' : ''}`}
            onClick={() => setActiveCategory(cat)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Tag size={12} /> {cat}
          </button>
        ))}
      </div>

      {/* Marketplace Grid */}
      <div className="grid-3">
        {filteredItems.length === 0 ? (
          <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px' }}>
            <ShoppingBag size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
            <h4 style={{ fontWeight: 600 }}>No Listings Found</h4>
            <p style={{ color: 'var(--text-muted)' }}>There are no items listed under "{activeCategory}" category currently.</p>
          </div>
        ) : (
          filteredItems.map(item => {
            const sellerName = item.seller_name || item.sellerName || 'Resident';
            const sellerId = item.seller_id || item.sellerId || 'u1';
            const sellerPhone = item.seller_phone || item.phone || '';
            const dateAdded = item.date ? new Date(item.date).toLocaleDateString() : item.dateAdded || '';

            return (
              <div key={item.id} className="card" style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
                <div style={{ height: '180px', overflow: 'hidden', position: 'relative', backgroundColor: 'var(--bg-light)' }}>
                  <img src={item.image} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  
                  {/* Actions overlay */}
                  <div style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', gap: '6px' }}>
                    {(sellerId === currentUser.id || sellerName === currentUser.name || currentUser.role === 'admin') && (
                      <>
                        <button
                          onClick={() => handleStartEdit(item)}
                          style={{
                            backgroundColor: 'rgba(255, 255, 255, 0.9)',
                            border: 'none',
                            borderRadius: '50%',
                            width: '32px',
                            height: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            boxShadow: 'var(--shadow-sm)',
                            color: 'var(--primary)'
                          }}
                          title="Edit Listing"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteListing(item.id)}
                          style={{
                            backgroundColor: 'rgba(255, 255, 255, 0.9)',
                            border: 'none',
                            borderRadius: '50%',
                            width: '32px',
                            height: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            boxShadow: 'var(--shadow-sm)',
                            color: 'var(--danger)'
                          }}
                          title="Delete Listing"
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => toggleWishlist(item.id)}
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        border: 'none',
                        borderRadius: '50%',
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        boxShadow: 'var(--shadow-sm)',
                        color: item.wishlisted ? 'var(--danger)' : 'var(--text-muted)',
                        transition: 'var(--transition)'
                      }}
                    >
                      <Heart size={18} fill={item.wishlisted ? 'var(--danger)' : 'none'} />
                    </button>
                  </div>

                  <div style={{ position: 'absolute', bottom: '12px', left: '12px', backgroundColor: 'rgba(42, 157, 143, 0.95)', color: '#fff', padding: '4px 10px', borderRadius: '4px', fontSize: '0.9rem', fontWeight: 700 }}>
                    {item.price.startsWith('₹') ? item.price : `₹ ${item.price}`}
                  </div>
                </div>

                <div style={{ padding: '16px', flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--info)', textTransform: 'uppercase' }}>{item.category}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{dateAdded}</span>
                    </div>
                    <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 600, marginBottom: '6px' }}>{item.title}</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '12px' }}>{item.description}</p>
                  </div>

                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Seller: <strong>{sellerName}</strong> {sellerId === currentUser.id && ' (You)'}
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        className="btn btn-primary"
                        onClick={() => handleContactSeller(sellerId, sellerName)}
                        style={{ flexGrow: 1, padding: '6px 12px', fontSize: '0.8rem', display: 'flex', justifyContent: 'center', gap: '6px' }}
                      >
                        <MessageSquare size={14} /> Contact Seller
                      </button>
                      {sellerPhone && (
                        <a 
                          href={`tel:${sellerPhone}`} 
                          className="btn btn-outline"
                          style={{ padding: '6px 12px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                          title="Call Seller"
                        >
                          <Phone size={14} />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

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
