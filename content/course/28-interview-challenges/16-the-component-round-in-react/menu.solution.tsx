import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

interface MenuButtonProps {
  label: string;
  items: string[];
  onSelect: (item: string) => void;
}

export function MenuButton({ label, items, onSelect }: MenuButtonProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);

  // Focus follows the active item, so the arrow keys and a screen reader agree.
  useEffect(() => {
    if (open) itemRefs.current[active]?.focus();
  }, [open, active]);

  function close() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  function choose(item: string) {
    onSelect(item);
    close();
  }

  function onKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => (index + 1) % items.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => (index - 1 + items.length) % items.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(items[active] as string);
    } else if (event.key === 'Escape') {
      close();
    }
  }

  return (
    <div>
      <button
        ref={buttonRef}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setActive(0);
          setOpen((isOpen) => !isOpen);
        }}
      >
        {label}
      </button>
      {open && (
        <ul role="menu" aria-label={label} onKeyDown={onKeyDown}>
          {items.map((item, index) => (
            <li
              key={item}
              role="menuitem"
              tabIndex={-1}
              ref={(node) => {
                itemRefs.current[index] = node;
              }}
              onClick={() => choose(item)}
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
