import React, { useState, useRef, useEffect } from 'react';

export default function App() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Salut ! Je suis ton agent studio. Demande-moi de rédiger du code propre, de générer une image, ou de composer une musique." }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mediaList, setMediaList] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userPrompt = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userPrompt }]);
    setLoading(true);

    const lower = userPrompt.toLowerCase();

    try {
      // Détection de l'intention Image
      if (lower.includes('image') || lower.includes('photo') || lower.includes('dessine') || lower.includes('crée un visuel')) {
        const encoded = encodeURIComponent(userPrompt);
        const imageUrl = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&nologo=true`;
        
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `Voici l'image générée pour : "${userPrompt}"`,
          mediaUrl: imageUrl,
          mediaType: 'image'
        }]);
        setMediaList(prev => [{ type: 'image', url: imageUrl, prompt: userPrompt }, ...prev]);
      } 
      // Détection de l'intention Audio / Musique / Chanson
      else if (lower.includes('chanson') || lower.includes('musique') || lower.includes('audio') || lower.includes('son')) {
        const encoded = encodeURIComponent(userPrompt);
        const audioUrl = `https://text.pollinations.ai/audio/${encoded}`;

        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `Flux audio / musique généré pour : "${userPrompt}"`,
          mediaUrl: audioUrl,
          mediaType: 'audio'
        }]);
        setMediaList(prev => [{ type: 'audio', url: audioUrl, prompt: userPrompt }, ...prev]);
      } 
      // Génération de Texte / Code propre
      else {
        const res = await fetch(`https://text.pollinations.ai/${encodeURIComponent(userPrompt)}`);
        const textResult = await res.text();

        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: textResult 
        }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "Désolé, une erreur est survenue lors de la communication avec l'API Pollinations." 
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#090d16' }}>
      {/* Barre de navigation */}
      <header style={{ padding: '1rem 2rem', borderBottom: '1px solid #1e293b', backgroundColor: '#0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#38bdf8', boxShadow: '0 0 10px #38bdf8' }}></div>
          <h1 style={{ fontSize: '1.2rem', margin: 0, fontWeight: '700', color: '#f8fafc' }}>Ali Agent Studio</h1>
        </div>
        <span style={{ fontSize: '0.8rem', color: '#38bdf8', backgroundColor: '#1e293b', padding: '4px 10px', borderRadius: '6px', border: '1px solid #334155' }}>
          Powered by Pollinations AI
        </span>
      </header>

      {/* Conteneur principal */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', flex: 1, overflow: 'hidden' }}>
        
        {/* Panneau de Chat & Code */}
        <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid #1e293b', backgroundColor: '#0b1329', height: 'calc(100vh - 65px)' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {messages.map((msg, idx) => (
              <div key={idx} style={{ 
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                backgroundColor: msg.role === 'user' ? '#0284c7' : '#1e293b',
                color: '#f8fafc',
                padding: '0.85rem 1.1rem',
                borderRadius: '12px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                lineHeight: '1.5',
                fontSize: '0.95rem'
              }}>
                <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.content}</div>
                
                {msg.mediaType === 'image' && (
                  <img src={msg.mediaUrl} alt="Généré" style={{ width: '100%', borderRadius: '8px', marginTop: '10px', maxHeight: '300px', objectFit: 'contain' }} />
                )}
                
                {msg.mediaType === 'audio' && (
                  <audio controls src={msg.mediaUrl} style={{ width: '100%', marginTop: '10px' }}></audio>
                )}
              </div>
            ))}
            {loading && (
              <div style={{ alignSelf: 'flex-start', backgroundColor: '#1e293b', padding: '0.75rem 1rem', borderRadius: '12px', color: '#38bdf8', fontSize: '0.9rem' }}>
                Génération en cours... ⚡
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Formulaire d'envoi */}
          <form onSubmit={handleSubmit} style={{ padding: '1rem', backgroundColor: '#0f172a', borderTop: '1px solid #1e293b', display: 'flex', gap: '0.5rem' }}>
            <input 
              type="text" 
              value={input} 
              onChange={e => setInput(e.target.value)} 
              placeholder="Ex: Code une navbar en React, ou génère une image de chat cyberpunk..." 
              style={{ flex: 1, backgroundColor: '#090d16', border: '1px solid #334155', borderRadius: '8px', padding: '0.75rem 1rem', color: 'white', outline: 'none', fontSize: '0.95rem' }}
            />
            <button type="submit" disabled={loading} style={{ backgroundColor: '#38bdf8', color: '#0f172a', border: 'none', padding: '0 1.25rem', fontWeight: 'bold', borderRadius: '8px', cursor: 'pointer', transition: 'opacity 0.2s' }}>
              Envoyer
            </button>
          </form>
        </div>

        {/* Panneau latéral Médias Générés */}
        <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#090d16', height: 'calc(100vh - 65px)', padding: '1.5rem', overflowY: 'auto' }}>
          <h2 style={{ fontSize: '1rem', color: '#38bdf8', margin: '0 0 1rem 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Galerie Média Récente</span>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{mediaList.length} éléments</span>
          </h2>

          {mediaList.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', textAlign: 'center', border: '2px dashed #1e293b', borderRadius: '12px', padding: '2rem' }}>
              Les images et musiques que tu demandes apparaîtront ici en direct.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {mediaList.map((item, index) => (
                <div key={index} style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '0.75rem' }}>
                  <p style={{ fontSize: '0.85rem', color: '#cbd5e1', margin: '0 0 0.5rem 0', fontStyle: 'italic' }}>"{item.prompt}"</p>
                  {item.type === 'image' ? (
                    <img src={item.url} alt="Galerie" style={{ width: '100%', borderRadius: '6px', maxHeight: '200px', objectFit: 'cover' }} />
                  ) : (
                    <audio controls src={item.url} style={{ width: '100%' }}></audio>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
