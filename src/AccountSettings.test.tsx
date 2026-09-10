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
import { AccountSettings } from "./AccountSettings";
import type { AccountState } from "./useAccount";
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
const config = {
  revision: 1,
  route: "openrouter" as const,
  configured: true,
  ownKeyConfigured: true,
  signedIn: false,
  email: "",
  standardModel: "standard",
  fastModel: "fast",
  paused: false,
};
const access = {
  revision: 1,
  groqKeyConfigured: true,
  customKeyConfigured: false,
  custom: {
    baseUrl: "",
    standardModel: "",
    fastModel: "",
    bearerAuth: false,
    transcriptionModel: null,
  },
};
const mock = vi.mocked(invoke);
beforeEach(() => {
  mock.mockReset();
  mock.mockImplementation(async (name) =>
    name === "get_connection"
      ? config
      : name === "get_access_settings"
        ? access
        : undefined,
  );
});
afterEach(cleanup);
function state(overrides: Partial<AccountState> = {}): AccountState {
  return {
    config,
    account: null,
    error: null,
    busy: false,
    signingIn: false,
    refresh: vi.fn().mockResolvedValue(undefined),
    route: vi.fn().mockResolvedValue(undefined),
    signIn: vi.fn(),
    signOut: vi.fn(),
    cancel: vi.fn(),
    ...overrides,
  };
}
it("groups both key inputs before collapsed model settings, without nested forms", async () => {
  render(<AccountSettings state={state()} onBusyChange={vi.fn()} />);
  const chat = await screen.findByLabelText("OpenRouter API key");
  const audio = await screen.findByLabelText("Groq API key");
  const models = screen.getByText("Models").closest("details")!;
  expect(models.open).toBe(false);
  expect(
    chat.compareDocumentPosition(audio) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(
    audio.compareDocumentPosition(models) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(document.querySelector("form form")).toBeNull();
  expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
    "Hosted sign-in",
    "API keys",
    "Custom URL",
  ]);
});
it("selects the active route through the tab and waits for persisted confirmation", async () => {
  const account = state();
  const { rerender } = render(
    <AccountSettings state={account} onBusyChange={vi.fn()} />,
  );
  await screen.findByLabelText("OpenRouter API key");
  const keys = screen.getByRole("tab", { name: "API keys" });
  keys.focus();
  fireEvent.keyDown(keys, { key: "ArrowRight" });
  const custom = screen.getByRole("tab", { name: "Custom URL" });
  expect(document.activeElement).toBe(custom);
  expect(account.route).not.toHaveBeenCalled();
  fireEvent.click(custom);
  expect(account.route).toHaveBeenCalledExactlyOnceWith("custom");
  expect(keys.getAttribute("aria-selected")).toBe("true");
  expect(custom.getAttribute("aria-selected")).toBe("false");
  rerender(
    <AccountSettings
      state={state({ config: { ...config, route: "custom" } })}
      onBusyChange={vi.fn()}
    />,
  );
  await screen.findByLabelText("API base URL");
  expect(custom.getAttribute("aria-selected")).toBe("true");
  expect(screen.queryByRole("radio")).toBeNull();
});
it("blocks route changes and the other key while a key save is pending", async () => {
  let finish!: (value: unknown) => void;
  const pending = new Promise((resolve) => {
    finish = resolve;
  });
  mock.mockImplementation(async (name) =>
    name === "get_connection"
      ? config
      : name === "get_access_settings"
        ? access
        : name === "save_connection"
          ? pending
          : undefined,
  );
  render(<AccountSettings state={state()} onBusyChange={vi.fn()} />);
  fireEvent.change(await screen.findByLabelText("OpenRouter API key"), {
    target: { value: "test-replacement-key" },
  });
  await waitFor(() =>
    expect(
      (screen.getByRole("tab", { name: "Custom URL" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true),
  );
  expect(
    (screen.getByLabelText("Groq API key") as HTMLInputElement).matches(
      ":disabled",
    ),
  ).toBe(true);
  await waitFor(() =>
    expect(mock).toHaveBeenCalledWith("save_connection", expect.anything()),
  );
  finish({ ...config, revision: 2 });
  await waitFor(() =>
    expect(
      (screen.getByRole("tab", { name: "Custom URL" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false),
  );
});
it("puts hosted sign-in before collapsed service details", () => {
  render(
    <AccountSettings
      state={state({
        config: { ...config, route: "hosted", configured: false },
      })}
      onBusyChange={vi.fn()}
    />,
  );
  const signIn = screen.getByRole("button", { name: "Sign in with Google" });
  const details = screen.getByText("Service details").closest("details")!;
  expect(details.open).toBe(false);
  expect(
    signIn.compareDocumentPosition(details) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(screen.queryByLabelText("Groq API key")).toBeNull();
});
