import React, { useState, useEffect, useRef } from 'react';
import { Send, Smile, Paperclip, CheckCheck, SmilePlus, Image as ImageIcon } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../utils/supabaseClient';

export default function RealTimeChat({ 
  currentUser, 
  chats, 
  setChats, 
  addNotification 
}) {
  const [activeChatId, setActiveChatId] = useState('village_square');
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showAdminSettings, setShowAdminSettings] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Parse chat settings from database or localstorage
  const isFlatChats = Array.isArray(chats) && chats.length > 0 && typeof chats[0].sender_name !== 'undefined';
  const settingsMsg = isFlatChats ? chats.find(msg => msg.sender_name === 'system_settings') : null;
  
  let chatSettings = { allow_residents: true, allow_officers: true, restricted_users: [] };
  if (settingsMsg) {
    try {
      chatSettings = JSON.parse(settingsMsg.text);
    } catch (e) {}
  } else {
    const saved = localStorage.getItem('vc_chat_settings');
    if (saved) {
      try {
        chatSettings = JSON.parse(saved);
      } catch (e) {}
    }
  }

  const isUserRestricted = chatSettings.restricted_users.includes(currentUser.name);
  const isRoleRestricted = 
    (currentUser.role === 'resident' && !chatSettings.allow_residents) ||
    (currentUser.role === 'officer' && !chatSettings.allow_officers);
  const canChat = currentUser.role === 'admin' || (!isUserRestricted && !isRoleRestricted);

  // Build the active chat depending on offline/online mode
  let activeChat = null;
  let chatList = [];

  if (isSupabaseConfigured) {
    // Online mode: Unified Group Chat Room (Village Square Chat)
    activeChat = {
      id: 'village_square',
      partnerName: 'Village Square Chat',
      partnerAvatar: '🌾',
      partnerRole: 'public square',
      status: 'online',
      messages: chats
        .filter(msg => msg.sender_name !== 'system_settings')
        .map(msg => ({
          id: msg.id,
          senderId: msg.sender_name === currentUser.name ? 'current' : msg.sender_name,
          senderName: msg.sender_name,
          senderRole: msg.sender_role,
          text: msg.text,
          timestamp: msg.timestamp
        }))
    };
    chatList = [activeChat];
  } else {
    // Offline mode: standard sidebar of private threads
    activeChat = chats.find(c => c.id === activeChatId) || chats[0];
    chatList = chats;
  }

  useEffect(() => {
    scrollToBottom();
  }, [activeChat?.messages, isTyping]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from('chats').insert({
          sender_name: currentUser.name,
          sender_role: currentUser.role,
          text: inputText
        });

        if (error) throw error;
        setInputText('');
      } catch (err) {
        console.error(err);
        addNotification('Error', 'Failed to send message to database.', 'danger');
      }
    } else {
      // Offline fallback simulation
      const newMessage = {
        id: `m_${Date.now()}`,
        senderId: 'current',
        text: inputText,
        timestamp: new Date().toISOString(),
        status: 'read'
      };

      const updatedChats = chats.map(chat => {
        if (chat.id !== activeChatId) return chat;
        return {
          ...chat,
          messages: [...chat.messages, newMessage]
        };
      });

      setChats(updatedChats);
      setInputText('');

      // Trigger simulated reply from BDO/President
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        
        let replyText = "Thank you for the message. I will review this immediately.";
        if (activeChat.partnerRole === 'officer') {
          replyText = `Understood. I am on the field right now coordinating the maintenance. I have received your update.`;
        } else if (activeChat.partnerRole === 'admin') {
          replyText = `Hello. Your note has been noted. We will address this in the upcoming Gram Sabha council briefing.`;
        }

        const botReply = {
          id: `m_reply_${Date.now()}`,
          senderId: activeChat.partnerId,
          text: replyText,
          timestamp: new Date().toISOString(),
          status: 'read'
        };

        setChats(prevChats => prevChats.map(chat => {
          if (chat.id !== activeChatId) return chat;
          return {
            ...chat,
            messages: [...chat.messages, botReply]
          };
        }));

        addNotification('New Message', `Message from ${activeChat.partnerName}`, 'info');
      }, 2500);
    }
  };

  const handleAddEmoji = (emoji) => {
    setInputText(prev => prev + emoji);
  };

  const handleAttachMedia = () => {
    setInputText(prev => prev + ' 📸 [Attached Photo] ');
    addNotification('File Attached', 'Mock image attached successfully.', 'info');
  };

  const saveSettings = async (newSettings) => {
    if (isSupabaseConfigured) {
      try {
        // Delete old settings if any
        await supabase.from('chats').delete().eq('sender_name', 'system_settings');
        // Insert new settings message
        const { error } = await supabase.from('chats').insert({
          sender_name: 'system_settings',
          sender_role: 'system',
          text: JSON.stringify(newSettings)
        });
        if (error) throw error;
      } catch (err) {
        console.error('Error saving chat settings:', err);
      }
    } else {
      localStorage.setItem('vc_chat_settings', JSON.stringify(newSettings));
      setChats(prev => [...prev.filter(m => m.sender_name !== 'system_settings'), {
        id: `sys_${Date.now()}`,
        sender_name: 'system_settings',
        sender_role: 'system',
        text: JSON.stringify(newSettings),
        timestamp: new Date().toISOString()
      }]);
    }
  };

  const handleClearChat = async () => {
    if (window.confirm('Are you sure you want to clear the entire chat history? This cannot be undone.')) {
      if (isSupabaseConfigured) {
        try {
          const { error } = await supabase
            .from('chats')
            .delete()
            .neq('sender_name', 'system_settings');
          
          if (error) throw error;
          setChats(prev => prev.filter(m => m.sender_name === 'system_settings'));
          addNotification('Chat Cleared', 'All messages have been deleted by Admin.', 'success');
        } catch (err) {
          console.error('Error clearing chat:', err);
          addNotification('Error', 'Failed to clear chat.', 'danger');
        }
      } else {
        setChats(prev => prev.filter(m => m.sender_name === 'system_settings'));
        addNotification('Chat Cleared', 'Local chat history cleared.', 'success');
      }
    }
  };

  const handleDeleteMessage = async (msgId) => {
    if (window.confirm('Delete this message?')) {
      if (isSupabaseConfigured) {
        try {
          const { error } = await supabase
            .from('chats')
            .delete()
            .eq('id', msgId);
          if (error) throw error;
          
          setChats(prev => prev.filter(m => m.id !== msgId));
          addNotification('Success', 'Message deleted.', 'success');
        } catch (err) {
          console.error(err);
        }
      } else {
        // Flat chats (online mock) or thread fallback
        if (isFlatChats) {
          setChats(prev => prev.filter(m => m.id !== msgId));
        } else {
          setChats(prev => prev.map(chat => {
            if (chat.id !== activeChatId) return chat;
            return {
              ...chat,
              messages: chat.messages.filter(m => m.id !== msgId)
            };
          }));
        }
        addNotification('Success', 'Message deleted.', 'success');
      }
    }
  };

  const handleToggleRestrictUser = (username) => {
    const isRestricted = chatSettings.restricted_users.includes(username);
    let updatedUsers = [];
    if (isRestricted) {
      updatedUsers = chatSettings.restricted_users.filter(u => u !== username);
      addNotification('User Unrestricted', `${username} can now send messages.`, 'success');
    } else {
      updatedUsers = [...chatSettings.restricted_users, username];
      addNotification('User Restricted', `${username} is blocked from sending messages.`, 'warning');
    }
    
    saveSettings({
      ...chatSettings,
      restricted_users: updatedUsers
    });
  };

  const formatMessageTime = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  let inputPlaceholder = "Post message in Village Square...";
  if (isUserRestricted) {
    inputPlaceholder = "🚫 Restricted by Admin from texting.";
  } else if (isRoleRestricted) {
    inputPlaceholder = "🚫 Chat disabled for your role by Admin.";
  }

  return (
    <div className="chat-layout card" style={{ display: 'flex', height: '550px', padding: 0, overflow: 'hidden' }}>
      
      {/* Chats Sidebar */}
      <div className="chat-sidebar">
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: '0.9rem' }}>
          {isSupabaseConfigured ? 'Channels' : 'Conversations'}
        </div>
        <div style={{ flexGrow: 1, overflowY: 'auto' }}>
          {chatList.map(chat => (
            <div 
              key={chat.id}
              onClick={() => !isSupabaseConfigured && setActiveChatId(chat.id)}
              style={{
                padding: '12px 16px',
                cursor: isSupabaseConfigured ? 'default' : 'pointer',
                borderBottom: '1px solid var(--border)',
                backgroundColor: chat.id === activeChatId || isSupabaseConfigured ? 'var(--bg-card)' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                transition: 'var(--transition)'
              }}
            >
              <div className="user-avatar" style={{ fontSize: '1.25rem', width: '32px', height: '32px' }}>
                {chat.partnerAvatar}
              </div>
              <div style={{ flexGrow: 1, minWidth: 0 }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {chat.partnerName}
                </h4>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                  {chat.partnerRole}
                </p>
              </div>
              <span style={{ 
                width: '8px', 
                height: '8px', 
                borderRadius: '50%', 
                backgroundColor: chat.status === 'online' ? 'var(--success)' : 'var(--text-muted)' 
              }} />
            </div>
          ))}
        </div>
      </div>

      {/* Messages Pane */}
      <div className="chat-pane">
        
        {/* Chat Partner Header */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="user-avatar" style={{ fontSize: '1.25rem', width: '32px', height: '32px' }}>
              {activeChat?.partnerAvatar}
            </div>
            <div>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 600 }}>{activeChat?.partnerName}</h4>
              <span style={{ fontSize: '0.7rem', color: activeChat?.status === 'online' ? 'var(--success)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                {activeChat?.status === 'online' ? 'Active now' : 'Offline'}
              </span>
            </div>
          </div>
          
          {/* Admin Header Controls */}
          {currentUser.role === 'admin' && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                type="button"
                className="role-btn"
                onClick={() => setShowAdminSettings(prev => !prev)}
                style={{ padding: '4px 8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                ⚙️ Settings
              </button>
              <button 
                type="button"
                className="role-btn"
                onClick={handleClearChat}
                style={{ padding: '4px 8px', fontSize: '0.8rem', color: 'var(--danger)', borderColor: 'rgba(231,111,81,0.3)' }}
              >
                🗑️ Clear Chat
              </button>
            </div>
          )}
        </div>

        {/* Admin Settings Sub-Panel */}
        {(currentUser.role === 'admin' && showAdminSettings) && (
          <div style={{
            padding: '12px 20px',
            backgroundColor: 'var(--primary-light)',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            fontSize: '0.85rem'
          }}>
            <h5 style={{ fontWeight: 600, color: 'var(--primary)', marginBottom: '2px' }}>Panchayat Chat Controls (Admin)</h5>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 500 }}>
                <input 
                  type="checkbox" 
                  checked={chatSettings.allow_residents} 
                  onChange={(e) => saveSettings({ ...chatSettings, allow_residents: e.target.checked })}
                />
                Allow Residents to text
              </label>
              
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 500 }}>
                <input 
                  type="checkbox" 
                  checked={chatSettings.allow_officers} 
                  onChange={(e) => saveSettings({ ...chatSettings, allow_officers: e.target.checked })}
                />
                Allow Panchayat Officers to text
              </label>
            </div>

            {chatSettings.restricted_users.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', marginTop: '4px' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Restricted:</span>
                {chatSettings.restricted_users.map(username => (
                  <span 
                    key={username}
                    style={{ 
                      backgroundColor: 'rgba(231, 111, 81, 0.15)', 
                      color: 'var(--danger)', 
                      padding: '2px 8px', 
                      borderRadius: '12px', 
                      fontSize: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {username}
                    <button 
                      type="button" 
                      onClick={() => handleToggleRestrictUser(username)}
                      style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontWeight: 'bold', padding: 0 }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Message History */}
        <div style={{ flexGrow: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {activeChat?.messages.map(msg => {
            const isMe = msg.senderId === 'current';
            return (
              <div 
                key={msg.id}
                style={{
                  alignSelf: isMe ? 'flex-end' : 'flex-start',
                  maxWidth: '75%',
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'center',
                  flexDirection: isMe ? 'row-reverse' : 'row'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                  {/* Display sender info if group chat / offline message */}
                  {!isMe && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary)', textTransform: 'capitalize' }}>
                        {msg.senderName} ({msg.senderRole})
                      </span>
                      
                      {/* Admin restrict button */}
                      {currentUser.role === 'admin' && msg.senderRole !== 'admin' && (
                        <button
                          type="button"
                          onClick={() => handleToggleRestrictUser(msg.senderName)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: chatSettings.restricted_users.includes(msg.senderName) ? 'var(--success)' : 'var(--danger)',
                            fontSize: '0.65rem',
                            cursor: 'pointer',
                            padding: '0 4px',
                            textDecoration: 'underline',
                            fontWeight: 600
                          }}
                        >
                          {chatSettings.restricted_users.includes(msg.senderName) ? 'Unrestrict' : 'Restrict'}
                        </button>
                      )}
                    </div>
                  )}
                  
                  <div style={{
                    padding: '10px 14px',
                    borderRadius: '12px',
                    borderTopRightRadius: isMe ? '2px' : '12px',
                    borderTopLeftRadius: isMe ? '12px' : '2px',
                    backgroundColor: isMe ? 'var(--primary)' : 'var(--primary-light)',
                    color: isMe ? 'var(--text-white)' : 'var(--text-main)',
                    fontSize: '0.9rem',
                    lineHeight: '1.4'
                  }}>
                    {msg.text}
                  </div>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                    {formatMessageTime(msg.timestamp)} {isMe && <CheckCheck size={10} style={{ color: 'var(--success)' }} />}
                  </span>
                </div>

                {/* Delete message icon for Admin */}
                {currentUser.role === 'admin' && (
                  <button
                    type="button"
                    onClick={() => handleDeleteMessage(msg.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      opacity: 0.5,
                      transition: 'opacity 0.2s',
                      padding: '4px',
                      alignSelf: 'center'
                    }}
                    title="Delete Message"
                  >
                    🗑️
                  </button>
                )}
              </div>
            );
          })}

          {/* Typing Indicator */}
          {isTyping && (
            <div style={{ alignSelf: 'flex-start', padding: '10px 14px', borderRadius: '12px', borderTopLeftRadius: '2px', backgroundColor: 'var(--primary-light)', fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', gap: '4px', alignItems: 'center' }}>
              <span className="dot" style={{ animationDelay: '0s' }}>●</span>
              <span className="dot" style={{ animationDelay: '0.2s' }}>●</span>
              <span className="dot" style={{ animationDelay: '0.4s' }}>●</span>
              <span>{activeChat.partnerName} is typing...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSendMessage} style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button 
            type="button" 
            className="theme-toggle" 
            onClick={handleAttachMedia}
            style={{ padding: '6px' }}
            title="Attach Mock Image"
            disabled={!canChat}
          >
            <Paperclip size={18} />
          </button>
          
          <input
            type="text"
            className="form-input"
            placeholder={!canChat ? inputPlaceholder : (isSupabaseConfigured ? "Post message in Village Square..." : "Type your message here...")}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={!canChat}
            dir="ltr"
            autoComplete="off"
            autoCorrect="off"
            style={{ flexGrow: 1, fontSize: '0.9rem' }}
          />

          <div className="chat-emoji-shortcuts">
            {['👍', '🙏', '❤️'].map(emoji => (
              <button 
                key={emoji}
                type="button" 
                className="role-btn" 
                onClick={() => handleAddEmoji(emoji)}
                style={{ padding: '4px 6px', fontSize: '0.9rem' }}
                disabled={!canChat}
              >
                {emoji}
              </button>
            ))}
          </div>

          <button 
            type="submit" 
            className="btn btn-primary"
            style={{ padding: '8px 14px', borderRadius: '6px' }}
            disabled={!canChat || !inputText.trim()}
          >
            <Send size={16} />
          </button>
        </form>

      </div>
      
      {/* Inline styles for typing animation */}
      <style dangerouslySetInnerHTML={{__html: `
        .dot {
          animation: blink 1.4s infinite both;
          font-size: 0.6rem;
        }
        @keyframes blink {
          0% { opacity: .2; }
          20% { opacity: 1; }
          100% { opacity: .2; }
        }
      `}} />

    </div>
  );
}
