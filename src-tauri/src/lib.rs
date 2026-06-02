// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use std::fs;

#[derive(serde::Serialize)]
struct AudioFileInfo {
    name: String,
    path: String,
}

#[derive(serde::Serialize)]
struct BmsOpenResult {
    file_name: String,
    content_bytes: Vec<u8>,
    dir_path: String,
    audio_files: Vec<AudioFileInfo>,
}

#[tauri::command]
fn open_bms_dialog(default_path: Option<String>) -> Result<Option<BmsOpenResult>, String> {
    let mut dialog = rfd::FileDialog::new()
        .add_filter("BMS Files", &["bms", "bme", "bml", "pms"]);

    if let Some(ref path_str) = default_path {
        let path = std::path::Path::new(path_str);
        if path.exists() {
            dialog = dialog.set_directory(path);
        }
    }

    let file_path = dialog.pick_file();

    match file_path {
        Some(path) => {
            let file_name = path.file_name()
                .ok_or_else(|| "Invalid file name".to_string())?
                .to_string_lossy()
                .to_string();

            let content_bytes = fs::read(&path).map_err(|e| e.to_string())?;
            
            let parent_dir = path.parent()
                .ok_or_else(|| "No parent directory".to_string())?;
            let dir_path = parent_dir.to_string_lossy().to_string();

            let mut audio_files = Vec::new();
            if let Ok(entries) = fs::read_dir(parent_dir) {
                for entry in entries.flatten() {
                    if let Ok(file_type) = entry.file_type() {
                        if file_type.is_file() {
                            let name = entry.file_name().to_string_lossy().to_string();
                            let lower = name.to_lowercase();
                            if lower.ends_with(".wav") || lower.ends_with(".ogg") || lower.ends_with(".mp3") || lower.ends_with(".flac") {
                                let full_audio_path = entry.path().to_string_lossy().to_string();
                                audio_files.push(AudioFileInfo {
                                    name,
                                    path: full_audio_path,
                                });
                            }
                        }
                    }
                }
            }

            Ok(Some(BmsOpenResult {
                file_name,
                content_bytes,
                dir_path,
                audio_files,
            }))
        }
        None => Ok(None)
    }
}

#[tauri::command]
fn load_bms_by_path(file_path: String) -> Result<BmsOpenResult, String> {
    let path = std::path::Path::new(&file_path);
    if !path.exists() {
        return Err("File does not exist".to_string());
    }

    let file_name = path.file_name()
        .ok_or_else(|| "Invalid file name".to_string())?
        .to_string_lossy()
        .to_string();

    let content_bytes = fs::read(&path).map_err(|e| e.to_string())?;

    let parent_dir = path.parent()
        .ok_or_else(|| "No parent directory".to_string())?;
    let dir_path = parent_dir.to_string_lossy().to_string();

    let mut audio_files = Vec::new();
    if let Ok(entries) = fs::read_dir(parent_dir) {
        for entry in entries.flatten() {
            if let Ok(file_type) = entry.file_type() {
                if file_type.is_file() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    let lower = name.to_lowercase();
                    if lower.ends_with(".wav") || lower.ends_with(".ogg") || lower.ends_with(".mp3") || lower.ends_with(".flac") {
                        let full_audio_path = entry.path().to_string_lossy().to_string();
                        audio_files.push(AudioFileInfo {
                            name,
                            path: full_audio_path,
                        });
                    }
                }
            }
        }
    }

    Ok(BmsOpenResult {
        file_name,
        content_bytes,
        dir_path,
        audio_files,
    })
}

#[tauri::command]
fn read_local_file(path: String) -> Result<tauri::ipc::Response, String> {
    let bytes = fs::read(path).map_err(|e| e.to_string())?;
    Ok(tauri::ipc::Response::new(bytes))
}

#[tauri::command]
fn save_bms_dialog(default_path: Option<String>, suggested_name: Option<String>) -> Result<Option<String>, String> {
    let mut dialog = rfd::FileDialog::new()
        .add_filter("BMS Files", &["bms", "bme", "bml", "pms"]);

    if let Some(ref path_str) = default_path {
        let path = std::path::Path::new(path_str);
        if path.exists() {
            dialog = dialog.set_directory(path);
        }
    }

    if let Some(ref name) = suggested_name {
        dialog = dialog.set_file_name(name);
    }

    let file_path = dialog.save_file();

    Ok(file_path.map(|path| path.to_string_lossy().to_string()))
}

#[tauri::command]
fn write_local_file(path: String, content: String, encoding: Option<String>) -> Result<(), String> {
    let encoding_name = encoding.unwrap_or_else(|| "utf-8".to_string()).to_lowercase();
    
    let bytes = match encoding_name.as_str() {
        "shift-jis" | "shift_jis" | "sjis" => {
            let (cow, _, _) = encoding_rs::SHIFT_JIS.encode(&content);
            cow.into_owned()
        }
        "euc-kr" | "euc_kr" => {
            let (cow, _, _) = encoding_rs::EUC_KR.encode(&content);
            cow.into_owned()
        }
        _ => {
            content.into_bytes()
        }
    };

    fs::write(path, bytes).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_args_file() -> Option<String> {
    let args: Vec<String> = std::env::args().collect();
    if args.len() > 1 {
        for arg in args.iter().skip(1) {
            let path = std::path::Path::new(arg);
            if path.exists() && path.is_file() {
                if let Some(ext) = path.extension() {
                    let ext_str = ext.to_string_lossy().to_lowercase();
                    if ext_str == "bms" || ext_str == "bme" || ext_str == "bml" || ext_str == "pms" {
                        return Some(arg.to_string());
                    }
                }
            }
        }
    }
    None
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            open_bms_dialog,
            read_local_file,
            load_bms_by_path,
            save_bms_dialog,
            write_local_file,
            get_args_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

