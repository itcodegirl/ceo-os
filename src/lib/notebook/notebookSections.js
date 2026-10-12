// The four notebook sections and the writing blocks each page starts with.
//
// Personal keeps the original Journal prompts verbatim — same block keys as
// journalRepository's JOURNAL_PROMPTS — so imported entries line up and the
// Focus Home "feels heavy without a next thing" signal keeps its meaning.
//
// `folded` blocks start collapsed (progressive disclosure); `checklist`
// blocks open as a task list instead of a paragraph.

export const NOTEBOOK_SECTION_IDS = Object.freeze({
  personal: 'personal',
  professional: 'professional',
  learning: 'learning',
  ventures: 'ventures',
});

export const NOTEBOOK_SECTIONS = Object.freeze([
  Object.freeze({
    id: NOTEBOOK_SECTION_IDS.personal,
    label: 'Personal',
    description: 'A page for each day. Private reflection and one clear next step.',
    pageMode: 'daily',
    blocks: Object.freeze([
      Object.freeze({ key: 'onMyMind', title: 'What is on my mind?', placeholder: 'A few honest lines are enough…' }),
      Object.freeze({ key: 'feelsHeavy', title: 'What feels heavy?', placeholder: 'Name it so it gets smaller…' }),
      Object.freeze({ key: 'oneNextThing', title: 'What is one thing I can do next?', placeholder: 'One small, doable move…' }),
      Object.freeze({ key: 'todaySuccess', title: 'What would make today feel successful?', placeholder: 'Keep it kind and realistic…' }),
    ]),
  }),
  Object.freeze({
    id: NOTEBOOK_SECTION_IDS.professional,
    label: 'Professional',
    description: 'Work, career, and the professional self you are building.',
    pageMode: 'named',
    blocks: Object.freeze([
      Object.freeze({ key: 'notes', title: 'Notes', placeholder: 'What is happening, what you are thinking about…' }),
      Object.freeze({ key: 'wins', title: 'Wins', placeholder: 'Progress worth remembering…', folded: true }),
      Object.freeze({ key: 'challenges', title: 'Challenges', placeholder: 'What is getting in the way…', folded: true }),
      Object.freeze({ key: 'nextSteps', title: 'Next steps', placeholder: 'What you will do about it…', folded: true }),
    ]),
  }),
  Object.freeze({
    id: NOTEBOOK_SECTION_IDS.learning,
    label: 'Learning',
    description: 'Notes from what you study, explained back in your own words.',
    pageMode: 'named',
    sourceLink: true,
    blocks: Object.freeze([
      Object.freeze({ key: 'notes', title: 'My Notes', placeholder: 'Capture what you are learning: definitions, examples, code…' }),
      Object.freeze({
        key: 'myVersion',
        title: 'My Version',
        kicker: 'Explain it back',
        placeholder: 'Explain it in your own words, as if teaching a friend…',
      }),
      Object.freeze({ key: 'whatClicked', title: 'What clicked', placeholder: 'The moment it made sense…', folded: true }),
      Object.freeze({ key: 'whatConfusedMe', title: 'What confused me', placeholder: 'Anything still fuzzy…', folded: true }),
      Object.freeze({ key: 'keyTakeaways', title: 'Key takeaways', placeholder: 'The two or three things worth keeping…', folded: true }),
    ]),
  }),
  Object.freeze({
    id: NOTEBOOK_SECTION_IDS.ventures,
    label: 'Inventions & CodeHerWay',
    description: 'Ideas, inventions, and CodeHerWay work in progress.',
    pageMode: 'named',
    blocks: Object.freeze([
      Object.freeze({ key: 'idea', title: 'The idea', placeholder: 'What it is and who it is for…' }),
      Object.freeze({ key: 'todo', title: 'To-do', placeholder: 'Add a step…', checklist: true }),
      Object.freeze({ key: 'whyItMatters', title: 'Why it matters', placeholder: 'The reason this is worth your time…', folded: true }),
      Object.freeze({ key: 'research', title: 'Research & notes', placeholder: 'Links, findings, open questions…', folded: true }),
    ]),
  }),
]);

const SECTIONS_BY_ID = new Map(NOTEBOOK_SECTIONS.map((section) => [section.id, section]));

export function isNotebookSectionId(value) {
  return SECTIONS_BY_ID.has(value);
}

export function getNotebookSection(sectionId) {
  return SECTIONS_BY_ID.get(sectionId) || SECTIONS_BY_ID.get(NOTEBOOK_SECTION_IDS.personal);
}

export function getNotebookBlock(sectionId, blockKey) {
  return getNotebookSection(sectionId).blocks.find((block) => block.key === blockKey) || null;
}
