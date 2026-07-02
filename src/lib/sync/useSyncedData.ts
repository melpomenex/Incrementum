/**
 * React hooks for reactive refresh when synced data arrives.
 *
 * The replication layer dispatches `incrementum:synced-*` CustomEvents on
 * `window` whenever a remote row lands in local SQLite (see the entity
 * `apply` callbacks). These hooks let components subscribe non-disruptively:
 * they refresh their data source on the event, but the refresh itself is the
 * normal read path — so an active review isn't interrupted (the queue just
 * gains/loses entries for the NEXT card), and arriving read-state doesn't yank
 * the user's current view.
 *
 * This is the "it just appeared" UX: read an article on desktop, and the
 * phone's RSS queue updates without a pull-to-refresh; review cards on one
 * device and the due-count badge on the other updates.
 */

import { useEffect } from "react";

const SYNC_EVENT_PREFIX = "incrementum:synced-";

/**
 * Invoke `handler` whenever any `incrementum:synced-*` event fires. The handler
 * is responsible for deciding whether to refresh (e.g. skip if a modal is open
 * or an answer is in progress). Pass a stable handler (e.g. from a store's
 * getState) to avoid resubscribing each render.
 */
export function useOnAnySyncedEvent(handler: () => void): void {
  useEffect(() => {
    const listener = () => handler();
    // Subscribe to all synced-* events by listening at the window level and
    // checking the type prefix.
    const wrapped = (e: Event) => {
      const type = (e as CustomEvent).type ?? "";
      if (type.startsWith(SYNC_EVENT_PREFIX)) listener();
    };
    // CustomEvent types are dynamic; subscribe to the specific ones we emit.
    const events = [
      "incrementum:synced-card",
      "incrementum:synced-card-deleted",
      "incrementum:synced-rss-feed",
      "incrementum:synced-rss-article",
      "incrementum:synced-podcast-feed",
      "incrementum:synced-podcast-episode",
    ];
    for (const ev of events) window.addEventListener(ev, wrapped);
    return () => {
      for (const ev of events) window.removeEventListener(ev, wrapped);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/**
 * Subscribe to a specific entity-type sync event. Returns nothing; use for the
 * side effect of refreshing a store/cache.
 */
export function useOnSyncedEntity(entity: string, handler: () => void): void {
  useEffect(() => {
    const event = `${SYNC_EVENT_PREFIX}${entity}`;
    const listener = () => handler();
    window.addEventListener(event, listener);
    return () => window.removeEventListener(event, listener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity]);
}
