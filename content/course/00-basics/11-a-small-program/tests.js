test('addTask adds an unfinished task', () => {
  // Start from an empty list, whatever the learner's own calls added.
  tasks.length = 0;
  addTask('Buy milk');
  expect(tasks.length).toBe(1);
  expect(tasks[0].done).toBe(false);
});

test('completeTask marks the task as done', () => {
  addTask('Call the dentist');
  completeTask(0);
  expect(tasks[0].done).toBe(true);
  expect(tasks[1].done).toBe(false);
});

test('showList shows a line for each task, ticked when done', () => {
  const before = printed().length;
  showList();
  // slice(before) keeps only the lines printed since `before`
  expect(printed().slice(before)).toEqual(['[x] Buy milk', '[ ] Call the dentist']);
});
