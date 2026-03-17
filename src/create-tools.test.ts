const { beforeEach, describe, expect, mock, test } = require("bun:test")
export {}

const loadClaudeUserAgentsMock = mock(() => ({}))
const loadOpenCodeUserAgentsMock = mock(() => ({}))
const loadProjectAgentsMock = mock(() => ({}))
const loadPluginComponentsMock = mock(async () => ({
  commands: {},
  skills: {},
  agents: {},
  mcpServers: {},
  hooksConfigs: [],
  plugins: [],
  errors: [],
}))

mock.module("./features/claude-code-agent-loader", () => ({
  loadClaudeUserAgents: loadClaudeUserAgentsMock,
  loadOpenCodeUserAgents: loadOpenCodeUserAgentsMock,
  loadProjectAgents: loadProjectAgentsMock,
}))

mock.module("./plugin-handlers/plugin-components-loader", () => ({
  loadPluginComponents: loadPluginComponentsMock,
}))

const { buildStartupSafeCustomAgentSummaries } = await import("./create-tools")

describe("buildStartupSafeCustomAgentSummaries", () => {
  beforeEach(() => {
    loadClaudeUserAgentsMock.mockReset()
    loadOpenCodeUserAgentsMock.mockReset()
    loadProjectAgentsMock.mockReset()
    loadPluginComponentsMock.mockReset()

    loadClaudeUserAgentsMock.mockReturnValue({})
    loadOpenCodeUserAgentsMock.mockReturnValue({})
    loadProjectAgentsMock.mockReturnValue({})
    loadPluginComponentsMock.mockResolvedValue({
      commands: {},
      skills: {},
      agents: {},
      mcpServers: {},
      hooksConfigs: [],
      plugins: [],
      errors: [],
    })
  })

  test("collects custom agents from user, project, and plugin sources", async () => {
    //#given
    loadClaudeUserAgentsMock.mockReturnValue({
      "workflow-navigator": { description: "User workflow agent", mode: "subagent" },
    })
    loadOpenCodeUserAgentsMock.mockReturnValue({
      reviewer: { description: "OpenCode reviewer agent", mode: "subagent" },
    })
    loadProjectAgentsMock.mockReturnValue({
      "frontend-developer": { description: "Project frontend agent", mode: "all" },
    })
    loadPluginComponentsMock.mockResolvedValue({
      commands: {},
      skills: {},
      agents: {
        "security-reviewer": { description: "Plugin security agent", mode: "subagent" },
      },
      mcpServers: {},
      hooksConfigs: [],
      plugins: [],
      errors: [],
    })

    //#when
    const result = await buildStartupSafeCustomAgentSummaries({
      pluginConfig: {},
      directory: "/tmp/project",
    })

    //#then
    expect(result).toEqual([
      { name: "workflow-navigator", mode: "subagent", description: "User workflow agent", hidden: false, disabled: false, enabled: true },
      { name: "reviewer", mode: "subagent", description: "OpenCode reviewer agent", hidden: false, disabled: false, enabled: true },
      { name: "frontend-developer", mode: "all", description: "Project frontend agent", hidden: false, disabled: false, enabled: true },
      { name: "security-reviewer", mode: "subagent", description: "Plugin security agent", hidden: false, disabled: false, enabled: true },
    ])
  })

  test("filters protected builtin names and primary agents", async () => {
    //#given
    loadClaudeUserAgentsMock.mockReturnValue({
      atlas: { description: "Should be hidden", mode: "subagent" },
      sisyphus: { description: "Should be hidden", mode: "subagent" },
      "workflow-navigator": { description: "Keep me", mode: "subagent" },
      "research-lead": { description: "Primary custom agent", mode: "primary" },
    })
    loadOpenCodeUserAgentsMock.mockReturnValue({})
    loadPluginComponentsMock.mockResolvedValue({
      commands: {},
      skills: {},
      agents: {
        prometheus: { description: "Reserved agent", mode: "subagent" },
        "custom-plugin-agent": { description: "Keep me too", mode: "subagent" },
      },
      mcpServers: {},
      hooksConfigs: [],
      plugins: [],
      errors: [],
    })

    //#when
    const result = await buildStartupSafeCustomAgentSummaries({
      pluginConfig: {},
      directory: "/tmp/project",
    })

    //#then
    expect(result).toEqual([
      { name: "workflow-navigator", mode: "subagent", description: "Keep me", hidden: false, disabled: false, enabled: true },
      { name: "custom-plugin-agent", mode: "subagent", description: "Keep me too", hidden: false, disabled: false, enabled: true },
    ])
  })

  test("skips markdown agent loading when claude_code.agents is disabled", async () => {
    //#given
    loadClaudeUserAgentsMock.mockReturnValue({
      "workflow-navigator": { description: "User workflow agent", mode: "subagent" },
    })
    loadOpenCodeUserAgentsMock.mockReturnValue({
      reviewer: { description: "OpenCode reviewer agent", mode: "subagent" },
    })
    loadProjectAgentsMock.mockReturnValue({
      "frontend-developer": { description: "Project frontend agent", mode: "all" },
    })
    loadPluginComponentsMock.mockResolvedValue({
      commands: {},
      skills: {},
      agents: {
        "security-reviewer": { description: "Plugin security agent", mode: "subagent" },
      },
      mcpServers: {},
      hooksConfigs: [],
      plugins: [],
      errors: [],
    })

    //#when
    const result = await buildStartupSafeCustomAgentSummaries({
      pluginConfig: { claude_code: { agents: false } },
      directory: "/tmp/project",
    })

    //#then
    expect(loadClaudeUserAgentsMock).not.toHaveBeenCalled()
    expect(loadOpenCodeUserAgentsMock).toHaveBeenCalled()
    expect(loadProjectAgentsMock).not.toHaveBeenCalled()
    expect(result).toEqual([
      { name: "reviewer", mode: "subagent", description: "OpenCode reviewer agent", hidden: false, disabled: false, enabled: true },
      { name: "security-reviewer", mode: "subagent", description: "Plugin security agent", hidden: false, disabled: false, enabled: true },
    ])
  })
})
