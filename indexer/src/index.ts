import { Connection } from '@solana/web3.js'
import { config } from './config.js'
import { IndexerDb } from './db.js'
import { createApi } from './api.js'
import { RpcPoller, subscribeProgramLogs } from './poller.js'
import { startGeyserScaffold } from './geyser.js'

async function main() {
  console.log('[indexer] starting', {
    rpc: config.rpcUrl,
    geyser: config.geyserEndpoint || '(none — poll mode)',
    db: config.databaseUrl,
    port: config.port,
  })

  const db = await IndexerDb.open(config.databaseUrl)
  const connection = new Connection(config.rpcUrl, 'confirmed')
  const poller = new RpcPoller(connection, db)
  const geyser = startGeyserScaffold()

  // Seed a few demo activity rows so the HTTP API is useful before first poll.
  if (db.listActivity(1).length === 0) {
    const now = Date.now()
    db.insertActivity({
      id: 'boot',
      type: 'new_story',
      message: 'Indexer online (RPC poll mode)',
      story_id: null,
      amount: null,
      signature: null,
      timestamp: now,
    })
  }

  poller.start()

  if (!config.dryRun) {
    try {
      subscribeProgramLogs(
        connection,
        db,
        config.programs.narrativeAuction,
        'NarrativeAuction',
      )
      subscribeProgramLogs(
        connection,
        db,
        config.programs.velocityCurve,
        'VelocityCurve',
      )
    } catch (err) {
      console.warn('[indexer] log subscribe skipped', err)
    }
  }

  const app = createApi(db)
  const server = app.listen(config.port, config.host, () => {
    console.log(`[indexer] HTTP http://${config.host}:${config.port}`)
    console.log('[indexer] GET /api/stories | /api/activity | /api/curves | /health')
  })

  if (config.dryRun) {
    console.log('[indexer] dry-run: single poll then exit in 8s')
    await poller.tick()
    setTimeout(() => {
      poller.stop()
      geyser?.stop()
      server.close()
      process.exit(0)
    }, 8_000)
  }

  const shutdown = () => {
    console.log('[indexer] shutting down')
    poller.stop()
    geyser?.stop()
    db.persist()
    server.close(() => process.exit(0))
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
