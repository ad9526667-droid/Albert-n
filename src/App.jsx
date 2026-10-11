import React, { useState, useRef, useEffect } from 'react';
import Dexie from 'dexie';

const db = new Dexie('AliCleanDB');
db.version(1).stores({
  conversations: '++id, title, updatedAt',
  messages: '++id, chatId, role, content, timestamp',
  projects: '++id, chatId, files'
});

const SYSTEM = `Tu es Ali, agent code mobile super puissant (meilleur que Lovable/Bolt/Replit). Si on te demande de coder, réponds en JSON: {"files":[{"path":"src/App.jsx","content":"code complet React + Tailwind ultra premium"}]}. Sinon réponds normalement, court, pro.`;

export default function App() {
  const [conversations, setConversations] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('chat');
  const [files, setFiles] = useState([{ path: 'src/App.jsx', content: 'export default function App(){return <div style={{height:"100vh",display:"grid",placeItems:"center",background:"#000",color:"#fff"}}>Ali prêt</div>}' }]);
  const [activeFile, setActiveFile] = useState('src/App.jsx');
  const [menuOpen, setMenuOpen] = useState(false);
  const endRef = useRef(null);
  useEffect(()=> endRef.current?.scrollIntoView({behavior:'smooth'}), [messages, loading]);

  useEffect(()=>{
    (async()=>{
      let chats = await db.conversations.toArray();
      if(!chats.length){
        const id = await db.conversations.add({title:'Nouveau', updatedAt:Date.now()});
        chats=[{id, title:'Nouveau', updatedAt:Date.now()}];
        await db.messages.add({chatId:id, role:'assistant', content:"Salut, c'est Ali. Ton agent mobile. Tu veux builder quoi aujourd'hui? Décris ton app et je code.", timestamp:Date.now()});
      }
      setConversations(chats.sort((a,b)=>b.updatedAt-a.updatedAt));
      setCurrentChatId(chats[0].id);
      setMessages(await db.messages.where('chatId').equals(chats[0].id).sortBy('timestamp'));
      const proj = await db.projects.where('chatId').equals(chats[0].id).toArray();
      if(proj[0]?.files) setFiles(proj[0].files);
    })();
  },[]);

  const send = async (e)=>{
    e.preventDefault();
    if(!input.trim()||loading) return;
    const prompt=input.trim(); setInput('');
    const um={chatId:currentChatId, role:'user', content:prompt, timestamp:Date.now()};
    setMessages(m=>[...m,um]); await db.messages.add(um);
    setLoading(true);
    try{
      const r=await fetch(`https://text.pollinations.ai/${encodeURIComponent(SYSTEM+"\nUSER:"+prompt)}?model=openai`);
      const t=await r.text();
      let parsed=null; try{const m=t.match(/\{[\s\S]*"files"[\s\S]*\}/); if(m) parsed=JSON.parse(m[0]);}catch{}
      if(parsed?.files){
        setFiles(parsed.files); setActiveFile(parsed.files[0].path);
        await db.projects.where('chatId').equals(currentChatId).delete();
        await db.projects.add({chatId:currentChatId, files:parsed.files});
        const am={chatId:currentChatId, role:'assistant', content:`C'est fait — ${parsed.files.length} fichiers. Passe en Preview.`, timestamp:Date.now()};
        setMessages(m=>[...m,am]); await db.messages.add(am); setView('preview');
      }else{
        const am={chatId:currentChatId, role:'assistant', content:t, timestamp:Date.now()};
        setMessages(m=>[...m,am]); await db.messages.add(am);
      }
    }finally{ setLoading(false); }
  };

  const previewDoc = `<!DOCTYPE html><html><head><script src="https://cdn.tailwindcss.com"><\/script><script src="https://unpkg.com/react@18/umd/react.development.js"><\/script><script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"><\/script><script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body style="margin:0;background:#000"><div id="root"></div><script type="text/babel">${files.map(f=>f.content).join('\n\n')}\nconst root=ReactDOM.createRoot(document.getElementById('root')); root.render(React.createElement(App));<\/script></body></html>`;

  return (
    <div style={{height:'100dvh', background:'#000', color:'#fff', display:'flex', flexDirection:'column', overflow:'hidden'}}>
      <style>{`* {box-sizing:border-box} body{margin:0} ::-webkit-scrollbar{display:none}`}</style>

      <header style={{height:56, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 12px', borderBottom:'1px solid #151515', background:'#000'}}>
        <div style={{display:'flex', alignItems:'center', gap:12}}>
          <button onClick={()=>setMenuOpen(true)} style={{width:36,height:36, borderRadius:10, background:'#111', border:'1px solid #222', color:'#fff', cursor:'pointer'}}>☰</button>
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            <div style={{width:28,height:28, borderRadius:8, background:'linear-gradient(135deg,#00F5D4,#7C3AED)'}}/>
            <b style={{fontSize:15, letterSpacing:-0.3}}>ali</b>
            <span style={{fontSize:10, padding:'2px 7px', borderRadius:99, border:'1px solid #1f1f1f', color:'#00F5D4', background:'#0a1a17'}}>PRO</span>
          </div>
        </div>
      </header>

      {menuOpen && (
        <>
          <div onClick={()=>setMenuOpen(false)} style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:50}}/>
          <div style={{position:'fixed', top:0, left:0, bottom:0, width:'84%', maxWidth:300, background:'#0a0a0a', borderRight:'1px solid #1a1a1a', zIndex:60, padding:20, display:'flex', flexDirection:'column'}}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:20}}><b>Projets</b><button onClick={()=>setMenuOpen(false)} style={{background:'#1a1a1a', border:'none', color:'#fff', width:28,height:28, borderRadius:99, cursor:'pointer'}}>✕</button></div>
            <button onClick={async()=>{const id=await db.conversations.add({title:'Nouveau', updatedAt:Date.now()}); setConversations([{id,title:'Nouveau',updatedAt:Date.now()},...conversations]); setCurrentChatId(id); setMessages([]); setMenuOpen(false);}} style={{height:44, borderRadius:12, background:'#fff', color:'#000', fontWeight:700, border:'none', cursor:'pointer'}}>+ Nouveau</button>
            <div style={{marginTop:16, overflowY:'auto', display:'flex', flexDirection:'column', gap:6}}>{conversations.map(c=><div key={c.id} onClick={async()=>{setCurrentChatId(c.id); setMessages(await db.messages.where('chatId').equals(c.id).sortBy('timestamp')); setMenuOpen(false);}} style={{padding:'10px 12px', borderRadius:10, background: currentChatId===c.id?'#1a1a1a':'transparent', fontSize:13, cursor:'pointer'}}>{c.title}</div>)}</div>
          </div>
        </>
      )}

      <div style={{flex:1, overflow:'hidden', display:'flex', flexDirection:'column'}}>
        {view==='chat' && (
          <>
            <div style={{flex:1, overflowY:'auto'}}>
              <div style={{width:'100%', maxWidth:680, margin:'0 auto', padding:'24px 16px 16px', display:'flex', flexDirection:'column', gap:24}}>
                {messages.map((m,i)=>(
                  <div key={i} style={{width:'100%', display:'flex', justifyContent: m.role==='user'?'flex-end':'flex-start'}}>
                    {m.role==='user'?(
                      <div style={{maxWidth:'82%', background:'#1f1f1f', padding:'12px 16px', borderRadius:'18px 18px 4px 18px', fontSize:15, lineHeight:1.5}}>{m.content}</div>
                    ):(
                      <div style={{width:'100%', fontSize:15, lineHeight:1.65, color:'#e5e5e5', whiteSpace:'pre-wrap', wordBreak:'break-word'}}>{m.content}</div>
                    )}
                  </div>
                ))}
                {loading && <div style={{fontSize:13, color:'#00F5D4', display:'flex', alignItems:'center', gap:8}}><div style={{width:14,height:14, border:'2px solid #222', borderTopColor:'#00F5D4', borderRadius:'50%', animation:'spin 0.8s linear infinite'}}/>Ali build...</div>}
                <div ref={endRef}/>
              </div>
            </div>

            <div style={{padding:'8px 12px 18px', background:'#000', flexShrink:0}}>
              <div style={{maxWidth:680, margin:'0 auto'}}>
                <form onSubmit={send} style={{display:'flex', alignItems:'center', gap:8, background:'#111113', border:'1px solid #222', borderRadius:24, padding:'6px 6px 6px 14px'}}>
                  <input value={input} onChange={e=>setInput(e.target.value)} placeholder="Décris ton app..." style={{flex:1, background:'transparent', border:'none', outline:'none', color:'#fff', fontSize:15, minWidth:0}}/>
                  <button disabled={!input.trim()||loading} style={{width:36,height:36, borderRadius:'50%', background: input.trim()?'#fff':'#222', color: input.trim()?'#000':'#555', border:'none', cursor:'pointer', flexShrink:0, fontWeight:700}}>↑</button>
                </form>
                <div style={{textAlign:'center', fontSize:10, color:'#333', marginTop:8}}>Ali peut se tromper. Vérifiez les infos importantes.</div>
              </div>
            </div>
          </>
        )}
        {view==='build' && (
          <div style={{flex:1, display:'flex', overflow:'hidden', background:'#0a0a0a'}}>
            <div style={{width:160, borderRight:'1px solid #151515', padding:8, overflowY:'auto'}}>{files.map(f=><div key={f.path} onClick={()=>setActiveFile(f.path)} style={{padding:'8px 10px', borderRadius:8, background: activeFile===f.path?'#1a1a1a':'transparent', color: activeFile===f.path?'#fff':'#666', fontSize:11, fontFamily:'monospace', cursor:'pointer', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{f.path.split('/').pop()}</div>)}</div>
            <textarea value={files.find(f=>f.path===activeFile)?.content||''} onChange={e=> setFiles(p=>p.map(x=> x.path===activeFile? {...x, content:e.target.value}:x))} style={{flex:1, background:'#000', color:'#ccc', border:'none', padding:14, fontFamily:'monospace', fontSize:12, outline:'none', resize:'none'}}/>
          </div>
        )}
        {view==='preview' && <iframe srcDoc={previewDoc} style={{flex:1, border:'none', background:'#000'}} title="preview"/>}
      </div>

      <nav style={{height:64, flexShrink:0, background:'#0a0a0a', borderTop:'1px solid #151515', display:'flex', padding:'6px 8px', gap:6}}>
        {[
          {id:'chat', label:'Chat'},
          {id:'build', label:'Code'},
          {id:'preview', label:'Aperçu'},
        ].map(t=>(
          <button key={t.id} onClick={()=>setView(t.id)} style={{flex:1, borderRadius:12, background: view===t.id?'#1a1a1a':'transparent', border: view===t.id?'1px solid #222':'1px solid transparent', color: view===t.id?'#fff':'#666', cursor:'pointer', fontSize:12, fontWeight:600, position:'relative'}}>
            {view===t.id && <div style={{position:'absolute', top:0, left:'35%', right:'35%', height:2, background:'#00F5D4', borderRadius:2}}/>}
            {t.label}
          </button>
        ))}
      </nav>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
  }
