/* SoulSync App - privacy-first, local-only */
(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const state = {
    theme: localStorage.getItem('theme') || 'dark',
    messages: JSON.parse(localStorage.getItem('ss_messages') || '[]'),
    entries: JSON.parse(localStorage.getItem('ss_entries') || '[]'),
    draft: localStorage.getItem('ss_draft') || '',
  };

  // Theme
  const applyTheme = (t) => {
    document.documentElement.classList.toggle('dark', t === 'dark');
    localStorage.setItem('theme', t);
  };
  applyTheme(state.theme);
  $('#themeToggle').addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    applyTheme(state.theme);
    // Re-init starfield to adapt colors
    initStarfield();
    if (!prefersReduced) startStarfield();
  });

  // Starfield background (3D, performant, respects reduced motion)
  const starCanvas = $('#starfield');
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let starCtx = null;
  let stars = [];
  let animId = null;
  let lastT = 0;

  function starColors() {
    // theme-aware colors
    return state.theme === 'dark' ? ['#a9b1ff', '#8a6dff'] : ['#5b6bff', '#885cff'];
  }

  function resetStar(s, w, h, zMax) {
    s.x = (Math.random() * 2 - 1) * w;
    s.y = (Math.random() * 2 - 1) * h;
    s.z = Math.random() * zMax * 0.9 + zMax * 0.1;
    s.pz = s.z;
    s.speed = 0.02 + Math.random() * 0.025; // world units per ms
    s.size = 1 + Math.random() * 1.5;
  }

  function initStarfield() {
    if (!starCanvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    starCanvas.width = Math.floor(w * dpr);
    starCanvas.height = Math.floor(h * dpr);
    starCanvas.style.width = w + 'px';
    starCanvas.style.height = h + 'px';
    starCtx = starCanvas.getContext('2d');
    starCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // density relative to area
    const area = w * h;
    const base = 0.00012; // stars per px
    const count = Math.min(1000, Math.max(120, Math.floor(area * base)));
    const cx = w / 2, cy = h / 2;
    const zMax = Math.max(w, h);
    if (stars.length !== count) stars = new Array(count).fill(0).map(() => ({ x:0, y:0, z:0, pz:0, speed:0, size:1 }));
    for (const s of stars) resetStar(s, cx, cy, zMax);

    // Draw a static frame if reduced motion
    if (prefersReduced) {
      drawStarfield(16);
      stopStarfield();
    }
  }

  function drawStarfield(dt) {
    if (!starCtx) return;
    const w = starCanvas.clientWidth;
    const h = starCanvas.clientHeight;
    const cx = w / 2, cy = h / 2;
    const zMax = Math.max(w, h);
    starCtx.clearRect(0, 0, w, h);
    const [c1, c2] = starColors();

    for (const s of stars) {
      // Move forward in Z (toward viewer)
      s.z -= dt * s.speed * 0.6 * (w > 900 ? 1 : 0.9);
      if (s.z < 1) resetStar(s, cx, cy, zMax);

      // Perspective projection
      const perspective = 200 / s.z; // focal length
      const x = cx + s.x * perspective;
      const y = cy + s.y * perspective;

      // Skip if off screen
      if (x < -50 || x > w + 50 || y < -50 || y > h + 50) continue;

      // Star trail from previous projected point
      const pPerspective = 200 / s.pz;
      const px = cx + s.x * pPerspective;
      const py = cy + s.y * pPerspective;
      s.pz = s.z;

      const grad = starCtx.createLinearGradient(px, py, x, y);
      grad.addColorStop(0, c2 + 'cc');
      grad.addColorStop(1, c1 + '00');
      starCtx.strokeStyle = grad;
      starCtx.lineWidth = Math.max(0.5, (1.6 - s.z / zMax) * s.size);
      starCtx.beginPath();
      starCtx.moveTo(px, py);
      starCtx.lineTo(x, y);
      starCtx.stroke();

      // Twinkle dot
      starCtx.fillStyle = c1;
      starCtx.globalAlpha = 0.6 + Math.random() * 0.4;
      starCtx.beginPath();
      starCtx.arc(x, y, Math.max(0.4, 1.1 - s.z / zMax) * s.size, 0, Math.PI * 2);
      starCtx.fill();
      starCtx.globalAlpha = 1;
    }
  }

  function step(ts) {
    if (!lastT) lastT = ts;
    const dt = Math.min(32, ts - lastT); // clamp delta
    lastT = ts;
    drawStarfield(dt);
    animId = requestAnimationFrame(step);
  }

  function startStarfield() {
    stopStarfield();
    lastT = 0;
    animId = requestAnimationFrame(step);
  }
  function stopStarfield() {
    if (animId) cancelAnimationFrame(animId);
    animId = null;
  }

  window.addEventListener('resize', () => {
    initStarfield();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopStarfield();
    else if (!prefersReduced) startStarfield();
  });

  initStarfield();
  if (!prefersReduced) startStarfield();

  // Sidebar navigation (ChatGPT-like)
  const navButtons = ['navChat','navJournal','navAnalytics','navSettings'].map(id => document.getElementById(id)).filter(Boolean);
  const views = $$('[data-view]');
  const composer = $('#chatForm');
  const sidebar = document.querySelector('.sidebar');
  const menuToggle = $('#menuToggle');
  const scrim = $('#scrim');
  function openSidebar() {
    sidebar?.classList.add('open');
    scrim?.removeAttribute('hidden');
    menuToggle?.setAttribute('aria-expanded', 'true');
  }
  function closeSidebar() {
    sidebar?.classList.remove('open');
    scrim?.setAttribute('hidden', '');
    menuToggle?.setAttribute('aria-expanded', 'false');
  }
  menuToggle?.addEventListener('click', () => {
    if (sidebar?.classList.contains('open')) closeSidebar(); else openSidebar();
  });
  scrim?.addEventListener('click', closeSidebar);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSidebar();
  });
  function showView(view) {
    navButtons.forEach(b => b?.classList.toggle('active', b?.dataset.view === view));
    views.forEach(v => v.toggleAttribute('hidden', v.dataset.view !== view));
    composer.hidden = view !== 'chat';
    // Close sidebar on navigation (useful on mobile)
    closeSidebar();
  }
  navButtons.forEach(b => b?.addEventListener('click', () => showView(b.dataset.view)));
  const newChatBtn = $('#newChat');
  newChatBtn?.addEventListener('click', () => {
    state.messages = [];
    saveMessages();
    renderMessages();
    showView('chat');
  });

  // Chat
  const chatList = $('#chatList');
  const chatForm = $('#chatForm');
  const chatInput = $('#chatInput');
  const micBtn = $('#micBtn');
  const sendBtn = $('#sendBtn');

  function timeStr(d = new Date()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function renderMessages() {
    chatList.innerHTML = '';
    state.messages.forEach(m => {
      const row = document.createElement('div');
      row.className = `row ${m.role}`;
      const avatar = document.createElement('div');
      avatar.className = 'avatar';
      avatar.textContent = m.role === 'user' ? '🙂' : '🜂';
      const msg = document.createElement('div');
      msg.className = 'msg';
      msg.textContent = m.text;
      row.appendChild(avatar);
      row.appendChild(msg);
      chatList.appendChild(row);
    });
    chatList.scrollTop = chatList.scrollHeight;
  }

  function createAssistantRow() {
    const row = document.createElement('div');
    row.className = 'row ai';
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = '🜂';
    const msg = document.createElement('div');
    msg.className = 'msg';
    row.appendChild(avatar);
    row.appendChild(msg);
    chatList.appendChild(row);
    row.scrollIntoView({ behavior: 'smooth', block: 'end' });
    return msg;
  }

  async function streamTextToElement(el, fullText) {
    // Stream by words for a natural effect
    const words = fullText.split(/(\s+)/); // keep spaces
    el.textContent = '';
    for (let i = 0; i < words.length; i++) {
      el.textContent += words[i];
      if (i % 6 === 0) chatList.scrollTop = chatList.scrollHeight;
      await new Promise(r => setTimeout(r, 18));
    }
    chatList.scrollTop = chatList.scrollHeight;
  }

  let typingEl = null;
  function showTypingIndicator() {
    removeTypingIndicator();
    const row = document.createElement('div');
    row.className = 'row ai typing';
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = '🜂';
    const msg = document.createElement('div');
    msg.className = 'msg';
    const dots = document.createElement('span');
    dots.className = 'dots';
    dots.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
    msg.appendChild(dots);
    row.appendChild(avatar);
    row.appendChild(msg);
    chatList.appendChild(row);
    typingEl = row;
    row.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }
  function removeTypingIndicator() {
    if (typingEl && typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);
    typingEl = null;
  }

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
  }

  function saveMessages() {
    localStorage.setItem('ss_messages', JSON.stringify(state.messages));
  }

  async function aiRespond(userText) {
    // Lightweight, local-only supportive reply
    const lower = userText.toLowerCase();
    let reply = "I'm here with you. Want to take a slow breath together? Inhale 4, hold 4, exhale 6.";
    if (/anxious|anxiety|nervous|worry/.test(lower)) reply = "It sounds like anxiety is present. Try a 4-7-8 breath. What would feel grounding right now?";
    else if (/sad|down|depress/.test(lower)) reply = "I'm sorry it's heavy. What’s one small kindness you can offer yourself today?";
    else if (/angry|frustrated|mad/.test(lower)) reply = "Anger is valid. Noticing it is a strength. Would naming what feels unfair help?";
    else if (/tired|exhaust/.test(lower)) reply = "Rest matters. If you could do one gentle thing next, what would it be?";

    const m = { role: 'ai', text: reply, time: timeStr() };
    state.messages.push(m);
    saveMessages();
    const el = createAssistantRow();
    await streamTextToElement(el, m.text);
  }

  async function callBackend(messages) {
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messages.map(m => ({ role: m.role === 'ai' ? 'assistant' : m.role, content: m.text })), model: undefined })
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      return data.content || '';
    } catch (err) {
      throw err;
    }
  }

  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;
    const m = { role: 'user', text, time: timeStr() };
    state.messages.push(m);
    saveMessages();
    renderMessages();
    chatInput.value = '';

    // Disable inputs and show typing indicator
    sendBtn?.setAttribute('disabled', 'true');
    micBtn?.setAttribute('disabled', 'true');
    chatInput.setAttribute('disabled', 'true');
    showTypingIndicator();

    // Try backend first; fallback to local response
    try {
      const reply = await callBackend(state.messages);
      const a = { role: 'ai', text: reply || "", time: timeStr() };
      state.messages.push(a);
      saveMessages();
      // Stream render for responsiveness
      removeTypingIndicator();
      const el = createAssistantRow();
      await streamTextToElement(el, a.text);
    } catch (_) {
      removeTypingIndicator();
      // Small delay to feel responsive
      setTimeout(() => aiRespond(text), 200);
    }
    removeTypingIndicator();
    sendBtn?.removeAttribute('disabled');
    micBtn?.removeAttribute('disabled');
    chatInput.removeAttribute('disabled');
    chatInput.focus();
  });

  // Enter to send, Shift+Enter for newline
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      chatForm.requestSubmit();
    }
  });

  // Voice to text
  let recognition;
  try {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      recognition = new SR();
      recognition.lang = navigator.language || 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onresult = (e) => {
        const transcript = e.results[0][0].transcript;
        chatInput.value = (chatInput.value + ' ' + transcript).trim();
      };
      recognition.onstart = () => { micBtn?.classList.add('listening'); };
      recognition.onend = () => { micBtn?.classList.remove('listening'); };
      recognition.onerror = () => { micBtn?.classList.remove('listening'); };
    }
  } catch (_) {}

  micBtn.addEventListener('click', async () => {
    if (!recognition) {
      alert('Voice input not supported in this browser.');
      return;
    }
    try { recognition.start(); } catch (_) {}
  });

  // Journal
  const promptSelect = $('#promptSelect');
  const journalText = $('#journalText');
  const moodRange = $('#mood');
  const moodEmoji = $('#moodEmoji');
  const saveEntryBtn = $('#saveEntry');
  const newEntryBtn = $('#newEntry');
  const entryList = $('#entryList');

  const moodMap = {1:'😔',2:'😟',3:'😐',4:'🙂',5:'😄'};
  function updateMoodEmoji() { moodEmoji.textContent = moodMap[moodRange.value] || '😐'; }
  moodRange.addEventListener('input', updateMoodEmoji);
  updateMoodEmoji();

  // Autosave draft
  if (state.draft) journalText.value = state.draft;
  journalText.addEventListener('input', () => {
    state.draft = journalText.value;
    localStorage.setItem('ss_draft', state.draft);
  });

  function renderEntries() {
    entryList.innerHTML = '';
    const sorted = [...state.entries].sort((a,b) => b.created - a.created);
    for (const e of sorted) {
      const li = document.createElement('li');
      const date = new Date(e.created);
      li.innerHTML = `
        <div class="meta">${date.toLocaleDateString()} • Mood ${e.mood} ${moodMap[e.mood] || ''} • ${e.prompt}</div>
        <div>${escapeHtml(e.text.slice(0, 160))}${e.text.length > 160 ? '…' : ''}</div>
      `;
      li.addEventListener('click', () => {
        promptSelect.value = e.prompt;
        journalText.value = e.text;
        moodRange.value = e.mood;
        updateMoodEmoji();
      });
      entryList.appendChild(li);
    }
  }

  function saveEntries() { localStorage.setItem('ss_entries', JSON.stringify(state.entries)); }

  saveEntryBtn.addEventListener('click', () => {
    const text = journalText.value.trim();
    if (!text) return alert('Write something first.');
    const entry = {
      id: cryptoRandomId(),
      created: Date.now(),
      prompt: promptSelect.value,
      text,
      mood: Number(moodRange.value)
    };
    state.entries.push(entry);
    saveEntries();
    state.draft = '';
    localStorage.removeItem('ss_draft');
    journalText.value = '';
    renderEntries();
    renderAnalytics();
  });

  newEntryBtn.addEventListener('click', () => {
    journalText.value = '';
    state.draft = '';
    localStorage.removeItem('ss_draft');
  });

  // Analytics
  let moodChart;
  function renderAnalytics() {
    const ctx = $('#moodChart');
    const last30 = daysBack(30).map(d => d.toDateString());
    const grouped = new Map();
    for (const e of state.entries) {
      const k = new Date(e.created).toDateString();
      if (!grouped.has(k)) grouped.set(k, []);
      grouped.get(k).push(e.mood);
    }
    const labels = [];
    const data = [];
    for (const dayKey of last30) {
      labels.push(shortDate(dayKey));
      const arr = grouped.get(dayKey) || [];
      data.push(arr.length ? avg(arr) : null);
    }

    if (moodChart) moodChart.destroy();
    moodChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Mood', data, spanGaps: true, tension: 0.35,
          borderColor: 'rgba(109,124,255,0.95)',
          backgroundColor: 'rgba(109,124,255,0.25)',
          fill: true,
        }]
      },
      options: {
        scales: { y: { min: 1, max: 5, ticks: { stepSize: 1 } } },
        plugins: { legend: { display: false } },
        responsive: true,
      }
    });

    // Streak
    const streakDays = calcStreak(grouped);
    $('#streak').textContent = `${streakDays} day${streakDays===1?'':'s'}`;
  }

  function daysBack(n) {
    const arr = [];
    const today = new Date(); today.setHours(0,0,0,0);
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      arr.push(d);
    }
    return arr;
  }
  function shortDate(dateString) {
    const d = new Date(dateString);
    return `${d.getMonth()+1}/${d.getDate()}`;
  }
  function avg(a) { return a.reduce((s,x)=>s+x,0)/a.length; }
  function calcStreak(grouped) {
    let streak = 0;
    const today = new Date(); today.setHours(0,0,0,0);
    for (let i = 0; i < 365; i++) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      const key = d.toDateString();
      if (grouped.has(key)) streak++; else break;
    }
    return streak;
  }

  // Settings: export/import/clear
  $('#exportData').addEventListener('click', () => {
    const data = {
      messages: state.messages,
      entries: state.entries
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `soulsync-${Date.now()}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  $('#importFile').addEventListener('change', async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const text = await f.text();
      const json = JSON.parse(text);
      if (Array.isArray(json.messages)) state.messages = json.messages;
      if (Array.isArray(json.entries)) state.entries = json.entries;
      saveMessages();
      saveEntries();
      renderMessages();
      renderEntries();
      renderAnalytics();
      alert('Import successful.');
    } catch (err) {
      alert('Import failed. Ensure the file is a valid SoulSync export.');
    } finally {
      e.target.value = '';
    }
  });

  $('#clearData').addEventListener('click', () => {
    if (!confirm('Erase all local data? This cannot be undone.')) return;
    localStorage.removeItem('ss_messages');
    localStorage.removeItem('ss_entries');
    localStorage.removeItem('ss_draft');
    state.messages = [];
    state.entries = [];
    state.draft = '';
    renderMessages();
    renderEntries();
    renderAnalytics();
  });

  function cryptoRandomId() {
    if (window.crypto?.randomUUID) return crypto.randomUUID();
    return 'id-' + Math.random().toString(36).slice(2, 10);
  }

  // Initial renders
  renderMessages();
  renderEntries();
  renderAnalytics();
  showView('chat');
})();
