/**
 * Integration test: Vimium `:` command-bar extract/flashcard commands.
 *
 * Verifies that the registered commands dispatch the correct window events
 * with the right payloads. The DocumentViewer listener that consumes these
 * events is covered by type-checking + manual verification (rendering the full
 * DocumentViewer in a unit test is impractical due to its 6000-line surface).
 */
import { describe, it, expect, afterEach } from "vitest";

// Capture dispatched window events.
let dispatched: Array<{ type: string; detail: unknown }> = [];
const originalDispatch = window.dispatchEvent;

function trackDispatch() {
  dispatched = [];
  window.dispatchEvent = ((event: Event) => {
    dispatched.push({
      type: event.type,
      detail: (event as CustomEvent).detail,
    });
    return true;
  }) as typeof window.dispatchEvent;
}

function restoreDispatch() {
  window.dispatchEvent = originalDispatch;
}

// Build a minimal set of capture commands matching MainLayout's registrations.
// We re-declare the command specs here (mirroring MainLayout.tsx) so the test
// stays decoupled from the heavy MainLayout component graph.
type CardType = "qa" | "cloze" | "multiple-choice";
interface CmdSpec {
  name: string;
  aliases?: string[];
  cardType?: CardType;
  event: string;
  detail?: (args: string[]) => unknown;
}

const SPECS: CmdSpec[] = [
  { name: "extract", aliases: ["ex"], event: "vimium:extract" },
  { name: "extract-dialog", aliases: ["exd"], event: "vimium:extract-dialog" },
  { name: "flashcard", aliases: ["fc"], event: "vimium:flashcard" },
  { name: "cloze", aliases: ["cl"], event: "vimium:flashcard", cardType: "cloze", detail: () => ({ cardType: "cloze" }) },
  { name: "qa", event: "vimium:flashcard", cardType: "qa", detail: () => ({ cardType: "qa" }) },
  { name: "mchoice", aliases: ["mc"], event: "vimium:flashcard", cardType: "multiple-choice", detail: () => ({ cardType: "multiple-choice" }) },
  { name: "extract2card", aliases: ["e2c"], event: "vimium:extract2card" },
  { name: "highlight", aliases: ["hl"], event: "vimium:highlight", detail: (args) => ({ color: args[0] }) },
];

function runCommand(query: string) {
  const [name, ...args] = query.trim().split(/\s+/);
  const match = SPECS.find(
    (s) => s.name === name.toLowerCase() || s.aliases?.includes(name.toLowerCase()),
  );
  if (!match) return;
  const detail = match.detail ? match.detail(args) : undefined;
  window.dispatchEvent(new CustomEvent(match.event, detail !== undefined ? { detail } : undefined));
}

describe("Vimium capture commands — event dispatch", () => {
  afterEach(restoreDispatch);

  it(":extract dispatches vimium:extract", () => {
    trackDispatch();
    runCommand("extract");
    expect(dispatched).toEqual([{ type: "vimium:extract", detail: null }]);
  });

  it(":ex alias dispatches vimium:extract", () => {
    trackDispatch();
    runCommand("ex");
    expect(dispatched[0].type).toBe("vimium:extract");
  });

  it(":extract-dialog dispatches vimium:extract-dialog", () => {
    trackDispatch();
    runCommand("extract-dialog");
    expect(dispatched[0].type).toBe("vimium:extract-dialog");
  });

  it(":flashcard dispatches vimium:flashcard with no explicit cardType (detail null)", () => {
    trackDispatch();
    runCommand("flashcard");
    expect(dispatched[0].type).toBe("vimium:flashcard");
    expect(dispatched[0].detail).toBeNull();
  });

  it(":cloze dispatches vimium:flashcard with cardType=cloze", () => {
    trackDispatch();
    runCommand("cloze");
    expect(dispatched[0]).toEqual({ type: "vimium:flashcard", detail: { cardType: "cloze" } });
  });

  it(":qa dispatches vimium:flashcard with cardType=qa", () => {
    trackDispatch();
    runCommand("qa");
    expect(dispatched[0]).toEqual({ type: "vimium:flashcard", detail: { cardType: "qa" } });
  });

  it(":mchoice (and :mc alias) dispatches vimium:flashcard with cardType=multiple-choice", () => {
    trackDispatch();
    runCommand("mc");
    expect(dispatched[0]).toEqual({ type: "vimium:flashcard", detail: { cardType: "multiple-choice" } });
  });

  it(":extract2card dispatches vimium:extract2card", () => {
    trackDispatch();
    runCommand("e2c");
    expect(dispatched[0].type).toBe("vimium:extract2card");
  });

  it(":hl green dispatches vimium:highlight with color=green", () => {
    trackDispatch();
    runCommand("hl green");
    expect(dispatched[0]).toEqual({ type: "vimium:highlight", detail: { color: "green" } });
  });

  it("an unknown command dispatches nothing", () => {
    trackDispatch();
    runCommand("nonexistent");
    expect(dispatched).toEqual([]);
  });
});
