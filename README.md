# Lumen — deploy su Vercel

Area di lavoro alternativa a Notion, con estetica 3D, editor a blocchi e Lumì AI.

## Cosa contiene

```
lumen/
├── api/
│   └── lumi.js          # Serverless function (proxy Anthropic, tiene la API key lato server)
├── public/
│   └── fonts/           # I 9 pesi Nohemi (.woff2), serviti staticamente
├── src/
│   ├── Lumen.jsx        # L'intera app (componente React)
│   └── main.jsx         # Entry point
├── index.html
├── package.json
├── vite.config.js
├── vercel.json
└── .env.example
```

## Deploy in 3 modi

### A) Via dashboard Vercel (più semplice)
1. Crea un repo Git (GitHub/GitLab) e pusha questa cartella.
2. Su vercel.com → **Add New → Project** → importa il repo.
3. Vercel rileva Vite in automatico (Build: `vite build`, Output: `dist`).
4. In **Settings → Environment Variables** aggiungi:
   - `ANTHROPIC_API_KEY` = la tua chiave `sk-ant-...`
5. **Deploy**. Fatto.

### B) Via CLI
```bash
npm i -g vercel
vercel            # primo deploy (segui le domande)
vercel env add ANTHROPIC_API_KEY   # incolla la chiave
vercel --prod     # deploy in produzione
```

### C) Test in locale
```bash
npm install
# Solo frontend (Lumì AI NON funziona, manca /api):
npm run dev
# Con le serverless function attive (Lumì AI funziona):
npm i -g vercel
vercel dev        # richiede ANTHROPIC_API_KEY in .env.local
```

## La API key (importante)

Lumì AI **non** chiama Anthropic dal browser: lo farebbe esporre la chiave e verrebbe bloccato da CORS. Le richieste passano da `api/lumi.js`, una funzione serverless che inoltra ad Anthropic usando `ANTHROPIC_API_KEY` letta dalle env di Vercel. La chiave non finisce mai nel bundle del browser.

## Note

- **Persistenza e auth**: l'app salva su `localStorage` del browser (per-utente). È pensata per essere collegata a Supabase: l'oggetto `auth` e lo `store` in `Lumen.jsx` hanno la stessa shape di Supabase Auth/Postgres, quindi il passaggio è sostituire quel modulo senza riscrivere il resto.
- **Cursori live / sync multi-dispositivo**: attualmente simulati in locale; richiedono un backend realtime (es. Supabase Realtime) per essere reali.
- **Font Nohemi**: serviti da `/public/fonts/` via `@font-face`. I due pesi più usati sono in `<link rel="preload">` per evitare il flash.
- **prefers-reduced-motion**: rispettato; le animazioni 3D usano throttling e cap del device pixel ratio.

## Modello usato da Lumì

`api/lumi.js` inoltra il body che riceve. Il modello è impostato in `Lumen.jsx` (cerca `model:`). Se vuoi cambiarlo, modifica lì la stringa del modello.


## Lumì AI non risponde su Vercel?

Quasi sempre è la variabile d'ambiente. Controlla:
1. **Vercel → Settings → Environment Variables** → deve esistere `ANTHROPIC_API_KEY` con valore `sk-ant-...`
2. Dopo averla aggiunta, **rifai un deploy** (le env si applicano solo ai deploy successivi): Deployments → … → Redeploy.
3. Se Lumì mostra un messaggio con ⚠️, quello è l'errore reale restituito da Anthropic (es. credito esaurito, key non valida): risolvi quello.

Il modello usato è `claude-3-5-sonnet-20241022` (impostato sia in `src/Lumen.jsx` che in `api/lumi.js`).
