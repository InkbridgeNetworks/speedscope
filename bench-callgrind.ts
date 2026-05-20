import * as fs from 'fs'
import * as path from 'path'
import {importFromCallgrind} from './src/import/callgrind'
import {StringBackedTextFileContent} from './src/import/utils'

async function main() {
  const args = process.argv.slice(2)
  if (args.length === 0 || args.includes('--help')) {
    console.log(
      [
        'Usage: npx tsx bench-callgrind.ts <file> [file ...]',
        '',
        'Measures callgrind import time and prints a summary per file.',
        '',
        'Examples:',
        '  npx tsx bench-callgrind.ts callgrind.out.19-11',
        '  npx tsx bench-callgrind.ts ~/profiles/callgrind.out.19-01 ~/profiles/callgrind.out.19-05',
      ].join('\n'),
    )
    process.exit(args.includes('--help') ? 0 : 1)
  }
  const files = args

  for (const f of files) {
    const contents = fs.readFileSync(f, 'utf-8')
    const label = path.basename(f)

    const t0 = performance.now()
    const content = new StringBackedTextFileContent(contents)
    const t1 = performance.now()
    const result = await importFromCallgrind(content, label)
    const t2 = performance.now()

    console.log(`\n${label}:`)
    console.log(`  content creation: ${(t1 - t0).toFixed(1)}ms`)
    console.log(`  parse+build:      ${(t2 - t1).toFixed(1)}ms`)
    console.log(`  total:            ${(t2 - t0).toFixed(1)}ms`)
    if (result) {
      console.log(`  profiles: ${result.profiles.length}`)
      result.profiles.forEach((p, i) => console.log(`    [${i}] ${p.getName()}`))
    }
  }
}

main().catch(console.error)
