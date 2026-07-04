use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder, Window, WindowEvent,
};

use serde::Serialize;

use sha2::{Digest, Sha256};
use std::{
    fs,
    path::{Path, PathBuf},
    time::{Duration, SystemTime, UNIX_EPOCH},
};

#[cfg(target_os = "macos")]
use std::process::Command;

#[cfg(desktop)]
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

#[cfg(target_os = "macos")]
fn show_app_in_dock(app: &tauri::AppHandle) -> Result<(), String> {
    app.set_activation_policy(tauri::ActivationPolicy::Regular)
        .map_err(|error| error.to_string())
}

#[cfg(not(target_os = "macos"))]
fn show_app_in_dock(_app: &tauri::AppHandle) -> Result<(), String> {
    Ok(())
}

#[cfg(target_os = "macos")]
fn hide_app_from_dock(app: &tauri::AppHandle) -> Result<(), String> {
    app.set_activation_policy(tauri::ActivationPolicy::Accessory)
        .map_err(|error| error.to_string())
}

#[cfg(not(target_os = "macos"))]
fn hide_app_from_dock(_app: &tauri::AppHandle) -> Result<(), String> {
    Ok(())
}

fn show_window(window: &WebviewWindow) -> Result<(), String> {
    window.show().map_err(|error| error.to_string())?;
    window.unminimize().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())?;

    Ok(())
}

fn show_main(app: &tauri::AppHandle) -> Result<(), String> {
    show_app_in_dock(app)?;

    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Main window not found".to_string())?;

    show_window(&window)
}

trait MainWindowHandle: Clone + Send + 'static {
    fn is_window_fullscreen(&self) -> Result<bool, String>;
    fn set_window_fullscreen(&self, fullscreen: bool) -> Result<(), String>;
    fn hide_window(&self) -> Result<(), String>;
}

impl MainWindowHandle for Window {
    fn is_window_fullscreen(&self) -> Result<bool, String> {
        Window::is_fullscreen(self).map_err(|error| error.to_string())
    }

    fn set_window_fullscreen(&self, fullscreen: bool) -> Result<(), String> {
        Window::set_fullscreen(self, fullscreen).map_err(|error| error.to_string())
    }

    fn hide_window(&self) -> Result<(), String> {
        Window::hide(self).map_err(|error| error.to_string())
    }
}

impl MainWindowHandle for WebviewWindow {
    fn is_window_fullscreen(&self) -> Result<bool, String> {
        WebviewWindow::is_fullscreen(self).map_err(|error| error.to_string())
    }

    fn set_window_fullscreen(&self, fullscreen: bool) -> Result<(), String> {
        WebviewWindow::set_fullscreen(self, fullscreen).map_err(|error| error.to_string())
    }

    fn hide_window(&self) -> Result<(), String> {
        WebviewWindow::hide(self).map_err(|error| error.to_string())
    }
}

fn hide_main_to_tray<W>(app: &tauri::AppHandle, window: &W) -> Result<(), String>
where
    W: MainWindowHandle,
{
    if window.is_window_fullscreen().unwrap_or(false) {
        window.set_window_fullscreen(false)?;

        let app_for_thread = app.clone();
        let window_for_thread = window.clone();

        std::thread::spawn(move || {
            // Give macOS a moment to leave the fullscreen Space before hiding.
            // Hiding during that transition can leave a black fullscreen Space behind.
            std::thread::sleep(Duration::from_millis(250));

            let app_for_main = app_for_thread.clone();
            let window_for_main = window_for_thread.clone();

            let _ = app_for_thread.run_on_main_thread(move || {
                if let Err(error) = window_for_main.hide_window() {
                    eprintln!("Could not hide ClipB main window: {error}");
                }

                if let Err(error) = hide_app_from_dock(&app_for_main) {
                    eprintln!("Could not hide ClipB from Dock: {error}");
                }
            });
        });

        return Ok(());
    }

    window.hide_window()?;
    hide_app_from_dock(app)
}

fn get_or_create_quick_window(app: &tauri::AppHandle) -> Result<WebviewWindow, String> {
    if let Some(window) = app.get_webview_window("quick") {
        return Ok(window);
    }

    WebviewWindowBuilder::new(
        app,
        "quick",
        WebviewUrl::App("index.html?window=quick".into()),
    )
    .title("ClipB Quick Copy")
    .inner_size(460.0, 560.0)
    .resizable(false)
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .visible(false)
    .build()
    .map_err(|error| error.to_string())
}

fn show_quick(app: &tauri::AppHandle) -> Result<(), String> {
    let window = get_or_create_quick_window(app)?;

    window.show().map_err(|error| error.to_string())?;
    window.center().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())?;

    Ok(())
}

fn toggle_quick(app: &tauri::AppHandle) -> Result<(), String> {
    let window = get_or_create_quick_window(app)?;

    let is_visible = window.is_visible().map_err(|error| error.to_string())?;

    if is_visible {
        window.hide().map_err(|error| error.to_string())?;
    } else {
        show_quick(app)?;
    }

    Ok(())
}

#[tauri::command]
fn show_main_window(app: tauri::AppHandle) -> Result<(), String> {
    show_main(&app)
}

// -----------------------------------------------------------------------------
// Clipboard commands
// -----------------------------------------------------------------------------

fn validate_existing_paths(paths: &[String]) -> Result<Vec<PathBuf>, String> {
    if paths.is_empty() {
        return Err("No file paths provided".to_string());
    }

    let mut valid_paths = Vec::new();

    for path in paths {
        let file_path = PathBuf::from(path);

        if !file_path.exists() {
            return Err(format!("File path does not exist: {}", path));
        }

        valid_paths.push(file_path);
    }

    Ok(valid_paths)
}

fn validate_existing_file_path(path: &str, label: &str) -> Result<PathBuf, String> {
    let file_path = PathBuf::from(path);

    if !file_path.exists() {
        return Err(format!("{label} does not exist"));
    }

    if !file_path.is_file() {
        return Err(format!("{label} is not a file"));
    }

    Ok(file_path)
}

#[cfg(target_os = "macos")]
fn write_file_paths_to_clipboard_macos(paths: Vec<String>) -> Result<(), String> {
    validate_existing_paths(&paths)?;

    let script = r#"
ObjC.import('AppKit');
ObjC.import('Foundation');

function run(argv) {
  const pasteboard = $.NSPasteboard.generalPasteboard;
  pasteboard.clearContents;

  const fileUrls = $.NSMutableArray.array;

  argv.forEach((path) => {
    const url = $.NSURL.fileURLWithPath(path);
    fileUrls.addObject(url);
  });

  const success = pasteboard.writeObjects(fileUrls);

  if (!success) {
    throw new Error('Could not write file URLs to pasteboard');
  }

  return true;
}
"#;

    let output = Command::new("osascript")
        .arg("-l")
        .arg("JavaScript")
        .arg("-e")
        .arg(script)
        .args(paths)
        .output()
        .map_err(|error| error.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).into_owned());
    }

    Ok(())
}

#[cfg(target_os = "macos")]
fn write_image_file_to_clipboard_macos(path: String) -> Result<(), String> {
    let image_path = validate_existing_file_path(&path, "Image file")?;

    let script = r#"
ObjC.import('AppKit');
ObjC.import('Foundation');

function run(argv) {
  const path = argv[0];
  const pasteboard = $.NSPasteboard.generalPasteboard;
  pasteboard.clearContents;

  const fileUrl = $.NSURL.fileURLWithPath(path);
  const image = $.NSImage.alloc.initWithContentsOfFile(path);
  const objects = $.NSMutableArray.array;

  objects.addObject(fileUrl);

  if (image) {
    objects.addObject(image);
  }

  const success = pasteboard.writeObjects(objects);

  if (!success) {
    throw new Error('Could not write image file to pasteboard');
  }

  return true;
}
"#;

    let output = Command::new("osascript")
        .arg("-l")
        .arg("JavaScript")
        .arg("-e")
        .arg(script)
        .arg(image_path)
        .output()
        .map_err(|error| error.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).into_owned());
    }

    Ok(())
}

#[cfg(target_os = "windows")]
fn write_image_file_to_clipboard_windows(path: String) -> Result<(), String> {
    use clipboard_win::{formats::FileList, Clipboard, Setter};

    let image_path = validate_existing_file_path(&path, "Image file")?;
    let decoded = image::open(&image_path)
        .map_err(|error| format!("Could not decode image file for clipboard: {error}"))?;
    let rgba = decoded.to_rgba8();
    let clipboard_paths = vec![image_path.to_string_lossy().into_owned()];

    let image_data = arboard::ImageData {
        width: rgba.width() as usize,
        height: rgba.height() as usize,
        bytes: std::borrow::Cow::Owned(rgba.into_raw()),
    };

    let mut clipboard =
        arboard::Clipboard::new().map_err(|error| format!("Could not open clipboard: {error}"))?;

    clipboard
        .set_image(image_data)
        .map_err(|error| format!("Could not write image to clipboard: {error}"))?;
    drop(clipboard);

    // Explorer/Desktop paste needs a file-list clipboard format in addition to image pixels.
    let _clipboard = Clipboard::new_attempts(10)
        .map_err(|error| format!("Could not open clipboard for image file reference: {error}"))?;

    FileList
        .write_clipboard(clipboard_paths.as_slice())
        .map_err(|error| format!("Could not write image file reference to clipboard: {error}"))
}

#[tauri::command]
fn write_image_file_to_clipboard(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        write_image_file_to_clipboard_macos(path)
    }

    #[cfg(target_os = "windows")]
    {
        write_image_file_to_clipboard_windows(path)
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = path;
        Err(
            "Native image file clipboard copy is only implemented on macOS and Windows for now."
                .to_string(),
        )
    }
}

#[cfg(target_os = "windows")]
fn write_file_paths_to_clipboard_windows(paths: Vec<String>) -> Result<(), String> {
    use clipboard_win::{formats::FileList, Clipboard, Setter};

    let valid_paths = validate_existing_paths(&paths)?;
    let clipboard_paths = valid_paths
        .iter()
        .map(|path| path.to_string_lossy().into_owned())
        .collect::<Vec<_>>();

    let _clipboard = Clipboard::new_attempts(10)
        .map_err(|error| format!("Could not open clipboard: {error}"))?;

    FileList
        .write_clipboard(clipboard_paths.as_slice())
        .map_err(|error| format!("Could not write file paths to clipboard: {error}"))
}

#[tauri::command]
fn write_file_paths_to_clipboard(paths: Vec<String>) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        write_file_paths_to_clipboard_macos(paths)
    }

    #[cfg(target_os = "windows")]
    {
        write_file_paths_to_clipboard_windows(paths)
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = paths;
        Err("Copying file references is only implemented on macOS and Windows for now.".to_string())
    }
}

#[derive(Debug, Serialize)]
struct ActiveAppInfo {
    app_name: String,
    title: String,
    process_path: String,
    process_id: u64,
}

#[derive(Debug, Serialize)]
struct ImportedImageAsset {
    content_hash: String,
    asset_path: String,
    asset_name: String,
    asset_size: u64,
    asset_mime: String,
}

#[derive(Debug, Serialize)]
struct FilePathInfo {
    path: String,
    name: String,
    size: Option<u64>,
    is_file: bool,
    is_dir: bool,
}

#[derive(Debug, Serialize)]
struct BackedUpFileAsset {
    content_hash: String,
    asset_path: String,
    asset_name: String,
    asset_size: u64,
    asset_mime: String,
}

fn guessed_mime_for_path(path: &Path) -> &'static str {
    let extension = path
        .extension()
        .map(|value| value.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    match extension.as_str() {
        "txt" => "text/plain",
        "md" => "text/markdown",
        "json" => "application/json",
        "pdf" => "application/pdf",
        "zip" => "application/zip",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "gif" => "image/gif",
        "mp4" => "video/mp4",
        "mp3" => "audio/mpeg",
        "csv" => "text/csv",
        "html" => "text/html",
        "css" => "text/css",
        "js" => "text/javascript",
        "ts" => "text/typescript",
        "docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "pptx" => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        _ => "application/octet-stream",
    }
}

fn safe_backup_filename(original_path: &Path) -> Result<String, String> {
    let file_name = original_path
        .file_name()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_else(|| "file".to_string());

    let safe_name: String = file_name
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric()
                || character == '-'
                || character == '_'
                || character == '.'
            {
                character
            } else {
                '-'
            }
        })
        .collect();

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_millis();

    Ok(format!(
        "{}-{}",
        timestamp,
        if safe_name.trim().is_empty() {
            "file"
        } else {
            safe_name.trim_matches('-')
        }
    ))
}

#[tauri::command(rename_all = "snake_case")]
fn backup_file_to_assets(
    app: tauri::AppHandle,
    path: String,
    max_size_bytes: u64,
) -> Result<BackedUpFileAsset, String> {
    let source_path = PathBuf::from(&path);

    if !source_path.exists() {
        return Err("File path does not exist".to_string());
    }

    if !source_path.is_file() {
        return Err("Only files can be backed up right now".to_string());
    }

    let metadata = fs::metadata(&source_path).map_err(|error| error.to_string())?;
    let file_size = metadata.len();

    if file_size > max_size_bytes {
        return Err(format!("File is too large to back up: {} bytes", file_size));
    }

    let bytes = fs::read(&source_path).map_err(|error| error.to_string())?;

    let mut hasher = Sha256::new();
    hasher.update(&bytes);
    let content_hash = hex::encode(hasher.finalize());

    let assets_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("assets")
        .join("files");

    fs::create_dir_all(&assets_dir).map_err(|error| error.to_string())?;

    let asset_name = safe_backup_filename(&source_path)?;
    let asset_path = assets_dir.join(&asset_name);

    fs::write(&asset_path, &bytes).map_err(|error| error.to_string())?;

    Ok(BackedUpFileAsset {
        content_hash,
        asset_path: asset_path.to_string_lossy().into_owned(),
        asset_name,
        asset_size: file_size,
        asset_mime: guessed_mime_for_path(&source_path).to_string(),
    })
}

#[tauri::command]
fn inspect_file_path(path: String) -> Result<FilePathInfo, String> {
    let file_path = PathBuf::from(&path);

    if !file_path.exists() {
        return Err("File path does not exist".to_string());
    }

    let metadata = fs::metadata(&file_path).map_err(|error| error.to_string())?;

    let name = file_path
        .file_name()
        .map(|value| value.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.clone());

    Ok(FilePathInfo {
        path,
        name,
        size: if metadata.is_file() {
            Some(metadata.len())
        } else {
            None
        },
        is_file: metadata.is_file(),
        is_dir: metadata.is_dir(),
    })
}

fn image_mime_for_path(path: &Path) -> Option<&'static str> {
    let extension = path.extension()?.to_string_lossy().to_lowercase();

    match extension.as_str() {
        "png" => Some("image/png"),
        "jpg" | "jpeg" => Some("image/jpeg"),
        "webp" => Some("image/webp"),
        "gif" => Some("image/gif"),
        _ => None,
    }
}

fn safe_asset_filename(original_path: &Path, mime: &str) -> Result<String, String> {
    let extension = match mime {
        "image/png" => "png",
        "image/jpeg" => "jpg",
        "image/webp" => "webp",
        "image/gif" => "gif",
        _ => "bin",
    };

    let stem = original_path
        .file_stem()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_else(|| "image".to_string());

    let safe_stem: String = stem
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || character == '-' || character == '_' {
                character
            } else {
                '-'
            }
        })
        .collect();

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_millis();

    Ok(format!(
        "{}-{}.{}",
        if safe_stem.trim().is_empty() {
            "image"
        } else {
            safe_stem.trim_matches('-')
        },
        timestamp,
        extension
    ))
}

#[tauri::command]
fn import_image_file_to_assets(
    app: tauri::AppHandle,
    path: String,
) -> Result<ImportedImageAsset, String> {
    let source_path = PathBuf::from(path);

    if !source_path.exists() {
        return Err("Image file does not exist".to_string());
    }

    if !source_path.is_file() {
        return Err("Clipboard path is not a file".to_string());
    }

    let mime = image_mime_for_path(&source_path)
        .ok_or_else(|| "Clipboard file is not a supported image".to_string())?;

    let bytes = fs::read(&source_path).map_err(|error| error.to_string())?;

    let mut hasher = Sha256::new();
    hasher.update(&bytes);
    let content_hash = hex::encode(hasher.finalize());

    let assets_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("assets");

    fs::create_dir_all(&assets_dir).map_err(|error| error.to_string())?;

    let asset_name = safe_asset_filename(&source_path, mime)?;
    let asset_path = assets_dir.join(&asset_name);

    fs::write(&asset_path, &bytes).map_err(|error| error.to_string())?;

    Ok(ImportedImageAsset {
        content_hash,
        asset_path: asset_path.to_string_lossy().into_owned(),
        asset_name,
        asset_size: bytes.len() as u64,
        asset_mime: mime.to_string(),
    })
}

#[tauri::command]
fn read_clipboard_file_paths() -> Result<Vec<String>, String> {
    let paths = clipboard_files::read().map_err(|error| format!("{error:?}"))?;

    Ok(paths
        .into_iter()
        .map(|path| path.to_string_lossy().into_owned())
        .collect())
}

#[tauri::command]
fn get_active_app() -> Result<ActiveAppInfo, String> {
    let active_window = active_win_pos_rs::get_active_window()
        .map_err(|_| "Could not get active app".to_string())?;

    Ok(ActiveAppInfo {
        app_name: active_window.app_name,
        title: active_window.title,
        process_path: active_window.process_path.to_string_lossy().into_owned(),
        process_id: active_window.process_id,
    })
}

#[tauri::command]
fn hide_main_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        hide_main_to_tray(&app, &window)?;
    }

    Ok(())
}

#[tauri::command]
fn toggle_quick_window(app: tauri::AppHandle) -> Result<(), String> {
    toggle_quick(&app)
}

#[tauri::command]
fn hide_quick_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("quick") {
        window.hide().map_err(|error| error.to_string())?;
    }

    Ok(())
}

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[cfg(target_os = "macos")]
fn open_main_modifiers() -> Modifiers {
    Modifiers::SUPER | Modifiers::SHIFT
}

#[cfg(not(target_os = "macos"))]
fn open_main_modifiers() -> Modifiers {
    Modifiers::CONTROL | Modifiers::SHIFT
}

fn quick_copy_modifiers() -> Modifiers {
    Modifiers::ALT | Modifiers::SHIFT
}

#[cfg(desktop)]
fn setup_global_shortcuts(app: &tauri::App) -> tauri::Result<()> {
    let open_main_shortcut = Shortcut::new(Some(open_main_modifiers()), Code::KeyB);
    let quick_copy_shortcut = Shortcut::new(Some(quick_copy_modifiers()), Code::KeyQ);

    let open_main_for_handler = open_main_shortcut.clone();
    let quick_copy_for_handler = quick_copy_shortcut.clone();

    app.handle().plugin(
        tauri_plugin_global_shortcut::Builder::new()
            .with_handler(move |app, shortcut, event| {
                if event.state() != ShortcutState::Pressed {
                    return;
                }

                if shortcut == &open_main_for_handler {
                    let _ = show_main(app);
                }

                if shortcut == &quick_copy_for_handler {
                    let _ = toggle_quick(app);
                }
            })
            .build(),
    )?;

    if let Err(error) = app.global_shortcut().register(open_main_shortcut) {
        eprintln!("Could not register ClipB open shortcut: {error}");
    }

    if let Err(error) = app.global_shortcut().register(quick_copy_shortcut) {
        eprintln!("Could not register ClipB quick-copy shortcut: {error}");
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            show_main_window,
            hide_main_window,
            toggle_quick_window,
            hide_quick_window,
            quit_app,
            get_active_app,
            import_image_file_to_assets,
            write_image_file_to_clipboard,
            read_clipboard_file_paths,
            inspect_file_path,
            backup_file_to_assets,
            write_file_paths_to_clipboard
        ])
        .setup(|app| {
            #[cfg(desktop)]
            app.handle().plugin(tauri_plugin_process::init())?;

            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;

            #[cfg(desktop)]
            setup_global_shortcuts(app)?;

            app.handle().plugin(tauri_plugin_autostart::init(
                tauri_plugin_autostart::MacosLauncher::LaunchAgent,
                None,
            ))?;

            let launch_item = MenuItem::with_id(app, "launch", "Launch ClipB", true, None::<&str>)?;
            let quick_copy_item =
                MenuItem::with_id(app, "quick-copy", "Open Quick Copy", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit ClipB", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[&launch_item, &quick_copy_item, &quit_item])?;

            TrayIconBuilder::with_id("clipb-tray")
                .tooltip("ClipB")
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "launch" => {
                        let _ = show_main(app);
                    }
                    "quick-copy" => {
                        let _ = show_quick(app);
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| match event {
            WindowEvent::CloseRequested { api, .. } => {
                api.prevent_close();

                if window.label() == "main" {
                    let app = window.app_handle();
                    let _ = hide_main_to_tray(app, window);
                } else {
                    let _ = window.hide();
                }
            }
            WindowEvent::Resized(_) => {
                if window.label() == "main" {
                    if let Ok(true) = window.is_minimized() {
                        let app = window.app_handle();
                        let _ = hide_main_to_tray(app, window);
                    }
                }
            }
            _ => {}
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        #[cfg(target_os = "macos")]
        {
            if let tauri::RunEvent::Reopen { .. } = event {
                let _ = show_main(app_handle);
            }
        }

        #[cfg(not(target_os = "macos"))]
        {
            let _ = (app_handle, event);
        }
    });
}
