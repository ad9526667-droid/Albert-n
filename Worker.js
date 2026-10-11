export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (url.pathname === "/" && request.method === "GET") {
      const html = `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ali Agent - Studio Multimédia & Code</title>
    <style>
        :root {
            --bg-color: #0f172a;
            --panel-bg: #1e293b;
            --border-color: #334155;
            --accent-color: #38bdf8;
            --text-color: #f8fafc;
            --text-secondary: #94a3b8;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }
        body { background-color: var(--bg-color); color: var(--text-color); min-height: 100vh; display: flex; flex-direction: column; }
        header { background-color: var(--panel-bg); border-bottom: 1px solid var(--border-color); padding: 1rem 2rem; display: flex; justify-content: space-between; align-items: center; }
        h1 { font-size: 1.25rem; color: var(--accent-color); display: flex; align-items: center; gap: 0.5rem; }
        .container { flex: 1; max-width: 1200px; width: 100%; margin: 0 auto; padding: 2rem; display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; }
        @media(max-width: 900px) { .container { grid-template-columns: 1fr; } }
        .panel { background-color: var(--panel-bg); border: 1px solid var(--border-color); border-radius: 12px; padding: 1.5rem; display: flex; flex-direction: column; height: 75vh; }
        .panel-title { font-size: 1.1rem; font-weight: 600; margin-bottom: 1rem; color: var(--accent-color); display: flex; justify-content: space-between; align-items: center; }
        .chat-messages { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 1rem; padding-right: 0.5rem; margin-bottom: 1rem; }
        .message { padding: 0.75rem 1rem; border-radius: 8px; max-width: 85%; line-height: 1.5; font-size: 0.95rem; }
        .message.user { background-color: #0284c7; color: white; align-self: flex-end; }
        .message.assistant { background-color: #334155; color: var(--text-color); align-self: flex-start; }
        .message pre { background: #0f172a; padding: 0.75rem; border-radius: 6px; overflow-x: auto; margin-top: 0.5rem; font-family: monospace; font-size: 0.85rem; }
        .input-box { display: flex; gap: 0.5rem; }
        textarea { flex: 1; background-color: #0f172a; border: 1px solid var(--border-color); color: white; padding: 0.75rem; border-radius: 8px; resize: none; height: 50px; outline: none; }
        textarea:focus { border-color: var(--accent-color); }
        button { background-color: var(--accent-color); color: #0f172a; border: none; padding: 0 1.25rem; font-weight: bold; border-radius: 8px; cursor: pointer; transition: opacity 0.2s; }
        button:hover { opacity: 0.9; }
        button:disabled { opacity: 0.5; cursor: not-allowed; }
        .media-preview { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 1rem; align-items: center; justify-content: center; border: 2px dashed var(--border-color); border-radius: 8px; padding: 1rem; text-align: center; color: var(--text-secondary); }
        .media-preview img, .media-preview video { max-width: 100%; max-height: 350px; border-radius: 6px; object-fit: contain; }
        .tabs { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
        .tab-btn { background: #0f172a; color: var(--text-secondary); border: 1px solid var(--border-color); padding: 0.4rem 0.8rem; border-radius: 6px; font-size: 0.85rem; cursor: pointer; }
        .tab-btn.active { background: var(--accent-color); color: #0f172a; font-weight: bold; border-color: var(--accent-color); }
    </style>
</head>
<body>
    <header>
        <h1>⚡ Ali Agent Studio <span style="font-size:0.75rem; background:#334155; padding:2px 8px; border-radius:4px; color:#38bdf8;">Cloudflare Worker</span></h1>
        <div style="font-size: 0.85rem; color: var(--text-secondary);">Powered by Pollinations AI API</div>
    </header>

    <div class="container">
        <div class="panel">
            <div class="panel-title">
                <span>💬 Agent Conversationnel & Code</span>
                <span id="status" style="font-size:0.75rem; font-weight:normal; color:#38bdf8;">Prêt</span>
            </div>
            <div class="chat-messages" id="chatMessages">
                <div class="message assistant">Salut ! Je suis ton agent tout-en-un. Demande-moi de rédiger du code propre, de générer des images, de composer de la musique ou de créer une vidéo.</div>
            </div>
            <div class="input-box">
                <textarea id="promptInput" placeholder="Ex: Code un composant React stylé ou génère une image futuriste..."></textarea>
                <button id="sendBtn" onclick="sendPrompt()">Envoyer</button>
            </div>
        </div>

        <div class="panel">
            <div class="panel-title">
                <span>🎨 Studio Multimédia Génératif</span>
                <div class="tabs">
                    <button class="tab-btn active" onclick="switchTab('image')">Image</button>
                    <button class="tab-btn" onclick="switchTab('audio')">Musique</button>
                    <button class="tab-btn" onclick="switchTab('video')">Vidéo</button>
                </div>
            </div>
            <div class="media-preview" id="mediaPreview">
                <p>Aucun média généré pour l'instant.<br>Utilisez le chat ou demandez une génération visuelle/audio.</p>
            </div>
        </div>
    </div>

    <script>
        let currentTab = 'image';

        function switchTab(tab) {
            currentTab = tab;
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            event.target.classList.add('active');
        }

        async function sendPrompt() {
            const input = document.getElementById('promptInput');
            const chatMessages = document.getElementById('chatMessages');
            const sendBtn = document.getElementById('sendBtn');
            const status = document.getElementById('status');
            const text = input.value.trim();
            if (!text) return;

            input.value = '';
            input.disabled = true;
            sendBtn.disabled = true;
            status.textContent = 'Génération en cours...';

            chatMessages.innerHTML += `<div class="message user">${escapeHtml(text)}</div>`;
            chatMessages.scrollTop = chatMessages.scrollHeight;

            try {
                const response = await fetch('/api/agent', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt: text })
                });

                const data = await response.json();

                if (data.type === 'text') {
                    chatMessages.innerHTML += `<div class="message assistant">${formatResponse(data.content)}</div>`;
                } else if (data.type === 'image') {
                    chatMessages.innerHTML += `<div class="message assistant">Voici l'image générée :<br><img src="${data.url}" style="width:100%; border-radius:6px; margin-top:8px;" /></div>`;
                    updateMediaPreview('image', data.url);
                } else if (data.type === 'audio') {
                    chatMessages.innerHTML += `<div class="message assistant">Musique / Audio généré :<br><audio controls src="${data.url}" style="width:100%; margin-top:8px;"></audio></div>`;
                    updateMediaPreview('audio', data.url);
                } else {
                    chatMessages.innerHTML += `<div class="message assistant">${formatResponse(data.content)}</div>`;
                }
            } catch (err) {
                chatMessages.innerHTML += `<div class="message assistant" style="color:#f87171;">Erreur de communication avec l'agent.</div>`;
            } finally {
                input.disabled = false;
                sendBtn.disabled = false;
                status.textContent = 'Prêt';
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        }

        function updateMediaPreview(type, url) {
            const preview = document.getElementById('mediaPreview');
            if (type === 'image') {
                preview.innerHTML = `<img src="${url}" alt="Image générée" /><a href="${url}" target="_blank" style="color:var(--accent-color); font-size:0.85rem; text-decoration:none;">Ouvrir l'image en grand ↗</a>`;
            } else if (type === 'audio') {
                preview.innerHTML = `<audio controls src="${url}" autoplay style="width:100%;"></audio><p style="font-size:0.85rem;">Flux audio généré via Pollinations / Audio API</p>`;
            }
        }

        function escapeHtml(text) {
            return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        }

        function formatResponse(text) {
            let formatted = escapeHtml(text);
            formatted = formatted.replace(/\```([a-z]*)\n([\s\S]*?)\n\```/g, '<pre><code>$2</code></pre>');
            return formatted.replace(/\n/g, '<br>');
        }
    </script>
</body>
</html>`;
      return new Response(html, {
        headers: { ...corsHeaders, "Content-Type": "text/html;charset=UTF-8" }
      });
    }

    if (url.pathname === "/api/agent" && request.method === "POST") {
      try {
        const body = await request.json();
        const prompt = body.prompt || "";
        const lowerPrompt = prompt.toLowerCase();

        if (lowerPrompt.includes("génère une image") || lowerPrompt.includes("crée une image") || lowerPrompt.includes("dessine") || lowerPrompt.includes("image de")) {
          const imagePrompt = encodeURIComponent(prompt);
          const imageUrl = `https://image.pollinations.ai/prompt/${imagePrompt}?width=1024&height=1024&nologo=true`;
          return new Response(JSON.stringify({ type: "image", url: imageUrl }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        } 
        else if (lowerPrompt.includes("chanson") || lowerPrompt.includes("musique") || lowerPrompt.includes("audio") || lowerPrompt.includes("son")) {
          const audioPrompt = encodeURIComponent(prompt);
          const audioUrl = `https://text.pollinations.ai/audio/${audioPrompt}`;
          return new Response(JSON.stringify({ type: "audio", url: audioUrl }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        else {
          const textApiResponse = await fetch(`https://text.pollinations.ai/${encodeURIComponent(prompt)}`, {
            method: "GET",
            headers: { "Content-Type": "text/plain" }
          });
          
          const textResult = await textApiResponse.text();
          return new Response(JSON.stringify({ type: "text", content: textResult }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
      } catch (err) {
        return new Response(JSON.stringify({ type: "text", content: "Erreur lors du traitement par l'agent : " + err.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  }
};
