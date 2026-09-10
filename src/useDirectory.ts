import { useCallback, useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import type { Action, Command, Receipt, Snapshot } from "./contracts";
import { acceptSnapshot, errorMessage } from "./directory";

export type Run = (action: Action) => Promise<Receipt | null>;

export function useDirectory() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Command | null>(null);
  const locked = useRef(false);
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    if (!isTauri())
      throw new Error(
        "Open SkellySpeak with npm run tauri dev. This page needs the native application's local database.",
      );
    const incoming = await invoke<Snapshot>("get_snapshot");
    if (request === sequence.current)
      setSnapshot((current) => acceptSnapshot(current, incoming));
  }, []);
  useEffect(() => {
    const load = () => {
      void refresh().catch((e) => setError(errorMessage(e)));
    };
    load();
    window.addEventListener("focus", load);
    return () => {
      ++sequence.current;
      window.removeEventListener("focus", load);
    };
  }, [refresh]);

  const execute = useCallback(
    async (command: Command): Promise<Receipt | null> => {
      if (locked.current) return null;
      locked.current = true;
      setBusy(true);
      setError(null);
      let accepted = false;
      try {
        const receipt = await invoke<Receipt>("execute_command", { command });
        accepted = true;
        await refresh();
        setPending(null);
        return receipt;
      } catch (e) {
        const rejected =
          !accepted && typeof e === "object" && e !== null && "code" in e;
        if (rejected) {
          setPending(null);
          setError(errorMessage(e));
        } else {
          setPending(command);
          setError(
            `The action could not be confirmed: ${errorMessage(e)}. Use Recover action to reconcile the same action identity before making another change.`,
          );
        }
        return null;
      } finally {
        locked.current = false;
        setBusy(false);
      }
    },
    [refresh],
  );
  const run = useCallback(
    async (action: Action): Promise<Receipt | null> => {
      if (!snapshot) return null;
      if (pending) {
        setError(
          "Recover the unconfirmed action before making another change.",
        );
        return null;
      }
      return execute({
        sessionId: snapshot.sessionId,
        actionId: crypto.randomUUID(),
        action,
      });
    },
    [snapshot, pending, execute],
  );
  const recover = async () => (pending ? execute(pending) : null);
  return {
    snapshot,
    error,
    busy,
    run,
    pending,
    recover,
    clearError: () => {
      if (!pending) setError(null);
    },
    refresh,
  };
}
