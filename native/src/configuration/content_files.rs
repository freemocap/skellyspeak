//! Shared inventory rules for build-time bundling and repository inspection.
use std::{collections::BTreeMap, fs, path::Path};

pub fn read(root: &Path) -> Result<BTreeMap<String, String>, String> {
    let mut files = BTreeMap::new();
    collect(root, root, &mut files)?;
    Ok(files)
}

fn collect(root: &Path, dir: &Path, files: &mut BTreeMap<String, String>) -> Result<(), String> {
    let metadata = fs::symlink_metadata(dir).map_err(|e| format!("{}: {e}", dir.display()))?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err(format!("{}: expected regular directory", dir.display()));
    }
    for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let kind = entry.file_type().map_err(|e| e.to_string())?;
        if kind.is_symlink() {
            return Err(format!("{}: symlinks are forbidden", path.display()));
        }
        let leaf = entry
            .file_name()
            .into_string()
            .map_err(|_| "Expected UTF-8 filename")?;
        let name = path
            .strip_prefix(root)
            .map_err(|e| e.to_string())?
            .to_str()
            .ok_or("Expected UTF-8 path")?
            .replace('\\', "/");
        if leaf.starts_with('.')
            || (kind.is_dir() && (leaf.starts_with("__") || leaf == "rust-schemas"))
            || leaf.ends_with("_README.md")
        {
            continue;
        }
        if kind.is_dir() {
            collect(root, &path, files)?;
        } else if kind.is_file() {
            if entry.metadata().map_err(|e| e.to_string())?.len() > 2 * 1024 * 1024 {
                return Err(format!("{name}: exceeds 2 MiB"));
            }
            let text = fs::read_to_string(&path).map_err(|e| format!("{name}: {e}"))?;
            files.insert(name, text);
        } else {
            return Err(format!("{name}: expected regular file"));
        }
    }
    Ok(())
}
