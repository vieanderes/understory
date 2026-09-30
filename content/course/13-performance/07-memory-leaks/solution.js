// Shows the time every second, and at once when the page gets focus.
// Returns stop(), which the page calls when the clock is taken off screen.
function startClock(target, show) {
  const tick = () => show(new Date().toLocaleTimeString());
  const timer = setInterval(tick, 1000);
  target.addEventListener("focus", tick);
  return function stop() {
    target.removeEventListener("focus", tick);
    clearInterval(timer);
  };
}
