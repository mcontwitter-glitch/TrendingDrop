/**
 * Repair corrupted curve on existing graduated story, then buy → sell.
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
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js'
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token'
import BN from 'bn.js'
import crypto from 'node:crypto'

const { AnchorProvider, Program, Wallet } = anchor
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const RPC = 'https://api.devnet.solana.com'
const STORY = new PublicKey('9JnFcrBBJgNmgA3AkhGW7Wkai1WH5oeXHdEpKgSRVEzW')
const VC = new PublicKey('5VbDjccBDNVCPLpSgxyuw7ptYekrcxH8FySBxaAXx6C')
const EXPLORER = (sig) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`

function loadIdl(name) {
  const p = path.join(ROOT, 'src', 'idl', `${name}.json`)
  const idl = JSON.parse(fs.readFileSync(p, 'utf8'))
  idl.address = (name === 'velocity_curve' ? VC : new PublicKey('75xWzXGb3A7UgpqDDL9ByVXpaZ8Zw4AF4i7whnVXyh8m')).toBase58()
  return idl
}
function loadWallet() {
  const secret = JSON.parse(fs.readFileSync(path.join(process.env.HOME, '.config/solana/id.json')))
  return Keypair.fromSecretKey(Uint8Array.from(secret))
}
function pda(seeds, programId) {
  return PublicKey.findProgramAddressSync(seeds, programId)
}

const results = []
function ok(step, detail) {
  results.push({ step, status: 'PASS', detail })
  console.log(`PASS  ${step} — ${detail}`)
}
function fail(step, err) {
  results.push({ step, status: 'FAIL', detail: err?.message || String(err) })
  console.error(`FAIL  ${step} — ${err?.message || err}`)
  if (err?.logs) console.error(err.logs.join('\n'))
  throw err
}

async function main() {
  const connection = new Connection(RPC, 'confirmed')
  const payer = loadWallet()
  console.log('Wallet', payer.publicKey.toBase58())
  console.log('Balance', (await connection.getBalance(payer.publicKey)) / 1e9)

  const provider = new AnchorProvider(connection, new Wallet(payer), {
    commitment: 'confirmed',
    preflightCommitment: 'confirmed',
  })
  const velocity = new Program(loadIdl('velocity_curve'), provider)

  const [curvePda] = pda([Buffer.from('curve'), STORY.toBuffer()], VC)
  const [curveVaultPda] = pda([Buffer.from('curve-vault'), curvePda.toBuffer()], VC)
  console.log('curve', curvePda.toBase58())

  let curve = await velocity.account.velocityToken.fetch(curvePda)
  console.log('before repair storyId', curve.storyId.toBase58())
  console.log('before repair basePrice', curve.basePrice.toString(), 'curveK', curve.curveK.toString())
  console.log('mint', curve.mint.toBase58())

  // repair_curve(base_price=98000, curve_k=1000)
  const basePrice = 98000n
  const curveK = 1000n
  const disc = crypto.createHash('sha256').update('global:repair_curve').digest().subarray(0, 8)
  const data = Buffer.alloc(8 + 8 + 8)
  Buffer.from(disc).copy(data, 0)
  data.writeBigUInt64LE(basePrice, 8)
  data.writeBigUInt64LE(curveK, 16)

  const repairIx = new TransactionInstruction({
    programId: VC,
    keys: [
      { pubkey: curvePda, isSigner: false, isWritable: true },
      { pubkey: STORY, isSigner: false, isWritable: false },
      { pubkey: payer.publicKey, isSigner: true, isWritable: false },
    ],
    data,
  })

  try {
    const tx = new Transaction().add(repairIx)
    const sig = await provider.sendAndConfirm(tx, [], { commitment: 'confirmed' })
    curve = await velocity.account.velocityToken.fetch(curvePda)
    ok(
      'repair_curve',
      `sig=${sig} explorer=${EXPLORER(sig)} storyId=${curve.storyId.toBase58()} base=${curve.basePrice.toString()} k=${curve.curveK.toString()}`,
    )
  } catch (e) {
    fail('repair_curve', e)
  }

  // buy 0.05 SOL
  let holderPda
  let buySig
  try {
    const buyLamports = new BN(50_000_000)
    const buyerAta = getAssociatedTokenAddressSync(curve.mint, payer.publicKey, false, TOKEN_PROGRAM_ID)
    ;[holderPda] = pda([Buffer.from('holder'), curvePda.toBuffer(), payer.publicKey.toBuffer()], VC)
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
      `sig=${sig} explorer=${EXPLORER(sig)} supply=${after.currentSupply.toString()} holder=${holder.balance.toString()}`,
    )
  } catch (e) {
    fail('buy', e)
  }

  // sell half
  let sellSig
  try {
    const holder = await velocity.account.holderPosition.fetch(holderPda)
    const sellAmt = new BN(holder.balance.toString()).div(new BN(2))
    if (sellAmt.lten(0)) {
      ok('sell', 'skipped zero')
    } else {
      const sellerAta = getAssociatedTokenAddressSync(curve.mint, payer.publicKey, false, TOKEN_PROGRAM_ID)
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
    console.error('FAIL sell', e.message)
    if (e.logs) console.error(e.logs.join('\n'))
  }

  const bal = await connection.getBalance(payer.publicKey)
  const out = {
    graduate: {
      status: 'PASS',
      note: 'completed earlier this session',
      sig: '2k7X2BPfX2dwaNEeT77wMdxUZk2yQNb3bzDhjaUBnetz4ij53kYWQQGH2xeFTz4qcWAK3vkFAP3QjJqWXmnwXWN4',
      explorer: EXPLORER('2k7X2BPfX2dwaNEeT77wMdxUZk2yQNb3bzDhjaUBnetz4ij53kYWQQGH2xeFTz4qcWAK3vkFAP3QjJqWXmnwXWN4'),
    },
    story: STORY.toBase58(),
    curve: curvePda.toBase58(),
    mint: curve.mint.toBase58(),
    remainingSol: bal / 1e9,
    results,
    buySig: buySig ? { sig: buySig, explorer: EXPLORER(buySig) } : null,
    sellSig: sellSig ? { sig: sellSig, explorer: EXPLORER(sellSig) } : null,
  }
  console.log('\n=== SUMMARY ===')
  for (const r of results) console.log(r.status, r.step, r.detail)
  console.log(JSON.stringify(out, null, 2))
  if (results.some((r) => r.status === 'FAIL' && r.step !== 'sell')) process.exit(1)
}
main().catch((e) => { console.error(e); process.exit(1) })
