# Additional integration finding: AI activity scope — 2026-09-12

Verified that both the desktop LogsOverlay dock and DevWindow render LiveActivity without a conversation key; they remain mounted when native selection changes. LiveActivity previously captured the selected conversation once and watched it indefinitely. An initially empty workspace also ended the inspector's loop permanently.

Fixed LiveActivity to re-read the native directory after each conversation watch and before accepting its result. Native conversation snapshots carry the global metadata revision, so selection changes wake the existing watch. Abandoned responses/errors are rejected and the next selected conversation starts from revision -1 with cleared graph/exchange selection. Empty workspaces use a 500ms directory check until a conversation exists. There is one watch loop, no new shared selection authority or concurrent subscription. Unmount guards prevent delayed results from restarting reads.

Verification: five LiveActivity tests passed, covering durable dependency rendering, mounted conversation switches and abandoned results, empty-to-selected transition, stale versus current scope errors, and pending response completion after unmount. No CSS changes or real UI inspection were performed.
