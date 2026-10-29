// Show the visitor's current local time, updated once per second.
const clock = document.querySelector('#clock');
const formatter = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  timeZoneName: 'short'
});
function updateClock() {
  const now = new Date();
  clock.dateTime = now.toISOString();
  clock.textContent = formatter.format(now);
}
updateClock();
setInterval(updateClock, 1000);
