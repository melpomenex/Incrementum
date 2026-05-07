//! Incrementum Tauri application
#![allow(dead_code, private_interfaces, unused)]

mod error;
mod models;
mod database;
mod services;
mod commands;
mod processor;
mod generator;
mod podcast;
mod algorithms;
mod ai;
mod anki;
mod study_json_import;
mod kindle_clippings;
mod supermemo_import;
mod youtube;
mod sync;
mod integrations;
mod ocr;
mod segmentation;
mod notifications;
mod mcp;
mod cloud;
mod cloud_sync;
mod backup;
mod scheduler;
mod demo;
mod browser_sync_server;
mod transcription;
mod utils;
mod notebooklm;
mod pocket_tts;
mod battery;
#[cfg(feature = "screenshot")]
mod screenshot;

#[cfg(test)]
mod security_tests;

use anyhow::Context;
use database::Database;
use std::io::Write;
use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager};
use url::Url;

// Global state for the database
struct AppState {
    db: Arc<Mutex<Option<Database>>>,
}

// Import AI command module types
use commands::ai::AIState;
use commands::focus_timer::FocusTimer;

impl AppState {
    fn new() -> Self {
        Self {
            db: Arc::new(Mutex::new(None)),
        }
    }
}

fn startup_log_path(app: &tauri::AppHandle) -> std::path::PathBuf {
    if let Ok(app_dir) = app.path().app_data_dir() {
        app_dir.join("logs").join("startup.log")
    } else {
        std::env::temp_dir().join("incrementum-startup.log")
    }
}

fn log_startup(app: &tauri::AppHandle, message: &str) {
    let log_path = startup_log_path(app);
    if let Some(parent) = log_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    if let Ok(mut file) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
    {
        let timestamp = chrono::Utc::now().to_rfc3339();
        let _ = writeln!(file, "[{timestamp}] {message}");
    }
}

fn install_panic_hook(app: tauri::AppHandle) {
    // Preserve the default hook so panics are still visible in the console,
    // while also writing to the startup log for GUI launches.
    let default_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        log_startup(&app, &format!("panic: {info}"));
        default_hook(info);
    }));
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // EARLY LOG: Entry point
    let _ = (|| -> anyhow::Result<()> {
        let log_path = std::env::temp_dir().join("incrementum-startup.log");
        let mut file = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_path)?;
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        writeln!(file, "[{timestamp}] startup: run() entry")?;
        Ok(())
    })();

    // Load .env file for environment variables (OAuth client IDs, etc.)
    // This must happen before any code that reads environment variables
    if let Err(e) = dotenvy::dotenv() {
        // Only log if .env exists but failed to load, not if it just doesn't exist
        if std::path::Path::new(".env").exists() {
            eprintln!("Warning: Failed to load .env file: {}", e);
        }
    }

    // EARLY LOG: After dotenv
    let _ = (|| -> anyhow::Result<()> {
        let log_path = std::env::temp_dir().join("incrementum-startup.log");
        let mut file = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_path)?;
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        writeln!(file, "[{timestamp}] startup: after dotenv")?;
        Ok(())
    })();

    // NOTE: WebKitGTK environment variables for Linux are now set in main.rs
    // before this function is called. This ensures they are set early enough
    // to affect all WebKit initialization.

    // Initialize tracing early so all startup logs are captured
    tracing_subscriber::fmt::init();

    const LOCALHOST_PORT: u16 = 9527;

    // EARLY LOG: Before chrono
    let _ = (|| -> anyhow::Result<()> {
        let log_path = std::env::temp_dir().join("incrementum-startup.log");
        let mut file = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_path)?;
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        writeln!(file, "[{timestamp}] startup: before chrono")?;
        Ok(())
    })();

    // Early log for debugging startup crashes
    let _ = (|| -> anyhow::Result<()> {
        let log_path = std::env::temp_dir().join("incrementum-startup.log");
        let mut file = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_path)?;
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        writeln!(file, "[{timestamp}] startup: before builder")?;
        Ok(())
    })();

    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init());

    // Global shortcuts are desktop-only (not available on iOS/Android)
    #[cfg(not(any(target_os = "ios", target_os = "android")))]
    {
        builder = builder.plugin(tauri_plugin_global_shortcut::Builder::new().build());
    }

    builder = builder
        // Temporarily disabled - may cause Windows crash on startup
        // TODO: Re-enable with proper Windows notification handling
        //.plugin(tauri_plugin_notification::init())
        ;

    #[cfg(not(debug_assertions))]
    {
        builder = builder.plugin(tauri_plugin_localhost::Builder::new(LOCALHOST_PORT).build());
    }

    // Packaged webviews can intercept Ctrl/Cmd+key combos before JavaScript sees
    // them. Menu accelerators fire at the native event loop level and provide a
    // second delivery path when the global-shortcut plugin is unavailable or
    // behaves differently in release artifacts.
    #[cfg(any(target_os = "linux", target_os = "windows", target_os = "macos"))]
    {
        builder = builder.menu(|app| {
            use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
            let mut menu = Menu::new(app)?;

            #[cfg(target_os = "macos")]
            {
                use tauri::menu::Submenu;
                let app_submenu = Submenu::with_items(
                    app,
                    "Incrementum",
                    true,
                    &[
                        &MenuItem::with_id(app, "about", "About Incrementum", true, None::<&str>)?,
                        &PredefinedMenuItem::separator(app)?,
                        &MenuItem::with_id(app, "hide", "Hide Incrementum", true, Some("Cmd+H"))?,
                        &PredefinedMenuItem::separator(app)?,
                        &MenuItem::with_id(app, "quit", "Quit Incrementum", true, Some("Cmd+Q"))?,
                    ],
                )?;
                menu.append(&app_submenu)?;

                // Put command palette accelerators in a normal application menu.
                // NSApplication resolves these before WKWebView can swallow Cmd+K.
                let edit_submenu = Submenu::with_items(
                    app,
                    "Edit",
                    true,
                    &[
                        &MenuItem::with_id(app, "accel-k", "Command Palette", true, Some("Cmd+K"))?,
                        &MenuItem::with_id(app, "accel-p", "Command Palette (P)", true, Some("Cmd+P"))?,
                        &PredefinedMenuItem::separator(app)?,
                        &PredefinedMenuItem::cut(app, None)?,
                        &PredefinedMenuItem::copy(app, None)?,
                        &PredefinedMenuItem::paste(app, None)?,
                        &PredefinedMenuItem::select_all(app, None)?,
                    ],
                )?;
                menu.append(&edit_submenu)?;
            }

            #[cfg(target_os = "windows")]
            {
                use tauri::menu::Submenu;
                let edit_submenu = Submenu::with_items(
                    app,
                    "Edit",
                    true,
                    &[
                        &MenuItem::with_id(app, "accel-k", "Command Palette", true, Some("Ctrl+K"))?,
                        &MenuItem::with_id(app, "accel-p", "Command Palette (P)", true, Some("Ctrl+P"))?,
                        &PredefinedMenuItem::separator(app)?,
                        &MenuItem::with_id(app, "accel-q", "Queue", true, Some("Ctrl+Q"))?,
                        &MenuItem::with_id(app, "accel-r", "Review", true, Some("Ctrl+R"))?,
                        &MenuItem::with_id(app, "accel-d", "Dashboard", true, Some("Ctrl+D"))?,
                        &MenuItem::with_id(app, "accel-o", "Open Document", true, Some("Ctrl+O"))?,
                        &MenuItem::with_id(app, "accel-n", "New Document", true, Some("Ctrl+N"))?,
                        &MenuItem::with_id(app, "accel-comma", "Settings", true, Some("Ctrl+,"))?,
                        &MenuItem::with_id(app, "accel-slash", "Shortcuts Help", true, Some("Ctrl+/"))?,
                    ],
                )?;
                menu.append(&edit_submenu)?;
            }

            #[cfg(target_os = "linux")]
            let accel_items: &[(&str, &str, &str)] = &[
                ("accel-k",     "Command Palette (K)", "Control+k"),
                ("accel-p",     "Command Palette (P)", "Control+p"),
                ("accel-q",     "Queue",                "Control+q"),
                ("accel-r",     "Review",               "Control+r"),
                ("accel-d",     "Dashboard",            "Control+d"),
                ("accel-o",     "Open Document",        "Control+o"),
                ("accel-n",     "New Document",         "Control+n"),
                ("accel-comma", "Settings",             "Control+,"),
                ("accel-slash", "Shortcuts Help",       "Control+/"),
            ];
            #[cfg(target_os = "linux")]
            for (id, label, accel) in accel_items {
                let item = MenuItem::with_id(app, id, label, true, Some(accel))?;
                menu.append(&item)?;
            }

            Ok(menu)
        }).on_menu_event(|app, event| {
            let id = event.id.as_ref();
            tracing::info!("[cmd+key] menu event fired: {}", id);

            #[cfg(target_os = "macos")]
            {
                if matches!(id, "quit" | "hide" | "about") {
                    tracing::info!("[cmd+key] skipping built-in macOS menu item: {}", id);
                    return;
                }
            }

            let key_str = match id {
                "accel-k" => "KeyK",
                "accel-p" => "KeyP",
                "accel-q" => "KeyQ",
                "accel-r" => "KeyR",
                "accel-d" => "KeyD",
                "accel-o" => "KeyO",
                "accel-n" => "KeyN",
                "accel-comma" => "Comma",
                "accel-slash" => "Slash",
                _ => return,
            };

            tracing::info!("[cmd+key] emitting global-shortcut to webview: {}", key_str);
            if let Some(window) = app.get_webview_window("main") {
                let event_name = if matches!(key_str, "KeyK" | "KeyP") {
                    "command-palette-open"
                } else {
                    "global-shortcut-native"
                };
                let eval_script = format!(
                    "window.dispatchEvent(new CustomEvent('{}', {{ detail: '{}' }}));",
                    event_name, key_str
                );
                if let Err(e) = window.eval(&eval_script) {
                    tracing::warn!("[cmd+key] eval delivery failed: {}", e);
                }
            }
            match app.emit_to("main", "global-shortcut", key_str) {
                Ok(()) => tracing::info!("[cmd+key] emit_to succeeded"),
                Err(e) => tracing::error!("[cmd+key] emit_to FAILED: {}", e),
            };
        });
    }

    builder
        .setup(|app| {
            let app_handle = app.handle().clone();
            install_panic_hook(app_handle.clone());
            log_startup(&app_handle, "startup: begin");

            // Register global keyboard shortcuts to prevent webview engines
            // (webkit2gtk on Linux, WebView2 on Windows, WKWebView on macOS)
            // from intercepting Ctrl/Cmd+key combos before JavaScript.
            // Desktop-only: global shortcuts are not available on iOS/Android.
            #[cfg(not(any(target_os = "ios", target_os = "android")))]
            {
                use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

                let gs = app.global_shortcut();

                let shortcut_defs: &[(Modifiers, Code)] = &[
                    // Ctrl+key (Linux/Windows)
                    (Modifiers::CONTROL, Code::KeyQ),
                    (Modifiers::CONTROL, Code::KeyR),
                    (Modifiers::CONTROL, Code::KeyD),
                    (Modifiers::CONTROL, Code::KeyK),
                    (Modifiers::CONTROL, Code::KeyP),
                    (Modifiers::CONTROL, Code::Comma),
                    (Modifiers::CONTROL, Code::KeyO),
                    (Modifiers::CONTROL, Code::KeyN),
                    (Modifiers::CONTROL, Code::Slash),
                    (Modifiers::CONTROL, Code::KeyB),
                    (Modifiers::CONTROL, Code::KeyF),
                    (Modifiers::CONTROL, Code::KeyS),
                    (Modifiers::CONTROL, Code::KeyE),
                    (Modifiers::CONTROL, Code::BracketLeft),
                    (Modifiers::CONTROL, Code::BracketRight),
                    (Modifiers::CONTROL | Modifiers::SHIFT, Code::KeyF),
                    (Modifiers::CONTROL | Modifiers::SHIFT, Code::KeyS),
                    // Cmd+key (macOS)
                    (Modifiers::SUPER, Code::KeyQ),
                    (Modifiers::SUPER, Code::KeyR),
                    (Modifiers::SUPER, Code::KeyD),
                    (Modifiers::SUPER, Code::KeyK),
                    (Modifiers::SUPER, Code::KeyP),
                    (Modifiers::SUPER, Code::Comma),
                    (Modifiers::SUPER, Code::KeyO),
                    (Modifiers::SUPER, Code::KeyN),
                    (Modifiers::SUPER, Code::Slash),
                    (Modifiers::SUPER, Code::KeyB),
                    (Modifiers::SUPER, Code::KeyF),
                    (Modifiers::SUPER, Code::KeyS),
                    (Modifiers::SUPER, Code::KeyE),
                    (Modifiers::SUPER, Code::BracketLeft),
                    (Modifiers::SUPER, Code::BracketRight),
                    (Modifiers::SUPER | Modifiers::SHIFT, Code::KeyF),
                    (Modifiers::SUPER | Modifiers::SHIFT, Code::KeyS),
                ];

                let shortcuts: Vec<Shortcut> = shortcut_defs
                    .iter()
                    .map(|(mods, code)| Shortcut::new(Some(*mods), *code))
                    .collect();

                let shortcut_app = app_handle.clone();
                if let Err(e) = gs.on_shortcuts(shortcuts, move |_app, shortcut, event| {
                    if event.state != ShortcutState::Pressed {
                        return;
                    }
                    let key_str = format!("{:?}", shortcut.key);
                    tracing::debug!("global-shortcut fired: {}", key_str);
                    if let Some(window) = shortcut_app.get_webview_window("main") {
                        let event_name = if matches!(key_str.as_str(), "KeyK" | "KeyP") {
                            "command-palette-open"
                        } else {
                            "global-shortcut-native"
                        };
                        let eval_script = format!(
                            "window.dispatchEvent(new CustomEvent('{}', {{ detail: '{}' }}));",
                            event_name, key_str
                        );
                        if let Err(e) = window.eval(&eval_script) {
                            tracing::warn!("[cmd+key] eval delivery failed: {}", e);
                        }
                    }
                    // Keep the Tauri event as a secondary delivery path.
                    let _ = shortcut_app.emit_to("main", "global-shortcut", key_str.as_str());
                }) {
                    tracing::warn!("Failed to register global shortcuts: {}", e);
                } else {
                    tracing::info!("global shortcuts registered ({} shortcuts)", shortcut_defs.len());
                }

                log_startup(&app_handle, "startup: global shortcuts registered");
            }

            // Initialize async runtime for database setup
            let result: anyhow::Result<()> = tauri::async_runtime::block_on(async {
                // Get app data directory
                let app_dir = app
                    .path()
                    .app_data_dir()
                    .context("Failed to get app data dir")?;

                log_startup(&app_handle, &format!("startup: app data dir = {}", app_dir.display()));

                // Ensure directory exists
                std::fs::create_dir_all(&app_dir)
                    .with_context(|| format!("Failed to create app data dir: {}", app_dir.display()))?;

                log_startup(&app_handle, "startup: app data dir ready");

                let db_path = app_dir.join("incrementum.db");

                // Initialize database
                let db = Database::new(db_path)
                    .await
                    .context("Failed to initialize database")?;

                log_startup(&app_handle, "startup: database initialized");

                // Run migrations
                db.migrate()
                    .await
                    .context("Failed to run migrations")?;

                log_startup(&app_handle, "startup: migrations complete");

                // Store database in app state
                let state = AppState::new();
                *state.db.lock().unwrap() = Some(db);

                // Clone the pool for creating repositories before state is moved
                let pool = state.db.lock().unwrap().as_ref().unwrap().pool().clone();

                // Create repository for use in commands
                let repo = database::Repository::new(pool.clone());

                // Initialize cloud auth provider (managed immediately so commands can access it)
                let auth_store = cloud::auth_store::AuthStore::new(app_dir.clone());
                let cloud_auth_provider = cloud::auth_store::CloudAuthProvider::new();

                app.manage(state);
                app.manage(cloud_auth_provider.clone());
                app.manage(auth_store.clone());

                // Load persisted cloud tokens in the background so they don't
                // block app startup.  Providers are registered into the managed
                // state once loaded.
                let bg_cloud_auth = cloud_auth_provider.clone();
                let bg_auth_store = auth_store.clone();
                tauri::async_runtime::spawn(async move {
                    for provider_type in &[
                        cloud::CloudProviderType::OneDrive,
                        cloud::CloudProviderType::GoogleDrive,
                        cloud::CloudProviderType::Dropbox,
                    ] {
                        if let Ok(Some(token)) = bg_auth_store.get_token(*provider_type).await {
                            let provider: Box<dyn cloud::CloudProvider> = match provider_type {
                                cloud::CloudProviderType::OneDrive => {
                                    Box::new(cloud::OneDriveProvider::with_token(
                                        cloud::OneDriveConfig::default(),
                                        token,
                                    ))
                                }
                                cloud::CloudProviderType::GoogleDrive => {
                                    Box::new(cloud::GoogleDriveProvider::with_token(
                                        cloud::GoogleDriveConfig::default(),
                                        token,
                                    ))
                                }
                                cloud::CloudProviderType::Dropbox => {
                                    Box::new(cloud::DropboxProvider::with_token(
                                        cloud::DropboxConfig::default(),
                                        token,
                                    ))
                                }
                            };
                            bg_cloud_auth.set_provider(*provider_type, provider);
                        }
                    }
                    tracing::info!("Cloud auth token loading complete");
                });
                app.manage(AIState::default());
                let ai_key_store = commands::ai_key_store::AIKeyStore::new(app_dir.clone());
                app.manage(ai_key_store.clone());

                // Load API keys from keychain into in-memory AIState on startup.
                let ai_state_handle: tauri::State<'_, AIState> = app.state::<AIState>();
                let ai_config_mutex = Arc::clone(&ai_state_handle.config);
                let bg_key_store = ai_key_store.clone();
                drop(ai_state_handle);
                tauri::async_runtime::spawn(async move {
                    for provider in &["openai", "anthropic", "openrouter"] {
                        match bg_key_store.get_key(provider).await {
                            Ok(Some(key)) => {
                                let mut config = ai_config_mutex.lock().unwrap();
                                let current = config.get_or_insert_with(Default::default);
                                match *provider {
                                    "openai" => current.api_keys.openai = Some(key),
                                    "anthropic" => current.api_keys.anthropic = Some(key),
                                    "openrouter" => current.api_keys.openrouter = Some(key),
                                    _ => {}
                                }
                            }
                            Ok(None) => {}
                            Err(e) => {
                                tracing::warn!("Failed to load AI key for {}: {}", provider, e);
                            }
                        }
                    }
                    tracing::info!("AI API keys loaded from keychain");
                });

                app.manage(FocusTimer::new());
                app.manage(pocket_tts::PocketTTSState::default());
                app.manage(transcription::TranscriptionState {
                    job_queue: transcription::job_queue::JobQueue::new(app.handle().clone(), repo.clone()),
                    auto_queue: transcription::auto_queue::AutoTranscriptionQueue::new(app.handle().clone(), repo.clone()),
                });

                // Check and import demo content in the background so it doesn't
                // block app startup.
                let demo_repo = repo.clone();
                tauri::async_runtime::spawn(async move {
                    if let Err(e) = demo::check_and_import_demo_content(&demo_repo).await {
                        tracing::warn!("Demo content import failed: {}", e);
                    }
                });

                app.manage(repo);

                // Initialize browser sync server in the background if auto-start is enabled.
                let bg_app_handle = app_handle.clone();
                let repo_arc = std::sync::Arc::new(database::Repository::new(pool));
                tauri::async_runtime::spawn(async move {
                    if let Err(e) = browser_sync_server::initialize_if_enabled(repo_arc, bg_app_handle, None).await {
                        tracing::warn!("Browser sync server initialization failed: {}", e);
                    }
                });

                if let Some(window) = app.get_webview_window("main") {
                    if !cfg!(debug_assertions) {
                        if let Ok(url) =
                            Url::parse(&format!("http://localhost:{LOCALHOST_PORT}/"))
                        {
                            let _ = window.navigate(url);
                        }
                    }
                    #[cfg(not(any(target_os = "ios", target_os = "android")))]
                    if std::env::var("INCREMENTUM_OPEN_DEVTOOLS").is_ok() {
                        window.open_devtools();
                    }
                    let _ = window.eval(
                        "console.log('Webview location:', window.location.href);",
                    );

                    // Hide the Linux menu bar where it would otherwise clutter the UI.
                    // Windows WebView2 needs the native menu visible for accelerators.
                    #[cfg(target_os = "linux")]
                    {
                        let _ = window.hide_menu();
                    }
                }

                Ok(())
            });

            if let Err(err) = result {
                log_startup(&app_handle, &format!("startup: error: {err:#}"));
                return Err(err.into());
            }

            log_startup(&app_handle, "startup: complete");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            // Document commands
            commands::get_documents,
            commands::get_document,
            commands::resolve_document_cover,
            commands::create_document,
            commands::update_document,
            commands::update_document_content,
            commands::update_document_priority,
            commands::update_document_progress,
            commands::delete_document,
            commands::dismiss_document,
            // Collection commands
            commands::collections::get_collections,
            commands::collections::create_collection,
            // Position tracking commands
            commands::get_document_position,
            commands::save_document_position,
            commands::get_document_progress,
            commands::create_bookmark,
            commands::list_bookmarks,
            commands::delete_bookmark,
            commands::start_reading_session,
            commands::end_reading_session,
            commands::get_active_session,
            commands::get_documents_with_progress,
            commands::get_daily_reading_stats,
            commands::import_document,
            commands::import_documents,
            commands::import_pdf_highlights_as_extracts,
            commands::read_document_file,
            commands::fetch_url_content,
            commands::fetch_web_page_preview,
            commands::convert_pdf_to_html,
            commands::convert_document_pdf_to_html,
            commands::extract_document_text,
            // Extract commands
            commands::get_extracts,
            commands::get_extract,
            commands::create_extract,
            commands::update_extract,
            commands::delete_extract,
            commands::bulk_delete_extracts,
            commands::bulk_generate_cards,
            commands::submit_extract_review,
            commands::create_cloze_from_extract,
            commands::create_qa_from_extract,
            commands::get_reviewable_extracts,
            // Learning item commands
            commands::get_due_items,
            commands::create_learning_item,
            commands::update_learning_item_content_with_version,
            commands::get_learning_item_versions,
            commands::revert_learning_item_version,
            commands::set_learning_item_prerequisites,
            commands::get_learning_item_prerequisites,
            commands::get_daily_note_links,
            commands::export_mnemosyne,
            commands::generate_learning_items_from_extract,
            commands::get_learning_items,
            commands::get_learning_item,
            commands::get_learning_items_by_extract,
            commands::get_all_learning_items,
            commands::check_semantic_duplicate_candidates,
            // Image registry commands
            commands::ingest_image_asset,
            commands::list_image_assets,
            commands::get_image_asset,
            commands::delete_image_asset,
            // Category commands
            commands::get_categories,
            commands::create_category,
            // Queue commands
            commands::get_queue,
            commands::get_next_queue_item,
            commands::get_queue_items,
            commands::get_queued_items,
            commands::get_due_queue_items,
            commands::get_due_documents_only,
            commands::get_queue_with_playlist_intersperse,
            commands::get_queue_stats,
            commands::postpone_item,
            commands::bulk_suspend_items,
            commands::bulk_unsuspend_items,
            commands::bulk_delete_items,
            commands::export_queue,
            // Review commands
            commands::start_review,
            commands::submit_review,
            commands::restore_learning_item_state,
            commands::get_next_review_times,
            commands::preview_review_intervals,
            commands::get_review_streak,
            // Algorithm commands
            commands::calculate_sm2_next,
            commands::rate_document,
            commands::rate_document_engaging,
            commands::restore_document_scheduling,
            commands::rate_extract,
            commands::calculate_priority_scores,
            commands::compare_algorithms_command,
            commands::get_algorithm_params,
            commands::get_review_statistics,
            commands::get_due_workload_forecast,
            commands::optimize_algorithm_params,
            commands::get_default_engagement_preferences,
            commands::get_smart_start_position,
            // AI commands
            commands::get_ai_config,
            commands::set_ai_config,
            commands::set_api_key,
            commands::get_masked_api_key,
            commands::remove_api_key,
            commands::generate_flashcards_from_extract,
            commands::generate_flashcards_from_content,
            commands::answer_question,
            commands::answer_about_extract,
            commands::summarize_content,
            commands::extract_key_points,
            commands::generate_title,
            commands::simplify_content,
            commands::generate_questions,
            commands::list_ollama_models,
            commands::test_ai_connection,
            commands::generate_progressive_summaries,
            // Analytics commands
            commands::get_dashboard_stats,
            commands::get_memory_stats,
            commands::get_activity_data,
            commands::get_category_stats,
            commands::get_leech_dashboard,
            commands::get_workload_data,
            commands::get_workload_day_details,
            // YouTube commands
            youtube::check_ytdlp,
            youtube::setup_ytdlp_auto,
            youtube::get_ytdlp_path,
            youtube::get_youtube_video_info,
            youtube::get_youtube_formats,
            youtube::download_youtube_video,
            youtube::get_youtube_transcript,
            youtube::get_youtube_transcript_by_id,
            youtube::search_youtube_videos,
            youtube::get_youtube_playlist_info,
            youtube::extract_youtube_video_id,
            youtube::import_youtube_video,
            youtube::get_youtube_chapters,
            // Video commands
            commands::import_video_file,
            commands::get_video_storage_path,
            commands::add_video_bookmark,
            commands::get_video_bookmarks,
            commands::delete_video_bookmark,
            commands::set_video_chapters,
            commands::get_video_chapters,
            commands::set_video_transcript,
            commands::get_video_transcript,
            commands::generate_video_transcript,
            commands::split_audio_for_groq,
            commands::cleanup_audio_chunks,
            commands::read_file_bytes,
            // Video extract commands
            commands::create_video_extract,
            commands::get_video_extracts,
            commands::get_video_extract,
            commands::update_video_extract,
            commands::delete_video_extract,
            commands::rate_video_extract,
            // Audiobook commands
            commands::parse_audiobook_metadata,
            commands::import_podcast_audio_file,
            commands::scan_directory_for_audiobooks,
            commands::parse_audiobook_chapters,
            commands::prepare_audiobook_playback,
            commands::extract_audio_sample,
            commands::generate_audiobook_transcript,
            commands::extract_audio_cover_art,
            // YouTube playlist auto-import commands
            commands::subscribe_to_playlist,
            commands::get_playlist_subscriptions,
            commands::get_playlist_subscription,
            commands::update_playlist_subscription,
            commands::delete_playlist_subscription,
            commands::refresh_playlist,
            commands::import_playlist_video,
            commands::get_unimported_playlist_videos,
            commands::get_playlist_settings,
            commands::update_playlist_settings,
            commands::get_playlist_queue_items,
            commands::mark_playlist_video_queued,
            // Sync commands
            sync::sync_now,
            sync::get_sync_status,
            sync::resolve_sync_conflict,
            sync::get_sync_log,
            // Integration commands
            integrations::export_to_obsidian,
            integrations::export_extract_to_obsidian,
            integrations::export_flashcards_to_obsidian,
            integrations::export_conversation_to_obsidian,
            integrations::export_assistant_message_to_obsidian,
            integrations::import_from_obsidian,
            integrations::sync_to_obsidian,
            integrations::sync_from_obsidian,
            integrations::sync_to_logseq,
            integrations::sync_from_logseq,
            integrations::delete_from_obsidian,
            integrations::sync_flashcard_to_anki,
            integrations::sync_flashcards_to_anki,
            integrations::start_extension_server,
            integrations::stop_extension_server,
            integrations::get_extension_server_status,
            integrations::send_to_extension,
            integrations::process_extension_page,
            // NotebookLM integration commands
            notebooklm::notebooklm_get_settings,
            notebooklm::notebooklm_set_settings,
            notebooklm::notebooklm_connect,
            notebooklm::notebooklm_disconnect,
            notebooklm::notebooklm_health,
            notebooklm::notebooklm_list_notebooks,
            notebooklm::notebooklm_create_notebook,
            notebooklm::notebooklm_select_notebook,
            notebooklm::notebooklm_list_sources,
            notebooklm::notebooklm_add_source,
            notebooklm::notebooklm_refresh_source,
            notebooklm::notebooklm_ask,
            notebooklm::notebooklm_research,
            notebooklm::notebooklm_generate_artifact,
            notebooklm::notebooklm_get_jobs,
            notebooklm::notebooklm_get_job,
            notebooklm::notebooklm_preview_flashcards,
            notebooklm::notebooklm_preview_quiz_import,
            notebooklm::notebooklm_sync_flashcards,
            notebooklm::notebooklm_sync_quiz,
            notebooklm::notebooklm_sync_preview_items,
            notebooklm::notebooklm_export_job_artifact,
            notebooklm::notebooklm_check_cli,
            notebooklm::notebooklm_cli_login,
            notebooklm::notebooklm_cli_logout,
            notebooklm::notebooklm_cli_status,
            // Pocket TTS commands
            pocket_tts::pocket_tts_status,
            pocket_tts::pocket_tts_generate,
            pocket_tts::pocket_tts_stop,
            pocket_tts::pocket_tts_cleanup,
            // Browser sync server commands (HTTP for extension)
            browser_sync_server::start_browser_sync_server,
            browser_sync_server::stop_browser_sync_server,
            browser_sync_server::get_browser_sync_server_status,
            browser_sync_server::get_browser_sync_config,
            browser_sync_server::set_browser_sync_config,
            browser_sync_server::get_automation_api_key,
            browser_sync_server::rotate_automation_api_key,
            // RSS commands
            commands::create_rss_feed,
            commands::get_rss_feeds,
            commands::get_rss_feed,
            commands::update_rss_feed,
            commands::delete_rss_feed,
            commands::create_rss_article,
            commands::get_rss_articles,
            commands::mark_rss_article_read,
            commands::toggle_rss_article_queued,
            commands::update_rss_feed_fetched,
            commands::get_rss_feed_unread_count,
            commands::cleanup_old_rss_articles,
            commands::fetch_rss_feed_url,
            // RSS full content fetching commands
            commands::fetch_article_full_content,
            commands::update_feed_auto_fetch,
            commands::get_article_full_content,
            // Substack API proxy commands
            commands::substack_search,
            commands::substack_categories,
            commands::substack_pub_homepage,
            commands::substack_category_feed,
            // RSS feature commands (NewsBlur-inspired)
            commands::add_rss_classifier,
            commands::remove_rss_classifier,
            commands::get_rss_classifiers,
            commands::update_rss_classifiers_batch,
            commands::compute_intelligence_score,
            commands::recompute_all_intelligence_scores,
            commands::get_rss_articles_with_intelligence,
            commands::mark_rss_article_unread,
            commands::mark_rss_articles_before_date_read,
            commands::mark_rss_articles_after_date_read,
            commands::auto_mark_articles_as_read,
            commands::get_read_rss_articles,
            commands::get_river_of_news,
            commands::search_rss_articles,
            commands::fts_search,
            commands::fts_search_suggestions,
            commands::fts_get_stats,
            commands::fts_reindex,
            commands::compute_story_clusters,
            commands::get_rss_article_clusters,
            commands::invalidate_clusters_for_feed,
            commands::add_tag,
            commands::remove_tag,
            commands::get_article_tags,
            commands::get_all_tags,
            commands::tag_article,
            commands::untag_article,
            commands::get_articles_by_tag,
            commands::rename_tag,
            commands::merge_tags,
            commands::create_annotation,
            commands::get_article_annotations,
            commands::update_annotation,
            commands::delete_annotation,
            commands::get_discovered_sites,
            commands::delete_discovered_site,
            commands::refresh_discoveries,
            commands::seed_curated_feeds,
            commands::create_rss_folder,
            commands::update_rss_folder,
            commands::delete_rss_folder,
            commands::get_rss_folders,
            commands::move_feed_to_folder,
            commands::reorder_feeds,
            commands::reorder_folders,
            commands::toggle_feed_active,
            commands::get_feed_statistics,
            commands::set_feed_view_preferences,
            commands::migrate_folders_from_localstorage,
            // Segmentation commands
            commands::segment_document,
            commands::auto_segment_and_create_extracts,
            // Legacy import commands
            commands::import_legacy_archive,
            commands::preview_segmentation,
            commands::extract_key_points_from_text,
            commands::batch_segment_documents,
            commands::get_recommended_segmentation,
            // Notification commands
            commands::check_notification_permission,
            commands::request_notification_permission,
            commands::send_notification,
            commands::send_study_reminder,
            commands::send_cards_due_notification,
            commands::send_review_completed_notification,
            commands::send_document_imported_notification,
            // Anna's Archive commands
            commands::search_books,
            commands::download_book,
            commands::get_available_mirrors,
            commands::schedule_study_reminders,
            commands::get_notification_settings,
            commands::update_notification_settings,
            commands::create_custom_notification,
            // MCP commands
            commands::mcp::mcp_list_servers,
            commands::mcp::mcp_add_server,
            commands::mcp::mcp_remove_server,
            commands::mcp::mcp_update_server,
            commands::mcp::mcp_list_tools,
            commands::mcp::mcp_call_tool,
            commands::mcp::mcp_get_incrementum_tools,
            commands::mcp::mcp_call_incrementum_tool,
            commands::mcp::mcp_get_server_tools,
            commands::mcp::mcp_get_server_info,
            // LLM commands
            commands::llm::llm_chat,
            commands::llm::llm_chat_with_context,
            commands::llm::llm_stream_chat,
            commands::llm::llm_get_models,
            commands::llm::llm_test_connection,
            // Cloud OAuth commands
            commands::oauth_start,
            commands::oauth_callback,
            commands::oauth_get_account,
            commands::oauth_disconnect,
            commands::oauth_is_authenticated,
            // Cloud Backup commands
            commands::backup_create,
            commands::backup_restore,
            commands::backup_list,
            commands::backup_delete,
            // Cloud Sync commands
            commands::cloud_sync_init,
            commands::cloud_sync_now,
            commands::cloud_sync_get_status,
            commands::cloud_sync_resolve_conflicts,
            commands::cloud_list_files,
            commands::cloud_import_files,
            commands::import_collection_archive,
            // Scheduler commands
            commands::scheduler_init,
            commands::scheduler_start,
            commands::scheduler_stop,
            commands::scheduler_update_config,
            commands::scheduler_get_status,
            commands::scheduler_trigger_backup,
            // Anki import commands
            anki::import_anki_package_to_learning_items,
            anki::import_anki_package_bytes_to_learning_items,
            // Anki export commands
            anki::export_deck_as_apkg,
            anki::export_deck_as_csv,
            anki::export_all_decks_as_apkg,
            // SuperMemo import commands
            supermemo_import::import_supermemo_package,
            supermemo_import::validate_supermemo_package,
            // Study JSON import commands
            study_json_import::import_study_json_file,
            study_json_import::validate_study_json_file,
            // Kindle clippings import commands
            kindle_clippings::parse_kindle_clippings_file,
            kindle_clippings::validate_kindle_clippings,
            kindle_clippings::import_kindle_clippings_file,
            kindle_clippings::backfill_kindle_imports,
            // Demo content commands
            demo::import_demo_content_manually,
            demo::get_demo_content_status,
            // OCR commands
            commands::init_ocr,
            commands::ocr_image_file,
            commands::ocr_image_bytes,
            commands::ocr_pdf_file,
            commands::extract_key_phrases,
            commands::get_available_ocr_providers,
            commands::is_provider_available,
            commands::get_ocr_config,
            commands::update_ocr_config,
            commands::glm_runtime_status,
            commands::glm_download_ollama_installer,
            commands::glm_open_installer,
            commands::glm_start_ollama_runtime,
            commands::glm_stop_ollama_runtime,
            commands::glm_pull_ollama_model,
            // Screenshot commands
            #[cfg(feature = "screenshot")]
            screenshot::capture_screenshot,
            #[cfg(feature = "screenshot")]
            screenshot::capture_screen_by_index,
            #[cfg(feature = "screenshot")]
            screenshot::capture_app_window,
            #[cfg(feature = "screenshot")]
            screenshot::get_screen_info,
            // Transcription commands
            transcription::get_transcription_profiles,
            transcription::download_transcription_model,
            transcription::delete_transcription_model,
            transcription::start_transcription,
            transcription::get_transcript,
            transcription::enqueue_auto_transcription,
            transcription::get_transcription_queue,
            transcription::cancel_transcription_job,
            transcription::retry_transcription_job,
            transcription::prioritize_transcription_job,
            transcription::get_transcription_status,
            transcription::enqueue_all_untranscribed,
            transcription::clear_transcription_queue,
            transcription::remove_transcription_entry,
            // Semantic search commands - TEMPORARILY DISABLED for debugging Windows startup crash
            // commands::generate_embedding,
            // commands::generate_embeddings_batch,
            // commands::index_transcript,
            // commands::semantic_search,
            // commands::get_embedding_models,
            // commands::clear_all_embeddings,
            // commands::get_embedding_stats,
            // commands::is_indexed,
            // Focus timer commands
            commands::get_focus_timer_state,
            commands::start_focus_timer,
            commands::pause_focus_timer,
            commands::reset_focus_timer,
            commands::skip_focus_timer_phase,
            commands::update_focus_timer_config,
            commands::get_focus_timer_remaining,
            commands::tick_focus_timer,
            commands::reset_focus_timer_daily_stats,
            // Battery state command
            battery::get_battery_state,
            // Podcast commands
            commands::subscribe_podcast,
            commands::unsubscribe_podcast,
            commands::rename_podcast_feed,
            commands::get_podcast_feeds,
            commands::refresh_podcast_feed,
            commands::get_podcast_episodes,
            commands::mark_episode_played,
            commands::update_episode_position,
            commands::get_episode_position,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
