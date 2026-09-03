//! Tests for `native_host` — split out to keep that module under the
//! file-length gate.

use super::*;

#[test]
fn manifest_pins_the_extension_and_uses_stdio() {
    let m = manifest_json(Path::new(r"C:\apps\miting-pairing-host.exe"));
    assert_eq!(m["name"], HOST_NAME);
    assert_eq!(m["type"], "stdio");
    let origins = m["allowed_origins"].as_array().unwrap();
    assert_eq!(origins.len(), 1, "exactly one pinned extension origin");
    let origin = origins[0].as_str().unwrap();
    assert!(origin.starts_with("chrome-extension://"));
    assert!(origin.ends_with('/'), "Chrome requires a trailing slash");
    assert!(m["path"].as_str().unwrap().contains("miting-pairing-host"));
}

/// Chrome reads these paths directly — a wrong one is not a warning, it is
/// a companion that can never pair. These run on every host, including the
/// Windows machine this is developed on, because the layout is a parameter
/// rather than a `cfg`.
#[test]
fn macos_manifests_go_under_application_support() {
    let dirs = browser_manifest_dirs(Path::new("/Users/sam"), ChromiumLayout::MacOs);
    let shown: Vec<String> = dirs
        .iter()
        .map(|d| d.to_string_lossy().replace(std::path::MAIN_SEPARATOR, "/"))
        .collect();

    assert_eq!(
        shown,
        vec![
            "/Users/sam/Library/Application Support/Google/Chrome/NativeMessagingHosts",
            "/Users/sam/Library/Application Support/Microsoft Edge/NativeMessagingHosts",
            "/Users/sam/Library/Application Support/Chromium/NativeMessagingHosts",
        ],
    );
}

#[test]
fn linux_manifests_go_under_dot_config() {
    let dirs = browser_manifest_dirs(Path::new("/home/sam"), ChromiumLayout::Xdg);
    let shown: Vec<String> = dirs
        .iter()
        .map(|d| d.to_string_lossy().replace(std::path::MAIN_SEPARATOR, "/"))
        .collect();

    assert_eq!(
        shown,
        vec![
            "/home/sam/.config/google-chrome/NativeMessagingHosts",
            "/home/sam/.config/microsoft-edge/NativeMessagingHosts",
            "/home/sam/.config/chromium/NativeMessagingHosts",
        ],
    );
}

#[test]
fn every_layout_covers_chrome_edge_and_chromium() {
    for layout in [ChromiumLayout::MacOs, ChromiumLayout::Xdg] {
        let dirs = browser_manifest_dirs(Path::new("/home/sam"), layout);
        assert_eq!(dirs.len(), 3, "{layout:?}");
        for d in &dirs {
            assert!(
                d.ends_with("NativeMessagingHosts"),
                "{layout:?}: {} must end in the directory Chrome scans",
                d.display()
            );
        }
    }
}
