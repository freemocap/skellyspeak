import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ConversationSnapshot } from "./contracts";
import { errorMessage } from "./directory";

export function useChat(
  conversationId: string | null,
  refreshDirectory: () => Promise<void>,
) {
  const [snapshot, setSnapshot] = useState<ConversationSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<{
    conversationId: string | null;
    before: number | null;
  }>({ conversationId: null, before: null });
  const before = page.conversationId === conversationId ? page.before : null;
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    let disposed = false;
    setSnapshot(null);
    setError(null);
    if (!conversationId) return;
    const watch = async () => {
      let revision = -1;
      while (!disposed) {
        const next: ConversationSnapshot = await invoke<ConversationSnapshot>(
          "watch_conversation",
          {
            conversationId,
            afterRevision: revision,
            before,
          },
        );
        if (disposed) return;
        if (next.conversationId !== conversationId)
          throw new Error("Conversation snapshot scope mismatch.");
        if (next.revision !== revision) {
          setSnapshot(next);
          await refreshDirectory();
        }
        revision = next.revision;
      }
    };
    void watch().catch((e) => {
      if (!disposed) setError(errorMessage(e));
    });
    return () => {
      disposed = true;
    };
  }, [conversationId, generation, refreshDirectory, before]);
  return {
    snapshot: snapshot?.conversationId === conversationId ? snapshot : null,
    error,
    isOlder: before !== null,
    older: () =>
      setPage({
        conversationId,
        before: snapshot?.messages[0]?.sequence ?? null,
      }),
    latest: () => setPage({ conversationId, before: null }),
    reload: () => setGeneration((v) => v + 1),
  };
}
