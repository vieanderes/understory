import { useState } from 'react';

const MAX = 20;

export function MessageForm({ onSend }: { onSend: (text: string) => void }) {
  const [text, setText] = useState('');
  const left = MAX - text.length;
  const blank = text.trim() === '';

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSend(text);
    // The field shows state, so emptying it means emptying the state.
    setText('');
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Message
        <textarea value={text} onChange={(event) => setText(event.target.value)} />
      </label>
      <p>{left >= 0 ? `${left} characters left` : `${-left} characters too many`}</p>
      <button disabled={blank || left < 0}>Send</button>
    </form>
  );
}
