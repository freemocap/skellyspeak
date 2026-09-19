# Conversation design preview repair

Status: maintenance complete, 2026-09-19. No application behavior or styling changed.

The existing production-component preview still passed the retired starters prop
to ConversationStart. Updated it to typed TopicCard data and local
ConversationStartConfig state, including difficulty, topic and grammar-time choices.
Starting the sample conversation remains a local preview action. Removed the
obsolete Take a lesson button. Existing components and production CSS remain the
visual basis; no new UI pattern was introduced.

Native-only controls, such as Customize and saving a custom topic, now encounter
an explicit preview-only refusal through the Tauri mock adapter. They do not read
or write application data. This fixture is a layout tool, not a simulation of the
native prompt creator or AI execution.

Added npm run previews:check and documented it in ui/README.md. The check covers
all existing TypeScript previews, so stale component interfaces can be caught
without launching the app. All previews type-check; the nine existing
ConversationStart and ConversationPromptCreator tests pass. No new visual or
native walkthrough was performed while the user is away from the locked Mac.

Open /tools/conversation-preview.html through npm run dev when ready to review.
Onboarding design, font downloads and Android packaging remain deferred.
