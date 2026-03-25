import type { AgentConfig } from "@opencode-ai/sdk"

export type AgentScope = "user" | "project"

export type ClaudeCodeAgentConfig = Omit<AgentConfig, "model"> & {
  model?: string | { providerID: string; modelID: string }
  /** Fallback model chain (plugin-only, not in OpenCode AgentConfig) */
  fallback_models?: string[]
}

export interface AgentFrontmatter {
  name?: string
  description?: string
  model?: string
  /** YAML object form: `tools:\n  read: true` or comma-string: `"read,write"` */
  tools?: string | Record<string, boolean>
  mode?: "subagent" | "primary" | "all"
  /** OpenCode PermissionConfig — passed through as-is */
  permission?: Record<string, unknown>
  temperature?: number
  /** Fallback model chain (plugin extension, not in OpenCode AgentConfig) */
  fallback_models?: string[]
  /** Skills to surface in agent awareness (plugin extension) */
  skill?: string[]
  /** Alias for skill[] */
  skills?: string[]
}

export interface LoadedAgent {
  name: string
  path: string
  config: ClaudeCodeAgentConfig
  scope: AgentScope
}
