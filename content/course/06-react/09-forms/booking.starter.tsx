// The form doesn't book anything yet. Give it an action, an error message and a pending button.
export function BookingForm({ reserve }: { reserve: (name: string) => Promise<void> }) {
  return (
    <form>
      <label>
        Your name
        <input name="name" />
      </label>
      <button>Book</button>
    </form>
  );
}
