// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SettingsForm } from "./ConversationView";
import type { Conversation } from "./contracts";
const conversation: Conversation = {
  id: "conversation",
  relationshipId: "relationship",
  languageId: "es",
  title: "Chat",
  archived: false,
  revision: 1,
  settingsRevision: 3,
  createdAt: "2026-09-09",
  lastUsed: 0,
  settings: {
    difficulty: "balanced",
    explanationLanguage: "en",
    varietyId: "",
    composingHelp: "balanced",
    coachProactivity: "occasional",
    translation: false,
    pronunciation: false,
    romanization: false,
  },
};
afterEach(cleanup);
it("saves practice changes immediately to this conversation without a submit button", async () => {
  const run = vi.fn().mockResolvedValue({});
  render(
    <SettingsForm
      conversation={conversation}
      languages={[]}
      busy={false}
      run={run}
      error={null}
    />,
  );
  fireEvent.click(screen.getByLabelText("Translation"));
  await waitFor(() =>
    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "updateSettings",
        conversationId: "conversation",
        expectedRevision: 3,
        settings: expect.objectContaining({ translation: true }),
      }),
    ),
  );
  expect(screen.queryByText("Save practice settings")).toBeNull();
});
it("preserves a failed preference change with an explicit retry", async () => {
  const run = vi.fn().mockResolvedValue(null);
  render(
    <SettingsForm
      conversation={conversation}
      languages={[]}
      busy={false}
      run={run}
      error="Write failed"
    />,
  );
  fireEvent.click(screen.getByLabelText("Translation"));
  await screen.findByText("Changes not saved");
  expect(
    (screen.getByLabelText("Translation") as HTMLInputElement).checked,
  ).toBe(true);
  fireEvent.click(screen.getByText("Retry save"));
  await waitFor(() => expect(run).toHaveBeenCalledTimes(2));
});
