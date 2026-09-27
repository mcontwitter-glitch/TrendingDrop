/**
 * NOTE: initialize_story enforces duration >= 3600 on-chain (product default).
 * For a fast local smoke, temporarily patch
 *   programs/narrative-auction/src/instructions/initialize_story.rs
 * to `duration >= 1`, rebuild+redeploy narrative_auction, run this script, then revert.
 *
 * Localnet E2E smoke: config → story → stake → graduate → buy → (sell) → reputation profile
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

const { AnchorProvider, Program, Wallet } = anchor

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const RPC = process.env.RPC_URL || 'http://127.0.0.1:8899'
const LAMPORTS_PER_SOL = 1_000_000_000

const PROGRAM_IDS = {
  narrative_auction: new PublicKey('75xWzXGb3A7UgpqDDL9ByVXpaZ8Zw4AF4i7whnVXyh8m'),
  velocity_curve: new PublicKey('5VbDjccBDNVCPLpSgxyuw7ptYekrcxH8FySBxaAXx6C'),
  lore_merge: new PublicKey('8pSr3X9iP66rvqMWT4S2gsEGtS8VnCLZtJayY9NB9ySy'),
  reputation_nft: new PublicKey('DrzQKZpvg8y7Gymp5yz2upX24v3fV7j7eFuqT31Nxgvd'),
}

function loadIdl(name) {
  const p = path.join(ROOT, 'target', 'idl', `${name}.json`)
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
  throw err
}

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms))
}

async function main() {
  console.log('=== TrendingDrop localnet smoke ===')
  console.log('RPC:', RPC)
  const connection = new Connection(RPC, 'confirmed')
  const version = await connection.getVersion()
  console.log('Cluster version:', version)

  const payer = loadWallet()
  console.log('Wallet:', payer.publicKey.toBase58())
  const bal = await connection.getBalance(payer.publicKey)
  console.log('Balance:', bal / LAMPORTS_PER_SOL, 'SOL')

  const wallet = new Wallet(payer)
  const provider = new AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
    preflightCommitment: 'confirmed',
  })

  const narrative = new Program(loadIdl('narrative_auction'), provider)
  const velocity = new Program(loadIdl('velocity_curve'), provider)
  const reputation = new Program(loadIdl('reputation_nft'), provider)

  const [configPda] = pda([Buffer.from('narrative-config')], PROGRAM_IDS.narrative_auction)
  const [oraclePda] = pda([Buffer.from('oracle-config')], PROGRAM_IDS.velocity_curve)
  const [rankingPda] = pda([Buffer.from('ranking-board')], PROGRAM_IDS.narrative_auction)
  const [profilePda] = pda(
    [Buffer.from('profile'), payer.publicKey.toBuffer()],
    PROGRAM_IDS.reputation_nft,
  )

  // 1. initialize NarrativeAuction config
  try {
    const existing = await connection.getAccountInfo(configPda)
    if (existing) {
      ok('initialize_config', `already exists ${configPda.toBase58()}`)
    } else {
      const sig = await narrative.methods
        .initializeConfig(null, null)
        .accountsStrict({
          config: configPda,
          authority: payer.publicKey,
          treasury: payer.publicKey,
          curveProgram: PROGRAM_IDS.velocity_curve,
          systemProgram: SystemProgram.programId,
        })
        .rpc()
      ok('initialize_config', sig)
    }
  } catch (e) {
    fail('initialize_config', e)
  }

  // 2. initialize oracle config (quorum 1 for local)
  try {
    const existing = await connection.getAccountInfo(oraclePda)
    if (existing) {
      ok('initialize_oracle_config', `already exists ${oraclePda.toBase58()}`)
    } else {
      const sig = await velocity.methods
        .initializeOracleConfig(new BN(1), [payer.publicKey], 1)
        .accountsStrict({
          oracleConfig: oraclePda,
          authority: payer.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc()
      ok('initialize_oracle_config', sig)
    }
  } catch (e) {
    fail('initialize_oracle_config', e)
  }

  // 3. initialize_story (short duration; program patched for local smoke)
  const contentHash = Buffer.alloc(32)
  contentHash.write('smoke-' + Date.now().toString(36))
  const [storyPda] = pda(
    [Buffer.from('story'), payer.publicKey.toBuffer(), contentHash],
    PROGRAM_IDS.narrative_auction,
  )
  const [vaultPda] = pda(
    [Buffer.from('story-vault'), storyPda.toBuffer()],
    PROGRAM_IDS.narrative_auction,
  )
  const duration = 5
  const thresholdLamports = new BN(50_000_000)

  try {
    const sig = await narrative.methods
      .initializeStory([...contentHash], new BN(duration), thresholdLamports)
      .accountsStrict({
        config: configPda,
        story: storyPda,
        creator: payer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc()
    ok('initialize_story', `${storyPda.toBase58()} sig=${sig}`)
  } catch (e) {
    fail('initialize_story', e)
  }

  // 4. stake
  const stakeAmount = new BN(100_000_000)
  const [stakePda] = pda(
    [Buffer.from('stake'), storyPda.toBuffer(), payer.publicKey.toBuffer()],
    PROGRAM_IDS.narrative_auction,
  )
  try {
    const sig = await narrative.methods
      .stakeOnNarrative(stakeAmount)
      .accountsStrict({
        config: configPda,
        story: storyPda,
        vault: vaultPda,
        stakePosition: stakePda,
        treasury: payer.publicKey,
        staker: payer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc()
    const story = await narrative.account.storyMarket.fetch(storyPda)
    ok(
      'stake_on_narrative',
      `sig=${sig} total_staked=${story.totalStaked.toString()} threshold=${story.graduationThreshold.toString()}`,
    )
  } catch (e) {
    fail('stake_on_narrative', e)
  }

  // 5. wait for auction end
  try {
    const story = await narrative.account.storyMarket.fetch(storyPda)
    const endsAt = Number(story.endsAt)
    console.log(`Waiting for ends_at=${endsAt} (duration=${duration}s)...`)
    for (;;) {
      const slot = await connection.getSlot('confirmed')
      const blockTime = await connection.getBlockTime(slot)
      const now = blockTime ?? Math.floor(Date.now() / 1000)
      if (now > endsAt) break
      process.stdout.write(`  clock=${now} ends_at=${endsAt} remaining=${endsAt - now}s\r`)
      await sleep(1000)
    }
    console.log('')
    ok('wait_auction_end', `ends_at=${endsAt}`)
  } catch (e) {
    fail('wait_auction_end', e)
  }

  // 6. graduate_narrative
  const mint = Keypair.generate()
  const [curvePda] = pda(
    [Buffer.from('curve'), storyPda.toBuffer()],
    PROGRAM_IDS.velocity_curve,
  )
  const [curveVaultPda] = pda(
    [Buffer.from('curve-vault'), curvePda.toBuffer()],
    PROGRAM_IDS.velocity_curve,
  )
  const tokenVault = getAssociatedTokenAddressSync(
    mint.publicKey,
    curvePda,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )

  try {
    const sig = await narrative.methods
      .graduateNarrative(1)
      .accountsStrict({
        config: configPda,
        story: storyPda,
        rankingBoard: rankingPda,
        vault: vaultPda,
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
    const story = await narrative.account.storyMarket.fetch(storyPda)
    const curve = await velocity.account.velocityToken.fetch(curvePda)
    ok(
      'graduate_narrative',
      `sig=${sig} phase=${JSON.stringify(story.phase)} curve=${curvePda.toBase58()} mint=${curve.mint.toBase58()}`,
    )
  } catch (e) {
    fail('graduate_narrative', e)
  }

  // 7. buy
  let holderPda
  try {
    const curve = await velocity.account.velocityToken.fetch(curvePda)
    const buyLamports = new BN(50_000_000)
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
    const after = await velocity.account.velocityToken.fetch(curvePda)
    const holder = await velocity.account.holderPosition.fetch(holderPda)
    ok(
      'buy',
      `sig=${sig} supply=${after.currentSupply.toString()} holder_bal=${holder.balance.toString()}`,
    )
  } catch (e) {
    fail('buy', e)
  }

  // 8. sell (optional)
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
      ok('sell', `sig=${sig} sold=${sellAmt.toString()}`)
    }
  } catch (e) {
    results.push({ step: 'sell', status: 'FAIL', detail: e.message || String(e) })
    console.error(`FAIL  sell (optional) — ${e.message || e}`)
  }

  // 9. initialize_profile
  try {
    const existing = await connection.getAccountInfo(profilePda)
    if (existing) {
      ok('initialize_profile', `already exists ${profilePda.toBase58()}`)
    } else {
      const sig = await reputation.methods
        .initializeProfile()
        .accountsStrict({
          profile: profilePda,
          owner: payer.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc()
      ok('initialize_profile', sig)
    }
  } catch (e) {
    fail('initialize_profile', e)
  }

  console.log('\n=== SUMMARY ===')
  for (const r of results) {
    console.log(`${r.status.padEnd(4)} ${r.step}: ${r.detail || ''}`)
  }
  const failed = results.filter((r) => r.status === 'FAIL')
  const critical = failed.filter((r) => r.step !== 'sell')
  if (critical.length) {
    console.error(`\nSmoke FAILED: ${critical.length} critical step(s)`)
    process.exit(1)
  }
  console.log('\nSmoke PASSED (critical path)')
  console.log(
    JSON.stringify(
      {
        rpc: RPC,
        wallet: payer.publicKey.toBase58(),
        programIds: Object.fromEntries(
          Object.entries(PROGRAM_IDS).map(([k, v]) => [k, v.toBase58()]),
        ),
        story: storyPda.toBase58(),
        curve: curvePda.toBase58(),
        mint: mint.publicKey.toBase58(),
      },
      null,
      2,
    ),
  )
}

main().catch((e) => {
  console.error('\nFatal:', e)
  process.exit(1)
})
