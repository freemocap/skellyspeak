# Frontend audit fixes — 2026-09-14

Implemented the five frontend findings FE-1 through FE-5 (integrated audit A03, A06, A07, A09 and A10). Source changes and automated checks are complete; no native application was launched, no deployment was performed, and no live learner data or provider requests were used.

## Implemented behavior

### Reply outcomes and explicit recovery

- Durable turn/reply-operation state now accompanies the message projection. Failed, unknown, cancelled, paused, held and unavailable replies do not render as “Thinking…”. Successful saved word meanings, translations and feedback remain independent.
- Reply-specific provider errors and hold reasons remain visible. Unknown outcomes explicitly describe the possibility of repeated provider work/charges before the user retries.
- The latest eligible failed/unknown exchange offers **Retry exchange**. Paused eligible work offers **Resume exchange**; globally paused work exposes AI activity instead. Cancelled or superseded exchanges cannot invoke invalid retries. Native command validation remains authoritative.
- Controls are explicit: rendering, reopening, reading and retrying a read do not submit inference. The retry label says “exchange” because the existing native control can retry failed sibling assistance as well as the reply, while preserving successful operations.
- The composer distinguishes an outstanding reply admission from actively running reply work, so held/paused reply work does not produce a misleading “Replying…” indicator.

### Contact selection

- Removed the independent selected-contact override. The selected contact and history filter derive from the committed open conversation, including after contact creation, deletion-driven navigation and language changes.
- Existing-contact navigation now waits for pending settings writes, exposes admission errors and blocks duplicate navigation while opening. Failed navigation leaves the previous committed contact selected.

### Read recovery

- Added shared `useConversationSnapshot` observation for the main conversation and private coach.
- Any initial or later snapshot error produces a visible disconnected/read-error state and **Retry reading conversation** action. The last good data and coach draft remain available.
- Retry restarts only the read observer. Generation checks discard old-scope results after navigation/unmount. No inference retry or silent reconnect loop is introduced.

### Bounded older history

- The native 100-message page limit remains. **Load older messages** requests another page with the native `before` cursor and exposes page-loading errors.
- Pages merge by durable message and turn IDs. Newer revisions win over late responses; exchanges split across page boundaries reassemble in the normal projection.
- The observer reloads the explicitly revealed range, one native page at a time, on each live revision. This keeps revision/replacement metadata current and bridges moving live-tail boundaries. A pending older-page request reserves the visible range so even a live jump exceeding 100 messages cannot leave a middle gap.
- Older history prepends without moving the user's reading position. Live updates follow the bottom only when the reader was already there; opening an empty starter surface still starts at the top.
- Native audit fixes separately extended each page's turn metadata to include its message owners, so older failed turns retain errors and controls rather than inventing progress.

### Lesson question preservation

- Lesson questions have draft revisions and conversation/lesson ownership checks. A successful command receipt clears only the unchanged submitted draft, never a newer edit or another lesson's draft. Existing rejection and unmount guards remain.

## Automated verification

Using Node **24.15.0**:

- Seven focused files: **77 tests passed** before the final additional pagination case.
- Final pagination rerun: **7 tests passed**, including the new >100-message live-jump race. Combined focused coverage therefore contains **78 cases**.
- `npx tsc --noEmit`: passed after correcting a test fixture's missing `learnerId`.
- `npm run build`: passed, including language-key validation, TypeScript and Vite. The main chunk remains above Vite's advisory 500kB threshold; this is not a measured runtime performance result.
- Root audit integration owns the final whole-repository frontend test results and shared build/style checks.

Regression coverage includes terminal/held/paused reply state; explicit single command admission; reply failure with independent successful feedback; failed contact navigation and later committed selections; initial/subsequent read errors and explicit recovery; navigation during pending page reads; split exchange/deduplication/revision precedence; delayed pages with newer live replies and multi-page live jumps; retained scrolling; and typing another lesson question before a receipt resolves.

## Limits and follow-up

- Browser/native-device visual behavior, touch/keyboard interactions in the real application, real multiwindow behavior, microphone lifecycle and live provider execution were not exercised by this implementation pass.
- Refreshing history costs one bounded read per loaded page on each live revision. This deliberately preserves correctness for the user-revealed range. If profiling shows large-history overhead, add a native bounded range/watch contract rather than silently dropping history or raising the per-page limit.
- No commits, pushes, tags or deployments were performed by this reviewer.
