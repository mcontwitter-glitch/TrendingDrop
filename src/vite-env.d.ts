/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SOLANA_RPC_URL?: string
  readonly VITE_NARRATIVE_AUCTION_PROGRAM_ID?: string
  readonly VITE_VELOCITY_CURVE_PROGRAM_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
