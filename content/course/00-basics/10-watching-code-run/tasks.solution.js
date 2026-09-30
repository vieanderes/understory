const tasks = [
  { title: "Buy milk", done: true },
  { title: "Call the dentist", done: false },
];

let left = 0;
for (const task of tasks) {
  console.log(task.title, task.done);
  if (task.done === false) {
    left = left + 1;
  }
}
console.log(`Tasks left: ${left}`);
