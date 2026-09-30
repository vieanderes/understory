import { useState } from 'react';

export function PasswordField() {
  // State, not a plain variable: React keeps it between renders, and the setter redraws.
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label>
        Password
        <input type={visible ? 'text' : 'password'} />
      </label>
      <button onClick={() => setVisible(!visible)}>{visible ? 'Hide' : 'Show'}</button>
    </div>
  );
}
