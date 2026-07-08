import React, { useState } from 'react';
import { supabase, isSupabaseConfigured } from '../utils/supabaseClient';
import { Lock, Mail, User, Phone, MapPin, CheckCircle, Shield, ArrowRight } from 'lucide-react';

export default function LoginScreen({ onLoginSuccess, onGuestLogin, currentTheme, lang }) {
  const [activeTab, setActiveTab] = useState('login'); // 'login', 'register', 'guest'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [bloodGroupSelect, setBloodGroupSelect] = useState('O+');
  const [customBloodGroup, setCustomBloodGroup] = useState('');
  const [occupation, setOccupation] = useState('');
  const [skills, setSkills] = useState('');
  const [volunteer, setVolunteer] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [pendingApprovalUser, setPendingApprovalUser] = useState(null);

  // Translations
  const t = {
    en: {
      title: 'Welcome to VillageConnect',
      subtitle: 'Digital Panchayat & Citizen Community Portal',
      loginTab: 'Official Login',
      registerTab: 'Officer Signup',
      guestTab: 'Resident (Guest)',
      email: 'Email Address',
      password: 'Password',
      name: 'Full Name',
      phone: 'Phone Number',
      address: 'Address / House No.',
      bloodGroup: 'Blood Group',
      occupation: 'Occupation',
      skills: 'Skills (comma separated)',
      volunteer: 'Volunteer Interests (comma separated)',
      loginBtn: 'Log In',
      registerBtn: 'Submit Signup Request',
      guestBtn: 'Enter as Resident',
      guestName: 'Your Name (displayed on posts)',
      guestPlaceholder: 'Enter your name...',
      guestIntro: 'Residents do not need an account to view announcements, submit complaints, view events, and post on the marketplace.',
      loading: 'Processing...',
      pendingTitle: 'Signup Request Pending Approval',
      pendingText: 'Thank you for registering! Your officer account request has been submitted to the Panchayat Admin. You will be able to log in once the Admin reviews and clears your request.',
      goBack: 'Back to Login',
      noSupabase: 'Note: Database is running in local fallback mode. Real-time sync and real authentication are disabled. Feel free to use Guest Access or use the Role Switcher at the top to simulate views.'
    },
    ta: {
      title: 'வில்லேஜ்கனெக்ட்-க்கு வரவேற்கிறோம்',
      subtitle: 'டிஜிட்டல் பஞ்சாயத்து & குடிமக்கள் சமூக போர்டல்',
      loginTab: 'அதிகாரப்பூர்வ உள்நுழைவு',
      registerTab: 'அதிகாரி பதிவு',
      guestTab: 'குடிமகன் (விருந்தினர்)',
      email: 'மின்னஞ்சல் முகவரி',
      password: 'கடவுச்சொல்',
      name: 'முழு பெயர்',
      phone: 'தொலைபேசி எண்',
      address: 'முகவரி / வீட்டு எண்',
      bloodGroup: 'இரத்த வகை',
      occupation: 'தொழில்',
      skills: 'திறன்கள் (காற்புள்ளியால் பிரிக்கப்பட்டது)',
      volunteer: 'தன்னார்வ ஆர்வங்கள் (காற்புள்ளியால் பிரிக்கப்பட்டது)',
      loginBtn: 'உள்நுழைக',
      registerBtn: 'பதிவு கோரிக்கையை சமர்ப்பிக்கவும்',
      guestBtn: 'குடிமகனாக நுழையவும்',
      guestName: 'உங்கள் பெயர் (பதிவுகளில் காட்டப்படும்)',
      guestPlaceholder: 'உங்கள் பெயரை உள்ளிடவும்...',
      guestIntro: 'அறிவிப்புகளைப் பார்க்க, புகார்களைச் சமர்ப்பிக்க, நிகழ்வுகளைப் பார்க்க மற்றும் சந்தையில் இடுகையிட குடிமக்களுக்கு கணக்கு தேவையில்லை.',
      loading: 'செயலாக்கப்படுகிறது...',
      pendingTitle: 'பதிவு கோரிக்கை ஒப்புதலுக்காக காத்திருக்கிறது',
      pendingText: 'பதிவு செய்ததற்கு நன்றி! உங்கள் அதிகாரி கணக்கு கோரிக்கை பஞ்சாயத்து நிர்வாகியிடம் சமர்ப்பிக்கப்பட்டுள்ளது. நிர்வாகி உங்கள் கோரிக்கையை பரிசீலித்து அனுமதித்தவுடன் நீங்கள் உள்நுழையலாம்.',
      goBack: 'மீண்டும் உள்நுழைவு பக்கம் செல்லவும்',
      noSupabase: 'குறிப்பு: தரவுத்தளம் லோக்கல் முறையில் இயங்குகிறது. நிகழ்நேர ஒத்திசைவு மற்றும் உண்மையான அங்கீகாரம் முடக்கப்பட்டுள்ளது. விருந்தினர் அணுகலைப் பயன்படுத்தலாம்.'
    }
  }[lang || 'en'];

  const handleLogin = async (e) => {
    e.preventDefault();
    if (loading) return;
    setErrorMsg(null);
    setMessage(null);

    if (!isSupabaseConfigured) {
      // Offline simulation fallback
      if (email === 'admin@village.com') {
        onLoginSuccess({ id: 'u6', name: 'President Murugan', role: 'admin', approval_status: 'approved' });
      } else if (email === 'officer@village.com') {
        onLoginSuccess({ id: 'u5', name: 'Subhash Chandra', role: 'officer', approval_status: 'approved' });
      } else {
        setErrorMsg('In offline mode, use "admin@village.com" or "officer@village.com" to login.');
      }
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Fetch user profile info
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileError) throw profileError;

      if (profile.role === 'officer' && profile.approval_status === 'pending') {
        // Show pending screen
        setPendingApprovalUser(profile);
        await supabase.auth.signOut(); // sign out session locally
      } else if (profile.approval_status === 'rejected') {
        setErrorMsg('Your registration request was rejected by the Admin.');
        await supabase.auth.signOut();
      } else {
        // Logged in successfully
        onLoginSuccess(profile);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (loading) return;
    setErrorMsg(null);
    setMessage(null);

    if (!isSupabaseConfigured) {
      setErrorMsg('Cannot register in offline/local database mode. Connect Supabase in .env.local to enable officer signup.');
      return;
    }

    setLoading(true);
    try {
      const skillsArray = skills.split(',').map(s => s.trim()).filter(Boolean);
      const volunteerArray = volunteer.split(',').map(v => v.trim()).filter(Boolean);

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            role: 'officer',
            address,
            phone,
            blood_group: bloodGroupSelect === 'Other' ? customBloodGroup.trim() : bloodGroupSelect,
            occupation,
            skills: skillsArray,
            volunteer: volunteerArray
          }
        }
      });

      if (error) throw error;

      setMessage(t.pendingText);
      setActiveTab('login');
      // Clear forms
      setEmail('');
      setPassword('');
      setName('');
      setPhone('');
      setAddress('');
      setOccupation('');
      setSkills('');
      setVolunteer('');
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestSubmit = (e) => {
    e.preventDefault();
    const guestName = name.trim() || 'Resident';
    onGuestLogin({
      id: 'guest_' + Math.random().toString(36).substr(2, 9),
      name: guestName,
      role: 'resident',
      phone: phone || ''
    });
  };

  if (pendingApprovalUser) {
    return (
      <div className={`login-page ${currentTheme === 'dark' ? 'dark-theme' : ''}`}>
        <div className="login-card pending-card">
          <Shield size={48} className="pending-icon" />
          <h2>{t.pendingTitle}</h2>
          <p className="pending-user-info">
            <strong>{pendingApprovalUser.name}</strong> ({pendingApprovalUser.email})
          </p>
          <p className="pending-description">{t.pendingText}</p>
          <button 
            className="btn btn-primary" 
            onClick={() => setPendingApprovalUser(null)}
          >
            {t.goBack}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`login-page ${currentTheme === 'dark' ? 'dark-theme' : ''}`}>
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">🌾</div>
          <h1>{t.title}</h1>
          <p>{t.subtitle}</p>
        </div>

        {!isSupabaseConfigured && (
          <div className="offline-warning">
            {t.noSupabase}
          </div>
        )}

        <div className="login-tabs">
          <button 
            className={`login-tab-btn ${activeTab === 'login' ? 'active' : ''}`}
            onClick={() => { setActiveTab('login'); setErrorMsg(null); setMessage(null); }}
          >
            {t.loginTab}
          </button>
          <button 
            className={`login-tab-btn ${activeTab === 'register' ? 'active' : ''}`}
            onClick={() => { setActiveTab('register'); setErrorMsg(null); setMessage(null); }}
          >
            {t.registerTab}
          </button>
          <button 
            className={`login-tab-btn ${activeTab === 'guest' ? 'active' : ''}`}
            onClick={() => { setActiveTab('guest'); setErrorMsg(null); setMessage(null); }}
          >
            {t.guestTab}
          </button>
        </div>

        {errorMsg && <div className="auth-error">{errorMsg}</div>}
        {message && <div className="auth-success">{message}</div>}

        {activeTab === 'login' && (
          <form onSubmit={handleLogin} className="auth-form">
            <div className="form-group">
              <label htmlFor="login-email">{t.email}</label>
              <div className="input-with-icon">
                <Mail size={16} />
                <input 
                  id="login-email"
                  type="email" 
                  required 
                  placeholder="name@village.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="login-pass">{t.password}</label>
              <div className="input-with-icon">
                <Lock size={16} />
                <input 
                  id="login-pass"
                  type="password" 
                  required 
                  placeholder="••••••••" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-auth">
              {loading ? t.loading : t.loginBtn} <ArrowRight size={16} />
            </button>
          </form>
        )}

        {activeTab === 'register' && (
          <form onSubmit={handleRegister} className="auth-form scrollable-form">
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="reg-name">{t.name} *</label>
                <div className="input-with-icon">
                  <User size={16} />
                  <input id="reg-name" type="text" required placeholder="Rajesh Kumar" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="reg-email">{t.email} *</label>
                <div className="input-with-icon">
                  <Mail size={16} />
                  <input id="reg-email" type="email" required placeholder="rajesh@village.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="reg-pass">{t.password} *</label>
                <div className="input-with-icon">
                  <Lock size={16} />
                  <input id="reg-pass" type="password" required placeholder="Min 6 characters" minLength="6" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="reg-phone">{t.phone}</label>
                <div className="input-with-icon">
                  <Phone size={16} />
                  <input id="reg-phone" type="tel" placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
              </div>

              <div className="form-group span-2">
                <label htmlFor="reg-address">{t.address}</label>
                <div className="input-with-icon">
                  <MapPin size={16} />
                  <input id="reg-address" type="text" placeholder="12 North Street" value={address} onChange={(e) => setAddress(e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="reg-bg">{t.bloodGroup}</label>
                <select 
                  id="reg-bg" 
                  value={bloodGroupSelect} 
                  onChange={(e) => setBloodGroupSelect(e.target.value)} 
                  className="auth-select"
                >
                  {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-', 'Other'].map(bg => (
                    <option key={bg} value={bg}>{bg === 'Other' ? (lang === 'en' ? 'Other' : 'மற்றவை') : bg}</option>
                  ))}
                </select>
              </div>

              {bloodGroupSelect === 'Other' && (
                <div className="form-group">
                  <label htmlFor="reg-bg-custom">{lang === 'en' ? 'Specify Blood Group' : 'இரத்த வகையைக் குறிப்பிடவும்'}</label>
                  <input 
                    id="reg-bg-custom" 
                    type="text" 
                    placeholder="e.g. Bombay Blood" 
                    value={customBloodGroup} 
                    onChange={(e) => setCustomBloodGroup(e.target.value)} 
                    className="auth-input-raw"
                    required
                  />
                </div>
              )}

              <div className="form-group">
                <label htmlFor="reg-occ">{t.occupation}</label>
                <input id="reg-occ" type="text" placeholder="Farmer / Electrician" value={occupation} onChange={(e) => setOccupation(e.target.value)} className="auth-input-raw" />
              </div>

              <div className="form-group span-2">
                <label htmlFor="reg-skills">{t.skills}</label>
                <input id="reg-skills" type="text" placeholder="Farming, Tractor driving" value={skills} onChange={(e) => setSkills(e.target.value)} className="auth-input-raw" />
              </div>

              <div className="form-group span-2">
                <label htmlFor="reg-vol">{t.volunteer}</label>
                <input id="reg-vol" type="text" placeholder="Emergency help, Public repairs" value={volunteer} onChange={(e) => setVolunteer(e.target.value)} className="auth-input-raw" />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-auth">
              {loading ? t.loading : t.registerBtn}
            </button>
          </form>
        )}

        {activeTab === 'guest' && (
          <form onSubmit={handleGuestSubmit} className="auth-form">
            <p className="guest-info-text">{t.guestIntro}</p>
            
            <div className="form-group">
              <label htmlFor="guest-name">{t.guestName} *</label>
              <div className="input-with-icon">
                <User size={16} />
                <input 
                  id="guest-name"
                  type="text" 
                  required 
                  placeholder={t.guestPlaceholder} 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="guest-phone">{t.phone} ({lang === 'ta' ? 'விருப்பத்திற்குரியது' : 'Optional'})</label>
              <div className="input-with-icon">
                <Phone size={16} />
                <input 
                  id="guest-phone"
                  type="tel" 
                  placeholder="+91 XXXXX XXXXX" 
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>

            <button type="submit" className="btn-auth">
              {t.guestBtn} <ArrowRight size={16} />
            </button>
          </form>
        )}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .login-page {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background-color: var(--bg-app);
          padding: 20px;
          transition: background-color 0.3s ease;
        }
        .login-card {
          width: 100%;
          max-width: 500px;
          background-color: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 30px;
          box-shadow: var(--shadow-lg);
          transition: background-color 0.3s ease, border-color 0.3s ease;
        }
        .login-header {
          text-align: center;
          margin-bottom: 24px;
        }
        .login-logo {
          font-size: 3rem;
          margin-bottom: 8px;
        }
        .login-header h1 {
          font-family: var(--font-heading);
          font-size: 1.75rem;
          color: var(--primary);
          margin-bottom: 4px;
        }
        .login-header p {
          color: var(--text-muted);
          font-size: 0.95rem;
        }
        .offline-warning {
          background-color: var(--accent-light);
          border: 1px solid var(--accent);
          color: var(--accent-hover);
          padding: 12px;
          border-radius: var(--radius-md);
          font-size: 0.85rem;
          margin-bottom: 20px;
          line-height: 1.4;
        }
        .login-tabs {
          display: flex;
          border-bottom: 1px solid var(--border);
          margin-bottom: 24px;
        }
        .login-tab-btn {
          flex: 1;
          padding: 12px 8px;
          background: none;
          border: none;
          font-family: var(--font-heading);
          font-weight: 600;
          font-size: 0.9rem;
          color: var(--text-muted);
          cursor: pointer;
          transition: var(--transition);
          border-bottom: 2px solid transparent;
          text-align: center;
        }
        .login-tab-btn:hover {
          color: var(--primary);
        }
        .login-tab-btn.active {
          color: var(--primary);
          border-bottom-color: var(--primary);
        }
        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .scrollable-form {
          max-height: 400px;
          overflow-y: auto;
          padding-right: 8px;
        }
        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .span-2 {
          grid-column: span 2;
        }
        .form-group label {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-main);
        }
        .input-with-icon {
          position: relative;
          display: flex;
          align-items: center;
        }
        .input-with-icon svg {
          position: absolute;
          left: 12px;
          color: var(--text-muted);
        }
        .input-with-icon input {
          width: 100%;
          padding: 10px 12px 10px 38px;
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          font-family: var(--font-body);
          font-size: 0.95rem;
          background-color: var(--bg-app);
          color: var(--text-main);
          outline: none;
          transition: var(--transition);
        }
        .input-with-icon input:focus {
          border-color: var(--primary);
          box-shadow: 0 0 0 2px var(--primary-light);
        }
        .auth-input-raw {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          font-family: var(--font-body);
          font-size: 0.95rem;
          background-color: var(--bg-app);
          color: var(--text-main);
          outline: none;
          transition: var(--transition);
        }
        .auth-input-raw:focus {
          border-color: var(--primary);
          box-shadow: 0 0 0 2px var(--primary-light);
        }
        .auth-select {
          padding: 10px 12px;
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          font-family: var(--font-body);
          font-size: 0.95rem;
          background-color: var(--bg-app);
          color: var(--text-main);
          outline: none;
        }
        .btn-auth {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px;
          background-color: var(--primary);
          color: var(--text-white);
          border: none;
          border-radius: var(--radius-sm);
          font-family: var(--font-heading);
          font-weight: 600;
          font-size: 1rem;
          cursor: pointer;
          transition: var(--transition);
          margin-top: 8px;
        }
        .btn-auth:hover {
          background-color: var(--primary-hover);
        }
        .btn-auth:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .auth-error {
          background-color: var(--danger-light);
          border: 1px solid var(--danger);
          color: var(--danger);
          padding: 10px;
          border-radius: var(--radius-sm);
          font-size: 0.9rem;
          margin-bottom: 16px;
        }
        .auth-success {
          background-color: var(--success-light);
          border: 1px solid var(--success);
          color: var(--success);
          padding: 10px;
          border-radius: var(--radius-sm);
          font-size: 0.9rem;
          margin-bottom: 16px;
        }
        .guest-info-text {
          font-size: 0.9rem;
          color: var(--text-muted);
          margin-bottom: 8px;
          line-height: 1.4;
        }
        .pending-card {
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }
        .pending-icon {
          color: var(--accent);
          animation: pulse 2s infinite;
        }
        .pending-user-info {
          font-size: 0.95rem;
          color: var(--text-main);
          background-color: var(--primary-light);
          padding: 8px 16px;
          border-radius: var(--radius-sm);
        }
        .pending-description {
          color: var(--text-muted);
          font-size: 0.95rem;
          line-height: 1.5;
        }
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
        @media (max-width: 480px) {
          .login-card {
            padding: 20px;
          }
          .login-tabs {
            flex-direction: column;
            gap: 6px;
            border-bottom: none;
            margin-bottom: 16px;
          }
          .login-tab-btn {
            border-bottom: none;
            border-radius: var(--radius-sm);
            background-color: var(--primary-light);
            padding: 10px;
            font-size: 0.85rem;
          }
          .login-tab-btn.active {
            background-color: var(--primary);
            color: var(--text-white);
          }
          .form-grid {
            grid-template-columns: 1fr;
            gap: 12px;
          }
          .span-2 {
            grid-column: span 1;
          }
        }
      `}} />
    </div>
  );
}
