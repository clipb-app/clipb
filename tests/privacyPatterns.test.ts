import { test } from "node:test";
import assert from "node:assert/strict";
import { TOKEN_PATTERNS } from "../src/lib/privacyPatterns";

test("privacy patterns include named sensitive clipboard detectors", () => {
  const patternNames = TOKEN_PATTERNS.map((pattern) => pattern.name);

  assert.deepEqual(patternNames, [
    "private_key",
    "jwt_token",
    "github_token",
    "openai_style_key",
    "stripe_key",
    "aws_access_key",
    "bearer_token",
    "database_url",
    "env_secret",
  ]);
  assert.ok(
    TOKEN_PATTERNS.every(
      (pattern) => pattern.description.length > 0 && pattern.pattern instanceof RegExp,
    ),
  );
});

test("privacy patterns match representative sensitive values", () => {
  const cases = new Map([
    ["private_key", "-----BEGIN RSA PRIVATE KEY-----"],
    [
      "jwt_token",
      "eyJabcdefghijklmnopqrstuvwxyz.eyJabcdefghijklmnopqrstuvwxyz.signature_123",
    ],
    ["github_token", `ghp_${"a".repeat(24)}`],
    ["openai_style_key", `sk-${"a".repeat(24)}`],
    ["stripe_key", `sk_test_${"a".repeat(24)}`],
    ["aws_access_key", "AKIA1234567890ABCDEF"],
    ["bearer_token", `Bearer ${"a".repeat(24)}`],
    ["database_url", "postgres://user:pass@localhost:5432/clipb"],
    ["env_secret", "API_KEY=supersecretvalue"],
  ]);

  for (const pattern of TOKEN_PATTERNS) {
    assert.equal(
      pattern.pattern.test(cases.get(pattern.name) ?? ""),
      true,
      `${pattern.name} should match`,
    );
  }
});
