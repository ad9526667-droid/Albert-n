import React, { useState, useRef, useEffect } from 'react';
import Dexie from 'dexie';

const db = new Dexie('AliMobileNeonDB');
db.version(1).stores({
  conversations: '++id, title, updatedAt',
  messages: '++id, chatId, role, content, timestamp',
  projects: '++id, chatId, files'
});

const SYSTEM = `Tu es Ali Super Agent, agent mobile le plus puissant que Lovable/Bolt/Replit.
Si on te demande de coder, réponds UNIQUEMENT en JSON: {"thought":"plan", "files":[{"path":"src/App.jsx","content":"..."}]}
Sinon réponds normalement. Design ultra premium mobile, Tailwind, glass, neon, animations.`;

export default function App() {
  const [conversations, setConversations] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('chat'); // chat | build | preview
  const [files, setFiles] = useState([{ path: 'src/App.jsx', content: `export default function App(){return <div style={{height:'100vh',background:'#050507',color:'#fff',display:'grid',placeItems:'center',fontFamily:'system-ui'}}><div style={{textAlign:'center'}}><div style={{width:64,height:64,margin:'0 auto 16px',borderRadius:20,background:'linear-gradient(135deg,#00FFD1,#8B5CF6)',boxShadow:'0 0 40px rgba(0,255,209,0.5)'}}/><h1 style={{fontSize:24,fontWeight:700,letterSpacing:-0.5}}>Ali Mobile</h1><p style={{opacity:0.5,marginTop:8}}>Dis-moi quelle app tu veux créer</p></div></div>}` }]);
  const [activeFile, setActiveFile] = useState('src/App.jsx');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const endRef = useRef(null);
  useEffect(()=>{ endRef.current?.scrollIntoView({behavior:'smooth'}) },[messages, loading]);

  useEffect(()=>{
    (async()=>{
      let chats = await db.conversations.toArray();
      if(!chats.length){
        const id = await db.conversations.add({title:'Nouvelle app', updatedAt:Date.now()});
        chats=[{id,title:'Nouvelle app',updatedAt:Date.now()}];
        await db.messages.add({chatId:id, role:'assistant', content:"Yo, c'est Ali. Je suis ton agent mobile ultra puissant. Tu veux quoi comme app? Un SaaS? Un clone? Dis-moi et je te build tout le projet en néon, direct sur ton tel.", timestamp:Date.now()});
      }
      setConversations(chats.sort((a,b)=>b.updatedAt-a.updatedAt));
      setCurrentChatId(chats[0].id);
      setMessages(await db.messages.where('chatId').equals(chats[0].id).sortBy('timestamp'));
      const p = await db.projects.where('chatId').equals(chats[0].id).toArray();
      if(p[0]?.files) setFiles(p[0].files);
    })();
  },[]);

  const handleSend = async (e)=>{
    e.preventDefault();
    if(!input.trim()||loading) return;
    const prompt = input.trim(); setInput('');
    const u = {chatId:currentChatId, role:'user', content:prompt, timestamp:Date.now()};
    setMessages(m=>[...m,u]); await db.messages.add(u);
    setLoading(true);
    try{
      const res = await fetch(`https://text.pollinations.ai/${encodeURIComponent(SYSTEM+"\n\nUSER: "+prompt)}?model=openai`);
      const txt = await res.text();
      let parsed = null;
      try{ const j = txt.match(/\{[\s\S]*"files"[\s\S]*\}/); if(j) parsed = JSON.parse(j[0]); }catch{}
      if(parsed?.files){
        setFiles(parsed.files); setActiveFile(parsed.files[0].path);
        await db.projects.where('chatId').equals(currentChatId).delete();
        await db.projects.add({chatId:currentChatId, files:parsed.files});
        const a = {chatId:currentChatId, role:'assistant', content:`Fait. ${parsed.files.length} fichiers générés. Regarde l'aperçu →`, timestamp:Date.now()};
        setMessages(m=>[...m,a]); await db.messages.add(a);
        setView('preview');
      }else{
        const a = {chatId:currentChatId, role:'assistant', content:txt, timestamp:Date.now()};
        setMessages(m=>[...m,a]); await db.messages.add(a);
      }
    }finally{ setLoading(false); }
  };

  const previewDoc = `<!DOCTYPE html><html><head><script src="https://cdn.tailwindcss.com"></script><script src="https://unpkg.com/react@18/umd/react.development.js"><\/script><script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"><\/script><script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/></head><body style="margin:0;background:#050507"><div id="root"></div><script type="text/babel">${files.map(f=>`//${f.path}\n${f.content}`).join('\n\n')}\nconst root=ReactDOM.createRoot(document.getElementById('root')); try{root.render(React.createElement(App))}catch(e){document.body.innerHTML='<div style="padding:24px;color:#ff4d4d;font-family:monospace">'+e.message+'</div>'}<\/script></body></html>`;

  return (
    <div style={{height:'100vh', background:'#050507', color:'#fff', display:'flex', flexDirection:'column', fontFamily:'-apple-system,BlinkMacSystemFont,Inter,sans-serif', overflow:'hidden', position:'relative'}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'); *{font-family:Inter,sans-serif} ::-webkit-scrollbar{display:none}`}</style>

      {/* HEADER ULTRA CLEAN MOBILE */}
      <header style={{height:54, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 16px', background:'rgba(5,5,7,0.8)', backdropFilter:'blur(20px)', borderBottom:'1px solid rgba(255,255,255,0.06)', position:'sticky', top:0, zIndex:10}}>
        <div style={{display:'flex', alignItems:'center', gap:10}}>
          <button onClick={()=>setSidebarOpen(true)} style={{width:36,height:36, borderRadius:12, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', display:'grid', placeItems:'center', cursor:'pointer'}}>≡</button>
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            <div style={{width:28,height:28, borderRadius:9, background:'linear-gradient(135deg,#00FFD1 0%,#8B5CF6 100%)', boxShadow:'0 0 20px rgba(0,255,209,0.4)'}}/>
            <span style={{fontWeight:700, fontSize:15, letterSpacing:-0.3}}>ali</span>
            <span style={{fontSize:10, padding:'2px 6px', borderRadius:20, background:'rgba(0,255,209,0.1)', border:'1px solid rgba(0,255,209,0.2)', color:'#00FFD1', fontWeight:600}}>PRO</span>
          </div>
        </div>
        <div style={{width:32,height:32, borderRadius:'50%', background:'linear-gradient(135deg,#1a1a1f,#2a2a33)', border:'1px solid rgba(255,255,255,0.08)'}}/>
      </header>

      {/* SIDEBAR */}
      {sidebarOpen && <div onClick={()=>setSidebarOpen(false)} style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)', zIndex:20}}/>}
      <div style={{position:'fixed', top:0, bottom:0, left: sidebarOpen?0:-320, width:300, background:'#0a0a0f', borderRight:'1px solid rgba(255,255,255,0.06)', zIndex:30, transition:'all 0.4s cubic-bezier(0.16,1,0.3,1)', padding:20, display:'flex', flexDirection:'column'}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24}}><span style={{fontWeight:700}}>Projets</span><button onClick={()=>setSidebarOpen(false)} style={{width:28,height:28, borderRadius:'50%', background:'rgba(255,255,255,0.06)', border:'none', color:'#fff', cursor:'pointer'}}>✕</button></div>
        <button onClick={async()=>{const id=await db.conversations.add({title:'Nouvelle app', updatedAt:Date.now()}); setConversations([{id,title:'Nouvelle app',updatedAt:Date.now()},...conversations]); setCurrentChatId(id); setMessages([]); setSidebarOpen(false);}} style={{height:44, borderRadius:14, background:'#fff', color:'#000', border:'none', fontWeight:600, cursor:'pointer', boxShadow:'0 0 20px rgba(255,255,255,0.2)'}}>+ Nouvelle App</button>
        <div style={{marginTop:20, display:'flex', flexDirection:'column', gap:6, overflowY:'auto'}}>{conversations.map(c=> <div key={c.id} onClick={async()=>{ setCurrentChatId(c.id); setMessages(await db.messages.where('chatId').equals(c.id).sortBy('timestamp')); setSidebarOpen(false);}} style={{padding:'12px 14px', borderRadius:12, background: currentChatId===c.id?'rgba(255,255,255,0.08)':'transparent', cursor:'pointer', fontSize:13, border: currentChatId===c.id?'1px solid rgba(255,255,255,0.08)':'1px solid transparent'}}>{c.title}</div>)}</div>
      </div>

      {/* MAIN */}
      <div style={{flex:1, display:'flex', flexDirection:'column', overflow:'hidden'}}>
        {view==='chat' && (
          <>
            <div style={{flex:1, overflowY:'auto', padding:'20px 16px'}}>
              <div style={{maxWidth:640, margin:'0 auto', display:'flex', flexDirection:'column', gap:20}}>
                {messages.map((m,i)=>(
                  <div key={i} style={{display:'flex', flexDirection:'column', alignItems: m.role==='user'?'flex-end':'flex-start'}}>
                    {m.role==='user'? (
                      <div style={{background:'linear-gradient(135deg,#1e1e22,#232326)', border:'1px solid rgba(255,255,255,0.06)', padding:'12px 18px', borderRadius:'20px 20px 6px 20px', fontSize:14.5, lineHeight:1.5, maxWidth:'88%', boxShadow:'0 4px 20px rgba(0,0,0,0.3)'}}>{m.content}</div>
                    ):(
                      <div style={{width:'100%'}}>
                        <div style={{fontSize:14.5, lineHeight:1.7, color:'#d4d4d8', whiteSpace:'pre-wrap'}}>{m.content}</div>
                        <div style={{display:'flex', gap:12, marginTop:12}}>
                          <button onClick={()=>navigator.clipboard.writeText(m.content)} style={{width:28,height:28, borderRadius:8, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.06)', color:'#71717a', cursor:'pointer', fontSize:12}}>⎙</button>
                          <button style={{width:28,height:28, borderRadius:8, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.06)', color:'#71717a', cursor:'pointer', fontSize:12}}>↗</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {loading && <div style={{display:'flex', gap:8, alignItems:'center', color:'#00FFD1', fontSize:13}}><div style={{width:20,height:20, border:'2px solid rgba(0,255,209,0.2)', borderTopColor:'#00FFD1', borderRadius:'50%', animation:'spin 0.8s linear infinite'}}/> <span>Ali build en cours...</span></div>}
                <div ref={endRef}/>
              </div>
            </div>
            <div style={{padding:'0 16px 24px', background:'linear-gradient(to top, #050507 60%, transparent)'}}>
              <div style={{maxWidth:640, margin:'0 auto'}}>
                <div style={{fontSize:10, color:'rgba(255,255,255,0.3)', textAlign:'center', marginBottom:10, letterSpacing:0.5}}>ALIMOBILE NEON • PLUS PUISSANT QUE BOLT • LOVABLE • REPLIT</div>
                <form onSubmit={handleSend} style={{display:'flex', alignItems:'center', gap:8, background:'rgba(20,20,25,0.9)', border:'1px solid rgba(255,255,255,0.08)', backdropFilter:'blur(20px)', borderRadius:28, padding:'6px 6px 6px 18px', boxShadow:'0 0 0 1px rgba(255,255,255,0.03), 0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(139,92,246,0.1)'}}>
                  <span style={{color:'rgba(255,255,255,0.3)', fontSize:20}}>+</span>
                  <input value={input} onChange={e=>setInput(e.target.value)} placeholder="Décris ton app..." style={{flex:1, background:'transparent', border:'none', outline:'none', color:'#fff', fontSize:15}}/>
                  <button type="submit" disabled={!input.trim()||loading} style={{width:42,height:42, borderRadius:'50%', background: input.trim()?'linear-gradient(135deg,#00FFD1,#8B5CF6)':'rgba(255,255,255,0.08)', color: input.trim()?'#000':'#71717a', border:'none', cursor:'pointer', fontWeight:700, boxShadow: input.trim()?'0 0 20px rgba(0,255,209,0.5)':'none', transition:'all 0.2s'}}>↑</button>
                </form>
              </div>
            </div>
          </>
        )}
        {view==='build' && (
          <div style={{flex:1, display:'flex', background:'#08080a'}}>
            <div style={{width:180, borderRight:'1px solid rgba(255,255,255,0.06)', padding:10, overflowY:'auto'}}>{files.map(f=> <div key={f.path} onClick={()=>setActiveFile(f.path)} style={{padding:'10px 12px', borderRadius:10, background: activeFile===f.path?'rgba(0,255,209,0.08)':'transparent', border: activeFile===f.path?'1px solid rgba(0,255,209,0.15)':'1px solid transparent', color: activeFile===f.path?'#00FFD1':'#71717a', cursor:'pointer', fontSize:11, fontFamily:'monospace', marginBottom:4}}>{f.path}</div>)}</div>
            <textarea value={files.find(f=>f.path===activeFile)?.content||''} onChange={e=> setFiles(p=> p.map(x=> x.path===activeFile? {...x, content:e.target.value}:x))} style={{flex:1, background:'#050507', color:'#d4d4d8', border:'none', padding:16, fontFamily:'Geist Mono, monospace', fontSize:12.5, outline:'none', resize:'none'}}/>
          </div>
        )}
        {view==='preview' && <iframe srcDoc={previewDoc} style={{flex:1, border:'none', background:'#050507'}}/>}
      </div>

      {/* BOTTOM TAB BAR VRAIE APP MOBILE */}
      <nav style={{height:72, background:'rgba(10,10,15,0.9)', backdropFilter:'blur(24px)', borderTop:'1px solid rgba(255,255,255,0.06)', display:'flex', justifyContent:'space-around', alignItems:'center', padding:'0 8px 8px', position:'sticky', bottom:0}}>
        {[
          {id:'chat', icon:'◐', label:'Chat'},
          {id:'build', icon:'◑', label:'Code'},
          {id:'preview', icon:'◎', label:'Preview'},
        ].map(tab=>(
          <button key={tab.id} onClick={()=>setView(tab.id)} style={{flex:1, height:48, borderRadius:16, background: view===tab.id?'rgba(255,255,255,0.08)':'transparent', border: view===tab.id?'1px solid rgba(255,255,255,0.08)':'1px solid transparent', color: view===tab.id?'#fff':'#52525b', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2, position:'relative'}}>
            {view===tab.id && <div style={{position:'absolute', top:-1, left:'30%', right:'30%', height:2, background:'linear-gradient(90deg,#00FFD1,#8B5CF6)', borderRadius:2, boxShadow:'0 0 10px #00FFD1'}}/>}
            <span style={{fontSize:18}}>{tab.icon}</span><span style={{fontSize:10, fontWeight:600}}>{tab.label}</span>
          </button>
        ))}
      </nav>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
      }
