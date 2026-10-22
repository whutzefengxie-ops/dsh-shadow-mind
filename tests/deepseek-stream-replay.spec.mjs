// Replay the desktop incident through the exact pinned DSH source. This is a
// reconstructed SSE replay from durable argument deltas, not a raw wire capture.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseSse } from '../../deepseek-harness/packages/llm/llm-deepseek/src/sse.ts'
import { translate } from '../../deepseek-harness/packages/llm/llm-deepseek/src/translate.ts'
const fixture = JSON.parse(readFileSync(new URL('./fixtures/deepseek-dsml-leak.json', import.meta.url), 'utf8'))
async function replay(deltas) {
  const events = [
    { type: 'message_start', message: { usage: { input_tokens: 1, output_tokens: 0 } } },
    { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 'fixture-call', name: fixture.name, input: {} } },
    ...deltas.map(partial_json => ({ type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json } })),
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: 'tool_use' } },
    { type: 'message_stop' },
  ]
  const bytes = new TextEncoder().encode(events.map(e => 'event: ' + e.type + '\ndata: ' + JSON.stringify(e) + '\n\n').join(''))
  const body = new ReadableStream({ start(controller) {
    // Split every byte, including inside DSML/CJK characters and JSON escapes.
    for (const byte of bytes) controller.enqueue(Uint8Array.of(byte))
    controller.close()
  } })
  const chunks = []; let error
  try { for await (const chunk of translate(parseSse(body, () => {}), 'deepseek-flash')) chunks.push(chunk) } catch (caught) { error = caught }
  return { chunks, error }
}
describe('Desktop malformed tool argument replay', () => {
  it('retains all captured deltas exactly and correctly rejects the leaked DSML', async () => {
    const args = fixture.deltas.join('')
    expect(args).toContain('DSML')
    expect(() => JSON.parse(args)).toThrow()
    const { chunks, error } = await replay(fixture.deltas)
    expect(chunks.filter(c => c.type === 'tool-call-delta').map(c => c.argumentsDelta).join('')).toBe(args)
    expect(chunks.find(c => c.type === 'block-end').block.arguments).toBe(args)
    expect(error).toMatchObject({ code: 'MALFORMED_RESPONSE', message: 'DeepSeek Messages stream: tool input is invalid JSON' })
  })
  it('accepts valid JSON across identical SSE and UTF-8 splitting', async () => {
    const args = JSON.stringify({ status: 'report', verdict: 'confirm', content: '中文校验', refs: [21, 25] })
    const { chunks, error } = await replay(Array.from(args))
    expect(error).toBeUndefined()
    expect(chunks.find(c => c.type === 'block-end').block.arguments).toBe(args)
    expect(chunks.at(-1)).toMatchObject({ type: 'finish', reason: { kind: 'tool-calls' } })
  })
})
