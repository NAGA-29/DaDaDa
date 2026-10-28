// E2E 用のローカル D1 を作り直し、migration とシードを当てる
import { execFileSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '../..')
const persistDir = process.env.DADADA_PERSIST_DIR ?? '.wrangler/e2e-state'

if (!existsSync(join(root, 'wrangler.jsonc'))) {
  console.error('wrangler.jsonc がありません。wrangler.sample.jsonc をコピーしてください')
  process.exit(1)
}

rmSync(join(root, persistDir), { recursive: true, force: true })

const wrangler = (...args) =>
  execFileSync('pnpm', ['exec', 'wrangler', ...args, '--local', '--persist-to', persistDir], {
    cwd: root,
    stdio: ['ignore', 'ignore', 'inherit'],
    env: { ...process.env, CI: 'true' },
  })

wrangler('d1', 'migrations', 'apply', 'dadada')
wrangler('d1', 'execute', 'dadada', '--file', 'e2e/fixtures/seed.sql')
console.log(`[e2e] seeded local D1 at ${persistDir}`)
