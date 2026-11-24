mod store;

use std::path::PathBuf;
use store::{LoadProjectResult, Project, ProjectSummary, Store};
use tauri::{Manager, State};

#[tauri::command]
fn list_projects(store: State<'_, Store>) -> Result<Vec<ProjectSummary>, String> {
    store.list()
}

#[tauri::command]
fn create_project(name: String, store: State<'_, Store>) -> Result<Project, String> {
    store.create(&name)
}

#[tauri::command]
fn load_project(id: String, store: State<'_, Store>) -> Result<LoadProjectResult, String> {
    store.load(&id)
}

#[tauri::command]
fn save_project(project: Project, store: State<'_, Store>) -> Result<Project, String> {
    store.save(project)
}

#[tauri::command]
fn delete_project(id: String, store: State<'_, Store>) -> Result<(), String> {
    store.remove(&id)
}

#[tauri::command]
fn open_data_folder(store: State<'_, Store>) -> Result<(), String> {
    store.open_folder()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .setup(|app| {
            let data_dir = if let Some(path) = std::env::var_os("AQIAN_DATA_DIR") {
                PathBuf::from(path).join("projects")
            } else {
                let documents = app
                    .path()
                    .document_dir()
                    .or_else(|_| app.path().app_data_dir())?;
                documents.join("A钱小工具-Tauri").join("projects")
            };
            app.manage(Store::new(data_dir));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_projects,
            create_project,
            load_project,
            save_project,
            delete_project,
            open_data_folder
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
