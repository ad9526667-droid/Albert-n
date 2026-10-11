import React, { useState, useRef, useEffect } from 'react';

export default function App() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Salut, c'est Ali. Ton agent mobile ultra puissant. Plus puissant que Lovable / Bolt / Replit. Décris ton app et je build." }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('chat');
  const [files, setFiles] = useState([{ path: 'src/App.jsx', content: 'export default function App(){return <div style={{height:"100vh",display:"grid",placeItems:"center",background:"#000",color:"#fff"}}>Ali Preview</div>}' }]);
  const endRef = useRef(null);
  useEffect(()=> endRef.current?.scrollIntoView({behavior:'smooth'}), [messages]);

  const send = async (e)=>{
    e.preventDefault();
    if(!input.trim()) return;
    const prompt = input.trim(); setInput('');
    setMessages(m=> [...m, {role:'user', content: prompt}]);
    setLoading(true);
    try{
      const r = await fetch(`https://text.pollinations.ai/${encodeURIComponent(prompt)}?model=openai`);
      const t = await r.text();
      setMessages(m=> [...m, {role:'assistant', content: t}]);
      // Si c'est du code, on le met dans l'aperçu
      const codeMatch = t.match(/```(?:jsx|js|tsx)?\n([\s\S]*?)```/);
      if(codeMatch){
        setFiles([{path:'src/App.jsx', content: codeMatch[1]}]);
        setView('preview');
      }
    }catch{
      setMessages(m=> [...m, {role:'assistant', content: "Erreur réseau"}]);
    }finally{ setLoading(false); }
  };

  const previewDoc = `<!DOCTYPE html><html><head><script src="https://cdn.tailwindcss.com"><\/script><script src="https://unpkg.com/react@18/umd/react.development.js"><\/script><script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"><\/script><script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script></head><body style="margin:0;background:#000"><div id="root"></div><script type="text/babel">${files[0].content}\nconst root=ReactDOM.createRoot(document.getElementById('root')); root.render(<App/>);<\/script></body></html>`;

  return (
    <div style={{height:'100dvh', background:'#000', color:'#fff', display:'flex', flexDirection:'column', fontFamily:'Inter, system-ui'}}>
      <header style={{height:56, display:'flex', alignItems:'center', padding:'0 16px', borderBottom:'1px solid #151515', flexShrink:0}}>
        <div style={{width:28,height:28, borderRadius:8, background:'linear-gradient(135deg,#00FFD1,#8B5CF6)'}}/>
        <b style={{marginLeft:10}}>ali</b><span style={{marginLeft:8, fontSize:10, padding:'2px 6px', borderRadius:99, border:'1px solid #222', color:'#00FFD1'}}>PRO</span>
      </header>

      <div style={{flex:1, overflow:'hidden', display:'flex', flexDirection:'column'}}>
        {view==='chat'? (
          <>
            <div style={{flex:1, overflowY:'auto', padding:20}}>
              <div style={{maxWidth:640, margin:'0 auto', display:'flex', flexDirection:'column', gap:20}}>
                {messages.map((m,i)=>(
                  <div key={i} style={{alignSelf: m.role==='user'?'flex-end':'flex-start', maxWidth:'85%', background: m.role==='user'?'#1e1e1e':'transparent', padding: m.role==='user'?'10px 16px':'0', borderRadius: m.role==='user'?'18px 18px 4px 18px':'0', fontSize:15, lineHeight:1.6, whiteSpace:'pre-wrap', wordBreak:'break-word'}}>{m.content}</div>
                ))}
                {loading && <div style={{color:'#00FFD1', fontSize:13}}>Ali build en cours...</div>}
                <div ref={endRef}/>
              </div>
            </div>
            <div style={{padding:12, background:'#000'}}>
              <form onSubmit={send} style={{maxWidth:640, margin:'0 auto', display:'flex', gap:8, background:'#111', border:'1px solid #222', borderRadius:24, padding:'6px 6px 6px 16px'}}>
                <input value={input} onChange={e=>setInput(e.target.value)} placeholder="Décris ton app..." style={{flex:1, background:'transparent', border:'none', outline:'none', color:'#fff', fontSize:15}}/>
                <button style={{width:36,height:36, borderRadius:'50%', background:'#fff', color:'#000', border:'none', fontWeight:700}}>↑</button>
              </form>
            </div>
          </>
        ) : <iframe srcDoc={previewDoc} style={{flex:1, border:'none'}}/>}
      </div>

      <nav style={{height:60, display:'flex', gap:6, padding:6, borderTop:'1px solid #151515', background:'#0a0a0a'}}>
        <button onClick={()=>setView('chat')} style={{flex:1, borderRadius:10, background: view==='chat'?'#1a1a1a':'transparent', border:'none', color: view==='chat'?'#fff':'#666', fontWeight:600}}>Chat</button>
        <button onClick={()=>setView('preview')} style={{flex:1, borderRadius:10, background: view==='preview'?'#1a1a1a':'transparent', border:'none', color: view==='preview'?'#fff':'#666', fontWeight:600}}>Aperçu</button>
      </nav>
    </div>
  );
                                         }
