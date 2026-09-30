const tasks = [
  { title: "Buy milk", done: true },
  { title: "Call the dentist", done: false },
];

let left = 0;
for (const task of tasks) {
  if (task.Done === false) {
    left = left + 1;
  }
}
console.log(`Tasks left: ${left}`);
