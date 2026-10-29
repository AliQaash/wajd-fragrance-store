import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// envPrefix keeps the existing REACT_APP_* variables (already set on Vercel)
// working after the move from Create React App to Vite. Output goes to build/
// so the Vercel project's output setting does not need to change either.
export default defineConfig({
  plugins: [react()],
  envPrefix: ["VITE_", "REACT_APP_"],
  server: { port: 3000, strictPort: true },
  preview: { port: 3000 },
  build: { outDir: "build", sourcemap: false },
});
