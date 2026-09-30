import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

// Its own component, inside the form: useFormStatus reads the form above it.
function BookButton() {
  const { pending } = useFormStatus();
  return <button disabled={pending}>{pending ? 'Booking' : 'Book'}</button>;
}

export function BookingForm({ reserve }: { reserve: (name: string) => Promise<void> }) {
  async function book(previous: string, formData: FormData) {
    const name = String(formData.get('name') ?? '').trim();
    if (name === '') return 'Add a name for the booking.';
    await reserve(name);
    return `Booked for ${name}.`;
  }

  const [message, formAction] = useActionState(book, '');

  return (
    <form action={formAction}>
      <label>
        Your name
        <input name="name" />
      </label>
      <BookButton />
      <p>{message}</p>
    </form>
  );
}
