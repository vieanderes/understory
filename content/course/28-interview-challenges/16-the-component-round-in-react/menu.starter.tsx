import { useState } from 'react';

interface MenuButtonProps {
  label: string;
  items: string[];
  onSelect: (item: string) => void;
}

// It opens and closes with the mouse. Make it work from the keyboard and for a screen reader.
export function MenuButton({ label, items, onSelect }: MenuButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button onClick={() => setOpen(!open)}>{label}</button>
      {open && (
        <ul>
          {items.map((item) => (
            <li key={item} onClick={() => onSelect(item)}>
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
