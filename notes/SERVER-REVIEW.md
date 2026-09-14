# Hosted service review — 2026-09-10

Scope: current server authentication/admission/diagnostics/logging source, deployment
workflow and verification, and selected native credential/transport boundaries.
This is a focused source review, not a penetration test, dependency-vulnerability
scan, or verification of live GCP IAM/configuration. Uncommitted client work is
present and is not represented as deployed behavior.

## Findings and priorities

1. **Deployment integrity — implemented locally, pending CI and deployment.**
   Deployment resolves the pushed image to an immutable digest, assigns a unique
   build-specific revision, and deploys without traffic. The exact revision must
   report Ready and the expected image/digest before explicit promotion to 100%.
   Traffic allocation is then checked. A failed deploy command never promotes;
   it attempts an allowlisted metadata report without printing runtime messages
   or service configuration. Candidate readiness still requires revision-specific evidence.
2. **Anonymous admission interference — reduced locally.** Anonymous ingress has
   its own 240/minute per-process allowance. GET /health has a separate bounded
   60/minute allowance. Protected routes classify signature-verified sessions into
   a bounded 60/minute per-subject lane with a 240/minute process ceiling and at
   most 128 active subject windows. Endpoint authentication, revocation and daily
   Firestore limits still apply. These are tunable application limits, not universal
   security standards. This does not prevent resource-level floods, health-route
   abuse or distributed denial of service; it does not establish a GCP cost cap.
3. **Live least privilege is unknown.** Workflow source uses short-lived Workload
   Identity Federation, main-only deployment and pinned GitHub actions. It cannot
   establish actual WIF repository/ref restrictions or service-account IAM grants.
   Runtime should have only required Firestore and named-secret access; build/deploy
   privileges should be separate. No IAM changes are proposed merely to cure 429.
4. **Build helper pinning — implemented locally, pending CI.** Cloud Build docker
   and cloud-sdk helpers now use immutable digests, alongside pinned Python/uv
   images and GitHub actions. Pinning prevents unnoticed tag drift; it does not
   prove vulnerability absence. Deliberate dependency updates remain necessary.
5. **Managed logging boundary.** New application request logs omit tokens, bodies,
   raw URLs, identities and exception messages. GCP request logs are independently
   managed and can retain request URLs, including OAuth callback query parameters.
   Verify access, exclusions and retention separately. Public Actions output must
   remain deployment metadata, not raw runtime logs or diagnostic account data.

## Controls observed

- Session signatures, expiration, issuer and revocation checked; authenticated
  admission bounded before account lookup. PKCE binds sign-in exchange.
- Diagnostics use the session's own account, have an independent bounded quota,
  return shared blocked flags rather than other users' usage, and expose no reset
  or administrative endpoint. They do not contact a paid provider.
- Request IDs are server-generated; errors/logs do not trust client request IDs.
  Unexpected error responses omit exception messages. Cache-Control is no-store.
- Transactional reservations and settlement, provider pricing/body ceilings and
  persistent spending pause remain enforced. Restart does not clear Firestore limits.
- Native secrets remain in OS credential storage; provider redirects are refused.
  Custom endpoint configuration permits plaintext only for explicit loopback use.
- Runtime Docker COPY is explicit; upload context excludes local secrets and archives.
  No separate GitHub diagnostic probe, new cloud credential, or report bucket exists.

No authentication bypass or secret disclosure was found in the reviewed new
observability path. That statement does not certify the entire application or the
currently serving revision.

## Console evidence needed

Project `skellyspeak-api`, Cloud Run service `skellyspeak-api`, region `us-central1`:
open revision `skellyspeak-api-00014-z9x`; record readiness condition/reason, actual
image digest, startup failure, and any command/argument overrides. Inspect traffic
and audit tag mapping. Share only those fields, not environment/secret values or
full service JSON. The ready audit revision is not evidence that the candidate works.

## Next solution steps

1. Establish the candidate revision's exact startup/readiness failure from console
   evidence; compare command, port, probes and secret references with the container
   that passed CI. Correct the specific failure, not unrelated quotas or permissions.
2. Run the hardened deployment through CI after the user commits/pushes; verify
   the candidate metadata, readiness and explicit traffic promotion.
3. Confirm actual WIF repository/ref restrictions, least-privilege service-account
   grants, and managed logging access/retention in GCP. These are unverified live
   settings, not resolved by local source changes.
4. Check public health 200 and unauthenticated diagnostics 401; then use the app's
   authenticated diagnostics and one hosted message. Record the exact rejection code
   and request ID if chat still fails, and fix that specific admission condition.
5. Run server unit/security tests, Firestore emulator tests and container smoke checks
   before rollout. Source review does not replace post-deployment checks.

The archive move at September 9 14:34 UTC occurred after the failed deployment at
03:20 UTC; observed GitHub runs do not support it causing that deployment failure.

## Guidance and verification

The deployment sequence follows Google's [Cloud Run traffic migration guidance](https://cloud.google.com/run/docs/rollouts-rollbacks-traffic-migration)
and [image deployment contract](https://docs.cloud.google.com/run/docs/deploying).
Bounded admission and restricted logs follow the relevant principles in OWASP's
[denial-of-service guidance](https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html)
and [logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html).
If edge protection is needed, use Google's documented [Cloud Armor integration](https://docs.cloud.google.com/armor/docs/integrating-cloud-armor)
with ingress configured to prevent direct-service bypass. No load balancer or
Cloud Armor policy has been provisioned by this work.

Local server verification: 162 passed, six Firestore emulator tests skipped.
Coverage includes failed deployment/nonmatching digest preventing promotion,
metadata redaction, complete traffic allocation, bounded identity storage, and
anonymous/signed/liveness admission separation. CI must still exercise the emulator,
container startup and the pinned Cloud Build helpers. No Git write, deployment,
IAM mutation, counter reset or privileged diagnostic workflow was performed.

## Supplied Cloud Run export — 2026-09-10

Reviewed 4,778 records spanning September 9 10:47 UTC through September 10
10:31 UTC. Only sanitized aggregate findings are recorded here; the raw export
contains OAuth query parameters and must not be committed or attached to public CI.

- 1,236 chat HTTP 200 responses and 253 chat HTTP 429 responses; transcription
  adds seven 200 and four 429 responses. All 257 HTTP 429s have corresponding
  application access-log entries. This points to application-handled rejection,
  not a Cloud Run front-door rejection. These logs contain no rejection reason.
- The busiest clock minute contains 232 HTTP requests. This supports investigating
  excess request generation, but does not establish which user action caused it.
- All recorded 429s occur September 9. The September 10 portion contains no chat
  requests, so this export cannot establish whether chat still rejects today.
- The service update at September 10 10:14 UTC retains 100% traffic on
  `skellyspeak-api-00011-r75`, lists latest-created `skellyspeak-api-00014-z9x`,
  and latest-ready `skellyspeak-api-audit-0905`. The service itself reports Ready.
  There are no runtime entries for `00014-z9x` in this export. A startup crash is
  not established; readiness/routing must be distinguished from startup failure.
- Uvicorn access logs include OAuth callback query parameters in the serving
  revision. The prepared runtime disables these access logs; managed GCP request
  logs remain a separate access/retention review.

No additional runtime code change follows from this evidence. Proceed with the
locally tested exact-revision deployment and admission hardening, then inspect
its CI result and authenticated diagnostics before changing any quota.

## Comprehensive follow-up

See [SECURITY-AUDIT.md](SECURITY-AUDIT.md) for the current source audit, confirmed
repository settings, secret/dependency scans, additional hardening and verification.
Hosted deployment and chat succeeded before those additional local changes.
