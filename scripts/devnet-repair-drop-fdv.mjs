/**
 * Repair DROP curve base_price to liquidity-backed FDV scale.
 *
 * Before (legacy): base = seed/1000 → FDV ≈ seed_SOL × 1e6
 * After (correct): base = seed/1e9  → FDV ≈ seed_SOL (spot × 1B / 1e9)
 *
 * Keeps current_supply unchanged so k·s/PRICE_SCALE stays negligible at spot.
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
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js'

const { AnchorProvider, Program, Wallet } = anchor
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const RPC = process.env.RPC_URL || 'https://api.devnet.solana.com'
const VC = new PublicKey('5VbDjccBDNVCPLpSgxyuw7ptYekrcxH8FySBxaAXx6C')
const CURVE = new PublicKey('57uLLUnfZuBJvEoAQULhQpH9D2MAgg1r43E884KAnD7H')
const STORY = new PublicKey('72bUVg9hmdygdxNBoqyVmyh2mFXhEprhGzaWQmucm4es')
const TOTAL_SUPPLY_WHOLE = 1_000_000_000n
const EXPLORER = (sig) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`

function loadIdl() {
  const idl = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'idl', 'velocity_curve.json'), 'utf8'))
  idl.address = VC.toBase58()
  return idl
}

function loadWallet() {
  const secret = JSON.parse(fs.readFileSync(path.join(process.env.HOME, '.config/solana/id.json')))
  return Keypair.fromSecretKey(Uint8Array.from(secret))
}

function snap(c) {
  const base = BigInt(c.basePrice.toString())
  const cur = BigInt(c.currentPrice.toString())
  const seed = BigInt(c.seedLiquidity.toString())
  const supply = BigInt(c.currentSupply.toString())
  const reserve = BigInt(c.solReserve.toString())
  return {
    storyId: c.storyId.toBase58(),
    mint: c.mint.toBase58(),
    creator: c.creator.toBase58(),
    basePrice: base.toString(),
    currentPrice: cur.toString(),
    currentSupply: supply.toString(),
    curveK: c.curveK.toString(),
    seedSol: Number(seed) / 1e9,
    reserveSol: Number(reserve) / 1e9,
    // Launchpad FDV: price × 1B / 1e9 = price (numerically, SOL)
    fdvSol: Number(cur),
  }
}

async function main() {
  const connection = new Connection(RPC, 'confirmed')
  const payer = loadWallet()
  console.log('Wallet', payer.publicKey.toBase58())
  console.log('Balance', (await connection.getBalance(payer.publicKey)) / 1e9, 'SOL')

  const provider = new AnchorProvider(connection, new Wallet(payer), {
    commitment: 'confirmed',
    preflightCommitment: 'confirmed',
  })
  const velocity = new Program(loadIdl(), provider)

  let curve = await velocity.account.velocityToken.fetch(CURVE)
  const before = snap(curve)
  console.log('\n=== BEFORE DROP ===')
  console.log(before)

  if (curve.creator.toBase58() !== payer.publicKey.toBase58()) {
    throw new Error(`Wallet is not curve creator (need ${curve.creator.toBase58()})`)
  }
  if (curve.storyId.toBase58() !== STORY.toBase58()) {
    throw new Error(`Unexpected story_id ${curve.storyId.toBase58()}`)
  }

  const seed = BigInt(curve.seedLiquidity.toString())
  const basePrice = seed / TOTAL_SUPPLY_WHOLE < 1n ? 1n : seed / TOTAL_SUPPLY_WHOLE
  const curveK = 1000n
  console.log('\nRepair target base_price', basePrice.toString(), 'curve_k', curveK.toString())

  const currentBase = BigInt(curve.basePrice.toString())
  if (currentBase === basePrice && BigInt(curve.curveK.toString()) === curveK) {
    console.log('SKIP already at liquidity-backed scale')
    console.log(JSON.stringify({ status: 'SKIP', before, after: before }, null, 2))
    return
  }

  const disc = crypto.createHash('sha256').update('global:repair_curve').digest().subarray(0, 8)
  const data = Buffer.alloc(8 + 8 + 8)
  Buffer.from(disc).copy(data, 0)
  data.writeBigUInt64LE(basePrice, 8)
  data.writeBigUInt64LE(curveK, 16)

  const repairIx = new TransactionInstruction({
    programId: VC,
    keys: [
      { pubkey: CURVE, isSigner: false, isWritable: true },
      { pubkey: STORY, isSigner: false, isWritable: false },
      { pubkey: payer.publicKey, isSigner: true, isWritable: false },
    ],
    data,
  })

  const tx = new Transaction().add(repairIx)
  const sig = await provider.sendAndConfirm(tx, [], { commitment: 'confirmed' })
  curve = await velocity.account.velocityToken.fetch(CURVE)
  const after = snap(curve)
  console.log('\n=== AFTER DROP ===')
  console.log(after)
  console.log('sig', sig, EXPLORER(sig))
  console.log(JSON.stringify({ status: 'REPAIRED', basePrice: basePrice.toString(), sig, explorer: EXPLORER(sig), before, after }, null, 2))
}

main().catch((e) => {
  console.error(e)
  if (e.logs) console.error(e.logs.join('\n'))
  process.exit(1)
})
