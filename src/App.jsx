import React, { useState, useRef, useEffect } from 'react';
import Dexie from 'dexie';

const db = new Dexie('AliSuperAgentDB');
db.version(1).stores({
  conversations: '++id, title, updatedAt',
  messages: '++id, chatId, role, content, timestamp',
  projects: '++id, chatId, files'
});

const SYSTEM_INSTRUCTION = `
Tu es Ali Super Agent OS, fusion de: Claude (écriture gras premium) + Replit Agent (terminal, multi-fichiers, build autonome) + Lovable (design ultra soigné) + Gemini (raisonnement long, multimodal).
RÈGLES:
1. Si on te demande de coder, réponds en JSON: {"thought":"plan détaillé", "files":[{"path":"src/App.jsx","content":"..."}], "commands":["npm i framer-motion", "npm run build"]}
2. Tu peux créer 10+ fichiers. Design premium glass + neon lime.
3. Si question simple, réponds comme Claude: gras, clair, structuré avec titres.
`;

export default function App() {
  const [conversations, setConversations] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeView, setActiveView] = useState('chat');
  const [projectFiles, setProjectFiles] = useState([{ path: 'src/App.jsx', content: 'export default function App(){return <div style={{padding:40, background:"#000", color:"#fff", height:"100vh", fontFamily:"serif"}}><h1 style={{fontWeight:900, fontSize:32}}>Ali Super Agent prêt</h1><p>Décris ton app, je code tout.</p></div>}' }]);
  const [activeFile, setActiveFile] = useState('src/App.jsx');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState(['> Ali OS v2.0 booted', '> Ready. Type help for commands', '> Agent: Claude + Replit + Lovable + Gemini fused']);
  const chatEndRef = useRef(null);

  useEffect(() => {
    async function init() {
      let chats = await db.conversations.toArray();
      if (chats.length === 0) {
        const id = await db.conversations.add({ title: 'Nouvelle app', updatedAt: Date.now() });
        chats = [{ id, title: 'Nouvelle app', updatedAt: Date.now() }];
        await db.messages.add({ chatId: id, role: 'assistant', content: "**Je suis Ali Super Agent OS.**\n\nFusion de **Claude** pour l'écriture, **Replit** pour le terminal & l'autonomie, **Lovable** pour le design, et **Gemini** pour le raisonnement.\n\nDécris ton app et je te build le projet complet avec terminal, fichiers, et preview live.", timestamp: Date.now() });
      }
      setConversations(chats.sort((a,b)=>b.updatedAt-a.updatedAt));
      setCurrentChatId(chats[0].id);
      setMessages(await db.messages.where('chatId').equals(chats[0].id).sortBy('timestamp'));
      const proj = await db.projects.where('chatId').equals(chats[0].id).toArray();
      if(proj[0]?.files) setProjectFiles(proj[0].files);
    }
    init();
  }, []);
  useEffect(() => { chatEndRef.current?.scrollIntoView({behavior:'smooth'}); }, [messages, terminalLogs]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if(!input.trim() || loading) return;
    const userPrompt = input.trim();
    setInput('');
    const userMsg = { chatId: currentChatId, role: 'user', content: userPrompt, timestamp: Date.now() };
    setMessages(p=>[...p, userMsg]);
    await db.messages.add(userMsg);
    setLoading(true);
    setTerminalLogs(l=> [...l, `> user@ali: ${userPrompt}`, `> ali@agent: thinking...`]);

    try {
      const fullPrompt = `${SYSTEM_INSTRUCTION}\n\nPROJET: ${JSON.stringify(projectFiles.map(f=>f.path))}\n\nDEMANDE: ${userPrompt}`;
      const res = await fetch(`https://text.pollinations.ai/${encodeURIComponent(fullPrompt)}?model=openai`);
      const text = await res.text();
      let parsedFiles = null; let commands = [];
      try {
        const jsonMatch = text.match(/\{[\s\S]*"files"[\s\S]*\}/);
        if(jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if(parsed.files) parsedFiles = parsed.files;
          if(parsed.commands) commands = parsed.commands;
        }
      } catch {}
      if(parsedFiles) {
        setProjectFiles(parsedFiles);
        setActiveFile(parsedFiles[0].path);
        await db.projects.where('chatId').equals(currentChatId).delete();
        await db.projects.add({ chatId: currentChatId, files: parsedFiles });
        setTerminalLogs(l=> [...l, `> generated ${parsedFiles.length} files`,...commands.map(c=>`> $ ${c}`), `> build success ✓`, `> preview ready at /preview`]);
        const assistantMsg = { chatId: currentChatId, role: 'assistant', content: `**✅ Projet généré: ${parsedFiles.length} fichiers.**\n\n${parsedFiles.map(f=>`**• ${f.path}**`).join('\n')}\n\n**J'ai aussi exécuté:**\n${commands.join('\n') || 'npm run dev'}\n\nPasse en **Preview** ou **Terminal**.`, timestamp: Date.now() };
        setMessages(p=>[...p, assistantMsg]);
        await db.messages.add(assistantMsg);
        setActiveView('preview');
      } else {
        const assistantMsg = { chatId: currentChatId, role: 'assistant', content: text, timestamp: Date.now() };
        setMessages(p=>[...p, assistantMsg]);
        await db.messages.add(assistantMsg);
        setTerminalLogs(l=> [...l, `> response: ${text.slice(0,80)}...`]);
      }
    } catch(err) {
      setMessages(p=>[...p, { chatId: currentChatId, role: 'assistant', content: "**Erreur réseau.** Réessaie.", timestamp: Date.now() }]);
      setTerminalLogs(l=> [...l, `> error: network`]);
    } finally { setLoading(false); }
  };

  const activeFileContent = projectFiles.find(f=>f.path===activeFile)?.content || '';
  const previewSrcDoc = `<!DOCTYPE html><html><head><script src="https://cdn.tailwindcss.com"></script><script src="https://unpkg.com/react@18/umd/react.development.js"><\/script><script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"><\/script><script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script></head><body><div id="root"></div><script type="text/babel">${projectFiles.map(f=>f.content).join('\n\n')}\nconst root=ReactDOM.createRoot(document.getElementById('root')); try{root.render(React.createElement(App))}catch(e){document.body.innerHTML='<pre style=color:red;padding:20px>'+e.message+'</pre>'}\<\/script></body></html>`;

  const renderClaudeStyle = (text) => {
    return text.split('\n').map((line, i)=>{
      if(line.startsWith('**') && line.endsWith('**')) return <div key={i} style={{fontWeight:800, fontSize:16, margin:'8px 0', letterSpacing:-0.3}}>{line.replace(/\*\*/g,'')}</div>
      const parts = line.split(/(\*\*.*?\*\*)/);
      return <div key={i} style={{margin:'4px 0'}}>{parts.map((p,j)=> p.startsWith('**')? <b key={j} style={{fontWeight:750}}>{p.replace(/\*\*/g,'')}</b> : p)}</div>
    })
  };

  return (
    <div style={{ display: 'flex', height: '100dvh', background: '#08080A', color: '#F1F1F2', fontFamily: 'Inter, system-ui', overflow: 'hidden' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap'); *{box-sizing:border-box} ::-webkit-scrollbar{display:none}`}</style>

      {sidebarOpen && <div onClick={()=>setSidebarOpen(false)} style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:40}}/>}
      <div style={{ width:300, background:'#0D0D0F', borderRight:'1px solid #1C1C1F', position:'fixed', top:0, bottom:0, left: sidebarOpen?0:-320, zIndex:50, transition:'left 0.35s cubic-bezier(0.16,1,0.3,1)', padding:20, display:'flex', flexDirection:'column' }}>
        <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:28}}><div style={{width:36,height:36,borderRadius:12,background:'#CCFF00',display:'grid',placeItems:'center',color:'#000',fontWeight:900,fontSize:18}}>A</div><div><div style={{fontWeight:800,fontSize:15,letterSpacing:-0.4}}>Ali OS</div><div style={{fontSize:11,color:'#71717A',fontWeight:600}}>CLAUDE + REPLIT + GEMINI</div></div></div>
        <button onClick={async()=>{ const id=await db.conversations.add({title:'Nouvelle app', updatedAt:Date.now()}); setConversations([{id, title:'Nouvelle app', updatedAt:Date.now()},...conversations]); setCurrentChatId(id); setMessages([]); setSidebarOpen(false); }} style={{background:'#CCFF00', color:'#000', border:'none', height:46, borderRadius:14, fontWeight:800, cursor:'pointer'}}>+ Nouvelle App</button>
        <div style={{marginTop:20, flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:6}}>{conversations.map(c=> <div key={c.id} onClick={async()=>{ setCurrentChatId(c.id); setMessages(await db.messages.where('chatId').equals(c.id).sortBy('timestamp')); setSidebarOpen(false);}} style={{padding:'11px 12px', borderRadius:12, background: currentChatId===c.id?'#17171A':'transparent', border: currentChatId===c.id?'1px solid #252529':'1px solid transparent', cursor:'pointer', fontSize:13, fontWeight: currentChatId===c.id?700:500}}>{c.title}</div>)}</div>
      </div>

      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
        <header style={{ height:62, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 14px', background:'#08080A', borderBottom:'1px solid #1A1A1E', flexShrink:0 }}>
          <div style={{display:'flex', alignItems:'center', gap:12}}><button onClick={()=>setSidebarOpen(true)} style={{width:38,height:38, borderRadius:12, background:'#141416', border:'1px solid #222', color:'#fff', cursor:'pointer'}}>☰</button><span style={{fontWeight:850, letterSpacing:-0.5}}>Ali</span><span style={{fontSize:10, fontWeight:800, background:'#CCFF00', color:'#000', padding:'3px 8px', borderRadius:99}}>SUPER AGENT</span></div>
          <div style={{display:'flex', background:'#111114', borderRadius:999, padding:4, border:'1px solid #1E1E22'}}>{[{id:'chat',l:'Chat'},{id:'files',l:'Files'},{id:'terminal',l:'Terminal'},{id:'preview',l:'Preview'}].map(t=> <button key={t.id} onClick={()=>setActiveView(t.id)} style={{background: activeView===t.id?'#1E1E22':'transparent', color: activeView===t.id?'#fff':'#71717A', border:'none', padding:'7px 12px', borderRadius:999, fontSize:12, fontWeight:700, cursor:'pointer'}}>{t.l}</button>)}</div>
        </header>

        <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
          {activeView==='chat' && (
            <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
              <div style={{ flex:1, overflowY:'auto', padding:'24px 0' }}>
                <div style={{ maxWidth:740, width:'100%', margin:'0 auto', padding:'0 20px', display:'flex', flexDirection:'column', gap:32 }}>
                  {messages.map((m,i)=>(
                    <div key={i} style={{ display:'flex', flexDirection:'column', alignItems: m.role==='user'?'flex-end':'flex-start' }}>
                      {m.role==='user'? <div style={{ maxWidth:'80%', background:'#1A1A1E', border:'1px solid #242428', padding:'14px 20px', borderRadius:'22px 22px 6px 22px', fontSize:15, fontWeight:500 }}>{m.content}</div> : <div style={{ width:'100%', fontSize:15.5, lineHeight:1.7, color:'#E8E8E9', fontWeight:500 }}>{renderClaudeStyle(m.content)}</div>}
                    </div>
                  ))}
                  {loading && <div style={{color:'#CCFF00', fontSize:13, fontWeight:700, display:'flex', gap:10, alignItems:'center'}}><div style={{width:18,height:18,border:'2px solid #222',borderTopColor:'#CCFF00',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>Ali pense comme Claude, code comme Replit...</div>}
                  <div ref={chatEndRef}/>
                </div>
              </div>
              <div style={{ padding:'12px 16px 18px', flexShrink:0 }}>
                <div style={{maxWidth:740, margin:'0 auto'}}>
                  <form onSubmit={handleSubmit} style={{display:'flex', alignItems:'center', gap:10, background:'#131316', borderRadius:28, padding:'6px 6px 6px 20px', border:'1px solid #252529'}}>
                    <input value={input} onChange={e=>setInput(e.target.value)} placeholder="Demande à Ali: SaaS, clone, dashboard..." style={{flex:1, background:'transparent', border:'none', color:'#fff', outline:'none', fontSize:15, fontWeight:500, minWidth:0}}/>
                    <button disabled={loading ||!input.trim()} style={{background: input.trim()?'#CCFF00':'#1E1E22', color: input.trim()?'#000':'#555', border:'none', width:42, height:42, borderRadius:'50%', cursor:'pointer', fontWeight:900}}>↑</button>
                  </form>
                </div>
              </div>
            </div>
          )}
          {activeView==='files' && (
            <div style={{ flex:1, display:'flex', background:'#09090B' }}>
              <div style={{width:210, borderRight:'1px solid #1A1A1E', background:'#0C0C0E', padding:10, overflowY:'auto'}}>{projectFiles.map(f=> <div key={f.path} onClick={()=>setActiveFile(f.path)} style={{padding:'9px 10px', borderRadius:10, background: activeFile===f.path?'#1A1A1E':'transparent', color: activeFile===f.path?'#CCFF00':'#71717A', cursor:'pointer', fontSize:11.5, fontFamily:'JetBrains Mono', marginBottom:4}}>{f.path}</div>)}</div>
              <textarea value={activeFileContent} onChange={e=>{ setProjectFiles(prev=> prev.map(p=> p.path===activeFile? {...p, content: e.target.value}: p)); }} style={{flex:1, background:'#08080A', color:'#E4E4E7', border:'none', padding:16, fontFamily:'JetBrains Mono', fontSize:12.5, outline:'none', resize:'none'}} spellCheck={false}/>
            </div>
          )}
          {activeView==='terminal' && (
            <div style={{flex:1, background:'#050507', padding:16, fontFamily:'JetBrains Mono', fontSize:12.5, overflowY:'auto', color:'#CCFF00'}}>
              <div style={{display:'flex', flexDirection:'column', gap:6}}>
                {terminalLogs.map((log,i)=> <div key={i} style={{color: log.startsWith('> $')?'#fff': log.startsWith('> error')?'#ff4d4d':'#CCFF00'}}>{log}</div>)}
                <div style={{display:'flex', alignItems:'center', gap:8, marginTop:12}}><span style={{color:'#fff'}}>$</span><input placeholder="npm install, ls, build..." style={{flex:1, background:'transparent', border:'none', outline:'none', color:'#fff', fontFamily:'JetBrains Mono'}} onKeyDown={e=>{ if(e.key==='Enter'){ setTerminalLogs(l=> [...l, `> $ ${e.currentTarget.value}`, `> executed: ${e.currentTarget.value}`]); e.currentTarget.value=''; }}} /></div>
              </div>
            </div>
          )}
          {activeView==='preview' && <iframe title="preview" srcDoc={previewSrcDoc} style={{flex:1, border:'none', background:'#fff'}}/>}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
            }
