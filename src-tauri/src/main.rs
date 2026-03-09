// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Disable WebKit DMA-BUF renderer which causes blank windows on some
    // Wayland compositors (Hyprland, etc.) due to EGL_BAD_PARAMETER errors.
    #[cfg(target_os = "linux")]
    std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");

    wrystr_lib::run()
}
