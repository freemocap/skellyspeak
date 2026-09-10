import { useState } from "react";
import type { Partner, PartnerDetails } from "./contracts";
import type { Run } from "./useDirectory";
import { Field, ErrorNotice } from "./Fields";
import { Avatar } from "./Avatar";

const vibes = ["🌿", "☀️", "🌊", "📚", "🎵", "🚲", "🍵", "🌙", "🏔️", "🎨"];
const vibeLabels = [
  "Leaves",
  "Sun",
  "Ocean",
  "Books",
  "Music",
  "Bicycle",
  "Tea",
  "Moon",
  "Mountain",
  "Art",
];
export function PartnerForm({
  partner,
  busy,
  run,
  done,
  error,
}: {
  partner: Partner;
  busy: boolean;
  run: Run;
  done: () => void;
  error: string | null;
}) {
  const [details, setDetails] = useState<PartnerDetails>(partner.details);
  const [revision] = useState(partner.revision);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void run({
          kind: "updatePartner",
          partnerId: partner.id,
          expectedRevision: revision,
          details,
        }).then((receipt) => {
          if (receipt) done();
        });
      }}
    >
      <Field label="Name">
        <input
          autoFocus
          dir="auto"
          required
          maxLength={80}
          value={details.name}
          onChange={(e) => setDetails({ ...details, name: e.target.value })}
        />
      </Field>
      <Field label="Background">
        <textarea
          maxLength={2000}
          rows={3}
          value={details.background}
          onChange={(e) =>
            setDetails({ ...details, background: e.target.value })
          }
        />
      </Field>
      <p className="small muted">
        Background stays unobtrusive; it should come up when relevant or asked
        about.
      </p>
      <Field label="Conversational tendencies">
        <textarea
          maxLength={600}
          rows={2}
          value={details.tendencies}
          onChange={(e) =>
            setDetails({ ...details, tendencies: e.target.value })
          }
        />
      </Field>
      <fieldset>
        <legend>
          Authored Vibe <span className="muted small">Choose up to eight</span>
        </legend>
        <div className="vibe-options">
          {vibes.map((vibe, index) => (
            <button
              key={vibe}
              type="button"
              aria-label={vibeLabels[index]}
              aria-pressed={details.vibe.includes(vibe)}
              disabled={
                !details.vibe.includes(vibe) && details.vibe.length >= 8
              }
              onClick={() =>
                setDetails({
                  ...details,
                  vibe: details.vibe.includes(vibe)
                    ? details.vibe.filter((v) => v !== vibe)
                    : [...details.vibe, vibe],
                })
              }
            >
              {vibe}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>Avatar</legend>
        <div className="avatar-editor">
          <Avatar recipe={details.avatar} size={100} />
          <div>
            <Field label="Color">
              <input
                type="range"
                min="0"
                max="359"
                value={details.avatar.hue}
                onChange={(e) =>
                  setDetails({
                    ...details,
                    avatar: { ...details.avatar, hue: Number(e.target.value) },
                  })
                }
              />
            </Field>
            <Field label="Shape">
              <input
                type="range"
                min="3"
                max="9"
                value={details.avatar.lobes}
                onChange={(e) =>
                  setDetails({
                    ...details,
                    avatar: {
                      ...details.avatar,
                      lobes: Number(e.target.value),
                    },
                  })
                }
              />
            </Field>
          </div>
        </div>
      </fieldset>
      <ErrorNotice error={error} />
      <div className="form-actions">
        <button className="primary" disabled={busy}>
          Save partner
        </button>
      </div>
    </form>
  );
}
