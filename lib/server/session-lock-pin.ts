/**
 * Session lock PIN (same source as client {@link components/SessionUnlock}).
 * Prefer server-only APP_LOCK_PIN when set; otherwise NEXT_PUBLIC_APP_LOCK_PIN.
 */
export function getSessionLockPin(): string {
  return (process.env.APP_LOCK_PIN?.trim() ?? process.env.NEXT_PUBLIC_APP_LOCK_PIN?.trim() ?? "");
}

export function isSessionLockEnabled(): boolean {
  return getSessionLockPin().length > 0;
}

export function assertSessionLockEnabled(): void {
  if (!isSessionLockEnabled()) {
    throw new Error("Session lock is disabled (no PIN configured)");
  }
}

export function verifySessionLockPin(pin: unknown): boolean {
  const expected = getSessionLockPin();
  if (!expected) return false;
  return typeof pin === "string" && pin === expected;
}
