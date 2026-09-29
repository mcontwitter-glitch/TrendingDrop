/**
 * Repair DROP curve to product economics:
 *   LAUNCH_BASE_PRICE = 27  → empty-curve FDV ~$4k at $150/SOL
 *   DEFAULT_CURVE_K = 365, PRICE_SCALE = 1e9
 *   current_supply = tokens_out(seed SOL) ≈ 20% of 1B → spot ~100 → FDV ~$15k
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
const LAUNCH_BASE_PRICE = 27n
const DEFAULT_CURVE_K = 365n
const PRICE_SCALE = 1_000_000_000n
const SOL_USD = Number(process.env.SOL_USD || 150)
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

function isqrt(n) {
  if (n === 0n) return 0n
  let x = n
  let y = (x + 1n) / 2n
  while (y < x) {
    x = y
    y = (x + n / x) / 2n
  }
  return x
}

function tokensOutForSol(solNet, supply, basePrice, effectiveK) {
  const sol = solNet
  const base = basePrice
  const k = effectiveK
  const s = supply
  if (sol <= 0n || base <= 0n) return 0n
  if (k === 0n) return sol / base
  const b = base + (k * s) / PRICE_SCALE
  const twoScale = PRICE_SCALE * 2n
  const bTerm = b * twoScale
  const cTerm = sol * twoScale
  const disc = bTerm * bTerm + k * 4n * cTerm
  const root = isqrt(disc)
  const numer = root > bTerm ? root - bTerm : 0n
  const denom = k * 2n
  if (denom === 0n) return sol / base
  return numer / denom
}

function spotPrice(basePrice, effectiveK, supply) {
  return basePrice + (effectiveK * supply) / PRICE_SCALE
}

function snap(c) {
  const base = BigInt(c.basePrice.toString())
  const cur = BigInt(c.currentPrice.toString())
  const seed = BigInt(c.seedLiquidity.toString())
  const supply = BigInt(c.currentSupply.toString())
  const reserve = BigInt(c.solReserve.toString())
  const k = BigInt(c.curveK.toString())
  return {
    storyId: c.storyId.toBase58(),
    mint: c.mint.toBase58(),
    creator: c.creator.toBase58(),
    basePrice: base.toString(),
    currentPrice: cur.toString(),
    currentSupply: supply.toString(),
    curveK: k.toString(),
    seedSol: Number(seed) / 1e9,
    reserveSol: Number(reserve) / 1e9,
    fdvSol: Number(cur),
    fdvUsd: Number(cur) * SOL_USD,
    spotUsd: (Number(cur) / 1e9) * SOL_USD,
    supplyPctOf1B: Number(supply) / 1e9 * 100,
  }
}

async function main() {
  const connection = new Connection(RPC, 'confirmed')
  const payer = loadWallet()
  console.log('Wallet', payer.publicKey.toBase58())
  console.log('Balance', (await connection.getBalance(payer.publicKey)) / 1e9, 'SOL')
  console.log('SOL_USD assumption', SOL_USD)

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
  const reserve = BigInt(curve.solReserve.toString())
  const buySol = reserve > 0n ? reserve : seed
  const targetSupply = tokensOutForSol(buySol, 0n, LAUNCH_BASE_PRICE, DEFAULT_CURVE_K)
  const targetSpot = spotPrice(LAUNCH_BASE_PRICE, DEFAULT_CURVE_K, targetSupply)

  console.log('\nRepair targets:')
  console.log({
    basePrice: LAUNCH_BASE_PRICE.toString(),
    curveK: DEFAULT_CURVE_K.toString(),
    currentSupply: targetSupply.toString(),
    expectedSpot: targetSpot.toString(),
    expectedFdvUsd: Number(targetSpot) * SOL_USD,
    expectedSpotUsd: (Number(targetSpot) / 1e9) * SOL_USD,
    supplyPct: Number(targetSupply) / 1e9 * 100,
  })

  const ixs = []

  const needParams =
    BigInt(curve.basePrice.toString()) !== LAUNCH_BASE_PRICE ||
    BigInt(curve.curveK.toString()) !== DEFAULT_CURVE_K
  if (needParams) {
    const disc = crypto.createHash('sha256').update('global:repair_curve').digest().subarray(0, 8)
    const data = Buffer.alloc(8 + 8 + 8)
    Buffer.from(disc).copy(data, 0)
    data.writeBigUInt64LE(LAUNCH_BASE_PRICE, 8)
    data.writeBigUInt64LE(DEFAULT_CURVE_K, 16)
    ixs.push(
      new TransactionInstruction({
        programId: VC,
        keys: [
          { pubkey: CURVE, isSigner: false, isWritable: true },
          { pubkey: STORY, isSigner: false, isWritable: false },
          { pubkey: payer.publicKey, isSigner: true, isWritable: false },
        ],
        data,
      }),
    )
  }

  const needSupply = BigInt(curve.currentSupply.toString()) !== targetSupply
  if (needSupply) {
    const disc = crypto.createHash('sha256').update('global:repair_curve_supply').digest().subarray(0, 8)
    const data = Buffer.alloc(8 + 8)
    Buffer.from(disc).copy(data, 0)
    data.writeBigUInt64LE(targetSupply, 8)
    ixs.push(
      new TransactionInstruction({
        programId: VC,
        keys: [
          { pubkey: CURVE, isSigner: false, isWritable: true },
          { pubkey: STORY, isSigner: false, isWritable: false },
          { pubkey: payer.publicKey, isSigner: true, isWritable: false },
        ],
        data,
      }),
    )
  }

  if (ixs.length === 0) {
    console.log('SKIP already at target economics')
    console.log(JSON.stringify({ status: 'SKIP', before, after: before }, null, 2))
    return
  }

  const tx = new Transaction().add(...ixs)
  const sig = await provider.sendAndConfirm(tx, [], { commitment: 'confirmed' })
  curve = await velocity.account.velocityToken.fetch(CURVE)
  const after = snap(curve)
  console.log('\n=== AFTER DROP ===')
  console.log(after)
  console.log('sig', sig, EXPLORER(sig))
  console.log(
    JSON.stringify(
      {
        status: 'REPAIRED',
        basePrice: LAUNCH_BASE_PRICE.toString(),
        curveK: DEFAULT_CURVE_K.toString(),
        currentSupply: targetSupply.toString(),
        sig,
        explorer: EXPLORER(sig),
        before,
        after,
      },
      null,
      2,
    ),
  )
}

main().catch((e) => {
  console.error(e)
  if (e.logs) console.error(e.logs.join('\n'))
  process.exit(1)
})
