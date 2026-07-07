import React, { useState, useRef, useEffect } from 'react';
import { AlertCircle, Clock, CheckCircle2, Star, MapPin, Camera, AlertTriangle, ShieldCheck, ChevronRight, X } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../utils/supabaseClient';

export default function ComplaintsPortal({ 
  currentUser, 
  complaints, 
  setComplaints, 
  addNotification 
}) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Water Supply');
  const [customCategory, setCustomCategory] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('Normal');
  const [photo, setPhoto] = useState('');
  const [gps, setGps] = useState('12.9241° N, 79.1256° E'); // Default mock location

  const [mapSearchText, setMapSearchText] = useState('');
  const [mapType, setMapType] = useState('hybrid'); // Default to hybrid satellite view for precision

  // Media capture and upload states
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [videoStream, setVideoStream] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [showMapSelector, setShowMapSelector] = useState(false);

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

  // Resolution Form (For Officer/Admin)
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [resolutionPhoto, setResolutionPhoto] = useState('');

  // Resolution upload states
  const [resFile, setResFile] = useState(null);
  const [resPreview, setResPreview] = useState(null);
  const [resRawSrc, setResRawSrc] = useState(null);
  const [resUploading, setResUploading] = useState(false);
  const [resShowCameraModal, setResShowCameraModal] = useState(false);
  const resFileInputRef = useRef(null);
  const resVideoRef = useRef(null);
  const [resVideoStream, setResVideoStream] = useState(null);
  const [resCameraError, setResCameraError] = useState(null);

  // Resolution Cropper states
  const [resCropBox, setResCropBox] = useState({ x: 10, y: 10, w: 80, h: 45 });
  const [resIsDragging, setResIsDragging] = useState(false);
  const [resDragStart, setResDragStart] = useState({ x: 0, y: 0, boxX: 0, boxY: 0 });

  // Bind resolution camera stream
  useEffect(() => {
    if (resShowCameraModal && resVideoRef.current && resVideoStream) {
      resVideoRef.current.srcObject = resVideoStream;
    }
  }, [resShowCameraModal, resVideoStream]);

  // Cleanup resolution stream
  useEffect(() => {
    return () => {
      if (resVideoStream) {
        resVideoStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [resVideoStream]);

  // Auto-fill GPS mock toggle
  const generateMockGPS = () => {
    const lat = (12.92 + Math.random() * 0.01).toFixed(4);
    const lng = (79.12 + Math.random() * 0.01).toFixed(4);
    setGps(`${lat}° N, ${lng}° E`);
  };

  const getRealLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setGps(`${lat.toFixed(6)}° N, ${lng.toFixed(6)}° E`);
          addNotification('Location Found', 'Successfully retrieved your current coordinates!', 'success');
        },
        (error) => {
          console.error(error);
          addNotification('Location Error', 'Could not retrieve device location. You can type it manually.', 'warning');
        }
      );
    } else {
      addNotification('Error', 'Geolocation is not supported by your browser.', 'danger');
    }
  };

  const initMap = () => {
    const runInit = () => {
      setTimeout(() => {
        const mapContainer = document.getElementById('complaint-map');
        if (!mapContainer) {
          console.warn('Map container element not found in DOM.');
          return;
        }

        // If a map instance already exists, remove it first
        if (window.complaintMapInstance) {
          try {
            window.complaintMapInstance.remove();
          } catch (e) {
            console.warn('Map cleanup warning:', e);
          }
        }

        // Default: Dharapuram area (around 10.7300, 77.5200)
        let initialLat = 10.7300;
        let initialLng = 77.5200;

        // Try parsing current GPS coordinates state
        const coordsMatch = gps.match(/(-?\d+\.\d+)/g);
        if (coordsMatch && coordsMatch.length >= 2) {
          initialLat = parseFloat(coordsMatch[0]);
          initialLng = parseFloat(coordsMatch[1]);
        }

        const map = window.L.map('complaint-map', {
          zoomControl: true
        }).setView([initialLat, initialLng], 14);
        window.complaintMapInstance = map;

        // Invalidate map size to force Leaflet to recalculate container bounds
        setTimeout(() => {
          try {
            map.invalidateSize();
          } catch (e) {
            console.warn('Map invalidateSize warning:', e);
          }
        }, 200);

        // Google Roadmap vs Satellite Hybrid
        const activeTileUrl = mapType === 'hybrid'
          ? 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
          : 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';

        // Add Google Maps Roadmap Tile Layer directly
        const tileLayer = window.L.tileLayer(activeTileUrl, {
          maxZoom: 20,
          attribution: 'Map data &copy; Google Maps'
        }).addTo(map);
        window.complaintTileLayer = tileLayer;

        // Define default marker icon explicitly to prevent CDN 404 relative assets path error
        const defaultIcon = window.L.icon({
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41]
        });

        // Add default marker
        let marker = window.L.marker([initialLat, initialLng], { 
          draggable: true,
          icon: defaultIcon
        }).addTo(map);
        window.complaintMarkerInstance = marker;

        const updateCoordinates = (lat, lng) => {
          setGps(`${lat.toFixed(6)}° N, ${lng.toFixed(6)}° E`);
        };

        // When map is clicked
        map.on('click', (e) => {
          const { lat, lng } = e.latlng;
          marker.setLatLng([lat, lng]);
          updateCoordinates(lat, lng);
        });

        // When marker is dragged
        marker.on('dragend', () => {
          const { lat, lng } = marker.getLatLng();
          updateCoordinates(lat, lng);
        });
      }, 200);
    };

    if (window.L) {
      runInit();
    } else {
      console.log('Leaflet not loaded on window yet. Injecting fallback CDN.');
      // Fallback load script & css directly
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css';
      document.head.appendChild(link);

      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js';
      script.onload = () => {
        runInit();
      };
      document.head.appendChild(script);
    }
  };

  // Center on current device GPS position
  const centerMapOnDeviceGPS = () => {
    if (navigator.geolocation) {
      addNotification('Locating...', 'Retrieving your precise device coordinates...', 'info');
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          
          setGps(`${lat.toFixed(6)}° N, ${lng.toFixed(6)}° E`);
          addNotification('Position Locked', 'Map centered and pinned to your current location!', 'success');

          if (window.complaintMapInstance) {
            window.complaintMapInstance.setView([lat, lng], 18); // Zoom in close for satellite accuracy!
            if (window.complaintMarkerInstance) {
              window.complaintMarkerInstance.setLatLng([lat, lng]);
            }
          }
        },
        (error) => {
          console.error(error);
          addNotification('Location Failed', 'Could not retrieve precise coordinates. Please drag/search instead.', 'danger');
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 } // Request high accuracy GPS sensor rather than cached network IP!
      );
    } else {
      addNotification('Error', 'Geolocation is not supported by your browser.', 'danger');
    }
  };

  // Sync map layer swap dynamically
  useEffect(() => {
    if (window.complaintMapInstance && window.complaintTileLayer) {
      const activeTileUrl = mapType === 'hybrid'
        ? 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
        : 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
      window.complaintTileLayer.setUrl(activeTileUrl);
    }
  }, [mapType]);

  const handleMapSearch = async () => {
    if (!mapSearchText.trim()) return;
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(mapSearchText)}`);
      const data = await response.json();
      if (data && data.length > 0) {
        const { lat, lon, display_name } = data[0];
        const newLat = parseFloat(lat);
        const newLng = parseFloat(lon);
        
        setGps(`${newLat.toFixed(6)}° N, ${newLng.toFixed(6)}° E`);
        addNotification('Location Found', `Centered map to: ${display_name}`, 'success');
        
        if (window.complaintMapInstance) {
          window.complaintMapInstance.setView([newLat, newLng], 15);
          // Re-initialize map pin at new center
          initMap();
        }
      } else {
        addNotification('Not Found', 'Location could not be found on map.', 'warning');
      }
    } catch (err) {
      console.error(err);
      addNotification('Error', 'Map search service is currently unavailable.', 'danger');
    }
  };

  // Re-run map initialization when showMapSelector becomes true
  useEffect(() => {
    if (showMapSelector) {
      initMap();
    }
  }, [showMapSelector]);

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

  // Resolution photo helpers
  const handleResFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setResRawSrc(reader.result);
      setResCropBox({ x: 10, y: 10, w: 80, h: 45 });
    };
    reader.readAsDataURL(file);
  };

  const handleResRemoveImage = () => {
    setResFile(null);
    setResPreview(null);
    setResRawSrc(null);
    if (resFileInputRef.current) resFileInputRef.current.value = '';
  };

  const handleResOpenCamera = async () => {
    setResShowCameraModal(true);
    setResCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      setResVideoStream(stream);
    } catch (err) {
      console.error('Camera access error:', err);
      setResCameraError('Could not access camera. Please check permissions.');
    }
  };

  const handleResCloseCamera = () => {
    if (resVideoStream) {
      resVideoStream.getTracks().forEach(track => track.stop());
      setResVideoStream(null);
    }
    setResShowCameraModal(false);
  };

  const handleResCapturePhoto = () => {
    if (!resVideoRef.current) return;

    try {
      const video = resVideoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const dataUrl = canvas.toDataURL('image/jpeg');
      setResRawSrc(dataUrl);
      setResCropBox({ x: 10, y: 10, w: 80, h: 45 });

      handleResCloseCamera();
      addNotification('Captured', 'Photo captured, please crop and apply.', 'success');
    } catch (err) {
      console.error('Capture error:', err);
      addNotification('Error', 'Failed to capture photo.', 'danger');
    }
  };

  // Dragging event handlers for resolution crop box
  const handleResBoxMouseDown = (e) => {
    e.preventDefault();
    setResIsDragging(true);
    setResDragStart({
      x: e.clientX,
      y: e.clientY,
      boxX: resCropBox.x,
      boxY: resCropBox.y
    });
  };

  const handleResContainerMouseMove = (e) => {
    if (!resIsDragging) return;
    const container = e.currentTarget.getBoundingClientRect();
    
    const deltaXPercent = ((e.clientX - resDragStart.x) / container.width) * 100;
    const deltaYPercent = ((e.clientY - resDragStart.y) / container.height) * 100;
    
    setResCropBox(prev => {
      const newX = Math.max(0, Math.min(100 - prev.w, resDragStart.boxX + deltaXPercent));
      const newY = Math.max(0, Math.min(100 - prev.h, resDragStart.boxY + deltaYPercent));
      return { ...prev, x: newX, y: newY };
    });
  };

  const handleResBoxTouchStart = (e) => {
    const touch = e.touches[0];
    setResIsDragging(true);
    setResDragStart({
      x: touch.clientX,
      y: touch.clientY,
      boxX: resCropBox.x,
      boxY: resCropBox.y
    });
  };

  const handleResContainerTouchMove = (e) => {
    if (!resIsDragging) return;
    const touch = e.touches[0];
    const container = e.currentTarget.getBoundingClientRect();
    
    const deltaXPercent = ((touch.clientX - resDragStart.x) / container.width) * 100;
    const deltaYPercent = ((touch.clientY - resDragStart.y) / container.height) * 100;
    
    setResCropBox(prev => {
      const newX = Math.max(0, Math.min(100 - prev.w, resDragStart.boxX + deltaXPercent));
      const newY = Math.max(0, Math.min(100 - prev.h, resDragStart.boxY + deltaYPercent));
      return { ...prev, x: newX, y: newY };
    });
  };

  const handleResMouseUp = () => {
    setResIsDragging(false);
  };

  const handleResApplyCrop = () => {
    if (!resRawSrc) return;

    const img = new Image();
    img.src = resRawSrc;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 450; // standard 16:9 banner
      const ctx = canvas.getContext('2d');

      const srcX = (resCropBox.x / 100) * img.width;
      const srcY = (resCropBox.y / 100) * img.height;
      const srcWidth = (resCropBox.w / 100) * img.width;
      const srcHeight = (resCropBox.h / 100) * img.height;

      ctx.drawImage(img, srcX, srcY, srcWidth, srcHeight, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      setResPreview(dataUrl);
      
      fetch(dataUrl)
        .then(res => res.blob())
        .then(blob => {
          const file = new File([blob], `resolution_${Date.now()}.jpg`, { type: 'image/jpeg' });
          setResFile(file);
          setResRawSrc(null); // Close crop editor
          addNotification('Cropped', 'Resolution proof photo cropped successfully!', 'success');
        });
    };
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
          const file = new File([blob], `cropped_complaint_${Date.now()}.jpg`, { type: 'image/jpeg' });
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

  const handleCreateComplaint = async (e) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

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

      // SLA values in hours based on category
      const slaHoursMap = {
        'Water Supply': 24,
        'Power Supply': 12,
        'Roads & Streets': 72,
        'Sanitation': 48,
        'Health': 24
      };

      const finalCategory = category === 'Other' ? (customCategory || 'Other') : category;
      const slaHours = category === 'Other' ? 48 : (slaHoursMap[category] || 48);

      const initialTimeline = [
        { status: 'Submitted', time: new Date().toISOString(), note: `Complaint registered by ${currentUser.name}.` }
      ];

      if (isSupabaseConfigured) {
        // Try inserting with 'photo' column first
        const insertData = {
          category: finalCategory,
          title,
          description,
          location: gps,
          complainant_name: currentUser.name,
          complainant_phone: currentUser.phone || '',
          status: 'Submitted',
          votes: 0,
          updates: initialTimeline,
          photo: imageUrl
        };

        const { error } = await supabase.from('complaints').insert(insertData);

        if (error) {
          console.warn('Standard insert failed, trying description attachment fallback. Error:', error.message);
          // Fallback if 'photo' column does not exist
          const fallbackInsertData = {
            category: finalCategory,
            title,
            description: imageUrl ? `${description}\n\n[Attachment](${imageUrl})` : description,
            location: gps,
            complainant_name: currentUser.name,
            complainant_phone: currentUser.phone || '',
            status: 'Submitted',
            votes: 0,
            updates: initialTimeline
          };
          const { error: fallbackError } = await supabase.from('complaints').insert(fallbackInsertData);
          if (fallbackError) throw fallbackError;
        }
      } else {
        // Offline fallback
        const newComplaint = {
          id: `comp_${Date.now()}`,
          category: finalCategory,
          title,
          description,
          photo: imageUrl || null,
          status: 'Submitted',
          priority,
          gps,
          reporter: currentUser.name,
          reporterId: currentUser.id || 'u1',
          assignedTo: 'Subhash Chandra', 
          slaHours: slaHours,
          createdAt: new Date().toISOString(),
          timeline: initialTimeline,
          resolutionPhoto: null,
          resolutionNote: '',
          rating: null
        };

        setComplaints([newComplaint, ...complaints]);
      }

      setTitle('');
      setDescription('');
      setCustomCategory('');
      setPhoto('');
      setSelectedFile(null);
      setImagePreview(null);
      setShowForm(false);
      addNotification('Success', 'Complaint registered successfully! The Panchayat team has been alerted.', 'success');
    } catch (err) {
      console.error(err);
      addNotification('Error', 'Failed to submit complaint.', 'danger');
    } finally {
      setUploading(false);
    }
  };

  // Helper to validate UUID format
  const isValidUUID = (str) => {
    if (typeof str !== 'string') return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
  };

  // Status transitions: Submitted -> Acknowledged -> In Progress -> Resolved -> Closed
  const handleUpdateStatus = async (complaintId, nextStatus) => {
    const complaint = complaints.find(c => c.id === complaintId);
    if (!complaint) return;

    setResUploading(true);
    let finalResPhoto = resolutionPhoto;

    try {
      // If resolving and has a cropped resolution file proof, upload it
      if (resFile && nextStatus === 'Resolved') {
        if (isSupabaseConfigured) {
          finalResPhoto = await uploadImageToSupabase(resFile);
        } else {
          finalResPhoto = resPreview;
        }
      }

      const timelineValue = complaint.updates || complaint.timeline || [];

      const newTimeline = [...timelineValue, {
        status: nextStatus,
        time: new Date().toISOString(),
        note: nextStatus === 'Resolved'
          ? `Resolved by Panchayat Team. Reason: ${resolutionNote || 'Work completed.'}`
          : nextStatus === 'Acknowledged' 
          ? `BDO Subhash Chandra acknowledged and verified this complaint.`
          : nextStatus === 'In Progress'
          ? `Work order initiated. Ground inspection underway.`
          : `Closed by resident. Resolution confirmed.`,
        ...(nextStatus === 'Resolved' ? {
          resolutionNote: resolutionNote,
          resolutionPhoto: finalResPhoto || 'https://images.unsplash.com/photo-1599740831119-97307add208e?w=600'
        } : {})
      }];

      const isRealDbRow = isSupabaseConfigured && isValidUUID(complaintId);

      if (isRealDbRow) {
        const { error } = await supabase
          .from('complaints')
          .update({
            status: nextStatus,
            updates: newTimeline
          })
          .eq('id', complaintId);

        if (error) {
          throw new Error(`Database error: ${error.message}`);
        }
      }

      // Always update local React state for instantaneous UI sync
      setComplaints(prev => prev.map(c => {
        if (c.id !== complaintId) return c;
        return {
          ...c,
          status: nextStatus,
          timeline: newTimeline,
          updates: newTimeline,
          resolutionNote: nextStatus === 'Resolved' ? resolutionNote : c.resolutionNote,
          resolutionPhoto: nextStatus === 'Resolved' ? (finalResPhoto || 'https://images.unsplash.com/photo-1599740831119-97307add208e?w=600') : c.resolutionPhoto
        };
      }));

      setSelectedComplaint(null);
      setResolutionNote('');
      setResolutionPhoto('');
      setResFile(null);
      setResPreview(null);
      setResRawSrc(null);
      addNotification('Updated', `Complaint status updated to ${nextStatus}`, 'info');
    } catch (err) {
      console.error(err);
      addNotification('Error', `Failed to update status. ${err.message || err}`, 'danger');
    } finally {
      setResUploading(false);
    }
  };

  const handleRateComplaint = async (complaintId, ratingValue) => {
    const complaint = complaints.find(c => c.id === complaintId);
    if (!complaint) return;

    const timelineValue = complaint.updates || complaint.timeline || [];

    const closedTimeline = [...timelineValue, {
      status: 'Closed',
      time: new Date().toISOString(),
      note: `Closed. Feedback rating of ${ratingValue}/5 stars given by resident.`,
      rating: ratingValue
    }];

    const isRealDbRow = isSupabaseConfigured && isValidUUID(complaintId);

    if (isRealDbRow) {
      try {
        const { error } = await supabase
          .from('complaints')
          .update({
            status: 'Closed',
            updates: closedTimeline
          })
          .eq('id', complaintId);

        if (error) {
          throw new Error(`Database error: ${error.message}`);
        }
      } catch (err) {
        console.error('Supabase update failed:', err);
        addNotification('Error', `Failed to update status in database. ${err.message}`, 'danger');
        return;
      }
    }

    // Always update local React state for instantaneous UI sync
    setComplaints(prev => prev.map(c => {
      if (c.id !== complaintId) return c;
      return {
        ...c,
        rating: ratingValue,
        status: 'Closed',
        timeline: closedTimeline,
        updates: closedTimeline
      };
    }));

    addNotification('Closed', 'Thank you for your feedback! Complaint closed.', 'success');
  };

  // Helper: calculate remaining SLA time
  const getSLARemaining = (complaint) => {
    const createdAtValue = complaint.date || complaint.createdAt || new Date().toISOString();
    const createdTime = new Date(createdAtValue).getTime();
    const slaHoursValue = complaint.slaHours || 48;
    const expiryTime = createdTime + (slaHoursValue * 60 * 60 * 1000);
    const now = new Date().getTime();
    const diff = expiryTime - now;

    if (complaint.status === 'Resolved' || complaint.status === 'Closed') {
      return { text: 'Resolved', state: 'resolved' };
    }

    if (diff < 0) {
      return { text: `Breached! (Escalated to President)`, state: 'breached' };
    }

    const hoursLeft = Math.ceil(diff / (1000 * 60 * 60));
    return { text: `${hoursLeft} hours remaining`, state: 'ok' };
  };

  return (
    <div className="complaints-container">
      {/* Action Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem', fontWeight: 700 }}>Civic Complaints</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>File village grievances, track resolution pipelines, and review SLAs.</p>
        </div>
        {!showForm && currentUser.role === 'resident' && (
          <button className="btn btn-accent" onClick={() => setShowForm(true)}>
            File a Complaint
          </button>
        )}
      </div>

      {/* New Complaint Form */}
      {showForm && (
         <div className="card" style={{ animation: 'slideIn 0.2s ease' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>Submit New Grievance</h3>
            <button className="role-btn" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
          <form onSubmit={handleCreateComplaint}>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Issue Title</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Water pump leakage in East Lane" 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)} 
                  required 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option>Water Supply</option>
                  <option>Power Supply</option>
                  <option>Roads & Streets</option>
                  <option>Sanitation</option>
                  <option>Health</option>
                  <option>Other</option>
                </select>
              </div>
            </div>

            {category === 'Other' && (
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Custom Category</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Street Lights, Public Repairs, Stray Dogs" 
                  value={customCategory} 
                  onChange={(e) => setCustomCategory(e.target.value)} 
                  required 
                />
              </div>
            )}

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Location / GPS Coordinates</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="button" onClick={getRealLocation} style={{ background: 'none', border: 'none', color: 'var(--info)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                      🛰️ Get GPS
                    </button>
                    <button type="button" onClick={() => setShowMapSelector(!showMapSelector)} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                      🗺️ Select on Map
                    </button>
                  </div>
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={gps} 
                    onChange={(e) => setGps(e.target.value)} 
                    placeholder="Enter street, landmark or GPS coordinates" 
                    required 
                  />
                  <span style={{ display: 'flex', alignItems: 'center', color: 'var(--info)' }}><MapPin size={20} /></span>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Priority</label>
                <select className="form-select" value={priority} onChange={(e) => setPriority(e.target.value)}>
                  <option>Normal</option>
                  <option>High</option>
                </select>
              </div>
            </div>

            {/* Google Map Selector Panel */}
            {showMapSelector && (
              <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', backgroundColor: 'var(--bg-light)', marginBottom: '16px' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'var(--primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>🗺️ Select Location on Google Map</span>
                  <button type="button" onClick={() => setShowMapSelector(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
                </h4>
                
                {/* Map Search input and Locator controls */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Search street, town or landmark..."
                    value={mapSearchText}
                    onChange={(e) => setMapSearchText(e.target.value)}
                    style={{ fontSize: '0.8rem', padding: '6px 10px', flex: 1, minWidth: '150px' }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleMapSearch();
                      }
                    }}
                  />
                  <button type="button" className="btn btn-primary" onClick={handleMapSearch} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                    Search
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-outline" 
                    onClick={centerMapOnDeviceGPS} 
                    style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', borderColor: 'var(--success)', color: 'var(--success)' }}
                  >
                    🎯 Get My Location
                  </button>
                </div>

                {/* Map Mode Layer Selector */}
                <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                  <button
                    type="button"
                    className={`badge ${mapType === 'hybrid' ? 'urgent' : 'normal'}`}
                    onClick={() => setMapType('hybrid')}
                    style={{ cursor: 'pointer', border: 'none', padding: '4px 10px' }}
                  >
                    🛰️ Satellite View (Hybrid)
                  </button>
                  <button
                    type="button"
                    className={`badge ${mapType === 'roadmap' ? 'urgent' : 'normal'}`}
                    onClick={() => setMapType('roadmap')}
                    style={{ cursor: 'pointer', border: 'none', padding: '4px 10px' }}
                  >
                    🗺️ Road Map View
                  </button>
                </div>

                <div 
                  id="complaint-map" 
                  style={{ 
                    width: '100%', 
                    height: '320px', 
                    borderRadius: '6px', 
                    border: '1px solid var(--border)',
                    boxSizing: 'border-box'
                  }} 
                />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                  💡 Zoom in closely to find a specific building/farm. Click to drop pin or drag the pin.
                </p>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea 
                className="form-input" 
                rows={3} 
                placeholder="Give details about the issue (e.g. leaking joint, water logged, dangerous wires, etc.)" 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            {/* Attachment options (Select file / Camera) for Complaint Photo */}
            <div className="form-group" style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', marginTop: '4px' }}>
              <label className="form-label">Attach Photo of the Issue (Optional)</label>
              
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
              {uploading ? 'Uploading & Registering...' : 'Register Grievance'}
            </button>
          </form>
        </div>
      )}

      {/* Resolution Update modal overlay */}
      {selectedComplaint && (
        <div className="card" style={{ border: '2px solid var(--info)', padding: '20px', backgroundColor: 'var(--primary-light)', marginBottom: '20px' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, marginBottom: '12px' }}>
            Update Resolution: {selectedComplaint.title}
          </h3>
          <div className="form-group">
            <label className="form-label">Resolution Work Notes</label>
            <textarea 
              className="form-input" 
              rows={2} 
              placeholder="e.g. Dispatched local plumbers. Leaky junction joint welded and tightened." 
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              required
            />
          </div>

          {/* Resolution Photo Attachment Section (File Selector / Camera with Crop) */}
          <div className="form-group" style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', marginTop: '12px', marginBottom: '12px' }}>
            <label className="form-label">Attach Proof Photo of Resolution (Optional)</label>

            {/* Resolution Cropper Editor */}
            {resRawSrc ? (
              <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', backgroundColor: 'var(--bg-light)', marginBottom: '12px' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'var(--primary)' }}>Drag crop frame to position & adjust size</h4>
                
                <div 
                  onMouseMove={handleResContainerMouseMove}
                  onTouchMove={handleResContainerTouchMove}
                  onMouseUp={handleResMouseUp}
                  onTouchEnd={handleResMouseUp}
                  onMouseLeave={handleResMouseUp}
                  style={{ 
                    width: '100%', 
                    position: 'relative', 
                    overflow: 'hidden', 
                    backgroundColor: '#222', 
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    cursor: resIsDragging ? 'move' : 'default',
                    userSelect: 'none'
                  }}
                >
                  <img 
                    src={resRawSrc} 
                    alt="Resolution Crop Raw" 
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
                    onMouseDown={handleResBoxMouseDown}
                    onTouchStart={handleResBoxTouchStart}
                    style={{
                      position: 'absolute',
                      left: `${resCropBox.x}%`,
                      top: `${resCropBox.y}%`,
                      width: `${resCropBox.w}%`,
                      height: `${resCropBox.h}%`,
                      border: '2px solid #fff',
                      boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)',
                      cursor: 'move',
                      zIndex: 10,
                      boxSizing: 'border-box'
                    }}
                  >
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
                    type="range" min="20" max="100" value={resCropBox.w} 
                    onChange={(e) => {
                      const newW = parseFloat(e.target.value);
                      const newH = newW * (9 / 16);
                      setResCropBox(prev => {
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
                    type="button" className="btn btn-primary" onClick={handleResApplyCrop}
                    style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                  >
                    ✂️ Crop & Apply
                  </button>
                  <button 
                    type="button" className="btn btn-outline" onClick={() => setResRawSrc(null)}
                    style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            {/* Selector Buttons */}
            {!resRawSrc && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="file"
                  accept="image/*"
                  ref={resFileInputRef}
                  onChange={handleResFileChange}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => resFileInputRef.current?.click()}
                  style={{ fontSize: '0.8rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  📁 Select Photo
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleResOpenCamera}
                  style={{ fontSize: '0.8rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  📸 Open Camera
                </button>
                
                {resPreview && (
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={handleResRemoveImage}
                    style={{ fontSize: '0.8rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}
                  >
                    Remove Photo
                  </button>
                )}
              </div>
            )}

            {/* Resolution Photo Preview Container */}
            {resPreview && !resRawSrc && (
              <div style={{ position: 'relative', marginTop: '12px', borderRadius: '8px', overflow: 'hidden', maxHeight: '160px', border: '1px solid var(--border)' }}>
                <img src={resPreview} alt="Resolution Preview" style={{ width: '100%', height: '140px', objectFit: 'cover' }} />
                <button
                  type="button"
                  onClick={handleResRemoveImage}
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

          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-primary" onClick={() => handleUpdateStatus(selectedComplaint.id, 'Resolved')} disabled={resUploading}>
              {resUploading ? 'Saving...' : 'Mark as Resolved'}
            </button>
            <button className="btn btn-outline" onClick={() => setSelectedComplaint(null)} disabled={resUploading}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Complaints List */}
      <div className="complaints-list">
        {complaints.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
            <AlertCircle size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
            <h4 style={{ fontWeight: 600 }}>No Complaints Filed</h4>
            <p style={{ color: 'var(--text-muted)' }}>The community is currently running smoothly with no active complaints reported.</p>
          </div>
        ) : (
          complaints.map(comp => {
            const sla = getSLARemaining(comp);
            const isEscalated = sla.state === 'breached';
            const locationValue = comp.location || comp.gps || 'N/A';
            const reporterValue = comp.complainant_name || comp.reporter || 'Resident';
            const createdAtValue = comp.date || comp.createdAt || new Date().toISOString();
            const timelineValue = comp.updates || comp.timeline || [];

            let displayDescription = comp.description || '';
            let attachedImage = comp.photo;

            if (displayDescription.includes('\n\n[Attachment](')) {
              const parts = displayDescription.split('\n\n[Attachment](');
              displayDescription = parts[0];
              attachedImage = parts[1].replace(')', '');
            }

            // Find resolved step in updates timeline
            const resolvedStep = timelineValue.find(t => t.status === 'Resolved');
            const resolutionNoteVal = comp.resolutionNote || (resolvedStep ? resolvedStep.resolutionNote : '');
            const resolutionPhotoVal = comp.resolutionPhoto || (resolvedStep ? resolvedStep.resolutionPhoto : '');

            // Find closed step in updates timeline
            const closedStep = timelineValue.find(t => t.status === 'Closed');
            const ratingVal = comp.rating || (closedStep ? closedStep.rating : null);

            return (
              <div key={comp.id} className="card" style={{ borderLeft: `5px solid ${
                comp.status === 'Resolved' || comp.status === 'Closed'
                  ? 'var(--success)'
                  : isEscalated
                  ? 'var(--danger)'
                  : 'var(--primary)'
              }` }}>
                {/* Header status info */}
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span className="badge normal">{comp.category}</span>
                    <span className={`badge ${comp.status.toLowerCase().replace(' ', '')}`}>{comp.status}</span>
                    {comp.priority === 'High' && <span className="badge urgent">High Priority</span>}
                  </div>
                  
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.8rem' }}>
                    <Clock size={14} />
                    <span style={{
                      fontWeight: 600,
                      color: sla.state === 'breached' ? 'var(--danger)' : sla.state === 'resolved' ? 'var(--success)' : 'var(--text-muted)'
                    }}>
                      {sla.text}
                    </span>
                  </div>
                </div>

                {/* Complaint Info */}
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: 600, marginBottom: '8px' }}>
                  {comp.title}
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '16px' }}>{displayDescription}</p>
                
                {/* Location and photos */}
                <div className="grid-2" style={{ marginBottom: '16px', fontSize: '0.85rem' }}>
                  <div>
                    <p>📍 <strong>GPS Location:</strong> {locationValue}</p>
                    <p>👤 <strong>Filed By:</strong> {reporterValue}</p>
                    <p>🕒 <strong>Date Logged:</strong> {new Date(createdAtValue).toLocaleDateString()}</p>
                  </div>
                  {attachedImage && (
                    <div style={{ borderRadius: '8px', overflow: 'hidden', height: '100px', border: '1px solid var(--border)' }}>
                      <img src={attachedImage} alt="Issue Attachment" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  )}
                </div>

                {/* Escalation Warning */}
                {isEscalated && comp.status !== 'Resolved' && comp.status !== 'Closed' && (
                  <div style={{ backgroundColor: 'var(--danger-light)', border: '1px solid var(--danger)', padding: '8px 12px', borderRadius: '6px', fontSize: '0.8rem', color: 'var(--danger)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle size={14} /> Warning: This issue has breached its {comp.slaHours || 48}h SLA. Escalated to Panchayat President.
                  </div>
                )}

                {/* Resolution proof details if resolved or closed */}
                {(comp.status === 'Resolved' || comp.status === 'Closed') && resolutionNoteVal && (
                  <div style={{ backgroundColor: 'var(--success-light)', border: '1px dashed var(--success)', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
                    <h5 style={{ color: 'var(--success)', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <CheckCircle2 size={14} /> Resolution Proof
                    </h5>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '8px' }}>{resolutionNoteVal}</p>
                    {resolutionPhotoVal && (
                      <div style={{ width: '150px', height: '100px', borderRadius: '6px', overflow: 'hidden' }}>
                        <img src={resolutionPhotoVal} alt="Resolution" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    )}
                  </div>
                )}

                {/* Interactive Controls based on roles */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                  {/* Timeline progress mapping */}
                  <div style={{ display: 'flex', gap: '4px', fontSize: '0.75rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                    <strong>Status Pipeline:</strong>
                    {['Submitted', 'Acknowledged', 'In Progress', 'Resolved', 'Closed'].map((s, idx) => {
                      const isActive = comp.status === s;
                      const isPast = timelineValue.some(t => t.status === s);
                      return (
                        <span key={s} style={{ display: 'flex', alignItems: 'center' }}>
                          <span style={{ 
                            fontWeight: isActive ? '700' : '400', 
                            color: isActive ? 'var(--primary)' : isPast ? 'var(--success)' : 'inherit'
                          }}>{s}</span>
                          {idx < 4 && <ChevronRight size={12} />}
                        </span>
                      );
                    })}
                  </div>

                  {/* Officer/Admin Actions */}
                  {(currentUser.role === 'officer' || currentUser.role === 'admin') && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {comp.status === 'Submitted' && (
                        <button className="btn btn-outline" onClick={() => handleUpdateStatus(comp.id, 'Acknowledged')} style={{ padding: '4px 10px', fontSize: '0.8rem' }}>
                          Acknowledge
                        </button>
                      )}
                      {comp.status === 'Acknowledged' && (
                        <button className="btn btn-primary" onClick={() => handleUpdateStatus(comp.id, 'In Progress')} style={{ padding: '4px 10px', fontSize: '0.8rem' }}>
                          Start Repair
                        </button>
                      )}
                      {comp.status === 'In Progress' && (
                        <button className="btn btn-success" onClick={() => { setSelectedComplaint(comp); }} style={{ padding: '4px 10px', fontSize: '0.8rem', backgroundColor: 'var(--success)', color: '#fff' }}>
                          Resolve
                        </button>
                      )}
                    </div>
                  )}

                  {/* Resident Actions (Feedback/Rating Closure) */}
                  {currentUser.role === 'resident' && comp.status === 'Resolved' && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Rate Resolution:</span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button 
                            key={star} 
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'gold' }}
                            onClick={() => handleRateComplaint(comp.id, star)}
                          >
                            <Star size={16} fill={star <= (comp.rating || 0) ? 'gold' : 'none'} color="gold" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Display rating if closed */}
                  {comp.status === 'Closed' && ratingVal && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}>
                      <strong>Rating:</strong>
                      <div style={{ display: 'flex' }}>
                        {[1, 2, 3, 4, 5].map(star => (
                          <Star key={star} size={14} fill={star <= ratingVal ? 'gold' : 'none'} color="gold" />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Camera Viewfinder Overlay */}
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
      {/* Resolution Camera Viewfinder Modal Overlay */}
      {resShowCameraModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="card" style={{ maxWidth: '400px', width: '100%', padding: '20px', position: 'relative', textAlign: 'center' }}>
            <button 
              type="button"
              onClick={handleResCloseCamera}
              style={{ position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              ✕
            </button>
            <h3 style={{ fontFamily: 'var(--font-heading)', color: 'var(--primary)', marginBottom: '16px' }}>Take Resolution Photo</h3>
            
            {resCameraError ? (
              <div className="auth-error" style={{ marginBottom: '16px' }}>{resCameraError}</div>
            ) : (
              <div style={{ backgroundColor: '#000', borderRadius: '8px', overflow: 'hidden', height: '280px', marginBottom: '16px', position: 'relative' }}>
                <video 
                  ref={resVideoRef} 
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
                onClick={handleResCloseCamera}
              >
                Cancel
              </button>
              {!resCameraError && (
                <button 
                  type="button"
                  className="btn btn-primary" 
                  onClick={handleResCapturePhoto}
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
