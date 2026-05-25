import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ChiefOutputPicker from "./ChiefOutputPicker";

describe("ChiefOutputPicker", () => {
  it("renders grouped options and a CTA naming the current selection", () => {
    render(
      <ChiefOutputPicker value="plan" onChange={() => {}} onGenerate={() => {}} />,
    );

    expect(screen.getByRole("combobox", { name: "Make a…" })).toHaveValue("plan");
    expect(screen.getByRole("option", { name: "Decision brief" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Weekly update" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Opportunity follow-up" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate Action plan" })).toBeInTheDocument();
  });

  it("reports selection changes and fires onGenerate", () => {
    const onChange = vi.fn();
    const onGenerate = vi.fn();
    render(
      <ChiefOutputPicker value="decision-brief" onChange={onChange} onGenerate={onGenerate} />,
    );

    expect(screen.getByRole("button", { name: "Generate Decision brief" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Make a…" }), {
      target: { value: "summarize" },
    });
    expect(onChange).toHaveBeenCalledWith("summarize");

    fireEvent.click(screen.getByRole("button", { name: "Generate Decision brief" }));
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  it("disables the picker and shows a generating label while a request is in flight", () => {
    render(
      <ChiefOutputPicker
        value="plan"
        onChange={() => {}}
        onGenerate={() => {}}
        disabled
        isGenerating
      />,
    );

    expect(screen.getByRole("combobox", { name: "Make a…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Generating Action plan…" })).toBeDisabled();
  });
});
