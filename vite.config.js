import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // In sviluppo locale, proxy verso le serverless function richiede `vercel dev`.
    // Con `npm run dev` puro, /api non è disponibile: usa `vercel dev` per testare Lumì.
  },
});
