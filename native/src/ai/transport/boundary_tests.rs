use std::path::Path;

/// Product integration tests may exercise transports, but runtime transport
/// code must not reach back into product workflows to construct a request.
#[test]
fn transport_runtime_has_no_product_dependencies() {
    fn inspect(path: &Path) {
        for entry in std::fs::read_dir(path).unwrap() {
            let path = entry.unwrap().path();
            if path.is_dir() {
                if path.file_name().unwrap() != "tests" {
                    inspect(&path);
                }
            } else if path.extension().is_some_and(|extension| extension == "rs")
                && !path
                    .file_name()
                    .unwrap()
                    .to_string_lossy()
                    .ends_with("_tests.rs")
            {
                let source = std::fs::read_to_string(&path)
                    .unwrap()
                    .replace("\r\n", "\n");
                // Colocated tests follow the runtime implementation. External
                // #[path] test declarations do not contain workflow imports.
                let runtime = source.split("#[cfg(test)]\nmod ").next().unwrap();
                for forbidden in ["conversations::", "drill::", "application::", "learning::"] {
                    assert!(
                        !runtime.contains(forbidden),
                        "{} depends on {forbidden}",
                        path.display()
                    );
                }
            }
        }
    }
    inspect(&Path::new(env!("CARGO_MANIFEST_DIR")).join("src/ai/transport"));
}
