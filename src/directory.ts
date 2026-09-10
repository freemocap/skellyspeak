import type { Snapshot } from "./contracts";

export function acceptSnapshot(
  current: Snapshot | null,
  incoming: Snapshot,
): Snapshot {
  if (
    current?.sessionId === incoming.sessionId &&
    incoming.revision < current.revision
  )
    return current;
  return incoming;
}

export function retainDrafts(
  drafts: Record<string, string>,
  conversationIds: Set<string>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(drafts).filter(([id]) => conversationIds.has(id)),
  );
}

export function errorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  )
    return error.message;
  return String(error);
}
