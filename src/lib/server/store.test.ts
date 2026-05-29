import { describe, expect, it } from "vitest";
import { createMemoryStore } from "./memory-store";

describe("memory roleplay store", () => {
  const pat = {
    id: "user-1",
    email: "pat@example.com",
    name: "Pat",
    avatar_url: null
  };

  const friend = {
    id: "user-2",
    email: "friend@example.com",
    name: "Friend",
    avatar_url: null
  };

  it("creates, lists, fetches, renames, and deletes sessions per user", async () => {
    const store = createMemoryStore();

    const session = await store.createSession({
      user: pat,
      scenarioId: "ordering_coffee"
    });
    await store.createSession({
      user: friend,
      scenarioId: "ordering_coffee"
    });

    expect(await store.listSessions("user-1")).toHaveLength(1);
    expect(await store.getSession("user-1", session.id)).toMatchObject({
      id: session.id,
      scenario_id: "ordering_coffee",
      messages: [],
      teacher_messages: []
    });

    const renamed = await store.updateSession("user-1", session.id, {
      title: "Coffee practice"
    });

    expect(renamed.title).toBe("Coffee practice");
    await store.deleteSession("user-1", session.id);
    expect(await store.listSessions("user-1")).toHaveLength(0);
  });

  it("keeps custom scenarios private to the owning user", async () => {
    const store = createMemoryStore();

    const scenario = await store.createScenario(pat, {
      name: "Pharmacy visit",
      description: "Practice asking for medicine",
      category: "daily",
      icon: "💊",
      feedback_mode: "standard",
      starter: "actor",
      actor_role: "A pharmacist",
      actor_setting: "A neighborhood pharmacy",
      actor_personality: "Patient and practical",
      scenario_context: "The customer needs cold medicine.",
      user_role: "A customer buying medicine",
      starter_instruction: "Ask how you can help the customer."
    });

    expect(scenario).toMatchObject({
      user_id: pat.id,
      source: "custom",
      name: "Pharmacy visit"
    });
    expect(await store.getScenario(pat.id, scenario.id)).toMatchObject({
      id: scenario.id
    });
    expect(await store.getScenario(friend.id, scenario.id)).toBeNull();
    expect((await store.listScenarios(pat.id)).map((item) => item.id)).toContain(
      scenario.id
    );
    expect(
      (await store.listScenarios(friend.id)).map((item) => item.id)
    ).not.toContain(scenario.id);
  });

  it("includes the latest user message in listed sessions", async () => {
    const store = createMemoryStore();
    const session = await store.createSession({
      user: pat,
      scenarioId: "ordering_coffee"
    });

    await store.createActorMessage(pat.id, {
      sessionId: session.id,
      content: "Hi there! What can I get for you?"
    });
    await store.createUserMessage(pat.id, {
      sessionId: session.id,
      clientMessageId: "message-1",
      content: "I want order coffee"
    });
    await store.createUserMessage(pat.id, {
      sessionId: session.id,
      clientMessageId: "message-2",
      content: "Can I get a latte?"
    });

    expect(await store.listSessions(pat.id)).toEqual([
      expect.objectContaining({
        id: session.id,
        latest_user_message: "Can I get a latte?"
      })
    ]);
  });
});
