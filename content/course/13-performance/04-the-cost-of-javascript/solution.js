// Saves every note after a click. ui.show(text) updates the status line,
// ui.save(batch) saves a list of notes, and yieldToMain() waits for a timer.
async function onSaveClick(notes, ui, yieldToMain) {
  ui.show("Saving");
  await yieldToMain();
  for (let start = 0; start < notes.length; start += 100) {
    ui.save(notes.slice(start, start + 100));
    await yieldToMain();
  }
  ui.show("Saved");
}
