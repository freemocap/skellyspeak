// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ExecutionPanel } from "./ExecutionPanel";
import type { ConversationSnapshot } from "./contracts";

afterEach(cleanup);

it("shows the durable refusal and requires explicit recovery without allowing Step", () => {
  const snapshot: ConversationSnapshot = {
    holds: [],
    transcriptionAttempts: [],
    conversationId: "conversation",
    sessionId: "session",
    revision: 1,
    messages: [],
    coachMessages: [],
    hasOlder: false,
    connection: {
      revision: 1,
      route: "hosted",
      configured: true,
      ownKeyConfigured: false,
      signedIn: true,
      email: "",
      standardModel: "standard",
      fastModel: "fast",
      paused: false,
    },
    turns: [
      {
        id: "held-turn",
        route: "hosted",
        state: "pending",
        paused: true,
        operations: [],
        attempts: [],
        hold: {
          code: "provider",
          message: "Daily allowance exhausted.",
          refusal: {
            reason: "daily_limit",
            serviceWide: true,
            retryAt: 2000000000,
            requestId: null,
          },
        },
      },
    ],
  };
  const run = vi.fn().mockResolvedValue(null);
  const { rerender } = render(
    <ExecutionPanel snapshot={snapshot} run={run} busy={false} />,
  );
  expect(screen.getByRole("alert").textContent).toContain(
    "Daily allowance exhausted.",
  );
  expect(screen.getByRole("alert").textContent).toContain("Earliest retry:");
  expect(
    (
      screen.getByRole("button", {
        name: "Step",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  expect(run).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Resume" }));
  expect(run).toHaveBeenCalledExactlyOnceWith({
    kind: "controlTurn",
    turnId: "held-turn",
    control: "resume",
  });
  run.mockClear();
  snapshot.holds = [
    {
      id: "opaque-hold",
      generation: "current-generation",
      route: "hosted",
      error: snapshot.turns[0]!.hold!,
    },
  ];
  rerender(<ExecutionPanel snapshot={snapshot} run={run} busy={false} />);
  expect(run).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Recover access" }));
  expect(run).toHaveBeenCalledExactlyOnceWith({
    kind: "recoverAiAccess",
    holdId: "opaque-hold",
    expectedGeneration: "current-generation",
  });
  run.mockClear();
  snapshot.holds = [];
  snapshot.turns = [];
  snapshot.transcriptionAttempts = [
    {
      id: "audio-receipt",
      route: "hosted",
      model: "audio-model",
      state: "unknown",
      startedAt: "2026-09-10T12:00:00Z",
      finishedAt: "2026-09-10T12:01:00Z",
      error: "Application interrupted. Audio cannot be replayed.",
    },
  ];
  rerender(<ExecutionPanel snapshot={snapshot} run={run} busy={false} />);
  expect(screen.getByText("Transcription · unknown")).toBeTruthy();
  expect(screen.getByRole("alert").textContent).toContain(
    "Audio cannot be replayed",
  );
  expect(run).not.toHaveBeenCalled();
});
