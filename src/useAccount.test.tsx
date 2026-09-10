// @vitest-environment jsdom
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { useAccount } from "./useAccount";
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.mocked(invoke).mockReset();
});
it("does not contact hosted allowance when the selected route uses an own key", async () => {
  vi.mocked(invoke).mockResolvedValue({
    signedIn: true,
    route: "openrouter",
    revision: 1,
  });
  const { result } = renderHook(() => useAccount(undefined));
  await waitFor(() => expect(result.current.config?.route).toBe("openrouter"));
  expect(invoke).toHaveBeenCalledTimes(1);
  expect(invoke).toHaveBeenCalledWith("get_connection");
  expect(result.current.error).toBeNull();
});
it("reports a hosted allowance error on the hosted route", async () => {
  vi.mocked(invoke)
    .mockResolvedValueOnce({ signedIn: true, route: "hosted", revision: 1 })
    .mockRejectedValueOnce({ message: "Hosted unavailable" });
  const { result } = renderHook(() => useAccount(undefined));
  await waitFor(() => expect(result.current.error).toBe("Hosted unavailable"));
});
