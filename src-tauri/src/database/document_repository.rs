//! Document repository - handles all document-related database operations

use crate::error::Result;
use crate::models::{Document, DocumentMetadata, FileType};
use chrono::Utc;
use sqlx::{sqlite::SqliteRow, Pool, Row, Sqlite};

/// Repository for document-related database operations
#[derive(Clone)]
pub struct DocumentRepository {
    pool: Pool<Sqlite>,
}

impl DocumentRepository {
    pub fn new(pool: Pool<Sqlite>) -> Self {
        Self { pool }
    }

    /// Get the database pool for advanced queries
    pub fn pool(&self) -> &Pool<Sqlite> {
        &self.pool
    }

    // Helper to parse file type from string
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

    /// Helper to decode possibly-corrupt UTF-8 text columns without panicking.
    fn decode_optional_text(row: &SqliteRow, column: &str) -> Option<String> {
        match row.try_get::<Option<String>, _>(column) {
            Ok(value) => value,
            Err(_) => match row.try_get::<Option<Vec<u8>>, _>(column) {
                Ok(Some(bytes)) => Some(String::from_utf8_lossy(&bytes).into_owned()),
                Ok(None) => None,
                Err(_) => None,
            },
        }
    }

    /// Create a new document in the database
    pub async fn create_document(&self, document: &Document) -> Result<Document> {
        let file_type_str = format!("{:?}", document.file_type).to_lowercase();
        let tags_json = serde_json::to_string(&document.tags)?;
        let metadata_json = document
            .metadata
            .as_ref()
            .map(serde_json::to_string)
            .transpose()?;

        sqlx::query(
            r#"
            INSERT INTO documents (
                id, title, file_path, file_type, content, content_hash,
                total_pages, current_page, current_scroll_percent, current_cfi, current_view_state, category, tags,
                date_added, date_modified, date_last_reviewed,
                extract_count, learning_item_count, priority_rating, priority_slider, priority_score,
                is_archived, is_favorite, is_dismissed, metadata, cover_image_url, cover_image_source
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27)
            "#,
        )
        .bind(&document.id)
        .bind(&document.title)
        .bind(&document.file_path)
        .bind(&file_type_str)
        .bind(&document.content)
        .bind(&document.content_hash)
        .bind(document.total_pages)
        .bind(document.current_page)
        .bind(document.current_scroll_percent)
        .bind(&document.current_cfi)
        .bind(&document.current_view_state)
        .bind(&document.category)
        .bind(&tags_json)
        .bind(document.date_added)
        .bind(document.date_modified)
        .bind(document.date_last_reviewed)
        .bind(document.extract_count)
        .bind(document.learning_item_count)
        .bind(document.priority_rating)
        .bind(document.priority_slider)
        .bind(document.priority_score)
        .bind(document.is_archived)
        .bind(document.is_favorite)
        .bind(document.is_dismissed)
        .bind(metadata_json)
        .bind(&document.cover_image_url)
        .bind(&document.cover_image_source)
        .execute(&self.pool)
        .await?;

        Ok(document.clone())
    }

    /// Insert a document received from another device via sync, or replace the
    /// existing row if one with the same id is present (conflict resolution by
    /// `date_modified` happens on the caller side — the TS replication layer
    /// only calls this for rows newer than what's local). This is the write
    /// path that makes a synced document row appear in the receiving device's
    /// library (queried via `get_documents`), closing the loop between the yjs
    /// 'documents' map and per-device SQLite.
    ///
    /// Unlike `create_document`, this never generates a new id — it trusts the
    /// incoming id (documents share identity across devices so the file manifest
    /// `fileId` linkage and reading positions line up).
    pub async fn upsert_synced_document(&self, document: &Document) -> Result<Document> {
        let file_type_str = format!("{:?}", document.file_type).to_lowercase();
        let tags_json = serde_json::to_string(&document.tags)?;
        let metadata_json = document
            .metadata
            .as_ref()
            .map(serde_json::to_string)
            .transpose()?;

        sqlx::query(
            r#"
            INSERT OR REPLACE INTO documents (
                id, title, file_path, file_type, content, content_hash,
                total_pages, current_page, current_scroll_percent, current_cfi, current_view_state, category, tags,
                date_added, date_modified, date_last_reviewed,
                extract_count, learning_item_count, priority_rating, priority_slider, priority_score,
                is_archived, is_favorite, is_dismissed, metadata, cover_image_url, cover_image_source
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27)
            "#,
        )
        .bind(&document.id)
        .bind(&document.title)
        .bind(&document.file_path)
        .bind(&file_type_str)
        .bind(&document.content)
        .bind(&document.content_hash)
        .bind(document.total_pages)
        .bind(document.current_page)
        .bind(document.current_scroll_percent)
        .bind(&document.current_cfi)
        .bind(&document.current_view_state)
        .bind(&document.category)
        .bind(tags_json)
        .bind(document.date_added)
        .bind(document.date_modified)
        .bind(document.date_last_reviewed)
        .bind(document.extract_count)
        .bind(document.learning_item_count)
        .bind(document.priority_rating)
        .bind(document.priority_slider)
        .bind(document.priority_score)
        .bind(document.is_archived)
        .bind(document.is_favorite)
        .bind(document.is_dismissed)
        .bind(metadata_json)
        .bind(&document.cover_image_url)
        .bind(&document.cover_image_source)
        .execute(&self.pool)
        .await?;

        Ok(document.clone())
    }

    /// Get a document by ID
    pub async fn get_document(&self, id: &str) -> Result<Option<Document>> {
        let row = sqlx::query("SELECT * FROM documents WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await?;

        match row {
            Some(row) => {
                let file_type: String = row.get("file_type");
                let tags_json: String = row.get("tags");
                let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();

                let metadata_json: Option<String> = row.try_get("metadata")?;
                let metadata: Option<crate::models::DocumentMetadata> =
                    metadata_json.and_then(|json| serde_json::from_str(&json).ok());

                Ok(Some(Document {
                    id: row.get("id"),
                    title: row.get("title"),
                    file_path: row.get("file_path"),
                    file_type: Self::parse_file_type(&file_type),
                    content: Self::decode_optional_text(&row, "content"),
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
                    // Scheduling fields - use try_get for compatibility with existing databases
                    next_reading_date: row.try_get("next_reading_date").ok(),
                    reading_count: row.try_get("reading_count").unwrap_or(0),
                    stability: row.try_get("stability").ok(),
                    difficulty: row.try_get("difficulty").ok(),
                    reps: row.try_get("reps").ok(),
                    total_time_spent: row.try_get("total_time_spent").ok(),
                    consecutive_count: row.try_get("consecutive_count").ok(),
                }))
            }
            None => Ok(None),
        }
    }

    /// Find a document by its URL/file_path
    pub async fn find_document_by_url(&self, url: &str) -> Result<Option<Document>> {
        let row = sqlx::query("SELECT * FROM documents WHERE file_path = ? LIMIT 1")
            .bind(url)
            .fetch_optional(&self.pool)
            .await?;

        match row {
            Some(row) => {
                let file_type: String = row.get("file_type");
                let tags_json: String = row.get("tags");
                let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();

                let metadata_json: Option<String> = row.try_get("metadata")?;
                let metadata: Option<crate::models::DocumentMetadata> =
                    metadata_json.and_then(|json| serde_json::from_str(&json).ok());

                Ok(Some(Document {
                    id: row.get("id"),
                    title: row.get("title"),
                    file_path: row.get("file_path"),
                    file_type: Self::parse_file_type(&file_type),
                    content: Self::decode_optional_text(&row, "content"),
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
                    // Scheduling fields
                    next_reading_date: row.try_get("next_reading_date").ok(),
                    reading_count: row.try_get("reading_count").unwrap_or(0),
                    stability: row.try_get("stability").ok(),
                    difficulty: row.try_get("difficulty").ok(),
                    reps: row.try_get("reps").ok(),
                    total_time_spent: row.try_get("total_time_spent").ok(),
                    consecutive_count: row.try_get("consecutive_count").ok(),
                }))
            }
            None => Ok(None),
        }
    }

    /// List all documents (excludes large TEXT columns)
    pub async fn list_documents(&self) -> Result<Vec<Document>> {
        // Exclude large TEXT columns (content, html_content) from list queries
        let rows = sqlx::query(
            r#"SELECT id, title, file_path, file_type, content_hash,
                      total_pages, current_page, current_scroll_percent, current_cfi,
                      current_view_state, position_json, progress_percent,
                      category, tags, date_added, date_modified, date_last_reviewed,
                      extract_count, learning_item_count, priority_rating, priority_slider,
                      priority_score, is_archived, is_favorite, is_dismissed,
                      metadata, cover_image_url, cover_image_source,
                      next_reading_date, reading_count, stability, difficulty,
                      reps, total_time_spent, consecutive_count
               FROM documents ORDER BY date_added DESC"#,
        )
            .fetch_all(&self.pool)
            .await?;

        let mut docs = Vec::new();
        for row in rows {
            let file_type: String = row.get("file_type");
            let tags_json: String = row.get("tags");
            let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();

            let metadata_json: Option<String> = row.try_get("metadata")?;
            let metadata: Option<crate::models::DocumentMetadata> =
                metadata_json.and_then(|json| serde_json::from_str(&json).ok());

            docs.push(Document {
                id: row.get("id"),
                title: row.get("title"),
                file_path: row.get("file_path"),
                file_type: Self::parse_file_type(&file_type),
                content: None,
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
                // Scheduling fields
                next_reading_date: row.try_get("next_reading_date").ok(),
                reading_count: row.try_get("reading_count").unwrap_or(0),
                stability: row.try_get("stability").ok(),
                difficulty: row.try_get("difficulty").ok(),
                reps: row.try_get("reps").ok(),
                total_time_spent: row.try_get("total_time_spent").ok(),
                consecutive_count: row.try_get("consecutive_count").ok(),
            });
        }

        Ok(docs)
    }

    /// Lightweight list for queue building - only essential columns
    pub async fn list_documents_summary(&self) -> Result<Vec<Document>> {
        let rows = sqlx::query(
            r#"SELECT id, title, file_path, file_type,
                      total_pages, current_page,
                      category, tags, date_added,
                      priority_rating, priority_slider, priority_score,
                      is_archived, is_favorite,
                      next_reading_date, stability, difficulty
               FROM documents ORDER BY date_added DESC"#,
        )
            .fetch_all(&self.pool)
            .await?;

        let mut docs = Vec::new();
        for row in rows {
            let file_type: String = row.get("file_type");
            let tags_json: String = row.get("tags");
            let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();

            docs.push(Document {
                id: row.get("id"),
                title: row.get("title"),
                file_path: row.get("file_path"),
                file_type: Self::parse_file_type(&file_type),
                content: None,
                content_hash: None,
                total_pages: row.get("total_pages"),
                current_page: row.get("current_page"),
                current_scroll_percent: None,
                current_cfi: None,
                current_view_state: None,
                position_json: None,
                progress_percent: None,
                category: row.get("category"),
                tags,
                date_added: row.get("date_added"),
                date_modified: row.try_get("date_modified").unwrap_or_else(|_| Utc::now()),
                date_last_reviewed: None,
                extract_count: 0,
                learning_item_count: 0,
                priority_rating: row.get("priority_rating"),
                priority_slider: row.get("priority_slider"),
                priority_score: row.get("priority_score"),
                is_archived: row.get("is_archived"),
                is_favorite: row.get("is_favorite"),
                is_dismissed: false,
                metadata: None,
                cover_image_url: None,
                cover_image_source: None,
                next_reading_date: row.try_get("next_reading_date").ok(),
                reading_count: 0,
                stability: row.try_get("stability").ok(),
                difficulty: row.try_get("difficulty").ok(),
                reps: None,
                total_time_spent: None,
                consecutive_count: None,
            });
        }

        Ok(docs)
    }

    /// Fetch only the content and html_content columns for a single document
    pub async fn get_document_content(&self, id: &str) -> Result<(Option<String>, Option<String>)> {
        let row = sqlx::query(
            r#"SELECT content, html_content FROM documents WHERE id = ?1"#,
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?;

        match row {
            Some(r) => {
                let content = Self::decode_optional_text(&r, "content");
                let html_content: Option<String> = r.try_get("html_content").ok();
                Ok((content, html_content))
            }
            None => Err(crate::error::IncrementumError::NotFound(format!("Document {}", id))),
        }
    }

    /// Update a document's basic fields
    pub async fn update_document(&self, id: &str, updates: &Document) -> Result<Document> {
        let tags_json = serde_json::to_string(&updates.tags)?;

        sqlx::query(
            r#"
            UPDATE documents SET
                title = ?1, file_path = ?2, current_page = ?3, category = ?4,
                tags = ?5, date_modified = ?6, priority_rating = ?7,
                priority_slider = ?8, priority_score = ?9,
                is_archived = ?10, is_favorite = ?11, total_pages = ?12
            WHERE id = ?13
            "#,
        )
        .bind(&updates.title)
        .bind(&updates.file_path)
        .bind(updates.current_page)
        .bind(&updates.category)
        .bind(&tags_json)
        .bind(updates.date_modified)
        .bind(updates.priority_rating)
        .bind(updates.priority_slider)
        .bind(updates.priority_score)
        .bind(updates.is_archived)
        .bind(updates.is_favorite)
        .bind(updates.total_pages)
        .bind(id)
        .execute(&self.pool)
        .await?;

        self.get_document(id)
            .await?
            .ok_or_else(|| crate::error::IncrementumError::NotFound(format!("Document {}", id)))
    }

    /// Update document cover image
    pub async fn update_document_cover(
        &self,
        id: &str,
        cover_image_url: Option<String>,
        cover_image_source: Option<String>,
    ) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE documents SET
                cover_image_url = ?1,
                cover_image_source = ?2,
                date_modified = ?3
            WHERE id = ?4
            "#,
        )
        .bind(cover_image_url)
        .bind(cover_image_source)
        .bind(Utc::now())
        .bind(id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Update document content and metadata
    pub async fn update_document_content(
        &self,
        id: &str,
        content: &str,
        content_hash: Option<String>,
        total_pages: Option<i32>,
        metadata: Option<DocumentMetadata>,
    ) -> Result<()> {
        let metadata_json = metadata.as_ref().map(serde_json::to_string).transpose()?;

        sqlx::query(
            r#"
            UPDATE documents SET
                content = ?1,
                content_hash = COALESCE(?2, content_hash),
                total_pages = COALESCE(?3, total_pages),
                metadata = COALESCE(?4, metadata),
                date_modified = ?5
            WHERE id = ?6
            "#,
        )
        .bind(content)
        .bind(content_hash)
        .bind(total_pages)
        .bind(metadata_json)
        .bind(Utc::now())
        .bind(id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Update document priority fields
    pub async fn update_document_priority(
        &self,
        id: &str,
        priority_rating: i32,
        priority_slider: i32,
        priority_score: f64,
    ) -> Result<Document> {
        let now = Utc::now();

        // Capture the previous score so we can cascade to inheriting extracts.
        let previous_score: f64 = self
            .get_document(id)
            .await?
            .map(|d| d.priority_score)
            .unwrap_or(0.0);

        sqlx::query(
            r#"
            UPDATE documents SET
                priority_rating = ?1,
                priority_slider = ?2,
                priority_score = ?3,
                date_modified = ?4
            WHERE id = ?5
            "#,
        )
        .bind(priority_rating)
        .bind(priority_slider)
        .bind(priority_score)
        .bind(now)
        .bind(id)
        .execute(&self.pool)
        .await?;

        // Cascade: propagate the new score to child extracts that still carry
        // the document's previous score. Manually-overridden extracts (whose
        // score differs from the previous document score) are left untouched.
        if (previous_score - priority_score).abs() > 0.001 {
            sqlx::query(
                r#"
                UPDATE extracts SET
                    priority_score = ?1,
                    date_modified = ?2
                WHERE document_id = ?3 AND ABS(priority_score - ?4) < 0.001
                "#,
            )
            .bind(priority_score.clamp(0.0, 100.0))
            .bind(now)
            .bind(id)
            .bind(previous_score)
            .execute(&self.pool)
            .await?;
        }

        self.get_document(id)
            .await?
            .ok_or_else(|| crate::error::IncrementumError::NotFound(format!("Document {}", id)))
    }

    /// Update document dismissed status
    pub async fn update_document_dismiss(&self, id: &str, is_dismissed: bool) -> Result<Document> {
        let now = Utc::now();

        sqlx::query(
            r#"
            UPDATE documents SET
                is_dismissed = ?1,
                date_modified = ?2
            WHERE id = ?3
            "#,
        )
        .bind(is_dismissed)
        .bind(now)
        .bind(id)
        .execute(&self.pool)
        .await?;

        self.get_document(id)
            .await?
            .ok_or_else(|| crate::error::IncrementumError::NotFound(format!("Document {}", id)))
    }

    /// Update document reading progress
    pub async fn update_document_progress(
        &self,
        id: &str,
        current_page: Option<i32>,
        current_scroll_percent: Option<f64>,
        current_cfi: Option<String>,
        current_view_state: Option<String>,
    ) -> Result<Document> {
        let now = Utc::now();

        sqlx::query(
            r#"
            UPDATE documents SET
                current_page = COALESCE(?1, current_page),
                current_scroll_percent = COALESCE(?2, current_scroll_percent),
                current_cfi = COALESCE(?3, current_cfi),
                current_view_state = COALESCE(?4, current_view_state),
                date_modified = ?5
            WHERE id = ?6
            "#,
        )
        .bind(current_page)
        .bind(current_scroll_percent)
        .bind(current_cfi)
        .bind(current_view_state)
        .bind(now)
        .bind(id)
        .execute(&self.pool)
        .await?;

        self.get_document(id)
            .await?
            .ok_or_else(|| crate::error::IncrementumError::NotFound(format!("Document {}", id)))
    }

    /// Update document scheduling fields
    pub async fn update_document_scheduling(
        &self,
        id: &str,
        next_reading_date: Option<chrono::DateTime<Utc>>,
        stability: Option<f64>,
        difficulty: Option<f64>,
        reps: Option<i32>,
        total_time_spent: Option<i32>,
    ) -> Result<()> {
        let now = Utc::now();
        sqlx::query(
            r#"
            UPDATE documents SET
                next_reading_date = ?1,
                stability = ?2,
                difficulty = ?3,
                reps = ?4,
                total_time_spent = ?5,
                date_last_reviewed = ?6,
                date_modified = ?7
            WHERE id = ?8
            "#,
        )
        .bind(next_reading_date)
        .bind(stability)
        .bind(difficulty)
        .bind(reps)
        .bind(total_time_spent)
        .bind(now)
        .bind(now)
        .bind(id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Update document scheduling with consecutive count
    #[allow(clippy::too_many_arguments)]
    pub async fn update_document_scheduling_with_consecutive(
        &self,
        id: &str,
        next_reading_date: Option<chrono::DateTime<Utc>>,
        stability: Option<f64>,
        difficulty: Option<f64>,
        reps: Option<i32>,
        total_time_spent: Option<i32>,
        consecutive_count: Option<i32>,
    ) -> Result<()> {
        let now = Utc::now();
        sqlx::query(
            r#"
            UPDATE documents SET
                next_reading_date = ?1,
                stability = ?2,
                difficulty = ?3,
                reps = ?4,
                total_time_spent = ?5,
                consecutive_count = ?6,
                date_last_reviewed = ?7,
                date_modified = ?8
            WHERE id = ?9
            "#,
        )
        .bind(next_reading_date)
        .bind(stability)
        .bind(difficulty)
        .bind(reps)
        .bind(total_time_spent)
        .bind(consecutive_count)
        .bind(now)
        .bind(now)
        .bind(id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Restore document scheduling from backup data
    #[allow(clippy::too_many_arguments)]
    pub async fn restore_document_scheduling(
        &self,
        id: &str,
        next_reading_date: Option<chrono::DateTime<Utc>>,
        stability: Option<f64>,
        difficulty: Option<f64>,
        reps: Option<i32>,
        total_time_spent: Option<i32>,
        consecutive_count: Option<i32>,
        date_last_reviewed: Option<chrono::DateTime<Utc>>,
    ) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE documents SET
                next_reading_date = ?1,
                stability = ?2,
                difficulty = ?3,
                reps = ?4,
                total_time_spent = ?5,
                consecutive_count = ?6,
                date_last_reviewed = ?7,
                date_modified = ?8
            WHERE id = ?9
            "#,
        )
        .bind(next_reading_date)
        .bind(stability)
        .bind(difficulty)
        .bind(reps)
        .bind(total_time_spent)
        .bind(consecutive_count)
        .bind(date_last_reviewed)
        .bind(Utc::now())
        .bind(id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Delete a document by ID
    pub async fn delete_document(&self, id: &str) -> Result<()> {
        sqlx::query("DELETE FROM documents WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    /// Get all document id/title pairs as a HashMap (for batch lookups)
    pub async fn get_document_title_map(&self) -> Result<std::collections::HashMap<String, String>> {
        let rows = sqlx::query("SELECT id, title FROM documents")
            .fetch_all(&self.pool)
            .await?;

        let mut map = std::collections::HashMap::new();
        for row in rows {
            let id: String = row.try_get("id")?;
            let title: String = row.try_get("title")?;
            map.insert(id, title);
        }

        Ok(map)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::connection::Database;
    use std::path::PathBuf;

    async fn setup_repo() -> DocumentRepository {
        let db = Database::new(PathBuf::from(":memory:")).await.expect("db");
        db.migrate().await.expect("migrate");
        DocumentRepository::new(db.pool().clone())
    }

    #[tokio::test]
    async fn test_create_and_get_document() {
        let repo = setup_repo().await;

        let doc = Document::new(
            "Test Document".to_string(),
            "/path/to/file.pdf".to_string(),
            FileType::Pdf,
        );

        let created = repo.create_document(&doc).await.expect("create");
        assert_eq!(created.title, doc.title);

        let fetched = repo.get_document(&doc.id).await.expect("get");
        assert!(fetched.is_some());
        assert_eq!(fetched.unwrap().title, doc.title);
    }

    #[tokio::test]
    async fn test_list_documents() {
        let repo = setup_repo().await;

        let doc1 = Document::new("Doc 1".to_string(), "/path/1.pdf".to_string(), FileType::Pdf);
        let doc2 = Document::new("Doc 2".to_string(), "/path/2.pdf".to_string(), FileType::Epub);

        repo.create_document(&doc1).await.expect("create 1");
        repo.create_document(&doc2).await.expect("create 2");

        let docs = repo.list_documents().await.expect("list");
        assert_eq!(docs.len(), 2);
    }

    #[tokio::test]
    async fn test_find_document_by_url() {
        let repo = setup_repo().await;

        let doc = Document::new(
            "Test".to_string(),
            "/unique/path.pdf".to_string(),
            FileType::Pdf,
        );

        repo.create_document(&doc).await.expect("create");

        let found = repo
            .find_document_by_url("/unique/path.pdf")
            .await
            .expect("find");
        assert!(found.is_some());
        assert_eq!(found.unwrap().id, doc.id);
    }

    #[tokio::test]
    async fn test_update_document_progress() {
        let repo = setup_repo().await;

        let doc = Document::new("Test".to_string(), "/path.pdf".to_string(), FileType::Pdf);
        repo.create_document(&doc).await.expect("create");

        let updated = repo
            .update_document_progress(&doc.id, Some(5), Some(0.5), None, None)
            .await
            .expect("update");

        assert_eq!(updated.current_page, Some(5));
        assert_eq!(updated.current_scroll_percent, Some(0.5));
    }

    #[tokio::test]
    async fn test_delete_document() {
        let repo = setup_repo().await;

        let doc = Document::new("Test".to_string(), "/path.pdf".to_string(), FileType::Pdf);
        repo.create_document(&doc).await.expect("create");

        repo.delete_document(&doc.id).await.expect("delete");

        let fetched = repo.get_document(&doc.id).await.expect("get");
        assert!(fetched.is_none());
    }
}
