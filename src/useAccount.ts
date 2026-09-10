import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  ConnectionConfig,
  ConnectionRoute,
  HostedAccount,
} from "./contracts";
import { errorMessage } from "./directory";

export function useAccount(activity: string | undefined) {
  const [config, setConfig] = useState<ConnectionConfig | null>(null);
  const [account, setAccount] = useState<HostedAccount | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    try {
      const next = await invoke<ConnectionConfig>("get_connection");
      if (request !== sequence.current) return;
      setConfig(next);
      setAccount(null);
      setError(null);
      if (next.signedIn && next.route === "hosted") {
        const usage = await invoke<HostedAccount>("hosted_account");
        if (request === sequence.current) setAccount(usage);
      }
    } catch (e) {
      if (request === sequence.current) setError(errorMessage(e));
    }
  }, []);
  useEffect(() => {
    void refresh();
    return () => {
      ++sequence.current;
    };
  }, [refresh, activity]);
  const signIn = async () => {
    if (signingIn || busy) return;
    setSigningIn(true);
    setError(null);
    ++sequence.current;
    try {
      await invoke<HostedAccount>("hosted_sign_in");
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSigningIn(false);
    }
  };
  const cancel = async () => {
    try {
      await invoke("cancel_sign_in");
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  const signOut = async () => {
    if (!config || busy) return;
    setBusy(true);
    setError(null);
    ++sequence.current;
    try {
      setConfig(
        await invoke<ConnectionConfig>("hosted_sign_out", {
          expectedRevision: config.revision,
        }),
      );
      setAccount(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const route = async (route: ConnectionRoute) => {
    if (!config || busy) return;
    setBusy(true);
    setError(null);
    try {
      await invoke("select_route", {
        expectedRevision: config.revision,
        route,
      });
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return {
    config,
    account,
    error,
    signingIn,
    busy,
    refresh,
    signIn,
    cancel,
    signOut,
    route,
  };
}
export type AccountState = ReturnType<typeof useAccount>;
