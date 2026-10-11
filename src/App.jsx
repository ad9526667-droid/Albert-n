import React, { useState, useRef, useEffect } from 'react';
import Dexie from 'dexie';

// FIX ECRAN NOIR WORKER - IndexedDB n'existe pas sur workers.dev
let db = null;
try {
  if (typeof indexedDB!== 'undefined') {
    db = new Dexie('AliSuperAgentDB');
    db.version(1).stores({
      conversations: '++id, title, updatedAt',
      messages: '++id, chatId, role, content, timestamp',
      projects: '++id, chatId, files'
    });
  }
} catch (e) {
  db = null;
}

export default function App() {
  const [conversations, setConversations] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(1);
  const [messages, setMessages] = useState([{ role: 'assistant', content: "**Salut, c'est Ali.** Prêt à builder. Décris ton app, j'active terminal, files, preview, voix Edge et rire humain.", timestamp: Date.now() }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeView, setActiveView] = useState('chat');
  const [projectFiles, setProjectFiles] = useState([{ path: 'src/App.jsx', content: `export default function App(){ return <div className="min-h-screen bg-black text-white grid place-items-center p-10"><h1 className="text-4xl font-black">Ali OS prêt - V9 FIXED</h1><p>Décris ton app</p></div> }` }]);
  const [activeFile, setActiveFile] = useState('src/App.jsx');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // TTS EDGE SECURED
  useEffect(() => {
    if (typeof window === 'undefined' ||!window.speechSynthesis) return;
    const load = () => {
      const vs = window.speechSynthesis.getVoices();
      if (!vs.length) return;
      const fr = vs.filter(v => v.lang.includes('fr') || v.lang.includes('en-US')).slice(0, 10);
      setVoices(fr.length? fr : vs.slice(0, 8));
      setSelectedVoice(fr[0] || vs[0]);
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
  }, []);

  const speak = (t, laugh = false) => {
    try {
      if (typeof window === 'undefined' ||!window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      let clean = t.replace(/\*\*/g, '').replace(/IMG::.*/, '').slice(0, 350);
      if (laugh) clean += " Hahaha!";
      const u = new SpeechSynthesisUtterance(clean);
      if (selectedVoice) u.voice = selectedVoice;
      u.rate = 0.95; u.pitch = laugh? 1.3 : 1;
      window.speechSynthesis.speak(u);
    } catch {}
  };
  const doLaugh = () => speak("Ahahah c'est trop drôle, j'adore!", true);

  // LOAD DB SAFE
  useEffect(() => {
    (async () => {
      if (!db) return;
      try {
        let chats = await db.conversations.toArray();
        if (!chats.length) {
          const id = await db.conversations.add({ title: 'Nouvelle app', updatedAt: Date.now() });
          await db.messages.add({ chatId: id, role: 'assistant', content: "**Salut, c'est Ali.** Prêt à builder.", timestamp: Date.now() });
          chats = [{ id, title: 'Nouvelle app', updatedAt: Date.now() }];
        }
        setConversations(chats.sort((a, b) => b.updatedAt - a.updatedAt));
        setCurrentChatId(chats[0].id);
        const msgs = await db.messages.where('chatId').equals(chats[0].id).sortBy('timestamp');
        if (msgs.length) setMessages(msgs);
      } catch {}
    })();
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const startMic = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return alert("Micro non supporté");
    const r = new SR(); r.lang = 'fr-FR';
    r.onstart = () => setIsListening(true); r.onend = () => setIsListening(false);
    r.onresult = (e) => setInput(e.results[0][0].transcript);
    r.start();
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); if (!input.trim() || loading) return;
    const prompt = input.trim(); setInput('');
    const um = { chatId: currentChatId, role: 'user', content: prompt, timestamp: Date.now(), id: Date.now() };
    setMessages(m => [...m, um]);
    if (db) try { await db.messages.add({ chatId: currentChatId, role: 'user', content: prompt, timestamp: Date.now() }); } catch {}
    setLoading(true);

    // IMAGE DIRECT - pas de LLM = pas de fuite
    if (/image|chien|dog|photo|génère|dessine|picture/i.test(prompt)) {
      const imgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&seed=${Date.now()}`;
      const am = { role: 'assistant', content: `IMG::${imgUrl}`, timestamp: Date.now(), id: Date.now() + 1 };
      setMessages(m => [...m, am]);
      if (db) try { await db.messages.add({ chatId: currentChatId, role: 'assistant', content: `IMG::${imgUrl}`, timestamp: Date.now() }); } catch {}
      speak("Voilà ton image");
      setLoading(false); return;
    }

    try {
      const sys = `Tu es Ali OS. Si CODE demandé, réponds UNIQUEMENT JSON {"files":[{"path":"src/App.jsx","content":"code React"}]}. Sinon français court sans JSON.`;
      const res = await fetch(`https://text.pollinations.ai/${encodeURIComponent(sys + " User:" + prompt)}?model=openai`);
      const raw = await res.text();

      let files = null;
      try {
        const m = raw.match(/\{"files"\s*:\s*\[[\s\S]*?\]\}/);
        if (m) {
          const p = JSON.parse(m[0].replace(/```json|```/g, ''));
          if (p.files?.length) files = p.files;
        }
      } catch {}

      if (files) {
        const safe = files.filter(f => f.path && f.content &&!f.path.includes('..') && f.path.length < 100).slice(0, 12);
        setProjectFiles(safe); setActiveFile(safe[0].path);
        if (db) {
          try { await db.projects.where('chatId').equals(currentChatId).delete(); await db.projects.add({ chatId: currentChatId, files: safe }); } catch {}
        }
        const am = { role: 'assistant', content: `**✅ ${safe.length} fichiers créés.** Preview prêt.`, timestamp: Date.now(), id: Date.now() + 1 };
        setMessages(m => [...m, am]);
        setActiveView('preview');
        speak(`Projet créé, ${safe.length} fichiers`, true);
      } else {
        // NETTOYAGE TOTAL ANTI-FUITE
        let clean = raw.replace(/\{[\s\S]*"tool_calls"[\s\S]*\}/g, '').replace(/<!DOCTYPE[\s\S]*?>/g, '').replace(/<meta[\s\S]*?>/g, '').replace(/framer-motion[\s\S]*$/g, '').replace(/src\/App\.jsx[\s\S]*$/g, '').replace(/\{"role"[\s\S]*$/g, '').trim();
        if (clean.length > 500) clean = clean.slice(0, 500);
        if (!clean) clean = "Salut! Comment ça va? 👋";
        const am = { role: 'assistant', content: clean, timestamp: Date.now(), id: Date.now() + 1 };
        setMessages(m => [...m, am]);
        if (db) try { await db.messages.add({ chatId: currentChatId, role: 'assistant', content: clean, timestamp: Date.now() }); } catch {}
        speak(clean);
      }
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: "Erreur réseau, réessaie.", timestamp: Date.now(), id: Date.now() + 1 }]);
    } finally { setLoading(false); }
  };

  const previewDoc = `<!DOCTYPE html><html><head><script src="https://cdn.tailwindcss.com"><\/script><script src="https://unpkg.com/react@18/umd/react.development.js"><\/script><script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"><\/script><script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script></head><body><div id="root"></div><script type="text/babel">${projectFiles.map(f => f.content).join('\n')}\nconst root=ReactDOM.createRoot(document.getElementById('root')); try{root.render(React.createElement(App))}catch(e){document.body.innerHTML='<pre style=color:red;padding:20px>'+e.message+'</pre>'}\<\/script></body></html>`;

  return (
    <div style={{ height: '100dvh', background: '#07070A', color: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'Inter, system-ui' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@500;700;800&display=swap'); *{box-sizing:border-box} ::-webkit-scrollbar{display:none}`}</style>

      <header style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', borderBottom: '1px solid #1A1A1E', flexShrink: 0, background: '#08080A' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><button onClick={() => setSidebarOpen(true)} style={{ width: 34, height: 34, borderRadius: 10, background: '#151519', border: '1px solid #222', color: '#fff' }}>☰</button><b style={{ fontWeight: 800 }}>Ali</b><span style={{ fontSize: 9, background: '#CCFF00', color: '#000', padding: '3px 7px', borderRadius: 99, fontWeight: 800 }}>EDGE TTS</span></div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <select value={selectedVoice?.name || ''} onChange={e => setSelectedVoice(voices.find(v => v.name === e.target.value))} style={{ background: '#111', color: '#fff', border: '1px solid #222', borderRadius: 20, padding: '4px 8px', fontSize: 11, maxWidth: 90 }}>{voices.map(v => <option key={v.name} value={v.name}>{v.name.slice(0, 15)}</option>)}</select>
          <button onClick={() => speak(messages[messages.length - 1]?.content || "Salut")} style={{ width: 32, height: 32, borderRadius: 99, background: '#CCFF00', color: '#000', border: 'none' }}>🔊</button>
          <button onClick={doLaugh} style={{ width: 32, height: 32, borderRadius: 99, background: '#1A1A1E', border: '1px solid #222' }}>😂</button>
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '18px 0' }}>
            <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 14px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {messages.map((m, i) => (
                <div key={m.id || i} style={{ alignSelf: m.role === 'user'? 'flex-end' : 'flex-start', maxWidth: m.role === 'user'? '80%' : '100%', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  {m.content.startsWith('IMG::')? <div><img src={m.content.replace('IMG::', '')} style={{ maxWidth: 320, borderRadius: 18, border: '1px solid #222' }} /><div style={{ marginTop: 8, fontSize: 13, fontWeight: 700 }}>Image générée 🐶</div></div> : <div style={{ background: m.role === 'user'? '#1A1A1E' : 'transparent', padding: m.role === 'user'? '12px 16px' : '0', borderRadius: m.role === 'user'? '18px 18px 4px 18px' : '0', fontSize: 15, lineHeight: 1.6, border: m.role === 'user'? '1px solid #232326' : 'none', wordBreak: 'break-word' }}>{m.content.replace(/\*\*/g, '')}</div>}
                  {m.role === 'assistant' &&!m.content.startsWith('IMG::') && <><button onClick={() => speak(m.content)} style={{ width: 28, height: 28, borderRadius: 99, background: '#151519', border: '1px solid #222', flexShrink: 0 }}>🔊</button><button onClick={doLaugh} style={{ width: 28, height: 28, borderRadius: 99, background: '#151519', border: '1px solid #222', flexShrink: 0 }}>😂</button></>}
                </div>
              ))}
              {loading && <div style={{ color: '#CCFF00', fontSize: 13, fontWeight: 700 }}>Ali réfléchit...</div>}
              <div ref={chatEndRef} />
            </div>
          </div>

          <div style={{ padding: '10px 12px 14px', borderTop: '1px solid #111', flexShrink: 0, background: '#08080A' }}>
            <form onSubmit={handleSubmit} style={{ maxWidth: 680, margin: '0 auto', display: 'flex', gap: 8, background: '#121214', borderRadius: 28, padding: '6px 8px 6px 14px', border: '1px solid #232326', alignItems: 'center' }}>
              <button type="button" onClick={() => fileInputRef.current.click()} style={{ width: 34, height: 34, borderRadius: '50%', background: '#1E1E22', border: '1px solid #2A2A2E', color: '#fff', cursor: 'pointer' }}>📎</button>
              <input ref={fileInputRef} type="file" hidden onChange={async (e) => { const f = e.target.files[0]; if (f) { const t = await f.text(); setProjectFiles(p => [...p, { path: `src/${f.name}`, content: t }]); setActiveFile(`src/${f.name}`); setActiveView('chat'); } }} />
              <input value={input} onChange={e => setInput(e.target.value)} placeholder="Parle, écris, upload..." style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: 14.5, minWidth: 0 }} />
              <button type="button" onClick={startMic} style={{ width: 34, height: 34, borderRadius: '50%', background: isListening? '#FF3B30' : '#1E1E22', border: '1px solid #2A2A2E', color: '#fff', cursor: 'pointer' }}>{isListening? '●' : '🎤'}</button>
              <button type="button" onClick={doLaugh} style={{ width: 34, height: 34, borderRadius: '50%', background: '#1E1E22', border: '1px solid #2A2A2E', cursor: 'pointer' }}>😂</button>
              <button disabled={loading ||!input.trim()} style={{ width: 38, height: 38, borderRadius: '50%', background: input.trim()? '#CCFF00' : '#222', color: '#000', border: 'none', fontWeight: 900, cursor: 'pointer' }}>↑</button>
            </form>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 6 }}><span style={{ fontSize: 10, color: '#555' }}>🎤 Micro</span><span style={{ fontSize: 10, color: '#555' }}>📎 Upload</span><span style={{ fontSize: 10, color: '#555' }}>🔊 Edge TTS</span><span style={{ fontSize: 10, color: '#555' }}>😂 Rire</span></div>
          </div>
        </div>
      </div>

      {activeView === 'preview' && <div style={{ position: 'fixed', inset: 0, top: 56, background: '#000', zIndex: 30, display: 'flex', flexDirection: 'column' }}><div style={{ height: 40, background: '#0A0A0C', borderBottom: '1px solid #1A1A1E', display: 'flex', alignItems: 'center', padding: '0 12px', justifyContent: 'space-between' }}><span style={{ fontSize: 12, fontWeight: 700 }}>Preview</span><button onClick={() => setActiveView('chat')} style={{ background: '#1A1A1E', border: '1px solid #222', color: '#fff', borderRadius: 20, padding: '4px 12px', fontSize: 12, cursor: 'pointer' }}>Fermer ✕</button></div><iframe srcDoc={previewDoc} style={{ flex: 1, border: 'none', background: '#fff' }} /></div>}

      {sidebarOpen && <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40 }} />}
      <div style={{ position: 'fixed', top: 0, bottom: 0, left: sidebarOpen? 0 : -320, width: 300, background: '#0D0D0F', borderRight: '1px solid #1C1C1F', zIndex: 50, transition: 'left 0.3s', padding: 20, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 24 }}><div style={{ width: 36, height: 36, borderRadius: 12, background: '#CCFF00', display: 'grid', placeItems: 'center', color: '#000', fontWeight: 900 }}>A</div><div><div style={{ fontWeight: 800 }}>Ali OS</div><div style={{ fontSize: 11, color: '#666', fontWeight: 700 }}>V9 FIXED - WORKER READY</div></div></div>
        <button onClick={() => { setMessages([{ role: 'assistant', content: "**Nouvelle discussion.**", timestamp: Date.now() }]); setSidebarOpen(false); }} style={{ background: '#CCFF00', color: '#000', border: 'none', height: 46, borderRadius: 14, fontWeight: 800, cursor: 'pointer' }}>+ Nouveau</button>
      </div>
    </div>
  );
}
