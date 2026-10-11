import React, { useState, useRef, useEffect } from 'react';
import Dexie from 'dexie';

// Base de données Dexie.js améliorée pour le multi-chat et la mémoire à long terme
const db = new Dexie('AliAgentStudioMultiDB');
db.version(1).stores({
  conversations: '++id, title, updatedAt',
  messages: '++id, chatId, role, content, mediaUrl, mediaType, timestamp',
  media: '++id, chatId, type, url, prompt, timestamp',
  memory: '++id, key, value' // Mémoire à long terme (préférences, projets)
});

export default function App() {
  const [conversations, setConversations] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mediaList, setMediaList] = useState([]);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'code' | 'media' | 'memory'
  const [currentCode, setCurrentCode] = useState('// Le code généré apparaîtra ici...\nexport default function Component() {\n  return <div>Ali Agent Studio v4.0 Multi-Chat</div>;\n}');
  const [longTermMemory, setLongTermMemory] = useState([]);
  const chatEndRef = useRef(null);

  // Initialisation des conversations et de la mémoire à long terme
  useEffect(() => {
    async function initApp() {
      let chats = await db.conversations.toArray();
      if (chats.length === 0) {
        const defaultChatId = await db.conversations.add({ title: 'Nouvelle discussion', updatedAt: Date.now() });
        chats = [{ id: defaultChatId, title: 'Nouvelle discussion', updatedAt: Date.now() }];
        
        await db.messages.add({
          chatId: defaultChatId,
          role: 'assistant',
          content: "Salut ! Je suis **Ali Agent Studio**. Je gère maintenant **plusieurs conversations** et j'ai une **mémoire à long terme** qui ne s'efface jamais.",
          timestamp: Date.now()
        });
      }
      setConversations(chats);
      setCurrentChatId(chats[0].id);
      loadChatData(chats[0].id);
      loadMemory();
    }
    initApp();
  }, []);

  // Charger les messages et médias d'une conversation spécifique
  const loadChatData = async (chatId) => {
    const chatMessages = await db.messages.where('chatId').equals(chatId).toArray();
    const chatMedia = await db.media.where('chatId').equals(chatId).toArray();
    setMessages(chatMessages);
    setMediaList(chatMedia);
  };

  const loadMemory = async () => {
    const mems = await db.memory.toArray();
    setLongTermMemory(mems);
  };

  // Créer un nouveau chat
  const createNewChat = async () => {
    const newId = await db.conversations.add({ title: `Discussion ${conversations.length + 1}`, updatedAt: Date.now() });
    const newChat = { id: newId, title: `Discussion ${conversations.length + 1}`, updatedAt: Date.now() };
    setConversations(prev => [newChat, ...prev]);
    setCurrentChatId(newId);
    setMessages([{
      chatId: newId,
      role: 'assistant',
      content: "Nouvelle session initialisée. De quoi souhaites-tu parler ?",
      timestamp: Date.now()
    }]);
    setMediaList([]);
  };

  // Supprimer une conversation
  const deleteChat = async (id, e) => {
    e.stopPropagation();
    if (conversations.length <= 1) {
      alert("Tu dois garder au moins une conversation.");
      return;
    }
    await db.conversations.delete(id);
    await db.messages.where('chatId').equals(id).delete();
    await db.media.where('chatId').equals(id).delete();
    
    const remaining = conversations.filter(c => c.id !== id);
    setConversations(remaining);
    setCurrentChatId(remaining[0].id);
    loadChatData(remaining[0].id);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const formatClaudeStyle = (text) => {
    if (!text) return null;
    const parts = text.split(/(```[\s\S]*?```)/g);

    return parts.map((part, index) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const lines = part.slice(3, -3).trim().split('\n');
        const codeContent = lines.slice(1).join('\n') || lines.join('\n');
        return (
          <div key={index} style={{ margin: '10px 0', background: '#020617', borderRadius: '8px', border: '1px solid #334155', overflow: 'hidden' }}>
            <div style={{ background: '#0f172a', padding: '6px 12px', fontSize: '0.75rem', color: '#38bdf8', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #334155' }}>
              <span>Code Source / Éditeur Replit</span>
              <button 
                onClick={() => { navigator.clipboard.writeText(codeContent); setCurrentCode(codeContent); setActiveTab('code'); }}
                style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', fontSize: '0.75rem' }}
              >
                Envoyer dans l'Éditeur ↗
              </button>
            </div>
            <pre style={{ padding: '12px', margin: 0, overflowX: 'auto', fontFamily: 'monospace', fontSize: '0.85rem', color: '#e2e8f0' }}>
              <code>{codeContent}</code>
            </pre>
          </div>
        );
      }

      const formattedText = part.split(/(\*\*.*?\*\*)/g).map((sub, i) => {
        if (sub.startsWith('**') && sub.endsWith('**')) {
          return <strong key={i} style={{ color: '#ffffff', fontWeight: '700' }}>{sub.slice(2, -2)}</strong>;
        }
        return sub;
      });

      return <span key={index}>{formattedText}</span>;
    });
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
    const lower = userPrompt.toLowerCase();

    // Enregistrer automatiquement un fait important dans la mémoire à long terme si détecté
    if (lower.includes('je m\'appelle') || lower.includes('j\'aime') || lower.includes('mon projet') || lower.includes('je code en')) {
      await db.memory.add({ key: `Note_${Date.now()}`, value: userPrompt });
      loadMemory();
    }

    try {
      let assistantMsg = {};

      if (lower.includes('image') || lower.includes('photo') || lower.includes('dessine') || lower.includes('logo')) {
        const encoded = encodeURIComponent(userPrompt);
        const imageUrl = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&nologo=true`;
        
        assistantMsg = { 
          chatId: currentChatId,
          role: 'assistant', 
          content: `Voici le visuel généré pour : **"${userPrompt}"**`,
          mediaUrl: imageUrl,
          mediaType: 'image',
          timestamp: Date.now()
        };
        
        setMediaList(prev => [assistantMsg, ...prev]);
        await db.media.add({ chatId: currentChatId, type: 'image', url: imageUrl, prompt: userPrompt, timestamp: Date.now() });
      } 
      else if (lower.includes('chanson') || lower.includes('musique') || lower.includes('audio') || lower.includes('voix')) {
        const encoded = encodeURIComponent(userPrompt);
        const audioUrl = `https://text.pollinations.ai/audio/${encoded}`;

        assistantMsg = { 
          chatId: currentChatId,
          role: 'assistant', 
          content: `Flux audio / voix Piper généré pour : **"${userPrompt}"**`,
          mediaUrl: audioUrl,
          mediaType: 'audio',
          timestamp: Date.now()
        };

        setMediaList(prev => [assistantMsg, ...prev]);
        await db.media.add({ chatId: currentChatId, type: 'audio', url: audioUrl, prompt: userPrompt, timestamp: Date.now() });
      } 
      else {
        // Injection de la mémoire à long terme pour donner du contexte à l'IA
        const memsText = longTermMemory.map(m => m.value).join('. ');
        const contextualPrompt = memsText ? `Contexte utilisateur: ${memsText}. Question: ${userPrompt}` : userPrompt;

        const res = await fetch(`https://text.pollinations.ai/${encodeURIComponent(contextualPrompt)}`);
        const textResult = await res.text();

        if (textResult.includes('```')) {
          const match = textResult.match(/```[\s\S]*?\n([\s\S]*?)```/);
          if (match && match[1]) {
            setCurrentCode(match[1]);
          }
        }

        const voiceUrl = `[https://text.pollinations.ai/audio/$](https://text.pollinations.ai/audio/$){encodeURIComponent(textResult.slice(0, 150))}`;

        assistantMsg = { 
          chatId: currentChatId,
          role: 'assistant', 
          content: textResult,
          mediaUrl: voiceUrl,
          mediaType: 'voice',
          timestamp: Date.now()
        };
      }

      setMessages(prev => [...prev, assistantMsg]);
      await db.messages.add(assistantMsg);

      // Mettre à jour le titre du chat si c'est le premier échange
      if (messages.length <= 1) {
        const newTitle = userPrompt.slice(0, 25) + '...';
        await db.conversations.update(currentChatId, { title: newTitle, updatedAt: Date.now() });
        setConversations(prev => prev.map(c => c.id === currentChatId ? { ...c, title: newTitle } : c));
      }

    } catch (err) {
      const errorMsg = { chatId: currentChatId, role: 'assistant', content: "Désolé, une erreur est survenue.", timestamp: Date.now() };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#090d16', color: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* Sidebar gauche : Multi-conversations */}
      <div style={{ width: '260px', backgroundColor: '#050b14', borderRight: '1px solid #1e293b', display: 'flex', flexDirection: 'column', padding: '1rem' }}>
        <button onClick={createNewChat} style={{ backgroundColor: '#38bdf8', color: '#0f172a', border: 'none', padding: '0.75rem', fontWeight: 'bold', borderRadius: '8px', cursor: 'pointer', marginBottom: '1rem' }}>
          + Nouvelle Discussion
        </button>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Historique des Chats</div>
          {conversations.map(chat => (
            <div 
              key={chat.id} 
              onClick={() => { setCurrentChatId(chat.id); loadChatData(chat.id); setActiveTab('chat'); }}
              style={{ 
                padding: '0.65rem 0.75rem', 
                borderRadius: '6px', 
                backgroundColor: currentChatId === chat.id ? '#1e293b' : 'transparent', 
                color: currentChatId === chat.id ? '#38bdf8' : '#94a3b8', 
                cursor: 'pointer', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                fontSize: '0.85rem',
                border: currentChatId === chat.id ? '1px solid #334155' : '1px solid transparent'
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '170px' }}>{chat.title}</span>
              <span onClick={(e) => deleteChat(chat.id, e)} style={{ color: '#ef4444', fontSize: '0.8rem', padding: '2px 6px' }}>×</span>
            </div>
          ))}
        </div>

        <div style={{ borderTop: '1px solid #1e293b', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <button onClick={() => setActiveTab('memory')} style={{ background: '#1e293b', color: '#38bdf8', border: '1px solid #334155', padding: '6px', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer', textAlign: 'left' }}>
            🧠 Mémoire Long Terme ({longTermMemory.length})
          </button>
        </div>
      </div>

      {/* Zone Principale */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100vh', overflow: 'hidden' }}>
        
        <header style={{ padding: '0.75rem 1.5rem', borderBottom: '1px solid #1e293b', backgroundColor: '#0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#22c55e', boxShadow: '0 0 12px #22c55e' }}></div>
            <h1 style={{ fontSize: '1.1rem', margin: 0, fontWeight: '700' }}>Ali Agent Studio <span style={{ fontSize: '0.7rem', color: '#38bdf8', fontWeight: '400' }}>Multi-Chat & Mémoire Persistante</span></h1>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button onClick={() => setActiveTab('chat')} style={{ background: activeTab === 'chat' ? '#38bdf8' : '#1e293b', color: activeTab === 'chat' ? '#0f172a' : '#cbd5e1', border: '1px solid #334155', padding: '5px 12px', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: '600' }}>Chat</button>
            <button onClick={() => setActiveTab('code')} style={{ background: activeTab === 'code' ? '#38bdf8' : '#1e293b', color: activeTab === 'code' ? '#0f172a' : '#cbd5e1', border: '1px solid #334155', padding: '5px 12px', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: '600' }}>Éditeur</button>
            <button onClick={() => setActiveTab('media')} style={{ background: activeTab === 'media' ? '#38bdf8' : '#1e293b', color: activeTab === 'media' ? '#0f172a' : '#cbd5e1', border: '1px solid #334155', padding: '5px 12px', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: '600' }}>Galerie</button>
          </div>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: activeTab === 'chat' ? '1fr 340px' : '1fr', flex: 1, overflow: 'hidden' }}>
          
          {activeTab === 'code' ? (
            <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#020617', padding: '1.5rem', height: 'calc(100vh - 60px)', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1rem', color: '#38bdf8', margin: 0 }}>⚡ Éditeur de Code Pro</h2>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => {
                    const blob = new Blob([currentCode], { type: 'text/javascript' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a'); a.href = url; a.download = 'App.jsx'; a.click();
                  }} style={{ background: '#334155', color: '#38bdf8', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}>Télécharger</button>
                  <button onClick={() => navigator.clipboard.writeText(currentCode)} style={{ background: '#38bdf8', color: '#0f172a', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}>Copier</button>
                </div>
              </div>
              <textarea 
                value={currentCode} 
                onChange={(e) => setCurrentCode(e.target.value)}
                style={{ flex: 1, backgroundColor: '#090d16', color: '#38bdf8', border: '1px solid #334155', borderRadius: '8px', padding: '1rem', fontFamily: 'monospace', fontSize: '0.9rem', resize: 'none', outline: 'none', lineHeight: '1.5' }}
              />
            </div>
          ) : activeTab === 'memory' ? (
            <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#020617', padding: '1.5rem', height: 'calc(100vh - 60px)', overflowY: 'auto' }}>
              <h2 style={{ fontSize: '1.1rem', color: '#38bdf8', marginBottom: '1rem' }}>🧠 Mémoire à Long Terme d'Ali</h2>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1.5rem' }}>Voici tout ce qu'Ali mémorise de façon permanente à travers tes discussions :</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {longTermMemory.map((mem, i) => (
                  <div key={i} style={{ backgroundColor: '#1e293b', border: '1px solid #334155', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.9rem' }}>
                    {mem.value}
                  </div>
                ))}
                {longTermMemory.length === 0 && <div style={{ color: '#64748b' }}>Aucune information enregistrée pour le moment. Dis à Ali des choses comme "Mon projet c'est..." pour qu'il s'en souvienne !</div>}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#0b1329', height: 'calc(100vh - 60px)' }}>
              
              <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {messages.map((msg, idx) => (
                  <div key={idx} style={{ 
                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                    backgroundColor: msg.role === 'user' ? '#0284c7' : '#1e293b',
                    color: '#f8fafc',
                    padding: '1rem 1.25rem',
                    borderRadius: '12px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
                    lineHeight: '1.6',
                    fontSize: '0.95rem',
                    border: msg.role === 'assistant' ? '1px solid #334155' : 'none'
                  }}>
                    <div>{formatClaudeStyle(msg.content)}</div>
                    
                    {msg.mediaType === 'image' && (
                      <img src={msg.mediaUrl} alt="Généré" style={{ width: '100%', borderRadius: '8px', marginTop: '12px', maxHeight: '320px', objectFit: 'contain' }} />
                    )}
                    
                    {(msg.mediaType === 'audio' || msg.mediaType === 'voice') && (
                      <div style={{ marginTop: '10px', background: '#0f172a', padding: '8px', borderRadius: '8px', border: '1px solid #334155' }}>
                        <div style={{ fontSize: '0.75rem', color: '#38bdf8', marginBottom: '4px' }}>🔊 Synthèse Vocale Piper TTS :</div>
                        <audio controls src={msg.mediaUrl} style={{ width: '100%', height: '32px' }}></audio>
                      </div>
                    )}
                  </div>
                ))}
                {loading && (
                  <div style={{ alignSelf: 'flex-start', backgroundColor: '#1e293b', padding: '0.75rem 1rem', borderRadius: '12px', color: '#38bdf8', fontSize: '0.9rem', border: '1px solid #334155' }}>
                    Ali Agent consulte sa mémoire et code... ⚡
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div style={{ padding: '1rem 1.5rem', backgroundColor: '#0f172a', borderTop: '1px solid #1e293b' }}>
                <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.75rem' }}>
                  <input 
                    type="text" 
                    value={input} 
                    onChange={e => setInput(e.target.value)} 
                    placeholder="Discute avec Ali (il retient tout dans sa mémoire)..." 
                    style={{ flex: 1, backgroundColor: '#090d16', border: '1px solid #334155', borderRadius: '8px', padding: '0.75rem 1rem', color: 'white', outline: 'none', fontSize: '0.95rem' }}
                  />
                  <button type="submit" disabled={loading} style={{ backgroundColor: '#38bdf8', color: '#0f172a', border: 'none', padding: '0 1.5rem', fontWeight: 'bold', borderRadius: '8px', cursor: 'pointer' }}>
                    Envoyer
                  </button>
                </form>
              </div>
            </div>
          )}

          {activeTab === 'chat' && (
            <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#090d16', borderLeft: '1px solid #1e293b', height: 'calc(100vh - 60px)', padding: '1.25rem', overflowY: 'auto' }}>
              <h2 style={{ fontSize: '0.95rem', color: '#38bdf8', margin: '0 0 1rem 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Galerie du Chat</span>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{mediaList.length}</span>
              </h2>

              {mediaList.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', textAlign: 'center', border: '2px dashed #1e293b', borderRadius: '10px', padding: '1.5rem', fontSize: '0.85rem' }}>
                  Les médias de cette conversation s'afficheront ici.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {mediaList.map((item, index) => (
                    <div key={index} style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '0.75rem' }}>
                      <p style={{ fontSize: '0.8rem', color: '#cbd5e1', margin: '0 0 0.5rem 0', fontStyle: 'italic' }}>"{item.prompt}"</p>
                      {item.type === 'image' ? (
                        <img src={item.url} alt="Galerie" style={{ width: '100%', borderRadius: '6px', maxHeight: '180px', objectFit: 'cover' }} />
                      ) : (
                        <audio controls src={item.url} style={{ width: '100%', height: '30px' }}></audio>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
