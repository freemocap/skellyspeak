fn main() -> Result<(), Box<dyn std::error::Error>> {
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../src/contracts.ts");
    let expected = skellyspeak_core::model::bindings();
    if std::env::args().any(|arg| arg == "--check") {
        if std::fs::read_to_string(&path)? != expected {
            return Err("Generated TypeScript contracts are stale; run npm run contracts".into());
        }
    } else {
        std::fs::write(path, expected)?;
    }
    Ok(())
}
