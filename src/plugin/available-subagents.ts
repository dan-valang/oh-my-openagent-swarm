import type { AvailableSubagent } from "../tools/delegate-task/types"
import { parseRegisteredAgentSummaries } from "../agents/custom-agent-summaries"
import { BUILTIN_SUBAGENT_DESCRIPTIONS } from "../tools/delegate-task/constants"
import { truncateDescription } from "../shared/truncate-description"

/**
 * Creates the list of available subagents for dynamic tool description generation.
 *
 * Filters out disabled agents and preserves alphabetical ordering.
 *
 * @param disabledAgents - Array of agent names to exclude (case-insensitive)
 * @returns Array of available subagents with descriptions
 */
export function createAvailableSubagents(
  disabledAgents: string[] = [],
): AvailableSubagent[] {
  const disabledSet = new Set(disabledAgents.map((a) => a.toLowerCase()))

  return Object.entries(BUILTIN_SUBAGENT_DESCRIPTIONS)
    .filter(([name]) => !disabledSet.has(name.toLowerCase()))
    .map(([name, description]) => ({
      name,
      description,
    }))
}

export function createAvailableSubagentsWithDynamic(
  registeredAgentSummaries: unknown,
  disabledAgents: string[] = [],
): AvailableSubagent[] {
  const builtins = createAvailableSubagents(disabledAgents)
  const builtinNameSet = new Set(builtins.map((agent) => agent.name.toLowerCase()))
  const disabledSet = new Set(disabledAgents.map((agent) => agent.toLowerCase()))

  const dedupedDynamicAgents = new Map<string, AvailableSubagent>()

  const dynamicAgents = parseRegisteredAgentSummaries(registeredAgentSummaries)
    .filter((agent) => !builtinNameSet.has(agent.name.toLowerCase()))
    .map((agent) => {
      const description = truncateDescription(agent.description).trim()
      return {
        name: agent.name,
        description: description || `Custom agent: ${agent.name}`,
      }
    })

  for (const agent of dynamicAgents) {
    const key = agent.name.toLowerCase()
    if (!dedupedDynamicAgents.has(key)) {
      dedupedDynamicAgents.set(key, agent)
    }
  }

  return [...builtins, ...dedupedDynamicAgents.values()].filter(
    (agent) => !disabledSet.has(agent.name.toLowerCase()),
  )
}
