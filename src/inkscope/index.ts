// InkScope import library: speedscope's profile parsers and call-tree model,
// without its UI. Built by `npm run build:inkscope` into
// dist/inkscope/speedscope-import.js as the browser global SpeedscopeImport,
// which the InkScope dashboard loads beside app.js to draw its A/B flame
// graph overlay from the raw profiles the CI results store serves.
//
// Two inputs are read, the two the store holds per run:
//   - callgrind output (valgrind/profile.out.<pid>), one call tree per event
//     field (Ir, Dr, Dw, I1mr, ...), so the caller can weigh the events as
//     it likes (InkScope combines nine of them into CEst);
//   - gperftools CPU profiles (gperftools/profile.pb.gz), pprof protobuf,
//     gzip or plain, one tree weighted in the profile's sample unit.
//
// The output is a plain tree, no class instances, so it crosses into any
// JavaScript without this bundle's types:
//   { n: name, f: file | undefined, s: self weight, t: total weight, c: children[] }
// taken from speedscope's grouped call tree (one child per frame under a
// parent, the left-heavy view's shape), which is the right shape for a
// flame graph that compares two runs: callgrind files carry no time order,
// and a pprof profile's samples are aggregated.

import {importFromCallgrind} from '../import/callgrind'
import {importAsPprofProfile} from '../import/pprof'
import {MaybeCompressedDataReader, TextProfileDataSource} from '../import/utils'
import {CallTreeNode, Profile} from '../lib/profile'

export interface Tree {
  n: string
  f?: string
  s: number
  t: number
  c: Tree[]
}

export interface EventTree {
  event: string
  unit: string
  tree: Tree
}

function toTree(node: CallTreeNode): Tree {
  const out: Tree = {
    n: node.frame.name,
    f: node.frame.file,
    s: node.getSelfWeight(),
    t: node.getTotalWeight(),
    c: [],
  }
  for (const child of node.children) out.c.push(toTree(child))
  return out
}

// treeOf: a profile's grouped call tree as a plain tree. The root is
// speedscope's synthetic root; its total is the profile's total weight.
export function treeOf(profile: Profile): Tree {
  const t = toTree(profile.getGroupedCalltreeRoot())
  t.n = '(root)'
  t.t = profile.getTotalWeight()
  return t
}

// importCallgrind: one tree per event field of a callgrind output file, in
// the file's `events:` order. The event name is the part of speedscope's
// profile name after " -- " (`<file> -- Ir`).
export async function importCallgrind(fileName: string, text: string): Promise<EventTree[]> {
  const source = new TextProfileDataSource(fileName, text)
  const group = await importFromCallgrind(await source.readAsText(), fileName)
  if (!group) throw new Error(fileName + ': not a callgrind profile')
  return group.profiles.map(p => {
    const name = p.getName()
    const sep = name.lastIndexOf(' -- ')
    return {
      event: sep === -1 ? name : name.slice(sep + 4),
      unit: String(p.getWeightUnit()),
      tree: treeOf(p),
    }
  })
}

// importPprof: a gperftools / pprof profile (gzip or plain protobuf) as one
// tree, weighted in the profile's last sample type (CPU profiles:
// nanoseconds).
export async function importPprof(fileName: string, buffer: ArrayBuffer): Promise<EventTree> {
  const reader = MaybeCompressedDataReader.fromArrayBuffer(fileName, buffer)
  const profile = importAsPprofProfile(await reader.readAsArrayBuffer())
  if (!profile) throw new Error(fileName + ': not a pprof profile')
  return {event: 'cpu', unit: String(profile.getWeightUnit()), tree: treeOf(profile)}
}

export const version: string = require('../../package.json').version
