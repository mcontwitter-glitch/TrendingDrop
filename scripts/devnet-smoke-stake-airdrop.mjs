/**
 * Devnet smoke: create → stake → wait → graduate → resolve → claim
 * Asserts staker ATA receives pro-rata share of 20% of 1B supply.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'
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
  getAccount,
} from '@solana/spl-token'
import BN from 'bn.js'

const { AnchorProvider, Program, Wallet } = anchor
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const RPC = process.env.RPC_URL || 'https://api.devnet.solana.com'
const NA = new PublicKey('75xWzXGb3A7UgpqDDL9ByVXpaZ8Zw4AF4i7whnVXyh8m')
const VC = new PublicKey('5VbDjccBDNVCPLpSgxyuw7ptYekrcxH8FySBxaAXx6C')
const LAMPORTS_PER_SOL = 1_000_000_000
const TOTAL_SUPPLY_RAW = 1_000_000_000n * 1_000_000n
const AIRDROP_BPS = 2000n
const DURATION = Number(process.env.SMOKE_DURATION || 70)
const STAKE_SOL = Number(process.env.SMOKE_STAKE_SOL || 0.05)
const THRESHOLD_SOL = Number(process.env.SMOKE_THRESHOLD_SOL || 0.04)

function loadWallet() {
  const secret = JSON.parse(fs.readFileSync(path.join(process.env.HOME, '.config/solana/id.json'), 'utf8'))
  return Keypair.fromSecretKey(Uint8Array.from(secret))
}

function loadIdl(name, address) {
  const idl = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/idl', `${name}.json`), 'utf8'))
  idl.address = address.toBase58()
  return idl
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function grindMint(suffix = 'drop', maxAttempts = 5_000_000) {
  for (let i = 0; i < maxAttempts; i++) {
    const kp = Keypair.generate()
    if (kp.publicKey.toBase58().toLowerCase().endsWith(suffix)) {
      console.log(`mint grind ok after ${i + 1} attempts: ${kp.publicKey.toBase58()}`)
      return kp
    }
    if (i > 0 && i % 100000 === 0) console.log(`  grinding… ${i}`)
  }
  throw new Error('vanity grind failed')
}

async function main() {
  const payer = loadWallet()
  const connection = new Connection(RPC, 'confirmed')
  const provider = new AnchorProvider(connection, new Wallet(payer), {
    commitment: 'confirmed',
    preflightCommitment: 'confirmed',
  })
  const narrative = new Program(loadIdl('narrative_auction', NA), provider)
  const velocity = new Program(loadIdl('velocity_curve', VC), provider)

  console.log('=== Stake airdrop smoke ===')
  console.log('payer', payer.publicKey.toBase58())
  console.log('balance', (await connection.getBalance(payer.publicKey)) / LAMPORTS_PER_SOL, 'SOL')

  const [configPda] = PublicKey.findProgramAddressSync([Buffer.from('narrative-config')], NA)
  const cfg = await narrative.account.narrativeConfig.fetch(configPda)
  console.log('stakerAirdropBps', cfg.stakerAirdropBps)

  // --- create story ---
  const contentHash = crypto.randomBytes(32)
  const [storyPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('story'), payer.publicKey.toBuffer(), contentHash],
    NA,
  )
  const threshold = new BN(Math.round(THRESHOLD_SOL * LAMPORTS_PER_SOL))
  const initSig = await narrative.methods
    .initializeStory([...contentHash], new BN(DURATION), threshold)
    .accountsStrict({
      config: configPda,
      story: storyPda,
      creator: payer.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc()
  console.log('PASS init story', storyPda.toBase58(), initSig)

  // --- stake ---
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('story-vault'), storyPda.toBuffer()],
    NA,
  )
  const [stakePda] = PublicKey.findProgramAddressSync(
    [Buffer.from('stake'), storyPda.toBuffer(), payer.publicKey.toBuffer()],
    NA,
  )
  const [userIndexPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('user-stakes'), payer.publicKey.toBuffer()],
    NA,
  )
  const stakeLamports = new BN(Math.round(STAKE_SOL * LAMPORTS_PER_SOL))
  const stakeSig = await narrative.methods
    .stakeOnNarrative(stakeLamports)
    .accountsStrict({
      config: configPda,
      story: storyPda,
      vault: vaultPda,
      stakePosition: stakePda,
      userStakeIndex: userIndexPda,
      treasury: cfg.treasury,
      staker: payer.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc()
  console.log('PASS stake', stakeSig)

  const storyAfterStake = await narrative.account.storyMarket.fetch(storyPda)
  const endsAt = Number(storyAfterStake.endsAt)
  const waitMs = Math.max(0, endsAt * 1000 - Date.now()) + 3000
  console.log(`waiting ${Math.ceil(waitMs / 1000)}s for auction end (endsAt=${endsAt})…`)
  await sleep(waitMs)

  // --- graduate ---
  const [rankingBoard] = PublicKey.findProgramAddressSync([Buffer.from('ranking-board')], NA)
  let freeRank = 1
  try {
    const board = await narrative.account.rankingBoard.fetch(rankingBoard)
    freeRank = board.ranks.findIndex((r) => r.equals(PublicKey.default)) + 1
    if (freeRank < 1) throw new Error('no free ranking slot (1–5 all taken)')
  } catch (e) {
    if (String(e.message || e).includes('no free')) throw e
    freeRank = 1 // board not init yet
  }
  console.log('using rank', freeRank)
  const mint = process.env.SMOKE_VANITY
    ? await grindMint('drop')
    : Keypair.generate()
  console.log('mint', mint.publicKey.toBase58())
  const [curvePda] = PublicKey.findProgramAddressSync(
    [Buffer.from('curve'), storyPda.toBuffer()],
    VC,
  )
  const [curveVault] = PublicKey.findProgramAddressSync(
    [Buffer.from('curve-vault'), curvePda.toBuffer()],
    VC,
  )
  const [stakeAirdrop] = PublicKey.findProgramAddressSync(
    [Buffer.from('stake-airdrop'), storyPda.toBuffer()],
    NA,
  )
  const tokenVault = getAssociatedTokenAddressSync(mint.publicKey, curvePda, true)
  const airdropTokenVault = getAssociatedTokenAddressSync(mint.publicKey, stakeAirdrop, true)

  const gradSig = await narrative.methods
    .graduateNarrative(freeRank)
    .accountsStrict({
      config: configPda,
      story: storyPda,
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
  console.log('PASS graduate', gradSig)
  console.log('mint', mint.publicKey.toBase58())

  const airdropAcc = await narrative.account.stakeAirdrop.fetch(stakeAirdrop)
  console.log('airdrop total_amount', airdropAcc.totalAmount.toString(), 'bps', airdropAcc.bps)
  const expectedPool = (TOTAL_SUPPLY_RAW * AIRDROP_BPS) / 10000n
  if (BigInt(airdropAcc.totalAmount.toString()) !== expectedPool) {
    throw new Error(`airdrop pool mismatch: got ${airdropAcc.totalAmount} expected ${expectedPool}`)
  }
  console.log('PASS airdrop pool == 20% of 1B raw')

  const vaultBal = await getAccount(connection, airdropTokenVault)
  console.log('airdrop vault balance', vaultBal.amount.toString())

  // --- resolve ---
  const resolveSig = await narrative.methods
    .resolveStakes()
    .accountsStrict({
      config: configPda,
      story: storyPda,
      stakePosition: stakePda,
      userStakeIndex: userIndexPda,
    })
    .rpc()
  console.log('PASS resolve', resolveSig)

  // --- claim ---
  const stakerAta = getAssociatedTokenAddressSync(mint.publicKey, payer.publicKey, false)
  const [airdropClaim] = PublicKey.findProgramAddressSync(
    [Buffer.from('airdrop-claim'), storyPda.toBuffer(), payer.publicKey.toBuffer()],
    NA,
  )
  const claimSig = await narrative.methods
    .claimStake()
    .accountsStrict({
      config: configPda,
      story: storyPda,
      vault: vaultPda,
      stakePosition: stakePda,
      userStakeIndex: userIndexPda,
      stakeAirdrop,
      airdropTokenVault,
      mint: mint.publicKey,
      stakerTokenAta: stakerAta,
      airdropClaim,
      staker: payer.publicKey,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    })
    .rpc()
  console.log('PASS claim', claimSig)

  const stakerTok = await getAccount(connection, stakerAta)
  console.log('staker ATA balance', stakerTok.amount.toString())
  // Sole staker → full pool
  if (stakerTok.amount !== vaultBal.amount && BigInt(stakerTok.amount.toString()) !== expectedPool) {
    // after claim vault drained into staker — compare to expected pool
  }
  if (BigInt(stakerTok.amount.toString()) !== expectedPool) {
    throw new Error(
      `staker token balance ${stakerTok.amount} != expected full pool ${expectedPool}`,
    )
  }
  console.log('PASS staker received full 20% airdrop (sole staker)')

  const out = {
    storyPda: storyPda.toBase58(),
    mint: mint.publicKey.toBase58(),
    curvePda: curvePda.toBase58(),
    stakeAirdrop: stakeAirdrop.toBase58(),
    initSig,
    stakeSig,
    gradSig,
    resolveSig,
    claimSig,
    stakerTokenBalance: stakerTok.amount.toString(),
    airdropPool: expectedPool.toString(),
  }
  fs.writeFileSync(path.join(ROOT, '.smoke-airdrop.json'), JSON.stringify(out, null, 2))
  console.log('=== ALL PASS ===')
  console.log(JSON.stringify(out, null, 2))
}

main().catch((e) => {
  console.error('SMOKE FAIL', e)
  if (e.logs) console.error(e.logs.join('\n'))
  process.exit(1)
})
