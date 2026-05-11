//! Production SSRF protection utilities

use std::net::{Ipv4Addr, Ipv6Addr};

/// Check whether a URL targets a private, loopback, or reserved address.
/// Returns `Ok(())` if the URL appears safe, `Err` with a description if blocked.
pub fn validate_url_not_private(url: &str) -> Result<(), String> {
    let parsed = url::Url::parse(url).map_err(|e| format!("Invalid URL: {e}"))?;

    match parsed.host() {
        Some(url::Host::Domain(domain)) => {
            if domain.eq_ignore_ascii_case("localhost") {
                return Err("URL resolves to localhost".to_string());
            }
        }
        Some(url::Host::Ipv4(ip)) => {
            if is_private_ipv4(&ip) {
                return Err(format!("URL resolves to private/reserved IP: {}", ip));
            }
        }
        Some(url::Host::Ipv6(ip)) => {
            if is_private_ipv6(&ip) {
                return Err(format!("URL resolves to private/reserved IP: {}", ip));
            }
        }
        None => return Err("URL has no host".to_string()),
    }

    Ok(())
}

fn is_private_ipv4(ip: &Ipv4Addr) -> bool {
    let octets = ip.octets();
    octets[0] == 127
        || octets[0] == 10
        || (octets[0] == 172 && (16..=31).contains(&octets[1]))
        || (octets[0] == 192 && octets[1] == 168)
        || (octets[0] == 169 && octets[1] == 254)
        || ip.is_unspecified()
}

fn is_private_ipv6(ip: &Ipv6Addr) -> bool {
    ip.is_loopback()
        || matches!(ip.segments(), [0xfe80, ..])
        || ip.is_unspecified()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_blocks_private_ips() {
        assert!(validate_url_not_private("http://127.0.0.1/admin").is_err());
        assert!(validate_url_not_private("http://localhost:8080/api").is_err());
        assert!(validate_url_not_private("http://169.254.169.254/latest/meta-data").is_err());
        assert!(validate_url_not_private("http://10.0.0.1/internal").is_err());
        assert!(validate_url_not_private("http://192.168.1.1/local").is_err());
        assert!(validate_url_not_private("http://172.20.0.1/test").is_err());
        assert!(validate_url_not_private("http://[::1]/api").is_err());
    }

    #[test]
    fn test_allows_public_urls() {
        assert!(validate_url_not_private("https://api.openai.com/v1/chat").is_ok());
        assert!(validate_url_not_private("https://example.com/page").is_ok());
        assert!(validate_url_not_private("https://feeds.bbci.co.uk/news/rss.xml").is_ok());
    }
}
