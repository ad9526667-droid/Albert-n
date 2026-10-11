import React, { useState, useRef, useEffect } from 'react';
import Dexie from 'dexie';

const db = new Dexie('AliMultiFileStudioDB');
db.version(1).stores({
  conversations: '++id, title, updatedAt',
  messages: '++id, chatId, role, content, mediaUrl, timestamp',
  files: '++id, chatId, path, content',
  snapshots: '++id, chatId, timestamp, code, label'
});

export default function App() {
  const [conversations, setConversations] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'code' | 'preview' | 'split' | 'files' | 'history' | 'terminal'
  
  // Système multi-fichiers virtuel
  const [files, setFiles] = useState([
    { path: 'src/App.jsx', content: '// Ali Multi-File Engine\nexport default function App() {\n  return (\n    <div style={{ padding: "40px", fontFamily: "system-ui", color: "#fff", background: "#030712", height: "100vh" }}>\n      <h1 style={{ color: "#38bdf8" }}>🚀 Ali Multi-File Studio</h1>\n      <p>Bienvenue dans ton environnement de développement multi-fichiers.</p>\n    </div>\n  );\n}' },
    { path: 'src/styles.css', content: 'body { margin: 0; background-color: #030712; color: #fff; }' },
    { path: 'package.json', content: '{\n  "name": "ali-project",\n  "dependencies": {\n    "react": "^18.3.1",\n    "react-dom": "^18.3.1"\n  }\n}' }
  ]);
  const [activeFile, setActiveFile] = useState('src/App.jsx');
  const [terminalLogs, setTerminalLogs] = useState(['[Core] Système multi-fichiers initialisé.', '[Core] Arborescence virtuelle prête.']);
  const [snapshots, setSnapshots] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    async function initApp() {
      let chats = await db.conversations.toArray();
      if (chats.length === 0) {
        const defaultChatId = await db.conversations.add({ title: 'Projet Multi-Fichiers', updatedAt: Date.now() });
        chats = [{ id: defaultChatId, title: 'Projet Multi-Fichiers', updatedAt: Date.now() }];
        await db.messages.add({
          chatId: defaultChatId,
          role: 'assistant',
          content: "Salut ! Je gère désormais **plusieurs fichiers virtuels** (composants, styles, configuration) et un **historique de versions (Rollback)**. Que code-t-on aujourd'hui ?",
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
    const chatSnapshots = await db.snapshots.where('chatId').equals(chatId).toArray();
    setSnapshots(chatSnapshots);
  };

  const addLog = (log) => setTerminalLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${log}`]);

  const handleFileChange = (newContent) => {
    setFiles(prev => prev.map(f => f.path === activeFile ? { ...f, content: newContent } : f));
  };

  const createSnapshot = async () => {
    const currentAppCode = files.find(f => f.path === 'src/App.jsx')?.content || '';
    const snapLabel = `Version du ${new Date().toLocaleTimeString()}`;
    await db.snapshots.add({ chatId: currentChatId, timestamp: Date.now(), code: currentAppCode, label: snapLabel });
    const updatedSnaps = await db.snapshots.where('chatId').equals(currentChatId).toArray();
    setSnapshots(updatedSnaps);
    addLog(`[Rollback] Snapshot créé : "${snapLabel}"`);
    alert('Version sauvegardée dans l\'historique !');
  };

  const restoreSnapshot = (code) => {
    setFiles(prev => prev.map(f => f.path === 'src/App.jsx' ? { ...f, content: code } : f));
    addLog(`[Rollback] Restauration d'une version précédente.`);
    alert('Version restaurée avec succès dans l\'éditeur !');
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
    addLog(`[Agent] Génération du code multi-fichiers...`);

    try {
      const res = await fetch(`https://text.pollinations.ai/${encodeURIComponent(userPrompt)}`);
      const textResult = await res.text();

      if (textResult.includes('```')) {
        const match = textResult.match(/```[\s\S]*?\n([\s\S]*?)```/);
        if (match && match[1]) {
          handleFileChange(match[1]);
          addLog('[Studio] Fichier src/App.jsx mis à jour par l\'agent.');
        }
      }

      const assistantMsg = { chatId: currentChatId, role: 'assistant', content: textResult, timestamp: Date.now() };
      setMessages(prev => [...prev, assistantMsg]);
      await db.messages.add(assistantMsg);
    } catch (err) {
      setMessages(prev => [...prev, { chatId: currentChatId, role: 'assistant', content: "Erreur de génération.", timestamp: Date.now() }]);
    } finally {
      setLoading(false);
    }
  };

  const currentAppCode = files.find(f => f.path === 'src/App.jsx')?.content || '';

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#030712', color: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif', overflow: 'hidden' }}>
      
      {/* Sidebar Drawer */}
      {sidebarOpen && <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 30 }}></div>}
      
      <div style={{ 
        width: '300px', backgroundColor: '#0b0f19', borderRight: '1px solid #1f2937', display: 'flex', flexDirection: 'column', padding: '1.5rem',
        position: 'fixed', top: 0, bottom: 0, left: sidebarOpen ? 0 : '-300px', transition: 'left 0.35s cubic-bezier(0.16, 1, 0.3, 1)', zIndex: 40 
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#38bdf8', margin: 0 }}>📁 Projets</h3>
          <button onClick={() => setSidebarOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}>×</button>
        </div>

        <button onClick={async () => {
          const newId = await db.conversations.add({ title: 'Nouveau Projet', updatedAt: Date.now() });
          setConversations(prev => [{ id: newId, title: 'Nouveau Projet', updatedAt: Date.now() }, ...prev]);
          setCurrentChatId(newId);
          setMessages([{ chatId: newId, role: 'assistant', content: "Nouveau projet initialisé.", timestamp: Date.now() }]);
          setSidebarOpen(false);
        }} style={{ backgroundColor: '#38bdf8', color: '#030712', border: 'none', padding: '0.85rem', fontWeight: '700', borderRadius: '12px', cursor: 'pointer', marginBottom: '1.5rem' }}>
          + Nouveau Projet
        </button>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {conversations.map(chat => (
            <div key={chat.id} onClick={() => { setCurrentChatId(chat.id); loadChatData(chat.id); setActiveTab('chat'); setSidebarOpen(false); }}
              style={{ padding: '0.8rem 1rem', borderRadius: '10px', backgroundColor: currentChatId === chat.id ? '#1e293b' : 'transparent', color: currentChatId === chat.id ? '#38bdf8' : '#94a3b8', cursor: 'pointer', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {chat.title}
            </div>
          ))}
        </div>
      </div>

      {/* Main Container */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100vh', width: '100%', overflow: 'hidden' }}>
        
        {/* Navbar */}
        <header style={{ padding: '0.75rem 1.5rem', backgroundColor: '#030712', borderBottom: '1px solid #1f2937', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button onClick={() => setSidebarOpen(true)} style={{ background: '#111827', border: '1px solid #374151', color: '#f8fafc', padding: '8px 12px', borderRadius: '10px', cursor: 'pointer' }}>☰</button>
            <h1 style={{ fontSize: '1.1rem', fontWeight: '800', background: 'linear-gradient(to right, #38bdf8, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>Ali Multi-File Studio</h1>
          </div>
          
          <div style={{ display: 'flex', gap: '0.3rem', backgroundColor: '#0b0f19', padding: '4px', borderRadius: '14px', border: '1px solid #1f2937', flexWrap: 'wrap' }}>
            {['chat', 'code', 'files', 'preview', 'split', 'history', 'terminal'].map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{ 
                background: activeTab === tab ? '#1e293b' : 'transparent', 
                color: activeTab === tab ? '#38bdf8' : '#94a3b8', 
                border: 'none', padding: '6px 12px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer', textTransform: 'capitalize' 
              }}>
                {tab === 'split' ? 'Split View' : tab === 'files' ? 'Arborescence' : tab === 'history' ? 'Rollback' : tab}
              </button>
            ))}
          </div>
        </header>

        {/* Views Content */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', backgroundColor: '#030712' }}>
          
          {activeTab === 'files' ? (
            /* Explorateur de fichiers virtuel */
            <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', flex: 1, height: '100%', backgroundColor: '#0b0f19' }}>
              <div style={{ borderRight: '1px solid #1f2937', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <h3 style={{ fontSize: '0.9rem', color: '#38bdf8', marginBottom: '0.5rem' }}>📂 Fichiers du Projet</h3>
                {files.map(f => (
                  <button key={f.path} onClick={() => { setActiveFile(f.path); setActiveTab('code'); }} style={{ background: activeFile === f.path ? '#1e293b' : 'transparent', color: activeFile === f.path ? '#38bdf8' : '#94a3b8', border: 'none', padding: '8px 12px', borderRadius: '8px', textAlign: 'left', cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'monospace' }}>
                    📄 {f.path}
                  </button>
                ))}
              </div>
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', backgroundColor: '#030712' }}>
                <h3 style={{ fontSize: '0.9rem', color: '#38bdf8', marginBottom: '1rem' }}>Édition de : {activeFile}</h3>
                <textarea value={files.find(f => f.path === activeFile)?.content || ''} onChange={(e) => handleFileChange(e.target.value)}
                  style={{ flex: 1, backgroundColor: '#0b0f19', color: '#38bdf8', border: '1px solid #1f2937', borderRadius: '12px', padding: '1.25rem', fontFamily: 'monospace', fontSize: '0.9rem', resize: 'none', outline: 'none', lineHeight: '1.6' }}
                />
              </div>
            </div>
          ) : activeTab === 'code' ? (
            <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#0b0f19', padding: '1.5rem', flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1rem', color: '#38bdf8', margin: 0 }}>⚡ Éditeur Actif ({activeFile})</h3>
                <button onClick={createSnapshot} style={{ background: '#38bdf8', color: '#030712', border: 'none', padding: '6px 12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}>Sauvegarder Snapshot (Rollback)</button>
              </div>
              <textarea value={files.find(f => f.path === activeFile)?.content || ''} onChange={(e) => handleFileChange(e.target.value)}
                style={{ flex: 1, backgroundColor: '#030712', color: '#38bdf8', border: '1px solid #1f2937', borderRadius: '12px', padding: '1.25rem', fontFamily: 'monospace', fontSize: '0.9rem', resize: 'none', outline: 'none', lineHeight: '1.6' }}
              />
            </div>
          ) : activeTab === 'preview' ? (
            <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#ffffff', flex: 1, overflow: 'hidden' }}>
              <iframe sandbox="allow-scripts" srcDoc={`<!DOCTYPE html><html><head><script src="[https://unpkg.com/react@18/umd/react.development.js](https://unpkg.com/react@18/umd/react.development.js)"></script><script src="[https://unpkg.com/react-dom@18/umd/react-dom.development.js](https://unpkg.com/react-dom@18/umd/react-dom.development.js)"></script><script src="[https://unpkg.com/@babel/standalone/babel.min.js](https://unpkg.com/@babel/standalone/babel.min.js)"></script></head><body style="margin:0; background:#0f172a; color:#fff;"><div id="root"></div><script type="text/babel">${currentAppCode}</script></body></html>`}
                style={{ flex: 1, border: 'none', width: '100%', height: '100%' }} title="Preview"
              />
            </div>
          ) : activeTab === 'split' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', flex: 1, height: '100%', overflow: 'hidden' }}>
              <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid #1f2937', backgroundColor: '#0b0f19', height: '100%', overflowY: 'auto', padding: '1.5rem' }}>
                <h3 style={{ fontSize: '0.9rem', color: '#38bdf8', marginBottom: '1rem' }}>💬 Assistant & Chat</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {messages.map((m, i) => <div key={i} style={{ background: '#1e293b', padding: '10px 14px', borderRadius: '10px', fontSize: '0.9rem' }}>{m.content}</div>)}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#fff', height: '100%' }}>
                <iframe sandbox="allow-scripts" srcDoc={`<!DOCTYPE html><html><head><script src="[https://unpkg.com/react@18/umd/react.development.js](https://unpkg.com/react@18/umd/react.development.js)"></script><script src="[https://unpkg.com/react-dom@18/umd/react-dom.development.js](https://unpkg.com/react-dom@18/umd/react-dom.development.js)"></script><script src="[https://unpkg.com/@babel/standalone/babel.min.js](https://unpkg.com/@babel/standalone/babel.min.js)"></script></head><body style="margin:0; background:#0f172a; color:#fff;"><div id="root"></div><script type="text/babel">${currentAppCode}</script></body></html>`}
                  style={{ width: '100%', height: '100%', border: 'none' }} title="Split Preview"
                />
              </div>
            </div>
          ) : activeTab === 'history' ? (
            <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#0b0f19', padding: '2rem', flex: 1, overflowY: 'auto' }}>
              <h3 style={{ fontSize: '1.2rem', color: '#38bdf8', marginBottom: '1rem' }}>⏳ Historique des Versions (Rollback)</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1.5rem' }}>Restaure instantanément une version précédente de ton code si une modification ne te convient pas.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '600px' }}>
                {snapshots.map(snap => (
                  <div key={snap.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1e293b', padding: '12px 16px', borderRadius: '10px', border: '1px solid #334155' }}>
                    <span><strong>{snap.label}</strong></span>
                    <button onClick={() => restoreSnapshot(snap.code)} style={{ background: '#38bdf8', color: '#030712', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}>Restaurer</button>
                  </div>
                ))}
                {snapshots.length === 0 && <div style={{ color: '#64748b' }}>Aucun snapshot enregistré. Clique sur "Sauvegarder Snapshot" dans l'éditeur.</div>}
              </div>
            </div>
          ) : activeTab === 'terminal' ? (
            <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#000000', padding: '1.5rem', flex: 1, overflowY: 'auto', fontFamily: 'monospace', color: '#22c55e' }}>
              <h3 style={{ fontSize: '1rem', color: '#38bdf8', marginBottom: '1rem' }}>💻 Console Terminal Virtuelle</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem' }}>
                {terminalLogs.map((log, i) => <div key={i}>{log}</div>)}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', position: 'relative', backgroundColor: '#030712' }}>
              <div style={{ flex: 1, overflowY: 'auto', padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '850px', width: '100%', margin: '0 auto' }}>
                {messages.map((msg, idx) => (
                  <div key={idx} style={{ 
                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                    backgroundColor: msg.role === 'user' ? '#1e293b' : '#0b0f19',
                    color: '#f8fafc',
                    padding: '1.1rem 1.4rem',
                    borderRadius: '18px',
                    lineHeight: '1.6',
                    border: '1px solid #1f2937'
                  }}>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                  </div>
                ))}
                {loading && <div style={{ alignSelf: 'flex-start', color: '#38bdf8', fontSize: '0.9rem', fontStyle: 'italic', padding: '10px' }}>Ali code...</div>}
                <div ref={chatEndRef} />
              </div>

              <div style={{ padding: '1rem 1.5rem 1.5rem 1.5rem', backgroundColor: '#030712', display: 'flex', justifyContent: 'center' }}>
                <form onSubmit={handleSubmit} style={{ 
                  display: 'flex', alignItems: 'center', gap: '0.75rem', backgroundColor: '#0b0f19', border: '1px solid #334155', borderRadius: '35px', padding: '0.5rem 0.75rem 0.5rem 1.25rem', maxWidth: '750px', width: '100%'
                }}>
                  <input type="text" value={input} onChange={e => setInput(e.target.value)} placeholder="Demande une modification de code..." style={{ flex: 1, backgroundColor: 'transparent', border: 'none', color: 'white', outline: 'none', fontSize: '0.95rem' }} />
                  <button type="submit" disabled={loading} style={{ backgroundColor: '#38bdf8', color: '#030712', border: 'none', width: '40px', height: '40px', borderRadius: '50%', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>↑</button>
                </form>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
