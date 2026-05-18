import { useId, useMemo } from 'react';
import SectionCard from '../components/ui/SectionCard';
import PageHeader from '../components/ui/PageHeader';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import SourceStatusNotice from '../components/ui/SourceStatusNotice';
import LastSavedIndicator from '../components/ui/LastSavedIndicator';
import PageLoading from '../components/ui/PageLoading';
import SettingsAccountSection from '../components/settings/SettingsAccountSection';
import SettingsThemeSection from '../components/settings/SettingsThemeSection';
import SettingsWorkspaceDataSection from '../components/settings/SettingsWorkspaceDataSection';
import { useSettings } from '../hooks/useSettings';
import { getDeviceTimezone, getSupportedTimezones, resolveTimeZone } from '../lib/settings';
import { SOURCE_NOTICE_LOCAL_ONLY, buildSourceNotice } from '../lib/uiCopy';
import '../styles/forms.css';

function Settings() {
  const {
    settings,
    savedAt,
    source,
    isLoading,
    isSaving,
    loadError,
    timezoneIsValid,
    normalizeTimezone,
    updateSetting,
    saveSettings,
    refreshSettings,
  } = useSettings();
  const teamNameFieldId = useId();
  const timezoneFieldId = useId();
  const timezoneListId = useId();
  const supportedTimezones = useMemo(() => getSupportedTimezones(), []);
  const autoSaveToggleId = useId();

  const fieldsDisabled = isSaving || isLoading;
  const canPersistSettings = (nextSettings = settings) => Boolean(
    resolveTimeZone(nextSettings?.timezone),
  );
  const canSave = timezoneIsValid && !fieldsDisabled;
  const saveButtonLabel = isSaving
    ? 'Saving settings'
    : timezoneIsValid
      ? 'Save settings'
      : 'Save settings unavailable until timezone is valid';

  const handleChange = (key, value) => {
    updateSetting(key, value);
  };

  const markSave = async (nextSettings = settings) => {
    if (!canPersistSettings(nextSettings)) {
      return;
    }

    await saveSettings(nextSettings);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    void markSave({
      ...settings,
      teamName: formData.get('teamName'),
      timezone: formData.get('timezone'),
    });
  };

  const handleToggle = (key, value) => {
    handleChange(key, value);
    const nextSettings = { ...settings, [key]: value };
    if (canPersistSettings(nextSettings)) {
      void saveSettings(nextSettings);
    }
  };

  return (
    <section className="settings-page">
      <PageHeader
        title="Settings"
        description="Manage preferences that control your executive operating environment."
      />
      <SourceStatusNotice
        source={source}
        supabaseText={buildSourceNotice('supabase', { supabasePrefix: '' })}
        localText={SOURCE_NOTICE_LOCAL_ONLY}
        loadError={loadError}
        onRetry={refreshSettings}
        retryAriaLabel="Retry loading settings"
        retryDisabled={isLoading || isSaving}
      />
      <PageLoading visible={isLoading} label="Loading settings" />

      <form className="settings-grid" onSubmit={handleSubmit} aria-busy={isSaving || isLoading}>
        <SettingsAccountSection />

        <SectionCard title="Workspace" iconName="settings">
          <Input
            id={teamNameFieldId}
            type="text"
            name="teamName"
            label="Workspace name"
            className="form-field"
            autoComplete="organization"
            value={settings.teamName}
            required
            minLength={2}
            disabled={fieldsDisabled}
            onChange={(e) => handleChange('teamName', e.target.value)}
          />

          <div className="form-field">
            <Input
              id={timezoneFieldId}
              type="text"
              name="timezone"
              label="Timezone"
              autoComplete="off"
              list={timezoneListId}
              value={settings.timezone}
              required
              minLength={2}
              disabled={fieldsDisabled}
              error={!timezoneIsValid ? 'Timezone is invalid. Pick one from the list, for example America/Chicago.' : ''}
              title={
                timezoneIsValid
                  ? 'Use an IANA timezone, for example America/Chicago.'
                  : 'Enter a valid IANA timezone, for example America/Chicago.'
              }
              onBlur={() => {
                normalizeTimezone();
              }}
              onChange={(e) => handleChange('timezone', e.target.value)}
            />
            <datalist id={timezoneListId}>
              {supportedTimezones.map((zone) => (
                <option key={zone} value={zone} />
              ))}
            </datalist>
            <div className="settings-timezone-actions">
              <Button
                type="button"
                size="small"
                variant="ghost"
                disabled={fieldsDisabled}
                onClick={() => handleChange('timezone', getDeviceTimezone())}
              >
                Use device timezone
              </Button>
              {timezoneIsValid ? (
                <span className="helper-text helper-text--offset">
                  Start typing to filter the IANA list (for example, "Chicago" or "Tokyo").
                </span>
              ) : null}
            </div>
          </div>
        </SectionCard>

        <SettingsThemeSection />

        <SettingsWorkspaceDataSection source={source} onRefreshSettings={refreshSettings} />

        <SectionCard title="Experience" iconName="settings">
          <label className="settings-toggle" htmlFor={autoSaveToggleId}>
            <input
              id={autoSaveToggleId}
              type="checkbox"
              checked={settings.autoSave}
              disabled={fieldsDisabled}
              onChange={(e) => handleToggle('autoSave', e.target.checked)}
            />
            <span>Enable auto-save for drafts and notes</span>
          </label>
          <p className="helper-text helper-text--offset">
            Drafts and notes save in the background as you type. Disable to require explicit save actions.
          </p>
        </SectionCard>

        <div className="settings-actions">
          <Button
            type="submit"
            disabled={!canSave}
            ariaLabel={saveButtonLabel}
            icon={{ name: 'check', size: 14 }}
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </form>

      <div className="helper-text" role="status" aria-live="polite">
        {source === 'supabase'
          ? 'Last save is confirmed in your Supabase profile.'
          : 'Settings are stored on this device.'}
        <LastSavedIndicator savedAt={savedAt} />
      </div>
    </section>
  );
}

export default Settings;
