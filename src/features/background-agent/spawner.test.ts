import { describe, test, expect } from "bun:test"

import { createTask, startTask } from "./spawner"

describe("background-agent spawner.startTask", () => {
  test("includes agent alongside explicit model in prompt body", async () => {
    //#given
    let capturedBody: Record<string, unknown> | undefined
    const client = {
      session: {
        get: async () => ({ data: { directory: "/parent/dir" } }),
        create: async () => ({ data: { id: "ses_child" } }),
        promptAsync: async (args: { path: { id: string }; body: Record<string, unknown> }) => {
          capturedBody = args.body
          return {}
        },
      },
    }

    const task = createTask({
      description: "Test task",
      prompt: "Do work",
      agent: "explore",
      parentSessionID: "ses_parent",
      parentMessageID: "msg_parent",
      model: { providerID: "openai", modelID: "gpt-5.4", variant: "high" },
    })

    const item = {
      task,
      input: {
        description: task.description,
        prompt: task.prompt,
        agent: task.agent,
        parentSessionID: task.parentSessionID,
        parentMessageID: task.parentMessageID,
        parentModel: task.parentModel,
        parentAgent: task.parentAgent,
        model: task.model,
      },
    }

    const ctx = {
      client,
      directory: "/fallback",
      concurrencyManager: { release: () => {} },
      tmuxEnabled: false,
      onTaskError: () => {},
    }

    //#when
    await startTask(item as any, ctx as any)

    //#then
    expect(capturedBody?.agent).toBe("explore")
    expect(capturedBody?.model).toEqual({ providerID: "openai", modelID: "gpt-5.4" })
    expect(capturedBody?.variant).toBe("high")
  })

  test("applies explicit child session permission rules when creating child session", async () => {
    //#given
    const createCalls: any[] = []
    const parentPermission = [
      { permission: "question", action: "allow" as const, pattern: "*" },
      { permission: "plan_enter", action: "deny" as const, pattern: "*" },
    ]

    const client = {
      session: {
        get: async () => ({ data: { directory: "/parent/dir", permission: parentPermission } }),
        create: async (args?: any) => {
          createCalls.push(args)
          return { data: { id: "ses_child" } }
        },
        promptAsync: async () => ({}),
      },
    }

    const task = createTask({
      description: "Test task",
      prompt: "Do work",
      agent: "explore",
      parentSessionID: "ses_parent",
      parentMessageID: "msg_parent",
    })

    const item = {
      task,
      input: {
        description: task.description,
        prompt: task.prompt,
        agent: task.agent,
        parentSessionID: task.parentSessionID,
        parentMessageID: task.parentMessageID,
        parentModel: task.parentModel,
        parentAgent: task.parentAgent,
        model: task.model,
        sessionPermission: [
          { permission: "question", action: "deny", pattern: "*" },
        ],
      },
    }

    const ctx = {
      client,
      directory: "/fallback",
      concurrencyManager: { release: () => {} },
      tmuxEnabled: false,
      onTaskError: () => {},
    }

    //#when
    await startTask(item as any, ctx as any)

    //#then
    expect(createCalls).toHaveLength(1)
    expect(createCalls[0]?.body?.permission).toEqual([
      { permission: "question", action: "deny", pattern: "*" },
    ])
  })
})
