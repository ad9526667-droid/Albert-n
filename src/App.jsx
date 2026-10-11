import React, { useState, useRef, useEffect } from 'react';
import Dexie from 'dexie';

const db = new Dexie('AliSuperAgentDB');
db.version(1).stores({
  conversations: '++id, title, updatedAt',
  messages: '++id, chatId, role, content, timestamp',
  projects: '++id, chatId, files'
});

const SYSTEM_INSTRUCTION = `Tu es Ali OS - Agent Replit. Si CODE: JSON {"files":[{"path":"src/App.jsx","content":"..."}]}. Si QUESTION: français court gras sans JSON.`;

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
  const [terminalLogs, setTerminalLogs] = useState(['> Ali OS v7 [Edge TTS + Laugh]', '> Microsoft Neural Voice loaded']);
  const [isListening, setIsListening] = useState(false);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [ttsOn, setTtsOn] = useState(true);
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // === EDGE TTS VOICES ===
  useEffect(()=>{
    const loadVoices = () => {
      const vs = window.speechSynthesis.getVoices();
      const msVoices = vs.filter(v=> v.name.toLowerCase().includes('microsoft') || v.name.includes('Aria') || v.name.includes('Jenny') || v.lang.startsWith('fr'));
      setVoices(vs);
      const preferred = vs.find(v=> v.name.includes('Microsoft Denise') || v.name.includes('Microsoft Aria') || v.name.includes('Jenny') || v.lang==='fr-FR') || vs[0];
      setSelectedVoice(preferred);
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  },[]);

  const speak = (text, withLaugh=false) => {
    if(!ttsOn) return;
    window.speechSynthesis.cancel();
    let clean = text.replace(/\*\*/g,'').replace(/!\[.*\]\(.*\)/g,'').replace(/```[\s\S]*?```/g,'').slice(0,400);
    if(withLaugh){
      clean = clean + " Hahaha!";
    }
    const utter = new SpeechSynthesisUtterance(clean);
    if(selectedVoice) utter.voice = selectedVoice;
    utter.rate = withLaugh? 1.1 : 0.95;
    utter.pitch = withLaugh? 1.3 : 1.0;
    utter.volume = 1;
    window.speechSynthesis.speak(utter);
  };

  const laugh = () => {
    const laughs = ["Ahahaha! C'est trop drôle!", "Hahaha! J'adore!", "Hihi! Tu m'as fait rire!", "Ahah! Excellent!"];
    const pick = laughs[Math.floor(Math.random()*laughs.length)];
    speak(pick, true);
    setTerminalLogs(l=> [...l, `> Ali laughs: ${pick}`]);
  };

  useEffect(() => {
    (async()=>{
      let chats = await db.conversations.toArray();
      if(chats.length===0){
        const id = await db.conversations.add({title:'Nouvelle app', updatedAt:Date.now()});
        chats=[{id, title:'Nouvelle app', updatedAt:Date.now()}];
        await db.messages.add({chatId:id, role:'assistant', content:"**Je suis Ali OS avec voix Edge.**\n\nJe parle **toutes les langues** et je sais **rire comme un humain**. Teste le bouton 🔊 ou 😂", timestamp:Date.now()});
      }
      setConversations(chats.sort((a,b)=>b.updatedAt-a.updatedAt));
      setCurrentChatId(chats[0].id);
      setMessages(await db.messages.where('chatId').equals(chats[0].id).sortBy('timestamp'));
    })();
  }, []);
  useEffect(()=>{ chatEndRef.current?.scrollIntoView({behavior:'smooth'}) }, [messages]);

  const startMic = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!SR) return alert("Micro non supporté");
    const rec = new SR(); rec.lang='fr-FR'; rec.onstart=()=>setIsListening(true);
    rec.onend=()=>setIsListening(false);
    rec.onresult=(e)=> setInput(e.results[0][0].transcript);
    rec.start();
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]; if(!file) return;
    const text = await file.text();
    setProjectFiles(prev=> [...prev, {path:`src/${file.name}`, content:text}]);
    setTerminalLogs(l=> [...l, `> uploaded ${file.name}`]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); if(!input.trim()||loading) return;
    const prompt = input.trim(); setInput('');
    const um = {chatId:currentChatId, role:'user', content:prompt, timestamp:Date.now()};
    setMessages(m=>[...m,um]); await db.messages.add(um);
    setLoading(true);

    try{
      if(prompt.toLowerCase().match(/image|génère.*image|photo|chien/)){
        const img = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&seed=${Date.now()}`;
        const am = {chatId:currentChatId, role:'assistant', content:`**Image générée**\n\n![img](${img})`, timestamp:Date.now()};
        setMessages(m=>[...m,am]); await db.messages.add(am);
        speak("Voilà ton image, elle est magnifique!", false);
        setLoading(false); return;
      }
      const fullPrompt = `${SYSTEM_INSTRUCTION}\nDemande: ${prompt}`;
      const res = await fetch(`https://text.pollinations.ai/${encodeURIComponent(fullPrompt)}?model=openai`);
      let raw = await res.text();
      raw = raw.replace(/"role".*?"reasoning"/gs,'');
      let files = null;
      try{
        const jm = raw.match(/\{[\s\S]*?"files"\s*:\s*\[[\s\S]*?\]\s*\}/);
        if(jm){
          const parsed = JSON.parse(jm[0].replace(/```json|```/g,''));
          if(parsed.files?.length) files = parsed.files;
        }
      }catch{}
      if(files){
        const safe = files.filter(f=> f.path && f.content &&!f.path.includes('..')).slice(0,20);
        setProjectFiles(safe); setActiveFile(safe[0].path);
        await db.projects.where('chatId').equals(currentChatId).delete();
        await db.projects.add({chatId:currentChatId, files:safe});
        const am = {chatId:currentChatId, role:'assistant', content:`**✅ Projet buildé: ${safe.length} fichiers**`, timestamp:Date.now()};
        setMessages(m=>[...m,am]); await db.messages.add(am);
        setActiveView('preview');
        speak(`Projet terminé! J'ai créé ${safe.length} fichiers. Regarde le preview!`, true);
      }else{
        const clean = raw.replace(/\{.*files.*\}/gs,'').slice(0,1500).trim();
        const am = {chatId:currentChatId, role:'assistant', content: clean, timestamp:Date.now()};
        setMessages(m=>[...m,am]); await db.messages.add(am);
        speak(clean, false);
      }
    }catch{
      setMessages(m=>[...m,{chatId:currentChatId, role:'assistant', content:"**Erreur réseau.**", timestamp:Date.now()}]);
    }finally{ setLoading(false); }
  };

  const activeContent = projectFiles.find(f=>f.path===activeFile)?.content||'';
  const previewDoc = `<!DOCTYPE html><html><head><script src="https://cdn.tailwindcss.com"><\/script><script src="https://unpkg.com/react@18/umd/react.development.js"><\/script><script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"><\/script><script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script></head><body><div id="root"></div><script type="text/babel">${projectFiles.map(f=>f.content).join('\n\n')}\nconst r=ReactDOM.createRoot(document.getElementById('root'));try{r.render(React.createElement(App))}catch(e){document.body.innerHTML='<pre>'+e.message+'</pre>'}\<\/script></body></html>`;

  return (
    <div style={{height:'100dvh', background:'#08080A', color:'#F1F1F2', display:'flex', flexDirection:'column', overflow:'hidden'}}>
      <style>{`*{box-sizing:border-box} ::-webkit-scrollbar{display:none}`}</style>

      <header style={{height:62, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 12px', borderBottom:'1px solid #1A1A1E'}}>
        <div style={{display:'flex', gap:10, alignItems:'center'}}><button onClick={()=>setSidebarOpen(true)} style={{width:36,height:36, borderRadius:10, background:'#141416', border:'1px solid #222', color:'#fff'}}>☰</button><b>Ali</b><span style={{fontSize:10, background:'#CCFF00', color:'#000', padding:'3px 8px', borderRadius:99, fontWeight:800}}>EDGE TTS</span></div>
        <div style={{display:'flex', gap:6, alignItems:'center'}}>
          <select value={selectedVoice?.name||''} onChange={e=> setSelectedVoice(voices.find(v=>v.name===e.target.value))} style={{background:'#111', color:'#fff', border:'1px solid #222', borderRadius:99, padding:'4px 8px', fontSize:11, maxWidth:110}}>
            {voices.slice(0,20).map(v=> <option key={v.name} value={v.name}>{v.name.slice(0,20)} ({v.lang})</option>)}
          </select>
          <button onClick={()=>setTtsOn(!ttsOn)} style={{width:32,height:32, borderRadius:99, background: ttsOn?'#CCFF00':'#1E1E22', color: ttsOn?'#000':'#666', border:'none', cursor:'pointer'}}>🔊</button>
          <button onClick={laugh} style={{width:32,height:32, borderRadius:99, background:'#1E1E22', border:'1px solid #333', cursor:'pointer'}}>😂</button>
        </div>
      </header>

      <div style={{flex:1, display:'flex', overflow:'hidden'}}>
        <div style={{flex:1, display:'flex', flexDirection:'column'}}>
          <div style={{flex:1, overflowY:'auto', padding:'20px 0'}}>
            <div style={{maxWidth:720, margin:'0 auto', padding:'0 14px', display:'flex', flexDirection:'column', gap:20}}>
              {messages.map((m,i)=>(
                <div key={i} style={{alignSelf: m.role==='user'?'flex-end':'flex-start', maxWidth: m.role==='user'?'80%':'100%', display:'flex', gap:8, alignItems:'flex-end'}}>
                  <div style={{background: m.role==='user'?'#1A1A1E':'transparent', border: m.role==='user'?'1px solid #242428':'none', padding: m.role==='user'?'12px 16px':'0', borderRadius:'18px 18px 6px 18px', fontSize:14.5}}>{m.content.includes('![')? <img src={m.content.match(/!\[.*\]\((.*)\)/)?.[1]} style={{maxWidth:320, borderRadius:16, marginTop:8}}/> : m.content.replace(/\*\*/g,'')}</div>
                  {m.role==='assistant' && <><button onClick={()=>speak(m.content)} style={{width:28,height:28,borderRadius:99,background:'#1A1A1E',border:'1px solid #222',cursor:'pointer',fontSize:12}}>🔊</button><button onClick={laugh} style={{width:28,height:28,borderRadius:99,background:'#1A1A1E',border:'1px solid #222',cursor:'pointer',fontSize:12}}>😂</button></>}
                </div>
              ))}
              <div ref={chatEndRef}/>
            </div>
          </div>

          <div style={{padding:12}}>
            <div style={{maxWidth:720, margin:'0 auto'}}>
              <form onSubmit={handleSubmit} style={{display:'flex', gap:8, background:'#131316', borderRadius:28, padding:'6px 8px 6px 12px', border:'1px solid #252529', alignItems:'center'}}>
                <button type="button" onClick={()=>fileInputRef.current.click()} style={{width:36,height:36,borderRadius:'50%',background:'#1E1E22',border:'1px solid #2A2A2E',color:'#fff',cursor:'pointer'}}>📎</button>
                <input ref={fileInputRef} type="file" hidden onChange={handleFileUpload}/>
                <input value={input} onChange={e=>setInput(e.target.value)} placeholder="Parle, écris, upload..." style={{flex:1, background:'transparent', border:'none', outline:'none', color:'#fff', fontSize:14.5}}/>
                <button type="button" onClick={startMic} style={{width:36,height:36,borderRadius:'50%',background: isListening?'#FF3B30':'#1E1E22',border:'1px solid #2A2A2E',color:'#fff',cursor:'pointer'}}>{isListening?'●':'🎤'}</button>
                <button type="button" onClick={laugh} style={{width:36,height:36,borderRadius:'50%',background:'#1E1E22',border:'1px solid #2A2A2E',cursor:'pointer'}}>😂</button>
                <button disabled={loading||!input.trim()} style={{width:40,height:40,borderRadius:'50%',background: input.trim()?'#CCFF00':'#1E1E22',color:'#000',border:'none',fontWeight:900}}>↑</button>
              </form>
              <div style={{display:'flex', justifyContent:'center', gap:12, marginTop:6}}><span style={{fontSize:10,color:'#555'}}>🎤 Micro</span><span style={{fontSize:10,color:'#555'}}>📎 Upload</span><span style={{fontSize:10,color:'#555'}}>🔊 Edge TTS 140 langues</span><span style={{fontSize:10,color:'#555'}}>😂 Rire humain</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
      }
