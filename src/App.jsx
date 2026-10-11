import React, { useState, useRef, useEffect } from 'react';
import Dexie from 'dexie';

const db = new Dexie('AliAgentDB');
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
  const [activeView, setActiveView] = useState('chat');
  const [files, setFiles] = useState([
    { path: 'src/App.jsx', content: '// Code généré par Ali\n' }
  ]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const chatEndRef = useRef(null);
  const [copiedIdx, setCopiedIdx] = useState(null);

  useEffect(() => {
    async function initApp() {
      let chats = await db.conversations.toArray();
      if (chats.length === 0) {
        const defaultChatId = await db.conversations.add({ title: 'Nouvelle discussion', updatedAt: Date.now() });
        chats = [{ id: defaultChatId, title: 'Nouvelle discussion', updatedAt: Date.now() }];
        await db.messages.add({
          chatId: defaultChatId,
          role: 'assistant',
          content: "Salut! Comment ça va aujourd'hui? Tu as un nouveau projet de code en tête ou on discute de quoi?",
          timestamp: Date.now()
        });
      }
      setConversations(chats.sort((a,b) => b.updatedAt - a.updatedAt));
      setCurrentChatId(chats[0].id);
      loadChatData(chats[0].id);
    }
    initApp();
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  const loadChatData = async (chatId) => {
    const chatMessages = await db.messages.where('chatId').equals(chatId).sortBy('timestamp');
    setMessages(chatMessages);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading ||!currentChatId) return;
    const userPrompt = input.trim();
    setInput('');
    const userMsg = { chatId: currentChatId, role: 'user', content: userPrompt, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    await db.messages.add(userMsg);
    await db.conversations.update(currentChatId, { updatedAt: Date.now(), title: userPrompt.slice(0, 40) });
    setLoading(true);

    try {
      const res = await fetch(`https://text.pollinations.ai/${encodeURIComponent(userPrompt)}?model=openai`);
      const textResult = await res.text();
      if (textResult.includes('```')) {
        const match = textResult.match(/```(?:jsx?|tsx?|javascript)?\n([\s\S]*?)```/);
        if (match && match[1]) setFiles([{ path: 'src/App.jsx', content: match[1] }]);
      }
      const assistantMsg = { chatId: currentChatId, role: 'assistant', content: textResult, timestamp: Date.now() };
      setMessages(prev => [...prev, assistantMsg]);
      await db.messages.add(assistantMsg);
    } catch (err) {
      const errMsg = { chatId: currentChatId, role: 'assistant', content: "Connexion perdue. Réessaie.", timestamp: Date.now() };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  const currentAppCode = files.find(f => f.path === 'src/App.jsx')?.content || '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#09090b', color: '#e3e3e3', fontFamily: '"Google Sans", system-ui, sans-serif', overflow: 'hidden' }}>

      {sidebarOpen && <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 30, backdropFilter: 'blur(2px)' }}></div>}

      <div style={{
        width: '280px', backgroundColor: '#101010', borderRight: '1px solid #1f1f1f', display: 'flex', flexDirection: 'column', padding: '16px',
        position: 'fixed', top: 0, bottom: 0, left: sidebarOpen? 0 : '-290px', transition: 'left 0.3s cubic-bezier(0.32,0.72,0,1)', zIndex: 40
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', padding: '4px' }}>
          <span style={{ fontSize: '14px', fontWeight: '600' }}>Ali Agent</span>
          <button onClick={() => setSidebarOpen(false)} style={{ background: '#232323', border: 'none', color: '#fff', width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer' }}>✕</button>
        </div>
        <button onClick={async () => {
          const newId = await db.conversations.add({ title: 'Nouvelle discussion', updatedAt: Date.now() });
          setConversations(prev => [{ id: newId, title: 'Nouvelle discussion', updatedAt: Date.now() },...prev]);
          setCurrentChatId(newId);
          setMessages([{ chatId: newId, role: 'assistant', content: "Salut! De quoi on parle?", timestamp: Date.now() }]);
          setSidebarOpen(false);
        }} style={{ backgroundColor: '#fff', color: '#000', border: 'none', padding: '12px', fontWeight: '600', borderRadius: '999px', cursor: 'pointer', marginBottom: '20px', fontSize: '13px' }}>
          + Nouveau chat
        </button>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {conversations.map(chat => (
            <div key={chat.id} onClick={() => { setCurrentChatId(chat.id); loadChatData(chat.id); setActiveView('chat'); setSidebarOpen(false); }}
              style={{ padding: '10px 12px', borderRadius: '12px', backgroundColor: currentChatId === chat.id? '#232324' : 'transparent', color: currentChatId === chat.id? '#fff' : '#a1a1aa', cursor: 'pointer', fontSize: '13.5px' }}>
              {chat.title}
            </div>
          ))}
        </div>
      </div>

      <header style={{ padding: '10px 14px', backgroundColor: '#09090b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #18181b' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button onClick={() => setSidebarOpen(true)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer', width: '36px', height: '36px', display: 'grid', placeItems: 'center' }}>☰</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px', fontWeight: '500', color: '#fff', letterSpacing: '-0.2px' }}>Ali Agent</span>
            <span style={{ fontSize: '11px', fontWeight: '500', background: '#1e1e20', color: '#a1a1aa', padding: '2px 6px', borderRadius: '6px', border: '1px solid #27272a' }}>Pro</span>
            <span style={{ fontSize: '12px', color: '#71717a' }}>▼</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <div style={{ background: '#18181b', borderRadius: '20px', padding: '3px', display: 'flex', gap: '2px', border: '1px solid #27272a' }}>
            {['chat','code','preview'].map(v => (
              <button key={v} onClick={() => setActiveView(v)} style={{ background: activeView === v? '#27272a' : 'transparent', color: activeView === v? '#fff' : '#71717a', border: 'none', padding: '6px 12px', borderRadius: '16px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', textTransform: 'capitalize' }}>{v === 'chat'? 'Chat' : v === 'code'? 'Code' : 'Aperçu'}</button>
            ))}
          </div>
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {activeView === 'code'? (
          <div style={{ padding: '16px', flex: 1, backgroundColor: '#09090b', display: 'flex', flexDirection: 'column' }}>
            <textarea value={currentAppCode} onChange={(e) => setFiles([{ path: 'src/App.jsx', content: e.target.value }])}
              style={{ flex: 1, backgroundColor: '#101010', color: '#e4e4e7', border: '1px solid #232323', borderRadius: '16px', padding: '16px', fontFamily: 'Geist Mono, monospace', fontSize: '13px', outline: 'none', resize: 'none' }}
            />
          </div>
        ) : activeView === 'preview'? (
          <iframe sandbox="allow-scripts" srcDoc={`<!DOCTYPE html><html><head><script src="https://unpkg.com/react@18/umd/react.development.js"><\/script><script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"><\/script><script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script></head><body style="margin:0;"><div id="root"></div><script type="text/babel">${currentAppCode}<\/script></body></html>`}
            style={{ flex: 1, border: 'none', background: '#fff' }} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
              <div style={{ maxWidth: '720px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '28px' }}>
                {messages.map((msg, idx) => (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user'? 'flex-end' : 'flex-start', width: '100%' }}>
                    {msg.role === 'user'? (
                      <div style={{ backgroundColor: '#232324', padding: '14px 20px', borderRadius: '24px', color: '#f4f4f5', fontSize: '15px', lineHeight: '1.5', maxWidth: '85%' }}>{msg.content}</div>
                    ) : (
                      <div style={{ width: '100%' }}>
                        <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.7', fontSize: '15px', color: '#e4e4e7' }}>{msg.content}</div>
                        <div style={{ display: 'flex', gap: '16px', color: '#a1a1aa', marginTop: '16px', alignItems: 'center' }}>
                          <button style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer', display: 'grid', placeItems: 'center' }} title="J'aime">👍</button>
                          <button style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer' }}>👎</button>
                          <button onClick={() => { navigator.clipboard.writeText(msg.content); setCopiedIdx(idx); setTimeout(()=>setCopiedIdx(null), 1500); }} style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer' }}>{copiedIdx === idx? '✓' : '⎙'}</button>
                          <button style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer' }}>•••</button>
                          <button onClick={() => { if ('speechSynthesis' in window) { speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(msg.content)); } }} style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer', marginLeft: 'auto' }}>🔊</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {loading && <div style={{ color: '#71717a', fontSize: '14px' }}><span style={{ display: 'inline-block', width: '6px', height: '6px', background: '#fff', borderRadius: '50%', marginRight: '6px', animation: 'pulse 1s infinite' }}></span> Ali réfléchit...</div>}
                <div ref={chatEndRef} />
              </div>
            </div>

            <div style={{ padding: '12px 16px 20px', background: 'linear-gradient(to top, #09090b 70%, transparent)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <div style={{ fontSize: '11px', color: '#52525b' }}>Ali Agent peut se tromper. Vérifiez les informations importantes.</div>
              <form onSubmit={handleSubmit} style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#1e1e20', borderRadius: '32px', padding: '6px 8px 6px 16px', maxWidth: '720px', width: '100%', border: '1px solid #2a2a2e', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
                <span style={{ color: '#a1a1aa', fontSize: '22px', cursor: 'pointer' }}>+</span>
                <input type="text" value={input} onChange={e => setInput(e.target.value)} placeholder="Demandez à Ali..." style={{ flex: 1, backgroundColor: 'transparent', border: 'none', color: 'white', outline: 'none', fontSize: '15px' }} />
                <button type="button" style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer', width: '36px', height: '36px', display: 'grid', placeItems: 'center' }}>🎤</button>
                <button type="submit" disabled={loading ||!input.trim()} style={{ backgroundColor: input.trim()? '#fff' : '#3f3f46', color: '#000', border: 'none', width: '40px', height: '40px', borderRadius: '50%', fontWeight: 'bold', cursor: 'pointer', display: 'grid', placeItems: 'center', transition: 'all 0.2s' }}>
                  {loading? '·' : '↑'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
