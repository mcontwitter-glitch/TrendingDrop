import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Buffer } from 'buffer'
import './index.css'
import App from './App'
import { SolanaProvider } from './providers/SolanaProvider'
import { ToastProvider } from './components/Toast'

// Wallet adapter / Anchor expect Node globals in the browser.
if (typeof window !== 'undefined') {
  ;(window as unknown as { Buffer: typeof Buffer }).Buffer = Buffer
  ;(window as unknown as { global: typeof window }).global = window
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SolanaProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </SolanaProvider>
  </StrictMode>,
)
