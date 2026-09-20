# Factory reset shutdown diagnostics

## Observed

The Windows reset run reached `factory_reset` and erased the workspace, leaving
only its ownership lock and pending log-cleanup marker. Diagnostics had initialized
successfully. The reset command closed the diagnostic sink before requesting app
exit, so native shutdown logging produced `Native log record could not be saved`.

## Implemented

The diagnostic sink remains available for the process lifetime. Reset retains
the mobile app-data `logs/` directory while its files are open. Pending cleanup
erases those logs at the next launch, before diagnostics initializes. Workspace
and credential deletion, ownership locking and explicit cleanup errors remain.

Changes belong to `native/src/storage/factory_reset.rs` and
`native/src/diagnostics/mod.rs`. These existing files remain above the preferred
size guideline; this targeted lifecycle repair does not split their other
responsibilities.

## Verification

- All 11 factory-reset tests passed, including a regression that writes a shutdown
  diagnostic after data erasure, then verifies deferred cleanup and a fresh store.
- The diagnostics test filter passed all 7 selected tests.
- Rust formatting checks passed for both changed Rust files.
- `npm run tauri dev` rebuilt and launched successfully on Windows. Pending log
  cleanup removed the previous runs; the new run recorded successful frontend IPC
  for startup, settings, connections and skill evidence.

The live check verified relaunch after the reported reset. It did not repeat the
reset button interaction or establish whether the WebView2 class-unregistration
message or npm's dev-server shutdown status still occurs on exit.
