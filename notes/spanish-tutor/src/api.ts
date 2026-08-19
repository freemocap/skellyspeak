import { invoke } from "@tauri-apps/api/core";
import type { TurnResult } from "./types";

export const sendMessage = (text: string) =>
  invoke<TurnResult>("send_message", { text });

export const resetSession = () => invoke<void>("reset_session");
