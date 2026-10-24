/** Release oversized desktop panels into normal document flow; never scale their contents. */
export function mountPanelLayout(panel) {
  function update() {
    const desktop=matchMedia('(min-width:1100px)').matches;
    panel.classList.toggle('panel--flow',desktop&&panel.getBoundingClientRect().height>innerHeight-32);
  }
  const observer=new ResizeObserver(update);
  observer.observe(panel);
  window.addEventListener('resize',update);
  update();
  return {destroy(){observer.disconnect();window.removeEventListener('resize',update);}};
}
