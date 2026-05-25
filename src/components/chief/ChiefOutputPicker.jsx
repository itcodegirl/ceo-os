import { useId } from "react";
import Button from "../ui/Button";
import { getChiefActionConfig, getChiefActionsByGroup } from "../../lib/chiefActions";

// Static — the action catalogue does not change at runtime.
const ACTION_GROUPS = getChiefActionsByGroup();

export default function ChiefOutputPicker({
  value,
  onChange,
  onGenerate,
  disabled = false,
  isGenerating = false
}) {
  const selectId = useId();
  const hintId = `${selectId}-hint`;
  const config = getChiefActionConfig(value);
  const label = config.label || config.title || "output";

  return (
    <div className="chief-make" role="group" aria-label="Choose an output and generate it">
      <div className="chief-make__row">
        <label className="chief-make__label" htmlFor={selectId}>
          Make a…
        </label>
        <select
          id={selectId}
          className="chief-make__select"
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          disabled={isGenerating}
          aria-describedby={hintId}
        >
          {ACTION_GROUPS.map((group) => (
            <optgroup key={group.id} label={group.label}>
              {group.actions.map((action) => (
                <option key={action.key} value={action.key}>
                  {action.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <p className="chief-make__hint" id={hintId}>
        {config.hint}
      </p>

      <Button
        type="button"
        onClick={onGenerate}
        disabled={disabled}
        icon={{ name: "weekly", size: 14 }}
      >
        {isGenerating ? `Generating ${label}…` : `Generate ${label}`}
      </Button>
    </div>
  );
}
