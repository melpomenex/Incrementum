//! Retry logic with exponential backoff for network operations
//!
//! This module provides retry functionality for cloud provider operations
//! to handle transient failures like network hiccups, rate limiting (429),
//! and server errors (5xx).

use std::time::Duration;
use tokio::time::sleep;

use crate::error::AppError;

/// Configuration for retry behavior
#[derive(Debug, Clone, Copy)]
pub struct RetryConfig {
    /// Maximum number of retry attempts (1 = original attempt only)
    pub max_attempts: u32,
    /// Base delay in milliseconds for exponential backoff
    pub base_delay_ms: u64,
    /// Maximum delay in milliseconds between retries
    pub max_delay_ms: u64,
    /// Whether to add jitter to delay times
    pub use_jitter: bool,
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            max_attempts: 3,
            base_delay_ms: 100,
            max_delay_ms: 10000, // 10 seconds max
            use_jitter: true,
        }
    }
}

impl RetryConfig {
    /// Create a config for aggressive retry (more attempts, longer delays)
    pub fn aggressive() -> Self {
        Self {
            max_attempts: 5,
            base_delay_ms: 200,
            max_delay_ms: 30000, // 30 seconds max
            use_jitter: true,
        }
    }

    /// Create a config for minimal retry (fewer attempts, for non-critical ops)
    pub fn minimal() -> Self {
        Self {
            max_attempts: 2,
            base_delay_ms: 100,
            max_delay_ms: 5000,
            use_jitter: true,
        }
    }
}

/// Check if an error is retryable
///
/// Retryable errors include:
/// - Network timeouts
/// - Connection errors
/// - Server errors (5xx status codes)
/// - Rate limiting (429 status code)
pub fn is_retryable_error(error: &AppError) -> bool {
    let error_str = error.to_string().to_lowercase();

    // Check for timeout-related errors
    if error_str.contains("timeout") || error_str.contains("timed out") {
        return true;
    }

    // Check for connection-related errors
    if error_str.contains("connection")
        || error_str.contains("connect")
        || error_str.contains("dns")
        || error_str.contains("network")
    {
        return true;
    }

    // Check for rate limiting (429)
    if error_str.contains("429") || error_str.contains("rate limit") || error_str.contains("too many requests") {
        return true;
    }

    // Check for server errors (5xx)
    if error_str.contains("500")
        || error_str.contains("502")
        || error_str.contains("503")
        || error_str.contains("504")
        || error_str.contains("server error")
    {
        return true;
    }

    // Check for transient errors
    if error_str.contains("temporary")
        || error_str.contains("transient")
        || error_str.contains("unavailable")
    {
        return true;
    }

    false
}

/// Execute an operation with exponential backoff retry
///
/// # Arguments
/// * `operation` - The async operation to execute
/// * `config` - Retry configuration
///
/// # Example
/// ```rust
/// let result = with_retry(
///     || async {
///         client.get("https://api.example.com/data").send().await
///             .map_err(|e| AppError::Network(e.to_string()))
///     },
///     RetryConfig::default(),
/// ).await?;
/// ```
pub async fn with_retry<F, Fut, T>(
    operation: F,
    config: RetryConfig,
) -> Result<T, AppError>
where
    F: Fn() -> Fut,
    Fut: std::future::Future<Output = Result<T, AppError>>,
{
    let mut last_error: Option<AppError> = None;

    for attempt in 0..config.max_attempts {
        match operation().await {
            Ok(result) => return Ok(result),
            Err(e) => {
                // Check if we should retry
                if attempt < config.max_attempts - 1 && is_retryable_error(&e) {
                    // Calculate delay with exponential backoff
                    let delay_ms = calculate_delay(attempt, &config);

                    tracing::warn!(
                        "Operation failed (attempt {}/{}): {}. Retrying in {}ms...",
                        attempt + 1,
                        config.max_attempts,
                        e,
                        delay_ms
                    );

                    sleep(Duration::from_millis(delay_ms)).await;
                    last_error = Some(e);
                } else {
                    // Not retryable or last attempt - return the error
                    return Err(e);
                }
            }
        }
    }

    // This should only be reached if all retries failed
    Err(last_error.unwrap_or_else(|| AppError::Internal("All retry attempts failed".to_string())))
}

/// Calculate the delay for a given retry attempt using exponential backoff
fn calculate_delay(attempt: u32, config: &RetryConfig) -> u64 {
    // Exponential backoff: base_delay * 2^attempt
    let exponential_delay = config.base_delay_ms * 2_u64.pow(attempt);

    // Cap at max delay
    let capped_delay = exponential_delay.min(config.max_delay_ms);

    if config.use_jitter {
        // Add random jitter (±25% of the delay)
        let jitter_range = capped_delay / 4;
        let jitter = if jitter_range > 0 {
            // Use a simple pseudo-random jitter based on attempt to avoid extra deps
            // In production, you might want to use rand::random_range
            let pseudo_random = (attempt.wrapping_mul(0x9E3779B9) % 100) as u64;
            (pseudo_random * jitter_range) / 100
        } else {
            0
        };

        // Randomly add or subtract jitter
        if attempt % 2 == 0 {
            capped_delay + jitter
        } else {
            capped_delay.saturating_sub(jitter)
        }
    } else {
        capped_delay
    }
}

/// Retry a reqwest-based HTTP request with automatic error conversion
///
/// This is a convenience wrapper for reqwest operations that automatically
/// converts reqwest::Error to AppError.
pub async fn with_retry_reqwest<F, Fut, T>(
    operation: F,
    config: RetryConfig,
) -> Result<T, AppError>
where
    F: Fn() -> Fut,
    Fut: std::future::Future<Output = Result<T, reqwest::Error>>,
{
    with_retry(
        || async {
            operation().await.map_err(|e| {
                // Check if it's a retryable reqwest error
                if is_retryable_reqwest_error(&e) {
                    AppError::Network(format!("{} (retryable)", e))
                } else {
                    AppError::Network(e.to_string())
                }
            })
        },
        config,
    )
    .await
}

/// Check if a reqwest error is retryable
fn is_retryable_reqwest_error(error: &reqwest::Error) -> bool {
    // Check for timeout
    if error.is_timeout() {
        return true;
    }

    // Check for connection errors
    if error.is_connect() {
        return true;
    }

    // Check HTTP status codes
    if let Some(status) = error.status() {
        // Server errors (5xx)
        if status.is_server_error() {
            return true;
        }
        // Rate limiting (429)
        if status == 429 {
            return true;
        }
    }

    // Check for request errors that might be transient
    if error.is_request() {
        // Check the underlying error for network-related issues
        let error_str = error.to_string().to_lowercase();
        if error_str.contains("connection")
            || error_str.contains("dns")
            || error_str.contains("reset")
            || error_str.contains("broken pipe")
        {
            return true;
        }
    }

    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_retryable_error_timeout() {
        let error = AppError::Timeout("Request timed out".to_string());
        assert!(is_retryable_error(&error));
    }

    #[test]
    fn test_is_retryable_error_network() {
        let error = AppError::Network("Connection refused".to_string());
        assert!(is_retryable_error(&error));
    }

    #[test]
    fn test_is_retryable_error_rate_limit() {
        let error = AppError::Network("429 Too Many Requests".to_string());
        assert!(is_retryable_error(&error));
    }

    #[test]
    fn test_is_retryable_error_server_error() {
        let error = AppError::Network("503 Service Unavailable".to_string());
        assert!(is_retryable_error(&error));
    }

    #[test]
    fn test_is_not_retryable_error() {
        let error = AppError::NotFound("File not found".to_string());
        assert!(!is_retryable_error(&error));

        let error = AppError::InvalidInput("Invalid parameter".to_string());
        assert!(!is_retryable_error(&error));
    }

    #[test]
    fn test_calculate_delay() {
        let config = RetryConfig {
            max_attempts: 3,
            base_delay_ms: 100,
            max_delay_ms: 10000,
            use_jitter: false,
        };

        // Attempt 0: 100ms
        assert_eq!(calculate_delay(0, &config), 100);
        // Attempt 1: 200ms
        assert_eq!(calculate_delay(1, &config), 200);
        // Attempt 2: 400ms
        assert_eq!(calculate_delay(2, &config), 400);
        // Attempt 10: capped at max_delay_ms
        assert_eq!(calculate_delay(10, &config), 10000);
    }

    #[test]
    fn test_retry_config_default() {
        let config = RetryConfig::default();
        assert_eq!(config.max_attempts, 3);
        assert_eq!(config.base_delay_ms, 100);
        assert_eq!(config.max_delay_ms, 10000);
        assert!(config.use_jitter);
    }

    #[test]
    fn test_retry_config_aggressive() {
        let config = RetryConfig::aggressive();
        assert_eq!(config.max_attempts, 5);
        assert_eq!(config.base_delay_ms, 200);
        assert_eq!(config.max_delay_ms, 30000);
        assert!(config.use_jitter);
    }
}
