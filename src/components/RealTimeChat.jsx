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
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

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
      messages: chats.map(msg => ({
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

  const formatMessageTime = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

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
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
        </div>

        {/* Message History */}
        <div style={{ flexGrow: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {activeChat?.messages.map(msg => {
            const isMe = msg.senderId === 'current';
            return (
              <div 
                key={msg.id}
                style={{
                  alignSelf: isMe ? 'flex-end' : 'flex-start',
                  maxWidth: '70%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isMe ? 'flex-end' : 'flex-start'
                }}
              >
                {/* Display sender info if group chat */}
                {(!isMe && isSupabaseConfigured) && (
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '2px', textTransform: 'capitalize' }}>
                    {msg.senderName} ({msg.senderRole})
                  </span>
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
          >
            <Paperclip size={18} />
          </button>
          
          <input
            type="text"
            className="form-input"
            placeholder={isSupabaseConfigured ? "Post message in Village Square..." : "Type your message here..."}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
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
              >
                {emoji}
              </button>
            ))}
          </div>

          <button 
            type="submit" 
            className="btn btn-primary"
            style={{ padding: '8px 14px', borderRadius: '6px' }}
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
