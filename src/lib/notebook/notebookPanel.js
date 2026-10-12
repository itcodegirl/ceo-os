import { NOTEBOOK_ITEM_KINDS } from './items/itemModels';

/** The notebook panel's tabs: the three item kinds, then the to-do list. */
export const PANEL_TABS = Object.freeze([...NOTEBOOK_ITEM_KINDS, 'list']);

/** Accessible name of the panel, its collapsed strip, and its sheet. */
export const PANEL_LABEL = 'Cards, questions, ideas, and lists';
