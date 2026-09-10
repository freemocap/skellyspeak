import { useState } from "react";
import type { Conversation, Relationship } from "./contracts";

export function ConversationList({
  conversations,
  relationship,
  busy,
  open,
  create,
}: {
  conversations: Conversation[];
  relationship: Relationship;
  busy: boolean;
  open: (item: Conversation) => Promise<void>;
  create: () => void;
}) {
  const [archived, setArchived] = useState(false);
  const [sort, setSort] = useState("recent");
  const visible = conversations
    .filter((c) => c.archived === archived)
    .sort((a, b) =>
      sort === "name"
        ? a.title.localeCompare(b.title)
        : sort === "oldest"
          ? a.createdAt.localeCompare(b.createdAt)
          : b.lastUsed - a.lastUsed,
    );
  return (
    <section className="conversations">
      <div className="section-heading">
        <div>
          <h2>Conversations</h2>
        </div>
        <button
          className="primary"
          disabled={busy || relationship.archived}
          onClick={create}
        >
          ＋ New conversation
        </button>
      </div>
      <div className="list-controls">
        <label className="check">
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) => setArchived(e.target.checked)}
          />
          Archived conversations
        </label>
        <label>
          Sort{" "}
          <select
            aria-label="Sort conversations"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="recent">Recently used</option>
            <option value="oldest">Oldest first</option>
            <option value="name">Title</option>
          </select>
        </label>
      </div>
      {visible.length ? (
        <div className="conversation-grid">
          {visible.map((item, index) => (
            <button
              disabled={busy}
              key={item.id}
              className="conversation-card"
              onClick={() => {
                void open(item);
              }}
            >
              <span className="card-number">
                {String(index + 1).padStart(2, "0")} <span>↗</span>
              </span>
              <h3 dir="auto">{item.title}</h3>
              <span className="difficulty">{item.settings.difficulty}</span>
              <span className="small muted">
                {item.settings.translation
                  ? "Translation on"
                  : "Translation off"}{" "}
                ·{" "}
                {new Date(item.createdAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h3>{archived ? "No archived conversations" : "No conversations"}</h3>
          <p>
            {archived
              ? "Archived conversations stay available here."
              : "Create a conversation to set its difficulty and practice preferences."}
          </p>
        </div>
      )}
    </section>
  );
}
