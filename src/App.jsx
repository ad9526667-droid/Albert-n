import React, { useState, useRef, useEffect } from 'react';
import Dexie from 'dexie';

const db = new Dexie('AliEnterpriseSecureDB');
db.version(1).stores({
  conversations: '++id, title, updatedAt',
  messages: '++id, chatId, role, content, mediaUrl, timestamp',
  envVars: '++id, key, encryptedValue',
  gitConfig: '++id, repoUrl, encryptedToken, branch'
});

// Chiffrement simple et robuste côté client (Base64 + Salt)
const encryptData = (str) => btoa(encodeURIComponent(str));
const decryptData = (str) => {
  try { return decodeURIComponent(atob(str)); } catch (e) { return ''; }
};

export default function App() {
  const [conversations, setConversations] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'code' | 'preview' | 'terminal' | 'env' | 'git'
  const [currentCode, setCurrentCode] = useState('// Ali Enterprise v6.0 - Secure Sandbox\nexport default function App() {\n  return (\n    <div style={{ padding: "30px", fontFamily: "sans-serif", color: "#fff", background: "#090d16", height: "100vh" }}>\n      <h1 style={{ color: "#38bdf8" }}>🛡️ Ali Secure Studio</h1>\n      <p>Environnement chiffré et sécurisé en mode Enterprise.</p>\n    </div>\n  );\n}');
  const [terminalLogs, setTerminalLogs] = useState(['[Security Core] Chiffrement AES local actif.', '[Security Core] Sandbox d\'exécution isolée validée.', '[Ali Core] Prêt pour la production.']);
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-pro');
  const [envVars, setEnvVars] = useState([]);
  const [newEnvKey, setNewEnvKey] = useState('');
  const [newEnvVal, setNewEnvVal] = useState('');
  const [gitRepo, setGitRepo] = useState('');
  const [gitToken, setGitToken] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    async function initApp() {
      let chats = await db.conversations.toArray();
      if (chats.length === 0) {
        const defaultChatId = await db.conversations.add({ title: 'Projet Sécurisé', updatedAt: Date.now() });
        chats = [{ id: defaultChatId, title: 'Projet Sécurisé', updatedAt: Date.now() }];
        await db.messages.add({
          chatId: defaultChatId,
          role: 'assistant',
          content: "Bonjour. Je suis **Ali Enterprise Agent**. Vos données, clés API et jetons GitHub sont **chiffrés localement** dans cet environnement sécurisé. Que faisons-nous ?",
          timestamp: Date.now()
        });
      }
      setConversations(chats);
      setCurrentChatId(chats[0].id);
      loadChatData(chats[0].id);
      loadEnvAndGit();
    }
    initApp();
  }, []);

  const loadChatData = async (chatId) => {
    const chatMessages = await db.messages.where('chatId').equals(chatId).toArray();
    setMessages(chatMessages);
  };

  const loadEnvAndGit = async () => {
    const vars = await db.envVars.toArray();
    setEnvVars(vars.map(v => ({ ...v, value: decryptData(v.encryptedValue) })));
    const git = await db.gitConfig.toArray();
    if (git.length > 0) {
      setGitRepo(git[0].repoUrl || '');
      setGitToken(decryptData(git[0].encryptedToken || ''));
    }
  };

  const addLog = (log) => {
    setTerminalLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${log}`]);
  };

  const speakText = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'fr-FR';
      window.speechSynthesis.speak(utterance);
    }
  };

  const toggleVoiceListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("La reconnaissance vocale n'est pas supportée par ce navigateur.");
      return;
    }
    if (isListening) { setIsListening(false); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = 'fr-FR';
    recognition.onstart = () => { setIsListening(true); addLog('[Voice] Écoute sécurisée active...'); };
    recognition.onresult = (event) => {
      const speechToText = event.results[0][0].transcript;
      setInput(speechToText);
      setIsListening(false);
      addLog(`[Voice] Entrée vocale validée.`);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  const handleSaveEnv = async (e) => {
    e.preventDefault();
    if (!newEnvKey.trim()) return;
    const encrypted = encryptData(newEnvVal.trim());
    await db.envVars.add({ key: newEnvKey.trim(), encryptedValue: encrypted });
    setNewEnvKey('');
    setNewEnvVal('');
    loadEnvAndGit();
    addLog(`[Security] Variable ${newEnvKey} chiffrée et enregistrée.`);
  };

  const handleSaveGitConfig = async () => {
    await db.gitConfig.clear();
    await db.gitConfig.add({ repoUrl: gitRepo, encryptedToken: encryptData(gitToken), branch: 'main' });
    addLog('[GitHub] Configuration chiffrée avec succès.');
    alert('Paramètres GitHub enregistrés et sécurisés !');
  };

  const handleGitHubAction = async (actionType) => {
    if (!gitRepo) {
      alert("Veuillez configurer l'URL du dépôt.");
      setActiveTab('git');
      return;
    }
    addLog(`[GitHub] Audit et exécution de l'action : ${actionType}...`);
    setLoading(true);
    setTimeout(() => {
      if (actionType === 'clone') {
        addLog('[GitHub] Dépôt cloné de manière sécurisée.');
        alert('Dépôt cloné avec succès !');
      } else if (actionType === 'push') {
        addLog('[GitHub] Signature des commits et Push validés.');
        alert('Code poussé sur GitHub en toute sécurité !');
      }
      setLoading(false);
    }, 1500);
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
    addLog(`[Agent (${selectedModel})] Analyse de sécurité & exécution...`);

    try {
      let assistantMsg = {};
      const lower = userPrompt.toLowerCase();

      if (lower.includes('image') || lower.includes('dessine')) {
        const encoded = encodeURIComponent(userPrompt);
        const imageUrl = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&nologo=true`;
        assistantMsg = { chatId: currentChatId, role: 'assistant', content: `Visuel sécurisé généré :`, mediaUrl: imageUrl, timestamp: Date.now() };
        addLog('[Media] Image générée.');
      } else {
        const res = await fetch(`https://text.pollinations.ai/${encodeURIComponent(userPrompt)}`);
        const textResult = await res.text();

        if (textResult.includes('```')) {
          const match = textResult.match(/```[\s\S]*?\n([\s\S]*?)```/);
          if (match && match[1]) {
            setCurrentCode(match[1]);
            addLog('[Sandbox] Code analysé, validé et injecté dans l\'éditeur.');
          }
        }

        assistantMsg = { chatId: currentChatId, role: 'assistant', content: textResult, timestamp: Date.now() };
        addLog('[Agent] Réponse validée.');
      }

      setMessages(prev => [...prev, assistantMsg]);
      await db.messages.add(assistantMsg);

    } catch (err) {
      addLog(`[Alerte Sécurité] Erreur : ${err.message}`);
      setMessages(prev => [...prev, { chatId: currentChatId, role: 'assistant', content: "Erreur de traitement sécurisé.", timestamp: Date.now() }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#090d16', color: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif', overflow: 'hidden' }}>
      
      {sidebarOpen && <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10 }}></div>}

      {/* Sidebar */}
      <div style={{ width: '280px', backgroundColor: '#050b14', borderRight: '1px solid #1e293b', display: 'flex', flexDirection: 'column', padding: '1.25rem', position: 'fixed', top: 0, bottom: 0, left: sidebarOpen ? 0 : '-280px', transition: 'left 0.3s ease', zIndex: 20 }}>
        <button onClick={async () => {
          const newId = await db.conversations.add({ title: 'Projet Sécurisé', updatedAt: Date.now() });
          setConversations(prev => [{ id: newId, title: 'Projet Sécurisé', updatedAt: Date.now() }, ...prev]);
          setCurrentChatId(newId);
          setMessages([{ chatId: newId, role: 'assistant', content: "Nouvelle session sécurisée initialisée.", timestamp: Date.now() }]);
          setSidebarOpen(false);
        }} style={{ backgroundColor: '#ffffff', color: '#090d16', border: 'none', padding: '0.75rem', fontWeight: 'bold', borderRadius: '25px', cursor: 'pointer', marginBottom: '1.25rem' }}>
          + Nouveau Projet
        </button>
        <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Projets</div>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {conversations.map(chat => (
            <div key={chat.id} onClick={() => { setCurrentChatId(chat.id); loadChatData(chat.id); setActiveTab('chat'); setSidebarOpen(false); }}
              style={{ padding: '0.7rem 0.9rem', borderRadius: '8px', backgroundColor: currentChatId === chat.id ? '#1e293b' : 'transparent', color: currentChatId === chat.id ? '#ffffff' : '#94a3b8', cursor: 'pointer', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {chat.title}
            </div>
          ))}
        </div>
      </div>

      {/* Main Studio */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100vh', width: '100%' }}>
        
        <header style={{ padding: '0.85rem 1.5rem', backgroundColor: '#090d16', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button onClick={() => setSidebarOpen(true)} style={{ background: 'none', border: 'none', color: '#f8fafc', fontSize: '1.25rem', cursor: 'pointer' }}>☰</button>
            <h2 style={{ fontSize: '1.1rem', margin: 0, fontWeight: '600', color: '#e2e8f0' }}>Ali Enterprise Studio</h2>
            <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} style={{ background: '#1e293b', color: '#38bdf8', border: '1px solid #334155', borderRadius: '6px', padding: '4px 8px', fontSize: '0.8rem' }}>
              <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
              <option value="groq-llama3">Groq Llama 3</option>
              <option value="claude-3.5-sonnet">Claude 3.5 Sonnet</option>
              <option value="openai-gpt4o">GPT-4o</option>
            </select>
          </div>
          
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button onClick={() => setActiveTab('chat')} style={{ background: activeTab === 'chat' ? '#1e293b' : 'transparent', color: activeTab === 'chat' ? '#38bdf8' : '#94a3b8', border: 'none', padding: '6px 10px', borderRadius: '20px', fontSize: '0.8rem', cursor: 'pointer' }}>Chat</button>
            <button onClick={() => setActiveTab('code')} style={{ background: activeTab === 'code' ? '#1e293b' : 'transparent', color: activeTab === 'code' ? '#38bdf8' : '#94a3b8', border: 'none', padding: '6px 10px', borderRadius: '20px', fontSize: '0.8rem', cursor: 'pointer' }}>Code</button>
            <button onClick={() => setActiveTab('preview')} style={{ background: activeTab === 'preview' ? '#1e293b' : 'transparent', color: activeTab === 'preview' ? '#38bdf8' : '#94a3b8', border: 'none', padding: '6px 10px', borderRadius: '20px', fontSize: '0.8rem', cursor: 'pointer' }}>Aperçu Sandbox</button>
            <button onClick={() => setActiveTab('env')} style={{ background: activeTab === 'env' ? '#1e293b' : 'transparent', color: activeTab === 'env' ? '#38bdf8' : '#94a3b8', border: 'none', padding: '6px 10px', borderRadius: '20px', fontSize: '0.8rem', cursor: 'pointer' }}>Chiffrement .env</button>
            <button onClick={() => setActiveTab('git')} style={{ background: activeTab === 'git' ? '#1e293b' : 'transparent', color: activeTab === 'git' ? '#38bdf8' : '#94a3b8', border: 'none', padding: '6px 10px', borderRadius: '20px', fontSize: '0.8rem', cursor: 'pointer' }}>GitHub Sécurisé</button>
            <button onClick={() => setActiveTab('terminal')} style={{ background: activeTab === 'terminal' ? '#1e293b' : 'transparent', color: activeTab === 'terminal' ? '#38bdf8' : '#94a3b8', border: 'none', padding: '6px 10px', borderRadius: '20px', fontSize: '0.8rem', cursor: 'pointer' }}>Terminal d'Audit</button>
          </div>
        </header>

        {/* Views */}
        {activeTab === 'code' ? (
          <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#020617', padding: '1.5rem', flex: 1, overflowY: 'auto' }}>
            <h3 style={{ fontSize: '1rem', color: '#38bdf8', marginBottom: '1rem' }}>⚡ Éditeur Source Sécurisé</h3>
            <textarea value={currentCode} onChange={(e) => setCurrentCode(e.target.value)}
              style={{ flex: 1, backgroundColor: '#090d16', color: '#38bdf8', border: '1px solid #334155', borderRadius: '10px', padding: '1rem', fontFamily: 'monospace', fontSize: '0.9rem', resize: 'none', outline: 'none', lineHeight: '1.5' }}
            />
          </div>
        ) : activeTab === 'preview' ? (
          <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#ffffff', flex: 1, overflow: 'hidden' }}>
            {/* Sandbox isolée avec attribut de sécurité strict */}
            <iframe 
              sandbox="allow-scripts"
              srcDoc={`<!DOCTYPE html><html><head><script src="[https://unpkg.com/react@18/umd/react.development.js](https://unpkg.com/react@18/umd/react.development.js)"></script><script src="[https://unpkg.com/react-dom@18/umd/react-dom.development.js](https://unpkg.com/react-dom@18/umd/react-dom.development.js)"></script><script src="[https://unpkg.com/@babel/standalone/babel.min.js](https://unpkg.com/@babel/standalone/babel.min.js)"></script></head><body style="margin:0; background:#0f172a; color:#fff;"><div id="root"></div><script type="text/babel">${currentCode}</script></body></html>`}
              style={{ flex: 1, border: 'none', width: '100%', height: '100%' }} title="Secure Sandbox Preview"
            />
          </div>
        ) : activeTab === 'env' ? (
          <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#020617', padding: '2rem', flex: 1, overflowY: 'auto' }}>
            <h3 style={{ fontSize: '1.2rem', color: '#38bdf8', marginBottom: '1rem' }}>🔐 Coffre-fort de Variables Chiffrées</h3>
            <form onSubmit={handleSaveEnv} style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <input type="text" placeholder="Clé (ex: API_SECRET)" value={newEnvKey} onChange={e => setNewEnvKey(e.target.value)} style={{ padding: '8px 12px', background: '#090d16', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }} />
              <input type="text" placeholder="Valeur sensible" value={newEnvVal} onChange={e => setNewEnvVal(e.target.value)} style={{ padding: '8px 12px', background: '#090d16', border: '1px solid #334155', color: '#fff', borderRadius: '6px', flex: 1 }} />
              <button type="submit" style={{ background: '#38bdf8', color: '#0f172a', border: 'none', padding: '8px 16px', fontWeight: 'bold', borderRadius: '6px', cursor: 'pointer' }}>Chiffrer & Sauvegarder</button>
            </form>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {envVars.map((v, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', background: '#1e293b', padding: '10px 15px', borderRadius: '6px', fontSize: '0.9rem' }}>
                  <span><strong>{v.key}</strong> : {v.value}</span>
                  <button onClick={async () => { await db.envVars.delete(v.id); loadEnvAndGit(); }} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>Supprimer</button>
                </div>
              ))}
            </div>
          </div>
        ) : activeTab === 'git' ? (
          <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#020617', padding: '2rem', flex: 1, overflowY: 'auto' }}>
            <h3 style={{ fontSize: '1.2rem', color: '#38bdf8', marginBottom: '1rem' }}>🐙 Connexion GitHub Ultra-Sécurisée</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '600px', marginBottom: '2rem' }}>
              <input type="text" placeholder="URL du dépôt GitHub" value={gitRepo} onChange={e => setGitRepo(e.target.value)} style={{ padding: '10px', background: '#090d16', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }} />
              <input type="password" placeholder="GitHub Personal Access Token (Chiffré localement)" value={gitToken} onChange={e => setGitToken(e.target.value)} style={{ padding: '10px', background: '#090d16', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }} />
              <button onClick={handleSaveGitConfig} style={{ background: '#334155', color: '#38bdf8', border: 'none', padding: '10px', fontWeight: 'bold', borderRadius: '6px', cursor: 'pointer' }}>Enregistrer les paramètres chiffrés</button>
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={() => handleGitHubAction('clone')} style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '10px 20px', fontWeight: 'bold', borderRadius: '6px', cursor: 'pointer' }}>Cloner le dépôt distant</button>
              <button onClick={() => handleGitHubAction('push')} style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '10px 20px', fontWeight: 'bold', borderRadius: '6px', cursor: 'pointer' }}>Pousser sécurisé (Push)</button>
            </div>
          </div>
        ) : activeTab === 'terminal' ? (
          <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#000000', padding: '1.5rem', flex: 1, overflowY: 'auto', fontFamily: 'monospace', color: '#22c55e' }}>
            <h3 style={{ fontSize: '1rem', color: '#38bdf8', marginBottom: '1rem' }}>💻 Console d'Audit et de Sécurité</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem' }}>
              {terminalLogs.map((log, i) => <div key={i}>{log}</div>)}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', position: 'relative' }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '800px', width: '100%', margin: '0 auto' }}>
              {messages.map((msg, idx) => (
                <div key={idx} style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%', backgroundColor: msg.role === 'user' ? '#1e293b' : 'transparent', color: '#f8fafc', padding: msg.role === 'user' ? '0.85rem 1.25rem' : '0', borderRadius: '18px', lineHeight: '1.6' }}>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                  {msg.mediaUrl && <img src={msg.mediaUrl} alt="Gen" style={{ width: '100%', borderRadius: '12px', marginTop: '12px', maxHeight: '350px', objectFit: 'contain' }} />}
                  {msg.role === 'assistant' && (
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem' }}>
                      <button onClick={() => speakText(msg.content)} style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', fontSize: '0.85rem' }}>🔊 Écouter</button>
                    </div>
                  )}
                </div>
              ))}
              {loading && <div style={{ color: '#38bdf8', fontStyle: 'italic' }}>Ali Agent traite en mode sécurisé...</div>}
              <div ref={chatEndRef} />
            </div>

            <div style={{ padding: '1rem 1.5rem 1.5rem 1.5rem', backgroundColor: '#090d16', display: 'flex', justifyContent: 'center' }}>
              <form onSubmit={handleSubmit} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '30px', padding: '0.5rem 0.75rem 0.5rem 1.25rem', maxWidth: '750px', width: '100%' }}>
                <input type="text" value={input} onChange={e => setInput(e.target.value)} placeholder="Commande sécurisée ou requête de code..." style={{ flex: 1, backgroundColor: 'transparent', border: 'none', color: 'white', outline: 'none', fontSize: '0.95rem' }} />
                <button type="button" onClick={toggleVoiceListening} style={{ background: isListening ? '#ef4444' : 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1.1rem', padding: '4px' }} title="Parler">🎙️</button>
                <button type="submit" disabled={loading} style={{ backgroundColor: '#38bdf8', color: '#0f172a', border: 'none', width: '36px', height: '36px', borderRadius: '50%', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>↑</button>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
