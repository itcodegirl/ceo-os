import Button from './Button';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import {
  SOURCE_NOTICE_LOCAL_ONLY,
  SOURCE_NOTICE_OFFLINE,
  SOURCE_NOTICE_SUPABASE,
} from '../../lib/uiCopy';

function resolveRecoveryText(source, recoveryText, sourceState) {
  if (typeof recoveryText === 'string' && recoveryText.trim()) {
    return recoveryText.trim();
  }

  if (sourceState === 'offline') {
    return 'Showing the latest available workspace data. Retry when the network or Supabase is available; changes are not replayed automatically.';
  }

  if (source === 'supabase') {
    return 'Showing the latest confirmed workspace data. Retry to verify the current Supabase state.';
  }

  return 'Showing the latest local workspace snapshot while we retry.';
}

function resolveSourceStatus({ source, isOnline, hasLoadError, supabaseText, localText, offlineText }) {
  if (isOnline === false || (source === 'supabase' && hasLoadError)) {
    return {
      state: 'offline',
      text: offlineText,
      className: 'source-status source-status--offline',
    };
  }

  if (source === 'supabase') {
    return {
      state: 'supabase',
      text: supabaseText,
      className: 'source-status source-status--supabase',
    };
  }

  return {
    state: 'local',
    text: localText,
    className: 'source-status source-status--local',
  };
}

function SourceStatusNotice({
  source = 'local',
  supabaseText = SOURCE_NOTICE_SUPABASE,
  localText = SOURCE_NOTICE_LOCAL_ONLY,
  offlineText = SOURCE_NOTICE_OFFLINE,
  className = '',
  loadError = '',
  errorClassName = '',
  recoveryText = '',
  onRetry = null,
  retryAriaLabel = 'Retry loading data',
  retryText = 'Retry',
  retryDisabled = false,
}) {
  const isOnline = useOnlineStatus();
  const sourceStatus = resolveSourceStatus({
    source,
    isOnline,
    hasLoadError: Boolean(loadError),
    supabaseText,
    localText,
    offlineText,
  });
  const recoveryMessage = resolveRecoveryText(source, recoveryText, sourceStatus.state);
  const sourceClassName = `${sourceStatus.className} ${className}`.trim();
  const alertClassName = `helper-text ${errorClassName}`.trim();
  const errorMessageId = loadError ? `source-status-error-${sourceStatus.state}` : undefined;
  const recoveryMessageId = loadError ? `source-status-recovery-${sourceStatus.state}` : undefined;

  return (
    <>
      <p className={sourceClassName} role="status" aria-live="polite">
        <span className="source-status__dot" aria-hidden="true" />
        <span>{sourceStatus.text}</span>
      </p>
      {loadError ? (
        <div className="helper-inline-actions">
          <div className="source-status__recovery-group">
            <p id={errorMessageId} className={alertClassName} role="alert">{loadError}</p>
            <p id={recoveryMessageId} className="helper-text source-status__recovery">{recoveryMessage}</p>
          </div>
          {typeof onRetry === 'function' ? (
            <Button
              type="button"
              size="small"
              disabled={retryDisabled}
              aria-describedby={[errorMessageId, recoveryMessageId].filter(Boolean).join(' ') || undefined}
              onClick={() => {
                void onRetry();
              }}
              ariaLabel={retryAriaLabel}
            >
              {retryText}
            </Button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

export default SourceStatusNotice;
