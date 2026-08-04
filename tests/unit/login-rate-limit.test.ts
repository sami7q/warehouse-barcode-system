import { beforeEach, describe, expect, it } from "vitest";
import {
  isLockedOut,
  LOCKOUT_MS,
  MAX_ATTEMPTS,
  registerFailure,
  registerSuccess,
  resetAllForTests,
} from "@/lib/login-rate-limit";

const EMAIL = "someone@example.com";
const T0 = 1_700_000_000_000;

beforeEach(() => resetAllForTests());

describe("login brute-force protection", () => {
  it("does not lock before MAX_ATTEMPTS failures", () => {
    for (let i = 0; i < MAX_ATTEMPTS - 1; i++) {
      registerFailure(EMAIL, T0 + i);
    }
    expect(isLockedOut(EMAIL, T0 + 1000)).toBe(false);
  });

  it("locks after MAX_ATTEMPTS consecutive failures", () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      registerFailure(EMAIL, T0 + i);
    }
    expect(isLockedOut(EMAIL, T0 + 1000)).toBe(true);
  });

  it("is case-insensitive on the email key", () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      registerFailure("Someone@Example.COM", T0 + i);
    }
    expect(isLockedOut(EMAIL, T0 + 1000)).toBe(true);
  });

  it("unlocks after the lockout window expires", () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      registerFailure(EMAIL, T0 + i);
    }
    expect(isLockedOut(EMAIL, T0 + LOCKOUT_MS - 1)).toBe(true);
    expect(isLockedOut(EMAIL, T0 + LOCKOUT_MS + MAX_ATTEMPTS + 1)).toBe(false);
  });

  it("a successful login clears the failure counter", () => {
    for (let i = 0; i < MAX_ATTEMPTS - 1; i++) {
      registerFailure(EMAIL, T0 + i);
    }
    registerSuccess(EMAIL);
    registerFailure(EMAIL, T0 + 100);
    expect(isLockedOut(EMAIL, T0 + 1000)).toBe(false);
  });

  it("does not lock a different email", () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      registerFailure(EMAIL, T0 + i);
    }
    expect(isLockedOut("other@example.com", T0 + 1000)).toBe(false);
  });
});
