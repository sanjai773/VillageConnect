// Copyright (c) 2026 Sanjai. All rights reserved.

import React, { useState, useEffect } from 'react';
import { 
  Newspaper, 
  AlertTriangle, 
  MessageSquare, 
  Calendar, 
  ShoppingBag, 
  Users, 
  PhoneCall, 
  ShieldAlert, 
  Languages, 
  Sun, 
  Moon,
  Info,
  X,
  LogOut,
  ShieldCheck
} from 'lucide-react';

// Import sub-views
import FeedView from './components/FeedView';
import ComplaintsPortal from './components/ComplaintsPortal';
import RealTimeChat from './components/RealTimeChat';
import EventsView from './components/EventsView';
import MarketplaceView from './components/MarketplaceView';
import VillageDirectory from './components/VillageDirectory';
import EmergencyContacts from './components/EmergencyContacts';
import AdminDashboard from './components/AdminDashboard';
import LoginScreen from './components/LoginScreen';

// Import initial mock data
import { 
  MOCK_USERS, 
  MOCK_ANNOUNCEMENTS, 
  MOCK_FEED, 
  MOCK_COMPLAINTS, 
  MOCK_EVENTS, 
  MOCK_MARKETPLACE, 
  MOCK_CHATS 
} from './utils/MockData';

// Import Supabase
import { supabase, isSupabaseConfigured } from './utils/supabaseClient';

export default function App() {
  // 1. Language Toggle (English / Tamil)
  const [lang, setLang] = useState('en'); // 'en' or 'ta'
  
  // 2. Theme Toggle (Light / Dark)
  const [theme, setTheme] = useState('light'); // 'light' or 'dark'

  // 3. User & Authentication Session
  const [sessionUser, setSessionUser] = useState(() => {
    if (isSupabaseConfigured) return null;
    // Check if guest user saved in localStorage
    const savedGuest = localStorage.getItem('vc_guest_session');
    return savedGuest ? JSON.parse(savedGuest) : null;
  });

  // Offline persona switcher state
  const [currentUserId, setCurrentUserId] = useState('u1');

  // 4. Data states (will load from Supabase if configured, else fallback to localStorage/mock)
  const [users, setUsers] = useState(isSupabaseConfigured ? [] : MOCK_USERS);
  const [posts, setPosts] = useState(isSupabaseConfigured ? [] : MOCK_FEED);
  const [announcements, setAnnouncements] = useState(isSupabaseConfigured ? [] : MOCK_ANNOUNCEMENTS);
  const [complaints, setComplaints] = useState(isSupabaseConfigured ? [] : MOCK_COMPLAINTS);
  const [events, setEvents] = useState(isSupabaseConfigured ? [] : MOCK_EVENTS);
  const [marketplaceItems, setMarketplaceItems] = useState(isSupabaseConfigured ? [] : MOCK_MARKETPLACE);
  const [chats, setChats] = useState(isSupabaseConfigured ? [] : MOCK_CHATS);
  const [reportedItems, setReportedItems] = useState([]);
  const [directoryEntries, setDirectoryEntries] = useState([]);
  
  const [loadingDb, setLoadingDb] = useState(isSupabaseConfigured);

  // 5. Toast alerts
  const [notifications, setNotifications] = useState([]);

  // 6. Navigation Active View
  const [activeView, setActiveView] = useState('feed'); // feed, complaints, chat, events, marketplace, directory, emergency, admin

  // 7. Profile Edit Modal
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Global triggers
  const addNotification = (title, message, type = 'info') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  };

  const handleSaveProfile = async (updatedDetails) => {
    const isGuest = sessionUser && sessionUser.id && sessionUser.id.startsWith('guest_');

    if (isSupabaseConfigured && sessionUser && !isGuest) {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: updatedDetails.name,
          phone: updatedDetails.phone,
          address: updatedDetails.address,
          blood_group: updatedDetails.blood_group,
          occupation: updatedDetails.occupation,
          skills: updatedDetails.skills,
          volunteer: updatedDetails.volunteer
        })
        .eq('id', sessionUser.id);

      if (error) throw error;
      
      setSessionUser({
        ...sessionUser,
        name: updatedDetails.name,
        phone: updatedDetails.phone,
        address: updatedDetails.address,
        blood_group: updatedDetails.blood_group,
        occupation: updatedDetails.occupation,
        skills: updatedDetails.skills,
        volunteer: updatedDetails.volunteer
      });
      addNotification('Success', 'Profile updated in database!', 'success');
    } else {
      // Offline fallback / Guest profile update (saves in state / localStorage)
      const updatedUser = {
        ...currentUser,
        name: updatedDetails.name,
        phone: updatedDetails.phone,
        address: updatedDetails.address,
        bloodGroup: updatedDetails.blood_group,
        blood_group: updatedDetails.blood_group,
        occupation: updatedDetails.occupation,
        skills: updatedDetails.skills,
        volunteer: updatedDetails.volunteer
      };
      
      setUsers(prev => prev.map(u => u.id === currentUser.id ? updatedUser : u));
      setSessionUser(updatedUser);
      addNotification('Success', 'Profile updated locally!', 'success');
    }
  };

  // Sync theme tag to body HTML
  useEffect(() => {
    const body = document.body;
    if (theme === 'dark') {
      body.classList.add('dark-theme');
    } else {
      body.classList.remove('dark-theme');
    }
  }, [theme]);

  // Offline Mode Local Storage persistence
  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem('vc_users', JSON.stringify(users));
  }, [users]);
  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem('vc_posts', JSON.stringify(posts));
  }, [posts]);
  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem('vc_announcements', JSON.stringify(announcements));
  }, [announcements]);
  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem('vc_complaints', JSON.stringify(complaints));
  }, [complaints]);
  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem('vc_events', JSON.stringify(events));
  }, [events]);
  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem('vc_marketplace', JSON.stringify(marketplaceItems));
  }, [marketplaceItems]);
  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem('vc_chats', JSON.stringify(chats));
  }, [chats]);
  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem('vc_reported', JSON.stringify(reportedItems));
  }, [reportedItems]);

  // Load offline data on start if offline
  useEffect(() => {
    if (isSupabaseConfigured) return;
    const lUsers = localStorage.getItem('vc_users');
    const lPosts = localStorage.getItem('vc_posts');
    const lAnnouncements = localStorage.getItem('vc_announcements');
    const lComplaints = localStorage.getItem('vc_complaints');
    const lEvents = localStorage.getItem('vc_events');
    const lMarketplace = localStorage.getItem('vc_marketplace');
    const lChats = localStorage.getItem('vc_chats');
    const lReported = localStorage.getItem('vc_reported');

    if (lUsers) setUsers(JSON.parse(lUsers));
    if (lPosts) setPosts(JSON.parse(lPosts));
    if (lAnnouncements) setAnnouncements(JSON.parse(lAnnouncements));
    if (lComplaints) setComplaints(JSON.parse(lComplaints));
    if (lEvents) setEvents(JSON.parse(lEvents));
    if (lMarketplace) setMarketplaceItems(JSON.parse(lMarketplace));
    if (lChats) setChats(JSON.parse(lChats));
    if (lReported) setReportedItems(JSON.parse(lReported));
  }, []);

  // Supabase Auth and Session Listeners
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    // Check active auth session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        fetchUserProfile(session.user.id);
      } else {
        // Fallback to guest from localStorage if any
        const savedGuest = localStorage.getItem('vc_guest_session');
        if (savedGuest) {
          setSessionUser(JSON.parse(savedGuest));
        } else {
          setSessionUser(null);
          setLoadingDb(false);
        }
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        fetchUserProfile(session.user.id);
      } else {
        const savedGuest = localStorage.getItem('vc_guest_session');
        if (savedGuest) {
          setSessionUser(JSON.parse(savedGuest));
        } else {
          setSessionUser(null);
          setLoadingDb(false);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchUserProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) throw error;
      setSessionUser(data);
    } catch (err) {
      console.error('Error fetching user profile:', err);
      addNotification('Auth Error', 'Failed to fetch user profile details.', 'danger');
      setLoadingDb(false);
    }
  };

  // Real-time Database Subscriptions and Data Fetching
  useEffect(() => {
    if (!isSupabaseConfigured || !sessionUser) return;

    // Fetch initial datasets
    const fetchInitialData = async () => {
      setLoadingDb(true);
      try {
        // Users
        const { data: dbUsers } = await supabase.from('profiles').select('*');
        if (dbUsers) setUsers(dbUsers);

        // Announcements
        const { data: dbAnnouncements } = await supabase.from('announcements').select('*').order('date', { ascending: false });
        if (dbAnnouncements) setAnnouncements(dbAnnouncements);

        // Posts + nested Comments
        const { data: dbPosts } = await supabase.from('posts').select('*, comments(*)').order('timestamp', { ascending: false });
        if (dbPosts) {
          // format comment structures to match front-end
          const formattedPosts = dbPosts.map(p => ({
            ...p,
            comments: (p.comments || []).map(c => ({
              id: c.id,
              author: c.author_name,
              text: c.text,
              time: c.time
            })).sort((a,b) => new Date(a.time) - new Date(b.time))
          }));
          setPosts(formattedPosts);
        }

        // Complaints
        const { data: dbComplaints } = await supabase.from('complaints').select('*').order('date', { ascending: false });
        if (dbComplaints) setComplaints(dbComplaints);

        // Events
        const { data: dbEvents } = await supabase.from('events').select('*');
        if (dbEvents) setEvents(dbEvents);

        // Marketplace
        const { data: dbMarket } = await supabase.from('marketplace').select('*').order('date', { ascending: false });
        if (dbMarket) setMarketplaceItems(dbMarket);

        // Chats
        const { data: dbChats } = await supabase.from('chats').select('*').order('timestamp', { ascending: true });
        if (dbChats) setChats(dbChats);

        // Village Directory Custom Entries
        const { data: dbDirectory } = await supabase.from('village_directory').select('*').order('created_at', { ascending: false });
        if (dbDirectory) setDirectoryEntries(dbDirectory);

      } catch (err) {
        console.error('Error loading database tables:', err);
      } finally {
        setLoadingDb(false);
      }
    };

    fetchInitialData();

    // Fallback for offline custom directory
    if (!isSupabaseConfigured) {
      const saved = localStorage.getItem('vc_custom_directory');
      if (saved) {
        try {
          setDirectoryEntries(JSON.parse(saved));
        } catch (e) {}
      }
    }

    // 1. Subscribe to Announcements
    const announcementSub = supabase
      .channel('announcement_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setAnnouncements(prev => {
            if (prev.some(a => a.id === payload.new.id)) return prev;
            return [payload.new, ...prev];
          });
          addNotification('New Announcement', payload.new.title, 'info');
        } else if (payload.eventType === 'UPDATE') {
          setAnnouncements(prev => prev.map(a => a.id === payload.new.id ? payload.new : a));
        } else if (payload.eventType === 'DELETE') {
          setAnnouncements(prev => prev.filter(a => a.id !== payload.old.id));
        }
      })
      .subscribe();

    // 2. Subscribe to Posts
    const postSub = supabase
      .channel('post_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setPosts(prev => {
            if (prev.some(p => p.id === payload.new.id)) return prev;
            return [{ ...payload.new, comments: [] }, ...prev];
          });
        } else if (payload.eventType === 'UPDATE') {
          setPosts(prev => prev.map(p => p.id === payload.new.id ? { ...p, ...payload.new } : p));
        } else if (payload.eventType === 'DELETE') {
          setPosts(prev => prev.filter(p => p.id !== payload.old.id));
        }
      })
      .subscribe();

    // 3. Subscribe to Comments
    const commentSub = supabase
      .channel('comment_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments' }, (payload) => {
        const newComment = {
          id: payload.new.id,
          author: payload.new.author_name,
          text: payload.new.text,
          time: payload.new.time
        };
        setPosts(prev => prev.map(post => {
          if (post.id === payload.new.post_id) {
            const hasComment = post.comments.some(c => c.id === newComment.id);
            if (!hasComment) {
              return { ...post, comments: [...post.comments, newComment] };
            }
          }
          return post;
        }));
      })
      .subscribe();

    // 4. Subscribe to Complaints
    const complaintSub = supabase
      .channel('complaint_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'complaints' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setComplaints(prev => {
            if (prev.some(c => c.id === payload.new.id)) return prev;
            return [payload.new, ...prev];
          });
          addNotification('New Complaint Lodged', payload.new.title, 'warning');
        } else if (payload.eventType === 'UPDATE') {
          setComplaints(prev => prev.map(c => c.id === payload.new.id ? payload.new : c));
        } else if (payload.eventType === 'DELETE') {
          setComplaints(prev => prev.filter(c => c.id !== payload.old.id));
        }
      })
      .subscribe();

    // 5. Subscribe to Events
    const eventSub = supabase
      .channel('event_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setEvents(prev => {
            if (prev.some(e => e.id === payload.new.id)) return prev;
            return [payload.new, ...prev];
          });
          addNotification('New Community Event', payload.new.title, 'info');
        } else if (payload.eventType === 'UPDATE') {
          setEvents(prev => prev.map(e => e.id === payload.new.id ? payload.new : e));
        } else if (payload.eventType === 'DELETE') {
          setEvents(prev => prev.filter(e => e.id !== payload.old.id));
        }
      })
      .subscribe();

    // 6. Subscribe to Marketplace Items
    const marketSub = supabase
      .channel('market_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marketplace' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setMarketplaceItems(prev => {
            if (prev.some(m => m.id === payload.new.id)) return prev;
            return [payload.new, ...prev];
          });
          addNotification('Marketplace Update', `New listing: ${payload.new.title}`, 'success');
        } else if (payload.eventType === 'UPDATE') {
          setMarketplaceItems(prev => prev.map(m => m.id === payload.new.id ? payload.new : m));
        } else if (payload.eventType === 'DELETE') {
          setMarketplaceItems(prev => prev.filter(m => m.id !== payload.old.id));
        }
      })
      .subscribe();

    // 7. Subscribe to Chats
    const chatSub = supabase
      .channel('chat_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setChats(prev => {
            const hasMsg = prev.some(m => m.id === payload.new.id);
            if (hasMsg) return prev;
            // If it is a system settings message, replace the previous settings message
            if (payload.new.sender_name === 'system_settings') {
              return [...prev.filter(m => m.sender_name !== 'system_settings'), payload.new];
            }
            return [...prev, payload.new];
          });
        } else if (payload.eventType === 'DELETE') {
          setChats(prev => prev.filter(m => m.id !== payload.old.id));
        }
      })
      .subscribe();

    // 8. Subscribe to Profiles (for directory / approval synchronization)
    const profileSub = supabase
      .channel('profile_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setUsers(prev => {
            if (prev.some(u => u.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
        } else if (payload.eventType === 'UPDATE') {
          setUsers(prev => prev.map(u => u.id === payload.new.id ? payload.new : u));
          // If current logged-in profile was updated, sync sessionUser
          if (payload.new.id === sessionUser?.id) {
            setSessionUser(payload.new);
          }
        } else if (payload.eventType === 'DELETE') {
          setUsers(prev => prev.filter(u => u.id !== payload.old.id));
        }
      })
      .subscribe();

    // 9. Subscribe to Village Directory Custom Entries
    const directorySub = supabase
      .channel('directory_changes')
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
      supabase.removeChannel(announcementSub);
      supabase.removeChannel(postSub);
      supabase.removeChannel(commentSub);
      supabase.removeChannel(complaintSub);
      supabase.removeChannel(eventSub);
      supabase.removeChannel(marketSub);
      supabase.removeChannel(chatSub);
      supabase.removeChannel(profileSub);
      supabase.removeChannel(directorySub);
    };
  }, [sessionUser?.id]);

  // Real-time listener for the logged-in user profile status (for pending/approval screen updates)
  useEffect(() => {
    if (!isSupabaseConfigured || !sessionUser || sessionUser.role === 'resident') return;
    
    const profileChangeChannel = supabase
      .channel('user_approval_listener')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${sessionUser.id}`
      }, (payload) => {
        setSessionUser(payload.new);
        addNotification(
          'Profile Updated',
          `Your role status is: ${payload.new.approval_status}`,
          payload.new.approval_status === 'approved' ? 'success' : 'warning'
        );
      })
      .subscribe();

    return () => {
      supabase.removeChannel(profileChangeChannel);
    };
  }, [sessionUser?.id]);

  // Current active user object (online user or offline persona)
  const currentUser = (isSupabaseConfigured ? sessionUser : (users.find(u => u.id === currentUserId) || sessionUser || users[0])) || {
    id: 'guest',
    name: 'Resident',
    role: 'resident',
    address: '',
    phone: '',
    email: '',
    blood_group: 'O+',
    occupation: '',
    skills: [],
    volunteer: []
  };

  const handleReportPost = (postId, type) => {
    const postToReport = posts.find(p => p.id === postId);
    if (!postToReport) return;

    if (reportedItems.some(item => item.id === postId)) return;

    setReportedItems([
      ...reportedItems,
      {
        id: postId,
        type,
        content: postToReport.content,
        timestamp: new Date().toISOString()
      }
    ]);
    addNotification('Report Submitted', 'Panchayat officials will review this content.', 'warning');
  };

  // Switch to chat layout and select user to text
  const startConversation = (partnerId, partnerName) => {
    if (isSupabaseConfigured) {
      // In online mode, we direct users to the unified Community Chat Room
      setActiveView('chat');
      addNotification('Chat Opened', 'Connected to the Village Community Chat Room', 'success');
      return;
    }

    const existingChat = chats.find(c => c.partnerId === partnerId);
    
    if (existingChat) {
      setActiveView('chat');
    } else {
      const newChat = {
        id: `chat_${Date.now()}`,
        partnerId,
        partnerName,
        partnerRole: 'resident',
        partnerAvatar: '👤',
        status: 'online',
        messages: [
          { id: `m_${Date.now()}`, senderId: partnerId, text: `Hello, saw your listing in the Marketplace!`, timestamp: new Date().toISOString(), status: 'read' }
        ]
      };
      setChats([newChat, ...chats]);
      setActiveView('chat');
    }
    addNotification('Chat Initiated', `Connected to ${partnerName}`, 'success');
  };

  const handleLogout = async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
      localStorage.removeItem('vc_guest_session');
    }
    setSessionUser(null);
    setLoadingDb(false);
    addNotification('Success', 'Logged out successfully', 'success');
  };

  const handleGuestLogin = (guestUser) => {
    localStorage.setItem('vc_guest_session', JSON.stringify(guestUser));
    setLoadingDb(true);
    setSessionUser(guestUser);
    addNotification('Welcome', `Logged in as Resident: ${guestUser.name}`, 'success');
  };

  const handleLoginSuccess = (userProfile) => {
    setLoadingDb(true);
    setSessionUser(userProfile);
    addNotification('Welcome Back', `Successfully logged in as ${userProfile.name} (${userProfile.role})`, 'success');
  };

  // Translations
  const TRANSLATIONS = {
    en: {
      appName: 'VillageConnect - RK BOIZ',
      subtitle: 'Panchayat Portal',
      roleSelectLabel: 'Test Persona (Offline):',
      feed: 'Community Feed',
      complaints: 'Complaints Portal',
      chat: 'Village Chat',
      events: 'Events',
      marketplace: 'Marketplace',
      directory: 'Village Directory',
      emergency: 'Emergency Services',
      admin: 'Admin Dashboard',
      switchLang: 'தமிழ்',
      logout: 'Logout',
      accessDenied: 'Access Denied',
      noOfficerAccess: 'You must log in as an Officer or Admin to view this panel.',
      pendingTitle: 'Request Pending Approval',
      pendingText: 'Your request to join as a Panchayat Officer is currently pending Admin clearance. You will receive notification as soon as the Admin reviews your application.',
      pendingSupport: 'Contact Admin: president.murugan@panchayat.gov.in',
      loadingText: 'Synchronizing database...',
      copyright: '© 2026 Sanjai. All rights reserved.'
    },
    ta: {
      appName: 'கிராம இணைப்பு',
      subtitle: 'பஞ்சாயத்து போர்டல்',
      roleSelectLabel: 'பரிசோதனை பயனர் (ஆஃப்லைன்):',
      feed: 'சமூக ஊடகம்',
      complaints: 'புகார் மையம்',
      chat: 'கிராம அரட்டை',
      events: 'நிகழ்வுகள்',
      marketplace: 'சந்தை',
      directory: 'முகவரி புத்தகம்',
      emergency: 'அவசர எண்கள்',
      admin: 'நிர்வாக பலகை',
      switchLang: 'English',
      logout: 'வெளியேறு',
      accessDenied: 'அனுமதி மறுக்கப்பட்டது',
      noOfficerAccess: 'இந்த பலகையை பார்க்க நீங்கள் அதிகாரி அல்லது நிர்வாகியாக உள்நுழைய வேண்டும்.',
      pendingTitle: 'கோரிக்கை நிலுவையில் உள்ளது',
      pendingText: 'பஞ்சாயத்து அதிகாரியாக சேருவதற்கான உங்கள் கோரிக்கை தற்போது நிர்வாகியின் ஒப்புதலுக்காக காத்திருக்கிறது. நிர்வாகி சரிபார்த்ததும் உங்களுக்கு அறிவிக்கப்படும்.',
      pendingSupport: 'நிர்வாகியைத் தொடர்பு கொள்ளவும்: president.murugan@panchayat.gov.in',
      loadingText: 'தரவுத்தளம் ஒத்திசைக்கப்படுகிறது...',
      copyright: '© 2026 சஞ்சய். அனைத்து உரிமைகளும் பாதுகாக்கப்பட்டவை.'
    }
  };

  const t = TRANSLATIONS[lang];

  // Helper function to render active component
  const renderActiveView = () => {
    switch (activeView) {
      case 'feed':
        return (
          <FeedView 
            currentUser={currentUser}
            posts={posts}
            setPosts={setPosts}
            announcements={announcements}
            addNotification={addNotification}
            reportPost={handleReportPost}
          />
        );
      case 'complaints':
        return (
          <ComplaintsPortal 
            currentUser={currentUser}
            complaints={complaints}
            setComplaints={setComplaints}
            addNotification={addNotification}
          />
        );
      case 'chat':
        return (
          <RealTimeChat 
            currentUser={currentUser}
            chats={chats}
            setChats={setChats}
            addNotification={addNotification}
          />
        );
      case 'events':
        return (
          <EventsView 
            currentUser={currentUser}
            events={events}
            setEvents={setEvents}
            addNotification={addNotification}
          />
        );
      case 'marketplace':
        return (
          <MarketplaceView 
            currentUser={currentUser}
            items={marketplaceItems}
            setItems={setMarketplaceItems}
            addNotification={addNotification}
            startConversation={startConversation}
          />
        );
      case 'directory':
        return (
          <VillageDirectory 
            currentUser={currentUser}
            users={users}
            addNotification={addNotification}
            directoryEntries={directoryEntries}
            setDirectoryEntries={setDirectoryEntries}
          />
        );
      case 'emergency':
        return <EmergencyContacts />;
      case 'admin':
        if (!currentUser || currentUser.role === 'resident') {
          return (
            <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
              <ShieldAlert size={48} style={{ color: 'var(--danger)', marginBottom: '12px' }} />
              <h3>{t.accessDenied}</h3>
              <p style={{ color: 'var(--text-muted)' }}>{t.noOfficerAccess}</p>
            </div>
          );
        }
        return (
          <AdminDashboard 
            currentUser={currentUser}
            users={users}
            setUsers={setUsers}
            posts={posts}
            setPosts={setPosts}
            reportedItems={reportedItems}
            setReportedItems={setReportedItems}
            complaints={complaints}
            addNotification={addNotification}
            announcements={announcements}
            setAnnouncements={setAnnouncements}
            directoryEntries={directoryEntries}
            setDirectoryEntries={setDirectoryEntries}
          />
        );
      default:
        return <div>View not found</div>;
    }
  };

  // If loading screen is active
  if (loadingDb) {
    return (
      <div className="db-loader-screen">
        <div className="db-loader-spinner"></div>
        <p>{t.loadingText}</p>
        <style dangerouslySetInnerHTML={{__html: `
          .db-loader-screen {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background-color: var(--bg-app);
            color: var(--text-main);
          }
          .db-loader-spinner {
            border: 4px solid var(--border);
            border-top: 4px solid var(--primary);
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin-bottom: 16px;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}} />
      </div>
    );
  }

  // If there's no authenticated or guest session, show LoginScreen
  if (!sessionUser) {
    return (
      <LoginScreen 
        onLoginSuccess={handleLoginSuccess}
        onGuestLogin={handleGuestLogin}
        currentTheme={theme}
        lang={lang}
      />
    );
  }

  // If user is a registered officer but is pending admin approval
  if (sessionUser && sessionUser.role === 'officer' && sessionUser.approval_status === 'pending') {
    return (
      <div className={`login-page ${theme === 'dark' ? 'dark-theme' : ''}`}>
        <div className="login-card pending-card">
          <ShieldAlert size={48} className="pending-icon" style={{ color: 'var(--accent)' }} />
          <h2 style={{ fontFamily: 'var(--font-heading)', color: 'var(--primary)', marginBottom: '8px' }}>{t.pendingTitle}</h2>
          <p className="pending-user-info" style={{ backgroundColor: 'var(--primary-light)', padding: '8px 16px', borderRadius: 'var(--radius-sm)', fontWeight: 600, margin: '8px 0' }}>
            {sessionUser.name} ({sessionUser.email})
          </p>
          <p className="pending-description" style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.5', margin: '8px 0' }}>{t.pendingText}</p>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '16px' }}>{t.pendingSupport}</p>
          <button 
            className="btn-auth" 
            onClick={handleLogout}
            style={{ width: '100%', display: 'flex', gap: '8px', padding: '10px', backgroundColor: 'var(--primary)', color: 'var(--text-white)', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', justifyContent: 'center' }}
          >
            <LogOut size={16} /> {t.logout}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      
      {/* 1. Left Sidebar Navigation (Desktop) */}
      <nav className="sidebar">
        <div className="sidebar-logo">
          {t.appName} <span>•</span>
        </div>
        
        <ul className="sidebar-menu">
          {[
            { id: 'feed', label: t.feed, icon: <Newspaper size={18} /> },
            { id: 'complaints', label: t.complaints, icon: <AlertTriangle size={18} /> },
            { id: 'chat', label: t.chat, icon: <MessageSquare size={18} /> },
            { id: 'events', label: t.events, icon: <Calendar size={18} /> },
            { id: 'marketplace', label: t.marketplace, icon: <ShoppingBag size={18} /> },
            { id: 'directory', label: t.directory, icon: <Users size={18} /> },
            { id: 'emergency', label: t.emergency, icon: <PhoneCall size={18} /> },
            { id: 'admin', label: t.admin, icon: <ShieldAlert size={18} />, hidden: currentUser.role === 'resident' }
          ].map(item => {
            if (item.hidden) return null;
            return (
              <li key={item.id}>
                <a 
                  className={`sidebar-item ${activeView === item.id ? 'active' : ''}`}
                  onClick={() => setActiveView(item.id)}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </a>
              </li>
            );
          })}
        </ul>

        {/* Current Active Persona Details */}
        <div className="sidebar-user" style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'stretch' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div 
              className="user-avatar" 
              onClick={() => setShowProfileModal(true)} 
              style={{ cursor: 'pointer', transition: 'var(--transition)' }}
              title={lang === 'en' ? 'Edit Profile' : 'சுயவிவரத்தைத் திருத்து'}
            >
              {currentUser.role === 'admin' ? '🏛️' : currentUser.role === 'officer' ? '💼' : '👤'}
            </div>
            <div className="user-info-text">
              <h4 style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '110px' }}>{currentUser.name}</h4>
              <p style={{ textTransform: 'capitalize' }}>
                {currentUser.role === 'resident' ? (lang === 'en' ? 'Resident' : 'குடிமகன்') : currentUser.role}
              </p>
            </div>
          </div>

          {/* Logout button */}
          {sessionUser && (
            <button 
              onClick={handleLogout}
              className="sidebar-logout-btn"
              title="Logout"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '6px 12px',
                backgroundColor: 'rgba(231, 111, 81, 0.15)',
                color: 'var(--danger)',
                border: '1px solid rgba(231, 111, 81, 0.3)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'var(--transition)'
              }}
            >
              <LogOut size={14} />
              <span>{t.logout}</span>
            </button>
          )}
        </div>
      </nav>

      {/* 2. Main Body (Contains Top Role Switcher + Main Content Router) */}
      <div className="main-layout">
        
        {/* Top Role Selector and Styling bar */}
        <header className="role-bar">
          <div className="role-title">
            <span className="desktop-title">{t.subtitle}</span>
            <span className="mobile-title">🌾 {t.appName.split(' ')[0]}</span>
          </div>

          <div className="role-selectors">
            {/* Show Role Switcher only when offline */}
            {!isSupabaseConfigured ? (
              <>
                {/* Desktop Buttons switcher */}
                <div className="role-switcher-desktop">
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500, marginRight: '4px' }}>
                    {t.roleSelectLabel}
                  </span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button 
                      className={`role-btn ${currentUserId === 'u1' ? 'active' : ''}`}
                      onClick={() => {
                        setCurrentUserId('u1');
                        addNotification('Role Switched', 'Acting as Rajesh (Resident)', 'info');
                      }}
                    >
                      Resident (Rajesh)
                    </button>
                    <button 
                      className={`role-btn ${currentUserId === 'u5' ? 'active' : ''}`}
                      onClick={() => {
                        setCurrentUserId('u5');
                        addNotification('Role Switched', 'Acting as Officer Subhash', 'info');
                      }}
                    >
                      Officer (Subhash)
                    </button>
                    <button 
                      className={`role-btn ${currentUserId === 'u6' ? 'active' : ''}`}
                      onClick={() => {
                        setCurrentUserId('u6');
                        addNotification('Role Switched', 'Acting as Panchayat President Murugan', 'info');
                      }}
                    >
                      Admin (Murugan)
                    </button>
                  </div>
                </div>

                {/* Mobile Dropdown switcher */}
                <div className="role-switcher-mobile">
                  <select 
                    value={currentUserId} 
                    onChange={(e) => {
                      const uid = e.target.value;
                      setCurrentUserId(uid);
                      const selectedPersona = users.find(u => u.id === uid) || { name: uid === 'u1' ? 'Rajesh' : uid === 'u5' ? 'Subhash' : 'Murugan' };
                      addNotification('Role Switched', `Acting as ${selectedPersona.name}`, 'info');
                    }}
                    className="role-select-dropdown"
                  >
                    <option value="u1">👤 Resident</option>
                    <option value="u5">💼 Officer</option>
                    <option value="u6">🏛️ Admin</option>
                  </select>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginRight: '8px', fontSize: '0.85rem', color: 'var(--success)', fontWeight: 600 }}>
                <ShieldCheck size={16} />
                <span className="desktop-db-status">Secure Live Database Connected</span>
              </div>
            )}

            {/* i18n Translation selector */}
            <button 
              className="theme-toggle" 
              onClick={() => {
                setLang(lang === 'en' ? 'ta' : 'en');
                addNotification('Language Switched', lang === 'en' ? 'மொழி மாற்றப்பட்டது: தமிழ்' : 'Language switched: English', 'success');
              }}
              title="Change Language"
              style={{ marginLeft: '12px' }}
            >
              <Languages size={18} />
            </button>

            {/* Dark Mode toggle */}
            <button 
              className="theme-toggle" 
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              title="Toggle Theme"
              style={{ marginLeft: '4px' }}
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>

            {/* Mobile User Profile Section */}
            <div className="mobile-user-profile">
              <div 
                className="user-avatar" 
                onClick={() => setShowProfileModal(true)} 
                style={{ cursor: 'pointer', width: '32px', height: '32px', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title={lang === 'en' ? 'Edit Profile' : 'சுயவிவரத்தைத் திருத்து'}
              >
                {currentUser.role === 'admin' ? '🏛️' : currentUser.role === 'officer' ? '💼' : '👤'}
              </div>
              <div className="mobile-user-info-text">
                <span className="mobile-username">{currentUser.name.split(' ')[0]}</span>
              </div>
              {sessionUser && (
                <button 
                  onClick={handleLogout}
                  className="mobile-logout-btn"
                  title="Logout"
                >
                  <LogOut size={16} />
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Content Render Pane */}
        <main className="content-body">
          {renderActiveView()}
        </main>

        <footer style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--border)',
          textAlign: 'center',
          fontSize: '0.85rem',
          color: 'var(--text-muted)',
          marginTop: 'auto'
        }}>
          {t.copyright}
        </footer>
      </div>

      {/* 3. Bottom Menu Bar Navigation (Mobile Views) */}
      <nav className="mobile-nav">
        <ul className="mobile-menu">
          {[
            { id: 'feed', label: t.feed, icon: <Newspaper size={18} /> },
            { id: 'complaints', label: t.complaints, icon: <AlertTriangle size={18} /> },
            { id: 'chat', label: t.chat, icon: <MessageSquare size={18} /> },
            { id: 'events', label: t.events, icon: <Calendar size={18} /> },
            { id: 'marketplace', label: t.marketplace, icon: <ShoppingBag size={18} /> },
            { id: 'emergency', label: t.emergency, icon: <PhoneCall size={18} /> }
          ].map(item => (
            <li key={item.id}>
              <a 
                className={`mobile-item ${activeView === item.id ? 'active' : ''}`}
                onClick={() => setActiveView(item.id)}
              >
                {item.icon}
                <span>{item.label.split(' ')[0]}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* 4. Notification Toast Alerts Container */}
      <div className="toast-container">
        {notifications.map(n => (
          <div key={n.id} className={`toast ${n.type}`}>
            <Info size={16} />
            <div>
              <strong style={{ fontSize: '0.85rem', display: 'block' }}>{n.title}</strong>
              <span style={{ fontSize: '0.75rem' }}>{n.message}</span>
            </div>
          </div>
        ))}
      </div>

      {showProfileModal && (
        <ProfileModal
          currentUser={currentUser}
          onClose={() => setShowProfileModal(false)}
          isSupabaseConfigured={isSupabaseConfigured}
          onSave={handleSaveProfile}
          lang={lang}
          onLogout={handleLogout}
        />
      )}

    </div>
  );
}

function ProfileModal({ currentUser, onClose, isSupabaseConfigured, onSave, lang, onLogout }) {
  const [name, setName] = useState(currentUser.name || '');
  const [phone, setPhone] = useState(currentUser.phone || '');
  const [address, setAddress] = useState(currentUser.address || '');
  
  const initialBg = currentUser.blood_group || currentUser.bloodGroup || 'O+';
  const isStandardBg = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].includes(initialBg);
  const [bloodGroupSelect, setBloodGroupSelect] = useState(isStandardBg ? initialBg : 'Other');
  const [customBloodGroup, setCustomBloodGroup] = useState(isStandardBg ? '' : initialBg);

  const [occupation, setOccupation] = useState(currentUser.occupation || '');
  const [skills, setSkills] = useState(currentUser.skills ? (Array.isArray(currentUser.skills) ? currentUser.skills.join(', ') : currentUser.skills) : '');
  const [volunteer, setVolunteer] = useState(currentUser.volunteer ? (Array.isArray(currentUser.volunteer) ? currentUser.volunteer.join(', ') : currentUser.volunteer) : '');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      const skillsArray = skills.split(',').map(s => s.trim()).filter(Boolean);
      const volunteerArray = volunteer.split(',').map(v => v.trim()).filter(Boolean);
      
      const bgValue = bloodGroupSelect === 'Other' ? customBloodGroup.trim() : bloodGroupSelect;
      const updatedDetails = {
        name,
        phone,
        address,
        blood_group: bgValue,
        occupation,
        skills: skillsArray,
        volunteer: volunteerArray
      };

      await onSave(updatedDetails);
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to save profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" style={{
      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
      backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div className="card" style={{ maxWidth: '450px', width: '100%', padding: '24px', position: 'relative', animation: 'slideIn 0.2s ease', maxHeight: '90vh', overflowY: 'auto' }}>
        <button 
          onClick={onClose}
          style={{ position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
        >
          <X size={20} />
        </button>
        <h3 style={{ fontFamily: 'var(--font-heading)', color: 'var(--primary)', marginBottom: '8px', fontSize: '1.25rem' }}>
          {lang === 'en' ? 'Update Profile Details' : 'சுயவிவர விவரங்களை புதுப்பி'}
        </h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
          {lang === 'en' ? 'Complete your registration details below for the village directory and emergency logs.' : 'கிராம முகவரி புத்தகம் மற்றும் அவசர பதிவுகளுக்காக உங்கள் விவரங்களை பூர்த்தி செய்யவும்.'}
        </p>

        {/* User Identity & Logout Button */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--primary-light)',
          padding: '12px',
          borderRadius: 'var(--radius-sm)',
          marginBottom: '16px',
          gap: '8px'
        }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
              {lang === 'en' ? 'Signed in as:' : 'உள்நுழைந்துள்ள பயனர்:'}
            </span>
            <strong style={{ fontSize: '0.95rem' }}>{currentUser.name}</strong>
            {currentUser.email && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>({currentUser.email})</span>}
          </div>
          {onLogout && (
            <button
              type="button"
              onClick={() => {
                onLogout();
                onClose();
              }}
              className="btn btn-outline"
              style={{
                borderColor: 'var(--danger)',
                color: 'var(--danger)',
                backgroundColor: 'rgba(231, 111, 81, 0.05)',
                padding: '6px 12px',
                fontSize: '0.8rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                width: '100%',
                cursor: 'pointer'
              }}
            >
              <LogOut size={14} /> {lang === 'en' ? 'Logout Account' : 'வெளியேறவும்'}
            </button>
          )}
        </div>

        {errorMsg && <div className="auth-error" style={{ marginBottom: '12px' }}>{errorMsg}</div>}

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="form-group">
            <label className="form-label">{lang === 'en' ? 'Full Name' : 'முழு பெயர்'}</label>
            <input type="text" className="form-input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="form-group">
            <label className="form-label">{lang === 'en' ? 'Role' : 'பங்கு'}</label>
            <input type="text" className="form-input" value={currentUser.role} readOnly style={{ backgroundColor: 'var(--primary-light)', cursor: 'not-allowed', textTransform: 'capitalize' }} />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">{lang === 'en' ? 'Phone Number' : 'தொலைபேசி எண்'}</label>
              <input type="tel" className="form-input" placeholder="+91 XXXXX XXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">{lang === 'en' ? 'Blood Group' : 'இரத்த வகை'}</label>
              <select className="form-select" value={bloodGroupSelect} onChange={(e) => setBloodGroupSelect(e.target.value)}>
                {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-', 'Other'].map(bg => (
                  <option key={bg} value={bg}>{bg === 'Other' ? (lang === 'en' ? 'Other' : 'மற்றவை') : bg}</option>
                ))}
              </select>
            </div>
          </div>

          {bloodGroupSelect === 'Other' && (
            <div className="form-group">
              <label className="form-label">{lang === 'en' ? 'Specify Blood Group' : 'இரத்த வகையைக் குறிப்பிடவும்'}</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="e.g. Bombay Blood" 
                value={customBloodGroup} 
                onChange={(e) => setCustomBloodGroup(e.target.value)} 
                required
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">{lang === 'en' ? 'Address / House No.' : 'முகவரி / வீட்டு எண்'}</label>
            <input type="text" className="form-input" placeholder="12 North Street" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">{lang === 'en' ? 'Occupation' : 'தொழில்'}</label>
            <input type="text" className="form-input" placeholder="Farmer / Shopkeeper" value={occupation} onChange={(e) => setOccupation(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">{lang === 'en' ? 'Skills (comma separated)' : 'திறன்கள் (காற்புள்ளியால் பிரிக்கப்பட்டது)'}</label>
            <input type="text" className="form-input" placeholder="Carpentry, Electrical" value={skills} onChange={(e) => setSkills(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">{lang === 'en' ? 'Volunteer Interests (comma separated)' : 'தன்னார்வ ஆர்வங்கள் (காற்புள்ளியால் பிரிக்கப்பட்டது)'}</label>
            <input type="text" className="form-input" placeholder="Emergency help, Tutoring" value={volunteer} onChange={(e) => setVolunteer(e.target.value)} />
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: '8px' }}>
            {loading ? (lang === 'en' ? 'Saving...' : 'சேமிக்கப்படுகிறது...') : (lang === 'en' ? 'Save Profile' : 'சுயவிவரத்தை சேமி')}
          </button>
        </form>
      </div>
    </div>
  );
}
