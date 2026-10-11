import React, { useState, useRef, useEffect } from 'react';
import Dexie from 'dexie';

const db = new Dexie('AliGeminiPerfectDB');
db.version(1).stores({
  conversations: '++id, title, updatedAt',
  messages: '++id, chatId, role, content, timestamp',
  files: '++id, chatId, path, content'
});

export default function App() {
  const [conversations, setConversations] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeView, setActiveView] = useState('chat'); // 'chat' | 'code' | 'preview'
  
  const [files, setFiles] = useState([
    { path: 'src/App.jsx', content: '// Code généré par l\'agent\nexport default function App() {\n  return (\n    <div style={{ padding: "30px", color: "#fff", background: "#000", height: "100vh" }}>\n      <h1>Aperçu de l\'application</h1>\n    </div>\n  );\n}' }
  ]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    async function initApp() {
      let chats = await db.conversations.toArray();
      if (chats.length === 0) {
        const defaultChatId = await db.conversations.add({ title: 'Nouvelle discussion', updatedAt: Date.now() });
        chats = [{ id: defaultChatId, title: 'Nouvelle discussion', updatedAt: Date.now() }];
        await db.messages.add({
          chatId: defaultChatId,
          role: 'assistant',
          content: "Salut ! Comment ça va aujourd'hui ? Tu as un nouveau projet de code en tête ou on discute de quoi ?",
          timestamp: Date.now()
        });
      }
      setConversations(chats);
      setCurrentChatId(chats[0].id);
      loadChatData(chats[0].id);
    }
    initApp();
  }, []);

  const loadChatData = async (chatId) => {
    const chatMessages = await db.messages.where('chatId').equals(chatId).toArray();
    setMessages(chatMessages);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading || !currentChatId) return;

    const userPrompt = input.trim();
    setInput('');
    const userMsg = { chatId: currentChatId, role: 'user', content: userPrompt, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    await db.messages.add(userMsg);
    
    setLoading(true);

    try {
      const res = await fetch(`https://text.pollinations.ai/${encodeURIComponent(userPrompt)}`);
      const textResult = await res.text();

      if (textResult.includes('```')) {
        const match = textResult.match(/```[\s\S]*?\n([\s\S]*?)```/);
        if (match && match[1]) {
          setFiles([{ path: 'src/App.jsx', content: match[1] }]);
        }
      }

      const assistantMsg = { chatId: currentChatId, role: 'assistant', content: textResult, timestamp: Date.now() };
      setMessages(prev => [...prev, assistantMsg]);
      await db.messages.add(assistantMsg);
    } catch (err) {
      setMessages(prev => [...prev, { chatId: currentChatId, role: 'assistant', content: "Une erreur est survenue.", timestamp: Date.now() }]);
    } finally {
      setLoading(false);
    }
  };

  const currentAppCode = files.find(f => f.path === 'src/App.jsx')?.content || '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#000000', color: '#e3e3e3', fontFamily: 'system-ui, -apple-system, sans-serif', overflow: 'hidden' }}>
      
      {/* Menu Latéral Coulissant (Drawer) */}
      {sidebarOpen && <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 30 }}></div>}
      
      <div style={{ 
        width: '280px', backgroundColor: '#121212', borderRight: '1px solid #282828', display: 'flex', flexDirection: 'column', padding: '1.25rem',
        position: 'fixed', top: 0, bottom: 0, left: sidebarOpen ? 0 : '-280px', transition: 'left 0.3s ease', zIndex: 40 
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <span style={{ fontSize: '0.95rem', fontWeight: '500', color: '#fff' }}>Conversations</span>
          <button onClick={() => setSidebarOpen(false)} style={{ background: 'none', border: 'none', color: '#aaa', fontSize: '1.2rem', cursor: 'pointer' }}>×</button>
        </div>

        <button onClick={async () => {
          const newId = await db.conversations.add({ title: 'Nouvelle discussion', updatedAt: Date.now() });
          setConversations(prev => [{ id: newId, title: 'Nouvelle discussion', updatedAt: Date.now() }, ...prev]);
          setCurrentChatId(newId);
          setMessages([{ chatId: newId, role: 'assistant', content: "Salut ! De quoi souhaite-tu parler ?", timestamp: Date.now() }]);
          setSidebarOpen(false);
        }} style={{ backgroundColor: '#ffffff', color: '#000', border: 'none', padding: '0.75rem', fontWeight: '600', borderRadius: '24px', cursor: 'pointer', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
          + Nouveau chat
        </button>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          {conversations.map(chat => (
            <div key={chat.id} onClick={() => { setCurrentChatId(chat.id); loadChatData(chat.id); setActiveView('chat'); setSidebarOpen(false); }}
              style={{ padding: '0.65rem 0.85rem', borderRadius: '12px', backgroundColor: currentChatId === chat.id ? '#2a2a2c' : 'transparent', color: currentChatId === chat.id ? '#fff' : '#b3b3b3', cursor: 'pointer', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {chat.title}
            </div>
          ))}
        </div>
      </div>

      {/* En-tête supérieur épuré */}
      <header style={{ padding: '0.75rem 1.25rem', backgroundColor: '#000000', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => setSidebarOpen(true)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer', padding: 0 }}>☰</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '1rem', fontWeight: '500', color: '#fff' }}>
            <span>Gemini Auto</span>
            <span style={{ fontSize: '0.7rem', color: '#888' }}>▼</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <button onClick={() => setActiveView('chat')} style={{ background: activeView === 'chat' ? '#262626' : 'transparent', color: activeView === 'chat' ? '#fff' : '#aaa', border: 'none', padding: '6px 12px', borderRadius: '16px', fontSize: '0.8rem', cursor: 'pointer' }}>Chat</button>
          <button onClick={() => setActiveView('code')} style={{ background: activeView === 'code' ? '#262626' : 'transparent', color: activeView === 'code' ? '#fff' : '#aaa', border: 'none', padding: '6px 12px', borderRadius: '16px', fontSize: '0.8rem', cursor: 'pointer' }}>Code</button>
          <button onClick={() => setActiveView('preview')} style={{ background: activeView === 'preview' ? '#262626' : 'transparent', color: activeView === 'preview' ? '#fff' : '#aaa', border: 'none', padding: '6px 12px', borderRadius: '16px', fontSize: '0.8rem', cursor: 'pointer' }}>Aperçu</button>
        </div>
      </header>

      {/* Contenu de la vue active */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: '#000000' }}>
        
        {activeView === 'code' ? (
          <div style={{ display: 'flex', flexDirection: 'column', padding: '1.25rem', flex: 1, backgroundColor: '#0a0a0a' }}>
            <h3 style={{ fontSize: '0.85rem', color: '#8ab4f8', marginBottom: '0.75rem', fontWeight: '500' }}>Éditeur Source (App.jsx)</h3>
            <textarea value={currentAppCode} onChange={(e) => setFiles([{ path: 'src/App.jsx', content: e.target.value }])}
              style={{ flex: 1, backgroundColor: '#000', color: '#8ab4f8', border: '1px solid #222', borderRadius: '12px', padding: '1rem', fontFamily: 'monospace', fontSize: '0.85rem', outline: 'none', resize: 'none' }}
            />
          </div>
        ) : activeView === 'preview' ? (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, backgroundColor: '#fff' }}>
            <iframe sandbox="allow-scripts" srcDoc={`<!DOCTYPE html><html><head><script src="[https://unpkg.com/react@18/umd/react.development.js](https://unpkg.com/react@18/umd/react.development.js)"></script><script src="[https://unpkg.com/react-dom@18/umd/react-dom.development.js](https://unpkg.com/react-dom@18/umd/react-dom.development.js)"></script><script src="[https://unpkg.com/@babel/standalone/babel.min.js](https://unpkg.com/@babel/standalone/babel.min.js)"></script></head><body style="margin:0; background:#0f172a; color:#fff;"><div id="root"></div><script type="text/babel">${currentAppCode}</script></body></html>`}
              style={{ flex: 1, border: 'none', width: '100%', height: '100%' }} title="Preview"
            />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', position: 'relative' }}>
            
            {/* Zone de discussion */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '750px', width: '100%', margin: '0 auto' }}>
              {messages.map((msg, idx) => (
                <div key={idx} style={{ 
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '90%',
                  color: '#e3e3e3',
                  lineHeight: '1.6',
                  fontSize: '0.95rem'
                }}>
                  {msg.role === 'user' ? (
                    <div style={{ backgroundColor: '#2b2b2d', padding: '0.8rem 1.25rem', borderRadius: '24px', color: '#fff' }}>
                      {msg.content}
                    </div>
                  ) : (
                    <div>
                      <div style={{ whiteSpace: 'pre-wrap', marginBottom: '0.75rem' }}>{msg.content}</div>
                      {/* Icônes d'action sous les réponses de l'IA (Copier, Pouce, Audio) */}
                      <div style={{ display: 'flex', gap: '1.25rem', color: '#8e8e93', fontSize: '1rem', marginTop: '0.5rem', alignItems: 'center' }}>
                        <button onClick={() => navigator.clipboard.writeText(msg.content)} style={{ background: 'none', border: 'none', color: '#8e8e93', cursor: 'pointer', padding: 0 }} title="Copier">📋</button>
                        <button onClick={() => {
                          if ('speechSynthesis' in window) {
                            window.speechSynthesis.cancel();
                            window.speechSynthesis.speak(new SpeechSynthesisUtterance(msg.content));
                          }
                        }} style={{ background: 'none', border: 'none', color: '#8e8e93', cursor: 'pointer', padding: 0 }} title="Écouter">🔊</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {loading && <div style={{ alignSelf: 'flex-start', color: '#8e8e93', fontSize: '0.9rem' }}>Réflexion...</div>}
              <div ref={chatEndRef} />
            </div>

            {/* Note de bas de page */}
            <div style={{ textAlign: 'center', fontSize: '0.7rem', color: '#777', paddingBottom: '0.4rem' }}>
              Gemini est une IA et peut se tromper.
            </div>

            {/* Barre de saisie inférieure en pilule exacte */}
            <div style={{ padding: '0.5rem 1rem 1.25rem 1rem', backgroundColor: '#000000', display: 'flex', justifyContent: 'center' }}>
              <form onSubmit={handleSubmit} style={{ 
                display: 'flex', alignItems: 'center', gap: '0.75rem', backgroundColor: '#1e1e1f', borderRadius: '35px', padding: '0.4rem 0.6rem 0.4rem 1.25rem', maxWidth: '700px', width: '100%', border: '1px solid #2c2c2e'
              }}>
                <span style={{ color: '#aaa', fontSize: '1.3rem', cursor: 'pointer', lineHeight: '1' }}>+</span>
                <input type="text" value={input} onChange={e => setInput(e.target.value)} placeholder="Demandez..." style={{ flex: 1, backgroundColor: 'transparent', border: 'none', color: 'white', outline: 'none', fontSize: '0.95rem' }} />
                <button type="submit" disabled={loading} style={{ backgroundColor: '#8ab4f8', color: '#000', border: 'none', width: '38px', height: '38px', borderRadius: '50%', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  ↑
                </button>
              </form>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
