import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path"
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return
          }

          if (
            id.includes('mermaid') ||
            id.includes('cytoscape') ||
            id.includes('katex') ||
            id.includes('d3-') ||
            id.includes('dagre')
          ) {
            return 'diagram-vendor'
          }

          if (id.includes('html2canvas') || id.includes('jspdf')) {
            return 'export-vendor'
          }

          if (id.includes('react') || id.includes('scheduler')) {
            return 'react-vendor'
          }
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
