#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

fn main() {
    // Logging is installed by tauri-plugin-log inside `run()`; initializing a
    // second logger here would make that call fail.
    app_lib::run();
}
