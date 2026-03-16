import type { AvailableSubagent } from "../tools/delegate-task/types"
import { BUILTIN_SUBAGENT_DESCRIPTIONS } from "../tools/delegate-task/constants"

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
