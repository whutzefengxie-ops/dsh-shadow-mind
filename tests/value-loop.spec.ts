import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CallId, createMessage } from '@deepseek-ai/dsh-llm'
import { Session, SessionId } from '@deepseek-ai/dsh-session'
import {
  classifyChallenge,
  classifyChallengeObservation,
  observeChallenge,
} from '../src/runtime/index.ts'
import type {
  ChallengeObservation,
  ShadowValueClassification,
} from '../src/runtime/index.ts'

interface Replay extends ChallengeObservation {
  readonly name: string
  readonly expected: ShadowValueClassification
}

describe('Shadow value-loop classifier', () => {
  it('classifies the pinned positive and negative replay corpus', async () => {
    const fixturePath = join(import.meta.dirname, 'fixtures', 'value-loop-replays.json')
    const replays = JSON.parse(await readFile(fixturePath, 'utf8')) as Replay[]
    expect(replays.filter(replay => replay.expected === 'challenge_adopted')).toHaveLength(10)
    expect(replays.filter(replay => replay.expected !== 'challenge_adopted')).toHaveLength(10)
    for (const replay of replays) {
      expect(classifyChallengeObservation(replay, 2), replay.name).toBe(replay.expected)
    }
  })

  it('keeps an unanswered challenge pending until its configured turn window closes', () => {
    expect(classifyChallengeObservation({
      responseText: 'No disposition yet.',
      challengedArtifacts: [],
      toolTargets: [],
      completedTurns: 1,
    }, 2)).toBeUndefined()
  })

  it('derives artifact overlap and response text from durable sequence anchors', () => {
    const session = Session.create(SessionId('value-loop-observation'))
    const referenced = session.append('tool/call', {
      turn: 1,
      step: 1,
      callId: CallId('original-read'),
      name: 'read',
      arguments: '{"path":"src/runtime.ts"}',
    })
    const relayedAtSeq = session.events.at(-1)!.seq
    session.append('tool/call', {
      turn: 2,
      step: 1,
      callId: CallId('follow-up-edit'),
      name: 'edit',
      arguments: '{"path":"src/runtime.ts"}',
    })
    session.append('assistant/message', {
      turn: 2,
      step: 1,
      message: createMessage({
        role: 'assistant',
        content: [
          { type: 'reasoning', text: 'Private analysis.' },
          { type: 'text', text: 'Applied the change.' },
        ],
        source: { kind: 'model', provider: 'mock', model: 'root' },
      }),
    }, { surfaceOp: 'append' })
    session.append('turn/end', { turn: 2, reason: { kind: 'completed' } })
    const challenge = {
      runId: 'run-1',
      shadowId: 'reviewer',
      relayedAtSeq,
      refs: [referenced.seq],
    }
    expect(observeChallenge(session.events, challenge)).toMatchObject({
      responseText: 'Applied the change.',
      challengedArtifacts: ['src/runtime.ts'],
      toolTargets: ['src/runtime.ts'],
      completedTurns: 1,
    })
    expect(classifyChallenge(session.events, challenge, 2)).toBe('challenge_adopted')
  })
})
