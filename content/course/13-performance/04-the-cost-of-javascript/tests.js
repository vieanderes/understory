function fakes() {
  const log = [];
  const ui = {
    show: (text) => log.push(`show ${text}`),
    save: (batch) => log.push(`save ${batch.length}`),
  };
  const yieldToMain = async () => {
    log.push("yield");
  };
  return { log, ui, yieldToMain };
}

const notes = (count) => Array.from({ length: count }, (_, i) => `note ${i}`);

test("shows Saving, then yields before any saving starts", async () => {
  const { log, ui, yieldToMain } = fakes();
  await onSaveClick(notes(250), ui, yieldToMain);
  expect(log.slice(0, 2)).toEqual(["show Saving", "yield"]);
});

test("saves in batches of 100, the last one smaller", async () => {
  const { log, ui, yieldToMain } = fakes();
  await onSaveClick(notes(250), ui, yieldToMain);
  expect(log.filter((line) => line.startsWith("save"))).toEqual(["save 100", "save 100", "save 50"]);
});

test("yields between every two batches", async () => {
  const { log, ui, yieldToMain } = fakes();
  await onSaveClick(notes(250), ui, yieldToMain);
  const saves = log.flatMap((line, i) => (line.startsWith("save") ? [i] : []));
  for (let k = 1; k < saves.length; k++) {
    expect(log.slice(saves[k - 1], saves[k])).toContain("yield");
  }
});

test("shows Saved once everything is saved", async () => {
  const { log, ui, yieldToMain } = fakes();
  await onSaveClick(notes(250), ui, yieldToMain);
  expect(log[log.length - 1]).toBe("show Saved");
});

test("no notes means no saving at all", async () => {
  const { log, ui, yieldToMain } = fakes();
  await onSaveClick([], ui, yieldToMain);
  expect(log.filter((line) => line.startsWith("save"))).toEqual([]);
});
