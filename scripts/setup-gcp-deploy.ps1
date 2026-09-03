# One-time setup so GitHub Actions can deploy the server on its own.
#
# Run this ONCE. After it, every push to main that touches server/ deploys
# itself and nothing here needs running again.
#
#   .\scripts\setup-gcp-deploy.ps1
#
# It sets up Workload Identity Federation: GitHub mints a short-lived OIDC
# token for a workflow run, and Google exchanges it for an access token. No
# service-account key is ever created, so there is no long-lived credential to
# leak, rotate, or paste anywhere. Nothing secret is printed by this script.
#
# Everything is idempotent — re-running it is safe and repairs a partial setup.

$ErrorActionPreference = "Stop"

$Project    = "skellyspeak-api"
$Repo       = "freemocap/skellyspeak"
$PoolId     = "github"
$ProviderId = "github-actions"
$SaName     = "github-deployer"

# What a build submission needs, and nothing else. The build itself deploys to
# Cloud Run as the Cloud Build service account, which already holds those
# rights.
#   builds.editor        - submit and watch builds
#   storage.admin        - the build context goes to the _cloudbuild staging
#                          bucket, and submit reads and may create the BUCKET,
#                          not only objects inside it. objectAdmin covers
#                          objects alone and fails with "forbidden from
#                          accessing the bucket".
#   serviceUsageConsumer - serviceusage.services.use, which bills the API call
#                          to this project. Without it submit refuses before it
#                          uploads anything.
#   logging.viewer       - stream build logs (cloudbuild.yaml sets
#                          CLOUD_LOGGING_ONLY, and without this the submit
#                          fails while streaming them)
$Roles = @(
    "roles/cloudbuild.builds.editor",
    "roles/storage.admin",
    "roles/serviceusage.serviceUsageConsumer",
    "roles/logging.viewer"
)

$SaEmail = "$SaName@$Project.iam.gserviceaccount.com"

function Step($text) { Write-Host "`n== $text" -ForegroundColor Cyan }
function Note($text) { Write-Host "   $text" -ForegroundColor DarkGray }
function Fail($text) { Write-Host "`n$text" -ForegroundColor Red; exit 1 }

# ── Prerequisites ───────────────────────────────────────────────────────────

Step "Checking prerequisites"

if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Fail "gcloud is not installed. Install the Google Cloud CLI first:`n  https://cloud.google.com/sdk/docs/install"
}

$account = (gcloud config get-value account 2>$null)
if (-not $account -or $account -eq "(unset)") {
    Fail "gcloud is not logged in. Run 'gcloud auth login', then start again."
}
Note "gcloud account: $account"

$hasGh = [bool](Get-Command gh -ErrorAction SilentlyContinue)
if ($hasGh) {
    gh auth status 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { $hasGh = $false }
}
Note $(if ($hasGh) { "gh is available — the two repository secrets will be set for you" }
        else { "gh is not available — the two secrets will be printed to paste by hand" })

$projectNumber = (gcloud projects describe $Project --format="value(projectNumber)")
if (-not $projectNumber) {
    Fail "Could not read project '$Project'. Is the account above a member of it?"
}
Note "project $Project (number $projectNumber)"

# ── APIs ────────────────────────────────────────────────────────────────────

Step "Enabling the APIs this needs"
# iamcredentials + sts are what the token exchange itself runs on; the rest are
# what the deploy uses. Already-enabled APIs are a no-op.
gcloud services enable `
    iamcredentials.googleapis.com `
    sts.googleapis.com `
    cloudbuild.googleapis.com `
    run.googleapis.com `
    artifactregistry.googleapis.com `
    --project=$Project
if ($LASTEXITCODE -ne 0) { Fail "Could not enable the required APIs." }

# ── The identity Actions will act as ────────────────────────────────────────

Step "Creating the deployer service account"
$existing = (gcloud iam service-accounts list --project=$Project --filter="email:$SaEmail" --format="value(email)")
if ($existing) {
    Note "$SaEmail already exists"
} else {
    gcloud iam service-accounts create $SaName `
        --project=$Project `
        --display-name="GitHub Actions deployer" `
        --description="Used by .github/workflows/deploy-server.yml via Workload Identity Federation"
    if ($LASTEXITCODE -ne 0) { Fail "Could not create the service account." }
    Note "created $SaEmail"
}

# IAM is eventually consistent: a just-created service account is not yet
# visible to the project policy API, and binding a role to it fails with
# "Service account ... does not exist". Wait for it to actually resolve rather
# than racing it.
Step "Waiting for the service account to propagate"
$ready = $false
foreach ($attempt in 1..30) {
    gcloud iam service-accounts describe $SaEmail --project=$Project 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Seconds 2
}
if (-not $ready) {
    Fail "$SaEmail still is not visible after 60s. Wait a minute and re-run this script."
}
Note "visible"

Step "Granting it what a deploy needs"
foreach ($role in $Roles) {
    # Retried, and the exit code CHECKED. Printing the role name without
    # checking is how the first version of this script reported success on
    # three grants when only one had landed.
    $granted = $false
    foreach ($attempt in 1..6) {
        gcloud projects add-iam-policy-binding $Project `
            --member="serviceAccount:$SaEmail" `
            --role=$role `
            --condition=None `
            --quiet 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) { $granted = $true; break }
        Start-Sleep -Seconds 5
    }
    if ($granted) { Note "$role" }
    else { Fail "Could not grant $role to $SaEmail after 6 attempts. Nothing else will work without it." }
}

# ── Acting as the build's own service account ───────────────────────────────

# `gcloud builds submit` starts a build that RUNS AS another identity — the
# project's default compute service account, since cloudbuild.yaml names none.
# Submitting a build that runs as an account you cannot impersonate is refused
# with "caller does not have permission to act as service account", so this is
# required on top of builds.editor.
#
# Granted on that one account rather than project-wide, which would let the
# deployer impersonate every service account in the project.
$BuildSa = "$projectNumber-compute@developer.gserviceaccount.com"

Step "Letting the deployer start builds that run as $BuildSa"
gcloud iam service-accounts describe $BuildSa --project=$Project 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Fail ("The default compute service account $BuildSa does not exist.`n" +
          "  Builds run as it, so this project needs it, or cloudbuild.yaml must`n" +
          "  name a different one with a serviceAccount: field.")
}
$actedAs = $false
foreach ($attempt in 1..6) {
    gcloud iam service-accounts add-iam-policy-binding $BuildSa `
        --project=$Project `
        --role="roles/iam.serviceAccountUser" `
        --member="serviceAccount:$SaEmail" `
        --quiet 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { $actedAs = $true; break }
    Start-Sleep -Seconds 5
}
if (-not $actedAs) { Fail "Could not let $SaEmail act as $BuildSa." }
Note "roles/iam.serviceAccountUser on $BuildSa"

# ── Workload Identity Federation ────────────────────────────────────────────

Step "Creating the workload identity pool"
$pool = (gcloud iam workload-identity-pools describe $PoolId --project=$Project --location=global --format="value(name)" 2>$null)
if ($pool) {
    Note "pool '$PoolId' already exists"
} else {
    gcloud iam workload-identity-pools create $PoolId `
        --project=$Project --location=global `
        --display-name="GitHub Actions"
    if ($LASTEXITCODE -ne 0) { Fail "Could not create the workload identity pool." }
    Note "created pool '$PoolId'"
}

Step "Creating the GitHub OIDC provider"
$provider = (gcloud iam workload-identity-pools providers describe $ProviderId `
    --project=$Project --location=global --workload-identity-pool=$PoolId `
    --format="value(name)" 2>$null)
if ($provider) {
    Note "provider '$ProviderId' already exists"
} else {
    # The attribute-condition is the security boundary. Without it ANY GitHub
    # repository on the internet could mint a token for this service account.
    gcloud iam workload-identity-pools providers create-oidc $ProviderId `
        --project=$Project --location=global --workload-identity-pool=$PoolId `
        --display-name="GitHub Actions OIDC" `
        --issuer-uri="https://token.actions.githubusercontent.com" `
        --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" `
        --attribute-condition="assertion.repository == '$Repo'"
    if ($LASTEXITCODE -ne 0) { Fail "Could not create the OIDC provider." }
    Note "created provider '$ProviderId', locked to $Repo"
}

Step "Letting that repository impersonate the deployer"
$principal = "principalSet://iam.googleapis.com/projects/$projectNumber/locations/global/workloadIdentityPools/$PoolId/attribute.repository/$Repo"
gcloud iam service-accounts add-iam-policy-binding $SaEmail `
    --project=$Project `
    --role="roles/iam.workloadIdentityUser" `
    --member=$principal `
    --quiet | Out-Null
if ($LASTEXITCODE -ne 0) { Fail "Could not let $Repo impersonate $SaEmail." }
Note "only $Repo can assume $SaEmail"

# ── Verify, rather than assume ──────────────────────────────────────────────

Step "Verifying the result"
$actual = @(gcloud projects get-iam-policy $Project `
    --flatten="bindings[].members" `
    --filter="bindings.members:serviceAccount:$SaEmail" `
    --format="value(bindings.role)")
$missing = $Roles | Where-Object { $actual -notcontains $_ }
if ($missing) {
    Fail ("These roles did not stick: {0}`n  Re-run this script — it is idempotent and will retry them." -f ($missing -join ", "))
}
Note "all $($Roles.Count) roles present"

$wif = (gcloud iam service-accounts get-iam-policy $SaEmail --project=$Project --format=json | Out-String)
if ($wif -notmatch [regex]::Escape($principal)) {
    Fail "The workload identity binding is missing. Re-run this script."
}
Note "workload identity binding present"

$buildPolicy = (gcloud iam service-accounts get-iam-policy $BuildSa --project=$Project --format=json | Out-String)
if ($buildPolicy -notmatch [regex]::Escape($SaEmail) -or $buildPolicy -notmatch "iam.serviceAccountUser") {
    Fail "$SaEmail cannot act as $BuildSa. Re-run this script."
}
Note "can act as the build service account"

# ── Hand the values to GitHub ───────────────────────────────────────────────

$providerResource = "projects/$projectNumber/locations/global/workloadIdentityPools/$PoolId/providers/$ProviderId"

Step "Setting the repository secrets"
if ($hasGh) {
    gh secret set GCP_WORKLOAD_IDENTITY_PROVIDER --repo $Repo --body $providerResource
    if ($LASTEXITCODE -ne 0) { Fail "Could not set GCP_WORKLOAD_IDENTITY_PROVIDER." }
    gh secret set GCP_DEPLOY_SERVICE_ACCOUNT --repo $Repo --body $SaEmail
    if ($LASTEXITCODE -ne 0) { Fail "Could not set GCP_DEPLOY_SERVICE_ACCOUNT." }
    Note "set GCP_WORKLOAD_IDENTITY_PROVIDER and GCP_DEPLOY_SERVICE_ACCOUNT"
} else {
    Write-Host ""
    Write-Host "  Add these two secrets at" -ForegroundColor Yellow
    Write-Host "    https://github.com/$Repo/settings/secrets/actions" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "    GCP_WORKLOAD_IDENTITY_PROVIDER"
    Write-Host "      $providerResource" -ForegroundColor Green
    Write-Host ""
    Write-Host "    GCP_DEPLOY_SERVICE_ACCOUNT"
    Write-Host "      $SaEmail" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Neither is secret — they are identifiers, not credentials. They live"
    Write-Host "  in secrets because that is where a workflow reads such values from."
}

Write-Host ""
Write-Host "Done — verified, not assumed." -ForegroundColor Green
Write-Host "  Every push to main touching server/ now deploys itself."
Write-Host "  Deploy without a code change:" -ForegroundColor DarkGray
Write-Host "    gh workflow run 'Deploy server'" -ForegroundColor Cyan
Write-Host ""
