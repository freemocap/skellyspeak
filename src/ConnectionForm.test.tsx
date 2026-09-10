// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { ConnectionForm } from "./ConnectionForm";
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
const config = {
  revision: 1,
  ownKeyConfigured: false,
  configured: false,
  standardModel: "google/gemini-2.5-flash",
  fastModel: "google/gemini-2.5-flash-lite",
  route: "openrouter",
};
const mock = vi.mocked(invoke);
const renderForm = () =>
  render(
    <ConnectionForm
      onBusyChange={vi.fn()}
      onChanged={vi.fn().mockResolvedValue(undefined)}
    />,
  );
beforeEach(() => {
  mock.mockReset();
  mock.mockImplementation(async (command) => {
    if (command === "get_connection") return config;
    if (command === "save_connection")
      return {
        ...config,
        revision: 2,
        ownKeyConfigured: true,
        configured: true,
      };
    return undefined;
  });
});
afterEach(cleanup);
describe("OpenRouter connection", () => {
  it("saves a pasted key with whitespace, clears the field, then verifies the stored credential", async () => {
    renderForm();
    const input = await screen.findByLabelText("OpenRouter API key");
    expect((input as HTMLInputElement).type).toBe("password");
    expect(screen.queryByRole("button", { name: /show.*key/i })).toBeNull();
    fireEvent.change(input, { target: { value: "  sk-or-test-credential  " } });
    await screen.findByText("All changes saved");
    expect(mock).toHaveBeenCalledWith(
      "save_connection",
      expect.objectContaining({ apiKey: "sk-or-test-credential" }),
    );
    await screen.findByLabelText("API key validated");
    expect((input as HTMLInputElement).value).toBe("");
    expect(mock).toHaveBeenCalledWith("verify_openrouter_key", {
      apiKey: null,
      expectedRevision: 2,
    });
  });
  it("keeps a saved key when only a model changes", async () => {
    mock.mockResolvedValueOnce({ ...config, ownKeyConfigured: true });
    renderForm();
    fireEvent.change(
      await screen.findByLabelText(
        "Standard model · Partner and coach replies",
      ),
      { target: { value: "other/model" } },
    );
    await waitFor(() =>
      expect(mock).toHaveBeenCalledWith(
        "save_connection",
        expect.objectContaining({ apiKey: null, standardModel: "other/model" }),
      ),
    );
  });
  it("retains unsaved input on keychain failure and allows retry", async () => {
    mock.mockImplementation(async (command) => {
      if (command === "get_connection") return config;
      if (command === "save_connection")
        throw { message: "Keychain access denied" };
      return undefined;
    });
    renderForm();
    const input = await screen.findByLabelText("OpenRouter API key");
    fireEvent.change(input, { target: { value: "sk-or-test-credential" } });
    await screen.findByText("Keychain access denied");
    expect((input as HTMLInputElement).value).toBe("sk-or-test-credential");
    expect((screen.getByText("Retry save") as HTMLButtonElement).disabled).toBe(
      false,
    );
  });
  it("does not mark a saved key accepted when verification fails", async () => {
    mock.mockImplementation(async (command) => {
      if (command === "get_connection")
        return { ...config, ownKeyConfigured: true };
      if (command === "verify_openrouter_key")
        throw { message: "OpenRouter rejected this API key" };
      return undefined;
    });
    renderForm();
    await screen.findByRole("alert");
    expect(screen.queryByLabelText("API key validated")).toBeNull();
    expect(screen.getByLabelText("API key not validated")).toBeTruthy();
  });
  it("ignores verification for a key that has since changed", async () => {
    let finish: (() => void) | undefined;
    mock.mockImplementation(async (command) => {
      if (command === "get_connection") return config;
      if (command === "save_connection")
        throw { message: "Keychain unavailable" };
      if (command === "verify_openrouter_key")
        return new Promise<void>((resolve) => {
          finish = resolve;
        });
      return undefined;
    });
    renderForm();
    const input = await screen.findByLabelText("OpenRouter API key");
    fireEvent.change(input, { target: { value: "sk-or-first-credential" } });
    await waitFor(() => expect(finish).toBeDefined());
    fireEvent.change(input, { target: { value: "" } });
    finish!();
    await screen.findByLabelText("API key not checked");
    expect(screen.queryByLabelText("API key validated")).toBeNull();
  });
});

it.each([false, true])(
  "clears a failed entry without deleting a saved key (saved=%s)",
  async (ownKeyConfigured) => {
    mock.mockImplementation(async (command) => {
      if (command === "get_connection") return { ...config, ownKeyConfigured };
      if (command === "save_connection") throw { message: "Invalid API key." };
      if (command === "verify_openrouter_key") return;
      throw new Error(`Unexpected command: ${command}`);
    });
    renderForm();
    const input = await screen.findByLabelText("OpenRouter API key");
    fireEvent.change(input, { target: { value: "bad" } });
    await screen.findByText("Invalid API key.");
    fireEvent.click(
      screen.getByRole("button", { name: "Clear OpenRouter API key entry" }),
    );
    expect((input as HTMLInputElement).value).toBe("");
    expect(screen.queryByText("Invalid API key.")).toBeNull();
    expect(document.activeElement).toBe(input);
    expect(mock).not.toHaveBeenCalledWith("disconnect", expect.anything());
  },
);
