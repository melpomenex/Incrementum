import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { TabContent } from "../TabContent";

describe("TabContent", () => {
  it("preserves tab component state when switching active tabs", async () => {
    const user = userEvent.setup();

    function StatefulTab() {
      const [value, setValue] = useState("");
      return (
        <input
          aria-label="stateful-input"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      );
    }

    function StaticTab() {
      return <div>static tab</div>;
    }

    const tabs = [
      {
        id: "a",
        title: "A",
        icon: "A",
        type: "documents",
        content: StatefulTab,
        closable: true,
      },
      {
        id: "b",
        title: "B",
        icon: "B",
        type: "queue",
        content: StaticTab,
        closable: true,
      },
    ] as const;

    const { rerender } = render(
      <TabContent tabs={[...tabs]} activeTabId="a" />
    );

    const input = screen.getByLabelText("stateful-input");
    await user.type(input, "resume me");
    expect(screen.getByLabelText("stateful-input")).toHaveValue("resume me");

    rerender(<TabContent tabs={[...tabs]} activeTabId="b" />);
    rerender(<TabContent tabs={[...tabs]} activeTabId="a" />);

    expect(screen.getByLabelText("stateful-input")).toHaveValue("resume me");
  });
});
