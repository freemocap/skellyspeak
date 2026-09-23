#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Each native development restart enters through the signed Cargo runner.
    skellyspeak_core::run();
}
