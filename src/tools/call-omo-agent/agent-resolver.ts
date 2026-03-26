import type { PluginInput } from "@opencode-ai/plugin"
import { ALLOWED_AGENTS } from "./constants"
import { normalizeSDKResponse } from "../../shared"
import { log } from "../../shared/logger"

type AgentInfo = {
  name: string
  mode?: "subagent" | "primary" | "all"
}

export async function resolveCallableAgents(
  client: PluginInput["client"],
): Promise<string[]> {
  try {
    const agentsResult = await client.app.agents()
    const agents = normalizeSDKResponse(agentsResult, [] as AgentInfo[], {
      preferResponseOnMissingData: true,
    })

    const dynamicAgents = agents
      .filter((a) => a.mode !== "primary")
      .map((a) => a.name.toLowerCase())

    const merged = new Set([...ALLOWED_AGENTS, ...dynamicAgents])
    return [...merged]
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log(
      "[call_omo_agent] Failed to resolve dynamic agents, falling back to built-in list",
      { error: message },
    )
    return [...ALLOWED_AGENTS]
  }
}
