use base64::Engine;
use minisign_verify::{PublicKey, Signature};
use std::{error::Error, path::Path};

fn verify_tree(root: &Path, key: &PublicKey) -> Result<usize, Box<dyn Error>> {
    let mut count = 0;
    for entry in std::fs::read_dir(root)? {
        let entry = entry?;
        let path = entry.path();
        if entry.file_type()?.is_dir() {
            count += verify_tree(&path, key)?;
        } else if path.extension().is_some_and(|extension| extension == "sig") {
            let encoded = std::fs::read_to_string(&path)?;
            let decoded = base64::engine::general_purpose::STANDARD.decode(encoded.trim())?;
            let signature = Signature::decode(std::str::from_utf8(&decoded)?)?;
            key.verify(&std::fs::read(path.with_extension(""))?, &signature, true)?;
            count += 1;
        }
    }
    Ok(count)
}

fn main() -> Result<(), Box<dyn Error>> {
    let args: Vec<String> = std::env::args().collect();
    if args.len() != 3 { return Err("Usage: verify-updater CONFIG_JSON ARTIFACT_ROOT".into()); }
    let config: serde_json::Value = serde_json::from_slice(&std::fs::read(&args[1])?)?;
    let encoded = config["plugins"]["updater"]["pubkey"].as_str().ok_or("Missing updater public key")?;
    let decoded = base64::engine::general_purpose::STANDARD.decode(encoded)?;
    let key = PublicKey::decode(std::str::from_utf8(&decoded)?)?;
    let count = verify_tree(Path::new(&args[2]), &key)?;
    if count == 0 { return Err("No updater signatures found".into()); }
    println!("Verified {count} updater signatures against the configured public key.");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn verifies_encoded_artifact_and_rejects_tampering_or_missing_payload() {
        // Public minisign-verify test vector, not a credential.
        let key = PublicKey::from_base64("RWQf6LRCGA9i53mlYecO4IzT51TGPpvWucNSCh1CBM0QTaLn73Y7GFO3").unwrap();
        let signature = "untrusted comment: signature from minisign secret key\nRWQf6LRCGA9i59SLOFxz6NxvASXDJeRtuZykwQepbDEGt87ig1BNpWaVWuNrm73YiIiJbq71Wi+dP9eKL8OC351vwIasSSbXxwA=\ntrusted comment: timestamp:1555779966\tfile:test\nQtKMXWyYcwdpZAlPF7tE2ENJkRd1ujvKjlj1m9RtHTBnZPa5WKU5uWRs5GoP5M/VqE81QFuMKI5k/SfNQUaOAA==";
        let root = tempfile::tempdir().unwrap();
        let artifact = root.path().join("bundle.app.tar.gz");
        std::fs::write(root.path().join("bundle.app.tar.gz.sig"), base64::engine::general_purpose::STANDARD.encode(signature)).unwrap();
        std::fs::write(&artifact, b"test").unwrap();
        assert_eq!(verify_tree(root.path(), &key).unwrap(), 1);
        std::fs::write(&artifact, b"Test").unwrap();
        assert!(verify_tree(root.path(), &key).is_err());
        std::fs::remove_file(&artifact).unwrap();
        assert!(verify_tree(root.path(), &key).is_err());
    }
}
