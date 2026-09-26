use std::{
    env, fs,
    path::{Path, PathBuf},
};

fn collect(root: &Path, dir: &Path, files: &mut Vec<(String, PathBuf)>) {
    println!("cargo:rerun-if-changed={}", dir.display());
    for entry in fs::read_dir(dir).expect("read bundled configuration directory") {
        let entry = entry.expect("read configuration entry");
        let path = entry.path();
        let kind = entry.file_type().expect("read configuration file type");
        assert!(
            !kind.is_symlink(),
            "configuration symlink: {}",
            path.display()
        );
        if entry
            .file_name()
            .to_str()
            .expect("UTF-8 configuration filename")
            .starts_with('.')
        {
            continue;
        }
        if path.file_name().is_some_and(|name| name == "schemas") {
            continue;
        }
        if kind.is_dir() {
            collect(root, &path, files);
        } else if kind.is_file() && path.extension().is_none_or(|ext| ext != "md") {
            let name = path
                .strip_prefix(root)
                .unwrap()
                .to_str()
                .expect("UTF-8 configuration path")
                .replace('\\', "/");
            files.push((
                name,
                path.canonicalize().expect("resolve configuration file"),
            ));
        }
    }
}

/// The command registration list is also the diagnostic command authority.
fn diagnostic_commands(manifest: &Path) {
    let path = manifest.join("src/application/startup.rs");
    println!("cargo:rerun-if-changed={}", path.display());
    let source = fs::read_to_string(path).expect("read registered commands");
    let block = source
        .split_once("tauri::generate_handler![")
        .expect("command registry")
        .1
        .split_once(']')
        .expect("command registry end")
        .0;
    let names: Vec<_> = block
        .split(',')
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(|v| v.rsplit("::").next().unwrap())
        .collect();
    assert!(names.len() > 20);
    let mut output = String::from(
        "#[derive(Debug, Clone, serde::Deserialize, serde::Serialize, ts_rs::TS)]\n#[serde(rename_all = \"snake_case\")]\npub enum DiagnosticCommand {\n",
    );
    for name in &names {
        assert!(name.bytes().all(|b| b.is_ascii_lowercase() || b == b'_'));
        let variant: String = name
            .split('_')
            .map(|word| format!("{}{}", word[..1].to_ascii_uppercase(), &word[1..]))
            .collect();
        output.push_str(&format!("{variant},\n"));
    }
    output.push_str("}\npub const DIAGNOSTIC_COMMAND_NAMES: &[&str] = &[");
    for name in names {
        output.push_str(&format!("{name:?},"));
    }
    output.push_str("];\n");
    fs::write(
        PathBuf::from(env::var_os("OUT_DIR").unwrap()).join("diagnostic_commands.rs"),
        output,
    )
    .expect("generate diagnostic commands");
}

fn main() {
    if env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("android") {
        // NDK r27 needs explicit ELF alignment for Android's 16 KB page sizes.
        // https://developer.android.com/guide/practices/page-sizes
        println!("cargo:rustc-link-arg-cdylib=-Wl,-z,max-page-size=16384");
        println!("cargo:rustc-link-arg-cdylib=-Wl,-z,common-page-size=16384");
    }
    let manifest = PathBuf::from(env::var_os("CARGO_MANIFEST_DIR").unwrap());
    diagnostic_commands(&manifest);
    let root = manifest.join("../content");
    let mut files = Vec::new();
    collect(&root, &root, &mut files);
    let bibliography = manifest
        .join("../references.bib")
        .canonicalize()
        .expect("resolve bibliography");
    println!("cargo:rerun-if-changed={}", bibliography.display());
    files.push(("references.bib".into(), bibliography));
    files.sort_by(|a, b| a.0.cmp(&b.0));
    for pair in files.windows(2) {
        assert_ne!(pair[0].0, pair[1].0, "duplicate bundled configuration path");
    }
    let mut source = String::from("const SEEDS: &[(&str, &str)] = &[\n");
    for (name, path) in files {
        source.push_str(&format!(
            "({name:?}, include_str!({:?})),\n",
            path.to_str().unwrap()
        ));
    }
    source.push_str("];\n");
    fs::write(
        PathBuf::from(env::var_os("OUT_DIR").unwrap()).join("config_seeds.rs"),
        source,
    )
    .expect("write bundled configuration manifest");
    tauri_build::build();
}
