import { existsSync, readdirSync, readFileSync, type Dirent } from "fs"
import { join, basename } from "path"
import { parseFrontmatter } from "../../shared/frontmatter"
import { isMarkdownFile } from "../../shared/file-utils"
import { getClaudeConfigDir, getOpenCodeConfigDir } from "../../shared"
import { log } from "../../shared/logger"
import type { AgentScope, AgentFrontmatter, ClaudeCodeAgentConfig, LoadedAgent } from "./types"
import { mapClaudeModelToOpenCode } from "./claude-model-mapper"

/**
 * Resolve a model string to an OpenCode-native `provider/model` format.
 *
 * OpenCode-native IDs (containing "/") are passed through directly.
 * Bare Claude aliases ("sonnet", "opus", "haiku") and bare claude-* strings
 * are resolved via mapClaudeModelToOpenCode.
 */
function resolveModel(model: string | undefined): string | undefined {
  if (!model) return undefined
  const trimmed = model.trim()
  if (trimmed.length === 0) return undefined
  // Already a provider/model string — use as-is
  if (trimmed.includes("/")) return trimmed
  // Bare alias ("sonnet", "claude-opus-4-6", etc.) — use legacy mapper
  const mapped = mapClaudeModelToOpenCode(trimmed)
  return mapped ? `${mapped.providerID}/${mapped.modelID}` : undefined
}

function parseToolsConfig(toolsValue?: string | Record<string, boolean>): Record<string, boolean> | undefined {
  if (!toolsValue) return undefined

  // YAML object form: `tools:\n  read: true\n  write: true`
  if (typeof toolsValue === "object") {
    const result: Record<string, boolean> = {}
    for (const [key, value] of Object.entries(toolsValue)) {
      result[key.toLowerCase()] = Boolean(value)
    }
    return Object.keys(result).length > 0 ? result : undefined
  }

  // String form: `tools: "read,write,edit"`
  const tools = toolsValue.split(",").map((t) => t.trim()).filter(Boolean)
  if (tools.length === 0) return undefined

  const result: Record<string, boolean> = {}
  for (const tool of tools) {
    result[tool.toLowerCase()] = true
  }
  return result
}

function loadAgentsFromDir(agentsDir: string, scope: AgentScope): LoadedAgent[] {
  if (!existsSync(agentsDir)) {
    return []
  }

  let entries: Dirent[]
  try {
    entries = readdirSync(agentsDir, { withFileTypes: true })
  } catch (error) {
    log(`Failed to read agent directory: ${agentsDir}`, error)
    return []
  }

  const agents: LoadedAgent[] = []

  for (const entry of entries) {
    if (!isMarkdownFile(entry)) continue

    const agentPath = join(agentsDir, entry.name)
    const agentName = basename(entry.name, ".md")

    try {
      const content = readFileSync(agentPath, "utf-8")
      const { data, body } = parseFrontmatter<AgentFrontmatter>(content)

       const name = data.name || agentName
       const originalDescription = data.description || ""

       const formattedDescription = `(${scope}) ${originalDescription}`

       const modelString = resolveModel(data.model)

       const config: ClaudeCodeAgentConfig = {
         description: formattedDescription,
         // Only set mode if explicitly specified — let OpenCode decide the default
         // otherwise every agent without a mode field gets forced to "subagent"
         ...(data.mode ? { mode: data.mode } : {}),
         prompt: body.trim(),
         ...(modelString ? { model: modelString } : {}),
       }

       const toolsConfig = parseToolsConfig(data.tools)
       if (toolsConfig) {
         config.tools = toolsConfig
       }

       if (data.permission) {
         config.permission = data.permission as ClaudeCodeAgentConfig["permission"]
       }

       if (data.temperature !== undefined) {
         config.temperature = data.temperature
       }

       const fallbackModels = data.fallback_models
       if (Array.isArray(fallbackModels) && fallbackModels.length > 0) {
         config.fallback_models = fallbackModels
       }

      agents.push({
        name,
        path: agentPath,
        config,
        scope,
      })
    } catch (error) {
      log(`Failed to parse agent: ${agentPath}`, error)
      continue
    }
  }

  log(`Loaded ${agents.length} agent(s) from ${scope} directory`, { path: agentsDir })

  return agents
}

export function loadUserAgents(): Record<string, ClaudeCodeAgentConfig> {
  return {
    ...loadClaudeUserAgents(),
    ...loadOpenCodeUserAgents(),
  }
}

export function loadClaudeUserAgents(): Record<string, ClaudeCodeAgentConfig> {
  const claudeAgentsDir = join(getClaudeConfigDir(), "agents")
  const claudeAgents = loadAgentsFromDir(claudeAgentsDir, "user")

  const result: Record<string, ClaudeCodeAgentConfig> = {}
  for (const agent of claudeAgents) {
    result[agent.name] = agent.config
  }

  log("Loaded Claude user agents", {
    claudeAgentsDir,
    count: claudeAgents.length,
  })

  return result
}

export function loadOpenCodeUserAgents(): Record<string, ClaudeCodeAgentConfig> {
  const opencodeAgentsDir = join(getOpenCodeConfigDir({ binary: "opencode" }), "agents")
  const opencodeAgents = loadAgentsFromDir(opencodeAgentsDir, "user")

  const result: Record<string, ClaudeCodeAgentConfig> = {}
  for (const agent of opencodeAgents) {
    result[agent.name] = agent.config
  }

  log("Loaded OpenCode user agents", {
    opencodeAgentsDir,
    count: opencodeAgents.length,
  })

  return result
}

export function loadProjectAgents(directory?: string): Record<string, ClaudeCodeAgentConfig> {
  const projectAgentsDir = join(directory ?? process.cwd(), ".claude", "agents")
  const agents = loadAgentsFromDir(projectAgentsDir, "project")

  const result: Record<string, ClaudeCodeAgentConfig> = {}
  for (const agent of agents) {
    result[agent.name] = agent.config
  }

  log("Loaded project agents", {
    projectAgentsDir,
    count: agents.length,
  })

  return result
}
