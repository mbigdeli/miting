//! Typed errors for the companion-extension install commands. Serialized as
//! human-readable strings so the settings UI can show them directly.

#[derive(Debug, thiserror::Error)]
pub enum ExtensionInstallError {
    /// Bundled extension files are absent (dev build without a synced dist).
    #[error(
        "Extension files are not bundled with this build. \
         Run `npm run build` in extension/ and restart the app."
    )]
    NotBundled,
    #[error("Could not resolve an app directory: {0}")]
    Path(String),
    #[error("Could not copy the extension files: {0}")]
    Copy(String),
    #[error("Could not replace the previous extension files (close Chrome and try again): {0}")]
    Swap(String),
    /// The copy reported success but the result is not a loadable extension.
    /// Reported rather than swallowed: the settings tab must never hand Chrome
    /// a path that will fail there instead of here.
    #[error("The extension files did not land correctly at {0}. Try again, or restart the app.")]
    Unverified(String),
    /// Nothing on disk to reveal yet — prepare the files first.
    #[error("The extension files have not been prepared yet.")]
    NotPrepared,
    #[error("Could not open the extension folder: {0}")]
    OpenFolder(String),
    /// UI falls back to "type chrome://extensions manually".
    #[error("Google Chrome was not found on this machine.")]
    BrowserNotFound,
    #[error("Failed to launch the browser: {0}")]
    BrowserLaunch(String),
}

impl serde::Serialize for ExtensionInstallError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}
