import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initializeMsal } from './outlookService'

// Inicializacija MSAL pred renderiranjem aplikacije
initializeMsal().then(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}).catch((err) => {
  console.error("MSAL initialization failed:", err)
  // Tudi če MSAL ne uspe, naj se aplikacija naloži (ostali deli morajo delovati)
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})