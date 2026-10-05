import Foundation
import Tauri
import UIKit

private struct ShareArgs: Decodable {
    let path: String
}

final class DiagnosticSharing: Plugin {
    private var sharing = false

    @objc public func share(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(ShareArgs.self)
        let file = URL(fileURLWithPath: args.path)
        DispatchQueue.main.async {
            guard !self.sharing else {
                invoke.reject("A log share sheet is already open", code: "busy")
                return
            }
            guard FileManager.default.isReadableFile(atPath: file.path) else {
                invoke.reject("The diagnostic archive is unavailable", code: "read_archive")
                return
            }
            guard var presenter = self.manager.viewController else {
                invoke.reject("The app view is unavailable", code: "open_share_sheet")
                return
            }
            while let presented = presenter.presentedViewController {
                presenter = presented
            }
            guard presenter.viewIfLoaded?.window != nil,
                  !presenter.isBeingDismissed, !presenter.isBeingPresented else {
                invoke.reject("The app view cannot present the share sheet", code: "open_share_sheet")
                return
            }
            let sheet = UIActivityViewController(activityItems: [file], applicationActivities: nil)
            // iPad requires a popover anchor even when invoked from the webview.
            if let popover = sheet.popoverPresentationController {
                popover.sourceView = presenter.view
                popover.sourceRect = CGRect(x: presenter.view.bounds.midX,
                                            y: presenter.view.bounds.midY, width: 1, height: 1)
                popover.permittedArrowDirections = []
            }
            sheet.completionWithItemsHandler = { _, completed, _, error in
                self.sharing = false
                if let error = error as NSError? {
                    // Do not forward userInfo, file paths, destination URLs or recipient data.
                    invoke.reject("Log sharing failed (\(error.domain), code \(error.code)); error details omitted",
                                  code: "share_completion")
                } else {
                    // Cancellation is a normal outcome. Rust retains the ZIP until this callback.
                    invoke.resolve(["completed": completed])
                }
            }
            self.sharing = true
            presenter.present(sheet, animated: true)
        }
    }
}

@_cdecl("init_plugin_diagnostic_sharing")
func initPlugin() -> Plugin {
    DiagnosticSharing()
}
