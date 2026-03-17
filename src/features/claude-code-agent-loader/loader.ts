import { existsSync, readdirSync, readFileSync, type Dirent } from "fs"
import { join, basename } from "path"
import { parseFrontmatter } from "../../shared/frontmatter"
import { isMarkdownFile } from "../../shared/file-utils"
import { getClaudeConfigDir, getOpenCodeConfigDir } from "../../shared"
import { log } from "../../shared/logger"
import type { AgentScope, AgentFrontmatter, ClaudeCodeAgentConfig, LoadedAgent } from "./types"
import { mapClaudeModelToOpenCode } from "./claude-model-mapper"

function parseToolsConfig(toolsStr?: string): Record<string, boolean> | undefined {
  if (!toolsStr) return undefined

  const tools = toolsStr.split(",").map((t) => t.trim()).filter(Boolean)
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

       const mappedModelOverride = mapClaudeModelToOpenCode(data.model)
       const modelString = mappedModelOverride
         ? `${mappedModelOverride.providerID}/${mappedModelOverride.modelID}`
         : undefined

       const config: ClaudeCodeAgentConfig = {
         description: formattedDescription,
         mode: data.mode || "subagent",
         prompt: body.trim(),
         ...(modelString ? { model: modelString } : {}),
       }

       const toolsConfig = parseToolsConfig(data.tools)
      if (toolsConfig) {
        config.tools = toolsConfig
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
