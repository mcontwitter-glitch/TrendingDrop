/**
 * Realloc NarrativeConfig after staker_airdrop_bps field append + set bps=2000.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import anchor from '@coral-xyz/anchor'
import { Connection, Keypair, PublicKey, SystemProgram } from '@solana/web3.js'

const { AnchorProvider, Program, Wallet } = anchor
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const RPC = process.env.RPC_URL || 'https://api.devnet.solana.com'
const PROGRAM_ID = new PublicKey('75xWzXGb3A7UgpqDDL9ByVXpaZ8Zw4AF4i7whnVXyh8m')
const BPS = Number(process.env.STAKER_AIRDROP_BPS || 2000)

function loadWallet() {
  const kpPath = path.join(process.env.HOME, '.config/solana/id.json')
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(kpPath, 'utf8'))))
}

async function main() {
  const payer = loadWallet()
  const connection = new Connection(RPC, 'confirmed')
  const provider = new AnchorProvider(connection, new Wallet(payer), { commitment: 'confirmed' })
  const idl = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/idl/narrative_auction.json'), 'utf8'))
  idl.address = PROGRAM_ID.toBase58()
  const program = new Program(idl, provider)
  const [configPda] = PublicKey.findProgramAddressSync([Buffer.from('narrative-config')], PROGRAM_ID)

  console.log('Authority', payer.publicKey.toBase58())
  console.log('Config', configPda.toBase58())
  const before = await connection.getAccountInfo(configPda)
  console.log('Config data len before', before?.data.length)

  const sig = await program.methods
    .updateConfig(null, null, null, null, BPS)
    .accountsStrict({
      config: configPda,
      authority: payer.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc()

  console.log('update_config sig', sig)
  const after = await connection.getAccountInfo(configPda)
  console.log('Config data len after', after?.data.length)
  const cfg = await program.account.narrativeConfig.fetch(configPda)
  console.log('stakerAirdropBps', cfg.stakerAirdropBps)
  console.log('Explorer', `https://explorer.solana.com/tx/${sig}?cluster=devnet`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
