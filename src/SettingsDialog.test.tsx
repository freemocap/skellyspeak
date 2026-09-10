// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { SettingsDialog } from "./SettingsDialog";
import { Modal } from "./Modal";
import type { Snapshot } from "./contracts";
import type { AccountState } from "./useAccount";
vi.mock("@tauri-apps/api/app", () => ({ getVersion: async () => "0.1.0" }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
const snapshot: Snapshot = {
  revision: 1,
  sessionId: "session",
  learner: {
    id: "learner",
    name: "Jon",
    revision: 1,
    preferences: {
      explanationLanguage: "en",
      textSize: 100,
      textSpacing: 0,
      highContrast: false,
      onboarding: "skipped",
    },
  },
  languages: [],
  languageProfiles: [],
  partners: [],
  relationships: [],
  conversations: [],
};
const account = { busy: false, signingIn: false } as AccountState;
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    left: 100,
    top: 100,
    right: 500,
    bottom: 500,
  } as DOMRect);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("clicking the backdrop saves pending preferences then closes", async () => {
  let resolve: (value: null) => void = () => {};
  const run = vi.fn(
    () =>
      new Promise<null>((done) => {
        resolve = done;
      }),
  );
  const close = vi.fn();
  render(
    <SettingsDialog
      snapshot={snapshot}
      run={run}
      busy={false}
      error={null}
      recovery={null}
      account={account}
      initial="reading"
      close={close}
    />,
  );
  fireEvent.click(screen.getByLabelText("Higher contrast"));
  fireEvent.click(screen.getByRole("dialog"), { clientX: 20, clientY: 20 });
  await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
  expect(close).not.toHaveBeenCalled();
  await act(async () => resolve({} as never));
  await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
});
it("does not close or erase preferences when the save fails", async () => {
  const close = vi.fn();
  render(
    <SettingsDialog
      snapshot={snapshot}
      run={vi.fn().mockResolvedValue(null)}
      busy={false}
      error="Write failed"
      recovery={null}
      account={account}
      initial="reading"
      close={close}
    />,
  );
  fireEvent.click(screen.getByLabelText("Higher contrast"));
  fireEvent.click(screen.getByRole("dialog"), { clientX: 20, clientY: 20 });
  await screen.findByText("Changes were not saved.");
  expect(close).not.toHaveBeenCalled();
  expect(
    (screen.getByLabelText("Higher contrast") as HTMLInputElement).checked,
  ).toBe(true);
});
it("ignores clicks inside the dialog, including its padding", () => {
  const close = vi.fn();
  render(
    <Modal title="Example" close={close} busy={false} recovery={null}>
      <p>Content</p>
    </Modal>,
  );
  fireEvent.click(screen.getByText("Content"));
  fireEvent.click(screen.getByRole("dialog"), { clientX: 200, clientY: 200 });
  expect(close).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("dialog"), { clientX: 20, clientY: 20 });
  expect(close).toHaveBeenCalledOnce();
});

it("waits for an automatic key save before dismissing settings", async () => {
  const config = {
    revision: 1,
    ownKeyConfigured: false,
    configured: false,
    signedIn: false,
    standardModel: "google/gemini-2.5-flash",
    fastModel: "google/gemini-2.5-flash-lite",
    route: "openrouter",
  };
  let finish: ((value: unknown) => void) | undefined;
  vi.mocked(invoke).mockImplementation(async (command) => {
    if (command === "get_connection") return config;
    if (command === "save_connection")
      return new Promise((resolve) => {
        finish = resolve;
      });
    return undefined;
  });
  const close = vi.fn();
  const state = {
    ...account,
    config,
    refresh: vi.fn().mockResolvedValue(undefined),
  } as unknown as AccountState;
  render(
    <SettingsDialog
      snapshot={snapshot}
      run={vi.fn()}
      busy={false}
      error={null}
      recovery={null}
      account={state}
      initial="account"
      close={close}
    />,
  );
  fireEvent.change(await screen.findByLabelText("OpenRouter API key"), {
    target: { value: "sk-or-test-credential" },
  });
  fireEvent.click(screen.getByRole("dialog"), { clientX: 20, clientY: 20 });
  expect(close).not.toHaveBeenCalled();
  await waitFor(() => expect(finish).toBeDefined());
  expect(close).not.toHaveBeenCalled();
  await act(async () =>
    finish!({ ...config, ownKeyConfigured: true, revision: 2 }),
  );
  await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
});
