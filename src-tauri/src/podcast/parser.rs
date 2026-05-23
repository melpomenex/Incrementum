//! RSS 2.0 podcast feed parser with iTunes namespace support

use quick_xml::events::Event;
use quick_xml::Reader;
use crate::models::podcast::{ParsedPodcastEpisode, ParsedPodcastFeed};

/// Parse an RSS 2.0 podcast feed from raw XML text.
///
/// Supports standard RSS 2.0 elements plus iTunes namespace extensions:
/// `itunes:title`, `itunes:image`, `itunes:author`, `itunes:duration`,
/// `itunes:summary`, `itunes:category`.
pub fn parse_podcast_feed(xml: &str) -> Result<ParsedPodcastFeed, String> {
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(true);

    // Buffers
    let mut buf = Vec::new();

    let mut feed_title = String::new();
    let mut feed_description: Option<String> = None;
    let mut feed_image_url: Option<String> = None;
    let mut feed_author: Option<String> = None;
    let mut feed_language: Option<String> = None;
    let mut feed_link: Option<String> = None;
    let mut episodes: Vec<ParsedPodcastEpisode> = Vec::new();

    // Item-level accumulators
    let mut in_item = false;
    let mut item_guid: Option<String> = None;
    let mut item_title = String::new();
    let mut item_description: Option<String> = None;
    let mut item_published_date: Option<String> = None;
    let mut item_duration: Option<i64> = None;
    let mut item_audio_url: Option<String> = None;
    let mut item_audio_type: Option<String> = None;
    let mut item_file_size: Option<i64> = None;
    let mut item_image_url: Option<String> = None;
    let mut item_link: Option<String> = None;
    let mut item_itunes_image: Option<String> = None;
    let mut item_itunes_title: Option<String> = None;

    // Channel-level iTunes image tracking
    let mut channel_itunes_image: Option<String> = None;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) | Ok(Event::Empty(ref e)) => {
                let local_name = e.local_name();
                let name = String::from_utf8_lossy(local_name.as_ref());

                match name.as_ref() {
                    "item" => {
                        in_item = true;
                        // Reset item accumulators
                        item_guid = None;
                        item_title.clear();
                        item_description = None;
                        item_published_date = None;
                        item_duration = None;
                        item_audio_url = None;
                        item_audio_type = None;
                        item_file_size = None;
                        item_image_url = None;
                        item_link = None;
                        item_itunes_image = None;
                        item_itunes_title = None;
                    }
                    "enclosure" if in_item => {
                        for attr in e.attributes().flatten() {
                            let key = String::from_utf8_lossy(attr.key.as_ref());
                            let val = String::from_utf8_lossy(&attr.value);
                            match key.as_ref() {
                                "url" => item_audio_url = Some(val.into_owned()),
                                "type" => item_audio_type = Some(val.into_owned()),
                                "length" => {
                                    item_file_size = val.parse::<i64>().ok();
                                }
                                _ => {}
                            }
                        }
                    }
                    "image" if in_item => {
                        // RSS <image> inside <item> — usually not used, but handle it
                        // We'll grab the <url> child in the text handler
                    }
                    _ => {}
                }
            }
            Ok(Event::Empty(ref e)) => {
                // Handle self-closing tags like <itunes:image href="..." />
                // Already handled in Start above since Empty shares the same match arm
                // but let's also check for itunes:image specifically
                let local_name = e.local_name();
                let name = String::from_utf8_lossy(local_name.as_ref());
                if name == "itunes:image" {
                    for attr in e.attributes().flatten() {
                        let key = String::from_utf8_lossy(attr.key.as_ref());
                        let val = String::from_utf8_lossy(&attr.value);
                        if key == "href" {
                            let href = val.into_owned();
                            if in_item {
                                item_itunes_image = Some(href);
                            } else {
                                channel_itunes_image = Some(href);
                            }
                        }
                    }
                }
            }
            Ok(Event::Text(ref e)) => {
                let text = e.unescape().unwrap_or_default().into_owned();
                if text.is_empty() {
                    continue;
                }
                // We need context from the element stack to know what we're reading.
                // Since quick-xml's Reader doesn't maintain a stack, we use a simpler
                // approach: we track the current element via End events.
                // Instead, let's accumulate and use a state machine approach.
                // Actually, with the current approach of reading Start/Text/End,
                // we'd need to track current element. Let's refactor slightly.
            }
            Ok(Event::End(ref e)) => {
                let local_name = e.local_name();
                let name = String::from_utf8_lossy(local_name.as_ref());

                if name == "item" && in_item {
                    // Build episode
                    if let Some(audio_url) = item_audio_url.take() {
                        // Prefer iTunes title over regular title
                        let title = item_itunes_title
                            .take()
                            .unwrap_or_else(|| std::mem::take(&mut item_title));
                        if !title.is_empty() {
                            episodes.push(ParsedPodcastEpisode {
                                guid: item_guid.take(),
                                title,
                                description: item_description.take(),
                                published_date: item_published_date.take(),
                                duration: item_duration.take(),
                                audio_url,
                                audio_type: item_audio_type.take(),
                                file_size: item_file_size.take(),
                                image_url: item_itunes_image.take().or(item_image_url.take()),
                                link: item_link.take(),
                            });
                        }
                    }
                    in_item = false;
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => {
                return Err(format!("XML parse error: {}", e));
            }
            _ => {}
        }
        buf.clear();
    }

    // Now do a proper parse with element tracking
    episodes.clear();
    feed_title.clear();

    parse_podcast_feed_inner(xml).map_err(|e| format!("Parse error: {}", e))
}

/// Inner parser that properly tracks element context
fn parse_podcast_feed_inner(xml: &str) -> Result<ParsedPodcastFeed, String> {
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(true);

    let mut buf = Vec::new();

    let mut feed_title = String::new();
    let mut feed_description: Option<String> = None;
    let mut feed_image_url: Option<String> = None;
    let mut feed_author: Option<String> = None;
    let mut feed_language: Option<String> = None;
    let mut feed_link: Option<String> = None;
    let mut episodes: Vec<ParsedPodcastEpisode> = Vec::new();

    let mut element_stack: Vec<String> = Vec::new();
    let mut in_channel = false;
    let mut in_item = false;

    // Item accumulators
    let mut item_guid: Option<String> = None;
    let mut item_title = String::new();
    let mut item_description: Option<String> = None;
    let mut item_published_date: Option<String> = None;
    let mut item_duration_str: Option<String> = None;
    let mut item_audio_url: Option<String> = None;
    let mut item_audio_type: Option<String> = None;
    let mut item_file_size: Option<i64> = None;
    let mut item_image_url: Option<String> = None;
    let mut item_link: Option<String> = None;
    let mut item_itunes_image: Option<String> = None;
    let mut item_itunes_title: Option<String> = None;
    let mut item_guid_is_permalink: bool = true;

    let mut collect_text = false;
    let mut text_buf = String::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let name = String::from_utf8_lossy(e.local_name().as_ref()).into_owned();
                let name_lower = name.to_lowercase();

                // Handle non-self-closing image tag attributes
                if name_lower == "itunes:image" || name_lower == "image" {
                    for attr in e.attributes().flatten() {
                        let key = String::from_utf8_lossy(attr.key.as_ref()).to_string();
                        let val = String::from_utf8_lossy(&attr.value).to_string();
                        if key == "href" {
                            if in_item {
                                item_itunes_image = Some(val);
                            } else if in_channel {
                                feed_image_url = Some(val);
                            }
                        }
                    }
                }

                element_stack.push(name.clone());

                if name_lower == "channel" {
                    in_channel = true;
                } else if name_lower == "item" && in_channel {
                    in_item = true;
                    item_guid = None;
                    item_title.clear();
                    item_description = None;
                    item_published_date = None;
                    item_duration_str = None;
                    item_audio_url = None;
                    item_audio_type = None;
                    item_file_size = None;
                    item_image_url = None;
                    item_link = None;
                    item_itunes_image = None;
                    item_itunes_title = None;
                    item_guid_is_permalink = true;
                }

                // Decide whether to collect text content
                if in_channel {
                    let full_path = element_stack.join("/").to_lowercase();
                    if in_item {
                        match full_path.as_str() {
                            s if s.ends_with("/title")
                                || s.ends_with("/itunes:title") => collect_text = true,
                            s if s.ends_with("/description")
                                || s.ends_with("/itunes:summary")
                                || s.ends_with("/summary") => collect_text = true,
                            s if s.ends_with("/pubdate") => collect_text = true,
                            s if s.ends_with("/duration")
                                || s.ends_with("/itunes:duration") => collect_text = true,
                            s if s.ends_with("/link") => collect_text = true,
                            s if s.ends_with("/guid") => collect_text = true,
                            _ => collect_text = false,
                        }
                    } else {
                        // Channel-level matching (case-insensitive and root-tag robust)
                        match full_path.as_str() {
                            s if s.ends_with("/channel/title") || s == "channel/title" || s.ends_with("/title") => collect_text = true,
                            s if s.ends_with("/channel/description") || s == "channel/description" || s.ends_with("/description") => collect_text = true,
                            s if s.ends_with("/channel/link") || s == "channel/link" || s.ends_with("/link") => collect_text = true,
                            s if s.ends_with("/channel/language") || s == "channel/language" || s.ends_with("/language") => collect_text = true,
                            s if s.ends_with("/author") || s.ends_with("/itunes:author") => collect_text = true,
                            s if s.ends_with("/image/url") => collect_text = true,
                            _ => collect_text = false,
                        }
                    }
                    if collect_text {
                        text_buf.clear();
                    }
                }
            }
            Ok(Event::Empty(ref e)) => {
                let name = String::from_utf8_lossy(e.local_name().as_ref()).into_owned();
                let name_lower = name.to_lowercase();

                // Handle self-closing attributes (like <itunes:image href="..." /> or <enclosure url="..." />)
                if name_lower == "itunes:image" || name_lower == "image" {
                    for attr in e.attributes().flatten() {
                        let key = String::from_utf8_lossy(attr.key.as_ref()).to_string();
                        let val = String::from_utf8_lossy(&attr.value).to_string();
                        if key == "href" {
                            if in_item {
                                item_itunes_image = Some(val);
                            } else if in_channel {
                                feed_image_url = Some(val);
                            }
                        }
                    }
                }

                if name_lower == "enclosure" && in_item {
                    for attr in e.attributes().flatten() {
                        let key = String::from_utf8_lossy(attr.key.as_ref()).to_string();
                        let val = String::from_utf8_lossy(&attr.value).to_string();
                        match key.as_str() {
                            "url" => item_audio_url = Some(val),
                            "type" => item_audio_type = Some(val),
                            "length" => item_file_size = val.parse::<i64>().ok(),
                            _ => {}
                        }
                    }
                }
            }
            Ok(Event::Text(ref e)) => {
                if collect_text {
                    if let Ok(t) = e.unescape() {
                        text_buf.push_str(&t);
                    }
                }
            }
            Ok(Event::CData(ref e)) => {
                if collect_text {
                    text_buf.push_str(&String::from_utf8_lossy(e.as_ref()));
                }
            }
            Ok(Event::End(ref e)) => {
                let name = String::from_utf8_lossy(e.local_name().as_ref()).into_owned();
                let name_lower = name.to_lowercase();

                if collect_text {
                    let full_path = element_stack.join("/").to_lowercase();
                    let text = text_buf.trim().to_string();

                    if in_item {
                        match full_path.as_str() {
                            s if s.ends_with("/itunes:title") => {
                                item_itunes_title = if text.is_empty() { None } else { Some(text) };
                            }
                            s if s.ends_with("/title") => {
                                item_title = text;
                            }
                            s if s.ends_with("/itunes:summary")
                                || s.ends_with("/summary") => {
                                item_description = if text.is_empty() { None } else { Some(text) };
                            }
                            s if s.ends_with("/description") => {
                                if item_description.is_none() && !text.is_empty() {
                                    item_description = Some(text);
                                }
                            }
                            s if s.ends_with("/pubdate") => {
                                item_published_date = if text.is_empty() { None } else { Some(text) };
                            }
                            s if s.ends_with("/itunes:duration")
                                || s.ends_with("/duration") => {
                                item_duration_str = if text.is_empty() { None } else { Some(text) };
                            }
                            s if s.ends_with("/link") => {
                                item_link = if text.is_empty() { None } else { Some(text) };
                            }
                            _ => {}
                        }
                    } else if in_channel {
                        match full_path.as_str() {
                            s if s.ends_with("/channel/title") || s == "channel/title" || s.ends_with("/title") => feed_title = text,
                            s if s.ends_with("/channel/description") || s == "channel/description" || s.ends_with("/description") => {
                                feed_description = if text.is_empty() { None } else { Some(text) };
                            }
                            s if s.ends_with("/channel/link") || s == "channel/link" || s.ends_with("/link") => {
                                feed_link = if text.is_empty() { None } else { Some(text) };
                            }
                            s if s.ends_with("/channel/language") || s == "channel/language" || s.ends_with("/language") => {
                                feed_language = if text.is_empty() { None } else { Some(text) };
                            }
                            s if s.ends_with("/author") || s.ends_with("/itunes:author") => {
                                feed_author = if text.is_empty() { None } else { Some(text) };
                            }
                            s if s.ends_with("/image/url") => {
                                feed_image_url = if text.is_empty() { None } else { Some(text) };
                            }
                            _ => {}
                        }
                    }
                    collect_text = false;
                }

                // Handle guid element (has isPermaLink attribute)
                if name_lower == "guid" && in_item {
                    let text = text_buf.trim().to_string();
                    if !text.is_empty() {
                        item_guid = Some(text);
                    }
                }

                if name_lower == "item" && in_item {
                    // Finalize episode
                    if let Some(audio_url) = item_audio_url.take() {
                        let title = item_itunes_title
                            .take()
                            .unwrap_or_else(|| std::mem::take(&mut item_title));
                        if !title.is_empty() {
                            let duration = item_duration_str
                                .as_deref()
                                .and_then(parse_itunes_duration);
                            let image = item_itunes_image.take().or(item_image_url.take());
                            episodes.push(ParsedPodcastEpisode {
                                guid: item_guid.take(),
                                title,
                                description: item_description.take(),
                                published_date: item_published_date.take(),
                                duration,
                                audio_url,
                                audio_type: item_audio_type.take(),
                                file_size: item_file_size.take(),
                                image_url: image,
                                link: item_link.take(),
                            });
                        }
                    }
                    in_item = false;
                    item_guid_is_permalink = true;
                }

                if name_lower == "channel" {
                    in_channel = false;
                }

                // Pop element stack
                if let Some(top) = element_stack.last() {
                    if top.to_lowercase() == name_lower {
                        element_stack.pop();
                    }
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => {
                return Err(format!("XML parse error at position {}: {}", reader.error_position(), e));
            }
            _ => {}
        }
        buf.clear();
    }

    // Fallback: use feed_title from RSS <image> if still empty
    if feed_title.is_empty() {
        feed_title = "Untitled Podcast".to_string();
    }

    Ok(ParsedPodcastFeed {
        title: feed_title,
        description: feed_description,
        image_url: feed_image_url,
        author: feed_author,
        language: feed_language,
        link: feed_link,
        episodes,
    })
}

/// Parse an iTunes duration string into seconds.
///
/// Supports formats:
/// - "HH:MM:SS"
/// - "MM:SS"
/// - "SS" (pure seconds)
/// - "HH:MM:SS.mmm" (with milliseconds)
fn parse_itunes_duration(s: &str) -> Option<i64> {
    let s = s.trim();
    if s.is_empty() {
        return None;
    }

    // Try pure integer seconds first
    if let Ok(secs) = s.parse::<i64>() {
        return Some(secs);
    }

    // Try parsing as HH:MM:SS or MM:SS
    let parts: Vec<&str> = s.split(':').collect();
    let seconds = match parts.len() {
        2 => {
            // MM:SS
            let mins: i64 = parts[0].parse().ok()?;
            let secs: f64 = parts[1].parse().ok()?;
            (mins * 60) + secs as i64
        }
        3 => {
            // HH:MM:SS
            let hours: i64 = parts[0].parse().ok()?;
            let mins: i64 = parts[1].parse().ok()?;
            let secs: f64 = parts[2].parse().ok()?;
            (hours * 3600) + (mins * 60) + secs as i64
        }
        _ => return None,
    };

    Some(seconds)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_duration_seconds() {
        assert_eq!(parse_itunes_duration("3600"), Some(3600));
        assert_eq!(parse_itunes_duration("0"), Some(0));
    }

    #[test]
    fn test_parse_duration_mm_ss() {
        assert_eq!(parse_itunes_duration("45:30"), Some(2730));
        assert_eq!(parse_itunes_duration("01:00"), Some(60));
    }

    #[test]
    fn test_parse_duration_hh_mm_ss() {
        assert_eq!(parse_itunes_duration("1:30:00"), Some(5400));
        assert_eq!(parse_itunes_duration("02:15:30"), Some(8130));
    }

    #[test]
    fn test_parse_duration_with_milliseconds() {
        assert_eq!(parse_itunes_duration("01:02:03.500"), Some(3723));
    }

    #[test]
    fn test_parse_duration_empty() {
        assert_eq!(parse_itunes_duration(""), None);
        assert_eq!(parse_itunes_duration("  "), None);
    }

    #[test]
    fn test_parse_minimal_rss_feed() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Podcast</title>
    <link>https://example.com</link>
    <description>A test podcast</description>
    <item>
      <title>Episode 1</title>
      <enclosure url="https://example.com/ep1.mp3" type="audio/mpeg" length="12345"/>
      <pubDate>Mon, 01 Jan 2024 00:00:00 +0000</pubDate>
    </item>
  </channel>
</rss>"#;

        let feed = parse_podcast_feed(xml).unwrap();
        assert_eq!(feed.title, "Test Podcast");
        assert_eq!(feed.episodes.len(), 1);
        assert_eq!(feed.episodes[0].title, "Episode 1");
        assert_eq!(feed.episodes[0].audio_url, "https://example.com/ep1.mp3");
    }

    #[test]
    fn test_parse_itunes_namespace() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title>iTunes Podcast</title>
    <itunes:author>John Doe</itunes:author>
    <itunes:image href="https://example.com/cover.jpg"/>
    <language>en</language>
    <item>
      <itunes:title>iTunes Episode</itunes:title>
      <itunes:duration>1:30:00</itunes:duration>
      <itunes:summary>An episode summary</itunes:summary>
      <enclosure url="https://example.com/ep1.mp3" type="audio/mpeg" length="5432100"/>
      <guid>abc123</guid>
    </item>
  </channel>
</rss>"#;

        let feed = parse_podcast_feed(xml).unwrap();
        assert_eq!(feed.title, "iTunes Podcast");
        assert_eq!(feed.author.as_deref(), Some("John Doe"));
        assert_eq!(feed.image_url.as_deref(), Some("https://example.com/cover.jpg"));
        assert_eq!(feed.language.as_deref(), Some("en"));
        assert_eq!(feed.episodes.len(), 1);
        let ep = &feed.episodes[0];
        assert_eq!(ep.title, "iTunes Episode");
        assert_eq!(ep.duration, Some(5400));
        assert_eq!(ep.description.as_deref(), Some("An episode summary"));
        assert_eq!(ep.guid.as_deref(), Some("abc123"));
    }

    #[test]
    fn test_parse_uppercase_and_custom_feed() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<FEED xmlns="http://www.w3.org/2005/Atom">
  <CHANNEL>
    <TITLE>Uppercase Podcast</TITLE>
    <description>An uppercase description</description>
    <LINK>https://example.com/uppercase</LINK>
    <language>en-US</language>
    <item>
      <title>Episode 1</title>
      <enclosure url="https://example.com/ep1.mp3" type="audio/mpeg" length="12345"/>
    </item>
  </CHANNEL>
</FEED>"#;

        let feed = parse_podcast_feed(xml).unwrap();
        assert_eq!(feed.title, "Uppercase Podcast");
        assert_eq!(feed.description.as_deref(), Some("An uppercase description"));
        assert_eq!(feed.link.as_deref(), Some("https://example.com/uppercase"));
        assert_eq!(feed.language.as_deref(), Some("en-US"));
        assert_eq!(feed.episodes.len(), 1);
        assert_eq!(feed.episodes[0].title, "Episode 1");
    }

    #[test]
    fn test_parse_standard_rss_image() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Standard Image Podcast</title>
    <image>
      <url>https://example.com/standard-cover.png</url>
      <title>Standard Image Podcast</title>
      <link>https://example.com</link>
    </image>
    <item>
      <title>Episode 1</title>
      <enclosure url="https://example.com/ep1.mp3" type="audio/mpeg" length="12345"/>
    </item>
  </channel>
</rss>"#;

        let feed = parse_podcast_feed(xml).unwrap();
        assert_eq!(feed.title, "Standard Image Podcast");
        assert_eq!(feed.image_url.as_deref(), Some("https://example.com/standard-cover.png"));
    }
}
