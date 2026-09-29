/**
 * Permissionless crank: graduate Active stories whose ends_at has passed and
 * total_staked >= graduation_threshold. Picks the first free RankingBoard slot
 * (or passes rank=0 after program upgrade for on-chain auto-select).
 *
 * Usage:
 *   node scripts/devnet-try-graduate.mjs
 *   STORY=72bUVg9hmdygdxNBoqyVmyh2mFXhEprhGzaWQmucm4es node scripts/devnet-try-graduate.mjs
 *   SMOKE_VANITY=1 node scripts/devnet-try-graduate.mjs   # grind …drop mint
 *   RANK=0 node scripts/devnet-try-graduate.mjs            # on-chain auto rank
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import anchor from '@coral-xyz/anchor'
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js'
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token'
import { grindMintKeypair, MINT_VANITY_SUFFIX } from './lib/vanityMint.mjs'

const { AnchorProvider, Program, Wallet } = anchor
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const RPC = process.env.RPC_URL || 'https://api.devnet.solana.com'
const NA = new PublicKey('75xWzXGb3A7UgpqDDL9ByVXpaZ8Zw4AF4i7whnVXyh8m')
const VC = new PublicKey('5VbDjccBDNVCPLpSgxyuw7ptYekrcxH8FySBxaAXx6C')
const ONLY = process.env.STORY ? new PublicKey(process.env.STORY) : null
const EXPLORER = (sig) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`

function loadIdl(name, addr) {
  const p = [`target/idl/${name}.json`, `src/idl/${name}.json`]
    .map((x) => path.join(ROOT, x))
    .find((c) => fs.existsSync(c))
  if (!p) throw new Error(`IDL not found for ${name}`)
  const idl = JSON.parse(fs.readFileSync(p, 'utf8'))
  idl.address = addr
  return idl
}

function loadWallet() {
  const kpPath = path.join(process.env.HOME, '.config/solana/id.json')
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(kpPath, 'utf8'))))
}

async function findFreeRank(narrative, rankingBoard, storyKey) {
  if (process.env.RANK != null && process.env.RANK !== '') {
    return Number(process.env.RANK)
  }
  try {
    const board = await narrative.account.rankingBoard.fetch(rankingBoard)
    const existing = board.ranks.findIndex((r) => r.equals(storyKey))
    if (existing >= 0) return existing + 1
    const empty = board.ranks.findIndex((r) => r.equals(PublicKey.default))
    if (empty < 0) throw new Error('RankingBoard full (ranks 1–5 taken)')
    return empty + 1
  } catch (e) {
    if (String(e.message || e).includes('RankingBoard full')) throw e
    return 1 // board not init yet
  }
}

async function main() {
  const payer = loadWallet()
  const connection = new Connection(RPC, 'confirmed')
  const provider = new AnchorProvider(connection, new Wallet(payer), {
    commitment: 'confirmed',
  })
  const narrative = new Program(loadIdl('narrative_auction', NA.toBase58()), provider)
  const [configPda] = PublicKey.findProgramAddressSync([Buffer.from('narrative-config')], NA)
  const [rankingBoard] = PublicKey.findProgramAddressSync([Buffer.from('ranking-board')], NA)

  const slot = await connection.getSlot('confirmed')
  const now = (await connection.getBlockTime(slot)) ?? Math.floor(Date.now() / 1000)
  console.log('payer', payer.publicKey.toBase58())
  console.log('now', now)

  let stories
  if (ONLY) {
    stories = [{ publicKey: ONLY, account: await narrative.account.storyMarket.fetch(ONLY) }]
  } else {
    stories = await narrative.account.storyMarket.all()
  }

  const targets = []
  for (const s of stories) {
    const phase = Object.keys(s.account.phase)[0]
    const total = Number(s.account.totalStaked.toString())
    const thresh = Number(s.account.graduationThreshold.toString())
    const endsAt = Number(s.account.endsAt.toString())
    if (phase !== 'active') continue
    if (total < thresh) continue
    if (now <= endsAt) {
      console.log('skip (timer running)', s.publicKey.toBase58(), 'remaining', endsAt - now, 's')
      continue
    }
    targets.push(s)
  }

  if (!targets.length) {
    console.log('No stories ready to graduate.')
    return
  }

  const results = []
  for (const s of targets) {
    const storyKey = s.publicKey
    console.log('\n=== graduating', storyKey.toBase58(), '===')
    const rank = await findFreeRank(narrative, rankingBoard, storyKey)
    console.log('rank', rank)

    let mint
    if (process.env.SMOKE_MINT_KEYPAIR) {
      const secret = JSON.parse(fs.readFileSync(process.env.SMOKE_MINT_KEYPAIR, 'utf8'))
      mint = Keypair.fromSecretKey(Uint8Array.from(secret))
    } else if (process.env.SMOKE_VANITY === '0') {
      mint = Keypair.generate()
    } else {
      console.log(`Grinding vanity mint …${MINT_VANITY_SUFFIX}`)
      mint = await grindMintKeypair({
        onProgress: (n) => {
          if (n % 100_000 === 0) process.stdout.write(`  grind attempts=${n}\r`)
        },
      })
      console.log(`\nmint ${mint.publicKey.toBase58()}`)
    }

    const [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('story-vault'), storyKey.toBuffer()],
      NA,
    )
    const [curvePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('curve'), storyKey.toBuffer()],
      VC,
    )
    const [curveVault] = PublicKey.findProgramAddressSync(
      [Buffer.from('curve-vault'), curvePda.toBuffer()],
      VC,
    )
    const [stakeAirdrop] = PublicKey.findProgramAddressSync(
      [Buffer.from('stake-airdrop'), storyKey.toBuffer()],
      NA,
    )
    const tokenVault = getAssociatedTokenAddressSync(mint.publicKey, curvePda, true)
    const airdropTokenVault = getAssociatedTokenAddressSync(mint.publicKey, stakeAirdrop, true)

    try {
      const sig = await narrative.methods
        .graduateNarrative(rank)
        .accountsStrict({
          config: configPda,
          story: storyKey,
          rankingBoard,
          vault: vaultPda,
          stakeAirdrop,
          airdropTokenVault,
          curveProgram: VC,
          tokenMint: mint.publicKey,
          curveState: curvePda,
          curveVault,
          tokenVault,
          payer: payer.publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
          clock: SYSVAR_CLOCK_PUBKEY,
        })
        .signers([mint])
        .rpc()
      const after = await narrative.account.storyMarket.fetch(storyKey)
      const row = {
        story: storyKey.toBase58(),
        rank,
        mint: mint.publicKey.toBase58(),
        curve: curvePda.toBase58(),
        phase: Object.keys(after.phase)[0],
        sig,
        explorer: EXPLORER(sig),
      }
      console.log('PASS', row)
      results.push(row)
    } catch (e) {
      console.error('FAIL', storyKey.toBase58(), e.message || e)
      if (e.logs) console.error(e.logs.join('\n'))
      results.push({ story: storyKey.toBase58(), error: e.message || String(e) })
    }
  }

  console.log('\n=== SUMMARY ===')
  console.log(JSON.stringify(results, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
