export type LockPermissionName = "pointer-lock" | "keyboard-lock";

/**
 * Whether to attempt a pointer/keyboard lock. Only an explicit "denied" blocks it: Chrome on
 * Android throws for these names, Firefox throws for unknown ones, and "prompt" is what a
 * browser reports before the lock call itself asks. Try anyway; the call can still fail.
 */
export async function isLockAllowed(
  name: LockPermissionName,
  permissions: Pick<Permissions, "query"> | undefined = typeof navigator === "undefined"
    ? undefined
    : navigator.permissions,
): Promise<boolean> {
  if (!permissions?.query) return true;
  try {
    const { state } = await permissions.query({ name: name as PermissionName });
    return state !== "denied";
  } catch {
    return true;
  }
}
