import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TeacherWidget } from "./TeacherWidget";

const baseProps = {
  busy: false,
  draft: "",
  messages: [],
  streamingContent: null,
  onDraftChange: vi.fn(),
  onOpenChange: vi.fn(),
  onSend: vi.fn()
};

describe("TeacherWidget", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it("uses a chat-help icon for the closed launcher", () => {
    render(<TeacherWidget {...baseProps} open={false} />);

    const launcher = screen.getByTestId("btn-teacher");

    expect(
      launcher.querySelector(".lucide-message-circle-question-mark")
    ).toBeTruthy();
    expect(launcher.querySelector(".lucide-graduation-cap")).toBeNull();
  });

  it("starts above the message input by default", async () => {
    render(<TeacherWidget {...baseProps} open={false} />);

    await waitFor(() =>
      expect(screen.getByTestId("btn-teacher")).toHaveStyle({
        top: "624px"
      })
    );
  });

  it("snaps the dragged launcher to the nearest side without opening the teacher chat", async () => {
    const onOpenChange = vi.fn();
    render(
      <TeacherWidget
        {...baseProps}
        open={false}
        onOpenChange={onOpenChange}
      />
    );

    const launcher = screen.getByTestId("btn-teacher");

    await waitFor(() => expect(launcher).toHaveStyle({ left: "960px" }));

    fireEvent.pointerDown(launcher, { clientX: 980, clientY: 640 });
    fireEvent.pointerMove(window, { clientX: 900, clientY: 500 });
    fireEvent.pointerUp(window, { clientX: 900, clientY: 500 });
    fireEvent.click(launcher);

    expect(launcher).toHaveStyle({ left: "960px", top: "484px" });
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(window.localStorage.getItem("pttutor.teacherLauncherPosition")).toBe(
      '{"x":960,"y":484}'
    );
  });

  it("animates only the release snap, not ordinary dragging", async () => {
    render(<TeacherWidget {...baseProps} open={false} />);

    const launcher = screen.getByTestId("btn-teacher");

    await waitFor(() => expect(launcher).toHaveStyle({ left: "960px" }));
    expect(launcher).not.toHaveClass("transition-[left,top]");

    fireEvent.pointerDown(launcher, { clientX: 980, clientY: 640 });
    fireEvent.pointerMove(window, { clientX: 900, clientY: 500 });

    expect(launcher).not.toHaveClass("transition-[left,top]");

    fireEvent.pointerUp(window, { clientX: 900, clientY: 500 });

    expect(launcher).toHaveClass("transition-[left,top]");
  });

  it("snaps to the left side when released closer to the left edge", async () => {
    render(<TeacherWidget {...baseProps} open={false} />);

    const launcher = screen.getByTestId("btn-teacher");

    await waitFor(() => expect(launcher).toHaveStyle({ left: "960px" }));

    fireEvent.pointerDown(launcher, { clientX: 980, clientY: 640 });
    fireEvent.pointerMove(window, { clientX: 80, clientY: 520 });
    fireEvent.pointerUp(window, { clientX: 80, clientY: 520 });

    expect(launcher).toHaveStyle({ left: "16px", top: "504px" });
    expect(window.localStorage.getItem("pttutor.teacherLauncherPosition")).toBe(
      '{"x":16,"y":504}'
    );
  });

  it("stays inside the conversation surface when snapping to the left side", async () => {
    const conversationSurface = document.createElement("section");
    conversationSurface.setAttribute("data-teacher-launcher-bounds", "true");
    vi.spyOn(conversationSurface, "getBoundingClientRect").mockReturnValue({
      bottom: 768,
      height: 768,
      left: 240,
      right: 1024,
      top: 0,
      width: 784,
      x: 240,
      y: 0,
      toJSON: () => ({})
    });
    document.body.appendChild(conversationSurface);

    render(<TeacherWidget {...baseProps} open={false} />);

    const launcher = screen.getByTestId("btn-teacher");

    await waitFor(() => expect(launcher).toHaveStyle({ left: "960px" }));

    fireEvent.pointerDown(launcher, { clientX: 980, clientY: 640 });
    fireEvent.pointerMove(window, { clientX: 80, clientY: 520 });
    fireEvent.pointerUp(window, { clientX: 80, clientY: 520 });

    expect(launcher).toHaveStyle({ left: "256px", top: "504px" });
    expect(window.localStorage.getItem("pttutor.teacherLauncherPosition")).toBe(
      '{"x":256,"y":504}'
    );
  });

  it("opens the teacher chat on click when the launcher is not dragged", async () => {
    const onOpenChange = vi.fn();
    render(
      <TeacherWidget
        {...baseProps}
        open={false}
        onOpenChange={onOpenChange}
      />
    );

    fireEvent.click(screen.getByTestId("btn-teacher"));

    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it("uses the same chat-help icon in the panel header", () => {
    render(<TeacherWidget {...baseProps} open />);

    const panel = screen.getByLabelText("Teacher chat");

    expect(
      panel.querySelector(".lucide-message-circle-question-mark")
    ).toBeTruthy();
    expect(panel.querySelector(".lucide-graduation-cap")).toBeNull();
  });

  it("closes the teacher chat when clicking outside the panel", () => {
    const onOpenChange = vi.fn();
    render(<TeacherWidget {...baseProps} open onOpenChange={onOpenChange} />);

    fireEvent.pointerDown(document.body);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("keeps the teacher chat open when clicking inside the panel", () => {
    const onOpenChange = vi.fn();
    render(<TeacherWidget {...baseProps} open onOpenChange={onOpenChange} />);

    fireEvent.pointerDown(screen.getByLabelText("Teacher chat"));

    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
