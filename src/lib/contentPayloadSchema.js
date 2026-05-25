import * as v from 'valibot';
import {
  createPayloadParser,
  createSchemaValidator,
  requiredTrimmedString,
} from './schemaValidator';

// Idea → Drafting → Editing → Ready → Scheduled → Published is the full
// content lifecycle the page is built around. "Ready" is the holding lane
// for finished drafts that still need a slot; "Published" closes the loop so
// the board doubles as a record of what shipped.
export const CONTENT_STATUSES = Object.freeze([
  'Idea',
  'Drafting',
  'Editing',
  'Ready',
  'Scheduled',
  'Published',
]);

export const CONTENT_TYPES = Object.freeze([
  'Post',
  'Article',
  'Newsletter',
  'Video',
  'Thread',
  'Talk',
  'Other',
]);

export const DEFAULT_CONTENT_STATUS = 'Idea';
export const DEFAULT_CONTENT_TYPE = 'Post';

const optionalTrimmedString = v.pipe(
  v.optional(v.string(), ''),
  v.transform((value) => (typeof value === 'string' ? value.trim() : '')),
);

const optionalIsoDate = v.pipe(
  v.optional(v.string(), ''),
  v.transform((value) => (typeof value === 'string' ? value.trim() : '')),
  v.check(
    (value) => value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value),
    'Use a publish date in YYYY-MM-DD format, or leave it blank.',
  ),
);

export const contentPayloadSchema = v.object({
  title: requiredTrimmedString('Title is required.'),
  platform: requiredTrimmedString('Platform or channel is required.'),
  contentType: v.optional(
    v.picklist(CONTENT_TYPES, 'Choose a content type.'),
    DEFAULT_CONTENT_TYPE,
  ),
  status: v.optional(
    v.picklist(CONTENT_STATUSES, 'Choose a workflow status.'),
    DEFAULT_CONTENT_STATUS,
  ),
  purpose: optionalTrimmedString,
  scheduledFor: optionalIsoDate,
  notes: optionalTrimmedString,
});

export const validateContentPayload = createSchemaValidator(contentPayloadSchema);
export const parseContentPayload = createPayloadParser(contentPayloadSchema);
