import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { CreateScenarioInput } from "@/lib/scenario-input";
import { CustomScenarioForm } from "./CustomScenarioForm";

const draft: CreateScenarioInput = {
  name: "Pharmacy visit",
  category: "daily",
  icon: "💊",
  feedback_mode: "standard",
  starter: "actor",
  actor_role: "A pharmacist",
  actor_setting: "A neighborhood pharmacy",
  scenario_context: "The customer needs cold medicine and dosage advice.",
  user_role: "A customer buying medicine"
};

function renderForm({
  onDraftScenario = vi.fn(async () => draft),
  onSubmit = vi.fn()
}: {
  onDraftScenario?: (prompt: string) => Promise<CreateScenarioInput>;
  onSubmit?: (
    input: CreateScenarioInput,
    options: { startChat: boolean }
  ) => void;
} = {}) {
  render(
    <CustomScenarioForm
      busy={false}
      onCancel={() => undefined}
      onDraftScenario={onDraftScenario}
      onSubmit={onSubmit}
    />
  );
  return { onDraftScenario, onSubmit };
}

describe("CustomScenarioForm", () => {
  it("starts with a single practice prompt instead of the full schema form", () => {
    renderForm();

    expect(
      screen.getByLabelText(/what do you want to practice/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /balanced/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/who they are/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/still needed/i)).not.toBeInTheDocument();
  });

  it("drafts a scenario from one sentence and submits the reviewed draft", async () => {
    const user = userEvent.setup();
    const onDraftScenario = vi.fn(async () => draft);
    const onSubmit = vi.fn();
    renderForm({ onDraftScenario, onSubmit });

    await user.type(
      screen.getByLabelText(/what do you want to practice/i),
      "buying cold medicine"
    );
    await user.click(screen.getByRole("button", { name: /draft scenario/i }));

    await waitFor(() =>
      expect(screen.getByText("Pharmacy visit")).toBeInTheDocument()
    );
    expect(onDraftScenario).toHaveBeenCalledWith("buying cold medicine");

    await user.click(screen.getByRole("button", { name: /start chat/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Pharmacy visit",
        feedback_mode: "standard",
        actor_role: "A pharmacist",
        actor_setting: "A neighborhood pharmacy",
        scenario_context: "The customer needs cold medicine and dosage advice.",
        user_role: "A customer buying medicine"
      }),
      { startChat: true }
    );
  });

  it("keeps prompt scaffolding out of the review step", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByText(/calling my landlord/i));
    await user.click(screen.getByRole("button", { name: /draft scenario/i }));
    await screen.findByText("Pharmacy visit");

    expect(screen.queryByLabelText(/personality/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /adjust details/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/first line/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^category$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^icon$/i)).not.toBeInTheDocument();
  });

  it("lets the learner choose how strict the feedback should be", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderForm({ onSubmit });

    await user.click(screen.getByRole("button", { name: /strict/i }));
    await user.type(
      screen.getByLabelText(/what do you want to practice/i),
      "buying cold medicine"
    );
    await user.click(screen.getByRole("button", { name: /draft scenario/i }));
    await screen.findByText("Pharmacy visit");
    await user.click(screen.getByRole("button", { name: /start chat/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        feedback_mode: "strict"
      }),
      { startChat: true }
    );
  });

  it("falls back to manual review when drafting fails", async () => {
    const user = userEvent.setup();
    renderForm({
      onDraftScenario: vi.fn(async () => {
        throw new Error("Draft failed");
      })
    });

    await user.type(
      screen.getByLabelText(/what do you want to practice/i),
      "job interview for a marketing role"
    );
    await user.click(screen.getByRole("button", { name: /draft scenario/i }));

    await screen.findByText(/couldn't draft this one/i);
    expect(screen.getByText("Custom practice")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("job interview for a marketing role")
    ).toBeInTheDocument();
  });
});
