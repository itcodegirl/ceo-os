import { CircleQuestionMark, Layers, Lightbulb, ListChecks } from 'lucide-react';

const KIND_ICONS = { card: Layers, question: CircleQuestionMark, idea: Lightbulb, list: ListChecks };

/** The icon for a card, question, idea, or the to-do list. Always decorative: pair it with text. */
function KindIcon({ kind, ...props }) {
  const KindGlyph = KIND_ICONS[kind];
  return <KindGlyph aria-hidden="true" {...props} />;
}

export default KindIcon;
