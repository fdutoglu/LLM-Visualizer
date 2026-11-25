// Pure computations (no DOM): journey curve, label placement, color. Tests: test_geo.mjs
(function (root) {
  // Hermite curve; tangent = direction between neighboring stops, its length limited by the shorter neighboring piece (no overshoot or loops)
  function crom(P, t) {
    if (P.length < 2) return P[0];
    const n = P.length - 1, i = Math.max(0, Math.min(n - 1, Math.floor(t))), u = t - i, d = (a, b) => Math.hypot(P[b][0] - P[a][0], P[b][1] - P[a][1]);
    const tan = j => { if (j === 0 || j === n) return [0, 0]; const l = d(j - 1, j + 1) || 1, s = Math.min(d(j - 1, j), d(j, j + 1), l / 2); return [0, 1].map(k => (P[j + 1][k] - P[j - 1][k]) / l * s); };
    const m0 = tan(i), m1 = tan(i + 1), u2 = u * u, u3 = u2 * u;
    return [0, 1].map(k => (2 * u3 - 3 * u2 + 1) * P[i][k] + (u3 - 2 * u2 + u) * m0[k] + (3 * u2 - 2 * u3) * P[i + 1][k] + (u3 - u2) * m1[k]);
  }
  // fractional index of v in the increasing array a
  function jInv(a, v) { const n = a.length - 1; let lo = 0, hi = n; if (v <= a[0]) return 0; if (v >= a[n]) return n; while (hi - lo > 1) { const m = (lo + hi) >> 1; a[m] <= v ? lo = m : hi = m; } return lo + (v - a[lo]) / Math.max(a[hi] - a[lo], 1e-12); }
  const jAt = (a, x) => { const i = Math.min(a.length - 2, Math.floor(x)); return a[i] + (a[i + 1] - a[i]) * (x - i); };
  const JN = 40;
  function jArc(P) { const a = [0]; let p = crom(P, 0); for (let i = 1; i <= (P.length - 1) * JN; i++) { const r = crom(P, i / JN); a.push(a[i - 1] + Math.hypot(r[0] - p[0], r[1] - p[1])); p = r; } return a; }

  // Label placement. items: {x,y,w,h,r, pri, force, left?}. Writes: lx (left), ly (vertical middle), show.
  // Priority (pri) from high to low; force: with no free spot it goes where it overlaps least, otherwise it is hidden.
  function placeLabels(items, W, H, dots) {
    const put = [], hit = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    [...items].sort((a, b) => (b.pri || 0) - (a.pri || 0)).forEach(p => {
      const g = p.r + 3, w = p.w, h = p.h, R = [g, -h / 2], L = [-g - w, -h / 2], C = [...(p.left ? [L, R] : [R, L]), [-w / 2, -g - h], [-w / 2, g], [g * .7, -g - h * .6], [g * .7, g - h * .4], [-w - g * .7, -g - h * .6], [-w - g * .7, g - h * .4]];
      let best = null;
      C.forEach((c, n) => {
        const b = { x: p.x + c[0], y: p.y + c[1], w, h };
        if (W && (b.x < 2 || b.y < 2 || b.x + w > W - 2 || b.y + h > H - 2) && !(p.x < 0 || p.x > W || p.y < 0 || p.y > H)) { if (!p.force) return; b.out = 1; }
        const ov = put.reduce((s, q) => s + hit(b, q), 0);
        let dv = 0; (dots || []).forEach(q => { if (q !== p && q.x > b.x - 2 && q.x < b.x + w + 2 && q.y > b.y - 1 && q.y < b.y + h + 1) dv++; });
        const cost = ov * 10 + dv * 30 + n + (b.out ? 1e4 : 0);
        if (!best || cost < best.cost) best = { ...b, cost, ov };
      });
      p.lead = false;
      if (p.force && p.leader && best && best.ov >= .5) search: for (let d = 24; d <= 160; d += 12) for (let a = 0; a < 16; a++) { // no spot: nearest free place, with a leader line
        const cx = p.x + Math.cos(a * Math.PI / 8) * d, cy = p.y + Math.sin(a * Math.PI / 8) * d, b = { x: cx - w / 2, y: cy - h / 2, w, h };
        if (W && (b.x < 2 || b.y < 2 || b.x + w > W - 2 || b.y + h > H - 2)) continue;
        if (put.some(q => hit(b, q) > 0)) continue;
        best = { ...b, ov: 0, cost: 0 }; p.lead = true; break search;
      }
      p.show = !!best && (best.ov < .5 || !!p.force);
      if (best) { p.lx = best.x; p.ly = best.y + h / 2; }
      if (p.show) put.push(best);
    });
    return items;
  }
  function relaxLocal(P, rr, sep) {
    for (let it = 0; it < 60; it++) {
      for (let a = 0; a < P.length; a++) for (let b = a + 1; b < P.length; b++) {
        let dx = P[b].x - P[a].x, dy = P[b].y - P[a].y, d = Math.hypot(dx, dy);
        if (d < sep) { if (d < 1e-6) { dx = Math.cos(a * 2.4); dy = Math.sin(a * 2.4); d = 1; } const f = (sep - d) / 2 / d; P[a].x -= dx * f; P[a].y -= dy * f; P[b].x += dx * f; P[b].y += dy * f; }
      }
      P.forEach(p => { let r = Math.hypot(p.x, p.y); if (r < 1e-6) { p.x = 1; r = 1; } const lo = Math.min(8, rr * .3), t = Math.max(lo, Math.min(rr, r)); if (t !== r) { p.x *= t / r; p.y *= t / r; } });
    }
    return P;
  }
  function niceStep(raw) { const mag = Math.pow(10, Math.floor(Math.log10(raw))); return [1, 2, 5, 10].map(f => f * mag).find(v => v >= raw * (1 - 1e-9)) || raw; }
  const hexRGB = h => { h = h.trim().replace("#", ""); if (h.length === 3) h = h.replace(/./g, "$&$&"); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
  // t in [-1,1]: negative end - neutral - positive end
  function valColor(t, neutral, neg, pos) { const end = t < 0 ? neg : pos, a = Math.min(1, Math.abs(t)); return "rgb(" + neutral.map((n, i) => Math.round(n + (end[i] - n) * a)).join(",") + ")"; }
  function pairStats(a, b) {
    const N = a.length; let dot = 0, na = 0, nb = 0, sa = 0, sb = 0; for (let i = 0; i < N; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; sa += a[i]; sb += b[i]; }
    const ma = sa / N, mb = sb / N; let c = 0, va = 0, vb = 0; for (let i = 0; i < N; i++) { c += (a[i] - ma) * (b[i] - mb); va += (a[i] - ma) ** 2; vb += (b[i] - mb) ** 2; }
    return { cos: dot / Math.sqrt(na * nb), r: c / Math.sqrt(va * vb) };
  }
  const topDiff = (a, b, n) => Array.from(a, (_, i) => i).sort((i, j) => Math.abs(b[j] - a[j]) - Math.abs(b[i] - a[i])).slice(0, n);
  // z: direction scores, A: directions. First n rows by decreasing |z|, at the end where the word is; onlyOk: tested ends only. Rows with |z| < 1 are left out.
  const axisRows = (z, A, onlyOk, n) => A.map(a => ({ id: a.id, stab: a.stab, z: z[a.id], end: a.ends[z[a.id] < 0 ? 1 : 0] })).filter(r => Math.abs(r.z) >= 1 && (!onlyOk || r.end.ok)).sort((p, q) => Math.abs(q.z) - Math.abs(p.z) || p.id - q.id).slice(0, n);
  const api = { axisRows, crom, jInv, jAt, jArc, JN, placeLabels, relaxLocal, niceStep, hexRGB, valColor, pairStats, topDiff };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else Object.assign(root, api);
})(typeof window !== "undefined" ? window : globalThis);
