# Hosted service review — 2026-09-10

Scope: current server authentication/admission/diagnostics/logging source, deployment
workflow and verification, and selected native credential/transport boundaries.
This is a focused source review, not a penetration test, dependency-vulnerability
scan, or verification of live GCP IAM/configuration. Uncommitted client work is
present and is not represented as deployed behavior.

## Findings and priorities

1. **Deployment integrity and availability — fix next.** The workflow verifies the
   service template image and latest-created/latest-ready names. It does not capture
   an exact build-specific candidate revision and verify that revision's immutable
   image digest before moving traffic. Traffic promotion is not explicit. Latest
   observed run 34464548148 built/pushed image tag
   `285a606b-6ac1-4bb9-b732-2f514518d4cb`, but reported readiness mismatch and 100%
   traffic on `skellyspeak-api-00011-r75`. This establishes rollout failure, not the
   cause of hosted HTTP 429. Do not weaken the failing assertions to get a green run.
2. **Availability under anonymous load.** `admission.Ingress` is a shared 240/minute
   per-process gate, including health and diagnostics. Anonymous requests can consume
   it and temporarily deny legitimate callers. This is not a per-user or distributed
   abuse limit, nor a complete GCP cost cap. Avoid exempting an unbounded endpoint;
   consider separate bounded liveness/admission lanes or edge protection if needed.
3. **Live least privilege is unknown.** Workflow source uses short-lived Workload
   Identity Federation, main-only deployment and pinned GitHub actions. It cannot
   establish actual WIF repository/ref restrictions or service-account IAM grants.
   Runtime should have only required Firestore and named-secret access; build/deploy
   privileges should be separate. No IAM changes are proposed merely to cure 429.
4. **Supply-chain reproducibility.** Python/runtime image and uv source are digest
   pinned, but Cloud Build docker/cloud-sdk helper images are unpinned. Pin tested
   helper digests in a focused follow-up; do not treat mutable tools as reproducible.
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
2. Make deployment deterministic: use an immutable image digest and a build-specific
   revision identifier; wait for that exact revision to be ready and verify its image.
3. Explicitly promote that verified candidate to 100% traffic and assert the resulting
   traffic allocation. Preserve API authorization and spending controls.
4. Check public health 200 and unauthenticated diagnostics 401; then use the app's
   authenticated diagnostics and one hosted message. Record the exact rejection code
   and request ID if chat still fails, and fix that specific admission condition.
5. Run server unit/security tests, Firestore emulator tests and container smoke checks
   before rollout. Source review does not replace post-deployment checks.

The archive move at September 9 14:34 UTC occurred after the failed deployment at
03:20 UTC; observed GitHub runs do not support it causing that deployment failure.
