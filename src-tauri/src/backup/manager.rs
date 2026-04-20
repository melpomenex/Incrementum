//! Backup Manager
//!
//! Handles creating and restoring backups from cloud storage.
//! Supports Rust-native ZIP compression, AES-256-GCM encryption with
//! PBKDF2 key derivation, and SQLite online backup for database restore.

use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, AeadCore, Nonce,
};
use base64::Engine;
use chrono::{DateTime, Utc};
use pbkdf2::pbkdf2_hmac;
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use sqlx::Row;
use std::ffi::OsStr;
use std::io::Write;
use std::path::{Path as StdPath, PathBuf};
use tokio::fs;
use walkdir::WalkDir;
use zip::write::{FileOptions, ZipWriter};

use crate::cloud::{
    BackupOptions, BackupInfo, BackupIncludes, CloudProvider,
    RestoreConflict, RestoreResult,
};
use crate::database::Database;
use crate::error::AppError;
use crate::models::{Document, DocumentMetadata, FileType};

/// Backup Manager
pub struct BackupManager {
    db: Database,
    db_path: PathBuf,
    temp_dir: PathBuf,
}

impl BackupManager {
    /// Create a new backup manager
    ///
    /// `db_path` is the path to the live SQLite database file on disk,
    /// needed for SQLite online backup during restore.
    pub fn new(db: Database, db_path: PathBuf) -> Result<Self, AppError> {
        let temp_dir = std::env::temp_dir().join("incrementum-backups");

        Ok(Self {
            db,
            db_path,
            temp_dir,
        })
    }

    /// Get the temporary backup directory
    fn get_temp_dir(&self) -> PathBuf {
        self.temp_dir.clone()
    }

    // ── Public API ─────────────────────────────────────────────

    /// Create a full backup
    pub async fn create_backup(
        &self,
        provider: &dyn CloudProvider,
        options: BackupOptions,
    ) -> Result<BackupInfo, AppError> {
        let timestamp = Utc::now();
        let backup_id = format!("backup_{}", timestamp.timestamp());
        let device_id = self.get_device_id();
        let app_version = env!("CARGO_PKG_VERSION").to_string();

        // Create temporary directory for this backup
        let backup_dir = self.temp_dir.join(&backup_id);
        fs::create_dir_all(&backup_dir)
            .await
            .map_err(|e| AppError::Internal(format!("Failed to create backup dir: {}", e)))?;

        let mut file_count = 0;
        let mut total_size: u64 = 0;

        // 1. Export database
        if options.include_database {
            let db_export_path = backup_dir.join("incrementum.db");
            self.export_database(&db_export_path).await?;
            file_count += 1;
            total_size += fs::metadata(&db_export_path)
                .await
                .map(|m| m.len())
                .unwrap_or(0);
        }

        // 2. Copy document files
        if options.include_documents {
            let docs_dir = backup_dir.join("documents");
            fs::create_dir_all(&docs_dir)
                .await
                .map_err(|e| AppError::Internal(format!("Failed to create docs dir: {}", e)))?;

            let (count, size) = self.copy_documents(&docs_dir).await?;
            file_count += count;
            total_size += size;
        }

        // 3. Export settings
        if options.include_settings {
            if let Some(ref settings) = options.settings_json {
                let settings_path = backup_dir.join("settings.json");
                fs::write(&settings_path, settings)
                    .await
                    .map_err(|e| AppError::Internal(format!("Failed to write settings: {}", e)))?;
                file_count += 1;
                total_size += settings.len() as u64;
            }
        }

        // 4. Build encryption metadata (before manifest creation)
        let mut salt_b64: Option<String> = None;
        let mut nonce_b64: Option<String> = None;

        // 5. Create backup manifest (includes encryption metadata)
        let manifest = BackupManifest {
            id: backup_id.clone(),
            version: "1.0".to_string(),
            created_at: timestamp,
            device_id: device_id.clone(),
            app_version: app_version.clone(),
            backup_type: if options.include_documents && options.include_database {
                "full"
            } else if options.include_documents {
                "documents"
            } else {
                "database"
            }
            .to_string(),
            includes: BackupIncludes {
                database: options.include_database,
                documents: options.include_documents,
                settings: options.include_settings,
            },
            files: BackupFiles {
                database: if options.include_database {
                    Some("incrementum.db".to_string())
                } else {
                    None
                },
                documents: if options.include_documents {
                    Some("documents/".to_string())
                } else {
                    None
                },
                count: file_count,
                total_size,
            },
            encryption: BackupEncryption {
                enabled: options.encrypt,
                algorithm: if options.encrypt {
                    Some("AES-256-GCM".to_string())
                } else {
                    None
                },
                salt: salt_b64.clone(),
                nonce: nonce_b64.clone(),
            },
        };

        let manifest_path = backup_dir.join("manifest.json");
        let manifest_json = serde_json::to_string_pretty(&manifest)
            .map_err(|e| AppError::Internal(format!("Failed to serialize manifest: {}", e)))?;

        fs::write(&manifest_path, manifest_json)
            .await
            .map_err(|e| AppError::Internal(format!("Failed to write manifest: {}", e)))?;

        // 6. Compress backup to ZIP
        let zip_path = backup_dir.with_extension("zip");
        self.compress_backup(&backup_dir, &zip_path).await?;
        let mut backup_data = fs::read(&zip_path)
            .await
            .map_err(|e| AppError::Internal(format!("Failed to read zip file: {}", e)))?;

        // Remove uncompressed folder and zip temp file
        let _ = tokio::fs::remove_dir_all(&backup_dir).await;

        // Capture values needed for BackupInfo before encryption block may move manifest
        let backup_type = manifest.backup_type.clone();
        let includes = manifest.includes.clone();

        // 7. Encrypt the ZIP if requested
        let encrypted = options.encrypt && options.password.is_some();
        if encrypted {
            let password = options.password.as_deref().unwrap();
            let salt = rand::random::<[u8; 16]>();
            let (ciphertext, nonce_bytes) = encrypt_data(&backup_data, password, &salt)?;

            salt_b64 = Some(base64::engine::general_purpose::STANDARD.encode(&salt));
            nonce_b64 = Some(base64::engine::general_purpose::STANDARD.encode(&nonce_bytes));

            // Rebuild manifest with encryption metadata
            let manifest = BackupManifest {
                encryption: BackupEncryption {
                    enabled: true,
                    algorithm: Some("AES-256-GCM".to_string()),
                    salt: salt_b64.clone(),
                    nonce: nonce_b64.clone(),
                },
                ..manifest
            };
            let manifest_json = serde_json::to_string_pretty(&manifest)
                .map_err(|e| AppError::Internal(format!("Failed to serialize manifest: {}", e)))?;

            backup_data = ciphertext;
            total_size = backup_data.len() as u64;

            // Upload manifest separately (unencrypted, for listing)
            let manifest_cloud_path = format!("/backups/{}.manifest.json", backup_id);
            provider
                .upload_file(
                    &manifest_cloud_path,
                    manifest_json.into_bytes(),
                    None,
                )
                .await
                .map_err(|e| AppError::Internal(format!("Failed to upload manifest: {}", e)))?;
        } else {
            // When not encrypted, also upload manifest separately for consistent listing
            let manifest_cloud_path = format!("/backups/{}.manifest.json", backup_id);
            let manifest_json = serde_json::to_string_pretty(&manifest)
                .map_err(|e| AppError::Internal(format!("Failed to serialize manifest: {}", e)))?;
            provider
                .upload_file(
                    &manifest_cloud_path,
                    manifest_json.into_bytes(),
                    None,
                )
                .await
                .map_err(|e| AppError::Internal(format!("Failed to upload manifest: {}", e)))?;
        }

        // 8. Upload backup data to cloud
        let extension = if encrypted { "zip.enc" } else { "zip" };
        let cloud_path = format!("/backups/{}.{}", backup_id, extension);

        provider
            .upload_file(&cloud_path, backup_data, None)
            .await
            .map_err(|e| AppError::Internal(format!("Failed to upload backup: {}", e)))?;

        Ok(BackupInfo {
            id: backup_id,
            created_at: timestamp,
            device_id,
            app_version,
            backup_type,
            size: total_size,
            file_count,
            includes,
            encrypted,
            compressed: true,
        })
    }

    /// Restore from a backup
    pub async fn restore_backup(
        &self,
        provider: &dyn CloudProvider,
        backup_id: &str,
        password: Option<&str>,
    ) -> Result<RestoreResult, AppError> {
        // 1. Download manifest
        let manifest_cloud_path = format!("/backups/{}.manifest.json", backup_id);
        let manifest_data = provider
            .download_file(&manifest_cloud_path, None)
            .await
            .map_err(|e| {
                AppError::Internal(format!("Failed to download manifest: {}", e))
            })?;

        let manifest_json = String::from_utf8(manifest_data)
            .map_err(|e| AppError::Internal(format!("Failed to parse manifest: {}", e)))?;
        let manifest: BackupManifest = serde_json::from_str(&manifest_json)
            .map_err(|e| AppError::Internal(format!("Failed to parse manifest: {}", e)))?;

        // 2. Download backup data
        let extension = if manifest.encryption.enabled {
            "zip.enc"
        } else {
            "zip"
        };
        let data_cloud_path = format!("/backups/{}.{}", backup_id, extension);
        let mut backup_data = provider
            .download_file(&data_cloud_path, None)
            .await
            .map_err(|e| {
                AppError::Internal(format!("Failed to download backup: {}", e))
            })?;

        // 3. Decrypt if encrypted
        if manifest.encryption.enabled {
            let pwd = password.ok_or_else(|| {
                AppError::Internal("Backup is encrypted but no password was provided".to_string())
            })?;

            let salt = base64::engine::general_purpose::STANDARD
                .decode(
                    manifest
                        .encryption
                        .salt
                        .as_deref()
                        .unwrap_or(""),
                )
                .map_err(|e| AppError::Internal(format!("Failed to decode salt: {}", e)))?;

            let nonce = base64::engine::general_purpose::STANDARD
                .decode(
                    manifest
                        .encryption
                        .nonce
                        .as_deref()
                        .unwrap_or(""),
                )
                .map_err(|e| AppError::Internal(format!("Failed to decode nonce: {}", e)))?;

            backup_data =
                decrypt_data(&backup_data, pwd, &salt, &nonce).map_err(|e| {
                    AppError::Internal(format!("Decryption failed: {}", e))
                })?;
        }

        // 4. Write backup data to temp file
        let zip_path = self.temp_dir.join(format!("{}.zip", backup_id));
        fs::write(&zip_path, &backup_data)
            .await
            .map_err(|e| AppError::Internal(format!("Failed to write backup file: {}", e)))?;

        // 5. Extract ZIP
        let extract_dir = self.temp_dir.join(backup_id);
        self.extract_backup(&zip_path, &extract_dir).await?;
        let _ = fs::remove_file(&zip_path).await;

        let mut restored_items = 0;
        let mut conflicts = Vec::new();
        let mut restored_settings: Option<String> = None;

        // 6. Restore database
        if manifest.includes.database {
            let db_backup_path = extract_dir.join("incrementum.db");
            if db_backup_path.exists() {
                self.restore_database(&db_backup_path).await?;
                restored_items += 1;
            }
        }

        // 7. Restore documents
        if manifest.includes.documents {
            let docs_dir = extract_dir.join("documents");
            if docs_dir.exists() {
                let count = self.restore_documents(&docs_dir).await?;
                restored_items += count;
            }
        }

        // 8. Restore settings
        if manifest.includes.settings {
            let settings_path = extract_dir.join("settings.json");
            if settings_path.exists() {
                let settings = fs::read_to_string(&settings_path)
                    .await
                    .map_err(|e| {
                        AppError::Internal(format!("Failed to read settings: {}", e))
                    })?;
                restored_settings = Some(settings);
                restored_items += 1;
            }
        }

        // Clean up extracted files
        let _ = fs::remove_dir_all(&extract_dir).await;

        Ok(RestoreResult {
            success: true,
            restored_items,
            conflicts,
            error: None,
            settings_json: restored_settings,
        })
    }

    /// List available backups
    ///
    /// Reads `.manifest.json` files from the cloud, one per backup.
    pub async fn list_backups(
        &self,
        provider: &dyn CloudProvider,
    ) -> Result<Vec<BackupInfo>, AppError> {
        let files = provider.list_files("/backups").await?;

        let mut backups = Vec::new();

        for file in files {
            if !file.name.ends_with(".manifest.json") {
                continue;
            }

            let manifest_path = format!("/backups/{}", file.name);
            let manifest_data = provider.download_file(&manifest_path, None).await?;

            let manifest_json = String::from_utf8(manifest_data)
                .map_err(|e| AppError::Internal(format!("Failed to parse manifest: {}", e)))?;
            let manifest: BackupManifest = serde_json::from_str(&manifest_json)
                .map_err(|e| AppError::Internal(format!("Failed to parse manifest: {}", e)))?;

            backups.push(BackupInfo {
                id: manifest.id,
                created_at: manifest.created_at,
                device_id: manifest.device_id,
                app_version: manifest.app_version,
                backup_type: manifest.backup_type,
                size: file.size,
                file_count: manifest.files.count,
                includes: manifest.includes,
                encrypted: manifest.encryption.enabled,
                compressed: true,
            });
        }

        Ok(backups)
    }

    /// Delete a backup
    pub async fn delete_backup(
        &self,
        provider: &dyn CloudProvider,
        backup_id: &str,
    ) -> Result<(), AppError> {
        // Delete the manifest
        let manifest_path = format!("/backups/{}.manifest.json", backup_id);
        if let Err(e) = provider.delete_file(&manifest_path).await {
            tracing::warn!("Failed to delete backup manifest: {}", e);
        }

        // Try both encrypted and unencrypted file names
        for ext in &["zip", "zip.enc"] {
            let cloud_path = format!("/backups/{}.{}", backup_id, ext);
            if let Err(e) = provider.delete_file(&cloud_path).await {
                tracing::warn!("Failed to delete backup data ({}): {}", ext, e);
            }
        }

        Ok(())
    }

    // ── Internal helpers ───────────────────────────────────────

    /// Export the database to a file using SQLite VACUUM INTO
    async fn export_database(&self, path: &StdPath) -> Result<(), AppError> {
        let pool = self.db.pool();

        // VACUUM INTO exports a consistent snapshot to a new file
        sqlx::query(&format!("VACUUM INTO '{}'", path.display()))
            .execute(pool)
            .await
            .map_err(|e| AppError::Internal(format!("Failed to export database: {}", e)))?;

        Ok(())
    }

    /// Copy document files to backup directory
    ///
    /// Queries all documents from the database, copies each file to
    /// `dest_dir/{doc_id}/{filename}`, and writes `metadata.json` alongside.
    async fn copy_documents(&self, dest_dir: &StdPath) -> Result<(usize, u64), AppError> {
        let pool = self.db.pool();

        let rows = sqlx::query(
            "SELECT * FROM documents WHERE file_path IS NOT NULL AND file_path != ''",
        )
        .fetch_all(pool)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to query documents: {}", e)))?;

        let mut count = 0;
        let mut total_size: u64 = 0;

        for row in rows {
            // Parse file_type string
            let file_type_str: String = row.get("file_type");
            let file_type = parse_file_type(&file_type_str);

            // Parse tags JSON
            let tags_json: String = row.get("tags");
            let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();

            // Parse metadata JSON
            let metadata_json: Option<String> = row.try_get("metadata").ok();
            let metadata: Option<DocumentMetadata> =
                metadata_json.and_then(|json| serde_json::from_str(&json).ok());

            let doc = Document {
                id: row.get("id"),
                title: row.get("title"),
                file_path: row.get("file_path"),
                file_type,
                content: decode_optional_text(&row, "content"),
                content_hash: row.get("content_hash"),
                total_pages: row.get("total_pages"),
                current_page: row.get("current_page"),
                current_scroll_percent: row.try_get("current_scroll_percent").ok(),
                current_cfi: row.try_get("current_cfi").ok(),
                current_view_state: row.try_get("current_view_state").ok(),
                position_json: row.try_get("position_json").ok(),
                progress_percent: row.try_get("progress_percent").ok(),
                category: row.get("category"),
                tags,
                date_added: row.get("date_added"),
                date_modified: row.get("date_modified"),
                date_last_reviewed: row.get("date_last_reviewed"),
                extract_count: row.get("extract_count"),
                learning_item_count: row.get("learning_item_count"),
                priority_rating: row.get("priority_rating"),
                priority_slider: row.get("priority_slider"),
                priority_score: row.get("priority_score"),
                is_archived: row.get("is_archived"),
                is_favorite: row.get("is_favorite"),
                is_dismissed: row.try_get("is_dismissed").unwrap_or(false),
                metadata,
                cover_image_url: row.try_get("cover_image_url").ok(),
                cover_image_source: row.try_get("cover_image_source").ok(),
                next_reading_date: row.try_get("next_reading_date").ok(),
                reading_count: row.try_get("reading_count").unwrap_or(0),
                stability: row.try_get("stability").ok(),
                difficulty: row.try_get("difficulty").ok(),
                reps: row.try_get("reps").ok(),
                total_time_spent: row.try_get("total_time_spent").ok(),
                consecutive_count: row.try_get("consecutive_count").ok(),
            };

            let src_path = StdPath::new(&doc.file_path);
            if !src_path.exists() {
                tracing::warn!(
                    "Document file not found: {} ({})",
                    doc.file_path,
                    doc.id
                );
                continue;
            }

            let file_name = src_path
                .file_name()
                .map(|n| n.to_os_string())
                .unwrap_or_else(|| OsStr::new("file").to_os_string());

            let doc_dest_dir = dest_dir.join(&doc.id);
            fs::create_dir_all(&doc_dest_dir)
                .await
                .map_err(|e| AppError::Internal(format!("Failed to create dir: {}", e)))?;

            let dest_path = doc_dest_dir.join(&file_name);
            fs::copy(&src_path, &dest_path)
                .await
                .map_err(|e| AppError::Internal(format!("Failed to copy file: {}", e)))?;

            // Write metadata alongside the file
            let metadata_bytes = serde_json::to_vec_pretty(&doc)
                .map_err(|e| AppError::Internal(format!("Failed to serialize metadata: {}", e)))?;
            fs::write(doc_dest_dir.join("metadata.json"), metadata_bytes)
                .await
                .map_err(|e| AppError::Internal(format!("Failed to write metadata: {}", e)))?;

            count += 1;
            total_size += fs::metadata(&dest_path)
                .await
                .map(|m| m.len())
                .unwrap_or(0);
        }

        Ok((count, total_size))
    }

    /// Restore database from backup using SQLite online backup API
    ///
    /// Opens the backup database file read-only, opens the live database
    /// read-write, and uses `rusqlite::backup::Backup` to copy pages
    /// from backup -> live.
    async fn restore_database(&self, backup_db_path: &PathBuf) -> Result<(), AppError> {
        let live_db_path = self.db_path.clone();
        let backup_db_path = backup_db_path.clone();

        tokio::task::spawn_blocking(move || -> Result<(), AppError> {
            let backup_db = rusqlite::Connection::open_with_flags(
                &backup_db_path,
                rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
            )
            .map_err(|e| {
                AppError::Internal(format!("Failed to open backup database: {}", e))
            })?;

            let mut live_db = rusqlite::Connection::open_with_flags(
                &live_db_path,
                rusqlite::OpenFlags::SQLITE_OPEN_READ_WRITE,
            )
            .map_err(|e| {
                AppError::Internal(format!("Failed to open live database: {}", e))
            })?;

            let backup = rusqlite::backup::Backup::new(&backup_db, &mut live_db)
                .map_err(|e| AppError::Internal(format!("Failed to init backup: {}", e)))?;

            // step(-1) copies all remaining pages in one call
            backup
                .step(-1)
                .map_err(|e| AppError::Internal(format!("Backup step failed: {}", e)))?;

            Ok(())
        })
        .await
        .map_err(|e| AppError::Internal(format!("Task join error: {}", e)))?
    }

    /// Restore documents from backup directory
    ///
    /// Reads each document subdirectory, parses its `metadata.json`,
    /// and counts restored documents. Full import logic would insert
    /// records into the database.
    async fn restore_documents(&self, docs_dir: &PathBuf) -> Result<usize, AppError> {
        let mut count = 0;

        let mut entries = fs::read_dir(docs_dir)
            .await
            .map_err(|e| AppError::Internal(format!("Failed to read docs dir: {}", e)))?;

        while let Some(entry) = entries
            .next_entry()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to read entry: {}", e)))?
        {
            let file_type = entry
                .file_type()
                .await
                .map_err(|e| AppError::Internal(format!("Failed to get file type: {}", e)))?;

            if file_type.is_dir() {
                let metadata_path = entry.path().join("metadata.json");

                if metadata_path.exists() {
                    let _metadata_json = fs::read_to_string(&metadata_path)
                        .await
                        .map_err(|e| {
                            AppError::Internal(format!(
                                "Failed to read metadata: {}",
                                e
                            ))
                        })?;

                    // TODO: Insert document record into the database.
                    // For now, just count it as restored.
                    count += 1;
                }
            }
        }

        Ok(count)
    }

    /// Compress backup directory to ZIP using the Rust `zip` crate
    async fn compress_backup(
        &self,
        source_dir: &PathBuf,
        zip_path: &PathBuf,
    ) -> Result<(), AppError> {
        let source_dir = source_dir.clone();
        let zip_path = zip_path.clone();

        tokio::task::spawn_blocking(move || -> Result<(), AppError> {
            let file = std::fs::File::create(&zip_path).map_err(|e| {
                AppError::Internal(format!("Failed to create zip file: {}", e))
            })?;

            let mut zip = ZipWriter::new(file);
            let options = FileOptions::default()
                .compression_method(zip::CompressionMethod::Deflated)
                .unix_permissions(0o644);

            let mut buffer = Vec::new();

            for entry in WalkDir::new(&source_dir).min_depth(1) {
                let entry =
                    entry.map_err(|e| AppError::Internal(format!("Walk error: {}", e)))?;
                let path = entry.path();
                let name = path
                    .strip_prefix(&source_dir)
                    .map_err(|e| AppError::Internal(format!("Strip prefix error: {}", e)))?;

                if path.is_dir() {
                    zip.add_directory(name.to_string_lossy(), options)
                        .map_err(|e| {
                            AppError::Internal(format!("Failed to add dir to zip: {}", e))
                        })?;
                } else {
                    zip.start_file(name.to_string_lossy(), options)
                        .map_err(|e| {
                            AppError::Internal(format!(
                                "Failed to start file in zip: {}",
                                e
                            ))
                        })?;

                    let mut f = std::fs::File::open(path).map_err(|e| {
                        AppError::Internal(format!("Failed to open file: {}", e))
                    })?;
                    buffer.clear();
                    std::io::copy(&mut f, &mut buffer).map_err(|e| {
                        AppError::Internal(format!("Failed to read file: {}", e))
                    })?;

                    zip.write_all(&buffer).map_err(|e| {
                        AppError::Internal(format!("Failed to write to zip: {}", e))
                    })?;
                }
            }

            zip.finish()
                .map_err(|e| AppError::Internal(format!("Failed to finish zip: {}", e)))?;

            Ok(())
        })
        .await
        .map_err(|e| AppError::Internal(format!("Task join error: {}", e)))?
    }

    /// Extract ZIP backup using the Rust `zip` crate
    async fn extract_backup(
        &self,
        zip_path: &PathBuf,
        dest_dir: &PathBuf,
    ) -> Result<(), AppError> {
        fs::create_dir_all(dest_dir)
            .await
            .map_err(|e| AppError::Internal(format!("Failed to create dest dir: {}", e)))?;

        let zip_path = zip_path.clone();
        let dest_dir = dest_dir.clone();

        tokio::task::spawn_blocking(move || -> Result<(), AppError> {
            let file = std::fs::File::open(&zip_path).map_err(|e| {
                AppError::Internal(format!("Failed to open zip: {}", e))
            })?;
            let mut archive = zip::ZipArchive::new(file).map_err(|e| {
                AppError::Internal(format!("Failed to read zip archive: {}", e))
            })?;

            for i in 0..archive.len() {
                let mut entry = archive
                    .by_index(i)
                    .map_err(|e| AppError::Internal(format!("Failed to read entry {}: {}", i, e)))?;

                let outpath = match entry.enclosed_name() {
                    Some(path) => dest_dir.join(path),
                    None => continue,
                };

                if entry.is_dir() {
                    std::fs::create_dir_all(&outpath).map_err(|e| {
                        AppError::Internal(format!("Failed to create dir: {}", e))
                    })?;
                } else {
                    if let Some(parent) = outpath.parent() {
                        std::fs::create_dir_all(parent).map_err(|e| {
                            AppError::Internal(format!("Failed to create dir: {}", e))
                        })?;
                    }
                    let mut outfile =
                        std::fs::File::create(&outpath).map_err(|e| {
                            AppError::Internal(format!("Failed to create file: {}", e))
                        })?;
                    std::io::copy(&mut entry, &mut outfile).map_err(|e| {
                        AppError::Internal(format!("Failed to write file: {}", e))
                    })?;
                }
            }

            Ok(())
        })
        .await
        .map_err(|e| AppError::Internal(format!("Task join error: {}", e)))?
    }

    /// Get device ID
    fn get_device_id(&self) -> String {
        format!(
            "{}-{}",
            hostname::get()
                .unwrap_or_else(|_| OsStr::new("unknown").to_os_string())
                .to_string_lossy(),
            std::process::id()
        )
    }
}

// ── Encryption helpers ────────────────────────────────────────

/// Encrypt data with AES-256-GCM using a password-derived key.
///
/// Uses PBKDF2-HMAC-SHA256 with 100 000 iterations and a random 16-byte
/// salt to derive a 256-bit key. Returns the ciphertext and 12-byte nonce.
/// The derived key is zeroed from memory after use.
fn encrypt_data(
    data: &[u8],
    password: &str,
    salt: &[u8],
) -> Result<(Vec<u8>, [u8; 12]), AppError> {
    let mut key = [0u8; 32];
    pbkdf2_hmac::<Sha256>(password.as_bytes(), salt, 100_000, &mut key);

    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| AppError::Internal(format!("Failed to create cipher: {}", e)))?;

    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let nonce_bytes: [u8; 12] = nonce.into();

    let ciphertext = cipher
        .encrypt(&nonce, data)
        .map_err(|e| AppError::Internal(format!("Encryption failed: {}", e)))?;

    // Zero the derived key from memory
    for b in key.iter_mut() {
        *b = 0;
    }

    Ok((ciphertext, nonce_bytes))
}

/// Decrypt data with AES-256-GCM using a password-derived key.
///
/// The salt and nonce must match those used during encryption.
/// Returns an error if the password is wrong or data is corrupted.
/// The derived key is zeroed from memory after use.
fn decrypt_data(
    data: &[u8],
    password: &str,
    salt: &[u8],
    nonce: &[u8],
) -> Result<Vec<u8>, AppError> {
    let mut key = [0u8; 32];
    pbkdf2_hmac::<Sha256>(password.as_bytes(), salt, 100_000, &mut key);

    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| AppError::Internal(format!("Failed to create cipher: {}", e)))?;

    let nonce = Nonce::from_slice(nonce);
    let plaintext = cipher.decrypt(nonce, data).map_err(|_| {
        AppError::Internal(
            "Decryption failed: incorrect password or corrupted data".to_string(),
        )
    })?;

    // Zero the derived key from memory
    for b in key.iter_mut() {
        *b = 0;
    }

    Ok(plaintext)
}

// ── Row-parsing helpers (mirrors Repository implementation) ───

/// Decode an optional text column that may be stored as TEXT or BLOB.
fn decode_optional_text(row: &sqlx::sqlite::SqliteRow, column: &str) -> Option<String> {
    match row.try_get::<Option<String>, _>(column) {
        Ok(value) => value,
        Err(_) => match row.try_get::<Option<Vec<u8>>, _>(column) {
            Ok(Some(bytes)) => Some(String::from_utf8_lossy(&bytes).into_owned()),
            Ok(None) => None,
            Err(_) => None,
        },
    }
}

/// Parse a file type string from the database into a FileType enum.
fn parse_file_type(s: &str) -> FileType {
    match s {
        "pdf" => FileType::Pdf,
        "epub" => FileType::Epub,
        "markdown" => FileType::Markdown,
        "html" => FileType::Html,
        "youtube" => FileType::Youtube,
        "audio" => FileType::Audio,
        "video" => FileType::Video,
        _ => FileType::Other,
    }
}

// ============ Backup Manifest Types ============

#[derive(Debug, Serialize, Deserialize)]
struct BackupManifest {
    id: String,
    version: String,
    created_at: DateTime<Utc>,
    device_id: String,
    app_version: String,
    backup_type: String,
    includes: BackupIncludes,
    files: BackupFiles,
    encryption: BackupEncryption,
}

#[derive(Debug, Serialize, Deserialize)]
struct BackupFiles {
    database: Option<String>,
    documents: Option<String>,
    count: usize,
    total_size: u64,
}

#[derive(Debug, Serialize, Deserialize)]
struct BackupEncryption {
    enabled: bool,
    algorithm: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    salt: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    nonce: Option<String>,
}
