import {checkProfileSnapshot} from '../lib/test-utils'
import {importProfileGroupFromText} from './index'
import {CallTreeNode} from '../lib/profile'

test('importFromCallgrind', async () => {
  await checkProfileSnapshot('./sample/profiles/callgrind/callgrind.example.log')
})

test('importFromCallgrind name compression', async () => {
  await checkProfileSnapshot('./sample/profiles/callgrind/callgrind.name-compression.log')
})

test('importFromCallgrind multiple event types', async () => {
  await checkProfileSnapshot('./sample/profiles/callgrind/callgrind.multiple-event-types.log')
})

test('importFromCallgrind subposition compression', async () => {
  await checkProfileSnapshot('./sample/profiles/callgrind/callgrind.subposition-compression.log')
})

test('importFromCallgrind cfn reset', async () => {
  await checkProfileSnapshot('./sample/profiles/callgrind/callgrind.cfn-reset.log')
})

test('importFromCallgrind positions instr line', async () => {
  await checkProfileSnapshot('./sample/profiles/callgrind/callgrind.instr-line-positions.log')
})

test('importFromCallgrind positions instr', async () => {
  await checkProfileSnapshot('./sample/profiles/callgrind/callgrind.positions-instr.log')
})

test('importFromCallgrind instr line subposition compression', async () => {
  await checkProfileSnapshot('./sample/profiles/callgrind/callgrind.instr-line-subposition.log')
})

test('importFromCallgrind cyclic callgraph', async () => {
  await checkProfileSnapshot('./sample/profiles/callgrind/callgrind.cyclic-callgraph.log')
})

test('importFromCallgrind diamond callgraph', async () => {
  await checkProfileSnapshot('./sample/profiles/callgrind/callgrind.diamond.log')
})

test('importFromCallgrind past the full expansion node budget', async () => {
  // Root calls 300 light callers and then one heavy caller, and every caller
  // calls H, which heads a 500 deep chain. Expanding H under every caller
  // would build about 140k nodes, which is past the node budget. Early light
  // callers get H's subtree, late light callers show H as a leaf, and the
  // heavy caller still gets H's subtree because it carries half the profile.
  const lightCallers = 300
  const chainDepth = 500
  const chainCost = 1000
  const hTotal = chainCost * (chainDepth + 1)
  const lightCost = Math.floor(hTotal / 2 / lightCallers)
  const heavyCost = hTotal - lightCost * lightCallers

  const lines = ['# callgrind format', 'events: Ir', 'fl=file.c', 'fn=root', '1 0']
  for (let i = 0; i < lightCallers; i++) lines.push(`cfn=L${i}`, 'calls=1 1', `1 ${lightCost + 1}`)
  lines.push('cfn=HEAVY', 'calls=1 1', `1 ${heavyCost + 1}`, '')
  for (let i = 0; i < lightCallers; i++) {
    lines.push(`fn=L${i}`, '1 1', 'cfn=H', 'calls=1 1', `1 ${lightCost}`, '')
  }
  lines.push('fn=HEAVY', '1 1', 'cfn=H', 'calls=1 1', `1 ${heavyCost}`, '')
  lines.push('fn=H', `1 ${chainCost}`, 'cfn=T1', 'calls=1 1', `1 ${chainCost * chainDepth}`, '')
  for (let d = 1; d <= chainDepth; d++) {
    lines.push(`fn=T${d}`, `1 ${chainCost}`)
    if (d < chainDepth) {
      lines.push(`cfn=T${d + 1}`, 'calls=1 1', `1 ${chainCost * (chainDepth - d)}`)
    }
    lines.push('')
  }

  const profileGroup = await importProfileGroupFromText('callgrind.budget', lines.join('\n'))
  const profile = profileGroup!.profiles[0]
  expect(profile.getTotalWeight()).toBe(hTotal + lightCallers + 1)

  let nodes = 0
  const countNodes = (node: CallTreeNode) => {
    nodes++
    node.children.forEach(countNodes)
  }
  countNodes(profile.getAppendOrderCalltreeRoot())
  expect(nodes).toBeGreaterThan(100000)
  expect(nodes).toBeLessThan(110000)

  const callers = profile.getAppendOrderCalltreeRoot().children[0].children
  const hUnder = (name: string) => {
    const caller = callers.find(node => node.frame.name === name)!
    return caller.children.find(node => node.frame.name === 'H')!
  }
  expect(hUnder('L0').children.length).toBe(1)
  expect(hUnder(`L${lightCallers - 1}`).children.length).toBe(0)
  expect(hUnder('HEAVY').children.length).toBe(1)
})
