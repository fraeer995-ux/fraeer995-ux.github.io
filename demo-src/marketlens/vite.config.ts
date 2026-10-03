import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
export default defineConfig({base:'/demos/marketlens/',plugins:[react(),tailwindcss()],build:{outDir:'../../demos/marketlens',emptyOutDir:true}})
