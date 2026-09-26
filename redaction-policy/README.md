# Redaction policy

This folder is the single authored source for redacting secrets and user content
from application errors, structured diagnostic records and development-process
logs. It is runtime privacy policy, not language, teaching or LLM content.

| File | Purpose |
| --- | --- |
| `policy.json` | Shared field classifications, redaction patterns, replacement tags and size limits |
| `cases.json` | Cross-runtime conformance cases specifying text that must survive or be removed |

Native code compiles the policy directly. The generator produces the Android,
UI and server copies used by their diagnostic implementations. Native, UI and
server tests all read `cases.json` to verify equivalent behavior.

After editing `policy.json`, regenerate and check every runtime copy:

```sh
npm run diagnostics:policy
npm run diagnostics:check
```

Do not edit generated policy copies. This policy does not govern model prompts,
conversation storage, audio retention, workspace data or general application
privacy; those responsibilities remain with their owning features.
