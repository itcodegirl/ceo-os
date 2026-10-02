import { useEffect } from 'react';

const ITEM_SELECTOR = '[data-roving-item]:not([disabled])';

/**
 * WAI-ARIA toolbar keyboard pattern: the toolbar is one Tab stop, and
 * Left/Right/Home/End move focus between items marked `data-roving-item`.
 */
export function useRovingFocus(containerRef) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    let activeIndex = 0;
    const getItems = () => Array.from(container.querySelectorAll(ITEM_SELECTOR));

    const sync = () => {
      const items = getItems();
      if (activeIndex >= items.length) activeIndex = Math.max(0, items.length - 1);
      items.forEach((item, index) => {
        item.tabIndex = index === activeIndex ? 0 : -1;
      });
    };

    const handleFocusIn = (event) => {
      const index = getItems().indexOf(event.target);
      if (index !== -1 && index !== activeIndex) {
        activeIndex = index;
        sync();
      }
    };

    const handleKeyDown = (event) => {
      const items = getItems();
      const current = items.indexOf(document.activeElement);
      if (current === -1 || items.length === 0) return;

      let next;
      switch (event.key) {
        case 'ArrowRight':
          next = (current + 1) % items.length;
          break;
        case 'ArrowLeft':
          next = (current - 1 + items.length) % items.length;
          break;
        case 'Home':
          next = 0;
          break;
        case 'End':
          next = items.length - 1;
          break;
        default:
          return;
      }
      event.preventDefault();
      activeIndex = next;
      sync();
      items[next]?.focus();
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(container, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
    container.addEventListener('focusin', handleFocusIn);
    container.addEventListener('keydown', handleKeyDown);
    return () => {
      observer.disconnect();
      container.removeEventListener('focusin', handleFocusIn);
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, [containerRef]);
}
