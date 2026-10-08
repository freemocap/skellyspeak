# Content

Editable application behavior and authored language material. Native code owns parsing, validation, prompt assembly and scoring.

| Folder | Contents |
| --- | --- |
| `languages/` | One directory per target language, including its skill assessments and learner guides |
| `skills/` | Eight skill definitions, their teaching subskills and shared translated concepts |
| `prompts/` | Model instructions in Markdown and machine criteria in YAML |
| `policies/` | Teaching and credit rules |
| `language-foundations/` | Shared writing systems, language families and capabilities |
| `conversation-topics/` | Conversation subjects and translated labels |
| `speech/` | Speech models and routing |
| `reading/` | Reviewed dictionary gloss packages imported into workspace storage; see [READING_README.md](reading/READING_README.md) |
| `rust-schemas/` | Generated authoring contracts |

Read each folder’s named README before editing. Directories prefixed `__` contain authoring templates and are excluded from runtime content. Missing required authored material is an authoring error, never an implicit language fallback.

From the repository root, run:

```text
cargo run --manifest-path native/Cargo.toml --bin audit-content -- --check
cargo run --manifest-path native/Cargo.toml --bin audit-content -- --coverage
cargo run --manifest-path native/Cargo.toml --bin audit-content -- --ready
```

`--check` validates present authored files and template shapes. `--coverage` lists exact missing paths. `--ready` fails unless required authoring coverage is complete. These are content checks, not running-application tests or linguistic review.
