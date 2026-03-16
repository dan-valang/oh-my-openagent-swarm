declare const require: (name: string) => any
const { describe, test, expect } = require("bun:test")
import { createAvailableSubagents } from "./available-subagents"
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
