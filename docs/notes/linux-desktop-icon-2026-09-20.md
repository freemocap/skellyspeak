# Linux desktop icon — 2026-09-20

## Finding

The active session is COSMIC/Wayland, running the unbundled development executable.
The PNG bundle assets exist, but no SkellySpeak desktop entry was installed.
Tauri's explicit GTK app identity was disabled (its default). A window icon alone
does not supply the launcher's desktop integration.

## Implementation

Enable the configured GTK identifier; provide matching StartupWMClass in Debian
and RPM desktop templates; register a user-local development desktop entry and
logo before Linux development launch. Desktop icon and window identity keys
follow the desktop-entry specification [@freedesktop_desktop_identity2026].
Tauri's standard bundler continues to install PNG assets for packaged builds.

Development registration was applied to this machine. The native process
restarted and owns com.freemocap.skellyspeak on the session D-Bus. Its desktop
entry has that filename, StartupWMClass and icon name. This verifies identity
registration, not a visual screenshot of the COSMIC dock. Release packages
were not published or installed. No commit created.

## Correction after native retest

The preceding identity conclusion was wrong: the D-Bus application name was
not the compositor's toplevel app_id. A direct read-only
ext_foreign_toplevel_list_v1 Wayland query reports SkellySpeak's app_id as
`skellyspeak`, including after restart. It did not report the reverse-domain ID.

The development launcher is now `skellyspeak.desktop`, with
`StartupWMClass=skellyspeak` and an absolute PNG Icon path. The incorrect
reverse-domain development launcher was removed after checking its ownership
marker. The speculative GTK-ID config and package template overrides were
removed; Tauri's stock package template already uses the binary name.

Recent native/desktop logs did not contain a SkellySpeak icon-load failure.
COSMIC panel/notification pipe errors were present but were not established as
the cause. The actual compositor/launcher mismatch was measured, not inferred
from those unrelated errors. A desktop screenshot portal request failed, so
visual confirmation of the dock remains unavailable to the agent. No dock or
session process was killed or reset.
