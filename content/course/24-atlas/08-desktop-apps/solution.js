// The main process opens links from the page in the user's browser, with shell.openExternal.
// Only a real https link may pass: never file:, a custom scheme, or text that isn't a URL.
function safeToOpen(link) {
  return link.trim().toLowerCase().startsWith('https://');
}
