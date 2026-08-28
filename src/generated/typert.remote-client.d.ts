/* Generated Remote types adapted for this standalone package. */
import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type {
  ShadowAdministrationSnapshot,
  ShadowDefinition,
  ShadowDefinitionInput,
  ShadowMindStatus,
  ShadowModelCatalog,
  ShadowReviewCycle,
} from '../runtime/types.ts'

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteNamespace$736861646f774D696e64 {
    catalog: () => Promise<RemoteResult<ShadowAdministrationSnapshot>>
    modelCatalog: () => Promise<RemoteResult<ShadowModelCatalog>>
    cycles: (agentId: SessionId) => Promise<RemoteResult<readonly ShadowReviewCycle[]>>
    saveDefault: (input: ShadowDefinitionInput) => Promise<RemoteResult<ShadowDefinition>>
    pause: (agentId: SessionId) => Promise<RemoteResult<ShadowMindStatus>>
    resume: (agentId: SessionId) => Promise<RemoteResult<ShadowMindStatus>>
    status: (agentId: SessionId) => Promise<RemoteResult<ShadowMindStatus>>
    retry: (agentId: SessionId, runId: string) => Promise<RemoteResult<ShadowMindStatus>>
    toggle: (agentId: SessionId) => Promise<RemoteResult<ShadowMindStatus>>
  }

  interface TypertRemoteMap {
    'shadowMind/catalog': () => Promise<RemoteResult<ShadowAdministrationSnapshot>>
    'shadowMind/modelCatalog': () => Promise<RemoteResult<ShadowModelCatalog>>
    'shadowMind/cycles': (agentId: SessionId) => Promise<RemoteResult<readonly ShadowReviewCycle[]>>
    'shadowMind/saveDefault': (input: ShadowDefinitionInput) => Promise<RemoteResult<ShadowDefinition>>
    'shadowMind/pause': (agentId: SessionId) => Promise<RemoteResult<ShadowMindStatus>>
    'shadowMind/resume': (agentId: SessionId) => Promise<RemoteResult<ShadowMindStatus>>
    'shadowMind/status': (agentId: SessionId) => Promise<RemoteResult<ShadowMindStatus>>
    'shadowMind/retry': (agentId: SessionId, runId: string) => Promise<RemoteResult<ShadowMindStatus>>
    'shadowMind/toggle': (agentId: SessionId) => Promise<RemoteResult<ShadowMindStatus>>
  }

  interface TypertRemoteNamespaceMap {
    shadowMind: TypertRemoteNamespace$736861646f774D696e64
  }

  interface TypertRemoteScopeMap {
    'agent:shadowMind/cycles': () => Promise<RemoteResult<readonly ShadowReviewCycle[]>>
    'agent:shadowMind/pause': () => Promise<RemoteResult<ShadowMindStatus>>
    'agent:shadowMind/resume': () => Promise<RemoteResult<ShadowMindStatus>>
    'agent:shadowMind/status': () => Promise<RemoteResult<ShadowMindStatus>>
    'agent:shadowMind/retry': (runId: string) => Promise<RemoteResult<ShadowMindStatus>>
    'agent:shadowMind/toggle': () => Promise<RemoteResult<ShadowMindStatus>>
  }
}

export declare const TYPERT_REMOTE: TypertRemoteContribution
export default TYPERT_REMOTE
