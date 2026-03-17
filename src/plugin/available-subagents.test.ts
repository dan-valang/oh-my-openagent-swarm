declare const require: (name: string) => any
const { describe, test, expect } = require("bun:test")
import { createAvailableSubagents, createAvailableSubagentsWithDynamic } from "./available-subagents"
import { BUILTIN_SUBAGENT_DESCRIPTIONS } from "../tools/delegate-task/constants"

describe("createAvailableSubagents", () => {
  test("returns all builtin subagents when no disabled agents", () => {
    //#given / #when
    const result = createAvailableSubagents([])

    //#then
    const expectedNames = Object.keys(BUILTIN_SUBAGENT_DESCRIPTIONS).sort()
    expect(result.map((s) => s.name)).toEqual(expectedNames)
    for (const subagent of result) {
      expect(subagent.description).toBe(BUILTIN_SUBAGENT_DESCRIPTIONS[subagent.name])
    }
  })

  test("returns all builtin subagents when disabledAgents is undefined", () => {
    //#given / #when
    const result = createAvailableSubagents(undefined as unknown as string[])

    //#then
    const expectedNames = Object.keys(BUILTIN_SUBAGENT_DESCRIPTIONS).sort()
    expect(result.map((s) => s.name)).toEqual(expectedNames)
  })

  test("filters out disabled agents (exact match)", () => {
    //#given
    const disabled = ["explore", "oracle"]

    //#when
    const result = createAvailableSubagents(disabled)

    //#then
    const names = result.map((s) => s.name)
    expect(names).not.toContain("explore")
    expect(names).not.toContain("oracle")
    expect(names).toContain("librarian")
    expect(names).toContain("metis")
  })

  test("filters out disabled agents (case-insensitive)", () => {
    //#given
    const disabled = ["EXPLORE", "Oracle", "MULTIMODAL-LOOKER"]

    //#when
    const result = createAvailableSubagents(disabled)

    //#then
    const names = result.map((s) => s.name)
    expect(names).not.toContain("explore")
    expect(names).not.toContain("oracle")
    expect(names).not.toContain("multimodal-looker")
    expect(names).toContain("librarian")
    expect(names).toContain("hephaestus")
  })

  test("returns empty array when all agents disabled", () => {
    //#given
    const allAgents = Object.keys(BUILTIN_SUBAGENT_DESCRIPTIONS)

    //#when
    const result = createAvailableSubagents(allAgents)

    //#then
    expect(result).toEqual([])
  })

  test("preserves alphabetical ordering", () => {
    //#given / #when
    const result = createAvailableSubagents([])

    //#then
    const names = result.map((s) => s.name)
    const sortedNames = [...names].sort((a, b) => a.localeCompare(b))
    expect(names).toEqual(sortedNames)
  })

  test("each subagent has non-empty description", () => {
    //#given / #when
    const result = createAvailableSubagents([])

    //#then
    for (const subagent of result) {
      expect(subagent.description).toBeDefined()
      expect(subagent.description.length).toBeGreaterThan(0)
    }
  })
})

describe("createAvailableSubagentsWithDynamic", () => {
  test("returns builtins when custom summaries are empty", () => {
    //#given / #when
    const result = createAvailableSubagentsWithDynamic([], [])

    //#then
    const expectedNames = Object.keys(BUILTIN_SUBAGENT_DESCRIPTIONS).sort()
    expect(result.map((s) => s.name)).toEqual(expectedNames)
  })

  test("merges custom agents with builtins", () => {
    //#given
    const summaries = [
      { name: "workflow-navigator", description: "Workflow helper" },
      { name: "frontend-developer", description: "Frontend specialist" },
    ]

    //#when
    const result = createAvailableSubagentsWithDynamic(summaries, [])

    //#then
    const builtinNames = Object.keys(BUILTIN_SUBAGENT_DESCRIPTIONS)
    const names = result.map((s) => s.name)
    expect(names).toContain("explore")
    expect(names).toContain("workflow-navigator")
    expect(names).toContain("frontend-developer")
    expect(names).toHaveLength(builtinNames.length + 2)
  })

  test("builtins take priority over custom agents with same name", () => {
    //#given
    const summaries = [{ name: "explore", description: "Custom explore desc" }]

    //#when
    const result = createAvailableSubagentsWithDynamic(summaries, [])

    //#then
    const explore = result.find((s) => s.name === "explore")
    expect(explore?.description).toBe(BUILTIN_SUBAGENT_DESCRIPTIONS.explore)
  })

  test("filters out disabled agents from custom discovery", () => {
    //#given
    const summaries = [{ name: "custom-agent", description: "Custom agent" }]
    const disabled = ["custom-agent"]

    //#when
    const result = createAvailableSubagentsWithDynamic(summaries, disabled)

    //#then
    const names = result.map((s) => s.name)
    expect(names).not.toContain("custom-agent")
    expect(names).toContain("explore")
  })

  test("filters out disabled builtins from result", () => {
    //#given
    const disabled = ["explore"]

    //#when
    const result = createAvailableSubagentsWithDynamic([], disabled)

    //#then
    const names = result.map((s) => s.name)
    expect(names).not.toContain("explore")
    expect(names).toContain("oracle")
  })

  test("uses fallback description when custom agent has no description", () => {
    //#given
    const summaries = [{ name: "undescribed-agent", description: "" }]

    //#when
    const result = createAvailableSubagentsWithDynamic(summaries, [])

    //#then
    const agent = result.find((s) => s.name === "undescribed-agent")
    expect(agent?.description).toBe("Custom agent: undescribed-agent")
  })

  test("uses truncated description for custom agents", () => {
    //#given
    const longDescription = "a".repeat(500)
    const summaries = [{ name: "long-desc-agent", description: longDescription }]

    //#when
    const result = createAvailableSubagentsWithDynamic(summaries, [])

    //#then
    const agent = result.find((s) => s.name === "long-desc-agent")
    expect(agent?.description.length).toBeLessThan(longDescription.length)
  })

  test("filters hidden, disabled, and explicitly disabled-by-enabled-flag agents", () => {
    //#given
    const summaries = [
      { name: "visible-agent", description: "Visible" },
      { name: "hidden-agent", description: "Hidden", hidden: true },
      { name: "disabled-agent", description: "Disabled", disabled: true },
      { name: "enabled-false-agent", description: "Enabled false", enabled: false },
    ]

    //#when
    const result = createAvailableSubagentsWithDynamic(summaries, [])

    //#then
    const names = result.map((s) => s.name)
    expect(names).toContain("visible-agent")
    expect(names).not.toContain("hidden-agent")
    expect(names).not.toContain("disabled-agent")
    expect(names).not.toContain("enabled-false-agent")
  })

  test("deduplicates custom agent names case-insensitively", () => {
    //#given
    const summaries = [
      { name: "workflow-navigator", description: "First" },
      { name: "Workflow-Navigator", description: "Second" },
    ]

    //#when
    const result = createAvailableSubagentsWithDynamic(summaries, [])

    //#then
    const workflowNavigatorEntries = result.filter(
      (agent) => agent.name.toLowerCase() === "workflow-navigator",
    )
    expect(workflowNavigatorEntries).toHaveLength(1)
    expect(workflowNavigatorEntries[0]?.description).toBe("First")
  })
})
