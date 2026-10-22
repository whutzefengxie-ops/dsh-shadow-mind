// @vitest-environment jsdom
// Exercise the pinned Harness source assembler and grouping together. The JS
// boundary avoids merging its source-only Chat types into the plugin's shipped
// declarations, while the normal Host/Client typecheck covers plugin code.
import { describe, expect, it } from 'vitest'
import { ConversationNodeAssembler } from '@deepseek-ai/dsh-client-ui-conversation/src/client/conversation/assembler.ts'
import { assistantDefinition } from '@deepseek-ai/dsh-client-ui-chat/src/client/conversation-nodes/assistant.ts'
import { messageDefinition } from '@deepseek-ai/dsh-client-ui-chat/src/client/conversation-nodes/message.ts'
import { turnProcessDefinition } from '@deepseek-ai/dsh-client-ui-chat/src/client/conversation-nodes/turn-process.ts'
import { turnTailDefinition } from '@deepseek-ai/dsh-client-ui-chat/src/client/conversation-nodes/turn-tail.ts'
import { processGroupDefinition } from '@deepseek-ai/dsh-client-ui-chat/src/client/conversation-nodes/process-groups.ts'
import { chatViewDefinition } from '@deepseek-ai/dsh-client-ui-chat/src/client/conversation-nodes/chat-snapshot-builder.ts'
import { shadowReviewDefinition, shadowRelayMarkerDefinition } from '../src/client/shadow-report-conversation.ts'

function entry(seq, type, data, surfaceOp) {
  return { type: 'event', event: { seq, time: seq * 1000, type, data, ...surfaceOp === undefined ? {} : { surfaceOp } } }
}

const entries = [
  entry(1, 'turn/start', { turn: 1 }),
  entry(2, 'user/message', { id: 'input', role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'Read check.txt.' }] }, 'append'),
  entry(3, 'step/start', { turn: 1, step: 1 }),
  entry(4, 'assistant/message', { turn: 1, step: 1, stream: [], message: { id: 'answer', role: 'assistant', source: { kind: 'model', provider: 'test', model: 'test' }, content: [{ type: 'text', text: 'SHADOW_DESKTOP_RC2_OK' }] } }, 'append'),
  entry(5, 'step/end', { turn: 1, step: 1 }),
  entry(6, 'turn/end', { turn: 1, reason: { kind: 'completed' } }),
  entry(7, 'turn/start', { turn: 2 }),
  entry(8, 'user/message', { id: 'relay', role: 'user', source: { kind: 'shadow-report', form: 'relay', reports: [{ shadowId: 'default', runId: 'review-run', childSessionId: 'child', capturedThroughSeq: 6 }] }, content: [{ type: 'text', text: 'Background Shadow reports follow.\n\n### Shadow (default)\nSHADOW_DESKTOP_REVIEW_OK' }] }, 'append'),
  entry(9, 'step/start', { turn: 2, step: 1 }),
  entry(10, 'assistant/message', { turn: 2, step: 1, stream: [], message: { id: 'ack', role: 'assistant', source: { kind: 'model', provider: 'test', model: 'test' }, content: [{ type: 'text', text: 'Received.' }] } }, 'append'),
  entry(11, 'step/end', { turn: 2, step: 1 }),
  entry(12, 'turn/end', { turn: 2, reason: { kind: 'completed' } }),
]

describe('Desktop conversation rendering on DSH rc.2', () => {
  it('retains the anchored report as a turn-level node when completed process rows fold', () => {
    const assembler = new ConversationNodeAssembler(
      { entries: () => [messageDefinition, assistantDefinition, turnProcessDefinition, turnTailDefinition, shadowReviewDefinition, shadowRelayMarkerDefinition], fallbackEntry: () => undefined },
      { entries: () => [chatViewDefinition] },
      { entries: () => [processGroupDefinition], forTarget: target => target === 'chat' ? processGroupDefinition : undefined },
    )
    assembler.replaceWindow(entries, false)
    assembler.activateTarget('chat')
    assembler.flush()
    const snapshot = assembler.snapshot('chat')
    const node = snapshot.nodes.values().find(node => node.kind === 'shadow-mind-review' && node.anchorSeq === 6)
    expect(assembler.grouped('chat')?.entries).toContainEqual({ kind: 'node', key: node?.key })
    const marker = snapshot.nodes.values().find(node => node.kind === 'shadow-mind-relay-marker')
    expect(assembler.grouped('chat')?.entries).toContainEqual({ kind: 'node', key: marker?.key })
    expect(node).toBeDefined()
    expect(node?.data).toMatchObject({ reports: [{ content: 'SHADOW_DESKTOP_REVIEW_OK' }] })
  })
})
