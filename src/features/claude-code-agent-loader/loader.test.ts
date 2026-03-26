const { afterEach, beforeEach, describe, expect, mock, test } = require("bun:test")
export {}

import { mkdirSync, rmSync, writeFileSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"

const TEST_DIR = join(tmpdir(), `claude-code-agent-loader-${Date.now()}`)
const CLAUDE_DIR = join(TEST_DIR, ".claude")
const OPENCODE_DIR = join(TEST_DIR, ".config", "opencode")

function writeAgentFile(baseDir: string, name: string, description: string): void {
  mkdirSync(join(baseDir, "agents"), { recursive: true })
  writeFileSync(
    join(baseDir, "agents", `${name}.md`),
    `---\ndescription: ${description}\n---\nPrompt for ${name}.\n`,
  )
}

describe("loadUserAgents", () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true })
    mock.module("../../shared", () => ({
      getClaudeConfigDir: () => CLAUDE_DIR,
      getOpenCodeConfigDir: () => OPENCODE_DIR,
    }))
  })

  afterEach(() => {
    mock.restore()
    rmSync(TEST_DIR, { recursive: true, force: true })
  })

  test("merges agents from Claude and OpenCode user directories", async () => {
    writeAgentFile(CLAUDE_DIR, "researcher", "Claude researcher")
    writeAgentFile(OPENCODE_DIR, "workflow-navigator", "OpenCode workflow")

    const { loadUserAgents } = await import("./loader")

    expect(loadUserAgents()).toEqual({
      researcher: {
        description: "(user) Claude researcher",
        prompt: "Prompt for researcher.",
      },
      "workflow-navigator": {
        description: "(user) OpenCode workflow",
        prompt: "Prompt for workflow-navigator.",
      },
    })
  })

  test("prefers OpenCode agents when both directories define the same agent", async () => {
    writeAgentFile(CLAUDE_DIR, "qa-engineer", "Claude QA")
    writeAgentFile(OPENCODE_DIR, "qa-engineer", "OpenCode QA")

    const { loadUserAgents } = await import("./loader")
    const result = loadUserAgents()

    expect(result["qa-engineer"]).toEqual({
      description: "(user) OpenCode QA",
      prompt: "Prompt for qa-engineer.",
    })
  })

  test("preserves explicit mode from frontmatter", async () => {
    mkdirSync(join(OPENCODE_DIR, "agents"), { recursive: true })
    writeFileSync(
      join(OPENCODE_DIR, "agents", "architect.md"),
      "---\ndescription: Architecture specialist\nmode: all\n---\nPrompt for architect.\n",
    )

    const { loadUserAgents } = await import("./loader")
    const result = loadUserAgents()

    expect(result.architect).toEqual({
      description: "(user) Architecture specialist",
      mode: "all",
      prompt: "Prompt for architect.",
    })
  })
})
