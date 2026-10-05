// swift-tools-version:5.3
import PackageDescription

let package = Package(
    name: "tauri-plugin-diagnostic-sharing",
    platforms: [.iOS(.v13)],
    products: [.library(name: "tauri-plugin-diagnostic-sharing", type: .static,
                        targets: ["DiagnosticSharing"])],
    dependencies: [.package(name: "Tauri", path: "../.tauri/tauri-api")],
    targets: [.target(name: "DiagnosticSharing", dependencies: [.byName(name: "Tauri")],
                      path: "Sources")]
)
