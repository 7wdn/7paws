#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if std::env::args().any(|a| a == "--mcp") {
        seven_paws_lib::run_mcp_stdio();
        return;
    }
    seven_paws_lib::run()
}