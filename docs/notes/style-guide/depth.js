// Local interaction specimens. No application data or persisted preferences.
const stage = document.getElementById('depth-stage');
const split = document.getElementById('depth-split');
const divider = document.getElementById('depth-divider');
const treatment = document.getElementById('depth-treatment');
const modal = document.getElementById('depth-modal');
const popover = document.getElementById('depth-popover');
const opener = document.getElementById('open-popover');
let fraction = 60;
let drag = null;
function applyDepth() {
  document.documentElement.dataset.depth = treatment.value;
  stage.dataset.depth = treatment.value;
  refresh();
  document.getElementById('depth-description').textContent = {
    flat: 'Borders and surface contrast · no shadows',
    subtle: 'Light panel shadows · recessed fields · floating overlays',
    raised: 'Raised panels · stronger overlay shadows',
    recessed: 'Inset panels · floating overlays stay raised'
  }[treatment.value];
}
function resizeSplit(value) {
  const narrow = matchMedia('(max-width: 640px)').matches;
  const available = split.getBoundingClientRect().width - divider.getBoundingClientRect().width;
  const minimum = narrow ? 30 : Math.max(30, Math.min(50, 240 / available * 100));
  const maximum = 100 - minimum;
  fraction = Math.min(maximum, Math.max(minimum, value));
  // Grid percentages resolve against the whole grid, including its divider.
  split.style.setProperty('--split', `calc((100% - var(--divider-width)) * ${fraction / 100})`);
  divider.setAttribute('aria-valuemin', Math.ceil(minimum));
  divider.setAttribute('aria-valuemax', Math.floor(maximum));
  divider.setAttribute('aria-valuenow', Math.round(fraction));
  divider.setAttribute('aria-valuetext', `${Math.round(fraction)} percent conversation`);
  document.getElementById('split-value').textContent = narrow ? 'Stacked panels · resizing off' : `Conversation ${Math.round(fraction)}% / Details ${Math.round(100 - fraction)}%`;
}
function finishDrag(cancel = false) {
  if (!drag) return;
  const previous = drag;
  drag = null;
  if (cancel) resizeSplit(previous.start);
  divider.classList.remove('dragging'); split.classList.remove('resizing');
  if (divider.hasPointerCapture(previous.id)) divider.releasePointerCapture(previous.id);
}
divider.addEventListener('pointerdown', event => {
  if (event.button !== 0 || matchMedia('(max-width: 640px)').matches) return;
  event.preventDefault(); divider.focus();
  drag = {id: event.pointerId, start: fraction};
  divider.setPointerCapture(event.pointerId);
  divider.classList.add('dragging'); split.classList.add('resizing');
});
divider.addEventListener('pointermove', event => {
  if (!drag || drag.id !== event.pointerId) return;
  const box = split.getBoundingClientRect();
  const gap = divider.getBoundingClientRect().width;
  resizeSplit((event.clientX - box.left - gap / 2) / (box.width - gap) * 100);
});
divider.addEventListener('pointerup', () => finishDrag());
divider.addEventListener('pointercancel', () => finishDrag(true));
divider.addEventListener('lostpointercapture', () => finishDrag(true));
divider.addEventListener('dblclick', () => resizeSplit(60));
divider.addEventListener('keydown', event => {
  if (event.key === 'Escape' && drag) { finishDrag(true); event.preventDefault(); return; }
  const step = event.shiftKey ? 10 : 2;
  const values = {ArrowLeft: fraction - step, ArrowRight: fraction + step, Home: 0, End: 100};
  if (event.key in values) { event.preventDefault(); resizeSplit(values[event.key]); }
});
function positionPopover() {
  if (!popover.matches(':popover-open')) return;
  const box = opener.getBoundingClientRect();
  const width = popover.offsetWidth, height = popover.offsetHeight;
  popover.style.left = `${Math.max(12, Math.min(box.right - width, innerWidth - width - 12))}px`;
  const below = box.bottom + 8;
  popover.style.top = `${Math.max(12, Math.min(below + height <= innerHeight - 12 ? below : box.top - height - 8, innerHeight - height - 12))}px`;
}
popover.addEventListener('toggle', positionPopover);
window.addEventListener('scroll', positionPopover, true);
window.addEventListener('resize', () => { finishDrag(true); resizeSplit(fraction); positionPopover(); });
treatment.addEventListener('change', applyDepth);
document.getElementById('reset-split').addEventListener('click', () => resizeSplit(60));
document.getElementById('open-modal').addEventListener('click', () => { if (popover.matches(':popover-open')) popover.hidePopover(); modal.showModal(); });
for (const id of ['close-modal','done-modal']) document.getElementById(id).addEventListener('click', () => modal.close());
document.getElementById('reset').addEventListener('click', () => { treatment.value = 'subtle'; applyDepth(); resizeSplit(60); });
new ResizeObserver(() => resizeSplit(fraction)).observe(divider);
applyDepth(); resizeSplit(fraction);

const glowEnabled = document.getElementById('glow-enabled');
const glowColor = document.getElementById('glow-color');
const glowStrength = document.getElementById('glow-strength');
function applyGlow() {
  const enabled = glowEnabled.checked;
  glowColor.disabled = !enabled; glowStrength.disabled = !enabled;
  const amount = enabled ? Number(glowStrength.value) : 0;
  const color = `color-mix(in srgb, ${glowColor.value} ${amount}%, transparent)`;
  document.documentElement.style.setProperty('--depth-glow', `0 0 18px 3px ${color}`);
  document.documentElement.style.setProperty('--recessed-glow', `inset 0 0 18px 3px ${color}`);
  document.getElementById('glow-value').textContent = glowStrength.value + '%';
  refresh();
}
for (const control of [glowEnabled, glowColor, glowStrength]) control.addEventListener('input', applyGlow);
document.getElementById('reset').addEventListener('click', () => {
  glowEnabled.checked = false; glowColor.value = '#7c5cff'; glowStrength.value = '30'; applyGlow();
});
applyGlow();
