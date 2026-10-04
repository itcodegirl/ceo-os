import { CircleQuestionMark, Layers, Lightbulb } from 'lucide-react';

const KIND_ICONS = { card: Layers, question: CircleQuestionMark, idea: Lightbulb };

/** The icon for a card, question, or idea. Always decorative: pair it with text. */
function KindIcon({ kind, ...props }) {
  const KindGlyph = KIND_ICONS[kind];
  return <KindGlyph aria-hidden="true" {...props} />;
}

export default KindIcon;
