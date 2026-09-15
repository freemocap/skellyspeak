fn main() -> Result<(), Box<dyn std::error::Error>> {
    let path =
        std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../ui/src/generated/contracts.ts");
    let expected = skellyspeak_core::model::bindings();
    if std::env::args().any(|arg| arg == "--check") {
        if std::fs::read_to_string(&path)? != expected {
            return Err("Generated TypeScript contracts are stale; run npm run contracts".into());
        }
    } else {
        std::fs::write(path, expected)?;
    }
    let catalog_path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../ui/src/generated/skill-catalogs/catalog.json");
    let catalog = format!(
        "{}\n",
        serde_json::to_string_pretty(&skellyspeak_core::coaching::catalog())?
    );
    if std::env::args().any(|arg| arg == "--check") {
        if std::fs::read_to_string(catalog_path)? != catalog {
            return Err("Generated construct catalog is stale; run npm run contracts".into());
        }
    } else {
        std::fs::write(catalog_path, catalog)?;
    }
    Ok(())
}
