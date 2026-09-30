// The form shows, but Add does nothing yet. Write the action.
export function AddBook({ onAdd }: { onAdd: (title: string) => void }) {
  function add(formData: FormData) {}

  return (
    <form action={add}>
      <label>
        Title
        <input name="title" />
      </label>
      <button>Add</button>
    </form>
  );
}
