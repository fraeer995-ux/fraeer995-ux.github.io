import { setupDemo } from './demo'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@fontsource-variable/golos-text'
import App from './App'
import './styles.css'
setupDemo()
const client = new QueryClient({defaultOptions:{queries:{retry:1,refetchOnWindowFocus:false}}})
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><QueryClientProvider client={client}><HashRouter><App/></HashRouter></QueryClientProvider></React.StrictMode>)

