// One-off diagnostic: decompress a persisted child session log and summarize its
// final-turn events to determine whether structured_output was ever attempted.
//
// Superseded by tools/shadow-debug.mjs (trace/find/runs/health); kept as the
// minimal reference for the frame-by-frame zstd decode approach.
import { readFileSync } from 'node:fs'
import { zstdDecompressSync } from 'node:zlib'

const path = process.argv[2]
if (path === undefined) {
  console.error('usage: node decode-child-session.mjs <session.jsonl.zstd>')
  process.exit(2)
}

const raw = readFileSync(path)
let text
try {
  text = zstdDecompressSync(raw).toString('utf8')
} catch (error) {
  console.error('whole-buffer decompress failed:', error.message)
  console.error('trying frame-by-frame decode...')
  const chunks = []
  let offset = 0
  // 0x28 0xB5 0x2F 0xFD little-endian zstd frame magic
  const MAGIC = [0x28, 0xB5, 0x2F, 0xFD]
  while (offset < raw.length) {
    const idx = raw.indexOf(Buffer.from(MAGIC), offset)
    if (idx < 0) break
    const next = raw.indexOf(Buffer.from(MAGIC), idx + 4)
    const end = next < 0 ? raw.length : next
    chunks.push(zstdDecompressSync(raw.subarray(idx, end)).toString('utf8'))
    offset = end
  }
  text = chunks.join('')
}

const lines = text.split('\n').filter(line => line.trim() !== '')
const events = lines.map((line) => {
  try { return JSON.parse(line) } catch { return { type: 'unparsed', raw: line.slice(0, 200) } }
})

console.log(`total events: ${events.length}`)

// Count event types
const counts = new Map()
for (const event of events) {
  const type = event.type ?? '?'
  counts.set(type, (counts.get(type) ?? 0) + 1)
}
console.log('event type counts:')
for (const [type, count] of [...counts.entries()].sort()) console.log(`  ${type}: ${count}`)

// Find tool calls
const toolCalls = events.filter(event => event.type?.includes('tools/'))
console.log(`\ntool-call related events: ${toolCalls.length}`)
for (const event of toolCalls) {
  const args = event.arguments ?? event.args
  console.log(`  ${event.type} name=${event.name ?? '?'} error=${event.error ?? ''}`)
}

// Find structured_output references anywhere
const structured = events.filter(event => JSON.stringify(event).includes('structured_output'))
console.log(`\nevents mentioning structured_output: ${structured.length}`)
for (const event of structured) {
  console.log(`  ${event.type} ${event.name ?? ''}`)
}

// Print the last 25 events compactly
console.log('\nlast 25 events:')
for (const event of events.slice(-25)) {
  const summary = { ...event }
  if (summary.content !== undefined) {
    const content = summary.content
    summary.content = typeof content === 'string'
      ? content.slice(0, 300)
      : JSON.stringify(content).slice(0, 300)
  }
  console.log(JSON.stringify(summary).slice(0, 600))
}
