import { useEffect, useRef, useState } from "react";
import type { Conversation } from "./contracts";
import { Avatar } from "./Avatar";
import { Modal } from "./Modal";
import { retainDrafts } from "./directory";
import { useDirectory } from "./useDirectory";
import { Field, LanguageSelect, ErrorNotice } from "./Fields";
import { Onboarding } from "./Onboarding";
import { ConversationList } from "./ConversationList";
import { ConversationView } from "./ConversationView";
import { PartnerForm } from "./PartnerForms";
import "./styles.css";
import logo from "../assets/skellyspeak-logo.png";
import { useChat } from "./useChat";
import { useAccount } from "./useAccount";
import { SettingsDialog } from "./SettingsDialog";
import { ProfilePanel } from "./ProfilePanel";
import { AiDock } from "./AiWorkspace";
import { LearningPanel } from "./LearningPanel";

export default function App() {
  const { snapshot, error, busy, run, pending, recover, clearError, refresh } =
    useDirectory();
  const [selectedPartner, setSelectedPartner] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<
    string | null
  >(null);
  const initialized = useRef(false);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [surface, setSurface] = useState<"chat" | "panel">("chat");
  const chat = useChat(selectedConversation, refresh);
  const account = useAccount(chat.snapshot?.turns[0]?.state);
  const [aiOpen, setAiOpen] = useState(false);
  const [language, setLanguage] = useState("es");
  const [showArchive, setShowArchive] = useState(false);
  const [modal, setModal] = useState<
    | "profile"
    | "connection"
    | "partner"
    | "preferences"
    | "deletePartner"
    | "deleteConversation"
    | null
  >(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!chooserOpen) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape") setChooserOpen(false);
    };
    window.addEventListener("keydown", dismiss);
    return () => window.removeEventListener("keydown", dismiss);
  }, [chooserOpen]);
  useEffect(() => {
    const preferences = snapshot?.learner.preferences;
    document.documentElement.style.setProperty(
      "--reading-scale",
      String((preferences?.textSize ?? 100) / 100),
    );
    document.documentElement.style.setProperty(
      "--reading-spacing",
      `${preferences?.textSpacing ?? 0}px`,
    );
  }, [
    snapshot?.learner.preferences.textSize,
    snapshot?.learner.preferences.textSpacing,
  ]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.repeat) return;
      if (document.querySelector("dialog[open]")) return;
      if (event.key === ",") {
        event.preventDefault();
        setModal("preferences");
      } else if (event.shiftKey && event.key.toLowerCase() === "a") {
        event.preventDefault();
        setAiOpen((open) => !open);
      } else if (event.shiftKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setModal("profile");
      } else if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        window.location.reload();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  useEffect(() => {
    if (!snapshot) return;
    if (!initialized.current) {
      initialized.current = true;
      const recent = snapshot.conversations
        .filter(
          (c) =>
            !c.archived &&
            snapshot.relationships.some(
              (r) => r.id === c.relationshipId && !r.archived,
            ),
        )
        .sort((a, b) => b.lastUsed - a.lastUsed)[0];
      if (recent) {
        setSelectedConversation(recent.id);
        setSelectedPartner(
          snapshot.relationships.find((r) => r.id === recent.relationshipId)!
            .partnerId,
        );
      }
    }
    setDrafts((current) =>
      retainDrafts(current, new Set(snapshot.conversations.map((c) => c.id))),
    );
    if (
      selectedPartner &&
      !snapshot.partners.some((p) => p.id === selectedPartner)
    ) {
      setSelectedPartner(null);
      setSelectedConversation(null);
    }
    if (
      selectedConversation &&
      !snapshot.conversations.some((c) => c.id === selectedConversation)
    )
      setSelectedConversation(null);
  }, [snapshot, selectedPartner, selectedConversation]);

  if (!snapshot)
    return (
      <main className="startup">
        <img src={logo} width="72" height="72" alt="" />
        <h1>SkellySpeak</h1>
        <p>
          {error
            ? "The local workspace could not open."
            : "Opening your local workspace…"}
        </p>
        <ErrorNotice error={error} />
      </main>
    );
  const preferences = snapshot.learner.preferences;
  const selected = snapshot.conversations.find(
    (c) => c.id === selectedConversation,
  );
  const activePartner = selected
    ? snapshot.relationships.find((r) => r.id === selected.relationshipId)
        ?.partnerId
    : selectedPartner;
  const partner = snapshot.partners.find((p) => p.id === activePartner);
  const relationship = snapshot.relationships.find(
    (r) => r.partnerId === partner?.id,
  );
  const conversation = snapshot.conversations.find(
    (c) =>
      c.id === selectedConversation && c.relationshipId === relationship?.id,
  );
  const partnerConversations = snapshot.conversations.filter(
    (c) => c.relationshipId === relationship?.id,
  );
  const visiblePartners = snapshot.partners.filter((p) =>
    snapshot.relationships.some(
      (r) => r.partnerId === p.id && r.archived === showArchive,
    ),
  );
  const selectChat = (id: string) => {
    setSelectedConversation(id);
    setChooserOpen(false);
    setSurface("chat");
  };
  const choosePartner = (id: string) => {
    setSelectedPartner(id);
    clearError();
    const relation = snapshot.relationships.find((r) => r.partnerId === id)!;
    if (relation.archived) {
      setSelectedConversation(null);
      return;
    }
    const recent = snapshot.conversations
      .filter((c) => c.relationshipId === relation.id && !c.archived)
      .sort((a, b) => b.lastUsed - a.lastUsed)[0];
    void run(
      recent
        ? { kind: "openConversation", conversationId: recent.id }
        : {
            kind: "createConversation",
            relationshipId: relation.id,
            title: "New conversation",
          },
    ).then((receipt) => {
      if (receipt) selectChat(receipt.entityId);
    });
  };
  const newConversation = () => {
    if (!relationship) return;
    void run({
      kind: "createConversation",
      relationshipId: relationship.id,
      title: "New conversation",
    }).then((receipt) => {
      if (receipt) selectChat(receipt.entityId);
    });
  };
  const openModal = (value: typeof modal) => {
    clearError();
    setModal(value);
  };
  const close = () => {
    if (!busy) {
      setModal(null);
      clearError();
    }
  };
  const recovery = pending ? (
    <button
      className="primary"
      disabled={busy}
      onClick={() => {
        const action = pending.action;
        void recover().then((receipt) => {
          if (!receipt) return;
          setModal(null);
          if (action.kind === "sendMessage") {
            setDrafts((current) =>
              current[action.conversationId] === action.text
                ? { ...current, [action.conversationId]: "" }
                : current,
            );
          }
          if (action.kind === "createPartner") {
            setShowArchive(false);
            choosePartner(receipt.entityId);
          }
          if (
            action.kind === "startChat" ||
            action.kind === "createConversation" ||
            action.kind === "openConversation"
          )
            setSelectedConversation(receipt.entityId);
        });
      }}
    >
      Recover action
    </button>
  ) : null;
  const openConversation = async (item: Conversation) => {
    const receipt = await run({
      kind: "openConversation",
      conversationId: item.id,
    });
    if (receipt) {
      setSelectedConversation(item.id);
      setChooserOpen(false);
      setSurface("chat");
    }
  };
  return (
    <div className={`app ${preferences.highContrast ? "high-contrast" : ""}`}>
      <header className="app-header">
        <button
          className="icon-button"
          aria-label="Choose partner"
          aria-expanded={chooserOpen}
          onClick={() => setChooserOpen(!chooserOpen)}
        >
          ☰
        </button>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setChooserOpen(false);
          }}
        >
          <img src={logo} width="34" height="34" alt="" />
          <span>
            SKELLYSPEAK<b>·</b>
          </span>
        </a>
        <div className="header-actions">
          <span className="navigation-label">Guided conversation</span>
          <button
            className={`inside-btn ${aiOpen ? "open" : ""}`}
            aria-expanded={aiOpen}
            onClick={() => setAiOpen(!aiOpen)}
          >
            <span className="inside-dot" />
            AI
          </button>
          <button
            className="account-trigger"
            onClick={() => openModal("connection")}
            title={account.error ?? "Hosted account and token status"}
          >
            {account.account
              ? `${account.account.tokensToday.toLocaleString()} tokens`
              : account.config?.signedIn
                ? "Account"
                : "Sign in"}
          </button>
          <button
            className="quiet"
            aria-label="Reload app"
            onClick={() => window.location.reload()}
          >
            ↻
          </button>
          <button className="quiet" onClick={() => openModal("preferences")}>
            ⚙ Settings
          </button>
          <button
            aria-label="Open profile"
            onClick={() => openModal("profile")}
          >
            ◎ Profile
          </button>
        </div>
      </header>
      <div className={`workspace mobile-${surface}`}>
        <aside
          className={`sidebar ${chooserOpen ? "open" : ""}`}
          aria-label="Conversation partners"
          hidden={!chooserOpen}
        >
          <div className="section-heading">
            <h2>
              Partners <span className="count">{visiblePartners.length}</span>
            </h2>
            <button
              aria-label="Close partner chooser"
              onClick={() => setChooserOpen(false)}
            >
              ×
            </button>
          </div>
          <div className="create-partner">
            <Field label="Practice language">
              <LanguageSelect
                languages={snapshot.languages}
                value={language}
                onChange={setLanguage}
              />
            </Field>
            <button
              className="primary full"
              disabled={busy}
              onClick={() => {
                void run({ kind: "startChat", languageId: language }).then(
                  (receipt) => {
                    if (receipt) {
                      setShowArchive(false);
                      setSelectedPartner(null);
                      selectChat(receipt.entityId);
                    }
                  },
                );
              }}
            >
              ＋ New partner
            </button>
          </div>
          <div className="segmented" aria-label="Partner filter">
            <button
              aria-pressed={!showArchive}
              onClick={() => {
                setShowArchive(false);
                setSelectedConversation(null);
                setSelectedPartner(null);
              }}
            >
              Active
            </button>
            <button
              aria-pressed={showArchive}
              onClick={() => {
                setShowArchive(true);
                setSelectedConversation(null);
                setSelectedPartner(null);
              }}
            >
              Archived
            </button>
          </div>
          <nav className="partner-list" aria-label="Partners">
            {visiblePartners.map((item) => (
              <button
                key={item.id}
                className={`partner-row ${partner?.id === item.id ? "selected" : ""}`}
                aria-current={partner?.id === item.id ? "true" : undefined}
                disabled={busy}
                onClick={() => choosePartner(item.id)}
              >
                <Avatar recipe={item.details.avatar} />
                <span>
                  <strong dir="auto">{item.details.name}</strong>
                  <small>
                    {
                      snapshot.languages.find((l) => l.id === item.languageId)
                        ?.name
                    }
                  </small>
                </span>
              </button>
            ))}
          </nav>
          {visiblePartners.length === 0 && (
            <p className="muted small">
              {showArchive
                ? "No archived partners."
                : "Your partners will appear here."}
            </p>
          )}
        </aside>
        <main className="main-panel">
          {!modal && (
            <>
              <ErrorNotice error={error} />
              {recovery}
            </>
          )}
          {(preferences.onboarding === "not_started" ||
            preferences.onboarding === "in_progress") && (
            <Onboarding learner={snapshot.learner} run={run} busy={busy} />
          )}
          {partner && relationship ? (
            <>
              {!conversation && (
                <>
                  <section className="partner-heading">
                    <Avatar recipe={partner.details.avatar} size={32} />
                    <div className="partner-title">
                      <span className="eyebrow">
                        {
                          snapshot.languages.find(
                            (l) => l.id === partner.languageId,
                          )?.name
                        }{" "}
                        · Conversation partner
                      </span>
                      <h1 dir="auto">{partner.details.name}</h1>
                    </div>
                    <button
                      className="quiet"
                      onClick={() => openModal("partner")}
                    >
                      Edit partner
                    </button>
                  </section>
                </>
              )}
              {relationship.archived && (
                <div className="notice">
                  This partner is archived.{" "}
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => {
                      void run({
                        kind: "setRelationshipArchived",
                        relationshipId: relationship.id,
                        expectedRevision: relationship.revision,
                        archived: false,
                      }).then((receipt) => {
                        if (receipt) setShowArchive(false);
                      });
                    }}
                  >
                    Restore partner
                  </button>
                </div>
              )}
              {conversation ? (
                <ConversationView
                  key={conversation.id}
                  chat={chat}
                  connection={() => openModal("connection")}
                  conversation={conversation}
                  partner={partner}
                  languages={snapshot.languages}
                  busy={busy}
                  run={run}
                  error={error}
                  back={() => setSelectedConversation(null)}
                  create={newConversation}
                  draft={drafts[conversation.id] ?? ""}
                  setDraft={(value) =>
                    setDrafts((current) => ({
                      ...current,
                      [conversation.id]: value,
                    }))
                  }
                  remove={() => openModal("deleteConversation")}
                />
              ) : (
                <ConversationList
                  conversations={partnerConversations}
                  relationship={relationship}
                  busy={busy}
                  open={openConversation}
                  create={newConversation}
                />
              )}
              {!conversation && (
                <footer className="partner-footer">
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => {
                      void run({
                        kind: "setRelationshipArchived",
                        relationshipId: relationship.id,
                        expectedRevision: relationship.revision,
                        archived: !relationship.archived,
                      }).then((receipt) => {
                        if (receipt) {
                          setSelectedPartner(null);
                          setSelectedConversation(null);
                        }
                      });
                    }}
                  >
                    {relationship.archived
                      ? "Restore partner"
                      : "Archive partner"}
                  </button>
                  <button
                    className="text-button danger"
                    onClick={() => openModal("deletePartner")}
                  >
                    Delete partner
                  </button>
                </footer>
              )}
            </>
          ) : (
            <section className="empty-chat">
              <div className="empty-chat-heading">Guided conversation</div>
              <div className="conversation-canvas">
                <p>Choose a partner to open a conversation.</p>
                <button onClick={() => setChooserOpen(true)}>
                  Choose partner
                </button>
              </div>
              <div className="composer">
                <textarea
                  disabled
                  aria-label="Message"
                  placeholder="Choose a conversation to write a message…"
                  rows={2}
                />
                <div>
                  <span className="muted small">
                    Configure AI connection, then select a conversation.
                  </span>
                  <button disabled>Send ↗</button>
                </div>
              </div>
            </section>
          )}
        </main>
        <LearningPanel
          conversation={conversation}
          chat={chat.snapshot}
          run={run}
          busy={busy}
          error={error}
          connection={() => openModal("connection")}
          editPartner={() => openModal("partner")}
        />
      </div>
      <nav className="mobile-nav" aria-label="Workspace view">
        <button
          aria-pressed={surface === "chat"}
          onClick={() => setSurface("chat")}
        >
          Chat
        </button>
        <button
          aria-pressed={surface === "panel"}
          onClick={() => setSurface("panel")}
        >
          Lesson
        </button>
      </nav>
      {aiOpen && (
        <AiDock
          directory={snapshot}
          run={run}
          busy={busy}
          refresh={refresh}
          close={() => setAiOpen(false)}
        />
      )}
      <div className="save-status" role="status">
        {busy ? "Saving…" : ""}
      </div>
      {(modal === "connection" || modal === "preferences") && (
        <SettingsDialog
          snapshot={snapshot}
          run={run}
          busy={busy}
          error={error}
          recovery={recovery}
          account={account}
          initial={modal === "connection" ? "account" : "reading"}
          close={close}
        />
      )}
      {modal === "profile" && (
        <Modal
          recovery={recovery}
          title="Profile · Activity & language"
          close={close}
          busy={busy}
        >
          <ProfilePanel />
        </Modal>
      )}
      {modal === "partner" && partner && (
        <Modal
          recovery={recovery}
          title="Edit partner"
          close={close}
          busy={busy}
        >
          <PartnerForm
            partner={partner}
            busy={busy}
            run={run}
            done={close}
            error={error}
          />
        </Modal>
      )}
      {modal === "deletePartner" && partner && (
        <Modal
          recovery={recovery}
          title={`Delete ${partner.details.name}?`}
          close={close}
          busy={busy}
        >
          <p>
            This removes this partner, their relationship, and all{" "}
            {partnerConversations.length} conversation
            {partnerConversations.length === 1 ? "" : "s"} and settings from
            this device. This cannot be undone.
          </p>
          <ErrorNotice error={error} />
          <div className="form-actions">
            <button onClick={close} disabled={busy}>
              Keep partner
            </button>
            <button
              className="destructive"
              disabled={busy}
              onClick={() => {
                void run({
                  kind: "deletePartner",
                  partnerId: partner.id,
                  expectedRevision: partner.revision,
                }).then((receipt) => {
                  if (receipt) setModal(null);
                });
              }}
            >
              Delete partner
            </button>
          </div>
        </Modal>
      )}
      {modal === "deleteConversation" && conversation && (
        <Modal
          recovery={recovery}
          title="Delete conversation?"
          close={close}
          busy={busy}
        >
          <p>
            Remove “{conversation.title}”, its settings and the unsent draft
            from this device? This cannot be undone.
          </p>
          <ErrorNotice error={error} />
          <div className="form-actions">
            <button onClick={close} disabled={busy}>
              Keep conversation
            </button>
            <button
              className="destructive"
              disabled={busy}
              onClick={() => {
                void run({
                  kind: "deleteConversation",
                  conversationId: conversation.id,
                  expectedRevision: conversation.revision,
                }).then((receipt) => {
                  if (receipt) setModal(null);
                });
              }}
            >
              Delete conversation
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
