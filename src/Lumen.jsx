import React, { useState, useRef, useEffect } from "react";

const NOHEMI_FONTS = "@font-face{font-family:'Nohemi';font-style:normal;font-weight:100;font-display:swap;src:url('/fonts/Nohemi-Thin.woff2') format('woff2');}@font-face{font-family:'Nohemi';font-style:normal;font-weight:200;font-display:swap;src:url('/fonts/Nohemi-ExtraLight.woff2') format('woff2');}@font-face{font-family:'Nohemi';font-style:normal;font-weight:300;font-display:swap;src:url('/fonts/Nohemi-Light.woff2') format('woff2');}@font-face{font-family:'Nohemi';font-style:normal;font-weight:400;font-display:swap;src:url('/fonts/Nohemi-Regular.woff2') format('woff2');}@font-face{font-family:'Nohemi';font-style:normal;font-weight:500;font-display:swap;src:url('/fonts/Nohemi-Medium.woff2') format('woff2');}@font-face{font-family:'Nohemi';font-style:normal;font-weight:600;font-display:swap;src:url('/fonts/Nohemi-SemiBold.woff2') format('woff2');}@font-face{font-family:'Nohemi';font-style:normal;font-weight:700;font-display:swap;src:url('/fonts/Nohemi-Bold.woff2') format('woff2');}@font-face{font-family:'Nohemi';font-style:normal;font-weight:800;font-display:swap;src:url('/fonts/Nohemi-ExtraBold.woff2') format('woff2');}@font-face{font-family:'Nohemi';font-style:normal;font-weight:900;font-display:swap;src:url('/fonts/Nohemi-Black.woff2') format('woff2');}";


/* ============================================================================
   LUMEN — piattaforma di produttività
   Estensione: Auth + route guard · CRUD pagine/sezioni + Cestino ·
   undo/redo · template · preferiti · breadcrumb · copertina/icona ·
   commenti sui blocchi · condivisione · Lumì AI (streaming Anthropic).
   Identità estetica 3D e micro-animazioni invariate ("Atelier blueprint").
   AUTH/PERSISTENZA: adapter locale con interfaccia Supabase-like, sostituibile.
   ============================================================================ */

const T = {
  bg: "#0B1020", bg2: "#0F1730", panel: "rgba(18,26,48,0.72)",
  line: "rgba(122,150,210,0.16)", ink: "#EAF0FF", sub: "#9DB0D8",
  amber: "#E8A33D", cyan: "#5FD3C6", glass: "rgba(95,211,198,0.10)", danger: "#E8625D",
};
const uid = () => Math.random().toString(36).slice(2, 10);
const now = () => Date.now();

/* ===== STORE ===== */
function makeStore(initial) {
  let state = initial; const subs = new Set();
  return { get: () => state, set: (fn) => { state = { ...state, ...fn(state) }; subs.forEach((s) => s()); },
    subscribe: (cb) => { subs.add(cb); return () => subs.delete(cb); }, replace: (s) => { state = s; subs.forEach((x) => x()); } };
}
function freshWorkspace() {
  return {
    pages: {
      home: { id: "home", title: "Benvenuto in Lumen", icon: "✦", parent: null, children: ["proj"], width: "normal", favorite: false, trashed: false },
      proj: { id: "proj", title: "Progetti", icon: "◷", parent: "home", children: [], cover: null, width: "normal", favorite: false, trashed: false },
    },
    order: ["home"],
    blocks: {
      home: [
        { id: uid(), type: "h1", text: "Lumen" },
        { id: uid(), type: "quote", text: "Un'area di lavoro che respira. Premi  /  per un blocco, Cmd+K per cercare." },
        { id: uid(), type: "callout", text: "Tasto destro su una pagina per **rinominare, duplicare, cestinare**." },
        { id: uid(), type: "todo", text: "Esplorare i template", checked: false },
        { id: uid(), type: "p", text: "Apri Lumi AI in basso a destra per generare contenuti." },
      ],
      proj: [{ id: uid(), type: "h2", text: "Progetti" }, { id: uid(), type: "p", text: "" }],
    },
    comments: {}, shares: {}, reactions: {}, currentPage: "home", theme: "dark",
    inbox: [], reminders: [], publicPages: {}, files: [],
    settings: { sound: false, cursor: true, particles: true, soundscape: false, reduceMotion: false },
    gam: { streak: 0, lastActive: null, blocksCreated: 0, wordsWeek: 0, weekStart: null, achievements: [] },
  };
}
const store = makeStore(freshWorkspace());
function persistFor(userId) { if (!userId) return; try { localStorage.setItem("lumen:ws:" + userId, JSON.stringify(store.get())); } catch (e) {} }
function loadFor(userId) { try { const raw = localStorage.getItem("lumen:ws:" + userId); if (raw) { store.replace(JSON.parse(raw)); return; } } catch (e) {} store.replace(freshWorkspace()); }
function useStore(selector) { const [, force] = useState(0); useEffect(() => store.subscribe(() => force((n) => n + 1)), []); return selector(store.get()); }

/* ===== UNDO/REDO ===== */
const history = { past: [], future: [], last: 0, label: "" };
const snapshot = () => { const s = store.get(); return JSON.stringify({ pages: s.pages, blocks: s.blocks, order: s.order, comments: s.comments, shares: s.shares }); };
function pushHistory(label) { const t = now(); if (t - history.last < 600 && history.label === label && history.past.length) { history.last = t; return; } history.past.push(snapshot()); if (history.past.length > 100) history.past.shift(); history.future = []; history.last = t; history.label = label; }
function applySnap(json) { const d = JSON.parse(json); store.set(() => ({ pages: d.pages, blocks: d.blocks, order: d.order, comments: d.comments, shares: d.shares })); }
function undo() { if (!history.past.length) return; history.future.push(snapshot()); applySnap(history.past.pop()); }
function redo() { if (!history.future.length) return; history.past.push(snapshot()); applySnap(history.future.pop()); }

/* ===== ACTIONS ===== */
const A = {
  setPage: (id) => store.set(() => ({ currentPage: id })),
  toggleTheme: () => store.set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),
  setBlocks: (pid, blocks, label = "edit") => { pushHistory(label); store.set((s) => ({ blocks: { ...s.blocks, [pid]: blocks }, pages: s.pages[pid] ? { ...s.pages, [pid]: { ...s.pages[pid], editedAt: now() } } : s.pages })); if (typeof touchStreak === "function") touchStreak(); },
  addPage: (parent, seed) => { pushHistory("addPage"); let nid;
    store.set((s) => { const id = uid(); nid = id;
      const pages = { ...s.pages, [id]: { id, title: (seed && seed.title) || "Senza titolo", icon: (seed && seed.icon) || "○", parent, children: [], cover: null, width: "normal", favorite: false, trashed: false } };
      if (parent && pages[parent]) pages[parent] = { ...pages[parent], children: [...pages[parent].children, id] };
      return { pages, blocks: { ...s.blocks, [id]: (seed && seed.blocks) || [{ id: uid(), type: "h1", text: (seed && seed.title) || "Senza titolo" }] }, order: parent ? s.order : [...s.order, id], currentPage: id }; });
    return nid; },
  rename: (id, title) => { pushHistory("rename"); store.set((s) => ({ pages: { ...s.pages, [id]: { ...s.pages[id], title } } })); },
  setIcon: (id, icon) => { pushHistory("icon"); store.set((s) => ({ pages: { ...s.pages, [id]: { ...s.pages[id], icon } } })); },
  setWidth: (id, width) => { pushHistory("width"); store.set((s) => ({ pages: { ...s.pages, [id]: { ...s.pages[id], width } } })); },
  toggleFav: (id) => { pushHistory("fav"); store.set((s) => ({ pages: { ...s.pages, [id]: { ...s.pages[id], favorite: !s.pages[id].favorite } } })); },
  duplicate: (id) => { pushHistory("duplicate");
    store.set((s) => { const src = s.pages[id]; const nid = uid();
      const pages = { ...s.pages, [nid]: { ...src, id: nid, title: src.title + " (copia)", children: [] } };
      if (src.parent && pages[src.parent]) { const sib = [...pages[src.parent].children]; sib.splice(sib.indexOf(id) + 1, 0, nid); pages[src.parent] = { ...pages[src.parent], children: sib }; }
      const blocks = { ...s.blocks, [nid]: (s.blocks[id] || []).map((b) => ({ ...b, id: uid() })) };
      const order = src.parent ? s.order : (() => { const o = [...s.order]; o.splice(o.indexOf(id) + 1, 0, nid); return o; })();
      return { pages, blocks, order, currentPage: nid }; }); },
  trash: (id) => { pushHistory("trash");
    store.set((s) => { const pages = { ...s.pages }; const mark = (x) => { pages[x] = { ...pages[x], trashed: true, trashedAt: now() }; (pages[x].children || []).forEach(mark); }; mark(id);
      let order = s.order, currentPage = s.currentPage;
      if (s.pages[id].parent == null) order = s.order.filter((o) => o !== id);
      if (currentPage === id || (pages[currentPage] && pages[currentPage].trashed)) currentPage = order[0] || "home";
      return { pages, order, currentPage }; }); },
  restore: (id) => { pushHistory("restore");
    store.set((s) => { const pages = { ...s.pages }; const mark = (x) => { pages[x] = { ...pages[x], trashed: false }; (pages[x].children || []).forEach(mark); }; mark(id);
      const p = pages[id]; let order = s.order;
      if (p.parent == null && !order.includes(id)) order = [...order, id];
      if (p.parent && pages[p.parent] && !pages[p.parent].children.includes(id)) pages[p.parent] = { ...pages[p.parent], children: [...pages[p.parent].children, id] };
      return { pages, order, currentPage: id }; }); },
  purge: (id) => { pushHistory("purge");
    store.set((s) => { const pages = { ...s.pages }; const blocks = { ...s.blocks }; const kill = (x) => { ((pages[x] && pages[x].children) || []).forEach(kill); delete blocks[x]; delete pages[x]; };
      const parent = pages[id] && pages[id].parent; kill(id);
      if (parent && pages[parent]) pages[parent] = { ...pages[parent], children: pages[parent].children.filter((c) => c !== id) };
      return { pages, blocks, order: s.order.filter((o) => o !== id) }; }); },
  emptyTrash: () => { pushHistory("emptyTrash");
    store.set((s) => { const pages = { ...s.pages }; const blocks = { ...s.blocks };
      Object.values(s.pages).filter((p) => p.trashed).forEach((p) => { delete pages[p.id]; delete blocks[p.id]; });
      Object.values(pages).forEach((p) => { p.children = (p.children || []).filter((c) => pages[c]); });
      return { pages, blocks }; }); },
  movePage: (id, newParent, index) => { pushHistory("move");
    store.set((s) => { if (id === newParent) return {}; let p = newParent; while (p) { if (p === id) return {}; p = s.pages[p] && s.pages[p].parent; }
      const pages = { ...s.pages }; const old = pages[id].parent;
      if (old && pages[old]) pages[old] = { ...pages[old], children: pages[old].children.filter((c) => c !== id) };
      let order = old == null ? s.order.filter((o) => o !== id) : [...s.order];
      pages[id] = { ...pages[id], parent: newParent };
      if (newParent == null) { const o = [...order]; o.splice(index == null ? o.length : index, 0, id); order = o; }
      else { const ch = [...pages[newParent].children]; ch.splice(index == null ? ch.length : index, 0, id); pages[newParent] = { ...pages[newParent], children: ch }; }
      return { pages, order }; }); },
  addComment: (blockId, text, author) => store.set((s) => ({ comments: { ...s.comments, [blockId]: [...(s.comments[blockId] || []), { id: uid(), text, author, ts: now() }] } })),
  share: (pageId, email, role) => store.set((s) => ({ shares: { ...s.shares, [pageId]: [...(s.shares[pageId] || []).filter((x) => x.email !== email), { email, role }] } })),
  unshare: (pageId, email) => store.set((s) => ({ shares: { ...s.shares, [pageId]: (s.shares[pageId] || []).filter((x) => x.email !== email) } })),
};

/* ===== AUTH (interfaccia Supabase-like) ===== */
const auth = (() => {
  const KEY = "lumen:auth"; const listeners = new Set();
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { return null; } };
  const write = (u) => { u ? localStorage.setItem(KEY, JSON.stringify(u)) : localStorage.removeItem(KEY); listeners.forEach((l) => l(u)); };
  const users = () => { try { return JSON.parse(localStorage.getItem("lumen:users") || "{}"); } catch (e) { return {}; } };
  const saveUsers = (u) => localStorage.setItem("lumen:users", JSON.stringify(u));
  const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return String(h); };
  return {
    getSession: () => read(),
    onAuthStateChange: (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    async signUp({ email, password, name }) { await new Promise((r) => setTimeout(r, 450));
      const all = users(); if (all[email]) throw new Error("Esiste gia un account con questa email.");
      const user = { id: uid(), email, name: name || email.split("@")[0], avatar: null, theme: "dark", lang: "it", provider: "email" };
      all[email] = { pass: hash(password), user }; saveUsers(all); write(user); return user; },
    async signIn({ email, password }) { await new Promise((r) => setTimeout(r, 450));
      const all = users(); const rec = all[email];
      if (!rec || rec.pass !== hash(password)) throw new Error("Email o password non corretti."); write(rec.user); return rec.user; },
    signOut() { write(null); },
    updateUser(patch) { const u = { ...read(), ...patch }; const all = users(); if (all[u.email]) { all[u.email].user = u; saveUsers(all); } write(u); return u; },
  };
})();
function useAuth() { const [user, setUser] = useState(() => auth.getSession()); useEffect(() => auth.onAuthStateChange(setUser), []); return user; }

/* ===== SCENA 3D ===== */
function InkScene({ theme }) {
  const ref = useRef(null), reduced = useRef(false);
  const mouse = useRef({ x: .5, y: .5, tx: .5, ty: .5 }), scroll = useRef(0);
  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const canvas = ref.current, gl = canvas.getContext("webgl", { antialias: false, alpha: true }); if (!gl) return;
    const vert = "attribute vec2 p; void main(){ gl_Position=vec4(p,0.,1.); }";
    const frag = [
      "precision highp float; uniform vec2 u_res; uniform float u_t; uniform vec2 u_mouse; uniform float u_scroll; uniform float u_dark;",
      "float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }",
      "float noise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y); }",
      "float fbm(vec2 p){ float v=0.,a=.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.03; a*=.5; } return v; }",
      "void main(){ vec2 uv=gl_FragCoord.xy/u_res.xy; vec2 asp=vec2(u_res.x/u_res.y,1.); vec2 p=uv*asp; vec2 m=u_mouse*asp;",
      "  float t=u_t*0.06+u_scroll*0.5; float d=distance(p,m);",
      "  vec2 warp=vec2(fbm(p*2.2+t),fbm(p*2.2-t+4.0)); float ripple=0.18/(d*6.0+0.4)*sin(d*22.0-u_t*1.4);",
      "  float field=fbm(p*1.6+warp*0.9+vec2(0.0,t))+ripple;",
      "  vec3 deep=u_dark>0.5?vec3(0.043,0.063,0.125):vec3(0.93,0.95,1.0);",
      "  vec3 mid=u_dark>0.5?vec3(0.075,0.13,0.27):vec3(0.82,0.88,0.99);",
      "  vec3 amber=vec3(0.91,0.64,0.24), cyan=vec3(0.37,0.83,0.78);",
      "  vec3 col=mix(deep,mid,smoothstep(0.2,0.95,field));",
      "  col=mix(col,cyan,smoothstep(0.55,0.95,field)*0.30);",
      "  col=mix(col,amber,smoothstep(0.62,0.78,field)*0.16*(0.6+ripple*4.0));",
      "  col*=1.0-0.5*pow(distance(uv,vec2(0.5)),2.2);",
      "  gl_FragColor=vec4(col,u_dark>0.5?0.92:0.88); }"
    ].join("\n");
    const sh = (ty, s) => { const x = gl.createShader(ty); gl.shaderSource(x, s); gl.compileShader(x); return x; };
    const prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, vert)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, frag)); gl.linkProgram(prog); gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = (n) => gl.getUniformLocation(prog, n); const uRes=U("u_res"),uT=U("u_t"),uM=U("u_mouse"),uS=U("u_scroll"),uD=U("u_dark");
    const resize = () => { const dpr = Math.min(window.devicePixelRatio || 1, 1.5); canvas.width = canvas.clientWidth*dpr; canvas.height = canvas.clientHeight*dpr; gl.viewport(0,0,canvas.width,canvas.height); };
    resize(); window.addEventListener("resize", resize);
    const onMove = (e) => { mouse.current.tx = e.clientX/window.innerWidth; mouse.current.ty = 1-e.clientY/window.innerHeight; };
    const onScroll = () => { scroll.current = (window.scrollY % 1000)/1000; };
    window.addEventListener("pointermove", onMove); window.addEventListener("scroll", onScroll, { passive: true });
    let raf, start = performance.now(), last = 0; const darkVal = theme === "dark" ? 1 : 0;
    const loop = (n) => { raf = requestAnimationFrame(loop); if (n-last < 1000/40) return; last = n;
      mouse.current.x += (mouse.current.tx-mouse.current.x)*.06; mouse.current.y += (mouse.current.ty-mouse.current.y)*.06;
      const t = reduced.current ? 0 : (n-start)/1000;
      gl.uniform2f(uRes,canvas.width,canvas.height); gl.uniform1f(uT,t); gl.uniform2f(uM,mouse.current.x,mouse.current.y);
      gl.uniform1f(uS, reduced.current?0:scroll.current); gl.uniform1f(uD, darkVal); gl.drawArrays(gl.TRIANGLES,0,3); };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); window.removeEventListener("pointermove", onMove); window.removeEventListener("scroll", onScroll); };
  }, [theme]);
  return <canvas ref={ref} style={{ position: "fixed", inset: 0, width: "100%", height: "100%", zIndex: 0 }} />;
}

/* ===== MARKDOWN inline + SLASH ===== */
function inline(text) {
  const out = []; let key = 0, last = 0, m; const re = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)/g;
  while ((m = re.exec(text))) { if (m.index > last) out.push(text.slice(last, m.index));
    if (m[2]) out.push(<strong key={key++}>{m[2]}</strong>);
    else if (m[4]) out.push(<em key={key++}>{m[4]}</em>);
    else if (m[6]) out.push(<code key={key++} style={{ background: T.glass, color: T.cyan, padding: "1px 5px", borderRadius: 4, fontFamily: "'Nohemi'", fontSize: ".88em" }}>{m[6]}</code>);
    last = re.lastIndex; }
  if (last < text.length) out.push(text.slice(last)); return out;
}
const SLASH = [
  { type: "p", label: "Testo", hint: "Paragrafo", icon: "P" }, { type: "h1", label: "Titolo 1", hint: "Grande", icon: "H1" },
  { type: "h2", label: "Titolo 2", hint: "Medio", icon: "H2" }, { type: "h3", label: "Titolo 3", hint: "Piccolo", icon: "H3" },
  { type: "todo", label: "To-do", hint: "Spunta", icon: "☑" }, { type: "toggle", label: "Toggle", hint: "Collassabile", icon: "▸" },
  { type: "callout", label: "Callout", hint: "Evidenziato", icon: "❖" }, { type: "quote", label: "Citazione", hint: "Citato", icon: "❝" },
  { type: "code", label: "Codice", hint: "Monospace", icon: "</>" }, { type: "divider", label: "Divisore", hint: "Linea", icon: "—" },
];
function SlashMenu({ query, onPick, onClose }) {
  const items = SLASH.filter((s) => s.label.toLowerCase().includes(query.toLowerCase()));
  const [sel, setSel] = useState(0); useEffect(() => setSel(0), [query]);
  useEffect(() => { const k = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); items[sel] && onPick(items[sel].type); }
    else if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k, true); return () => window.removeEventListener("keydown", k, true);
  }, [items, sel, onPick, onClose]);
  if (!items.length) return null;
  return (
    <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 6, width: 280, zIndex: 50, background: T.panel, backdropFilter: "blur(16px)", border: "1px solid " + T.line, borderRadius: 12, boxShadow: "0 20px 60px rgba(0,0,0,.5)", overflow: "hidden", animation: "lm-pop .14s cubic-bezier(.2,1.2,.3,1)" }}>
      {items.map((it, i) => (
        <button key={it.type} onMouseEnter={() => setSel(i)} onClick={() => onPick(it.type)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "9px 12px", border: "none", cursor: "pointer", textAlign: "left", background: i === sel ? T.glass : "transparent", color: T.ink }}>
          <span style={{ width: 26, height: 26, display: "grid", placeItems: "center", borderRadius: 7, background: "rgba(122,150,210,.12)", color: T.cyan, fontSize: 12, fontFamily: "'Nohemi'" }}>{it.icon}</span>
          <span style={{ flex: 1 }}><span style={{ display: "block", fontSize: 14, fontWeight: 600 }}>{it.label}</span><span style={{ display: "block", fontSize: 11.5, color: T.sub }}>{it.hint}</span></span>
        </button>
      ))}
    </div>
  );
}

/* ===== BLOCCO ===== */
function Block({ block, idx, onChange, onEnter, onBackspace, onDelete, dragHandlers, dragging, dropHint }) {
  const ref = useRef(null);
  const [slash, setSlash] = useState(null);
  const [menu, setMenu] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const comments = useStore((s) => s.comments[block.id] || []);
  const user = useAuth();
  useEffect(() => { if (ref.current && ref.current.innerText !== (block.text || "")) ref.current.innerText = block.text || ""; }, [block.id]); // eslint-disable-line
  const commit = () => { const txt = ref.current ? ref.current.innerText : ""; if (txt !== block.text) onChange({ ...block, text: txt }); };
  const onInput = () => { const txt = ref.current.innerText;
    const map = { "# ": "h1", "## ": "h2", "### ": "h3", "[] ": "todo", "[ ] ": "todo", "> ": "quote", "```": "code", "--- ": "divider" };
    for (const k in map) if (txt.startsWith(k)) { ref.current.innerText = ""; onChange({ ...block, type: map[k], text: "" }); return; }
    if (txt.startsWith("/")) { const mm = txt.match(/^\/(\w*)/); setSlash({ query: mm ? mm[1] : "" }); } else setSlash(null); };
  const onKeyDown = (e) => { if (slash) return;
    if (e.key === "Enter" && !e.shiftKey && block.type !== "code") { e.preventDefault(); commit(); onEnter(idx); }
    else if (e.key === "Backspace" && ref.current.innerText === "") { e.preventDefault(); onBackspace(idx); } };
  const pickSlash = (type) => { if (ref.current) ref.current.innerText = ""; setSlash(null);
    if (type === "divider") { onChange({ ...block, type, text: "" }); onEnter(idx); } else onChange({ ...block, type, text: "" });
    setTimeout(() => ref.current && ref.current.focus(), 0); };
  const ed = { ref, contentEditable: true, suppressContentEditableWarning: true, onInput, onKeyDown, onBlur: commit, spellCheck: false, style: { outline: "none", minHeight: "1.4em", caretColor: T.amber, lineHeight: 1.6 } };

  let body;
  switch (block.type) {
    case "h1": body = <div {...ed} style={{ ...ed.style, fontFamily: "'Nohemi',sans-serif", fontSize: 38, fontWeight: 800, letterSpacing: "-.02em" }} />; break;
    case "h2": body = <div {...ed} style={{ ...ed.style, fontFamily: "'Nohemi',sans-serif", fontSize: 27, fontWeight: 700 }} />; break;
    case "h3": body = <div {...ed} style={{ ...ed.style, fontFamily: "'Nohemi',sans-serif", fontSize: 20, fontWeight: 700 }} />; break;
    case "todo": body = (<div style={{ display: "flex", gap: 10 }}>
      <button onClick={() => { const nv = !block.checked; onChange({ ...block, checked: nv }); if (nv && typeof Sound !== "undefined") Sound.check(); }} style={{ marginTop: 3, width: 19, height: 19, borderRadius: 6, flexShrink: 0, cursor: "pointer", border: "1.5px solid " + (block.checked ? T.cyan : T.line), background: block.checked ? T.cyan : "transparent", color: T.bg, fontSize: 12, display: "grid", placeItems: "center", transition: "all .18s cubic-bezier(.2,1.4,.4,1)" }}>{block.checked ? "✓" : ""}</button>
      <div {...ed} style={{ ...ed.style, flex: 1, opacity: block.checked ? .5 : 1, textDecoration: block.checked ? "line-through" : "none" }} /></div>); break;
    case "toggle": body = (<div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => onChange({ ...block, open: !block.open })} style={{ marginTop: 4, background: "none", border: "none", cursor: "pointer", color: T.amber, fontSize: 13, transform: block.open ? "rotate(90deg)" : "none", transition: "transform .22s cubic-bezier(.2,1.3,.3,1)" }}>{"▸"}</button>
        <div {...ed} style={{ ...ed.style, flex: 1, fontWeight: 600 }} /></div>
      <div style={{ overflow: "hidden", maxHeight: block.open ? 200 : 0, opacity: block.open ? 1 : 0, transition: "max-height .28s ease,opacity .2s", marginLeft: 26, color: T.sub, fontSize: 14, paddingLeft: 12, borderLeft: "2px solid " + T.line }}>{block.childrenText}</div></div>); break;
    case "callout": body = (<div style={{ display: "flex", gap: 12, padding: "12px 14px", borderRadius: 12, background: T.glass, border: "1px solid " + T.line }}><span style={{ fontSize: 18 }}>{"💡"}</span><div {...ed} style={{ ...ed.style, flex: 1 }} /></div>); break;
    case "quote": body = (<div style={{ paddingLeft: 16, borderLeft: "3px solid " + T.amber }}><div {...ed} style={{ ...ed.style, fontFamily: "'Nohemi',sans-serif", fontStyle: "italic", fontSize: 18, color: T.sub }} /></div>); break;
    case "code": body = (<div style={{ position: "relative", background: "rgba(8,12,24,.7)", border: "1px solid " + T.line, borderRadius: 12, padding: "12px 14px" }}><span style={{ position: "absolute", top: 8, right: 12, fontSize: 10.5, color: T.sub, fontFamily: "'Nohemi'" }}>{block.lang || "code"}</span><div {...ed} style={{ ...ed.style, fontFamily: "'Nohemi'", fontSize: 13.5, color: T.cyan, whiteSpace: "pre-wrap" }} /></div>); break;
    case "divider": body = <div style={{ height: 1, background: "linear-gradient(90deg,transparent," + T.line + ",transparent)", margin: "8px 0" }} />; break;
    case "database": body = <DatabaseBlock block={block} onChange={onChange} />; break;
    default: body = <div {...ed} style={{ ...ed.style, fontSize: 16 }} />;
  }

  return (
    <div draggable onDragStart={(e) => dragHandlers.start(e, idx)} onDragOver={(e) => dragHandlers.over(e, idx)} onDrop={(e) => dragHandlers.drop(e, idx)} onDragEnd={dragHandlers.end}
      style={{ position: "relative", padding: "3px 0 3px 52px", borderRadius: 8, opacity: dragging ? .35 : 1, boxShadow: dropHint ? "inset 0 2px 0 " + T.amber : "none", transition: "box-shadow .12s,opacity .12s" }}
      onMouseEnter={(e) => e.currentTarget.querySelectorAll(".lm-ctl").forEach((h) => (h.style.opacity = 1))}
      onMouseLeave={(e) => { e.currentTarget.querySelectorAll(".lm-ctl").forEach((h) => (h.style.opacity = 0)); setMenu(false); }}>
      <span className="lm-ctl" style={{ position: "absolute", left: 26, top: 6, cursor: "grab", color: T.sub, opacity: 0, transition: "opacity .15s", fontSize: 14 }}>{"⠿"}</span>
      <button className="lm-ctl" onClick={() => setMenu((m) => !m)} style={{ position: "absolute", left: 4, top: 4, opacity: 0, transition: "opacity .15s", background: "none", border: "none", color: T.sub, cursor: "pointer", fontSize: 16 }}>{"···"}</button>
      {menu && (
        <div style={{ position: "absolute", left: 4, top: 28, zIndex: 40, width: 180, background: T.panel, backdropFilter: "blur(16px)", border: "1px solid " + T.line, borderRadius: 10, boxShadow: "0 14px 40px rgba(0,0,0,.5)", overflow: "hidden", animation: "lm-pop .14s" }}>
          <CtxItem label="Commenta" icon={"💬"} onClick={() => { setShowComments(true); setMenu(false); }} />
          <CtxItem label={block.archived ? "Ripristina" : "Archivia"} icon={"📦"} onClick={() => { onChange({ ...block, archived: !block.archived }); setMenu(false); }} />
          <CtxItem label="Cancella blocco" icon={"🗑"} danger onClick={() => { onDelete(idx); setMenu(false); }} />
        </div>
      )}
      {comments.length > 0 && <span onClick={() => setShowComments(true)} style={{ position: "absolute", right: -2, top: 6, fontSize: 11, color: T.amber, cursor: "pointer" }}>{"💬"} {comments.length}</span>}
      <div style={{ opacity: block.archived ? .4 : 1, filter: block.archived ? "grayscale(.6)" : "none" }}>{body}</div>
      {slash && <SlashMenu query={slash.query} onPick={pickSlash} onClose={() => setSlash(null)} />}
      {showComments && <CommentThread blockId={block.id} comments={comments} user={user} onClose={() => setShowComments(false)} />}
      <BlockReactions blockId={block.id} />
    </div>
  );
}
function CommentThread({ blockId, comments, user, onClose }) {
  const [text, setText] = useState("");
  const add = () => { if (text.trim()) { A.addComment(blockId, text.trim(), (user && user.name) || "Tu"); setText(""); } };
  return (
    <div style={{ marginLeft: 52, marginTop: 6, padding: 12, background: T.panel, border: "1px solid " + T.line, borderRadius: 12, animation: "lm-pop .16s" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: T.sub, fontFamily: "'Nohemi'" }}>Commenti</span>
        <button onClick={onClose} style={{ background: "none", border: "none", color: T.sub, cursor: "pointer" }}>{"✕"}</button>
      </div>
      {comments.map((c) => (<div key={c.id} style={{ marginBottom: 8 }}><div style={{ fontSize: 12.5, fontWeight: 600, color: T.cyan }}>{c.author}</div><div style={{ fontSize: 13.5 }}>{c.text}</div></div>))}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Scrivi un commento..." onKeyDown={(e) => e.key === "Enter" && add()} style={{ flex: 1, padding: "7px 10px", background: "rgba(122,150,210,.08)", border: "1px solid " + T.line, borderRadius: 8, color: T.ink, fontSize: 13, outline: "none" }} />
        <button onClick={add} style={btnAmber}>Invia</button>
      </div>
    </div>
  );
}
function CtxItem({ label, icon, onClick, danger }) {
  return (<button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 12px", background: "none", border: "none", cursor: "pointer", textAlign: "left", color: danger ? T.danger : T.ink, fontSize: 13.5 }} onMouseEnter={(e) => (e.currentTarget.style.background = T.glass)} onMouseLeave={(e) => (e.currentTarget.style.background = "none")}><span style={{ width: 18 }}>{icon}</span>{label}</button>);
}

/* ===== EDITOR + breadcrumb + copertina ===== */
function Breadcrumb({ pageId }) {
  const pages = useStore((s) => s.pages); const trail = []; let p = pageId; while (p && pages[p]) { trail.unshift(pages[p]); p = pages[p].parent; }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: T.sub, flexWrap: "wrap" }}>
      {trail.map((pg, i) => (<React.Fragment key={pg.id}>{i > 0 && <span style={{ opacity: .5 }}>/</span>}<span onClick={() => A.setPage(pg.id)} style={{ cursor: "pointer", color: i === trail.length - 1 ? T.ink : T.sub }}>{pg.icon} {pg.title}</span></React.Fragment>))}
    </div>
  );
}
function Editor({ pageId }) {
  const blocks = useStore((s) => s.blocks[pageId] || []);
  const page = useStore((s) => s.pages[pageId]);
  const drag = useRef({ from: null });
  const [dragIdx, setDragIdx] = useState(null), [overIdx, setOverIdx] = useState(null);
  const update = (i, nb) => { const arr = [...blocks]; arr[i] = nb; A.setBlocks(pageId, arr); };
  const insertAfter = (i) => { const arr = [...blocks]; arr.splice(i + 1, 0, { id: uid(), type: "p", text: "" }); A.setBlocks(pageId, arr, "insert"); store.set((s) => ({ gam: { ...s.gam, blocksCreated: s.gam.blocksCreated + 1 } })); if (typeof checkAchievements === "function") checkAchievements(); setTimeout(() => { const el = document.querySelectorAll("[contenteditable]")[i + 1]; el && el.focus(); }, 0); };
  const removeAt = (i) => { if (blocks.length <= 1) return; A.setBlocks(pageId, blocks.filter((_, j) => j !== i), "delete"); setTimeout(() => { const els = document.querySelectorAll("[contenteditable]"); const el = els[Math.max(0, i - 1)]; el && el.focus(); }, 0); };
  const dragHandlers = {
    start: (e, i) => { drag.current.from = i; setDragIdx(i); e.dataTransfer.effectAllowed = "move"; e.stopPropagation(); },
    over: (e, i) => { e.preventDefault(); if (i !== overIdx) setOverIdx(i); },
    drop: (e, i) => { e.preventDefault(); const from = drag.current.from; if (from == null || from === i) return; const arr = [...blocks]; const m = arr.splice(from, 1)[0]; arr.splice(i, 0, m); A.setBlocks(pageId, arr, "move"); },
    end: () => { drag.current.from = null; setDragIdx(null); setOverIdx(null); },
  };
  if (!page) return null;
  const maxW = page.width === "wide" ? 1040 : page.width === "full" ? "100%" : 740;
  return (
    <div>
      <div onPaste={(e) => { const txt = e.clipboardData.getData("text/plain"); if (txt && /\n/.test(txt) && txt.length > 80) { e.preventDefault(); const nb = smartPasteToBlocks(txt); A.setBlocks(pageId, [...blocks, ...nb], "paste"); toast("Incollato e formattato ✨"); } }} style={{ maxWidth: maxW, margin: "0 auto", padding: "32px 28px 200px", transition: "max-width .3s" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
          <Breadcrumb pageId={pageId} />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button onClick={() => A.toggleFav(pageId)} style={{ ...btn, color: page.favorite ? T.amber : T.sub }}>{page.favorite ? "★" : "☆"} Preferiti</button>
            <select value={page.width} onChange={(e) => A.setWidth(pageId, e.target.value)} style={{ ...btn, cursor: "pointer" }}>
              <option value="normal">Normale</option><option value="wide">Larga</option><option value="full">Piena</option>
            </select>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <button onClick={() => { const e = prompt("Icona (emoji):", page.icon); if (e) A.setIcon(pageId, e); }} style={{ fontSize: 44, background: "none", border: "none", cursor: "pointer", lineHeight: 1 }}>{page.icon}</button>
          <input value={page.title} onChange={(e) => A.rename(pageId, e.target.value)} placeholder="Senza titolo" style={{ flex: 1, background: "none", border: "none", outline: "none", color: "inherit", fontFamily: "'Nohemi',sans-serif", fontSize: 40, fontWeight: 800, letterSpacing: "-.02em" }} />
        </div>
        {blocks.map((b, i) => (<Block key={b.id} block={b} idx={i} onChange={(nb) => update(i, nb)} onEnter={insertAfter} onBackspace={removeAt} onDelete={removeAt} dragHandlers={dragHandlers} dragging={dragIdx === i} dropHint={overIdx === i && dragIdx !== i} />))}
        <button onClick={() => insertAfter(blocks.length - 1)} style={{ marginTop: 10, marginLeft: 52, background: "none", border: "none", color: T.sub, cursor: "text", fontSize: 15 }}>+ Aggiungi un blocco...</button>
      </div>
    </div>
  );
}

/* ===== SIDEBAR ===== */
function TreeItem({ id, depth, onCtx }) {
  const page = useStore((s) => s.pages[id]);
  const current = useStore((s) => s.currentPage);
  const allPages = useStore((s) => s.pages);
  const [open, setOpen] = useState(true);
  const [over, setOver] = useState(false);
  if (!page || page.trashed) return null;
  const active = current === id;
  const kids = (page.children || []).filter((c) => allPages[c] && !allPages[c].trashed);
  return (
    <div>
      <div draggable onDragStart={(e) => { e.dataTransfer.setData("page", id); e.stopPropagation(); }}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); const dragged = e.dataTransfer.getData("page"); if (dragged && dragged !== id) A.movePage(dragged, id); }}
        onClick={() => A.setPage(id)} onContextMenu={(e) => { e.preventDefault(); onCtx(id, e.clientX, e.clientY); }}
        style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 8px", margin: "1px 0", paddingLeft: 8 + depth * 16, borderRadius: 8, cursor: "pointer", background: over || active ? T.glass : "transparent", color: active ? T.ink : T.sub, boxShadow: over ? "inset 0 0 0 1px " + T.amber : "none", transition: "background .15s" }}
        onMouseEnter={(e) => { if (!active && !over) e.currentTarget.style.background = "rgba(122,150,210,.06)"; e.currentTarget.querySelector(".lm-more").style.opacity = 1; }}
        onMouseLeave={(e) => { if (!active && !over) e.currentTarget.style.background = "transparent"; e.currentTarget.querySelector(".lm-more").style.opacity = 0; }}>
        {kids.length > 0 ? (<button onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }} style={{ background: "none", border: "none", color: T.sub, cursor: "pointer", fontSize: 10, width: 14, transform: open ? "rotate(90deg)" : "none", transition: "transform .2s" }}>{"▸"}</button>) : <span style={{ width: 14 }} />}
        <span style={{ fontSize: 13 }}>{page.icon}</span>
        <span style={{ fontSize: 13.5, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{page.title}{page.favorite && <span style={{ color: T.amber, marginLeft: 4 }}>{"★"}</span>}</span>
        <button className="lm-more" onClick={(e) => { e.stopPropagation(); onCtx(id, e.clientX, e.clientY); }} style={{ background: "none", border: "none", color: T.sub, cursor: "pointer", fontSize: 15, opacity: 0, transition: "opacity .15s" }}>{"···"}</button>
        <button onClick={(e) => { e.stopPropagation(); A.addPage(id); }} style={{ background: "none", border: "none", color: T.sub, cursor: "pointer", fontSize: 15 }}>+</button>
      </div>
      {open && kids.map((c) => <TreeItem key={c} id={c} depth={depth + 1} onCtx={onCtx} />)}
    </div>
  );
}
function ContextMenu({ ctx, onClose, onShare }) {
  useEffect(() => { const c = () => onClose(); window.addEventListener("click", c); return () => window.removeEventListener("click", c); }, [onClose]);
  if (!ctx) return null; const page = store.get().pages[ctx.id]; if (!page) return null;
  return (
    <div style={{ position: "fixed", left: ctx.x, top: ctx.y, zIndex: 400, width: 210, background: T.panel, backdropFilter: "blur(18px)", border: "1px solid " + T.line, borderRadius: 12, boxShadow: "0 20px 60px rgba(0,0,0,.6)", overflow: "hidden", animation: "lm-pop .14s" }} onClick={(e) => e.stopPropagation()}>
      <CtxItem icon={"✏️"} label="Rinomina" onClick={() => { const t = prompt("Nuovo nome:", page.title); if (t) A.rename(ctx.id, t); onClose(); }} />
      <CtxItem icon={"⎘"} label="Duplica" onClick={() => { A.duplicate(ctx.id); onClose(); }} />
      <CtxItem icon={page.favorite ? "★" : "☆"} label={page.favorite ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti"} onClick={() => { A.toggleFav(ctx.id); onClose(); }} />
      <CtxItem icon={"👥"} label="Condividi" onClick={() => { onShare(ctx.id); onClose(); }} />
      <CtxItem icon={"＋"} label="Sottopagina" onClick={() => { A.addPage(ctx.id); onClose(); }} />
      <div style={{ height: 1, background: T.line, margin: "2px 0" }} />
      <CtxItem icon={"🗑"} label="Sposta nel cestino" danger onClick={() => { if (confirm("Spostare \"" + page.title + "\" nel cestino?")) A.trash(ctx.id); onClose(); }} />
    </div>
  );
}
function Sidebar({ onSearch, onTrash, user, onProfile, extra }) {
  const order = useStore((s) => s.order);
  const pages = useStore((s) => s.pages);
  const theme = useStore((s) => s.theme);
  const [ctx, setCtx] = useState(null);
  const [shareFor, setShareFor] = useState(null);
  const favs = Object.values(pages).filter((p) => p.favorite && !p.trashed);
  const roots = order.filter((id) => pages[id] && !pages[id].trashed);
  const trashCount = Object.values(pages).filter((p) => p.trashed).length;
  const inboxCount = useStore((s) => s.inbox.length);
  const filesCount = useStore((s) => s.files.length);
  const streak = useStore((s) => s.gam.streak);
  return (
    <aside style={{ width: 256, flexShrink: 0, height: "100vh", position: "sticky", top: 0, background: "rgba(10,15,30,.55)", backdropFilter: "blur(20px)", borderRight: "1px solid " + T.line, display: "flex", flexDirection: "column", zIndex: 10 }}>
      <div style={{ padding: "16px 14px 6px" }}><img src="/lumen-logo.png" alt="Lumen" style={{ height: 20, width: "auto", display: "block", opacity: .95 }} /></div>
      <button onClick={onProfile} style={{ padding: "8px 14px 10px", display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, background: user && user.avatar ? "center/cover url(" + user.avatar + ")" : "linear-gradient(135deg," + T.amber + "," + T.cyan + ")", display: "grid", placeItems: "center", color: T.bg, fontWeight: 700, fontFamily: "'Nohemi'" }}>{!(user && user.avatar) && ((user && user.name && user.name[0].toUpperCase()) || "L")}</div>
        <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user && user.name}</div><div style={{ fontSize: 11, color: T.sub }}>Spazio personale</div></div>
        <span style={{ color: T.sub, fontSize: 12 }}>{"⌄"}</span>
      </button>
      <button onClick={onSearch} style={{ margin: "0 12px 8px", padding: "8px 10px", display: "flex", alignItems: "center", gap: 8, background: "rgba(122,150,210,.08)", border: "1px solid " + T.line, borderRadius: 9, color: T.sub, cursor: "pointer", fontSize: 13 }}>
        <span>{"⌕"}</span> Cerca <span style={{ marginLeft: "auto", fontSize: 11, fontFamily: "'Nohemi'" }}>Cmd+K</span>
      </button>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 8px" }}>
        {favs.length > 0 && (<><SideLabel>Preferiti</SideLabel>
          {favs.map((p) => (<div key={p.id} onClick={() => A.setPage(p.id)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 8px", borderRadius: 8, cursor: "pointer", color: T.sub, fontSize: 13.5 }} onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(122,150,210,.06)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}><span style={{ color: T.amber }}>{"★"}</span><span>{p.icon}</span><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</span></div>))}
        </>)}
        <SideLabel>Spazio di lavoro</SideLabel>
        {roots.map((id) => <TreeItem key={id} id={id} depth={0} onCtx={(id, x, y) => setCtx({ id, x, y })} />)}
        <button onClick={() => A.addPage(null)} style={{ margin: "6px 10px", background: "none", border: "none", color: T.sub, cursor: "pointer", fontSize: 13 }}>+ Nuova pagina</button>
      </div>
      <div style={{ padding: 10, borderTop: "1px solid " + T.line, display: "flex", flexDirection: "column", gap: 2, maxHeight: 280, overflowY: "auto" }}>
        {extra && <SideBtn onClick={extra.onFocus}>{"◎"} Focus / Pomodoro</SideBtn>}
        {extra && <SideBtn onClick={extra.onFiles}>{"🗂️"} File database{filesCount > 0 && <span style={{ marginLeft: "auto", background: T.cyan, color: T.bg, borderRadius: 10, fontSize: 10, padding: "1px 6px" }}>{filesCount}</span>}</SideBtn>}
        {extra && <SideBtn onClick={extra.onInbox}>{"📥"} Inbox{inboxCount > 0 && <span style={{ marginLeft: "auto", background: T.cyan, color: T.bg, borderRadius: 10, fontSize: 10, padding: "1px 6px" }}>{inboxCount}</span>}</SideBtn>}
        {extra && <SideBtn onClick={extra.onReminders}>{"⏰"} Promemoria</SideBtn>}
        {extra && <SideBtn onClick={extra.onStats}>{"🏆"} Statistiche{streak > 0 && <span style={{ marginLeft: "auto", fontSize: 11, color: T.amber }}>{"🔥"}{streak}</span>}</SideBtn>}
        {extra && <SideBtn onClick={extra.onImport}>{"↓"} Importa</SideBtn>}
        <SideBtn onClick={onTrash}>{"🗑"} Cestino{trashCount > 0 && <span style={{ marginLeft: "auto", background: T.danger, color: "#fff", borderRadius: 10, fontSize: 10, padding: "1px 6px" }}>{trashCount}</span>}</SideBtn>
      </div>
      <ContextMenu ctx={ctx} onClose={() => setCtx(null)} onShare={(id) => setShareFor(id)} />
      {shareFor && <ShareDialog pageId={shareFor} onClose={() => setShareFor(null)} />}
    </aside>
  );
}
const SideLabel = ({ children }) => <div style={{ fontSize: 11, color: T.sub, padding: "8px 10px 4px", letterSpacing: ".08em", textTransform: "uppercase" }}>{children}</div>;
const SideBtn = ({ children, onClick }) => <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "none", border: "none", borderRadius: 8, color: T.sub, cursor: "pointer", fontSize: 13, textAlign: "left" }} onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(122,150,210,.06)")} onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>{children}</button>;

/* ===== CESTINO ===== */
function TrashPanel({ onClose }) {
  const pages = useStore((s) => s.pages);
  const trashed = Object.values(pages).filter((p) => p.trashed);
  return (
    <Modal title="Cestino" onClose={onClose} width={520}>
      {trashed.length === 0 ? <Empty>Il cestino e vuoto.</Empty> : (<>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}><button onClick={() => { if (confirm("Svuotare il cestino? L'azione e definitiva.")) A.emptyTrash(); }} style={{ ...btn, color: T.danger, borderColor: T.danger }}>Svuota cestino</button></div>
        {trashed.map((p) => (<div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10, background: "rgba(122,150,210,.05)", marginBottom: 6 }}>
          <span>{p.icon}</span><span style={{ flex: 1 }}>{p.title}</span>
          <button onClick={() => A.restore(p.id)} style={btn}>Ripristina</button>
          <button onClick={() => { if (confirm("Eliminare definitivamente \"" + p.title + "\"?")) A.purge(p.id); }} style={{ ...btn, color: T.danger }}>Elimina</button>
        </div>))}
      </>)}
    </Modal>
  );
}

/* ===== TEMPLATE ===== */

/* ===== CONDIVISIONE ===== */
function ShareDialog({ pageId, onClose }) {
  const shares = useStore((s) => s.shares[pageId] || []);
  const page = useStore((s) => s.pages[pageId]);
  const [email, setEmail] = useState(""); const [role, setRole] = useState("viewer");
  return (
    <Modal title={"Condividi - " + ((page && page.title) || "")} onClose={onClose} width={460}>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@dominio.it" style={{ flex: 1, padding: "9px 11px", background: "rgba(122,150,210,.08)", border: "1px solid " + T.line, borderRadius: 9, color: T.ink, outline: "none", fontSize: 13.5 }} />
        <select value={role} onChange={(e) => setRole(e.target.value)} style={{ ...btn, cursor: "pointer" }}><option value="viewer">Lettore</option><option value="editor">Editor</option></select>
        <button onClick={() => { if (email.includes("@")) { A.share(pageId, email, role); setEmail(""); } }} style={btnAmber}>Invita</button>
      </div>
      {shares.length === 0 ? <Empty>Nessuna persona invitata.</Empty> : shares.map((s) => (<div key={s.email} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 9, background: "rgba(122,150,210,.05)", marginBottom: 6 }}>
        <span style={{ flex: 1, fontSize: 13.5 }}>{s.email}</span><span style={{ fontSize: 12, color: T.cyan }}>{s.role === "editor" ? "Editor" : "Lettore"}</span>
        <button onClick={() => A.unshare(pageId, s.email)} style={{ background: "none", border: "none", color: T.danger, cursor: "pointer" }}>{"✕"}</button>
      </div>))}
      <p style={{ fontSize: 11.5, color: T.sub, marginTop: 10 }}>Predisposto per Supabase RLS: ogni invito crea una riga in <code style={{ color: T.cyan }}>shares(page_id, email, role)</code>.</p>
    </Modal>
  );
}

/* ===== PROFILO ===== */
function ProfileDialog({ user, onClose }) {
  const [name, setName] = useState((user && user.name) || "");
  const [lang, setLang] = useState((user && user.lang) || "it");
  const fileRef = useRef(null);
  return (
    <Modal title="Profilo" onClose={onClose} width={420}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
        <div onClick={() => fileRef.current && fileRef.current.click()} style={{ width: 64, height: 64, borderRadius: 18, cursor: "pointer", background: user && user.avatar ? "center/cover url(" + user.avatar + ")" : "linear-gradient(135deg," + T.amber + "," + T.cyan + ")", display: "grid", placeItems: "center", color: T.bg, fontSize: 26, fontFamily: "'Nohemi'", fontWeight: 800 }}>{!(user && user.avatar) && ((name[0] && name[0].toUpperCase()) || "L")}</div>
        <div><div style={{ fontSize: 13.5, fontWeight: 600 }}>{user && user.email}</div><button onClick={() => fileRef.current && fileRef.current.click()} style={{ ...btn, marginTop: 6 }}>Carica avatar</button></div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) { const r = new FileReader(); r.onload = () => auth.updateUser({ avatar: r.result }); r.readAsDataURL(f); } }} />
      </div>
      <Field label="Nome"><input value={name} onChange={(e) => setName(e.target.value)} style={inp} /></Field>
      <Field label="Lingua"><select value={lang} onChange={(e) => setLang(e.target.value)} style={{ ...inp, cursor: "pointer" }}><option value="it">Italiano</option><option value="en">English</option></select></Field>
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button onClick={() => { auth.updateUser({ name, lang }); onClose(); }} style={btnAmber}>Salva</button>
        <button onClick={() => auth.signOut()} style={{ ...btn, color: T.danger, borderColor: T.danger }}>Esci</button>
      </div>
    </Modal>
  );
}
const Field = ({ label, children }) => <label style={{ display: "block", marginBottom: 12 }}><span style={{ display: "block", fontSize: 12, color: T.sub, marginBottom: 5 }}>{label}</span>{children}</label>;
const inp = { width: "100%", padding: "10px 12px", background: "rgba(122,150,210,.08)", border: "1px solid " + T.line, borderRadius: 10, color: T.ink, fontSize: 14, outline: "none", boxSizing: "border-box" };

/* ===== COMMAND PALETTE ===== */
function CommandPalette({ open, onClose, extraActions }) {
  const pages = useStore((s) => s.pages);
  const [q, setQ] = useState(""); const inputRef = useRef(null);
  useEffect(() => { if (open) { setQ(""); setTimeout(() => inputRef.current && inputRef.current.focus(), 30); } }, [open]);
  if (!open) return null;
  const ql = q.toLowerCase();
  const results = Object.values(pages).filter((p) => !p.trashed && p.title.toLowerCase().includes(ql));
  const ea = extraActions || {};
  const commands = [
    { icon: "✦", label: "Chiedi a Lumi…", hint: "AI", run: ea.lumi },
    { icon: "＋", label: "Nuova pagina", hint: "crea", run: () => { A.addPage(null); onClose(); } },
    { icon: "📥", label: "Cattura rapida", hint: "inbox", run: ea.capture },
    { icon: "◎", label: "Modalità Focus", hint: "pomodoro", run: ea.focus },
  ].filter((c) => c.run && c.label.toLowerCase().includes(ql));
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(5,8,18,.6)", backdropFilter: "blur(6px)", display: "flex", justifyContent: "center", paddingTop: "14vh", animation: "lm-fade .15s" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 560, maxWidth: "90vw", height: "fit-content", background: T.panel, backdropFilter: "blur(20px)", border: "1px solid " + T.line, borderRadius: 16, boxShadow: "0 30px 80px rgba(0,0,0,.6)", overflow: "hidden", animation: "lm-pop .18s cubic-bezier(.2,1.2,.3,1)" }}>
        <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca pagine, esegui comandi, chiedi a Lumi…" style={{ width: "100%", padding: "16px 18px", background: "none", border: "none", borderBottom: "1px solid " + T.line, color: T.ink, fontSize: 16, outline: "none", boxSizing: "border-box" }} />
        <div style={{ maxHeight: 360, overflowY: "auto", padding: 6 }}>
          {commands.length > 0 && <div style={{ fontSize: 10.5, color: T.sub, padding: "6px 12px 2px", textTransform: "uppercase", letterSpacing: ".08em" }}>Comandi</div>}
          {commands.map((c, i) => (<button key={i} onClick={c.run} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 12px", background: "none", border: "none", borderRadius: 9, color: T.ink, cursor: "pointer", textAlign: "left" }} onMouseEnter={(e) => (e.currentTarget.style.background = T.glass)} onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>
            <span>{c.icon}</span><span style={{ flex: 1 }}>{c.label}</span><span style={{ fontSize: 11, color: T.sub, fontFamily: "'Nohemi'" }}>{c.hint}</span></button>))}
          {results.length > 0 && <div style={{ fontSize: 10.5, color: T.sub, padding: "6px 12px 2px", textTransform: "uppercase", letterSpacing: ".08em" }}>Pagine</div>}
          {results.map((p) => (<button key={p.id} onClick={() => { A.setPage(p.id); onClose(); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 12px", background: "none", border: "none", borderRadius: 9, color: T.ink, cursor: "pointer", textAlign: "left" }} onMouseEnter={(e) => (e.currentTarget.style.background = T.glass)} onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>
            <span>{p.icon}</span><span style={{ flex: 1 }}>{p.title}</span><span style={{ fontSize: 11, color: T.sub, fontFamily: "'Nohemi'" }}>pagina</span></button>))}
          {!results.length && !commands.length && <Empty>Nessun risultato</Empty>}
        </div>
      </div>
    </div>
  );
}

/* ===== TOPBAR ===== */
function exportMarkdown(blocks) {
  return blocks.map((b) => { switch (b.type) {
    case "h1": return "# " + b.text; case "h2": return "## " + b.text; case "h3": return "### " + b.text;
    case "todo": return "- [" + (b.checked ? "x" : " ") + "] " + b.text; case "quote": return "> " + b.text;
    case "code": return "```" + (b.lang || "") + "\n" + b.text + "\n```"; case "callout": return "> [!] " + b.text;
    case "toggle": return "<details><summary>" + b.text + "</summary>\n\n" + (b.childrenText || "") + "\n</details>";
    case "divider": return "---"; default: return b.text;
  } }).join("\n\n");
}
function download(name, content, type) { const blob = new Blob([content], { type: type || "text/plain" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url); }
function Topbar({ onPublish, onPDF }) {
  const pid = useStore((s) => s.currentPage);
  const blocks = useStore((s) => s.blocks[pid] || []);
  const page = useStore((s) => s.pages[pid]);
  const isPublic = useStore((s) => !!s.publicPages[pid]);
  return (
    <div style={{ position: "sticky", top: 0, zIndex: 20, display: "flex", alignItems: "center", gap: 10, padding: "10px 24px", background: "rgba(11,16,32,.4)", backdropFilter: "blur(14px)", borderBottom: "1px solid " + T.line }}>
      <span style={{ fontSize: 13, color: T.sub }}>{page && page.icon} {page && page.title}</span>
      <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={undo} title="Annulla (Cmd+Z)" style={btn}>{"↶"}</button>
        <button onClick={redo} title="Ripeti (Cmd+Shift+Z)" style={btn}>{"↷"}</button>
        <button onClick={onPublish} style={{ ...btn, color: isPublic ? T.cyan : T.sub, borderColor: isPublic ? T.cyan : T.line }}>{isPublic ? "◉ Pubblica" : "○ Pubblica"}</button>
        <button onClick={() => download(((page && page.title) || "pagina") + ".md", exportMarkdown(blocks))} style={btn}>{"↓"} MD</button>
        <button onClick={onPDF} style={btn}>{"↓"} PDF</button>
      </div>
    </div>
  );
}

/* ===== LUMI AI (streaming Anthropic) ===== */
function workspaceContext() {
  const s = store.get(); const cur = s.pages[s.currentPage];
  const text = (s.blocks[s.currentPage] || []).map((b) => b.text).filter(Boolean).join("\n");
  const list = Object.values(s.pages).filter((p) => !p.trashed).map((p) => p.title).join(", ");
  return { title: cur && cur.title, text, list };
}
async function streamClaude(messages, onToken, system) {
  const MODEL = "claude-3-5-sonnet-20241022";
  const body = { model: MODEL, max_tokens: 1000, stream: true, system, messages };
  let res;
  try {
    res = await fetch("/api/lumi", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch (e) {
    onToken("⚠️ Non riesco a raggiungere il server di Lumì. In locale avvia con `vercel dev`.");
    return;
  }
  if (!res.ok) {
    let msg = "Errore " + res.status;
    try { const j = await res.json(); if (j && j.error) msg = j.error; } catch (e) {}
    onToken("⚠️ " + msg);
    return;
  }
  if (!res.body) {
    try { const d = await res.json(); onToken((d.content || []).filter((c) => c.type === "text").map((c) => c.text).join("")); } catch (e) { onToken("⚠️ Risposta non valida dal server."); }
    return;
  }
  const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = "";
  while (true) { const out = await reader.read(); if (out.done) break; buf += dec.decode(out.value, { stream: true });
    const lines = buf.split("\n"); buf = lines.pop() || "";
    for (const line of lines) { const t = line.trim(); if (!t.startsWith("data:")) continue; const payload = t.slice(5).trim(); if (payload === "[DONE]") continue;
      try { const ev = JSON.parse(payload); if (ev.type === "content_block_delta" && ev.delta && ev.delta.type === "text_delta") onToken(ev.delta.text); } catch (e) {} } }
}
function lineToBlock(line) {
  if (line.startsWith("# ")) return { id: uid(), type: "h1", text: line.slice(2) };
  if (line.startsWith("## ")) return { id: uid(), type: "h2", text: line.slice(3) };
  if (line.startsWith("### ")) return { id: uid(), type: "h3", text: line.slice(4) };
  if (line.startsWith("- [ ] ") || line.startsWith("- [x] ")) return { id: uid(), type: "todo", text: line.slice(6), checked: line[3] === "x" };
  if (line.startsWith("> ")) return { id: uid(), type: "quote", text: line.slice(2) };
  if (line.startsWith("- ")) return { id: uid(), type: "p", text: "• " + line.slice(2) };
  return { id: uid(), type: "p", text: line };
}
const Chip = ({ children, onClick }) => <button onClick={onClick} style={{ padding: "5px 10px", background: "rgba(122,150,210,.08)", border: "1px solid " + T.line, borderRadius: 20, color: T.sub, cursor: "pointer", fontSize: 11.5, whiteSpace: "nowrap" }} onMouseEnter={(e) => { e.currentTarget.style.color = T.ink; e.currentTarget.style.borderColor = T.cyan; }} onMouseLeave={(e) => { e.currentTarget.style.color = T.sub; e.currentTarget.style.borderColor = T.line; }}>{children}</button>;

/* ===== AUTH SCREEN ===== */
function AuthScreen() {
  const [mode, setMode] = useState("landing");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [name, setName] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async () => { setErr(""); setBusy(true);
    try { if (mode === "signup") await auth.signUp({ email, password, name }); else await auth.signIn({ email, password }); }
    catch (e) { setErr(e.message); } finally { setBusy(false); } };
  return (
    <div style={{ minHeight: "100vh", position: "relative", display: "grid", placeItems: "center", color: T.ink, fontFamily: "'Nohemi',sans-serif", overflow: "hidden" }}>
      <InkScene theme="dark" />
      <div style={{ position: "relative", zIndex: 5, width: 420, maxWidth: "90vw", padding: 36, background: T.panel, backdropFilter: "blur(24px)", border: "1px solid " + T.line, borderRadius: 24, boxShadow: "0 40px 100px rgba(0,0,0,.5)", animation: "lm-pop .4s cubic-bezier(.2,1.2,.3,1)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: mode === "landing" ? 20 : 24 }}>
          <img src="/lumen-logo.png" alt="Lumen" style={{ height: 44, width: "auto", display: "block" }} />
        </div>
        {mode === "landing" ? (<>
          <h1 style={{ fontFamily: "'Nohemi',sans-serif", fontSize: 30, fontWeight: 600, lineHeight: 1.15, margin: "0 0 10px", letterSpacing: "-.02em" }}>L'area di lavoro che respira.</h1>
          <p style={{ color: T.sub, fontSize: 15, lineHeight: 1.6, margin: "0 0 24px" }}>Note, database e pagine in un'unica superficie viva. Scrivi con  /  , organizza ad albero, lascia che Lumi AI faccia il resto.</p>
          <button onClick={() => setMode("signup")} style={{ ...btnAmber, width: "100%", padding: "12px", fontSize: 15, marginBottom: 10 }}>Inizia gratis</button>
          <button onClick={() => setMode("login")} style={{ ...btn, width: "100%", padding: "12px", fontSize: 14 }}>Ho gia un account</button>
        </>) : (<>
          <h2 style={{ fontFamily: "'Nohemi',sans-serif", fontSize: 24, fontWeight: 600, margin: "0 0 18px" }}>{mode === "signup" ? "Crea il tuo spazio" : "Bentornato"}</h2>
          {mode === "signup" && <Field label="Nome"><input value={name} onChange={(e) => setName(e.target.value)} style={inp} placeholder="Come ti chiami" /></Field>}
          <Field label="Email"><input value={email} onChange={(e) => setEmail(e.target.value)} type="email" style={inp} placeholder="email@dominio.it" /></Field>
          <Field label="Password"><input value={password} onChange={(e) => setPassword(e.target.value)} type="password" style={inp} placeholder="********" onKeyDown={(e) => e.key === "Enter" && submit()} /></Field>
          {err && <div style={{ color: T.danger, fontSize: 12.5, marginBottom: 10 }}>{err}</div>}
          <button onClick={submit} disabled={busy} style={{ ...btnAmber, width: "100%", padding: "12px", fontSize: 15, opacity: busy ? .6 : 1, marginBottom: 10 }}>{busy ? "Attendi..." : mode === "signup" ? "Registrati" : "Accedi"}</button>
          <div style={{ textAlign: "center", fontSize: 13, color: T.sub }}>{mode === "signup" ? "Hai gia un account? " : "Non hai un account? "}
            <button onClick={() => { setErr(""); setMode(mode === "signup" ? "login" : "signup"); }} style={{ background: "none", border: "none", color: T.cyan, cursor: "pointer", fontSize: 13 }}>{mode === "signup" ? "Accedi" : "Registrati"}</button>
          </div>
          <button onClick={() => setMode("landing")} style={{ display: "block", margin: "14px auto 0", background: "none", border: "none", color: T.sub, cursor: "pointer", fontSize: 12 }}>{"←"} Torna alla home</button>
        </>)}
      </div>
    </div>
  );
}

/* ===== UI primitives ===== */
const btn = { padding: "6px 12px", background: "rgba(122,150,210,.08)", border: "1px solid " + T.line, borderRadius: 8, color: T.sub, cursor: "pointer", fontSize: 12.5, fontFamily: "'Nohemi'" };
const btnAmber = { padding: "7px 14px", background: "linear-gradient(135deg," + T.amber + ",#d98a2a)", border: "none", borderRadius: 9, color: T.bg, cursor: "pointer", fontSize: 13.5, fontWeight: 600 };
const Empty = ({ children }) => <div style={{ padding: 24, textAlign: "center", color: T.sub, fontSize: 14 }}>{children}</div>;
function Modal({ title, children, onClose, width }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(5,8,18,.6)", backdropFilter: "blur(6px)", display: "flex", justifyContent: "center", alignItems: "flex-start", paddingTop: "10vh", animation: "lm-fade .15s" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: width || 480, maxWidth: "92vw", maxHeight: "80vh", overflowY: "auto", background: T.panel, backdropFilter: "blur(22px)", border: "1px solid " + T.line, borderRadius: 20, boxShadow: "0 30px 80px rgba(0,0,0,.6)", animation: "lm-pop .2s cubic-bezier(.2,1.2,.3,1)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid " + T.line }}>
          <span style={{ fontFamily: "'Nohemi',sans-serif", fontSize: 19, fontWeight: 600 }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.sub, cursor: "pointer", fontSize: 18 }}>{"✕"}</button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  );
}
function GlobalStyle() {
  return (
    <style>{NOHEMI_FONTS
      + "html,body,#root{font-family:'Nohemi',system-ui,-apple-system,sans-serif;}"
      + "@keyframes lm-pop { from { opacity:0; transform: translateY(-6px) scale(.98); } to { opacity:1; transform:none; } }"
      + "@keyframes lm-fade { from { opacity:0 } to { opacity:1 } }"
      + "@keyframes lm-blink { 0%,100%{opacity:1} 50%{opacity:0} }"
      + "@keyframes lm-float { 0%,100%{ transform: translateY(0) } 50%{ transform: translateY(-6px) } }"
      + "@keyframes lm-spin { from{ transform: rotate(-120deg) scale(.7); opacity:0 } 40%{ opacity:1 } to{ transform: rotate(220deg) scale(1); opacity:0 } }"
      + "::selection { background: " + T.amber + "40; }"
      + "*::-webkit-scrollbar { width: 8px; height: 8px; } *::-webkit-scrollbar-thumb { background: " + T.line + "; border-radius: 8px; }"
      + "@media (prefers-reduced-motion: reduce){ *{ animation-duration:.001ms!important; transition-duration:.001ms!important; } }"}</style>
  );
}


/* ============================================================================
   ESTENSIONI — sistemi trasversali (temi, suoni, gamification, focus, ecc.)
   ============================================================================ */

/* ===== prefers-reduced-motion centralizzato ===== */
function prefersReduced() { return window.matchMedia("(prefers-reduced-motion: reduce)").matches || store.get().settings.reduceMotion; }

/* ===== TEMI / SKIN sbloccabili ===== */
const THEMES = {
  dark: { name: "Notte", bg: "#0B1020", ink: "#EAF0FF", amber: "#E8A33D", cyan: "#5FD3C6" },
};
const GAM = {
  toggleSetting: (k) => store.set((s) => ({ settings: { ...s.settings, [k]: !s.settings[k] } })),
  addAchievement: (a) => store.set((s) => s.gam.achievements.find((x) => x.id === a.id) ? {} : ({ gam: { ...s.gam, achievements: [...s.gam.achievements, { ...a, ts: now() }] } })),
};

/* ===== ACHIEVEMENTS ===== */
const ACHIEVEMENTS = [
  { id: "first_block", icon: "✍", title: "Primo blocco", test: (s) => s.gam.blocksCreated >= 1 },
  { id: "blocks_100", icon: "📝", title: "100 blocchi creati", test: (s) => s.gam.blocksCreated >= 100 },
  { id: "first_wiki", icon: "📚", title: "Prima wiki", test: (s) => Object.values(s.pages).some((p) => /wiki/i.test(p.title) && !p.trashed) },
  { id: "streak_3", icon: "🔥", title: "3 giorni di fila", test: (s) => s.gam.streak >= 3 },
  { id: "streak_7", icon: "⭐", title: "Una settimana intera", test: (s) => s.gam.streak >= 7 },
  { id: "clean_list", icon: "✅", title: "Lista svuotata", test: () => false },
];
function checkAchievements() {
  const s = store.get(); const newly = [];
  ACHIEVEMENTS.forEach((a) => { if (a.test(s) && !s.gam.achievements.find((x) => x.id === a.id)) { GAM.addAchievement({ id: a.id, icon: a.icon, title: a.title }); newly.push(a); } });
  return newly;
}

/* ===== STREAK giornaliera ===== */
function touchStreak() {
  store.set((s) => {
    const today = new Date().toDateString();
    if (s.gam.lastActive === today) return {};
    const yest = new Date(Date.now() - 864e5).toDateString();
    const streak = s.gam.lastActive === yest ? s.gam.streak + 1 : 1;
    const g = { ...s.gam, streak, lastActive: today };
    return { gam: g };
  });
  const s = store.get();
  checkAchievements();
}
function countWord(delta) { store.set((s) => { const wk = new Date(); const monday = new Date(wk.setDate(wk.getDate() - ((wk.getDay() + 6) % 7))).toDateString();
  const reset = s.gam.weekStart !== monday; return { gam: { ...s.gam, weekStart: monday, wordsWeek: (reset ? 0 : s.gam.wordsWeek) + delta } }; }); }

/* ===== SOUNDSCAPE (WebAudio, micro-suoni sintetici) ===== */
const Sound = (() => {
  let ctx = null;
  const ensure = () => { if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } return ctx; };
  const blip = (freq, dur, type, vol) => {
    if (!store.get().settings.soundscape || prefersReduced()) return;
    const c = ensure(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || "sine"; o.frequency.value = freq;
    g.gain.value = vol || 0.05; o.connect(g); g.connect(c.destination);
    o.start(); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + (dur || 0.12)); o.stop(c.currentTime + (dur || 0.12));
  };
  return {
    check: () => { blip(660, 0.09, "sine", 0.06); setTimeout(() => blip(990, 0.08, "sine", 0.05), 60); },
    drag: () => blip(220, 0.06, "triangle", 0.03),
    complete: () => { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.15, "sine", 0.06), i * 80)); },
    pop: () => blip(440, 0.05, "square", 0.03),
  };
})();

/* ===== CONFETTI 3D (canvas, lazy, throttled) ===== */
function burstConfetti() {
  if (prefersReduced()) return;
  const cv = document.createElement("canvas");
  cv.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:9999";
  cv.width = window.innerWidth; cv.height = window.innerHeight; document.body.appendChild(cv);
  const cx = cv.getContext("2d");
  const cols = ["#E8A33D", "#5FD3C6", "#C6FF3D", "#FF6AD5", "#EAF0FF"];
  const P = Array.from({ length: 120 }, () => ({ x: cv.width / 2 + (Math.random() - 0.5) * 200, y: cv.height / 2,
    vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 16 - 6, z: Math.random() * 2 + 0.5,
    rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: cols[(Math.random() * cols.length) | 0], s: Math.random() * 8 + 4 }));
  let t = 0, raf;
  const loop = () => { t++; cx.clearRect(0, 0, cv.width, cv.height);
    P.forEach((p) => { p.vy += 0.45; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.vx *= 0.99;
      cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot); cx.scale(1, Math.cos(p.rot) * p.z * 0.6 + 0.4);
      cx.fillStyle = p.c; cx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s); cx.restore(); });
    if (t < 110) raf = requestAnimationFrame(loop); else { cancelAnimationFrame(raf); cv.remove(); } };
  raf = requestAnimationFrame(loop);
}

/* ===== INBOX / QUICK CAPTURE ===== */

/* ===== FILE DATABASE — deposito file mostrati come database accessibile ===== */
const FILE_LIMIT = 4 * 1024 * 1024; // ~4MB per file (limite localStorage)
const FILES = {
  add: (file) => new Promise((resolve, reject) => {
    if (file.size > FILE_LIMIT) { toast("File troppo grande (max 4MB): " + file.name); reject(); return; }
    const r = new FileReader();
    r.onload = () => {
      store.set((s) => ({ files: [{ id: uid(), name: file.name, type: file.type || "application/octet-stream", size: file.size, data: r.result, ts: now() }, ...s.files] }));
      toast("Caricato: " + file.name); resolve();
    };
    r.onerror = () => { toast("Errore nel caricare " + file.name); reject(); };
    r.readAsDataURL(file);
  }),
  remove: (id) => store.set((s) => ({ files: s.files.filter((f) => f.id !== id) })),
  rename: (id, name) => store.set((s) => ({ files: s.files.map((f) => f.id === id ? { ...f, name } : f) })),
};
function fmtSize(b) { if (b < 1024) return b + " B"; if (b < 1048576) return (b / 1024).toFixed(1) + " KB"; return (b / 1048576).toFixed(1) + " MB"; }
function fileIcon(type) {
  if (type.startsWith("image/")) return "🖼️";
  if (type.includes("pdf")) return "📕";
  if (type.includes("zip") || type.includes("rar") || type.includes("compressed")) return "🗜️";
  if (type.includes("word") || type.includes("document")) return "📘";
  if (type.includes("sheet") || type.includes("excel") || type.includes("csv")) return "📗";
  if (type.startsWith("video/")) return "🎬";
  if (type.startsWith("audio/")) return "🎵";
  if (type.startsWith("text/")) return "📄";
  return "📎";
}
function FileDatabase({ onClose }) {
  const files = useStore((s) => s.files);
  const [view, setView] = useState("table"); // table | gallery
  const [drag, setDrag] = useState(false);
  const [preview, setPreview] = useState(null);
  const inputRef = useRef(null);
  const totalSize = files.reduce((a, f) => a + f.size, 0);

  const handleFiles = async (fileList) => { for (const f of Array.from(fileList)) { try { await FILES.add(f); } catch (e) {} } };
  const onDrop = (e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); };
  const openFile = (f) => { const w = window.open(); if (w) w.document.write('<iframe src="' + f.data + '" style="border:0;width:100%;height:100%;position:fixed;inset:0"></iframe>'); };
  const downloadFile = (f) => { const a = document.createElement("a"); a.href = f.data; a.download = f.name; a.click(); };

  return (
    <Modal title="File database" onClose={onClose} width={680}>
      {/* zona di rilascio */}
      <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop}
        onClick={() => inputRef.current && inputRef.current.click()}
        style={{ border: "2px dashed " + (drag ? T.amber : T.line), borderRadius: 14, padding: "22px", textAlign: "center", cursor: "pointer", background: drag ? T.glass : "rgba(122,150,210,.04)", transition: "all .15s", marginBottom: 14 }}>
        <div style={{ fontSize: 30, marginBottom: 6 }}>📥</div>
        <div style={{ fontSize: 14, color: T.ink, fontWeight: 600 }}>Trascina qui i file o clicca per sceglierli</div>
        <div style={{ fontSize: 11.5, color: T.sub, marginTop: 4 }}>Max 4MB per file · salvati localmente nel browser</div>
        <input ref={inputRef} type="file" multiple hidden onChange={(e) => e.target.files && handleFiles(e.target.files)} />
      </div>

      {/* barra strumenti */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 12, color: T.sub, fontFamily: "'Nohemi'" }}>{files.length} file · {fmtSize(totalSize)}</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          <button onClick={() => setView("table")} style={{ ...btn, padding: "4px 10px", fontSize: 11, color: view === "table" ? T.amber : T.sub, borderColor: view === "table" ? T.amber : T.line }}>▤ Tabella</button>
          <button onClick={() => setView("gallery")} style={{ ...btn, padding: "4px 10px", fontSize: 11, color: view === "gallery" ? T.amber : T.sub, borderColor: view === "gallery" ? T.amber : T.line }}>▦ Galleria</button>
        </div>
      </div>

      {files.length === 0 ? <Empty>Nessun file. Trascinane uno qui sopra.</Empty> : view === "table" ? (
        <div>
          <div style={{ display: "flex", gap: 8, padding: "6px 10px", fontSize: 11, color: T.sub, textTransform: "uppercase", letterSpacing: ".06em", borderBottom: "1px solid " + T.line }}>
            <span style={{ width: 24 }}></span><span style={{ flex: 1 }}>Nome</span><span style={{ width: 90 }}>Tipo</span><span style={{ width: 70 }}>Dim.</span><span style={{ width: 80 }}>Data</span><span style={{ width: 60 }}></span>
          </div>
          {files.map((f) => (
            <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderBottom: "1px solid " + T.line, fontSize: 13 }}
              onMouseEnter={(e) => (e.currentTarget.style.background = T.glass)} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
              <span style={{ width: 24, fontSize: 18 }}>{fileIcon(f.type)}</span>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer" }} onClick={() => f.type.startsWith("image/") ? setPreview(f) : openFile(f)}>{f.name}</span>
              <span style={{ width: 90, fontSize: 11, color: T.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.type.split("/")[1] || f.type}</span>
              <span style={{ width: 70, fontSize: 11.5, color: T.sub }}>{fmtSize(f.size)}</span>
              <span style={{ width: 80, fontSize: 11, color: T.sub }}>{new Date(f.ts).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "2-digit" })}</span>
              <span style={{ width: 60, display: "flex", gap: 6, justifyContent: "flex-end" }}>
                <button onClick={() => downloadFile(f)} title="Scarica" style={{ background: "none", border: "none", color: T.cyan, cursor: "pointer", fontSize: 13 }}>↓</button>
                <button onClick={() => { if (confirm("Eliminare " + f.name + "?")) FILES.remove(f.id); }} title="Elimina" style={{ background: "none", border: "none", color: T.danger, cursor: "pointer", fontSize: 13 }}>✕</button>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 12 }}>
          {files.map((f) => (
            <div key={f.id} style={{ border: "1px solid " + T.line, borderRadius: 12, overflow: "hidden", cursor: "pointer" }} onClick={() => f.type.startsWith("image/") ? setPreview(f) : openFile(f)}>
              <div style={{ height: 90, background: "rgba(122,150,210,.06)", display: "grid", placeItems: "center", overflow: "hidden" }}>
                {f.type.startsWith("image/") ? <img src={f.data} alt={f.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 38 }}>{fileIcon(f.type)}</span>}
              </div>
              <div style={{ padding: "8px 10px" }}>
                <div style={{ fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</div>
                <div style={{ fontSize: 10.5, color: T.sub, display: "flex", justifyContent: "space-between", marginTop: 2 }}><span>{fmtSize(f.size)}</span>
                  <span><button onClick={(e) => { e.stopPropagation(); downloadFile(f); }} style={{ background: "none", border: "none", color: T.cyan, cursor: "pointer" }}>↓</button>
                  <button onClick={(e) => { e.stopPropagation(); if (confirm("Eliminare " + f.name + "?")) FILES.remove(f.id); }} style={{ background: "none", border: "none", color: T.danger, cursor: "pointer" }}>✕</button></span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* anteprima immagine */}
      {preview && (
        <div onClick={() => setPreview(null)} style={{ position: "fixed", inset: 0, zIndex: 700, background: "rgba(5,8,18,.85)", display: "grid", placeItems: "center", padding: 30 }}>
          <img src={preview.data} alt={preview.name} style={{ maxWidth: "90%", maxHeight: "85%", borderRadius: 12, boxShadow: "0 30px 80px rgba(0,0,0,.6)" }} />
        </div>
      )}
    </Modal>
  );
}

const INBOX = {
  add: (text) => store.set((s) => ({ inbox: [{ id: uid(), text, ts: now() }, ...s.inbox] })),
  remove: (id) => store.set((s) => ({ inbox: s.inbox.filter((i) => i.id !== id) })),
  toPage: (item) => { const pid = A.addPage(null, { title: item.text.slice(0, 50), icon: "📥", blocks: [{ id: uid(), type: "p", text: item.text }] }); INBOX.remove(item.id); return pid; },
};

/* ===== REMINDERS ===== */
const REM = {
  add: (text, when) => store.set((s) => ({ reminders: [...s.reminders, { id: uid(), text, when, done: false }] })),
  done: (id) => store.set((s) => ({ reminders: s.reminders.map((r) => r.id === id ? { ...r, done: true } : r) })),
  remove: (id) => store.set((s) => ({ reminders: s.reminders.filter((r) => r.id !== id) })),
};
function useReminderTick() {
  useEffect(() => {
    const iv = setInterval(() => {
      const s = store.get(); const due = s.reminders.filter((r) => !r.done && r.when <= Date.now());
      due.forEach((r) => { REM.done(r.id);
        if ("Notification" in window && Notification.permission === "granted") new Notification("Lumen — Promemoria", { body: r.text });
        else toast("⏰ " + r.text); });
    }, 15000);
    return () => clearInterval(iv);
  }, []);
}

/* ===== TOAST leggero ===== */
let toastFn = null;
function toast(msg) { if (toastFn) toastFn(msg); }
function ToastHost() {
  const [items, setItems] = useState([]);
  useEffect(() => { toastFn = (msg) => { const id = uid(); setItems((x) => [...x, { id, msg }]); setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 4000); }; return () => { toastFn = null; }; }, []);
  return (
    <div style={{ position: "fixed", bottom: 92, left: "50%", transform: "translateX(-50%)", zIndex: 9000, display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
      {items.map((i) => (<div key={i.id} style={{ background: T.panel, backdropFilter: "blur(16px)", border: "1px solid " + T.line, color: T.ink, padding: "10px 16px", borderRadius: 12, fontSize: 13.5, boxShadow: "0 14px 40px rgba(0,0,0,.5)", animation: "lm-pop .2s" }}>{i.msg}</div>))}
    </div>
  );
}

/* ===== PASTE INTELLIGENTE (pulizia HTML/markdown) ===== */
function smartPasteToBlocks(text) {
  return text.split(/\n{1,}/).filter((l) => l.trim()).map((line) => {
    line = line.trim().replace(/\s+/g, " ");
    if (/^#{1}\s/.test(line)) return { id: uid(), type: "h1", text: line.replace(/^#\s/, "") };
    if (/^#{2}\s/.test(line)) return { id: uid(), type: "h2", text: line.replace(/^#{2}\s/, "") };
    if (/^#{3}\s/.test(line)) return { id: uid(), type: "h3", text: line.replace(/^#{3}\s/, "") };
    if (/^[-*]\s\[[ x]\]/.test(line)) return { id: uid(), type: "todo", text: line.replace(/^[-*]\s\[[ x]\]\s?/, ""), checked: /\[x\]/.test(line) };
    if (/^[-*•]\s/.test(line)) return { id: uid(), type: "p", text: "• " + line.replace(/^[-*•]\s/, "") };
    if (/^>\s/.test(line)) return { id: uid(), type: "quote", text: line.replace(/^>\s/, "") };
    return { id: uid(), type: "p", text: line };
  });
}


/* ============================================================================
   LUMI VIVA — umore bolla, voce, riassunto giornata, suggerimenti proattivi
   ============================================================================ */

/* ===== bolla 3D con umore (canvas, throttlata, reduced-motion safe) ===== */
function LumiOrb({ mood, size }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current; const ctx = cv.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2); cv.width = size * dpr; cv.height = size * dpr; ctx.scale(dpr, dpr);
    const reduced = prefersReduced();
    let raf, t = 0, last = 0;
    const palette = { idle: ["#E8A33D", "#5FD3C6"], think: ["#5FD3C6", "#8A6AFF"], celebrate: ["#C6FF3D", "#E8A33D"], sleep: ["#3a4a6e", "#5a6a8e"] };
    const draw = (nowt) => {
      raf = requestAnimationFrame(draw);
      if (reduced) { if (t > 0) return; } else if (nowt - last < 1000 / 30) return;
      last = nowt; t += 1;
      const cols = palette[mood] || palette.idle;
      ctx.clearRect(0, 0, size, size);
      const cx = size / 2, cy = size / 2;
      const speed = mood === "celebrate" ? 0.12 : mood === "think" ? 0.06 : mood === "sleep" ? 0.012 : 0.03;
      const lobes = mood === "celebrate" ? 7 : 5;
      const amp = mood === "sleep" ? 1.2 : mood === "celebrate" ? 4.2 : 2.4;
      ctx.beginPath();
      for (let a = 0; a <= Math.PI * 2 + 0.1; a += 0.12) {
        const r = size * 0.32 + Math.sin(a * lobes + t * speed) * amp + Math.cos(a * 3 - t * speed * 0.7) * amp * 0.5;
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * (mood === "sleep" ? 0.7 : 1);
        a === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, 0, size, size);
      grad.addColorStop(0, cols[0]); grad.addColorStop(1, cols[1]);
      ctx.fillStyle = grad; ctx.shadowColor = cols[0]; ctx.shadowBlur = mood === "celebrate" ? 24 : 12; ctx.fill();
      // occhi (espressione)
      ctx.shadowBlur = 0; ctx.fillStyle = "rgba(11,16,32,.85)";
      const eyeY = cy - 2;
      if (mood === "sleep") { ctx.fillRect(cx - 9, eyeY, 6, 2); ctx.fillRect(cx + 3, eyeY, 6, 2); }
      else { const blink = (t % 120) < 4 ? 0.2 : 1; ctx.beginPath(); ctx.ellipse(cx - 6, eyeY, 2.2, 2.6 * blink, 0, 0, 7); ctx.ellipse(cx + 6, eyeY, 2.2, 2.6 * blink, 0, 0, 7); ctx.fill();
        if (mood === "celebrate") { ctx.beginPath(); ctx.arc(cx, cy + 5, 4, 0, Math.PI); ctx.lineWidth = 1.6; ctx.strokeStyle = "rgba(11,16,32,.85)"; ctx.stroke(); } }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [mood, size]);
  return <canvas ref={ref} style={{ width: size, height: size, display: "block" }} />;
}

/* ===== Web Speech API ===== */
function useSpeech(onResult) {
  const recRef = useRef(null);
  const [listening, setListening] = useState(false);
  const [supported] = useState(() => !!(window.SpeechRecognition || window.webkitSpeechRecognition));
  const start = () => {
    if (!supported) { toast("Riconoscimento vocale non supportato dal browser"); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR(); rec.lang = "it-IT"; rec.interimResults = false; rec.maxAlternatives = 1;
    rec.onresult = (e) => { const txt = e.results[0][0].transcript; onResult(txt); };
    rec.onend = () => setListening(false); rec.onerror = () => setListening(false);
    recRef.current = rec; rec.start(); setListening(true);
  };
  const stop = () => { recRef.current && recRef.current.stop(); setListening(false); };
  return { listening, supported, start, stop };
}

/* ===== inattività -> mood sleep ===== */
function useIdleMood(setMood, busy) {
  useEffect(() => {
    let timer; const reset = () => { clearTimeout(timer); if (!busy) setMood((m) => m === "sleep" ? "idle" : m); timer = setTimeout(() => { if (!busy) setMood("sleep"); }, 45000); };
    ["pointermove", "keydown", "click"].forEach((e) => window.addEventListener(e, reset));
    reset();
    return () => { clearTimeout(timer); ["pointermove", "keydown", "click"].forEach((e) => window.removeEventListener(e, reset)); };
  }, [busy, setMood]);
}

/* ===== suggerimenti proattivi (euristiche non invasive) ===== */
function useProactive(setSuggestion) {
  const pid = useStore((s) => s.currentPage);
  const blocks = useStore((s) => s.blocks[pid] || []);
  useEffect(() => {
    const todos = blocks.filter((b) => b.type === "todo");
    if (todos.length >= 6) { setSuggestion({ id: "todb-" + pid, text: "Questa lista è lunga (" + todos.length + " to-do). La trasformo in database?", action: "toDatabase" }); return; }
    const longText = blocks.filter((b) => b.type === "p" && (b.text || "").length > 600);
    if (longText.length) { setSuggestion({ id: "split-" + pid, text: "Paragrafo molto lungo: vuoi che lo divida in sezioni?", action: "split" }); return; }
    setSuggestion(null);
  }, [blocks, pid, setSuggestion]);
}

/* ===== riassunto giornata ===== */
function pagesEditedToday() {
  const s = store.get(); const today = new Date().toDateString();
  return Object.values(s.pages).filter((p) => !p.trashed && p.editedAt && new Date(p.editedAt).toDateString() === today);
}

function LumiAI({ open, setOpen }) {
  const [msgs, setMsgs] = useState([{ role: "assistant", text: "Ciao! Sono **Lumi**. Posso scrivere, riassumere, creare blocchi o pagine, ascoltare la tua voce e darti una mano. Cosa facciamo?" }]);
  const [input, setInput] = useState(""); const [busy, setBusy] = useState(false);
  const [mood, setMood] = useState("idle");
  const [suggestion, setSuggestion] = useState(null);
  const [dismissed, setDismissed] = useState({});
  const scrollRef = useRef(null);
  useIdleMood(setMood, busy);
  useProactive(setSuggestion);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTo(0, scrollRef.current.scrollHeight); }, [msgs, busy]);

  // festeggia quando tutti i to-do della pagina sono completati
  const pid = useStore((s) => s.currentPage);
  const blocks = useStore((s) => s.blocks[pid] || []);
  const prevAllDone = useRef(false);
  useEffect(() => {
    const todos = blocks.filter((b) => b.type === "todo");
    const allDone = todos.length > 0 && todos.every((b) => b.checked);
    if (allDone && !prevAllDone.current) { setMood("celebrate"); burstConfetti(); Sound.complete(); GAM.addAchievement({ id: "clean_list", icon: "✅", title: "Lista svuotata" }); toast("🎉 Lista completata!"); setTimeout(() => setMood("idle"), 4000); }
    prevAllDone.current = allDone;
  }, [blocks]);

  const speech = useSpeech((txt) => { setInput(txt); setTimeout(() => send(txt), 100); });

  const send = async (prompt) => {
    const text = (prompt == null ? input : prompt).trim(); if (!text || busy) return;
    setInput(""); setBusy(true); setMood("think");
    const ctx = workspaceContext();
    const sys = "Sei Lumi, assistente in italiano dentro l'app di produttivita Lumen. Rispondi sempre in italiano, conciso e utile.\nPagina corrente: \"" + ctx.title + "\". Contenuto:\n" + (ctx.text || "(vuota)") + "\nPagine: " + ctx.list + ".\nSe l'utente chiede di creare contenuti, scrivili in markdown semplice.";
    const history = msgs.slice(-8).map((m) => ({ role: m.role, content: m.text })).concat([{ role: "user", content: text }]);
    setMsgs((m) => m.concat([{ role: "user", text }, { role: "assistant", text: "", streaming: true }]));
    try { await streamClaude(history, (tok) => setMsgs((m) => { const c = m.slice(); c[c.length - 1] = { ...c[c.length - 1], text: c[c.length - 1].text + tok }; return c; }), sys); }
    catch (e) { setMsgs((m) => { const c = m.slice(); c[c.length - 1] = { role: "assistant", text: "Non riesco a contattare il modello adesso. Riprova tra poco." }; return c; }); }
    finally { setMsgs((m) => { const c = m.slice(); if (c.length) c[c.length - 1] = { ...c[c.length - 1], streaming: false }; return c; }); setBusy(false); setMood("idle"); }
  };

  const summarizeDay = () => {
    const pages = pagesEditedToday();
    if (!pages.length) { toast("Nessuna pagina modificata oggi"); return; }
    const recap = pages.map((p) => { const txt = (store.get().blocks[p.id] || []).map((b) => b.text).filter(Boolean).join(" ").slice(0, 300); return "Pagina \"" + p.title + "\": " + txt; }).join("\n");
    if (!open) setOpen(true);
    send("Fai un recap serale in italiano, caldo e sintetico, di cio che ho scritto oggi:\n" + recap);
  };

  const lastAssistant = () => { for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i].role === "assistant" && msgs[i].text) return msgs[i]; return null; };
  const insertLast = () => { const last = lastAssistant(); if (!last) return; const p = store.get().currentPage; A.setBlocks(p, (store.get().blocks[p] || []).concat(last.text.split("\n").filter((l) => l.trim()).map(lineToBlock)), "ai-insert"); toast("Inserito nella pagina"); };
  const createPage = () => { const last = lastAssistant(); if (!last) return; const title = last.text.split("\n")[0].replace(/^#+\s*/, "").slice(0, 60) || "Da Lumi"; A.addPage(null, { title, icon: "✶", blocks: [{ id: uid(), type: "h1", text: title }].concat(last.text.split("\n").slice(1).filter((l) => l.trim()).map(lineToBlock)) }); };

  const reduced = prefersReduced();
  const showSug = suggestion && !dismissed[suggestion.id];
  return (
    <>
      {/* suggerimento proattivo */}
      {showSug && !open && (
        <div style={{ position: "fixed", right: 92, bottom: 30, zIndex: 240, maxWidth: 260, background: T.panel, backdropFilter: "blur(16px)", border: "1px solid " + T.line, borderRadius: 14, padding: "10px 12px", boxShadow: "0 14px 40px rgba(0,0,0,.5)", animation: "lm-pop .25s" }}>
          <div style={{ fontSize: 12.5, color: T.ink, marginBottom: 8 }}>{suggestion.text}</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => { if (suggestion.action === "toDatabase") { DB.fromTodos(store.get().currentPage); toast("Convertito in database"); } setDismissed((d) => ({ ...d, [suggestion.id]: true })); }} style={{ ...btnAmber, padding: "5px 10px", fontSize: 12 }}>Sì, grazie</button>
            <button onClick={() => setDismissed((d) => ({ ...d, [suggestion.id]: true }))} style={{ ...btn, padding: "5px 10px", fontSize: 12 }}>No</button>
          </div>
        </div>
      )}
      <button onClick={() => setOpen((o) => !o)} aria-label="Apri Lumi AI" style={{ position: "fixed", right: 22, bottom: 22, zIndex: 250, width: 58, height: 58, borderRadius: "50%", border: "none", cursor: "pointer", background: "transparent", padding: 0, transform: open ? "scale(.92)" : "scale(1)", transition: reduced ? "none" : "transform .3s cubic-bezier(.2,1.5,.4,1)", animation: reduced ? "none" : "lm-float 4s ease-in-out infinite", display: "grid", placeItems: "center" }}>
        <LumiOrb mood={open ? "idle" : mood} size={58} />
      </button>
      <div style={{ position: "fixed", right: 22, bottom: 92, zIndex: 250, width: 380, maxWidth: "calc(100vw - 28px)", height: 540, maxHeight: "72vh", display: "flex", flexDirection: "column", background: T.panel, backdropFilter: "blur(22px)", border: "1px solid " + T.line, borderRadius: 20, boxShadow: "0 30px 80px rgba(0,0,0,.55)", overflow: "hidden", transformOrigin: "bottom right", opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", transform: open ? "translateY(0) scale(1)" : "translateY(16px) scale(.94)", transition: reduced ? "opacity .15s" : "transform .32s cubic-bezier(.2,1.3,.3,1), opacity .25s" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid " + T.line, display: "flex", alignItems: "center", gap: 10 }}>
          <LumiOrb mood={mood} size={34} />
          <div style={{ flex: 1 }}><div style={{ fontWeight: 800, fontFamily: "'Nohemi',sans-serif", fontSize: 16 }}>Lumi AI</div><div style={{ fontSize: 11, color: T.cyan }}>{busy ? "sta scrivendo…" : mood === "sleep" ? "sonnecchia…" : mood === "celebrate" ? "evviva!" : "pronto"}</div></div>
          <button onClick={summarizeDay} title="Riassumi la mia giornata" style={{ ...btn, fontSize: 11 }}>☾ Recap</button>
        </div>
        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          {msgs.map((m, i) => (<div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "85%", background: m.role === "user" ? T.glass : "rgba(122,150,210,.08)", border: "1px solid " + T.line, borderRadius: 14, borderBottomRightRadius: m.role === "user" ? 4 : 14, borderBottomLeftRadius: m.role === "user" ? 14 : 4, padding: "9px 12px", fontSize: 13.8, lineHeight: 1.55, color: T.ink, whiteSpace: "pre-wrap" }}>{inline(m.text)}{m.streaming && <span style={{ animation: "lm-blink 1s infinite", color: T.amber }}>{"▍"}</span>}</div>))}
        </div>
        <div style={{ display: "flex", gap: 6, padding: "0 12px 8px", flexWrap: "wrap" }}>
          <Chip onClick={() => send("Continua a scrivere il contenuto della pagina corrente.")}>Continua</Chip>
          <Chip onClick={() => send("Migliora e rendi piu chiaro il testo della pagina corrente.")}>Migliora</Chip>
          <Chip onClick={() => send("Riassumi in punti elenco la pagina corrente.")}>Riassumi</Chip>
          <Chip onClick={insertLast}>{"↘"} Inserisci</Chip>
          <Chip onClick={createPage}>{"＋"} Crea pagina</Chip>
        </div>
        <div style={{ padding: 12, borderTop: "1px solid " + T.line, display: "flex", gap: 8 }}>
          {speech.supported && <button onClick={() => speech.listening ? speech.stop() : speech.start()} title="Parla a Lumi" style={{ ...btn, padding: "8px 10px", color: speech.listening ? T.amber : T.sub, borderColor: speech.listening ? T.amber : T.line, animation: speech.listening && !reduced ? "lm-blink 1s infinite" : "none" }}>{"🎙"}</button>}
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder={speech.listening ? "Ascolto…" : "Chiedi a Lumi…"} style={{ flex: 1, padding: "10px 12px", background: "rgba(122,150,210,.08)", border: "1px solid " + T.line, borderRadius: 12, color: T.ink, fontSize: 14, outline: "none" }} />
          <button onClick={() => send()} disabled={busy} style={{ ...btnAmber, opacity: busy ? .5 : 1 }}>{"➤"}</button>
        </div>
      </div>
    </>
  );
}


/* ============================================================================
   PRODUTTIVITA — Focus/Pomodoro, Database+grafici+rollup, Quick capture, Reminder
   ============================================================================ */

/* ===== DATABASE (deriva da blocchi/pagine, viste + progress + rollup) ===== */
const DB = {
  // converte i to-do di una pagina in un "database" salvato come blocco speciale
  fromTodos: (pid) => {
    const blocks = store.get().blocks[pid] || [];
    const todos = blocks.filter((b) => b.type === "todo");
    const rows = todos.map((b) => ({ id: uid(), Nome: b.text, Stato: b.checked ? "Fatto" : "Da fare" }));
    const dbBlock = { id: uid(), type: "database", title: "Attività", view: "table", props: [{ key: "Nome", type: "text" }, { key: "Stato", type: "select", options: ["Da fare", "In corso", "Fatto"] }], rows };
    const rest = blocks.filter((b) => b.type !== "todo");
    A.setBlocks(pid, [...rest, dbBlock], "to-db");
  },
};
function DatabaseBlock({ block, onChange }) {
  const [view, setView] = useState(block.view || "table");
  const rows = block.rows || [];
  const done = rows.filter((r) => r.Stato === "Fatto").length;
  const pct = rows.length ? Math.round((done / rows.length) * 100) : 0;
  const setRows = (rows) => onChange({ ...block, rows });
  const addRow = () => setRows([...rows, { id: uid(), Nome: "Nuova voce", Stato: "Da fare" }]);
  const setCell = (id, key, val) => setRows(rows.map((r) => r.id === id ? { ...r, [key]: val } : r));
  const delRow = (id) => setRows(rows.filter((r) => r.id !== id));
  const groups = { "Da fare": [], "In corso": [], "Fatto": [] };
  rows.forEach((r) => (groups[r.Stato] || (groups[r.Stato] = [])).push(r));
  const VIEWS = [["table", "▤ Tabella"], ["board", "▦ Board"], ["gallery", "▣ Galleria"], ["chart", "◉ Grafico"]];
  return (
    <div style={{ border: "1px solid " + T.line, borderRadius: 14, overflow: "hidden", margin: "6px 0", background: "rgba(122,150,210,.04)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderBottom: "1px solid " + T.line, flexWrap: "wrap" }}>
        <span style={{ fontWeight: 700, fontFamily: "'Nohemi',sans-serif", fontSize: 15 }}>{block.title || "Database"}</span>
        <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
          {VIEWS.map(([v, lbl]) => (<button key={v} onClick={() => { setView(v); onChange({ ...block, view: v }); }} style={{ ...btn, padding: "4px 9px", fontSize: 11, color: view === v ? T.amber : T.sub, borderColor: view === v ? T.amber : T.line }}>{lbl}</button>))}
        </div>
      </div>
      {/* progress bar automatica (rollup % completati) */}
      <div style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid " + T.line }}>
        <div style={{ flex: 1, height: 8, borderRadius: 8, background: "rgba(122,150,210,.12)", overflow: "hidden" }}>
          <div style={{ width: pct + "%", height: "100%", background: "linear-gradient(90deg," + T.amber + "," + T.cyan + ")", transition: "width .4s cubic-bezier(.2,1.2,.3,1)" }} />
        </div>
        <span style={{ fontSize: 11.5, color: T.sub, fontFamily: "'Nohemi'" }}>{pct}% • {done}/{rows.length}</span>
      </div>
      <div style={{ padding: 12 }}>
        {view === "table" && (
          <div>
            {rows.map((r) => (<div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: "1px solid " + T.line }}>
              <input value={r.Nome} onChange={(e) => setCell(r.id, "Nome", e.target.value)} style={{ flex: 1, background: "none", border: "none", color: T.ink, outline: "none", fontSize: 13.5 }} />
              <select value={r.Stato} onChange={(e) => setCell(r.id, "Stato", e.target.value)} style={{ ...btn, padding: "3px 8px", fontSize: 11, cursor: "pointer" }}><option>Da fare</option><option>In corso</option><option>Fatto</option></select>
              <button onClick={() => delRow(r.id)} style={{ background: "none", border: "none", color: T.danger, cursor: "pointer" }}>{"✕"}</button>
            </div>))}
            <button onClick={addRow} style={{ ...btn, marginTop: 8 }}>+ Riga</button>
          </div>
        )}
        {view === "board" && (
          <div style={{ display: "flex", gap: 10, overflowX: "auto" }}>
            {Object.keys(groups).map((g) => (<div key={g} style={{ minWidth: 150, flex: 1 }}>
              <div style={{ fontSize: 11.5, color: T.sub, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".06em" }}>{g} · {groups[g].length}</div>
              {groups[g].map((r) => (<div key={r.id} style={{ background: T.glass, border: "1px solid " + T.line, borderRadius: 10, padding: "8px 10px", marginBottom: 6, fontSize: 13 }}>{r.Nome}</div>))}
            </div>))}
          </div>
        )}
        {view === "gallery" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(120px,1fr))", gap: 10 }}>
            {rows.map((r) => (<div key={r.id} style={{ border: "1px solid " + T.line, borderRadius: 12, overflow: "hidden" }}>
              <div style={{ height: 60, background: "linear-gradient(135deg," + T.amber + "33," + T.cyan + "33)" }} />
              <div style={{ padding: 8, fontSize: 12.5 }}>{r.Nome}<div style={{ color: T.sub, fontSize: 11 }}>{r.Stato}</div></div>
            </div>))}
          </div>
        )}
        {view === "chart" && (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 16, height: 140, padding: "10px 4px" }}>
            {Object.keys(groups).map((g) => { const h = rows.length ? (groups[g].length / rows.length) * 110 : 0;
              return (<div key={g} style={{ flex: 1, textAlign: "center" }}>
                <div style={{ height: 110, display: "flex", alignItems: "flex-end" }}><div style={{ width: "100%", height: h, borderRadius: "8px 8px 0 0", background: g === "Fatto" ? "linear-gradient(180deg," + T.cyan + "," + T.cyan + "88)" : g === "In corso" ? "linear-gradient(180deg," + T.amber + "," + T.amber + "88)" : "rgba(122,150,210,.3)", transition: "height .5s cubic-bezier(.2,1.2,.3,1)" }} /></div>
                <div style={{ fontSize: 11, color: T.sub, marginTop: 6 }}>{g}</div><div style={{ fontSize: 13, fontWeight: 700 }}>{groups[g].length}</div>
              </div>); })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ===== FOCUS / POMODORO ===== */
function FocusMode({ active, setActive }) {
  const [secs, setSecs] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState("work");
  useEffect(() => { if (!running) return; const iv = setInterval(() => setSecs((s) => { if (s <= 1) { clearInterval(iv); const next = mode === "work" ? "break" : "work"; setMode(next); burstConfetti(); Sound.complete(); toast(mode === "work" ? "Pausa! ☕" : "Si riparte 💪"); return next === "work" ? 25 * 60 : 5 * 60; } return s - 1; }), 1000); return () => clearInterval(iv); }, [running, mode]);
  if (!active) return null;
  const mm = String(Math.floor(secs / 60)).padStart(2, "0"), ss = String(secs % 60).padStart(2, "0");
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(5,8,18,.86)", backdropFilter: "blur(10px)", display: "grid", placeItems: "center", animation: "lm-fade .3s" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 13, color: T.cyan, letterSpacing: ".2em", textTransform: "uppercase", marginBottom: 12 }}>{mode === "work" ? "Concentrazione" : "Pausa"}</div>
        <div style={{ fontFamily: "'Nohemi',sans-serif", fontWeight: 800, fontSize: 120, color: T.ink, lineHeight: 1, letterSpacing: "-.04em" }}>{mm}:{ss}</div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 24 }}>
          <button onClick={() => setRunning((r) => !r)} style={{ ...btnAmber, padding: "10px 24px", fontSize: 15 }}>{running ? "Pausa" : "Avvia"}</button>
          <button onClick={() => { setRunning(false); setSecs(mode === "work" ? 25 * 60 : 5 * 60); }} style={{ ...btn, padding: "10px 20px" }}>Reset</button>
          <button onClick={() => { setActive(false); setRunning(false); }} style={{ ...btn, padding: "10px 20px" }}>Esci</button>
        </div>
        <div style={{ marginTop: 18, fontSize: 12.5, color: T.sub }}>Scena 3D attenuata per ridurre le distrazioni</div>
      </div>
    </div>
  );
}

/* ===== QUICK CAPTURE (hotkey globale) ===== */
function QuickCapture({ open, onClose }) {
  const [text, setText] = useState(""); const ref = useRef(null);
  useEffect(() => { if (open) { setText(""); setTimeout(() => ref.current && ref.current.focus(), 30); } }, [open]);
  if (!open) return null;
  const save = () => { if (text.trim()) { INBOX.add(text.trim()); toast("Salvato in Inbox 📥"); Sound.pop(); } onClose(); };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 600, background: "rgba(5,8,18,.5)", backdropFilter: "blur(6px)", display: "flex", justifyContent: "center", paddingTop: "22vh", animation: "lm-fade .15s" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 520, maxWidth: "90vw", height: "fit-content", background: T.panel, backdropFilter: "blur(20px)", border: "1px solid " + T.line, borderRadius: 18, boxShadow: "0 30px 80px rgba(0,0,0,.6)", padding: 18, animation: "lm-pop .2s" }}>
        <div style={{ fontSize: 12, color: T.cyan, marginBottom: 10, letterSpacing: ".1em", textTransform: "uppercase" }}>Cattura rapida → Inbox</div>
        <textarea ref={ref} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save(); }} placeholder="Butta giù un pensiero… (Cmd+Invio per salvare)" rows={3} style={{ width: "100%", background: "rgba(122,150,210,.08)", border: "1px solid " + T.line, borderRadius: 12, color: T.ink, fontSize: 15, padding: 12, outline: "none", resize: "none", boxSizing: "border-box", fontFamily: "'Nohemi',sans-serif" }} />
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}><button onClick={save} style={btnAmber}>Salva in Inbox</button></div>
      </div>
    </div>
  );
}

/* ===== INBOX PANEL ===== */
function InboxPanel({ onClose }) {
  const inbox = useStore((s) => s.inbox);
  return (
    <Modal title="Inbox" onClose={onClose} width={520}>
      {inbox.length === 0 ? <Empty>Inbox vuota. Premi Cmd+Shift+I ovunque per catturare un pensiero.</Empty> : inbox.map((i) => (
        <div key={i.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: "rgba(122,150,210,.05)", marginBottom: 6 }}>
          <span style={{ flex: 1, fontSize: 13.5 }}>{i.text}</span>
          <button onClick={() => { INBOX.toPage(i); onClose(); }} style={btn}>→ Pagina</button>
          <button onClick={() => INBOX.remove(i.id)} style={{ background: "none", border: "none", color: T.danger, cursor: "pointer" }}>{"✕"}</button>
        </div>
      ))}
    </Modal>
  );
}

/* ===== REMINDERS PANEL ===== */
function RemindersPanel({ onClose }) {
  const reminders = useStore((s) => s.reminders);
  const [text, setText] = useState(""); const [when, setWhen] = useState("");
  const add = () => { if (text.trim() && when) { REM.add(text.trim(), new Date(when).getTime()); setText(""); setWhen("");
    if ("Notification" in window && Notification.permission === "default") Notification.requestPermission(); } };
  return (
    <Modal title="Promemoria" onClose={onClose} width={520}>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ricordami di…" style={{ ...inp, flex: 2, minWidth: 140 }} />
        <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} style={{ ...inp, flex: 1, minWidth: 120 }} />
        <button onClick={add} style={btnAmber}>Aggiungi</button>
      </div>
      {reminders.filter((r) => !r.done).length === 0 ? <Empty>Nessun promemoria attivo.</Empty> : reminders.filter((r) => !r.done).sort((a, b) => a.when - b.when).map((r) => (
        <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10, background: "rgba(122,150,210,.05)", marginBottom: 6 }}>
          <span style={{ flex: 1, fontSize: 13.5 }}>{r.text}</span>
          <span style={{ fontSize: 11.5, color: T.sub, fontFamily: "'Nohemi'" }}>{new Date(r.when).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
          <button onClick={() => REM.remove(r.id)} style={{ background: "none", border: "none", color: T.danger, cursor: "pointer" }}>{"✕"}</button>
        </div>
      ))}
    </Modal>
  );
}


/* ============================================================================
   ESTETICA — cursore+particelle, copertine shader, transizione vinile, temi
   ============================================================================ */

/* ===== CURSORE PERSONALIZZATO + particelle al click ===== */

/* ===== COPERTINA SHADER animata ===== */

/* ===== TRANSIZIONE "vinile/cassetta" al cambio sezione ===== */
function VinylTransition({ trigger }) {
  const [show, setShow] = useState(false);
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } if (prefersReduced()) return; setShow(true); const t = setTimeout(() => setShow(false), 600); return () => clearTimeout(t); }, [trigger]);
  if (!show) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 800, pointerEvents: "none", display: "grid", placeItems: "center", animation: "lm-fade .15s" }}>
      <div style={{ width: 220, height: 220, borderRadius: "50%", background: "radial-gradient(circle at center, #111 18%, #1a1a1a 19%, #111 24%, #222 25%, #111 30%)", border: "2px solid #333", animation: "lm-spin .6s cubic-bezier(.3,.8,.3,1)", boxShadow: "0 20px 60px rgba(0,0,0,.7)", position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, margin: "auto", width: 60, height: 60, borderRadius: "50%", background: "linear-gradient(135deg," + T.amber + "," + T.cyan + ")", top: "50%", left: "50%", transform: "translate(-50%,-50%)" }} />
      </div>
    </div>
  );
}

/* ===== PANNELLO TEMI / SKIN ===== */


/* ============================================================================
   GAMIFICATION + COLLABORAZIONE + CHICCHE TECNICHE
   ============================================================================ */

/* ===== STATISTICHE / GAMIFICATION PANEL ===== */
function StatsPanel({ onClose }) {
  const gam = useStore((s) => s.gam);
  const pages = useStore((s) => s.pages);
  const blocks = useStore((s) => s.blocks);
  const totalBlocks = Object.values(blocks).reduce((a, arr) => a + arr.length, 0);
  const totalPages = Object.values(pages).filter((p) => !p.trashed).length;
  return (
    <Modal title="Statistiche & Obiettivi" onClose={onClose} width={560}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 18 }}>
        <Stat label="Streak" value={gam.streak + " gg"} icon="🔥" />
        <Stat label="Parole/sett." value={gam.wordsWeek.toLocaleString("it-IT")} icon="✍" />
        <Stat label="Blocchi" value={totalBlocks} icon="🧱" />
        <Stat label="Pagine" value={totalPages} icon="📄" />
        <Stat label="Creati totali" value={gam.blocksCreated} icon="✨" />
        <Stat label="Badge" value={gam.achievements.length} icon="🏆" />
      </div>
      <div style={{ fontSize: 12, color: T.sub, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>Achievement</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {ACHIEVEMENTS.map((a) => { const got = gam.achievements.find((x) => x.id === a.id);
          return (<div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: got ? T.glass : "rgba(122,150,210,.04)", border: "1px solid " + (got ? T.cyan + "55" : T.line), opacity: got ? 1 : .5 }}>
            <span style={{ fontSize: 22 }}>{a.icon}</span><span style={{ fontSize: 13, fontWeight: got ? 700 : 400 }}>{a.title}</span>{got && <span style={{ marginLeft: "auto", color: T.cyan }}>{"✓"}</span>}
          </div>); })}
      </div>
    </Modal>
  );
}
const Stat = ({ label, value, icon }) => (
  <div style={{ padding: "14px 12px", borderRadius: 14, background: "rgba(122,150,210,.06)", border: "1px solid " + T.line, textAlign: "center" }}>
    <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
    <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Nohemi',sans-serif" }}>{value}</div>
    <div style={{ fontSize: 11, color: T.sub }}>{label}</div>
  </div>
);

/* ===== REAZIONI EMOJI ai blocchi ===== */
const REACT = {
  add: (blockId, emoji) => store.set((s) => { const cur = s.reactions[blockId] || {}; const n = (cur[emoji] || 0) + 1; return { reactions: { ...s.reactions, [blockId]: { ...cur, [emoji]: n } } }; }),
};
function BlockReactions({ blockId }) {
  const reactions = useStore((s) => s.reactions[blockId] || {});
  const [pick, setPick] = useState(false);
  const EMO = ["👍", "❤️", "🔥", "🎉", "👀", "🚀"];
  const keys = Object.keys(reactions);
  if (!keys.length && !pick) return (<button className="lm-ctl" onClick={() => setPick(true)} style={{ position: "absolute", right: -2, top: 28, opacity: 0, transition: "opacity .15s", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: T.sub }}>{"☺"}</button>);
  return (
    <div style={{ display: "flex", gap: 4, marginLeft: 52, marginTop: 4, flexWrap: "wrap" }}>
      {keys.map((e) => (<span key={e} onClick={() => REACT.add(blockId, e)} style={{ fontSize: 12, padding: "2px 7px", borderRadius: 20, background: T.glass, border: "1px solid " + T.line, cursor: "pointer" }}>{e} {reactions[e]}</span>))}
      {pick && EMO.filter((e) => !keys.includes(e)).map((e) => (<span key={e} onClick={() => { REACT.add(blockId, e); setPick(false); }} style={{ fontSize: 14, padding: "2px 5px", cursor: "pointer", opacity: .7 }}>{e}</span>))}
      {!pick && <button onClick={() => setPick(true)} style={{ background: "none", border: "none", cursor: "pointer", color: T.sub, fontSize: 12 }}>+</button>}
    </div>
  );
}

/* ===== CURSORI LIVE simulati (stile Figma) ===== */

/* ===== PAGINA PUBBLICA / GUEST MODE ===== */
const PUBLISH = {
  toggle: (pid) => { store.set((s) => { const pub = { ...s.publicPages }; if (pub[pid]) delete pub[pid]; else pub[pid] = { slug: pid, ts: now() }; return { publicPages: pub }; }); return store.get().publicPages[pid]; },
};
function PublishDialog({ pageId, onClose }) {
  const pub = useStore((s) => s.publicPages[pageId]);
  const page = useStore((s) => s.pages[pageId]);
  const link = pub ? (location.origin + location.pathname + "#/p/" + pageId) : null;
  return (
    <Modal title={"Pubblica · " + ((page && page.title) || "")} onClose={onClose} width={480}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 600 }}>Pagina pubblica</div><div style={{ fontSize: 12, color: T.sub }}>Chiunque abbia il link può vederla (guest mode, sola lettura)</div></div>
        <button onClick={() => PUBLISH.toggle(pageId)} style={{ width: 46, height: 26, borderRadius: 20, border: "none", cursor: "pointer", background: pub ? T.cyan : "rgba(122,150,210,.2)", position: "relative", transition: "background .2s" }}>
          <span style={{ position: "absolute", top: 3, left: pub ? 23 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .2s cubic-bezier(.2,1.4,.3,1)" }} />
        </button>
      </div>
      {pub && (<div style={{ display: "flex", gap: 8 }}>
        <input readOnly value={link} style={{ ...inp, fontSize: 12, fontFamily: "'Nohemi'" }} />
        <button onClick={() => { navigator.clipboard && navigator.clipboard.writeText(link); toast("Link copiato"); }} style={btnAmber}>Copia</button>
      </div>)}
    </Modal>
  );
}
function GuestView({ pageId }) {
  const page = useStore((s) => s.pages[pageId]);
  const blocks = useStore((s) => s.blocks[pageId] || []);
  if (!page) return <div style={{ padding: 40, textAlign: "center", color: T.sub }}>Pagina non trovata.</div>;
  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.ink, position: "relative" }}>
      <InkScene theme="dark" />
      <div style={{ position: "relative", zIndex: 5, maxWidth: 740, margin: "0 auto", padding: "60px 28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <img src="/lumen-logo.png" alt="Lumen" style={{ height: 26, width: "auto", display: "block" }} />
          <span style={{ fontSize: 12, color: T.sub, padding: "4px 10px", border: "1px solid " + T.line, borderRadius: 20 }}>Anteprima pubblica</span>
        </div>
        <div style={{ fontSize: 48 }}>{page.icon}</div>
        <h1 style={{ fontFamily: "'Nohemi',sans-serif", fontWeight: 800, fontSize: 40, margin: "8px 0 24px" }}>{page.title}</h1>
        {blocks.map((b) => (<div key={b.id} style={{ marginBottom: 10, fontSize: b.type === "h1" ? 32 : b.type === "h2" ? 24 : b.type === "h3" ? 19 : 16, fontWeight: b.type && b.type[0] === "h" ? 700 : 400, fontFamily: b.type && b.type[0] === "h" ? "'Nohemi',sans-serif" : "inherit" }}>{b.type === "divider" ? <hr style={{ border: "none", borderTop: "1px solid " + T.line }} /> : b.type === "todo" ? (b.checked ? "☑ " : "☐ ") + b.text : inline(b.text || "")}</div>))}
        <div style={{ marginTop: 40, paddingTop: 20, borderTop: "1px solid " + T.line, fontSize: 12.5, color: T.sub }}>Creato con Lumen — l'area di lavoro che respira.</div>
      </div>
    </div>
  );
}

/* ===== TIME MACHINE (cronologia visiva) ===== */

/* ===== EXPORT PDF + IMPORT ===== */
function exportPDF(page, blocks) {
  const w = window.open("", "_blank"); if (!w) { toast("Consenti i popup per l'export PDF"); return; }
  const esc = (s) => (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const html = blocks.map((b) => {
    if (b.type === "h1") return "<h1>" + esc(b.text) + "</h1>";
    if (b.type === "h2") return "<h2>" + esc(b.text) + "</h2>";
    if (b.type === "h3") return "<h3>" + esc(b.text) + "</h3>";
    if (b.type === "todo") return "<p>" + (b.checked ? "☑" : "☐") + " " + esc(b.text) + "</p>";
    if (b.type === "quote") return "<blockquote>" + esc(b.text) + "</blockquote>";
    if (b.type === "code") return "<pre>" + esc(b.text) + "</pre>";
    if (b.type === "callout") return "<div class='callout'>💡 " + esc(b.text) + "</div>";
    if (b.type === "divider") return "<hr>";
    return "<p>" + esc(b.text) + "</p>";
  }).join("\n");
  w.document.write("<html><head><title>" + esc(page.title) + "</title><style>body{font-family:-apple-system,system-ui,sans-serif;max-width:680px;margin:40px auto;padding:0 20px;color:#1a2238;line-height:1.6}h1{font-size:34px}blockquote{border-left:3px solid #E8A33D;padding-left:16px;color:#555;font-style:italic}pre{background:#f4f6fb;padding:12px;border-radius:8px;font-family:monospace}.callout{background:#f0f7f6;padding:12px 16px;border-radius:10px}hr{border:none;border-top:1px solid #ddd}</style></head><body><h1>" + esc(page.icon + " " + page.title) + "</h1>" + html + "</body></html>");
  w.document.close(); setTimeout(() => w.print(), 300);
}
function ImportDialog({ onClose }) {
  const [text, setText] = useState("");
  const doImport = () => { if (!text.trim()) return; const blocks = smartPasteToBlocks(text); const title = (text.split("\n")[0] || "Importato").replace(/^#+\s*/, "").slice(0, 60);
    A.addPage(null, { title, icon: "📥", blocks }); toast("Importato come nuova pagina"); onClose(); };
  return (
    <Modal title="Importa da Notion / Markdown" onClose={onClose} width={560}>
      <p style={{ fontSize: 12.5, color: T.sub, marginBottom: 10 }}>Incolla Markdown o testo esportato da Notion. Lumen pulisce e converte in blocchi.</p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={10} placeholder="# Titolo&#10;Testo&#10;- [ ] attività&#10;> citazione" style={{ width: "100%", background: "rgba(122,150,210,.08)", border: "1px solid " + T.line, borderRadius: 12, color: T.ink, fontSize: 13.5, padding: 12, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "'Nohemi'" }} />
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}><button onClick={doImport} style={btnAmber}>Importa</button></div>
    </Modal>
  );
}

/* ===== OFFLINE indicator + sync simulata ===== */
function useOffline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => { const on = () => { setOnline(true); toast("Di nuovo online — sincronizzo…"); setTimeout(() => toast("Sincronizzato ✓"), 1200); }; const off = () => { setOnline(false); toast("Offline — le modifiche restano salvate in locale"); };
    window.addEventListener("online", on); window.addEventListener("offline", off); return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); }; }, []);
  return online;
}

/* ===== EASTER EGG: digita "lumen" ovunque ===== */
function useEasterEgg() {
  useEffect(() => {
    let buf = "";
    const k = (e) => { if (e.target && (e.target.isContentEditable || e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
      buf = (buf + e.key).slice(-5).toLowerCase();
      if (buf === "lumen") { burstConfetti(); toast("✨ Lumen!"); buf = ""; } };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, []);
}

/* ===== APP (route guard + persistenza per-utente) ===== */
/* dynamic theme override su T (skin) */
function applyThemeVars() { /* tema fisso: blu notte */ }

export default function App() {
  const user = useAuth();
  const theme = useStore((s) => s.theme);
  const pid = useStore((s) => s.currentPage);
  const settings = useStore((s) => s.settings);
  const [palette, setPalette] = useState(false);
  const [trash, setTrash] = useState(false);
  const [profile, setProfile] = useState(false);
  const [lumi, setLumi] = useState(false);
  const [focus, setFocus] = useState(false);
  const [filesP, setFilesP] = useState(false);
  const [capture, setCapture] = useState(false);
  const [inbox, setInbox] = useState(false);
  const [reminders, setReminders] = useState(false);
  const [stats, setStats] = useState(false);
  const [importP, setImportP] = useState(false);
  const [publishFor, setPublishFor] = useState(null);

  applyThemeVars();
  const online = useOffline();
  useReminderTick();
  useEasterEgg();

  // guest route (#/p/<id>)
  const [route, setRoute] = useState(() => location.hash);
  useEffect(() => { const h = () => setRoute(location.hash); window.addEventListener("hashchange", h); return () => window.removeEventListener("hashchange", h); }, []);

  useEffect(() => { if (user) { loadFor(user.id); touchStreak(); } }, [user && user.id]);
  useEffect(() => { if (!user) return; const unsub = store.subscribe(() => persistFor(user.id)); return unsub; }, [user && user.id]);

  useEffect(() => {
    const k = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((p) => !p); }
      else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "i") { e.preventDefault(); setCapture(true); }
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, []);

  // guest mode: pagina pubblica via link, senza account
  const guestMatch = route.match(/#\/p\/(\w+)/);
  if (guestMatch) { const gid = guestMatch[1]; if (store.get().publicPages[gid] || store.get().pages[gid]) return (<><GlobalStyle /><GuestView pageId={gid} /></>); }

  if (!user) return (<><GlobalStyle /><AuthScreen /></>);

  const dark = theme !== "light";
  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.ink, fontFamily: "'Nohemi',system-ui,sans-serif", transition: "background .5s,color .5s", position: "relative" }}>
      <GlobalStyle />
      <div style={{ filter: focus ? "blur(3px) brightness(.5)" : "none", opacity: focus ? .5 : 1, transition: "filter .5s, opacity .5s" }}>
        <InkScene theme={dark ? "dark" : "light"} key={theme} />
      </div>
      <ToastHost />
      <div style={{ position: "relative", zIndex: 5, display: "flex" }}>
        <Sidebar onSearch={() => setPalette(true)} onTrash={() => setTrash(true)} user={user} onProfile={() => setProfile(true)}
          extra={{ onFocus: () => setFocus(true), onFiles: () => setFilesP(true), onInbox: () => setInbox(true), onReminders: () => setReminders(true), onStats: () => setStats(true), onImport: () => setImportP(true) }} />
        <main style={{ flex: 1, minWidth: 0 }}>
          <Topbar onPublish={() => setPublishFor(pid)} onPDF={() => exportPDF(store.get().pages[pid], store.get().blocks[pid] || [])} />
          <Editor pageId={pid} key={pid} />
        </main>
      </div>
      <VinylTransition trigger={pid} />
      <LumiAI open={lumi} setOpen={setLumi} />
      <FocusMode active={focus} setActive={setFocus} />
      <QuickCapture open={capture} onClose={() => setCapture(false)} />
      <CommandPalette open={palette} onClose={() => setPalette(false)} extraActions={{ lumi: () => { setPalette(false); setLumi(true); }, capture: () => { setPalette(false); setCapture(true); }, focus: () => { setPalette(false); setFocus(true); } }} />
      {trash && <TrashPanel onClose={() => setTrash(false)} />}
      {profile && <ProfileDialog user={user} onClose={() => setProfile(false)} />}
      {inbox && <InboxPanel onClose={() => setInbox(false)} />}
      {filesP && <FileDatabase onClose={() => setFilesP(false)} />}
      {reminders && <RemindersPanel onClose={() => setReminders(false)} />}
      {stats && <StatsPanel onClose={() => setStats(false)} />}
      {importP && <ImportDialog onClose={() => setImportP(false)} />}
      {publishFor && <PublishDialog pageId={publishFor} onClose={() => setPublishFor(null)} />}
      {!online && <div style={{ position: "fixed", top: 10, left: "50%", transform: "translateX(-50%)", zIndex: 9000, background: T.danger, color: "#fff", padding: "4px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>Offline</div>}
    </div>
  );
}
