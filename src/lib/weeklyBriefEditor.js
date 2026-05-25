import {
  BLOCKER_NEEDS,
  BLOCKER_SEVERITY_OPTIONS,
  getDefaultFormValues as getDefaultFormValuesByType,
  PRIORITY_STATUS_OPTIONS,
  WIN_CATEGORY_OPTIONS,
} from './weeklyData';
import { buildCreateId } from './utils';
export {
  BLOCKER_NEEDS,
  BLOCKER_SEVERITY_OPTIONS,
  PRIORITY_STATUS_OPTIONS,
  WIN_CATEGORY_OPTIONS,
};

const DEFAULT_BLOCKER_NEED = BLOCKER_SEVERITY_OPTIONS[0];

export const DEFAULT_EDITOR_STATE = {
  type: '',
  itemId: '',
};

const EDITOR_STRATEGIES = {
  priority: {
    addTitle: 'Add Priority',
    editTitle: 'Edit Priority',
    getDefaultFormValues: () => ({ ...getDefaultFormValuesByType('priority') }),
    getFormValuesForEdit: (item) => ({
      title: item.title || '',
      owner: item.owner || '',
      status: item.status || 'Planned',
    }),
    createPayload: (formValues, existingId) => {
      const title = (formValues.title || '').trim();
      const owner = (formValues.owner || '').trim();
      const status = formValues.status || 'Planned';

      if (!title) {
        return { error: 'Add a title for this priority.' };
      }

      return {
        payload: {
          id: existingId || buildCreateId(),
          title,
          owner,
          status,
        },
      };
    },
  },
  win: {
    addTitle: 'Add Win',
    editTitle: 'Edit Win',
    getDefaultFormValues: () => ({ ...getDefaultFormValuesByType('win') }),
    getFormValuesForEdit: (item) => ({
      text: item.text || '',
      category: item.category || 'Product',
    }),
    createPayload: (formValues, existingId) => {
      const text = (formValues.text || '').trim();
      const category = (formValues.category || '').trim() || 'Product';

      if (!text) {
        return { error: 'Add a few words for this win.' };
      }

      return {
        payload: {
          id: existingId || buildCreateId(),
          text,
          category,
        },
      };
    },
  },
  blocker: {
    addTitle: 'Add Blocker',
    editTitle: 'Edit Blocker',
    getDefaultFormValues: () => ({ ...getDefaultFormValuesByType('blocker') }),
    getFormValuesForEdit: (item) => ({
      text: item.text || '',
      severity: item.severity || DEFAULT_BLOCKER_NEED,
    }),
    createPayload: (formValues, existingId) => {
      const text = (formValues.text || '').trim();
      const severity = formValues.severity || DEFAULT_BLOCKER_NEED;

      if (!text) {
        return { error: 'Add a few words about what\'s in the way.' };
      }

      return {
        payload: {
          id: existingId || buildCreateId(),
          text,
          severity,
        },
      };
    },
  },
};

function getStrategy(type) {
  return EDITOR_STRATEGIES[type] || null;
}

export function getDefaultFormValues(type) {
  const strategy = getStrategy(type);
  return strategy ? strategy.getDefaultFormValues() : {};
}

export function getFormValuesForEdit(type, item) {
  const strategy = getStrategy(type);
  return strategy ? strategy.getFormValuesForEdit(item) : {};
}

export function getEditorTitle(type, isEditing) {
  const strategy = getStrategy(type);
  if (!strategy) {
    return 'Edit Item';
  }

  return isEditing ? strategy.editTitle : strategy.addTitle;
}

export function createEditorPayload(type, formValues, existingId) {
  const strategy = getStrategy(type);
  if (!strategy) {
    return { error: 'Select a valid item type before saving.' };
  }

  return strategy.createPayload(formValues, existingId);
}

export function buildWeeklyPayload(type, formValues, existingId) {
  return createEditorPayload(type, formValues, existingId);
}
