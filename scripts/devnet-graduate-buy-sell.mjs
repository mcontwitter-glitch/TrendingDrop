/**
 * One-shot Devnet: graduate → buy → sell on an EXISTING ended story.
 * Does not init config/oracle/story/stake.
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
import BN from 'bn.js'
import { grindMintKeypair, MINT_VANITY_SUFFIX } from './lib/vanityMint.mjs'

const { AnchorProvider, Program, Wallet } = anchor

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const RPC = process.env.RPC_URL || 'https://api.devnet.solana.com'
const LAMPORTS_PER_SOL = 1_000_000_000
const STORY = new PublicKey(
  process.env.SMOKE_STORY_PDA || '9JnFcrBBJgNmgA3AkhGW7Wkai1WH5oeXHdEpKgSRVEzW',
)
const EXPLORER = (sig) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`

const PROGRAM_IDS = {
  narrative_auction: new PublicKey('75xWzXGb3A7UgpqDDL9ByVXpaZ8Zw4AF4i7whnVXyh8m'),
  velocity_curve: new PublicKey('5VbDjccBDNVCPLpSgxyuw7ptYekrcxH8FySBxaAXx6C'),
  lore_merge: new PublicKey('8pSr3X9iP66rvqMWT4S2gsEGtS8VnCLZtJayY9NB9ySy'),
  reputation_nft: new PublicKey('DrzQKZpvg8y7Gymp5yz2upX24v3fV7j7eFuqT31Nxgvd'),
}

function loadIdl(name) {
  const candidates = [
    path.join(ROOT, 'target', 'idl', `${name}.json`),
    path.join(ROOT, 'src', 'idl', `${name}.json`),
  ]
  const p = candidates.find((c) => fs.existsSync(c))
  if (!p) throw new Error(`IDL not found for ${name}`)
  const idl = JSON.parse(fs.readFileSync(p, 'utf8'))
  idl.address = PROGRAM_IDS[name].toBase58()
  return idl
}

function loadWallet() {
  const kpPath = path.join(process.env.HOME, '.config/solana/id.json')
  const secret = JSON.parse(fs.readFileSync(kpPath, 'utf8'))
  return Keypair.fromSecretKey(Uint8Array.from(secret))
}

function pda(seeds, programId) {
  return PublicKey.findProgramAddressSync(seeds, programId)
}

const results = []
function ok(step, detail) {
  results.push({ step, status: 'PASS', detail })
  console.log(`PASS  ${step}${detail ? ' — ' + detail : ''}`)
}
function fail(step, err) {
  const detail = err?.message || String(err)
  results.push({ step, status: 'FAIL', detail })
  console.error(`FAIL  ${step} — ${detail}`)
  if (err?.logs) console.error('Logs:\n' + err.logs.join('\n'))
  throw err
}

async function main() {
  console.log('=== TrendingDrop Devnet graduate→buy→sell ===')
  console.log('RPC:', RPC)
  console.log('Story:', STORY.toBase58())

  const connection = new Connection(RPC, 'confirmed')
  const payer = loadWallet()
  console.log('Wallet:', payer.publicKey.toBase58())
  let bal = await connection.getBalance(payer.publicKey)
  console.log('Balance:', bal / LAMPORTS_PER_SOL, 'SOL')

  const wallet = new Wallet(payer)
  const provider = new AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
    preflightCommitment: 'confirmed',
  })

  const narrative = new Program(loadIdl('narrative_auction'), provider)
  const velocity = new Program(loadIdl('velocity_curve'), provider)

  const [configPda] = pda([Buffer.from('narrative-config')], PROGRAM_IDS.narrative_auction)
  const [rankingPda] = pda([Buffer.from('ranking-board')], PROGRAM_IDS.narrative_auction)
  const [vaultPda] = pda(
    [Buffer.from('story-vault'), STORY.toBuffer()],
    PROGRAM_IDS.narrative_auction,
  )
  const [curvePda] = pda(
    [Buffer.from('curve'), STORY.toBuffer()],
    PROGRAM_IDS.velocity_curve,
  )
  const [curveVaultPda] = pda(
    [Buffer.from('curve-vault'), curvePda.toBuffer()],
    PROGRAM_IDS.velocity_curve,
  )

  // Prefetch story
  const storyBefore = await narrative.account.storyMarket.fetch(STORY)
  const slot = await connection.getSlot('confirmed')
  const now = (await connection.getBlockTime(slot)) ?? Math.floor(Date.now() / 1000)
  console.log('phase:', JSON.stringify(storyBefore.phase))
  console.log('endsAt:', storyBefore.endsAt.toString(), 'now:', now, 'past:', now > Number(storyBefore.endsAt))
  console.log('totalStaked:', storyBefore.totalStaked.toString(),
    'threshold:', storyBefore.graduationThreshold.toString())
  console.log('curvePda:', curvePda.toBase58())
  console.log('rankingBoard:', rankingPda.toBase58())
  console.log('vault:', vaultPda.toBase58(),
    'lamports:', await connection.getBalance(vaultPda))

  // If already graduated, skip graduate and use existing mint
  let mintPubkey = null
  let graduateSig = null

  const alreadyGraduated = storyBefore.phase && (
    storyBefore.phase.graduated !== undefined ||
    Object.keys(storyBefore.phase)[0] === 'graduated'
  )
  const curveInfo = await connection.getAccountInfo(curvePda)

  if (alreadyGraduated && curveInfo) {
    const curve = await velocity.account.velocityToken.fetch(curvePda)
    mintPubkey = curve.mint
    ok('graduate_narrative', `ALREADY graduated mint=${mintPubkey.toBase58()} curve=${curvePda.toBase58()}`)
  } else {
    let mint
    if (process.env.SMOKE_MINT_KEYPAIR) {
      const secret = JSON.parse(fs.readFileSync(process.env.SMOKE_MINT_KEYPAIR, 'utf8'))
      mint = Keypair.fromSecretKey(Uint8Array.from(secret))
      console.log(`Using precomputed mint ${mint.publicKey.toBase58()}`)
      if (!mint.publicKey.toBase58().endsWith(MINT_VANITY_SUFFIX)) {
        throw new Error(`Precomputed mint does not end in ${MINT_VANITY_SUFFIX}`)
      }
    } else {
      console.log(`Grinding vanity mint ending in "${MINT_VANITY_SUFFIX}"…`)
      const grindStarted = Date.now()
      mint = await grindMintKeypair({
        onProgress: (n) => {
          if (n % 100_000 === 0) process.stdout.write(`  grind attempts=${n}\r`)
        },
      })
      console.log(`\nVanity mint found in ${((Date.now()-grindStarted)/1000).toFixed(1)}s: ${mint.publicKey.toBase58()}`)
    }
    mintPubkey = mint.publicKey
    const tokenVault = getAssociatedTokenAddressSync(
      mint.publicKey,
      curvePda,
      true,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    )
    const [stakeAirdrop] = pda([Buffer.from('stake-airdrop'), STORY.toBuffer()], PROGRAM_IDS.narrative_auction)
    const airdropTokenVault = getAssociatedTokenAddressSync(
      mint.publicKey,
      stakeAirdrop,
      true,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    )
    console.log('new mint:', mint.publicKey.toBase58(), `(…${MINT_VANITY_SUFFIX})`)
    console.log('tokenVault:', tokenVault.toBase58())

    // Prefer explicit SMOKE_RANK; else first empty RankingBoard slot (never assume 1).
    let rank = process.env.SMOKE_RANK != null && process.env.SMOKE_RANK !== ''
      ? Number(process.env.SMOKE_RANK)
      : null
    if (rank == null) {
      try {
        const board = await narrative.account.rankingBoard.fetch(rankingPda)
        const existing = board.ranks.findIndex((r) => r.equals(STORY))
        if (existing >= 0) rank = existing + 1
        else {
          const empty = board.ranks.findIndex((r) => r.equals(PublicKey.default))
          if (empty < 0) throw new Error('RankingBoard full (1–5 taken)')
          rank = empty + 1
        }
      } catch (e) {
        if (String(e.message || e).includes('RankingBoard full')) throw e
        rank = 1 // board not init
      }
    }
    console.log('using rank', rank)
    try {
      const sig = await narrative.methods
        .graduateNarrative(rank)
        .accountsStrict({
          config: configPda,
          story: STORY,
          rankingBoard: rankingPda,
          vault: vaultPda,
          stakeAirdrop,
          airdropTokenVault,
          curveProgram: PROGRAM_IDS.velocity_curve,
          tokenMint: mint.publicKey,
          curveState: curvePda,
          curveVault: curveVaultPda,
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
      graduateSig = sig
      const story = await narrative.account.storyMarket.fetch(STORY)
      const curve = await velocity.account.velocityToken.fetch(curvePda)
      ok(
        'graduate_narrative',
        `sig=${sig} explorer=${EXPLORER(sig)} phase=${JSON.stringify(story.phase)} curve=${curvePda.toBase58()} mint=${curve.mint.toBase58()}`,
      )
      mintPubkey = curve.mint
    } catch (e) {
      fail('graduate_narrative', e)
    }
  }

  // buy
  let holderPda
  let buySig = null
  try {
    const curve = await velocity.account.velocityToken.fetch(curvePda)
    const buyLamports = new BN(50_000_000) // 0.05 SOL
    const buyerAta = getAssociatedTokenAddressSync(
      curve.mint,
      payer.publicKey,
      false,
      TOKEN_PROGRAM_ID,
    )
    ;[holderPda] = pda(
      [Buffer.from('holder'), curvePda.toBuffer(), payer.publicKey.toBuffer()],
      PROGRAM_IDS.velocity_curve,
    )
    const sig = await velocity.methods
      .buy(buyLamports, new BN(0))
      .accountsStrict({
        curve: curvePda,
        vault: curveVaultPda,
        mint: curve.mint,
        buyerAta,
        holder: holderPda,
        treasury: payer.publicKey,
        buyer: payer.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .rpc()
    buySig = sig
    const after = await velocity.account.velocityToken.fetch(curvePda)
    const holder = await velocity.account.holderPosition.fetch(holderPda)
    ok(
      'buy',
      `sig=${sig} explorer=${EXPLORER(sig)} supply=${after.currentSupply.toString()} holder_bal=${holder.balance.toString()}`,
    )
  } catch (e) {
    fail('buy', e)
  }

  // sell half
  let sellSig = null
  try {
    const curve = await velocity.account.velocityToken.fetch(curvePda)
    const holder = await velocity.account.holderPosition.fetch(holderPda)
    const sellAmt = new BN(holder.balance.toString()).div(new BN(2))
    if (sellAmt.lten(0)) {
      ok('sell', 'skipped (zero balance)')
    } else {
      const sellerAta = getAssociatedTokenAddressSync(
        curve.mint,
        payer.publicKey,
        false,
        TOKEN_PROGRAM_ID,
      )
      const sig = await velocity.methods
        .sell(sellAmt, new BN(0))
        .accountsStrict({
          curve: curvePda,
          vault: curveVaultPda,
          mint: curve.mint,
          sellerAta,
          holder: holderPda,
          treasury: payer.publicKey,
          seller: payer.publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc()
      sellSig = sig
      ok('sell', `sig=${sig} explorer=${EXPLORER(sig)} sold=${sellAmt.toString()}`)
    }
  } catch (e) {
    results.push({ step: 'sell', status: 'FAIL', detail: e.message || String(e) })
    console.error(`FAIL  sell — ${e.message || e}`)
    if (e.logs) console.error('Logs:\n' + e.logs.join('\n'))
  }

  bal = await connection.getBalance(payer.publicKey)
  console.log('\n=== SUMMARY ===')
  for (const r of results) {
    console.log(`${r.status.padEnd(4)} ${r.step}: ${r.detail || ''}`)
  }
  const out = {
    rpc: RPC,
    wallet: payer.publicKey.toBase58(),
    remainingSol: bal / LAMPORTS_PER_SOL,
    story: STORY.toBase58(),
    curve: curvePda.toBase58(),
    mint: mintPubkey ? mintPubkey.toBase58() : null,
    txs: {
      graduate: graduateSig ? { sig: graduateSig, explorer: EXPLORER(graduateSig) } : null,
      buy: buySig ? { sig: buySig, explorer: EXPLORER(buySig) } : null,
      sell: sellSig ? { sig: sellSig, explorer: EXPLORER(sellSig) } : null,
    },
    results,
  }
  console.log('\n' + JSON.stringify(out, null, 2))

  const critical = results.filter((r) => r.status === 'FAIL' && r.step !== 'sell')
  if (critical.length) process.exit(1)
  console.log('\nSmoke graduate→buy→sell PASSED')
}

main().catch((e) => {
  console.error('\nFatal:', e)
  process.exit(1)
})
