import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

// App Store icons use opaque RGB pixels, including their PNG color metadata.
guard CommandLine.arguments.count == 2 else {
    fatalError("Usage: swift scripts/ios-icons.swift <AppIcon.appiconset>")
}
let directory = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
let files = try FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)
    .filter { $0.pathExtension.lowercased() == "png" }
guard !files.isEmpty else { fatalError("App icon catalog contains no PNG files") }
for file in files {
    guard let source = CGImageSourceCreateWithURL(file as CFURL, nil),
          let image = CGImageSourceCreateImageAtIndex(source, 0, nil),
          let context = CGContext(data: nil, width: image.width, height: image.height,
                                  bitsPerComponent: 8, bytesPerRow: image.width * 4,
                                  space: CGColorSpaceCreateDeviceRGB(),
                                  bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else {
        fatalError("Cannot decode app icon: \(file.path)")
    }
    context.setFillColor(red: 243.0 / 255, green: 241.0 / 255, blue: 234.0 / 255, alpha: 1)
    let bounds = CGRect(x: 0, y: 0, width: image.width, height: image.height)
    context.fill(bounds)
    context.draw(image, in: bounds)
    let data = NSMutableData()
    guard let opaque = context.makeImage(),
          let destination = CGImageDestinationCreateWithData(data, UTType.png.identifier as CFString, 1, nil) else {
        fatalError("Cannot encode app icon: \(file.path)")
    }
    CGImageDestinationAddImage(destination, opaque, nil)
    guard CGImageDestinationFinalize(destination) else { fatalError("Cannot finalize app icon: \(file.path)") }
    try (data as Data).write(to: file, options: .atomic)
}
print("Prepared \(files.count) opaque iOS app icons.")
