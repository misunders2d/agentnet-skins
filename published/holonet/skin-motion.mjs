// Original Holonet instrument motion. Content and controls are usable immediately.
export function consoleMotion(root) {
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const active = new Set(), targets = new WeakMap(), panels = new Map();
  let dead = false;
  function clearPanel(target) {
    const panel = panels.get(target);
    if (!panel) return;
    panels.delete(target);
    for (const animation of panel.animations) animation.cancel();
    for (const layer of panel.layers) layer.remove();
  }
  function cancel() {
    for (const target of [...panels.keys()]) clearPanel(target);
    for (const animation of active) animation.cancel();
    active.clear();
  }
  const changed = () => { if (media.matches) cancel(); };
  // close is queued: a previous close must not cancel a newly reopened panel.
  const closing = event => { if (event.newState === 'closed') clearPanel(event.target); };
  const closed = event => { if (!event.target.open) clearPanel(event.target); };
  media.addEventListener('change', changed);
  root.addEventListener('beforetoggle', closing, true);
  root.addEventListener('close', closed, true);
  function play(target, frames, options) {
    if (dead || media.matches || !target?.animate) return null;
    targets.get(target)?.cancel();
    const animation = target.animate(frames, options);
    targets.set(target, animation); active.add(animation);
    animation.finished.catch(() => {}).finally(() => {
      active.delete(animation);
      if (targets.get(target) === animation) targets.delete(target);
    });
    return animation;
  }
  return {
    acquire() {
      play(root.querySelector('.instrument-sweep'), [
        {transform:'translateX(-120%)',opacity:0},
        {opacity:.8,offset:.2},
        {transform:'translateX(600%)',opacity:0}
      ], {duration:520,easing:'cubic-bezier(.22,.65,.3,1)'});
    },
    panel(target) {
      clearPanel(target);
      if (dead || media.matches || !target?.animate) return;
      const layers = ['left','right'].map(side => {
        const layer = root.ownerDocument.createElement('span');
        layer.className = 'panel-shutter panel-shutter-' + side;
        layer.setAttribute('aria-hidden','true'); target.append(layer); return layer;
      });
      const animations = layers.map((layer,index) => play(layer, [
        {transform:'translateX(0)',opacity:.82},
        {transform:`translateX(${index ? '105%' : '-105%'})`,opacity:0}
      ], {duration:360,easing:'cubic-bezier(.25,.85,.25,1)'}));
      const panel = {layers,animations}; panels.set(target,panel);
      Promise.all(animations.map(a => a.finished.catch(() => {}))).then(() => {
        if (panels.get(target) === panel) clearPanel(target);
      });
    },
    stop() {
      dead = true; cancel();
      media.removeEventListener('change',changed);
      root.removeEventListener('beforetoggle',closing,true);
      root.removeEventListener('close',closed,true);
    }
  };
}
