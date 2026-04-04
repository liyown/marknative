/**
 * Post-build: prepend shebang and set executable bit on dist/cli.js
 */
import { readFile, writeFile, chmod } from 'node:fs/promises'

const cliPath = new URL('../dist/cli.js', import.meta.url).pathname

const content = await readFile(cliPath, 'utf8')
if (!content.startsWith('#!')) {
  await writeFile(cliPath, '#!/usr/bin/env node\n' + content)
}
await chmod(cliPath, 0o755)
console.log('✓ dist/cli.js shebang + executable bit set')
