// Vite er "motoren" der kører React-appen under udvikling (npm run dev)
// og pakker den til færdige filer (npm run build).
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
  },
});
