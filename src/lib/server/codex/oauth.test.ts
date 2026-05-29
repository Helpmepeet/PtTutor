import { describe, expect, it } from "vitest";
import { createPkcePair, extractAccountId } from "./oauth";

function makeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.`;
}

describe("extractAccountId", () => {
  it("reads chatgpt_account_id from the OpenAI auth claim", () => {
    const jwt = makeJwt({
      "https://api.openai.com/auth": { chatgpt_account_id: "acct_123" }
    });
    expect(extractAccountId(jwt)).toBe("acct_123");
  });

  it("returns null when the auth claim is absent (e.g. refresh tokens)", () => {
    const jwt = makeJwt({ sub: "user_1" });
    expect(extractAccountId(jwt)).toBeNull();
  });

  it("returns null for malformed or missing tokens", () => {
    expect(extractAccountId(undefined)).toBeNull();
    expect(extractAccountId("not-a-jwt")).toBeNull();
    expect(extractAccountId("a.!!!.c")).toBeNull();
  });
});

describe("createPkcePair", () => {
  it("produces a url-safe verifier and a distinct S256 challenge", () => {
    const { verifier, challenge } = createPkcePair();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(challenge).not.toBe(verifier);
    expect(createPkcePair().verifier).not.toBe(verifier);
  });
});
