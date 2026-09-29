/**
 * Repair two Devnet curves corrupted by the TokenParams stack bug
 * (liquidity written into base_price / curve_k, and story_id last bytes clobbered).
 *
 * base_price = 27 (LAUNCH_BASE_PRICE, ~$4k FDV at $150/SOL)
 * curve_k    = 365 (DEFAULT_CURVE_K with PRICE_SCALE=1e9)
 * story_id   = recovered from create-tx account keys (PDA seed)
 *
 * Does NOT touch the already-repaired smoke curve (8Dx1VU…).
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
const RPC = 'https://api.devnet.solana.com'
const VC = new PublicKey('5VbDjccBDNVCPLpSgxyuw7ptYekrcxH8FySBxaAXx6C')
const EXPLORER = (sig) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`

/**
 * Corrupt curves only. `story` is the true PDA seed recovered from the
 * initialize/graduate create tx (on-chain story_id field is also corrupted).
 */
const TARGETS = [
  {
    curve: 'BnaF93UirZhNq9KsZGbYJnUhJ8n8CSRLzkEWy6tzfC8o',
    story: 'CCqxj8wtg3usp1RrMuA6gZVMoTf5x4R4BgX2VXPQ5Dbv',
  },
  {
    curve: 'GEe2SghQw7bstNW3up5t7DXi9JJA6bq3PLgFvFQhUxZP',
    story: '6EceTR1R16KZMGArFUiurz9zwrbWpa6aNKss7i39Lb4n',
  },
]

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
  return {
    storyId: c.storyId.toBase58(),
    creator: c.creator.toBase58(),
    basePrice: c.basePrice.toString(),
    currentPrice: c.currentPrice.toString(),
    currentSupply: c.currentSupply.toString(),
    curveK: c.curveK.toString(),
    solReserve: c.solReserve.toString(),
    seedLiquidity: c.seedLiquidity.toString(),
  }
}

async function repairOne(velocity, provider, payer, { curve: curvePk, story: storyPk }) {
  const curvePda = new PublicKey(curvePk)
  const storyId = new PublicKey(storyPk)

  // Sanity: story must be the PDA seed for this curve
  const [derived] = PublicKey.findProgramAddressSync(
    [Buffer.from('curve'), storyId.toBuffer()],
    VC,
  )
  if (derived.toBase58() !== curvePk) {
    throw new Error(`story ${storyPk} does not derive curve ${curvePk} (got ${derived.toBase58()})`)
  }

  let curve = await velocity.account.velocityToken.fetch(curvePda)
  const before = snap(curve)
  console.log('\n=== BEFORE', curvePk)
  console.log(before)
  console.log('true story seed', storyPk)

  const basePrice = 27n
  const curveK = 365n

  const currentBase = BigInt(curve.basePrice.toString())
  const currentK = BigInt(curve.curveK.toString())
  const storyOk = curve.storyId.toBase58() === storyPk
  // Healthy = product launch params.
  if (storyOk && currentK === curveK && currentBase === basePrice) {
    console.log('SKIP already looks healthy')
    return { curve: curvePk, status: 'SKIP', before, after: before }
  }

  const disc = crypto.createHash('sha256').update('global:repair_curve').digest().subarray(0, 8)
  const data = Buffer.alloc(8 + 8 + 8)
  Buffer.from(disc).copy(data, 0)
  data.writeBigUInt64LE(basePrice, 8)
  data.writeBigUInt64LE(curveK, 16)

  const repairIx = new TransactionInstruction({
    programId: VC,
    keys: [
      { pubkey: curvePda, isSigner: false, isWritable: true },
      { pubkey: storyId, isSigner: false, isWritable: false },
      { pubkey: payer.publicKey, isSigner: true, isWritable: false },
    ],
    data,
  })

  const tx = new Transaction().add(repairIx)
  const sig = await provider.sendAndConfirm(tx, [], { commitment: 'confirmed' })
  curve = await velocity.account.velocityToken.fetch(curvePda)
  const after = snap(curve)
  console.log('AFTER', after)
  console.log('sig', sig, EXPLORER(sig))
  return {
    curve: curvePk,
    story: storyPk,
    status: 'REPAIRED',
    basePrice: basePrice.toString(),
    curveK: curveK.toString(),
    sig,
    explorer: EXPLORER(sig),
    before,
    after,
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

  const results = []
  for (const t of TARGETS) {
    try {
      results.push(await repairOne(velocity, provider, payer, t))
    } catch (e) {
      console.error('FAIL', t.curve, e.message || e)
      if (e.logs) console.error(e.logs.join('\n'))
      results.push({ curve: t.curve, status: 'FAIL', error: e.message || String(e), logs: e.logs })
    }
  }

  const smoke = '8Dx1VUuyx4rysKwtsFV3k226jqsJS5EACKejvnnYyzkr'
  const smokeAcc = await velocity.account.velocityToken.fetch(new PublicKey(smoke))
  console.log('\n=== SMOKE (untouched)', smoke)
  console.log(snap(smokeAcc))

  console.log('\n=== SUMMARY ===')
  console.log(JSON.stringify(results, null, 2))
  if (results.some((r) => r.status === 'FAIL')) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
