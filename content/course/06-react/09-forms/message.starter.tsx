import { useState } from 'react';

const MAX = 20;

// Sends an empty string, and can't count as you type. Control the field, then count down.
export function MessageForm({ onSend }: { onSend: (text: string) => void }) {
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    // Without an action, stop the browser's own submit, which would reload the page.
    event.preventDefault();
    onSend('');
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Message
        <textarea />
      </label>
      <button>Send</button>
    </form>
  );
}
