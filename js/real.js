// Real recordings (Tatoeba, user CK, CC BY-NC-ND 3.0): "mirror a real speaker" items.
(function () {
  const R = { items: [], meta: null };
  R.ready = fetch("audio/real.json")
    .then((r) => (r.ok ? r.json() : null))
    .then((m) => { if (m) { R.meta = m; R.items = m.items; Coach.addReal(m.items); } })
    .catch(() => {});
  window.Real = R;
})();
