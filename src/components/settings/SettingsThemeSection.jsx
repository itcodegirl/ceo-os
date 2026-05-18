import { useId } from 'react';
import SectionCard from '../ui/SectionCard';
import { useThemePreference } from '../../hooks/useThemePreference';

const THEME_CHOICES = [
  { value: 'system', label: 'Match system', description: 'Follow your OS dark or light setting.' },
  { value: 'dark', label: 'Dark', description: 'The original calm-night palette.' },
  { value: 'light', label: 'Light', description: 'Warm-paper palette for bright environments.' },
];

/**
 * Theme picker section of the Settings page. Owns its own theme preference
 * hook so the page doesn't have to thread the value through props.
 */
function SettingsThemeSection() {
  const { preference: themePreference, setThemePreference } = useThemePreference();
  const themeRadiogroupId = useId();

  return (
    <SectionCard title="Theme" iconName="settings">
      <fieldset
        className="settings-theme"
        aria-describedby={`${themeRadiogroupId}-helper`}
      >
        <legend className="settings-theme__legend">Display theme</legend>
        <div className="settings-theme__choices" role="radiogroup">
          {THEME_CHOICES.map((choice) => {
            const isActive = themePreference === choice.value;
            const radioId = `${themeRadiogroupId}-${choice.value}`;
            return (
              <label
                key={choice.value}
                htmlFor={radioId}
                className={
                  isActive
                    ? 'settings-theme__choice settings-theme__choice--active'
                    : 'settings-theme__choice'
                }
              >
                <input
                  id={radioId}
                  type="radio"
                  name={themeRadiogroupId}
                  value={choice.value}
                  checked={isActive}
                  onChange={() => setThemePreference(choice.value)}
                />
                <span className="settings-theme__choice-label">{choice.label}</span>
                <span className="settings-theme__choice-description">{choice.description}</span>
              </label>
            );
          })}
        </div>
        <p id={`${themeRadiogroupId}-helper`} className="helper-text helper-text--muted">
          Stored in this browser. Changes apply immediately.
        </p>
      </fieldset>
    </SectionCard>
  );
}

export default SettingsThemeSection;
