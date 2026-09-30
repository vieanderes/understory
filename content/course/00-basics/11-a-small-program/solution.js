const tasks = [];

function addTask(title) {
  tasks.push({ title: title, done: false });
}

function completeTask(index) {
  tasks[index].done = true;
}

function showList() {
  for (const task of tasks) {
    if (task.done) {
      console.log(`[x] ${task.title}`);
    } else {
      console.log(`[ ] ${task.title}`);
    }
  }
}
