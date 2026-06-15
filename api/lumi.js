// api/lumi.js — Vercel Serverless Function (Edge)
// Proxy verso l'API Anthropic: tiene la API key lato server e gestisce lo streaming.

export const config = { runtime: "edge" };

export default async function handler(req) {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return json({ error: "ANTHROPIC_API_KEY mancante. Aggiungila in Vercel → Settings → Environment Variables e fai un nuovo deploy." }, 500);
  }

  let body;
  try { body = await req.json(); } catch {
    return json({ error: "Body JSON non valido" }, 400);
  }

  // Modello di default robusto se non specificato o non valido lato client.
  if (!body.model) body.model = "claude-3-5-sonnet-20241022";

  let upstream;
  try {
    upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return json({ error: "Impossibile contattare Anthropic: " + (e?.message || e) }, 502);
  }

  // Se Anthropic risponde con errore, inoltro il messaggio leggibile al client.
  if (!upstream.ok) {
    const errText = await upstream.text();
    return json({ error: "Anthropic " + upstream.status + ": " + errText }, upstream.status);
  }

  // Streaming: passthrough del body SSE.
  if (body.stream && upstream.body) {
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
      },
    });
  }

  // Non-streaming.
  const data = await upstream.text();
  return new Response(data, { status: 200, headers: { "Content-Type": "application/json" } });
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}
