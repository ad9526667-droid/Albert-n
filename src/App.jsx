import React, { useState, useRef, useEffect } from 'react';
import Dexie from 'dexie';

const db = new Dexie('AliSuperAgentDB');
db.version(1).stores({
  conversations: '++id, title, updatedAt',
  messages: '++id, chatId, role, content, timestamp',
  projects: '++id, chatId, files'
});

export default function App() {
  const [conversations, setConversations] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeView, setActiveView] = useState('chat');
  const [projectFiles, setProjectFiles] = useState([{ path: 'src/App.jsx', content: `export default function App(){ return <div className="min-h-screen bg-black text-white grid place-items-center"><h1 className="text-4xl font-black">Ali OS prêt</h1></div> }` }]);
  const [activeFile, setActiveFile] = useState('src/App.jsx');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // TTS
  useEffect(()=>{
    const load = ()=>{
      const vs = speechSynthesis.getVoices();
      const fr = vs.filter(v=> v.lang.includes('fr') || v.lang.includes('en-US'));
      setVoices(fr.length?fr:vs.slice(0,8));
      setSelectedVoice(fr[0]||vs[0]);
    };
    load(); speechSynthesis.onvoiceschanged = load;
  },[]);
  const speak = (t, laugh=false)=>{
    speechSynthesis.cancel();
    let clean = t.replace(/\*\*/g,'').slice(0,350);
    if(laugh) clean += " Hahaha j'adore!";
    const u = new SpeechSynthesisUtterance(clean);
    if(selectedVoice) u.voice = selectedVoice;
    u.rate=0.95; u.pitch= laugh?1.3:1;
    speechSynthesis.speak(u);
  };
  const laugh = ()=> speak("Ahahah c'est trop drôle!", true);

  useEffect(()=>{
    (async()=>{
      let chats = await db.conversations.toArray();
      if(!chats.length){
        const id = await db.conversations.add({title:'Nouvelle app', updatedAt:Date.now()});
        chats=[{id, title:'Nouvelle app', updatedAt:Date.now()}];
        await db.messages.add({chatId:id, role:'assistant', content:"**Salut, c'est Ali.** Prêt à builder. Décris ton app.", timestamp:Date.now()});
      }
      setConversations(chats.sort((a,b)=>b.updatedAt-a.updatedAt));
      setCurrentChatId(chats[0].id);
      setMessages(await db.messages.where('chatId').equals(chats[0].id).sortBy('timestamp'));
    })();
  },[]);
  useEffect(()=> chatEndRef.current?.scrollIntoView({behavior:'smooth'}), [messages]);

  const startMic = ()=>{
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!SR) return alert("Micro non supporté");
    const r = new SR(); r.lang='fr-FR';
    r.onstart=()=>setIsListening(true); r.onend=()=>setIsListening(false);
    r.onresult=(e)=> setInput(e.results[0][0].transcript);
    r.start();
  };

  const handleSubmit = async (e)=>{
    e.preventDefault(); if(!input.trim()||loading) return;
    const prompt = input.trim(); setInput('');
    const um = {chatId:currentChatId, role:'user', content:prompt, timestamp:Date.now()};
    setMessages(m=>[...m,um]); await db.messages.add(um);
    setLoading(true);

    // 1. IMAGE = pas d'appel LLM, direct
    if(/image|chien|dog|photo|génère|dessine/i.test(prompt)){
      const imgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&seed=${Date.now()}`;
      const am = {chatId:currentChatId, role:'assistant', content:`IMG::${imgUrl}`, timestamp:Date.now()};
      setMessages(m=>[...m,am]); await db.messages.add(am);
      speak("Voilà ton image"); setLoading(false); return;
    }

    try{
      const sys = `Tu es Ali. Si on te demande de CODER, réponds UNIQUEMENT ce JSON: {"files":[{"path":"src/App.jsx","content":"code React Tailwind complet"}]}. Sinon réponds en français court sans JSON.`;
      const res = await fetch(`https://text.pollinations.ai/${encodeURIComponent(sys+"\nUser:"+prompt)}?model=openai`);
      const raw = await res.text();

      // EXTRACTION SECURISEE
      let files = null;
      try{
        const m = raw.match(/\{"files"\s*:\s*\[[\s\S]*?\]\}/);
        if(m){
          const p = JSON.parse(m[0]);
          if(p.files?.length) files = p.files;
        }
      }catch{}

      if(files){
        const safe = files.filter(f=> f.path && f.content && f.path.length<100 &&!f.path.includes('..')).slice(0,10);
        setProjectFiles(safe); setActiveFile(safe[0].path);
        await db.projects.where('chatId').equals(currentChatId).delete();
        await db.projects.add({chatId:currentChatId, files:safe});
        const am = {chatId:currentChatId, role:'assistant', content:`**✅ ${safe.length} fichiers créés.** Preview prêt.`, timestamp:Date.now()};
        setMessages(m=>[...m,am]); await db.messages.add(am);
        setActiveView('preview'); speak("Projet créé avec succès", true);
      }else{
        // NETTOYAGE TOTAL: on enlève tout le code brut
        let clean = raw
         .replace(/\{[\s\S]*"tool_calls"[\s\S]*\}/g,'')
         .replace(/<!DOCTYPE[\s\S]*?>/g,'')
         .replace(/<meta[\s\S]*?>/g,'')
         .replace(/public\/index\.html[\s\S]*?src\/App\.jsx/g,'')
         .replace(/framer-motion[^]*$/g,'')
         .replace(/src\/App\.jsx[\s\S]*$/g,'')
         .replace(/\{"role".*$/g,'')
         .trim();
        if(clean.length>600) clean = clean.slice(0,600)+"...";
        if(!clean) clean = "Salut! Comment ça va? 👋";
        const am = {chatId:currentChatId, role:'assistant', content:clean, timestamp:Date.now()};
        setMessages(m=>[...m,am]); await db.messages.add(am);
        speak(clean);
      }
    }catch{
      setMessages(m=>[...m,{chatId:currentChatId, role:'assistant', content:"Erreur réseau", timestamp:Date.now()}]);
    }finally{ setLoading(false); }
  };

  const previewDoc = `<!DOCTYPE html><html><head><script src="https://cdn.tailwindcss.com"><\/script><script src="https://unpkg.com/react@18/umd/react.development.js"><\/script><script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"><\/script><script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script></head><body><div id="root"></div><script type="text/babel">${projectFiles.map(f=>f.content).join('\n')}\nReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));<\/script></body></html>`;

  return (
    <div style={{height:'100dvh', background:'#07070A', color:'#fff', display:'flex', flexDirection:'column', overflow:'hidden'}}>
      <header style={{height:56, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 12px', borderBottom:'1px solid #1A1A1E', flexShrink:0}}>
        <div style={{display:'flex', gap:8, alignItems:'center'}}><button onClick={()=>setSidebarOpen(true)} style={{width:34,height:34,borderRadius:10,background:'#151519',border:'1px solid #222',color:'#fff'}}>☰</button><b style={{fontWeight:800}}>Ali</b><span style={{fontSize:9,background:'#CCFF00',color:'#000',padding:'3px 7px',borderRadius:99,fontWeight:800}}>FIXED</span></div>
        <div style={{display:'flex', gap:6}}><select value={selectedVoice?.name||''} onChange={e=> setSelectedVoice(voices.find(v=>v.name===e.target.value))} style={{background:'#111',color:'#fff',border:'1px solid #222',borderRadius:20,padding:'4px 8px',fontSize:11,maxWidth:90}}>{voices.map(v=> <option key={v.name} value={v.name}>{v.name.slice(0,15)}</option>)}</select><button onClick={laugh} style={{width:32,height:32,borderRadius:99,background:'#1A1A1E',border:'1px solid #222'}}>😂</button></div>
      </header>

      <div style={{flex:1, overflow:'hidden', display:'flex', flexDirection:'column'}}>
        <div style={{flex:1, overflowY:'auto', padding:'18px 0'}}>
          <div style={{maxWidth:680, margin:'0 auto', padding:'0 14px', display:'flex', flexDirection:'column', gap:20}}>
            {messages.map((m,i)=>(
              <div key={i} style={{alignSelf: m.role==='user'?'flex-end':'flex-start', maxWidth: m.role==='user'?'80%':'100%', display:'flex', gap:8, alignItems:'flex-end'}}>
                {m.content.startsWith('IMG::')? <div><img src={m.content.replace('IMG::','')} style={{maxWidth:320, borderRadius:18, border:'1px solid #222'}}/><div style={{marginTop:8, fontSize:13, fontWeight:700}}>Image générée 🐶</div></div> : <div style={{background: m.role==='user'?'#1A1A1E':'transparent', padding: m.role==='user'?'12px 16px':'0', borderRadius: m.role==='user'?'18px 18px 4px 18px':'0', fontSize:15, lineHeight:1.6, border: m.role==='user'?'1px solid #232326':'none'}}>{m.content.replace(/\*\*/g,'')}</div>}
                {m.role==='assistant' &&!m.content.startsWith('IMG::') && <button onClick={()=>speak(m.content)} style={{width:28,height:28,borderRadius:99,background:'#151519',border:'1px solid #222',flexShrink:0}}>🔊</button>}
              </div>
            ))}
            {loading && <div style={{color:'#CCFF00', fontSize:13, fontWeight:700}}>Ali réfléchit...</div>}
            <div ref={chatEndRef}/>
          </div>
        </div>

        <div style={{padding:'10px 12px 14px', borderTop:'1px solid #111', flexShrink:0}}>
          <form onSubmit={handleSubmit} style={{maxWidth:680, margin:'0 auto', display:'flex', gap:8, background:'#121214', borderRadius:28, padding:'6px 8px 6px 14px', border:'1px solid #232326', alignItems:'center'}}>
            <button type="button" onClick={()=>fileInputRef.current.click()} style={{width:34,height:34,borderRadius:'50%',background:'#1E1E22',border:'1px solid #2A2A2E',color:'#fff'}}>📎</button>
            <input ref={fileInputRef} type="file" hidden onChange={async(e)=>{const f=e.target.files[0]; if(f){const t=await f.text(); setProjectFiles(p=>[...p,{path:`src/${f.name}`,content:t}]);}}}/>
            <input value={input} onChange={e=>setInput(e.target.value)} placeholder="Parle, écris, upload..." style={{flex:1, background:'transparent', border:'none', outline:'none', color:'#fff', fontSize:14.5, minWidth:0}}/>
            <button type="button" onClick={startMic} style={{width:34,height:34,borderRadius:'50%',background: isListening?'#FF3B30':'#1E1E22',border:'1px solid #2A2A2E',color:'#fff'}}>{isListening?'●':'🎤'}</button>
            <button type="button" onClick={laugh} style={{width:34,height:34,borderRadius:'50%',background:'#1E1E22',border:'1px solid #2A2A2E'}}>😂</button>
            <button disabled={loading||!input.trim()} style={{width:38,height:38,borderRadius:'50%',background: input.trim()?'#CCFF00':'#222',color:'#000',border:'none',fontWeight:900}}>↑</button>
          </form>
        </div>
      </div>

      {activeView==='preview' && <div style={{position:'fixed', inset:0, top:56, background:'#000', zIndex:20, display:'flex', flexDirection:'column'}}><div style={{height:40, background:'#0A0A0C', borderBottom:'1px solid #1A1A1E', display:'flex', alignItems:'center', padding:'0 12px', justifyContent:'space-between'}}><span style={{fontSize:12, fontWeight:700}}>Preview</span><button onClick={()=>setActiveView('chat')} style={{background:'#1A1A1E', border:'1px solid #222', color:'#fff', borderRadius:20, padding:'4px 12px', fontSize:12}}>Fermer ✕</button></div><iframe srcDoc={previewDoc} style={{flex:1, border:'none', background:'#fff'}}/></div>}
    </div>
  );
      }
