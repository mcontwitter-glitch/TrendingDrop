/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SOLANA_RPC_URL?: string
  readonly VITE_NARRATIVE_AUCTION_PROGRAM_ID?: string
  readonly VITE_VELOCITY_CURVE_PROGRAM_ID?: string
  readonly VITE_LORE_MERGE_PROGRAM_ID?: string
  readonly VITE_REPUTATION_NFT_PROGRAM_ID?: string
  readonly VITE_INDEXER_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
