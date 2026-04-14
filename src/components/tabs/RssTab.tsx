import { RSSReader } from "../media/RSSReader";

/**
 * RssTab - redirects to the full RSSReader component.
 * This wrapper exists for backward compatibility with the tab registry.
 */
export function RssTab() {
  return <RSSReader />;
}
