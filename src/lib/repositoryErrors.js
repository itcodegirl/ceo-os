export const DUPLICATE_RECORD_CODE = 'DUPLICATE_RECORD';

export function createDuplicateRecordError(message) {
  const error = new Error(message);
  error.code = DUPLICATE_RECORD_CODE;
  return error;
}

export function getRepositoryErrorMessage(error, fallbackMessage) {
  if (error?.code === DUPLICATE_RECORD_CODE && typeof error.message === 'string' && error.message.trim()) {
    return error.message;
  }

  return fallbackMessage;
}
