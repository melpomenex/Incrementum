import type { PodcastFeed } from "../api/podcast";

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

export function podcastFeedSearch(
  query: string,
  feeds: PodcastFeed[]
): PodcastFeed[] {
  if (!query.trim()) return feeds;

  const q = query.toLowerCase();

  return feeds.filter((feed) => {
    const title = feed.title.toLowerCase();
    const author = (feed.author ?? "").toLowerCase();
    const description = stripHtml(feed.description ?? "").toLowerCase();

    return (
      title.includes(q) || author.includes(q) || description.includes(q)
    );
  });
}
