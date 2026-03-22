export function announce(msg: string) {
  const el = document.getElementById('mesh-announcements');
  if (!el) return;
  el.textContent = '';
  requestAnimationFrame(() => {
    el.textContent = msg;
  });
}
