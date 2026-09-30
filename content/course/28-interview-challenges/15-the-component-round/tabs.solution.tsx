// One tab stop for the whole list: only the selected tab has tabindex 0, and the arrow
// keys move selection and focus together, so keyboard users never land on a hidden panel.
export function mountTabs(root: HTMLElement): void {
  const tabs = Array.from(root.querySelectorAll<HTMLElement>('[role="tab"]'));
  const panels = tabs.map((tab) => root.querySelector<HTMLElement>(`#${tab.getAttribute('aria-controls')}`));

  function select(index: number, moveFocus: boolean): void {
    tabs.forEach((tab, i) => {
      const selected = i === index;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      const panel = panels[i];
      if (panel) panel.hidden = !selected;
    });
    if (moveFocus) tabs[index]?.focus();
  }

  const last = tabs.length - 1;
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(i, true));
    tab.addEventListener('keydown', (event: KeyboardEvent) => {
      let next: number | undefined;
      if (event.key === 'ArrowRight') next = i === last ? 0 : i + 1;
      if (event.key === 'ArrowLeft') next = i === 0 ? last : i - 1;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = last;
      if (next === undefined) return;
      event.preventDefault();
      select(next, true);
    });
  });
  select(0, false);
}
