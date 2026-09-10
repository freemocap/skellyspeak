import { describe, expect, it } from "vitest";
import { acceptSnapshot, retainDrafts } from "./directory";
import type { Snapshot } from "./contracts";

function snapshot(revision: number, sessionId = "session"): Snapshot {
  return {
    revision,
    sessionId,
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
}

describe("directory reconciliation", () => {
  it("does not regress to an older response from the same session", () => {
    const current = snapshot(12);
    expect(acceptSnapshot(current, snapshot(11))).toBe(current);
    expect(acceptSnapshot(current, snapshot(13)).revision).toBe(13);
  });
  it("accepts an authoritative restarted session instead of comparing unrelated revisions", () => {
    expect(
      acceptSnapshot(snapshot(12), snapshot(1, "restarted")).sessionId,
    ).toBe("restarted");
  });
  it("preserves independent drafts during navigation and removes only deleted sources", () => {
    const drafts = {
      first: "Quiero ir…",
      second: "A different conversation",
      removed: "Private text",
    };
    expect(retainDrafts(drafts, new Set(["first", "second"]))).toEqual({
      first: "Quiero ir…",
      second: "A different conversation",
    });
    expect(retainDrafts(drafts, new Set())).toEqual({});
  });
});
