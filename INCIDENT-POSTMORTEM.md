# Hosted chat incident post-mortem — September 9–10, 2026

Status: evidence-based partial reconstruction. The request storm and rollout failure
are established; the exact exhausted counter and initiating client action are not.
No version gate or runtime behavior was changed for this investigation.

## What happened

The strongest explanation is a large volume of client-generated work reaching an
application spending/admission limit, followed by a further request storm against
the refusing service. Recovery was delayed by unsuccessful deployments and missing
per-request diagnosis. This is not proof that Google Cloud imposed a persistent
platform-level ban or that one user message caused thousands of calls.

The supplied server export has 4,778 entries and 1,590 HTTP request records. All
257 HTTP 429s have matching Uvicorn application access-log entries. There are 1,236
chat HTTP 200s and 253 chat 429s, plus seven successful and four refused transcription
requests. No upstream-429 or unknown-usage error messages were found in this export.
HTTP 200 on a streaming response is not proof that its complete stream succeeded.

## Timeline

Times below are Eastern daylight time (UTC−4), September 9 unless stated otherwise.
Cloud Run HTTP timestamps identify request start times, not completion times.

| Time | Evidence |
| --- | --- |
| Sept 4, 00:29 UTC | Last successful automated deployment before the incident: workflow 33821791285, source commit 75ccd1d, build b5131183-669e-412d-ae48-762fadae2092. This is not enough to map the incident revision to that source. |
| Sept 6–9 | Subsequent deploy actions failed. A Sept 6 run failed at Firestore emulator startup; Sept 9 03:20 UTC run reached Cloud Build but failed its verification step. |
| 06:47:02 AM | Export begins; it cannot establish the first failure before this window. |
| 08:00–08:59 AM | 289 successful chat request records. |
| 09:00–09:59 AM | 488 successful chat request records. |
| 10:12 AM minute | 195 successful chat request records. |
| 10:15:19.674 AM | Last successful chat request start in the export. |
| 10:15:21.214 AM | First chat 429 start in the export, on revision skellyspeak-api-00011-r75. |
| 10:28:16–10:28:33 AM | 232 refused chat requests; 115 started in the 10:28:19 second alone. This burst occurs after the first refusal. |
| 10:34:19 AM | Code archive commit 93354be. The observed first 429 and storm predate this move. |
| Through 07:24 PM | Further isolated chat requests return 429; account reads and health still succeed. |
| Sept 10, 06:14 AM | Service update lists latest-created 00014-z9x, but 100% traffic remains on 00011-r75. Service Ready is true; that does not verify the intended revision is serving. |
| Sept 10, 07:05 AM | Workflow 34468821350 verifies the exact image/revision and promotes it to 100%; health and authentication checks pass. User subsequently confirms hosted chat works. |

The export's September 10 portion contains no chat requests. It cannot establish
whether the previous serving revision would have admitted a chat after the UTC daily
reset. The successful recovery involves both a later day and a new deployment; we
cannot attribute the disappearance of the 429 solely to a code change.

## Which code was running?

**Server revision: proven.** Every incident chat record names
`skellyspeak-api-00011-r75`. Its exact source commit is not established by the export.
The last successful GitHub deployment is a candidate, not proof: manual deployments
or partially successful jobs can create revisions outside that sequence. The audit
tag and service template are not evidence of the image receiving normal traffic.

**Client version: unproven.** Version 0.13.4 (commit 5f2adbf) was published before the
morning activity; 0.13.5 (3d300e8) was committed at 09:46 AM, before the first observed
429. Either installed builds, an uncommitted development build or another device
could have sent the requests. HTTP logs have no version or operation fields. The
reviewed client attached its version to account lookup, but not chat requests.

The retained local trace archive covers September 7–8 (300 operations, versions
0.7.0–0.10.2); the retained native log ends September 8 and contains no 429 lines.
These cannot identify the September 9 initiating action. Trace prompts, output,
credentials and user identities were not included in this report.

## Concrete client amplification mechanisms

Verified in the source at 0.13.4 and the later reference snapshot:

1. `ai.rs` automatically retries every HTTP 429 once after a fixed three seconds,
   in both streaming and structured request paths. It does not distinguish a daily
   budget refusal from a transient rate limit. It does not honor a longer reset.
2. Structured output can make up to three validation/parse attempts. These multiply
   successful-but-invalid model responses. An HTTP request error exits this repair
   loop; the code does **not** retry the same 429 indefinitely through that loop.
3. A conversation turn fans out into multiple analysis/background operations.
   One visible message is therefore not one provider request.
4. `gate::resume` opens the gate and wakes all waiters. The reviewed request path
   has no global concurrency semaphore comparable to the current two-request
   scheduler. Releasing accumulated work can create a synchronized burst.

These mechanisms explain how the architecture could amplify traffic. They do not
prove which one produced the 115-request second, whether resume was clicked, or
that a render loop launched work. The twofold 429 retry alone cannot explain hundreds
of calls from one ordinary operation; additional queued/new logical operations or
clients would be necessary. No specific infinite request loop was established.

## Why the limit most likely persisted

The first refusals occur after heavy successful inference, affect both chat and
transcription, and persist during much quieter periods while account lookup succeeds.
That fits a shared or personal daily spending/admission condition more closely than
a one-minute throttle. The reviewed candidate server implementations contain daily
budget checks; their exact relevance depends on identifying the serving image.
No reason body or historical counter snapshot was supplied, so the specific condition
remains unresolved. We should not reset accounting merely to manufacture a diagnosis.

Cloud Run can itself produce 429 when capacity is unavailable, but those are distinct
from application-generated refusals. See [Google's troubleshooting guidance](https://docs.cloud.google.com/run/docs/troubleshooting).
The application access logs are the important discriminator here.

## Why diagnosis/recovery took too long

- HTTP 429 collapsed several different conditions into one visible symptom.
- Health checked liveness, while sign-in/account reads exercised different paths
  from paid inference. Their success could not establish chat readiness.
- Repeated deployment failures left traffic on a different revision from the
  source being discussed. Service Ready and an image build were insufficient checks.
- Server logs lacked bounded operation/version metadata and rejection codes.
- The investigation initially spoke too confidently about a candidate startup
  failure. The export only establishes a readiness/routing mismatch, not a crash.
- A missing untracked deployment helper caused an additional CI failure. An
  explicit Git command alone did not establish that its file was actually committed.

## Protection and recovery now

Implemented controls include two active requests per app, atomic attempt admission,
no automatic retry of failed/unknown outcomes, per-subject/process ingress bounds,
durable personal/shared daily admission, transactional spending reservation,
revocation checks, structured refusal codes/request IDs and authenticated diagnostics.
Exact revision/image verification and explicit traffic promotion make deployment
identity testable. These protect the server independently of an honest client build.

They do not eliminate noisy-client effects. Signed requests that reach admission
still consume daily attempt quotas before later rejection; one repeatedly retrying
client can consume its own allowance, and enough clients can affect shared capacity.
Diagnostics have a separate daily lane but share signed short-window capacity.
Old installed clients can still reach the public service with valid sessions.
Per-process limits are not distributed edge DDoS protection or a hard GCP cost cap.

On recurrence: inspect the structured code and authenticated diagnostics first.
A short-window throttle calls for stopping the noisy client and waiting its stated
interval. A daily limit needs an intentional allowance decision or the UTC reset.
SPENDING_PAUSED requires billing reconciliation; restart must not silently clear it.
An individual session/account can be revoked if necessary. A wrong serving revision
requires a verified rollout. These are different recovery actions.

## Proposed prevention, not implemented by this investigation

1. Add bounded, validated client build/protocol and operation-type fields to request
   metadata. Correlate a logical operation and attempt without logging message text,
   keys, raw URLs or identifying account data. Keep private per-account abuse metrics
   access-controlled and retained only as necessary.
2. Add an authenticated, distributed per-account in-flight limit and a bounded queue,
   and preserve diagnostics capacity during paid-call floods. Choose numbers using
   measured graph fan-out before expanding analysis operations.
3. Add regression/load scenarios: repeated refusal must not auto-dispatch; resume
   must respect global capacity; a many-node turn cannot exceed its request budget;
   retries cannot duplicate a logical attempt; a noisy client cannot consume another
   account's personal quota. Use fake providers/emulators, not paid production load.
4. Consider a configurable **client protocol gate** on inference endpoints, returning
   a stable CLIENT_UPDATE_REQUIRED error before provider work. Keep sign-in/status
   usable. Missing/unsupported protocol handling must be explicit; no silent bypass.
   A version header is spoofable and is not an authentication or abuse boundary.
   This helps retire buggy cooperative clients; rate/budget limits remain necessary.
5. Do not implement a naive minimum app-semver threshold: the current package version
   is 0.1.0, while the earlier client reached 0.13.5. Use a separately monotonic API
   protocol generation or an explicit compatibility policy, not chronological guesses
   from package version numbers.

This is consistent with [OWASP resource and rate-limiting guidance](https://owasp.org/API-Security/editions/2019/en/0xa4-lack-of-resources-and-rate-limiting/).
The proposals require focused implementation decisions; none is presented as deployed.

## Two optional console checks to close the evidence gap

No full JSON export or secret values needed.

1. Open [this service's Revisions tab](https://console.cloud.google.com/run/detail/us-central1/skellyspeak-api/revisions?project=skellyspeak-api).
   Select **skellyspeak-api-00011-r75**. In its container details, copy only the
   **container image URL/digest** and **creation time**. If its build is linked,
   copy the build ID too. That lets us map the serving code instead of guessing.
2. Open [Firestore](https://console.cloud.google.com/firestore/databases?project=skellyspeak-api),
   select **(default)**, then **Data**. Open **global_usage → 2026-09-09** and record
   only `micros`, `requests`, `tokens`, and `blocked` if present. Do not edit/delete.
   This is current retained accounting, not a timestamped snapshot of the first
   rejection; it can corroborate budget exhaustion but may not settle causality.

Evidence links: [last successful pre-incident workflow](https://github.com/freemocap/skellyspeak/actions/runs/33821791285),
[Sept 9 failed deployment](https://github.com/freemocap/skellyspeak/actions/runs/34306711776),
[successful verified recovery](https://github.com/freemocap/skellyspeak/actions/runs/34468821350).
