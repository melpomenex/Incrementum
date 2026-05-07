//! Data models for Incrementum

pub mod document;
pub mod extract;
pub mod learning_item;
pub mod category;
pub mod queue;
pub mod position;
pub mod reading_goal;
pub mod collection;
pub mod playlist;
pub mod video_extract;
pub mod image_asset;
pub mod transcription_queue;

pub use document::{Document, DocumentImageAsset, FileType, DocumentMetadata};
pub use extract::Extract;
pub use learning_item::{LearningItem, ItemType, ItemState, MemoryState, ReviewRating};
pub use category::Category;
pub use queue::QueueItem;
pub use position::{DocumentPosition, Bookmark, ReadingSession, DailyReadingStats};
pub use reading_goal::{ReadingGoal, GoalType, GoalProgress, Achievement, AchievementCategory, ReadingStreak};
pub use collection::{Collection, CollectionType, DocumentCollection, SmartCollectionFilter};
pub use playlist::{PlaylistSubscription, PlaylistVideo, PlaylistSettings};
pub use video_extract::VideoExtract;
pub use image_asset::{ImageAsset, ImageAssetWithUsage};
pub use transcription_queue::{TranscriptionQueueEntry, TranscriptionJobStatus, TranscriptionQueueEntryWithDoc};
pub mod podcast;
pub use podcast::{PodcastFeed, PodcastFeedResponse, PodcastEpisode, ParsedPodcastFeed, ParsedPodcastEpisode};
