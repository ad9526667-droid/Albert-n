import React, { useState, useRef, useEffect } from 'react';
import Dexie from 'dexie';

const db = new Dexie('AliSuperAgentDB');
db.version(1).stores({
  conversations: '++id, title, updatedAt',
  messages: '++id, chatId, role, content, timestamp',
  projects: '++id, chatId, files'
});

const SYSTEM_INSTRUCTION = `
Tu es Ali Super Agent, un agent de code autonome plus puissant que Replit Agent, Lovable et Bolt.new.
RÈGLES OBLIGATOIRES:
1. Ne réponds JAMAIS en texte simple si on te demande de coder. Tu dois TOUJOURS répondre en JSON.
2. Format JSON attendu: {"thought": "ton plan", "files": [{"path": "src/App.jsx", "content": "code"}, {"path": "src/components/Button.jsx", "content": "code"}]}
3. Tu peux créer autant de fichiers que tu veux. Utilise React + Tailwind.
4. Soigne le design à 100%: glassmorphism, animations, ultra moderne. C'est ton avantage sur Lovable.
5. Si c'est une question simple, réponds normalement sans JSON.
`;

export default function App() {
  const [conversations, setConversations] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeView, setActiveView] = useState('chat');
  const [projectFiles, setProjectFiles] = useState([{ path: 'src/App.jsx', content: 'export default function App(){return <div style={{padding:40, background:"#000", color:"#fff", height:"100vh"}}><h1>Ali Super Agent prêt</h1><p>Décris ton app, je code tout le projet multi-fichiers.</p></div>}' }]);
  const [activeFile, setActiveFile] = useState('src/App.jsx');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    async function init() {
      let chats = await db.conversations.toArray();
      if (chats.length === 0) {
        const id = await db.conversations.add({ title: 'Nouvelle app', updatedAt: Date.now() });
        chats = [{ id, title: 'Nouvelle app', updatedAt: Date.now() }];
        await db.messages.add({ chatId: id, role: 'assistant', content: "Je suis Ali Super Agent. Plus puissant que Lovable, Bolt et Replit Agent. Décris-moi l'application que tu veux et je te génère le projet complet multi-fichiers, design ultra soigné. C'est parti?", timestamp: Date.now() });
      }
      setConversations(chats.sort((a,b)=>b.updatedAt-a.updatedAt));
      setCurrentChatId(chats[0].id);
      const msgs = await db.messages.where('chatId').equals(chats[0].id).sortBy('timestamp');
      setMessages(msgs);
      const proj = await db.projects.where('chatId').equals(chats[0].id).toArray();
      if(proj[0]?.files) setProjectFiles(proj[0].files);
    }
    init();
  }, []);
  useEffect(() => { chatEndRef.current?.scrollIntoView({behavior:'smooth'}); }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if(!input.trim() || loading) return;
    const userPrompt = input.trim();
    setInput('');
    const userMsg = { chatId: currentChatId, role: 'user', content: userPrompt, timestamp: Date.now() };
    setMessages(p=>[...p, userMsg]);
    await db.messages.add(userMsg);
    setLoading(true);
    try {
      const fullPrompt = `${SYSTEM_INSTRUCTION}\n\nPROJET ACTUEL: ${JSON.stringify(projectFiles.map(f=>f.path))}\n\nDEMANDE UTILISATEUR: ${userPrompt}\n\nRéponds en JSON si c'est du code.`;
      const res = await fetch(`https://text.pollinations.ai/${encodeURIComponent(fullPrompt)}?model=openai`);
      const text = await res.text();
      let parsedFiles = null;
      try {
        const jsonMatch = text.match(/\{[\s\S]*"files"[\s\S]*\}/);
        if(jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if(parsed.files && Array.isArray(parsed.files)) parsedFiles = parsed.files;
        }
      } catch {}
      if(parsedFiles) {
        setProjectFiles(parsedFiles);
        setActiveFile(parsedFiles[0].path);
        await db.projects.where('chatId').equals(currentChatId).delete();
        await db.projects.add({ chatId: currentChatId, files: parsedFiles });
        const assistantMsg = { chatId: currentChatId, role: 'assistant', content: `✅ Projet généré: ${parsedFiles.length} fichiers créés.\n\n${parsedFiles.map(f=>`• ${f.path}`).join('\n')}\n\nJe passe en Aperçu.`, timestamp: Date.now() };
        setMessages(p=>[...p, assistantMsg]);
        await db.messages.add(assistantMsg);
        setActiveView('preview');
      } else {
        const assistantMsg = { chatId: currentChatId, role: 'assistant', content: text, timestamp: Date.now() };
        setMessages(p=>[...p, assistantMsg]);
        await db.messages.add(assistantMsg);
      }
    } catch(err) {
      setMessages(p=>[...p, { chatId: currentChatId, role: 'assistant', content: "Erreur réseau. Réessaie.", timestamp: Date.now() }]);
    } finally { setLoading(false); }
  };

  const activeFileContent = projectFiles.find(f=>f.path===activeFile)?.content || '';
  const previewSrcDoc = `
    <!DOCTYPE html><html><head><script src="https://cdn.tailwindcss.com"></script><script src="https://unpkg.com/react@18/umd/react.development.js"><\/script><script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"><\/script><script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script></head>
    <body><div id="root"></div><script type="text/babel">
    ${projectFiles.map(f=>`// FILE: ${f.path}\n${f.content}`).join('\n\n')}
    const root = ReactDOM.createRoot(document.getElementById('root'));
    try { root.render(React.createElement(eval("App") || (()=><div>Export default manquant</div>))); } catch(e){ document.body.innerHTML = '<pre style="color:red;padding:20px">'+e.message+'</pre>'; }
    <\/script></body></html>`;

  return (
    <div style={{ display: 'flex', height: '100dvh', background: '#070708', color: '#f2f2f3', fontFamily: 'Inter, -apple-system, sans-serif', overflow: 'hidden' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400&display=swap'); *{box-sizing:border-box} ::-webkit-scrollbar{display:none}`}</style>

      {sidebarOpen && <div onClick={()=>setSidebarOpen(false)} style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', backdropFilter:'blur(6px)', zIndex:40}}/>}
      <div style={{ width:300, background:'#0E0E10', borderRight:'1px solid #1A1A1E', position:'fixed', top:0, bottom:0, left: sidebarOpen?0:-320, zIndex:50, transition:'left 0.35s cubic-bezier(0.16,1,0.3,1)', display:'flex', flexDirection:'column', padding:20 }}>
        <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:24}}><div style={{width:32,height:32,borderRadius:10,background:'#CCFF00',display:'grid',placeItems:'center',color:'#000',fontWeight:800}}>A</div><div><div style={{fontWeight:700,fontSize:14}}>Ali Studio</div><div style={{fontSize:11,color:'#71717A'}}>v2.0 • Mobile</div></div></div>
        <button onClick={async()=>{ const id=await db.conversations.add({title:'Nouvelle app', updatedAt:Date.now()}); setConversations([{id, title:'Nouvelle app', updatedAt:Date.now()},...conversations]); setCurrentChatId(id); setMessages([]); setSidebarOpen(false); }} style={{background:'#CCFF00', color:'#000', border:'none', height:44, borderRadius:14, fontWeight:700, fontSize:14, cursor:'pointer'}}>+ Nouvelle App</button>
        <div style={{marginTop:20, flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:4}}>{conversations.map(c=> <div key={c.id} onClick={async()=>{ setCurrentChatId(c.id); setMessages(await db.messages.where('chatId').equals(c.id).sortBy('timestamp')); setSidebarOpen(false);}} style={{padding:'11px 12px', borderRadius:12, background: currentChatId===c.id?'#1A1A1E':'transparent', border: currentChatId===c.id?'1px solid #242428':'1px solid transparent', cursor:'pointer', fontSize:13, color: currentChatId===c.id?'#fff':'#8E8E93'}}>{c.title}</div>)}</div>
        <div style={{paddingTop:16, borderTop:'1px solid #1A1A1E', fontSize:11, color:'#52525B'}}>Plus puissant que Bolt, Lovable, Replit</div>
      </div>

      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>
        <header style={{ height:60, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 16px', background:'rgba(7,7,8,0.8)', backdropFilter:'blur(16px)', borderBottom:'1px solid #151519', flexShrink:0 }}>
          <div style={{display:'flex', alignItems:'center', gap:12}}><button onClick={()=>setSidebarOpen(true)} style={{width:38,height:38, borderRadius:12, background:'#141416', border:'1px solid #232326', color:'#fff', cursor:'pointer', display:'grid', placeItems:'center'}}>☰</button><div style={{width:1,height:20,background:'#232326'}}/><span style={{fontWeight:650,fontSize:14.5,letterSpacing:-0.2}}>Ali Super Agent</span><span style={{fontSize:9, fontWeight:700, letterSpacing:0.8, background:'#CCFF00', color:'#000', padding:'3px 7px', borderRadius:99}}>NEON</span></div>
          <div style={{display:'flex', background:'#101012', borderRadius:999, padding:4, border:'1px solid #1E1E22', gap:4}}>{[{id:'chat', l:'Chat'}, {id:'files', l:'Code'}, {id:'preview', l:'Preview'}].map(t=> <button key={t.id} onClick={()=>setActiveView(t.id)} style={{background: activeView===t.id?'#1E1E22':'transparent', color: activeView===t.id?'#fff':'#71717A', border:'none', padding:'7px 14px', borderRadius:999, fontSize:12.5, fontWeight:600, cursor:'pointer', transition:'all 0.2s'}}>{t.l}</button>)}</div>
        </header>

        <div style={{ flex:1, display:'flex', overflow:'hidden', minWidth:0 }}>
          {activeView==='chat' && (
            <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', background:'#070708' }}>
              <div style={{ flex:1, overflowY:'auto', padding:'20px 0' }}>
                <div style={{ maxWidth:700, width:'100%', margin:'0 auto', padding:'0 16px', display:'flex', flexDirection:'column', gap:24 }}>
                  {messages.map((m,i)=>(
                    <div key={i} style={{ display:'flex', flexDirection:'column', alignItems: m.role==='user'?'flex-end':'flex-start' }}>
                      {m.role==='user'? <div style={{ maxWidth:'85%', background:'#1A1A1E', border:'1px solid #232326', padding:'13px 18px', borderRadius:'20px 20px 6px 20px', fontSize:14.5, lineHeight:1.5, color:'#F4F4F5' }}>{m.content}</div> : <div style={{ width:'100%', whiteSpace:'pre-wrap', lineHeight:1.75, fontSize:14.5, color:'#D4D4D8', wordBreak:'break-word' }}>{m.content}</div>}
                    </div>
                  ))}
                  {loading && <div style={{display:'flex', alignItems:'center', gap:10, color:'#CCFF00', fontSize:13, fontWeight:500}}><div style={{width:18,height:18,border:'2px solid #1A1A1E',borderTopColor:'#CCFF00',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>Ali génère {projectFiles.length} fichiers...</div>}
                  <div ref={chatEndRef} />
                </div>
              </div>
              <div style={{ padding:'12px 12px 16px', background:'linear-gradient(to top, #070708 85%, transparent)', flexShrink:0 }}>
                <div style={{maxWidth:700, margin:'0 auto'}}>
                  <form onSubmit={handleSubmit} style={{ display:'flex', alignItems:'center', gap:10, background:'#131316', borderRadius:24, padding:'6px 6px 6px 18px', border:'1px solid #232326', boxShadow:'0 10px 40px rgba(0,0,0,0.5)' }}>
                    <input value={input} onChange={e=>setInput(e.target.value)} placeholder="Décris une app SaaS, dashboard, clone..." style={{ flex:1, background:'transparent', border:'none', color:'#fff', outline:'none', fontSize:14.5, minWidth:0 }} />
                    <button disabled={loading ||!input.trim()} style={{ background: input.trim()?'#CCFF00':'#1E1E22', color: input.trim()?'#000':'#52525B', border:'none', width:40, height:40, borderRadius:'50%', cursor:'pointer', fontWeight:700, transition:'all 0.2s', flexShrink:0 }}>↑</button>
                  </form>
                  <div style={{textAlign:'center', fontSize:10, color:'#3F3F46', marginTop:8, letterSpacing:0.2}}>Ali peut se tromper. Vérifie les infos importantes.</div>
                </div>
              </div>
            </div>
          )}
          {activeView==='files' && (
            <div style={{ flex:1, display:'flex', background:'#09090B', minWidth:0 }}>
              <div style={{ width:200, borderRight:'1px solid #151519', background:'#0C0C0E', padding:10, overflowY:'auto', flexShrink:0 }}>{projectFiles.map(f=> <div key={f.path} onClick={()=>setActiveFile(f.path)} style={{ padding:'9px 10px', borderRadius:10, background: activeFile===f.path?'#1A1A1E':'transparent', border: activeFile===f.path?'1px solid #232326':'1px solid transparent', color: activeFile===f.path?'#CCFF00':'#71717A', cursor:'pointer', fontSize:11.5, fontFamily:'JetBrains Mono, monospace', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', marginBottom:4 }}>{f.path}</div>)}</div>
              <textarea value={activeFileContent} onChange={e=>{ setProjectFiles(prev=> prev.map(p=> p.path===activeFile? {...p, content: e.target.value}: p)); }} style={{ flex:1, background:'#070708', color:'#E4E4E7', border:'none', padding:16, fontFamily:'JetBrains Mono, monospace', fontSize:12.5, outline:'none', resize:'none', lineHeight:1.6 }} spellCheck={false} />
            </div>
          )}
          {activeView==='preview' && <iframe title="preview" srcDoc={previewSrcDoc} style={{ flex:1, border:'none', background:'#fff' }} />}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
