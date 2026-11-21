export const DUPLICATE_RECORD_CODE = 'DUPLICATE_RECORD';

export function createDuplicateRecordError(message) {
  const error = new Error(message);
  error.code = DUPLICATE_RECORD_CODE;
  return error;
}

export function getRepositoryErrorMessage(error, fallbackMessage) {
  if ((String(error?.code || '').startsWith('QUEUE_') || error?.code === 'STORAGE_COORDINATION_UNAVAILABLE') && error?.message) return error.message;
  if (error?.code === DUPLICATE_RECORD_CODE && typeof error.message === 'string' && error.message.trim()) {
    return error.message;
  }

  return fallbackMessage;
}
