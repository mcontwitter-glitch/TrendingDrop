/**
 * Permissionless: clamp ends_at for Active stories that already met
 * graduation_threshold (e.g. crossed before post_threshold_secs upgrade).
 *
 * Usage:
 *   node scripts/devnet-clamp-post-threshold.mjs
 *   STORY=72bUVg9hmdygdxNBoqyVmyh2mFXhEprhGzaWQmucm4es node scripts/devnet-clamp-post-threshold.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import anchor from '@coral-xyz/anchor'
import { Connection, Keypair, PublicKey, SYSVAR_CLOCK_PUBKEY } from '@solana/web3.js'

const { AnchorProvider, Program, Wallet } = anchor
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const RPC = process.env.RPC_URL || 'https://api.devnet.solana.com'
const PROGRAM_ID = new PublicKey('75xWzXGb3A7UgpqDDL9ByVXpaZ8Zw4AF4i7whnVXyh8m')
const ONLY = process.env.STORY ? new PublicKey(process.env.STORY) : null

function loadWallet() {
  const kpPath = path.join(process.env.HOME, '.config/solana/id.json')
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(kpPath, 'utf8'))))
}

async function main() {
  const payer = loadWallet()
  const connection = new Connection(RPC, 'confirmed')
  const provider = new AnchorProvider(connection, new Wallet(payer), { commitment: 'confirmed' })
  const idlPath = fs.existsSync(path.join(ROOT, 'target/idl/narrative_auction.json'))
    ? path.join(ROOT, 'target/idl/narrative_auction.json')
    : path.join(ROOT, 'src/idl/narrative_auction.json')
  const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'))
  idl.address = PROGRAM_ID.toBase58()
  const program = new Program(idl, provider)
  const [configPda] = PublicKey.findProgramAddressSync([Buffer.from('narrative-config')], PROGRAM_ID)

  const now = Math.floor(Date.now() / 1000)
  const cfg = await program.account.narrativeConfig.fetch(configPda)
  const window = Number(cfg.postThresholdSecs?.toString?.() ?? cfg.postThresholdSecs ?? 1800)
  console.log('Authority/payer', payer.publicKey.toBase58())
  console.log('post_threshold_secs', window)

  let stories
  if (ONLY) {
    const account = await program.account.storyMarket.fetch(ONLY)
    stories = [{ publicKey: ONLY, account }]
  } else {
    stories = await program.account.storyMarket.all()
  }

  const targets = []
  for (const s of stories) {
    const phase = Object.keys(s.account.phase)[0]
    const total = Number(s.account.totalStaked.toString())
    const thresh = Number(s.account.graduationThreshold.toString())
    const endsAt = Number(s.account.endsAt.toString())
    if (phase !== 'active') continue
    if (total < thresh) continue
    if (endsAt <= now + window + 5) {
      console.log('skip (already clamped)', s.publicKey.toBase58(), 'remaining', endsAt - now, 's')
      continue
    }
    targets.push(s)
  }

  if (!targets.length) {
    console.log('No stories need clamp.')
    return
  }

  for (const s of targets) {
    const before = Number(s.account.endsAt.toString())
    console.log('clamping', s.publicKey.toBase58(), 'ends_at', before, 'remainingH', ((before - now) / 3600).toFixed(2))
    const sig = await program.methods
      .clampPostThreshold()
      .accountsStrict({
        config: configPda,
        story: s.publicKey,
        clock: SYSVAR_CLOCK_PUBKEY,
      })
      .rpc()
    const after = await program.account.storyMarket.fetch(s.publicKey)
    const endsAt = Number(after.endsAt.toString())
    console.log({
      sig,
      previousEndsAt: before,
      endsAt,
      remainingSecs: endsAt - Math.floor(Date.now() / 1000),
      explorer: `https://explorer.solana.com/tx/${sig}?cluster=devnet`,
    })
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
