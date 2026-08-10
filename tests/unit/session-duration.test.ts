import { describe, expect, it } from "vitest";
import {
  DEFAULT_SESSION_MAX_AGE_SECONDS,
  REMEMBER_ME_MAX_AGE_SECONDS,
  resolveSessionMaxAge,
} from "@/lib/constants";

describe("resolveSessionMaxAge (تذكرني)", () => {
  it("returns the 30-day ceiling when remember is true", () => {
    expect(resolveSessionMaxAge(true)).toBe(REMEMBER_ME_MAX_AGE_SECONDS);
  });

  it("returns the 1-day default when remember is false", () => {
    expect(resolveSessionMaxAge(false)).toBe(DEFAULT_SESSION_MAX_AGE_SECONDS);
  });

  it("the remembered duration is strictly longer than the default", () => {
    expect(REMEMBER_ME_MAX_AGE_SECONDS).toBeGreaterThan(
      DEFAULT_SESSION_MAX_AGE_SECONDS,
    );
  });

  it("constants match their documented values (30 days / 1 day)", () => {
    expect(REMEMBER_ME_MAX_AGE_SECONDS).toBe(60 * 60 * 24 * 30);
    expect(DEFAULT_SESSION_MAX_AGE_SECONDS).toBe(60 * 60 * 24);
  });
});
