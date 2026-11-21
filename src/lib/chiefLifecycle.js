import { assertWorkspaceOwner, getWorkspaceOwnerId } from './workspaceOwnership';

const revisions = new Map();
export const CHIEF_OUTPUT_SAVED_EVENT = 'ceo-os:chief-output-saved';
export function captureChiefWorkspace() {
  const ownerId = getWorkspaceOwnerId();
  return { ownerId, revision: revisions.get(ownerId) || 0 };
}
export function invalidateChiefWorkspace() {
  const ownerId = getWorkspaceOwnerId();
  revisions.set(ownerId, (revisions.get(ownerId) || 0) + 1);
}
export function assertChiefWorkspace(context) {
  assertWorkspaceOwner(context.ownerId);
  if ((revisions.get(context.ownerId) || 0) !== context.revision) {
    throw new Error('The Chief workspace was reset while this action was running.');
  }
}
