// Saves every note after a click. ui.show(text) updates the status line,
// ui.save(batch) saves a list of notes, and yieldToMain() waits for a timer.
async function onSaveClick(notes, ui, yieldToMain) {
  ui.show("Saving");
  ui.save(notes);
  ui.show("Saved");
}
