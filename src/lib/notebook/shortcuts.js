const isApplePlatform = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);

/** Formats a Tiptap-style shortcut ("Mod+Shift+H") for display and for aria-keyshortcuts. */
export function describeShortcut(shortcut) {
  const apple = isApplePlatform();
  const keys = shortcut.split('+');
  const label = keys
    .map((key) => {
      if (key === 'Mod') return apple ? '⌘' : 'Ctrl';
      if (key === 'Alt') return apple ? '⌥' : 'Alt';
      if (key === 'Shift') return apple ? '⇧' : 'Shift';
      return key;
    })
    .join(apple ? '' : '+');
  const aria = keys.map((key) => (key === 'Mod' ? (apple ? 'Meta' : 'Control') : key)).join('+');
  return { label, aria };
}
