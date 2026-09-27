import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { Wallet } from 'lucide-react'

function truncate(addr: string) {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`
}

/**
 * Purple connect control matching Launch / Connect look.
 * Opens the wallet-adapter modal; shows truncated address when connected.
 */
export function WalletButton() {
  const { publicKey, connected, disconnecting, connecting } = useWallet()
  const { setVisible } = useWalletModal()

  const label = connecting
    ? 'Connecting…'
    : disconnecting
      ? 'Disconnecting…'
      : connected && publicKey
        ? truncate(publicKey.toBase58())
        : 'Connect Wallet'

  return (
    <button
      type="button"
      onClick={() => setVisible(true)}
      className="wallet-connect-btn inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-2.5 py-1.5 text-xs font-bold text-white transition hover:bg-purple-500 sm:px-3 sm:text-sm"
    >
      <Wallet className="h-3.5 w-3.5" />
      <span>{label}</span>
    </button>
  )
}
