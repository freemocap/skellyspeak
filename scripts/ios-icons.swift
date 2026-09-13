import AppKit

// Render each generated icon into an RGB bitmap without an alpha channel.
// An opaque-looking RGBA PNG still fails App Store icon validation.
guard CommandLine.arguments.count == 2 else {
    fatalError("Usage: swift scripts/ios-icons.swift <AppIcon.appiconset>")
}
let catalog = URL(fileURLWithPath: CommandLine.arguments[1])
let icons = try FileManager.default.contentsOfDirectory(at: catalog, includingPropertiesForKeys: nil)
    .filter { $0.pathExtension == "png" }
guard !icons.isEmpty else { fatalError("No generated iOS icons") }
for icon in icons {
    let data = try Data(contentsOf: icon)
    guard let source = NSBitmapImageRep(data: data)?.cgImage,
          let context = CGContext(data: nil, width: source.width, height: source.height,
              bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(),
              bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else {
        fatalError("Cannot prepare RGB icon: \(icon.path)")
    }
    let bounds = CGRect(x: 0, y: 0, width: source.width, height: source.height)
    context.setFillColor(red: 243.0 / 255, green: 241.0 / 255, blue: 234.0 / 255, alpha: 1)
    context.fill(bounds)
    context.draw(source, in: bounds)
    guard let image = context.makeImage(),
          let png = NSBitmapImageRep(cgImage: image).representation(using: .png, properties: [:]),
          let result = NSBitmapImageRep(data: png), !result.hasAlpha else {
        fatalError("Could not encode opaque RGB icon: \(icon.path)")
    }
    try png.write(to: icon, options: .atomic)
}
print("Prepared \(icons.count) opaque iOS icons")
