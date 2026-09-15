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

fn main() {
    let manifest = PathBuf::from(env::var_os("CARGO_MANIFEST_DIR").unwrap());
    let root = manifest.join("../content/config");
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
