// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { KeyBadge } from "./KeyBadge";
afterEach(cleanup);
it("requires confirmation and supports cancellation before deleting a saved key", () => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  const remove = vi.fn();
  render(
    <KeyBadge
      state="valid"
      label="Groq API key"
      detail="Accepted"
      configured
      disabled={false}
      onRemove={remove}
    />,
  );
  const icon = screen.getByRole("button", { name: "Delete Groq API key" });
  fireEvent.click(icon);
  expect(remove).not.toHaveBeenCalled();
  expect(
    screen.getByRole("dialog", { name: "Delete Groq API key?" }),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(remove).not.toHaveBeenCalled();
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(icon);
  fireEvent.click(screen.getByRole("button", { name: "Delete key" }));
  expect(remove).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("dialog")).toBeNull();
});
it("does not offer deletion for an unsaved replacement key", () => {
  render(
    <KeyBadge
      state="valid"
      label="Groq API key"
      detail="Accepted"
      configured={false}
      disabled={false}
      onRemove={vi.fn()}
    />,
  );
  expect(
    screen.queryByRole("button", { name: "Delete Groq API key" }),
  ).toBeNull();
});
