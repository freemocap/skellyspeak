import { invoke } from "@tauri-apps/api/core";
import type { HistoryTurn, ProviderSettings, SttStatus, TutorTurn } from "./types";

export const sendMessage = (text: string, history: HistoryTurn[]) =>
  invoke<TutorTurn>("send_message", { text, history });

export const sttStatus = () => invoke<SttStatus>("stt_status");
export const ensureSttModel = () => invoke<SttStatus>("ensure_stt_model");
export const startListening = () => invoke<void>("start_listening");
export const stopListening = () => invoke<string>("stop_listening");

export const getProviderSettings = () =>
  invoke<ProviderSettings>("get_provider_settings");
export const setProviderSettings = (settings: ProviderSettings) =>
  invoke<void>("set_provider_settings", { settings });
