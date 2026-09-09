# Provision scoped build/runtime identities. Run Grants, verify a build, then Prune.
[CmdletBinding()]
param([ValidateSet('Grants', 'Prune')][string]$Phase = 'Grants')
$ErrorActionPreference = 'Stop'
$Project = 'skellyspeak-api'
$Region = 'us-central1'
$Repo = 'freemocap/skellyspeak'
$RepositoryId = '921713662'
$OwnerId = '97994512'
$Runtime = "skellyspeak-run@$Project.iam.gserviceaccount.com"
$Builder = "skellyspeak-build@$Project.iam.gserviceaccount.com"
$Deployer = "github-deployer@$Project.iam.gserviceaccount.com"
$Bucket = "gs://${Project}_cloudbuild"
$Secrets = @('google-client-id', 'google-client-secret', 'jwt-signing-key', 'openrouter-api-key', 'groq-api-key')

function Invoke-Cloud([string[]]$Arguments) {
    $result = & gcloud @Arguments
    if ($LASTEXITCODE -ne 0) { throw "gcloud failed: $($Arguments -join ' ')" }
    return $result
}
function Grant-Project([string]$Email, [string]$Role) {
    Invoke-Cloud @('projects', 'add-iam-policy-binding', $Project, "--member=serviceAccount:$Email", "--role=$Role", '--condition=None', '--quiet') | Out-Null
}
function Grant-Account([string]$Account, [string]$Member, [string]$Role) {
    Invoke-Cloud @('iam', 'service-accounts', 'add-iam-policy-binding', $Account, "--project=$Project", "--member=$Member", "--role=$Role", '--quiet') | Out-Null
}
$Number = (Invoke-Cloud @('projects', 'describe', $Project, '--format=value(projectNumber)')).Trim()
$DefaultBuilder = "$Number-compute@developer.gserviceaccount.com"
$Service = Invoke-Cloud @('run', 'services', 'describe', 'skellyspeak-api', "--project=$Project", "--region=$Region", '--format=json') | ConvertFrom-Json
if ($Service.spec.template.spec.serviceAccountName -ne $Runtime) { throw 'The live service must use the dedicated runtime identity before changing IAM.' }

if ($Phase -eq 'Grants') {
    $Accounts = @(Invoke-Cloud @('iam', 'service-accounts', 'list', "--project=$Project", '--format=value(email)'))
    foreach ($Email in @($Runtime, $Builder, $Deployer)) {
        if ($Accounts -notcontains $Email) {
            Invoke-Cloud @('iam', 'service-accounts', 'create', $Email.Split('@')[0], "--project=$Project") | Out-Null
        }
    }
    Grant-Project $Runtime 'roles/datastore.user'
    foreach ($Secret in $Secrets) {
        Invoke-Cloud @('secrets', 'add-iam-policy-binding', $Secret, "--project=$Project", "--member=serviceAccount:$Runtime", '--role=roles/secretmanager.secretAccessor', '--quiet') | Out-Null
    }
    foreach ($Role in @('roles/cloudbuild.builds.editor', 'roles/serviceusage.serviceUsageConsumer', 'roles/logging.viewer')) {
        Grant-Project $Deployer $Role
    }
    foreach ($Role in @('roles/storage.objectAdmin', 'roles/storage.legacyBucketReader')) {
        Invoke-Cloud @('storage', 'buckets', 'add-iam-policy-binding', $Bucket, "--member=serviceAccount:$Deployer", "--role=$Role") | Out-Null
    }
    # Both build identities have the same narrow permissions during rollout.
    # The submitted configuration selects skellyspeak-build explicitly.
    foreach ($Email in @($Builder, $DefaultBuilder)) {
        Grant-Project $Email 'roles/logging.logWriter'
        Grant-Project $Email 'roles/serviceusage.serviceUsageConsumer'
        Invoke-Cloud @('run', 'services', 'add-iam-policy-binding', 'skellyspeak-api', "--project=$Project", "--region=$Region", "--member=serviceAccount:$Email", '--role=roles/run.developer', '--quiet') | Out-Null
        Invoke-Cloud @('artifacts', 'repositories', 'add-iam-policy-binding', 'gcr.io', "--project=$Project", '--location=us', "--member=serviceAccount:$Email", '--role=roles/artifactregistry.writer', '--quiet') | Out-Null
        Invoke-Cloud @('storage', 'buckets', 'add-iam-policy-binding', $Bucket, "--member=serviceAccount:$Email", '--role=roles/storage.objectViewer') | Out-Null
        Grant-Account $Runtime "serviceAccount:$Email" 'roles/iam.serviceAccountUser'
        Grant-Account $Email "serviceAccount:$Deployer" 'roles/iam.serviceAccountUser'
    }
    $Condition = "assertion.repository_id == '$RepositoryId' && assertion.repository_owner_id == '$OwnerId' && assertion.ref == 'refs/heads/main' && assertion.workflow_ref == '$Repo/.github/workflows/deploy-server.yml@refs/heads/main' && assertion.event_name in ['push', 'workflow_dispatch']"
    Invoke-Cloud @('iam', 'workload-identity-pools', 'providers', 'update-oidc', 'github-actions', "--project=$Project", '--location=global', '--workload-identity-pool=github', '--attribute-mapping=google.subject=assertion.sub,attribute.repository=assertion.repository', "--attribute-condition=$Condition") | Out-Null
    Write-Host 'Scoped grants applied. Verify a build before running -Phase Prune.'
    exit 0
}
# Verify replacement grants before removing broad project bindings.
$Policy = Invoke-Cloud @('projects', 'get-iam-policy', $Project, '--format=json') | ConvertFrom-Json
foreach ($Secret in $Secrets) {
    $SecretPolicy = Invoke-Cloud @('secrets', 'get-iam-policy', $Secret, "--project=$Project", '--format=json') | ConvertFrom-Json
    if (-not ($SecretPolicy.bindings | Where-Object { $_.role -eq 'roles/secretmanager.secretAccessor' -and $_.members -contains "serviceAccount:$Runtime" })) {
        throw "Missing scoped runtime access to $Secret"
    }
}
foreach ($Email in @($Builder, $DefaultBuilder)) {
    if (-not ($Policy.bindings | Where-Object { $_.role -eq 'roles/logging.logWriter' -and $_.members -contains "serviceAccount:$Email" })) {
        throw "Missing scoped build grants for $Email; run Grants first"
    }
}
$Removals = @(
    @($Runtime, 'roles/secretmanager.secretAccessor'),
    @($DefaultBuilder, 'roles/editor'),
    @($DefaultBuilder, 'roles/datastore.user'),
    @($DefaultBuilder, 'roles/secretmanager.secretAccessor'),
    @($Deployer, 'roles/storage.admin'),
    @($Deployer, 'roles/storage.objectAdmin')
)
foreach ($Removal in $Removals) {
    $Email, $Role = $Removal
    if ($Policy.bindings | Where-Object { $_.role -eq $Role -and $_.members -contains "serviceAccount:$Email" }) {
        Invoke-Cloud @('projects', 'remove-iam-policy-binding', $Project, "--member=serviceAccount:$Email", "--role=$Role", '--condition=None', '--quiet') | Out-Null
    }
}
Write-Host 'Broad project bindings removed. Verify the service and the scoped build identity.'

