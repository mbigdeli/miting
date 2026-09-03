//! Where each Chromium build looks for native-messaging manifests.
//!
//! Split from `native_host` so the layout compiles and is tested on every
//! host, not only the one it targets.

use std::path::{Path, PathBuf};

/// Which Chromium family a manifest directory layout belongs to.
///
/// Taken as a parameter rather than read from `cfg!` so the layout is testable
/// on any host. The `cfg` that picks one is three lines further down; a rule
/// that only ever compiles on one platform is how this silently did nothing
/// outside Windows in the first place.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ChromiumLayout {
    /// `~/Library/Application Support/<browser>/NativeMessagingHosts`
    MacOs,
    /// `~/.config/<browser>/NativeMessagingHosts` (XDG)
    Xdg,
}

/// Directories a Chromium build scans for native-messaging manifests.
///
/// There is no registry outside Windows: the browser reads these paths
/// directly, so the manifest has to be written into them under its host name.
pub fn browser_manifest_dirs(home: &Path, layout: ChromiumLayout) -> Vec<PathBuf> {
    let (base, browsers): (&str, [&str; 3]) = match layout {
        ChromiumLayout::MacOs => (
            "Library/Application Support",
            ["Google/Chrome", "Microsoft Edge", "Chromium"],
        ),
        ChromiumLayout::Xdg => (".config", ["google-chrome", "microsoft-edge", "chromium"]),
    };
    browsers
        .iter()
        .map(|b| home.join(base).join(b).join("NativeMessagingHosts"))
        .collect()
}
