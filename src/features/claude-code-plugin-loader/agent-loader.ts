import { existsSync, readdirSync, readFileSync } from "fs"
import { basename, join } from "path"
import { parseFrontmatter } from "../../shared/frontmatter"
import { isMarkdownFile } from "../../shared/file-utils"
import { log } from "../../shared/logger"
import type { AgentFrontmatter, ClaudeCodeAgentConfig } from "../claude-code-agent-loader/types"
import { mapClaudeModelToOpenCode } from "../claude-code-agent-loader/claude-model-mapper"
import type { LoadedPlugin } from "./types"

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
  const tools = toolsValue.split(",").map((tool) => tool.trim()).filter(Boolean)
  if (tools.length === 0) return undefined

  const result: Record<string, boolean> = {}
  for (const tool of tools) {
    result[tool.toLowerCase()] = true
  }
  return result
}

export function loadPluginAgents(plugins: LoadedPlugin[]): Record<string, ClaudeCodeAgentConfig> {
  const agents: Record<string, ClaudeCodeAgentConfig> = {}

  for (const plugin of plugins) {
    if (!plugin.agentsDir || !existsSync(plugin.agentsDir)) continue

    const entries = readdirSync(plugin.agentsDir, { withFileTypes: true })

    for (const entry of entries) {
      if (!isMarkdownFile(entry)) continue

      const agentPath = join(plugin.agentsDir, entry.name)
      const agentName = basename(entry.name, ".md")
      const namespacedName = `${plugin.name}:${agentName}`

      try {
        const content = readFileSync(agentPath, "utf-8")
        const { data, body } = parseFrontmatter<AgentFrontmatter>(content)

        const originalDescription = data.description || ""
        const formattedDescription = `(plugin: ${plugin.name}) ${originalDescription}`

        const mappedModelOverride = mapClaudeModelToOpenCode(data.model)
        const modelString = mappedModelOverride
          ? `${mappedModelOverride.providerID}/${mappedModelOverride.modelID}`
          : undefined

        const config: ClaudeCodeAgentConfig = {
          description: formattedDescription,
          mode: "subagent",
          prompt: body.trim(),
          ...(modelString ? { model: modelString } : {}),
        }

        const toolsConfig = parseToolsConfig(data.tools)
        if (toolsConfig) {
          config.tools = toolsConfig
        }

        agents[namespacedName] = config
        log(`Loaded plugin agent: ${namespacedName}`, { path: agentPath })
      } catch (error) {
        log(`Failed to load plugin agent: ${agentPath}`, error)
      }
    }
  }

  return agents
}
