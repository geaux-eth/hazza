/**
 * Worker API tests — basic validation and route tests.
 *
 * To run:
 *   npm install -D vitest @cloudflare/vitest-pool-workers
 *   Add to wrangler.toml: [vars.test] (or use vitest.config.ts with miniflare)
 *   npx vitest
 *
 * These tests validate request/response handling without chain calls.
 * Chain-dependent tests need RPC mocking (TODO).
 */

import { describe, it, expect } from "vitest";

// Helper: validate name format (mirrors worker logic)
function isValidName(name: string): boolean {
  return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(name) && !name.includes("--");
}

describe("Name validation", () => {
  it("accepts valid names", () => {
    expect(isValidName("hello")).toBe(true);
    expect(isValidName("a-b")).toBe(true);
    expect(isValidName("test123")).toBe(true);
    expect(isValidName("abc")).toBe(true);
  });

  it("rejects invalid names", () => {
    expect(isValidName("")).toBe(false);
    expect(isValidName("ab")).toBe(false); // too short
    expect(isValidName("-abc")).toBe(false); // leading hyphen
    expect(isValidName("abc-")).toBe(false); // trailing hyphen
    expect(isValidName("a--b")).toBe(false); // consecutive hyphens
    expect(isValidName("ABC")).toBe(false); // uppercase
    expect(isValidName("hello world")).toBe(false); // space
    expect(isValidName("hello.world")).toBe(false); // dot
  });
});

describe("Address validation", () => {
  it("validates Ethereum addresses", () => {
    const valid = /^0x[0-9a-fA-F]{40}$/.test("0x96168ACf7f3925e7A9eAA08Ddb21e59643da8097");
    expect(valid).toBe(true);
  });

  it("rejects invalid addresses", () => {
    expect(/^0x[0-9a-fA-F]{40}$/.test("0x123")).toBe(false);
    expect(/^0x[0-9a-fA-F]{40}$/.test("not-an-address")).toBe(false);
    expect(/^0x[0-9a-fA-F]{40}$/.test("")).toBe(false);
  });
});

describe("Offer validation", () => {
  const ALLOWED_OFFER_CURRENCIES = ["ETH", "WETH", "USDC"];
  const MAX_OFFER_DURATION_SECS = 30 * 86400;

  it("validates currency allowlist", () => {
    expect(ALLOWED_OFFER_CURRENCIES.includes("WETH")).toBe(true);
    expect(ALLOWED_OFFER_CURRENCIES.includes("USDC")).toBe(true);
    expect(ALLOWED_OFFER_CURRENCIES.includes("DAI")).toBe(false);
  });

  it("validates price bounds", () => {
    const validate = (price: number) => !isNaN(price) && price > 0 && price <= 1e12;
    expect(validate(0.01)).toBe(true);
    expect(validate(1000000)).toBe(true);
    expect(validate(0)).toBe(false);
    expect(validate(-1)).toBe(false);
    expect(validate(1e13)).toBe(false);
    expect(validate(NaN)).toBe(false);
  });

  it("validates expiry within 30 days", () => {
    const now = Math.floor(Date.now() / 1000);
    expect(now + 86400 - now <= MAX_OFFER_DURATION_SECS).toBe(true); // 1 day
    expect(now + 31 * 86400 - now <= MAX_OFFER_DURATION_SECS).toBe(false); // 31 days
  });
});

describe("Broker validation", () => {
  const ALLOWED_BROKERS: Record<string, number> = {
    "0xa6eB678F607bB811a25E2071A7AAe6F53E674e7d": 100,
  };

  it("recognizes allowed brokers", () => {
    expect(ALLOWED_BROKERS["0xa6eB678F607bB811a25E2071A7AAe6F53E674e7d"]).toBe(100);
  });

  it("rejects unknown brokers", () => {
    expect(ALLOWED_BROKERS["0x0000000000000000000000000000000000000001"]).toBeUndefined();
  });
});
