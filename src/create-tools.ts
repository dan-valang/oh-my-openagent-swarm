import type { AvailableCategory, AvailableSkill } from "./agents/dynamic-agent-prompt-builder"
import type { OhMyOpenCodeConfig } from "./config"
import type { BrowserAutomationProvider } from "./config/schema/browser-automation"
import type { LoadedSkill } from "./features/opencode-skill-loader/types"
import type { PluginContext, ToolsRecord } from "./plugin/types"
import type { Managers } from "./create-managers"
import type { AvailableSubagent } from "./tools/delegate-task/types"

import {
  loadClaudeUserAgents,
  loadOpenCodeUserAgents,
  loadProjectAgents,
} from "./features/claude-code-agent-loader"
import { createAvailableCategories } from "./plugin/available-categories"
import { createAvailableSubagentsWithDynamic } from "./plugin/available-subagents"
import { createProtectedAgentNameSet, normalizeProtectedAgentName } from "./plugin-handlers/agent-override-protection"
import { loadPluginComponents } from "./plugin-handlers/plugin-components-loader"
import { createSkillContext } from "./plugin/skill-context"
import { createToolRegistry } from "./plugin/tool-registry"

type AgentSummary = {
  name: string
  mode?: "subagent" | "primary" | "all"
  description?: string
  hidden?: boolean
  disabled?: boolean
  enabled?: boolean
}

function parseAgentMode(value: unknown): AgentSummary["mode"] {
  if (value === "subagent" || value === "primary" || value === "all") {
    return value
  }
  return undefined
}

const BUILTIN_AND_RESERVED_AGENT_NAMES = [
  "atlas",
  "build",
  "explore",
  "hephaestus",
  "librarian",
  "metis",
  "momus",
  "multimodal-looker",
  "oracle",
  "plan",
  "prometheus",
  "sisyphus",
  "sisyphus-junior",
] as const

export async function buildStartupSafeCustomAgentSummaries(args: {
  pluginConfig: OhMyOpenCodeConfig
  directory: string
}): Promise<AgentSummary[]> {
  const { pluginConfig, directory } = args

  const includeClaudeAgents = pluginConfig.claude_code?.agents ?? true
  const claudeUserAgents = includeClaudeAgents ? loadClaudeUserAgents() : {}
  const opencodeUserAgents = loadOpenCodeUserAgents()
  const projectAgents = includeClaudeAgents ? loadProjectAgents(directory) : {}
  const pluginComponents = await loadPluginComponents({ pluginConfig })
  const protectedAgentNames = createProtectedAgentNameSet(BUILTIN_AND_RESERVED_AGENT_NAMES)

  return [
    ...Object.entries(claudeUserAgents),
    ...Object.entries(opencodeUserAgents),
    ...Object.entries(projectAgents),
    ...Object.entries(pluginComponents.agents),
  ]
    .filter(([, config]) => config != null)
    .filter(([name]) => !protectedAgentNames.has(normalizeProtectedAgentName(name)))
    .map(([name, config]) => {
      const record = config as Record<string, unknown>
      const mode = parseAgentMode(record.mode)
      return {
        name,
        mode,
        description: typeof record.description === "string" ? record.description : "",
        hidden: record.hidden === true,
        disabled: record.disabled === true,
        enabled: record.enabled === false ? false : true,
      }
    })
    .filter((agent) => agent.mode !== "primary")
}

export type CreateToolsResult = {
  filteredTools: ToolsRecord
  mergedSkills: LoadedSkill[]
  availableSkills: AvailableSkill[]
  availableCategories: AvailableCategory[]
  availableSubagents: AvailableSubagent[]
  browserProvider: BrowserAutomationProvider
  disabledSkills: Set<string>
  taskSystemEnabled: boolean
}

export async function createTools(args: {
  ctx: PluginContext
  pluginConfig: OhMyOpenCodeConfig
  managers: Pick<Managers, "backgroundManager" | "tmuxSessionManager" | "skillMcpManager">
}): Promise<CreateToolsResult> {
  const { ctx, pluginConfig, managers } = args

  const skillContext = await createSkillContext({
    directory: ctx.directory,
    pluginConfig,
  })

  const availableCategories = createAvailableCategories(pluginConfig)
  const customAgentSummaries = await buildStartupSafeCustomAgentSummaries({
    pluginConfig,
    directory: ctx.directory,
  })
  const availableSubagents = createAvailableSubagentsWithDynamic(
    customAgentSummaries,
    pluginConfig.disabled_agents,
  )

  const { filteredTools, taskSystemEnabled } = createToolRegistry({
    ctx,
    pluginConfig,
    managers,
    skillContext,
    availableCategories,
    availableSubagents,
  })

  return {
    filteredTools,
    mergedSkills: skillContext.mergedSkills,
    availableSkills: skillContext.availableSkills,
    availableCategories,
    availableSubagents,
    browserProvider: skillContext.browserProvider,
    disabledSkills: skillContext.disabledSkills,
    taskSystemEnabled,
  }
}
