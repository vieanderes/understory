export function AddBook({ onAdd }: { onAdd: (title: string) => void }) {
  // The list lives in the parent, so the form only reports what was typed.
  function add(formData: FormData) {
    const title = String(formData.get('title') ?? '').trim();
    if (title !== '') onAdd(title);
  }

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
