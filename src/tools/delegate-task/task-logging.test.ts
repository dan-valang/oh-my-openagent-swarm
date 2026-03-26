declare const require: (name: string) => any
const { afterEach, beforeEach, describe, expect, spyOn, test } = require("bun:test")

import * as logger from "../../shared/logger"
import { executeBackgroundTask } from "./background-task"
import { executeSyncTask } from "./sync-task"

describe("delegate-task logging", () => {
  let logSpy: ReturnType<typeof spyOn> | undefined

  beforeEach(() => {
    logSpy = spyOn(logger, "log").mockImplementation(() => {})
  })

  afterEach(() => {
    logSpy?.mockRestore()
  })

  test("logs resolved agent details when a sync session is created", async () => {
    const deps = {
      createSyncSession: async () => ({ ok: true as const, sessionID: "ses_sync_123" }),
      sendSyncPrompt: async () => null,
      pollSyncSession: async () => null,
      fetchSyncResult: async () => ({ ok: true as const, textContent: "Done" }),
    }

    await executeSyncTask(
      {
        description: "inspect logs",
        prompt: "Trace the active delegation path",
        subagent_type: "workflow-navigator",
        load_skills: [],
        run_in_background: false,
      },
      {
        sessionID: "ses_parent",
        metadata: async () => {},
      },
      {
        client: {} as never,
        directory: "/repo",
      } as never,
      {
        sessionID: "ses_parent",
        agent: "sisyphus",
      } as never,
      "workflow-navigator",
      { providerID: "openai", modelID: "gpt-5.4", variant: "high" },
      undefined,
      undefined,
      undefined,
      deps,
    )

    const syncLog = logSpy?.mock.calls.find(
      (call: [string, Record<string, unknown>]) => call[0] === "[task] sync session created",
    )

    expect(syncLog).toBeDefined()
    expect(syncLog?.[1]).toEqual({
      sessionID: "ses_sync_123",
      parentSessionID: "ses_parent",
      description: "inspect logs",
      requestedSubagentType: "workflow-navigator",
      resolvedAgent: "workflow-navigator",
      category: undefined,
      model: { providerID: "openai", modelID: "gpt-5.4", variant: "high" },
      spawnDepth: 1,
    })
  })

  test("logs resolved agent details when a background task launches", async () => {
    const manager = {
      launch: async () => ({
        id: "bg_123",
        sessionID: "ses_bg_123",
        description: "inspect logs",
        agent: "workflow-navigator",
        status: "running",
      }),
      getTask: () => ({ sessionID: "ses_bg_123" }),
    }

    await executeBackgroundTask(
      {
        description: "inspect logs",
        prompt: "Trace the active delegation path",
        subagent_type: "workflow-navigator",
        load_skills: [],
        run_in_background: true,
      },
      {
        sessionID: "ses_parent",
        metadata: async () => {},
        abort: new AbortController().signal,
      },
      { manager } as never,
      {
        sessionID: "ses_parent",
        messageID: "msg_parent",
        agent: "sisyphus",
      } as never,
      "workflow-navigator",
      { providerID: "openai", modelID: "gpt-5.4", variant: "high" },
      undefined,
      undefined,
    )

    const backgroundLog = logSpy?.mock.calls.find(
      (call: [string, Record<string, unknown>]) => call[0] === "[task] background launch ready",
    )

    expect(backgroundLog).toBeDefined()
    expect(backgroundLog?.[1]).toEqual({
      taskID: "bg_123",
      sessionID: "ses_bg_123",
      description: "inspect logs",
      requestedSubagentType: "workflow-navigator",
      resolvedAgent: "workflow-navigator",
      category: undefined,
      parentSessionID: "ses_parent",
      parentAgent: "sisyphus",
      model: { providerID: "openai", modelID: "gpt-5.4", variant: "high" },
      status: "running",
    })
  })
})

export {}
