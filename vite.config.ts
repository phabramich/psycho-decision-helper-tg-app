import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    target: ["safari16.4", "ios16.4", "chrome111", "edge120", "firefox115"],
  },
  server: {
    host: "127.0.0.1",
    port: 5175,
    strictPort: true,
    allowedHosts: true,
  },
});
