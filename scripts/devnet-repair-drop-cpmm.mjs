/**
 * Repair DROP curve → Pump.fun CPMM virtual reserves + replay seed buy.
 * Calls velocity_curve::repair_curve(0, 0) with Pump defaults.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from '@solana/web3.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const RPC = process.env.RPC_URL || 'https://api.devnet.solana.com'
const VC = new PublicKey('5VbDjccBDNVCPLpSgxyuw7ptYekrcxH8FySBxaAXx6C')
const CURVE = new PublicKey('57uLLUnfZuBJvEoAQULhQpH9D2MAgg1r43E884KAnD7H')
const STORY = new PublicKey('72bUVg9hmdygdxNBoqyVmyh2mFXhEprhGzaWQmucm4es')
const SOL_USD = Number(process.env.SOL_USD || 150)

function loadWallet() {
  const secret = JSON.parse(
    fs.readFileSync(path.join(process.env.HOME, '.config/solana/id.json'), 'utf8'),
  )
  return Keypair.fromSecretKey(Uint8Array.from(secret))
}

function ixDiscriminator(name) {
  const h = crypto.createHash('sha256').update(`global:${name}`).digest()
  return h.subarray(0, 8)
}

function parseCurve(data) {
  // After repair: disc(8) + mint(32)+story(32)+creator(32) + fields
  const u64 = (o) => Number(data.readBigUInt64LE(o))
  const pk = (o) => new PublicKey(data.subarray(o, o + 32)).toBase58()
  return {
    len: data.length,
    mint: pk(8),
    story: pk(40),
    creator: pk(72),
    virtualSol: u64(104),
    currentSupply: u64(112),
    currentPrice: u64(120),
    virtualToken: u64(144),
    realSol: u64(164),
    seedLiquidity: u64(212),
    realToken: data.length >= 231 ? u64(222) : 0,
    complete: data.length >= 231 ? data[230] !== 0 : false,
  }
}

async function main() {
  const connection = new Connection(RPC, 'confirmed')
  const wallet = loadWallet()
  console.log('Deployer', wallet.publicKey.toBase58())

  const before = await connection.getAccountInfo(CURVE)
  console.log('Before len', before?.data.length)
  if (before) console.log('Before', parseCurve(before.data))

  const data = Buffer.alloc(8 + 8 + 8)
  ixDiscriminator('repair_curve').copy(data, 0)
  data.writeBigUInt64LE(0n, 8) // virtual_sol = 0 → Pump default
  data.writeBigUInt64LE(0n, 16) // virtual_token = 0 → Pump default

  const ix = new TransactionInstruction({
    programId: VC,
    keys: [
      { pubkey: CURVE, isSigner: false, isWritable: true },
      { pubkey: STORY, isSigner: false, isWritable: false },
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  })

  const tx = new Transaction().add(ix)
  const sig = await sendAndConfirmTransaction(connection, tx, [wallet], {
    commitment: 'confirmed',
  })
  console.log('Repair tx', sig)
  console.log(`https://explorer.solana.com/tx/${sig}?cluster=devnet`)

  const after = await connection.getAccountInfo(CURVE)
  const c = parseCurve(after.data)
  console.log('After', c)
  const spot = c.currentPrice
  const fdvSol = spot // price lamports/whole × 1B / 1e9 ≈ spot
  console.log(`Spot ${spot} lamports/whole ≈ $${((spot * SOL_USD) / 1e9).toFixed(9)} / token`)
  console.log(`FDV ≈ ${fdvSol} SOL ≈ $${(fdvSol * SOL_USD).toLocaleString()} @ $${SOL_USD}/SOL`)
  console.log(
    `Virtual ${c.virtualSol / 1e9} SOL × ${c.virtualToken} tokens | real_sol ${c.realSol / 1e9} | real_token ${c.realToken} | supply ${c.currentSupply}`,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
