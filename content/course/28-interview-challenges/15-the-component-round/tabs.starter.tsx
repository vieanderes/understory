// Wires up the tab list inside root. The mouse already works; the keyboard doesn't yet.
export function mountTabs(root: HTMLElement): void {
  const tabs = Array.from(root.querySelectorAll<HTMLElement>('[role="tab"]'));
  const panels = tabs.map((tab) => root.querySelector<HTMLElement>(`#${tab.getAttribute('aria-controls')}`));

  function select(index: number): void {
    tabs.forEach((tab, i) => {
      tab.setAttribute('aria-selected', String(i === index));
      const panel = panels[i];
      if (panel) panel.hidden = i !== index;
    });
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(i));
  });
  select(0);
}
