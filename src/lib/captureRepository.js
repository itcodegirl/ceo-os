import { buildCreateId } from './utils';
import { STORAGE_DOMAINS } from './dataSchema';
import {
  readVersionedLocalStorage,
  safeWriteVersionedLocalStorage,
  writeVersionedLocalStorage,
} from './versionedStorage';

export const CAPTURE_NOTES_UPDATED_EVENT = 'ceo-os:capture-notes-updated';
export const CAPTURE_CATEGORY_OPTIONS = ['idea', 'task', 'content', 'opportunity', 'journal'];

function normalizeText(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value;
}

function normalizeCategory(value) {
  if (typeof value !== 'string') {
    return CAPTURE_CATEGORY_OPTIONS[0];
  }

  const lowercased = value.trim().toLowerCase();
  return CAPTURE_CATEGORY_OPTIONS.includes(lowercased)
    ? lowercased
    : CAPTURE_CATEGORY_OPTIONS[0];
}

function normalizeDate(value) {
  if (typeof value !== 'string') {
    return new Date().toISOString();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

const VALID_PROMOTION_TARGETS = new Set(['reminder', 'opportunity', 'content']);

function normalizePromotedTo(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim().toLowerCase();
  return VALID_PROMOTION_TARGETS.has(trimmed) ? trimmed : '';
}

function normalizeCaptureNote(note) {
  const promotedTo = normalizePromotedTo(note?.promotedTo);
  return {
    id: String(note?.id || buildCreateId()),
    text: normalizeText(note?.text),
    category: normalizeCategory(note?.category),
    createdAt: normalizeDate(note?.createdAt),
    updatedAt: normalizeDate(note?.updatedAt || note?.createdAt),
    promotedTo,
    promotedAt: promotedTo ? normalizeDate(note?.promotedAt) : '',
  };
}

function getFallbackCaptureNotes() {
  return [];
}

function readStorage() {
  if (typeof window === 'undefined') {
    return getFallbackCaptureNotes();
  }

  try {
    const parsed = readVersionedLocalStorage(STORAGE_DOMAINS.captureNotes, null);
    if (!parsed) {
      const fallback = getFallbackCaptureNotes();
      safeWriteVersionedLocalStorage(
        STORAGE_DOMAINS.captureNotes,
        fallback,
        'Failed to seed capture notes in localStorage',
      );
      return fallback;
    }

    if (!Array.isArray(parsed)) {
      return getFallbackCaptureNotes();
    }

    return parsed.map((note) => normalizeCaptureNote(note));
  } catch {
    return getFallbackCaptureNotes();
  }
}

function writeStorage(notes) {
  writeVersionedLocalStorage(
    STORAGE_DOMAINS.captureNotes,
    notes,
    'Failed to persist capture notes to localStorage',
  );
}

function emitCaptureNotesUpdated(detail = {}) {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(CAPTURE_NOTES_UPDATED_EVENT, { detail }),
  );
}

export function listCaptureNotes() {
  return readStorage();
}

export function createCaptureNote(payload) {
  const text = normalizeText(payload?.text).trim();
  if (!text) {
    throw new Error('Capture note text is required');
  }

  const timestamp = new Date().toISOString();
  const newNote = normalizeCaptureNote({
    id: buildCreateId(),
    text,
    category: payload?.category,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  const current = readStorage();
  const next = [newNote, ...current];
  writeStorage(next);
  emitCaptureNotesUpdated({ type: 'create', id: newNote.id });
  return newNote;
}

export function updateCaptureNote(id, payload) {
  const normalizedId = String(id || '');
  const nextText = normalizeText(payload?.text);
  const nextCategory = normalizeCategory(payload?.category);
  const now = new Date().toISOString();

  const current = readStorage();
  let didUpdate = false;
  const next = current.map((note) => {
    if (note.id !== normalizedId) {
      return note;
    }

    didUpdate = true;
    return normalizeCaptureNote({
      ...note,
      text: typeof payload?.text === 'string' ? nextText : note.text,
      category: nextCategory,
      updatedAt: now,
    });
  });

  if (!didUpdate) {
    throw new Error('Capture note not found');
  }

  writeStorage(next);
  emitCaptureNotesUpdated({ type: 'update', id: normalizedId });
  return next.find((note) => note.id === normalizedId) || null;
}

export function markCaptureNotePromoted(id, target) {
  const normalizedId = String(id || '');
  if (!normalizedId) {
    throw new Error('Capture note id is required');
  }
  const normalizedTarget = normalizePromotedTo(target);
  if (!normalizedTarget) {
    throw new Error('Capture note promotion target is invalid');
  }

  const current = readStorage();
  let didUpdate = false;
  const next = current.map((note) => {
    if (note.id !== normalizedId) {
      return note;
    }
    didUpdate = true;
    return normalizeCaptureNote({
      ...note,
      promotedTo: normalizedTarget,
      promotedAt: new Date().toISOString(),
    });
  });

  if (!didUpdate) {
    throw new Error('Capture note not found');
  }

  writeStorage(next);
  emitCaptureNotesUpdated({ type: 'promote', id: normalizedId, promotedTo: normalizedTarget });
  return next.find((note) => note.id === normalizedId) || null;
}

export function deleteCaptureNote(id) {
  const normalizedId = String(id || '');
  const current = readStorage();
  const didDelete = current.some((note) => note.id === normalizedId);
  if (!didDelete) {
    throw new Error('Capture note not found');
  }

  const next = current.filter((note) => note.id !== normalizedId);
  writeStorage(next);
  emitCaptureNotesUpdated({ type: 'delete', id: normalizedId });
}
