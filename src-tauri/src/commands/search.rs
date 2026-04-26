//! Full-text search commands using FTS5

use serde::{Deserialize, Serialize};
use crate::database::Repository;
use tauri::State;

/// Search result from FTS5
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FtsSearchResult {
    pub id: String,
    pub result_type: String,
    pub title: Option<String>,
    pub excerpt: Option<String>,
    pub score: f64,
    pub document_id: Option<String>,
    pub file_type: Option<String>,
}

/// Search query options
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FtsSearchQuery {
    pub query: String,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
    pub result_types: Option<Vec<String>>,
}

/// Search statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FtsSearchStats {
    pub total_documents: u32,
    pub total_extracts: u32,
}

#[tauri::command]
pub async fn fts_search(query: FtsSearchQuery, repo: State<'_, Repository>) -> Result<Vec<FtsSearchResult>, String> {
    let limit = query.limit.unwrap_or(50).min(200);
    let offset = query.offset.unwrap_or(0);
    let fts_query = format!("{}*", query.query);
    let types = query.result_types.unwrap_or_else(|| vec!["document".into(), "extract".into()]);

    let mut results = Vec::new();

    if types.contains(&"document".to_string()) {
        let rows = sqlx::query_as::<_, (String, String, Option<String>, String, f64)>(
            "SELECT ds.document_id, d.title, snippet(document_search, 2, '<mark>', '</mark>', '...', 32), d.file_type, rank \
             FROM document_search ds \
             INNER JOIN documents d ON ds.document_id = d.id \
             WHERE document_search MATCH ? \
             ORDER BY rank LIMIT ? OFFSET ?"
        )
        .bind(&fts_query)
        .bind(limit as i64)
        .bind(offset as i64)
        .fetch_all(repo.pool())
        .await
        .map_err(|e| format!("Document search failed: {}", e))?;

        for (id, title, excerpt, file_type, rank) in rows {
            results.push(FtsSearchResult {
                id: id.clone(),
                result_type: "document".to_string(),
                title: Some(title),
                excerpt,
                score: rank,
                document_id: Some(id),
                file_type: Some(file_type),
            });
        }
    }

    if types.contains(&"extract".to_string()) {
        let rows = sqlx::query_as::<_, (String, String, String, f64)>(
            "SELECT es.extract_id, es.document_id, snippet(extract_search, 0, '<mark>', '</mark>', '...', 32), rank \
             FROM extract_search es \
             WHERE extract_search MATCH ? \
             ORDER BY rank LIMIT ? OFFSET ?"
        )
        .bind(&fts_query)
        .bind(limit as i64)
        .bind(offset as i64)
        .fetch_all(repo.pool())
        .await
        .map_err(|e| format!("Extract search failed: {}", e))?;

        for (id, doc_id, excerpt, rank) in rows {
            results.push(FtsSearchResult {
                id: id.clone(),
                result_type: "extract".to_string(),
                title: None,
                excerpt: Some(excerpt),
                score: rank,
                document_id: Some(doc_id),
                file_type: None,
            });
        }
    }

    results.sort_by(|a, b| a.score.partial_cmp(&b.score).unwrap_or(std::cmp::Ordering::Equal));
    results.truncate(limit as usize);
    Ok(results)
}

#[tauri::command]
pub async fn fts_search_suggestions(query: String, repo: State<'_, Repository>) -> Result<Vec<String>, String> {
    if query.len() < 2 {
        return Ok(vec![]);
    }
    let fts_query = format!("{}*", query);

    let rows = sqlx::query_as::<_, (String,)>(
        "SELECT d.title FROM document_search ds \
         INNER JOIN documents d ON ds.document_id = d.id \
         WHERE document_search MATCH ? \
         ORDER BY rank LIMIT 8"
    )
    .bind(&fts_query)
    .fetch_all(repo.pool())
    .await
    .map_err(|e| format!("Suggestions failed: {}", e))?;

    Ok(rows.into_iter().map(|(t,)| t).collect())
}

#[tauri::command]
pub async fn fts_get_stats(repo: State<'_, Repository>) -> Result<FtsSearchStats, String> {
    let doc_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM document_search")
        .fetch_one(repo.pool())
        .await
        .map_err(|e| format!("Stats failed: {}", e))?;

    let extract_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM extract_search")
        .fetch_one(repo.pool())
        .await
        .map_err(|e| format!("Stats failed: {}", e))?;

    Ok(FtsSearchStats {
        total_documents: doc_count.0 as u32,
        total_extracts: extract_count.0 as u32,
    })
}

#[tauri::command]
pub async fn fts_reindex(repo: State<'_, Repository>) -> Result<(), String> {
    sqlx::query("DELETE FROM document_search")
        .execute(repo.pool())
        .await
        .map_err(|e| format!("Reindex failed: {}", e))?;

    sqlx::query("INSERT INTO document_search(document_id, title, content, content_type) SELECT id, title, COALESCE(content, ''), file_type FROM documents")
        .execute(repo.pool())
        .await
        .map_err(|e| format!("Reindex failed: {}", e))?;

    sqlx::query("DELETE FROM extract_search")
        .execute(repo.pool())
        .await
        .map_err(|e| format!("Reindex failed: {}", e))?;

    sqlx::query("INSERT INTO extract_search(extract_id, document_id, content) SELECT id, document_id, COALESCE(content, '') FROM extracts")
        .execute(repo.pool())
        .await
        .map_err(|e| format!("Reindex failed: {}", e))?;

    Ok(())
}
