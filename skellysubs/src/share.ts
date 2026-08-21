import type { ChatTurn } from "./types";

export function formatTurns(turns: ChatTurn[]): string {
  const lines: string[] = [];
  lines.push("# SkellySubs Session");

  if (turns.length === 0) {
    return lines.join("\n");
  }

  const cardLines: string[] = [];
  const seenCards = new Set<string>();

  for (const t of turns) {
    lines.push("");
    if (t.role === "user") {
      lines.push("**You:** " + t.text);
    } else {
      lines.push("**Tutor:** " + t.text);
      const turn = t.turn;
      if (turn) {
        if (turn.new_words.length > 0) {
          lines.push("");
          lines.push("*New words (i+1):* " + turn.new_words.join(", "));
        }
        if (turn.analysis.features.length > 0) {
          lines.push("");
          lines.push(
            "*Features:* " +
              turn.analysis.features.map((f) => f.key + "=" + f.value).join(", ")
          );
        }
        if (turn.analysis.tokens.length > 0) {
          lines.push("");
          lines.push(
            "*Word by word:* " +
              turn.analysis.tokens
                .map((tok) => (tok.gloss ? tok.text + " = " + tok.gloss : tok.text))
                .join(" · ")
          );
        }
        for (const c of turn.cards) {
          if (!seenCards.has(c.id)) {
            seenCards.add(c.id);
            cardLines.push(
              "- **" + c.title + "** (" + c.cefr + "): " + c.explanation
            );
          }
        }
      }
    }
    lines.push("");
    lines.push("---");
  }

  if (cardLines.length > 0) {
    lines.push("");
    lines.push("## Mechanics");
    for (const c of cardLines) {
      lines.push("");
      lines.push(c);
    }
  }

  return lines.join("\n");
}

export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
}
