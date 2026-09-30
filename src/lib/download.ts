/** Hands the learner a file made in the page. Nothing is uploaded: the text never leaves the device. */
export function downloadText(fileName: string, text: string, type = 'text/markdown'): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
