// Vite er "motoren" der kører React-appen under udvikling (npm run dev)
// og pakker den til færdige filer (npm run build).
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  /*
    base: "./" betyder, at appen henter sine filer med RELATIVE stier (./assets/...).
    Så virker den, uanset hvilken adresse den ligger på – fx
    https://frederik270512-cloud.github.io/Playmaker/  (GitHub Pages)
    eller senere et eget domæne. Det kan lade sig gøre, fordi navigationen
    bruger #spillere, #tavle osv. og ikke rigtige undersider.
  */
  base: "./",

  server: {
    port: 5173,
    open: false,
  },
});
