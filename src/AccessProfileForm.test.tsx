// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { AccessProfileForm } from "./AccessProfileForm";
import type { AccessSettings } from "./contracts";
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
const initial: AccessSettings = {
  revision: 4,
  groqKeyConfigured: false,
  customKeyConfigured: true,
  custom: {
    baseUrl: "http://localhost:1234/v1",
    standardModel: "local-chat",
    fastModel: "local-fast",
    bearerAuth: false,
    transcriptionModel: null,
  },
};
const mock = vi.mocked(invoke);
beforeEach(() => {
  mock.mockReset();
  mock.mockImplementation(async (name) =>
    name === "get_access_settings"
      ? structuredClone(initial)
      : name === "check_access"
        ? "Connection accepted"
        : { ...initial, revision: 5, groqKeyConfigured: true },
  );
});
afterEach(cleanup);
function setup(custom = false) {
  const changed = vi.fn().mockResolvedValue(undefined);
  render(
    <AccessProfileForm
      custom={custom}
      onBusyChange={vi.fn()}
      onChanged={changed}
    />,
  );
  return changed;
}
it("saves Groq independently, clears secret input, and checks the saved credential", async () => {
  setup();
  const input = await screen.findByLabelText("Groq API key");
  expect((input as HTMLInputElement).type).toBe("password");
  expect(screen.queryByRole("button", { name: /show.*key/i })).toBeNull();
  fireEvent.change(input, { target: { value: "  gsk-example-key  " } });
  await waitFor(() =>
    expect(mock).toHaveBeenCalledWith("save_access_settings", {
      expectedRevision: 4,
      custom: null,
      apiKey: "gsk-example-key",
      removeKey: false,
    }),
  );
  await screen.findByLabelText("Groq API key: valid");
  expect((input as HTMLInputElement).value).toBe("");
  expect(mock).toHaveBeenCalledWith("check_access", {
    expectedRevision: 5,
    custom: false,
  });
});
it("keeps a failed secret edit visible with explicit retry", async () => {
  mock.mockImplementation(async (name) => {
    if (name === "get_access_settings") return initial;
    if (name === "save_access_settings") throw { message: "Keychain denied" };
  });
  setup();
  const input = await screen.findByLabelText("Groq API key");
  fireEvent.change(input, { target: { value: "gsk-preserve-this" } });
  await screen.findByText("Keychain denied");
  expect((input as HTMLInputElement).value).toBe("gsk-preserve-this");
  expect(screen.getByText("Retry save")).toBeTruthy();
});
it("custom no-auth preserves that choice and explicitly enables transcription", async () => {
  setup(true);
  await screen.findByLabelText("API base URL");
  expect(screen.queryByLabelText("Endpoint bearer key")).toBeNull();
  fireEvent.click(screen.getByLabelText("Voice transcription"));
  await waitFor(() =>
    expect(mock).toHaveBeenCalledWith("save_access_settings", {
      expectedRevision: 4,
      custom: { ...initial.custom, transcriptionModel: "whisper-large-v3" },
      apiKey: null,
      removeKey: false,
    }),
  );
  expect(mock).not.toHaveBeenCalledWith("check_access", expect.anything());
});
it("connection checks are explicit and do not save or make an inference request", async () => {
  setup(true);
  fireEvent.click(await screen.findByText("Check connection"));
  await screen.findByText("Connection accepted");
  expect(mock).toHaveBeenCalledWith("check_access", {
    expectedRevision: 4,
    custom: true,
  });
  expect(mock).not.toHaveBeenCalledWith(
    "save_access_settings",
    expect.anything(),
  );
});

it("does not validate a saved Groq key until the provider accepts it", async () => {
  let rejectCheck!: (error: unknown) => void;
  mock.mockImplementation(async (name) => {
    if (name === "get_access_settings")
      return { ...initial, groqKeyConfigured: true };
    if (name === "check_access")
      return new Promise((_, reject) => {
        rejectCheck = reject;
      });
    throw new Error(`Unexpected command: ${name}`);
  });
  setup();
  await screen.findByLabelText("Groq API key: checking");
  expect(screen.queryByLabelText("Groq API key: valid")).toBeNull();
  expect(mock).toHaveBeenCalledWith("check_access", {
    expectedRevision: 4,
    custom: false,
  });
  rejectCheck({
    message:
      "Connection check: HTTP 401. Check the saved key and endpoint permissions.",
  });
  await screen.findByLabelText("Groq API key: invalid");
  expect(screen.queryByLabelText("Groq API key: valid")).toBeNull();
  expect(screen.getByRole("alert").textContent).toContain("HTTP 401");
});

it("clears an unsaved Groq key after a save failure", async () => {
  mock.mockImplementation(async (name) => {
    if (name === "get_access_settings") return initial;
    if (name === "save_access_settings") throw { message: "Invalid API key." };
    throw new Error(`Unexpected command: ${name}`);
  });
  setup();
  const input = await screen.findByLabelText("Groq API key");
  fireEvent.change(input, { target: { value: "bad" } });
  await screen.findByText("Invalid API key.");
  fireEvent.click(
    screen.getByRole("button", { name: "Clear Groq API key entry" }),
  );
  expect((input as HTMLInputElement).value).toBe("");
  expect(screen.queryByText("Invalid API key.")).toBeNull();
  expect(mock).not.toHaveBeenCalledWith(
    "save_access_settings",
    expect.objectContaining({ removeKey: true }),
  );
});
