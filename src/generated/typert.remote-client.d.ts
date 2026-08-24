/* Generated Remote types adapted for this standalone package. */
import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type {
  ShadowAdministrationSnapshot,
  ShadowDefinition,
  ShadowDefinitionInput,
  ShadowMindStatus,
} from '../runtime/types.ts'

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteNamespace$736861646f774D696e64 {
    catalog: () => Promise<RemoteResult<ShadowAdministrationSnapshot>>
    create: (input: ShadowDefinitionInput) => Promise<RemoteResult<ShadowDefinition>>
    delete: (id: string) => Promise<RemoteResult<void>>
    pause: (agentId: SessionId) => Promise<RemoteResult<ShadowMindStatus>>
    resume: (agentId: SessionId) => Promise<RemoteResult<ShadowMindStatus>>
    setEnabled: (id: string, enabled: boolean) => Promise<RemoteResult<ShadowDefinition>>
    status: (agentId: SessionId) => Promise<RemoteResult<ShadowMindStatus>>
    toggle: (agentId: SessionId) => Promise<RemoteResult<ShadowMindStatus>>
    update: (input: ShadowDefinitionInput) => Promise<RemoteResult<ShadowDefinition>>
  }

  interface TypertRemoteMap {
    'shadowMind/catalog': () => Promise<RemoteResult<ShadowAdministrationSnapshot>>
    'shadowMind/create': (input: ShadowDefinitionInput) => Promise<RemoteResult<ShadowDefinition>>
    'shadowMind/delete': (id: string) => Promise<RemoteResult<void>>
    'shadowMind/pause': (agentId: SessionId) => Promise<RemoteResult<ShadowMindStatus>>
    'shadowMind/resume': (agentId: SessionId) => Promise<RemoteResult<ShadowMindStatus>>
    'shadowMind/setEnabled': (id: string, enabled: boolean) => Promise<RemoteResult<ShadowDefinition>>
    'shadowMind/status': (agentId: SessionId) => Promise<RemoteResult<ShadowMindStatus>>
    'shadowMind/toggle': (agentId: SessionId) => Promise<RemoteResult<ShadowMindStatus>>
    'shadowMind/update': (input: ShadowDefinitionInput) => Promise<RemoteResult<ShadowDefinition>>
  }

  interface TypertRemoteNamespaceMap {
    shadowMind: TypertRemoteNamespace$736861646f774D696e64
  }

  interface TypertRemoteScopeMap {
    'agent:shadowMind/pause': () => Promise<RemoteResult<ShadowMindStatus>>
    'agent:shadowMind/resume': () => Promise<RemoteResult<ShadowMindStatus>>
    'agent:shadowMind/status': () => Promise<RemoteResult<ShadowMindStatus>>
    'agent:shadowMind/toggle': () => Promise<RemoteResult<ShadowMindStatus>>
  }
}

export declare const TYPERT_REMOTE: TypertRemoteContribution
export default TYPERT_REMOTE
