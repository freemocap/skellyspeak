import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { errorMessage } from "./directory";

export function useRecorder(
  conversationId: string,
  insert: (text: string) => void,
) {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wave, setWave] = useState<number[]>([]);
  const active = useRef<string | null>(null);
  const alive = useRef(true);
  const working = useRef(false);
  const insertRef = useRef(insert);
  insertRef.current = insert;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      const id = active.current;
      active.current = null;
      if (id)
        void invoke("mic_cancel", { recordingId: id }).catch((e) =>
          setError(errorMessage(e)),
        );
    };
  }, []);
  const cancel = async () => {
    const id = active.current;
    if (!id) return;
    active.current = null;
    setRecording(false);
    try {
      await invoke("mic_cancel", { recordingId: id });
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  useEffect(() => {
    if (!recording) return;
    let polling = false;
    const timer = setInterval(() => {
      const id = active.current;
      if (!id || polling) return;
      polling = true;
      void invoke<number[]>("mic_wave", { recordingId: id })
        .then((chunk) => {
          if (active.current === id)
            setWave((previous) => [...previous, ...chunk].slice(-250));
        })
        .catch((e) => {
          if (active.current === id) {
            setError(errorMessage(e));
            void cancel();
          }
        })
        .finally(() => {
          polling = false;
        });
    }, 100);
    return () => clearInterval(timer);
  }, [recording]);
  const toggle = async () => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError(null);
    try {
      const id = active.current;
      if (id) {
        active.current = null;
        setRecording(false);
        const text = await invoke<string>("mic_transcribe", {
          recordingId: id,
        });
        if (alive.current && text.trim()) insertRef.current(text);
      } else {
        const id = await invoke<string>("mic_start", { conversationId });
        if (!alive.current) {
          await invoke("mic_cancel", { recordingId: id });
          return;
        }
        active.current = id;
        setWave([]);
        setRecording(true);
      }
    } catch (e) {
      if (alive.current) setError(errorMessage(e));
    } finally {
      working.current = false;
      if (alive.current) setBusy(false);
    }
  };
  return { recording, busy, error, wave, toggle, cancel };
}
