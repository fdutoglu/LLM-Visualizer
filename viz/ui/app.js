"use strict";
// ───────── Views ─────────
const SYN = "<code>king</code> → <code>▁king</code> (token starting with a space, otherwise <code>king</code>) · <code>_King</code> → <code>▁King</code> · <code>=king</code> → token without the space · <code>#9615</code> → token number";
const G = {
  words: { label: "Words", def: "king, queen", ph: "Words separated by commas", ex: ["king, queen, man, woman", "Monday, Tuesday, Sunday", "red, green, blue"] },
  one: { label: "Single word", def: "king", ph: "A single word", ex: ["king", "Paris", "doctor", "green"] },
  sent: { label: "Sentence", def: "The largest planet in the solar system is", ph: "A sentence", ex: ["The largest planet in the solar system is", "The capital of France is", "She opened the door and"] }
};
const VIEWS = {
  line: { g: "words", in: "words", name: "Line", ic: "M2 13l4-7 3 5 3-8 4 9", d: "The 640 numbers of each word, in dimension order.", how: ["The horizontal axis is the dimension number (0–639), the vertical axis is the value in that dimension.", "Wheel or two fingers: zoom. Drag: pan. Double-click: reset.", "Hover a word in the list and the others fade."] },
  ring: { g: "words", in: "words", name: "Ring", ic: "M9 2a7 7 0 100 14A7 7 0 009 2zM9 6a3 3 0 100 6 3 3 0 000-6z", d: "The same values wrapped around a circle.", how: ["The angle is the dimension number: 0 at the top, clockwise.", "The radius is the value: the thick circle is zero, outside is positive, inside is negative."] },
  heat: { g: "words", in: "words", name: "Color ring", ic: "M9 2a7 7 0 107 7h-7zM12 2.5A7 7 0 0115.5 6H12z", d: "Each word is a band, each dimension a color.", how: ["The first word is the outermost band. The angle is the dimension number.", "Blue is negative, neutral is zero, red is positive. The scale follows the largest absolute value drawn."] },
  scatter: { g: "words", in: "words", name: "Scatter", ic: "M2 2v14h14M6 11h.01M9 8h.01M12 9h.01M13 5h.01M7 6h.01", d: "Compares two words dimension by dimension.", how: ["Each point is a dimension: A's value horizontally, B's value vertically.", "On the dashed line both words have the same value.", "Highlighted points are the 10 dimensions that differ most."] },
  bars: { g: "words", in: "words", name: "Differing dimensions", ic: "M3 16V8M7 16V4M11 16v-5M15 16V6", d: "The 24 dimensions where two words differ most.", how: ["The difference |A − B| decreases from left to right.", "Each pair of bars is the A and B value of the same dimension."] },
  axes: { g: "one", in: "one", name: "Axes", ic: "M2 9h14M9 2v14M4 4l10 10", d: "In which directions of meaning does the word stand out?", how: ["Each bar is an ICA direction. Its length is how many standard deviations (SD) the word is from the mean in that direction.", "A blue bar is an end that passed a test. A gray bar is an end that did not: its name is only the three most extreme words, its meaning is not proven.", "Tested end: the direction was found in three separate runs (stability &gt; 0.9) and passed either the intruder word test (≥ 90%, chance 20%) or the label test. 91 of the 640 directions are like this.", "Intruder word test: does a model independent of Gemma (BERT) find the unrelated word placed among 4 words from the end? English only.", "Plus and minus are arbitrary; the end that passed is written as plus. The directions come only from the input embedding and know nothing about the sentence context.", "ICA did not fully converge in 300 steps. That is why only stable directions count as tested.", "Click a bar or a direction in the list to see both of its ends. Click a token at an end to go to that word."] },
  nb: { g: "one", in: "one", name: "Nearest tokens", ic: "M9 9h.01M9 2v3M9 13v3M2 9h3M13 9h3M4 4l2 2M14 14l-2-2M14 4l-2 2M4 14l2-2", d: "The tokens nearest to a word.", how: ["Distance to the center = 1 − cosine (exact).", "The angle shows how close the neighbors are to each other (MDS, approximate).", "Click a token to make it the new center. Use the browser's back button to return."] },
  mid: { g: "one", in: "words", name: "In between", ic: "M9 2L2 15h14zM9 8v.01M8 11h.01M11 11h.01", d: "Tokens close to all of your words at once.", how: ["Your words (2–8) are at the corners, the tokens close to all of them are inside.", "The position is a cosine-weighted mix. Sharpness increases the difference between weights.", "Click a token to add it as a corner."] },
  ctx: { g: "sent", in: "sent", name: "Sentence focus", ic: "M2 5h14M2 9h9M2 13h12", d: "Each token as it enters the model and as it is at the last layer.", how: ["The green bubble is the embedding (input), the orange bubble is the last layer's output.", "The middle of a bubble is the point itself, inside are the nearest tokens: distance to the center = 1 − cosine (exact), angle by local MDS (approximate).", "The bubbles are placed relative to each other by global MDS and distances are proportional. Only their radii are reduced to fit.", "Click a green bubble to play the token layer by layer. Click an orange one to only select it.", "Wheel: zoom. Drag: pan. ← →: change token."] },
  journey: { g: "sent", in: "sent", name: "Journey: layers", ic: "M3 15c0-6 5-2 6-7s4-5 6-5M15 3h.01M3 15h.01", d: "The path of the last token through the 18 layers.", how: [] },
  jtoken: { g: "sent", in: "sent", name: "Journey: tokens", ic: "M2 13h3l2-6 3 8 2-5h4", d: "The path of the last layer's output as the sentence advances token by token.", how: [] }
};
VIEWS.journey.how = ["The map is fixed: the 20 nearest tokens of every layer and of the points in between. The path is traveled at constant speed.", "Blue: neighbors of the current point. Rings ≈ 1 − cosine − common part.", "Accuracy: how many of the true 20 neighbors are also among the nearest 20 on the map.", "Wheel: zoom. Drag: pan. Space: play/pause. ← →: change stop."];
VIEWS.jtoken.how = ["The stops are the last-layer output of each token in the sentence.", ...VIEWS.journey.how.map(s => s.replace("every layer", "every token's last-layer output"))];

// ───────── State ─────────
const $ = id => document.getElementById(id), cv = $("c"), ctx = cv.getContext("2d"), tip = $("tip"), qEl = $("q"), side = $("side");
const store = { get(k, d) { try { const v = localStorage.getItem("gv." + k); return v == null ? d : v; } catch { return d; } }, set(k, v) { try { localStorage.setItem("gv." + k, v); } catch { } } };
let view = "line", text = {}, hover = null, focusId = null, vw = { k: 1, x: 0, y: 0 }, W = 0, H = 0;
let words = [], nb = null, bw = null, cx_ = null, jn = null, busy = null, fail = null;
let ax = null, axAll = null, axCur = null, axSel = null, axDet = null, axErr = null, axSeq = 0, axFind = ""; const axArg = s => /^\d+$/.test(s || "") && +s < 640 ? +s : null;
let x0 = 0, x1 = 639, nK = 30, nKc = 12, pairSel = [null, null];
Object.keys(G).forEach(g => text[g] = store.get("t." + g, G[g].def));
const M = () => view, isJn = () => view === "journey" || view === "jtoken", isPlane = () => view === "nb" || view === "mid" || view === "ctx", canZoom = () => view === "line" || isJn() || isPlane();
const inG = () => VIEWS[view].in;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const tk = s => esc(s).replace(/^▁+/, m => `<span class="sp">${m}</span>`);
const fmt = (x, n = 3) => Number(x).toFixed(n).replace("-", "−");
const reduced = matchMedia("(prefers-reduced-motion:reduce)").matches;

// ───────── Theme ─────────
let TH = {};
function readTheme() { const s = getComputedStyle(document.documentElement), v = n => s.getPropertyValue("--" + n).trim(); TH = { fg: v("fg"), fg2: v("fg2"), mut: v("mut"), line: v("line"), axis: v("axis"), surf: v("surface"), acc: v("accent"), hot: v("hot"), neutral: v("neutral"), S: [1, 2, 3, 4, 5, 6, 7, 8].map(i => v("s" + i)) }; TH.CC = { e: TH.S[2], f: TH.S[1] }; }
const THEMES = { auto: "Theme: system", light: "Theme: light", dark: "Theme: dark" };
function setTheme(t) { store.set("theme", t); if (t === "auto") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t; $("theme").textContent = THEMES[t]; $("theme").dataset.t = t; readTheme(); renderSide(); redraw(); }
$("theme").onclick = () => { const k = Object.keys(THEMES); setTheme(k[(k.indexOf($("theme").dataset.t) + 1) % 3]); };
matchMedia("(prefers-color-scheme:dark)").addEventListener("change", () => setTheme($("theme").dataset.t));

// ───────── Navigation and address ─────────
(() => { let h = "", last = ""; Object.entries(VIEWS).forEach(([id, v]) => { if (v.g !== last) { h += `<div class="grp">${G[v.g].label}</div>`; last = v.g; } h += `<button class="tab" type="button" data-v="${id}"><svg viewBox="0 0 18 18" aria-hidden="true"><path d="${v.ic}"/></svg>${v.name}</button>`; }); $("theme").insertAdjacentHTML("beforebegin", h); })();
document.querySelectorAll(".tab").forEach(b => b.onclick = () => go(b.dataset.v, null, true));
function writeHash(push) { const h = "#" + new URLSearchParams({ m: view, q: text[inG()], ...(view === "axes" && axSel != null ? { a: axSel } : {}) }); if (h === location.hash) return; history[push ? "pushState" : "replaceState"](null, "", h); }
function readHash() { const p = new URLSearchParams(location.hash.slice(1)); return { m: p.get("m"), q: p.get("q"), a: p.get("a") }; }
addEventListener("popstate", () => { const s = readHash(); if (VIEWS[s.m]) { axSel = axArg(s.a); go(s.m, s.q, false); } });
function go(v, q, push) {
  const changed = v !== view; view = v; if (q != null) text[inG()] = q;
  if (changed) { hover = null; focusId = null; jplaying = false; vw = { k: 1, x: 0, y: 0 }; anim = null; }
  store.set("view", v); store.set("t." + inG(), text[inG()]);
  const V = VIEWS[v];
  document.querySelectorAll(".tab").forEach(b => { if (b.dataset.v === v) { b.setAttribute("aria-current", "page"); if (changed || push === undefined) b.scrollIntoView({ inline: "center", block: "nearest" }); } else b.removeAttribute("aria-current"); });
  $("title").textContent = V.name; $("desc").textContent = V.d; document.title = V.name + " · Gemma 3 Embedding";
  qEl.value = text[inG()]; qEl.placeholder = G[inG()].ph; qEl.setAttribute("aria-label", G[inG()].ph);
  document.querySelectorAll("[data-for]").forEach(e => e.hidden = !e.dataset.for.split(" ").includes(v));
  $("nk").max = v === "ctx" ? 12 : 100; $("nk").value = v === "ctx" ? nKc : nK;
  $("ex").innerHTML = "<span>Examples:</span>" + G[inG()].ex.map(e => `<button type="button">${esc(e)}</button>`).join("");
  $("ex").querySelectorAll("button").forEach(b => b.onclick = () => submit(b.textContent));
  $("zoom").hidden = !canZoom(); $("jfix").hidden = !isJn(); $("pj").hidden = !isJn(); $("pc").hidden = v !== "ctx";
  cv.style.touchAction = isJn() || isPlane() ? "none" : v === "line" ? "pan-y" : "auto";
  hideTip(); if (push !== undefined) writeHash(push); return load();
}
function submit(q, keep) { if (!keep) axSel = null; if (q != null) qEl.value = q; text[inG()] = qEl.value.trim(); return go(view, null, true); }
$("form").onsubmit = e => { e.preventDefault(); submit(); qEl.blur(); };

// ───────── Data ─────────
const cache = new Map(); let seq = 0, ctl = null, clock = 0;
async function api(path, params) {
  const url = "/api/" + path + "?" + new URLSearchParams(params); if (cache.has(url)) return cache.get(url);
  ctl = new AbortController(); let d; const r = await fetch(url, { signal: ctl.signal }); if (!r.ok) throw Error("Server error " + r.status); d = await r.json();
  if (!d.error) { cache.set(url, d); if (cache.size > 40) cache.delete(cache.keys().next().value); } return d;
}
async function load() {
  const my = ++seq, v = view, t = text[inG()].trim(), L = $("nasc").checked ? 1 : 0; if (ctl) ctl.abort(); clearInterval(clock);
  fail = null; hover = null; jplaying = false;
  if (!t) { busy = null; clearData(); done(); return; }
  busy = { t0: performance.now() }; const show = setTimeout(() => { if (my === seq && busy) { overlay(); clock = setInterval(overlay, 250); } }, 180);
  let d = null, er = null;
  try {
    if (VIEWS[v].in === "words" && v !== "mid") d = await api("word", { q: t });
    else if (v === "nb") d = await api("neighbors", { q: t.split(",")[0].trim(), k: nK, letters: L });
    else if (v === "axes") { if (!axAll) axAll = await api("axes", {}); d = await api("axes", { q: t.split(",")[0].trim() }); }
    else if (v === "mid") d = await api("between", { q: t, k: nK, letters: L, hide: $("nv").checked ? 1 : 0 });
    else if (v === "ctx") d = await api("ctx3", { q: t, layer: 1, k: nKc });
    else d = await api("journey", { q: t, k: 20, letters: L, ...(v === "jtoken" ? { by: "token" } : {}) });
  } catch (e) { er = e.name === "AbortError" ? null : e instanceof TypeError ? "Could not reach the server." : e.message; }
  clearTimeout(show); if (my !== seq) return;   // a late answer to an older request is ignored
  clearInterval(clock); busy = null; clearData();
  if (er || !d) fail = { msg: er || "No answer received.", retry: 1 }; else if (d.error) fail = { msg: d.error + (v === "nb" || v === "axes" ? ": " + t.split(",")[0] : "") };
  else if (v === "nb") nb = d; else if (v === "axes") { ax = d; axPick(axSel ?? (axRows(1)[0] || {}).id ?? null, false); } else if (v === "mid") bw = d; else if (v === "ctx") { cx_ = d; cstep = Math.min(cstep, d.steps.length - 1); anim = null; renderStrip(); }
  else if (isJn()) startJourney(d); else { words = d.slice(); assignColors(); if (!words.some(w => w.vec)) fail = { msg: words.map(w => w.query + ": not in the vocabulary").join(" · ") }; }
  done();
}
function clearData() { if (!isJn()) jn = null; else jn = null; nb = bw = cx_ = ax = null; words = []; }
function done() { overlay(); renderSide(); redraw(); }
function overlay() {
  const o = $("over"); let h = "";
  if (busy) { const s = Math.floor((performance.now() - busy.t0) / 1000); h = `<div class="spin"></div><p>Computing${s ? ` · ${s} s` : ""}</p>` + (VIEWS[view].in === "sent" && s >= 3 ? "<p>Long sentences take a while; the first time the model is loaded too.</p>" : ""); }
  else if (fail) h = `<strong>${esc(fail.msg)}</strong><p>${fail.retry ? "" : inG() === "sent" ? "" : "Check the spelling; upper and lower case matter."}</p>` + (fail.retry ? '<button class="btn" type="button" id="retry">Try again</button>' : "");
  else if (!text[inG()].trim()) h = `<strong>${inG() === "sent" ? "Type a sentence" : inG() === "one" ? "Type a word" : "Type words separated by commas"}</strong><p>Or pick one of the examples above.</p>`;
  else if ((view === "scatter" || view === "bars") && valid().length < 2) h = "<strong>Two words are required</strong><p>Add a second word above.</p>";
  o.innerHTML = h; o.hidden = !h; if ($("retry")) $("retry").onclick = load;
}
// Color belongs to the word: removing a word from the list does not recolor the others
const slot = new Map();
function assignColors() { const ids = words.filter(w => w.vec).map(w => w.id); [...slot.keys()].forEach(k => { if (!ids.includes(k)) slot.delete(k); }); ids.forEach(id => { if (slot.has(id)) return; const used = new Set(slot.values()); let s = 0; while (used.has(s)) s++; slot.set(id, s); }); }
const wcol = w => TH.S[(slot.get(w.id) || 0) % 8], wdash = w => (slot.get(w.id) || 0) >= 8 ? [5, 3] : [];
const valid = () => words.filter(w => w.vec);
function series() { const ok = valid(); return $("diff").checked && ok.length > 1 ? ok.slice(1).map(w => ({ ...w, token: w.token + " − " + ok[0].token, vec: w.vec.map((v, i) => v - ok[0].vec[i]) })) : ok; }
function pair() { const ok = valid(), A = ok.find(w => w.id === pairSel[0]) || ok[0], B = ok.find(w => w.id === pairSel[1] && w !== A) || ok.find(w => w !== A); return A && B ? [A, B] : []; }

// ───────── Drawing base ─────────
let raf = 0; const redraw = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(); }); };
const F = (n, b) => (b ? "600 " : "") + n + "px system-ui,sans-serif";
function txt(s, x, y, col, o = {}) { ctx.font = F(o.s || 12, o.b); ctx.textAlign = o.a || "left"; ctx.textBaseline = o.bl || "middle"; if (o.halo !== false) { ctx.lineWidth = 3; ctx.lineJoin = "round"; ctx.strokeStyle = TH.surf; ctx.strokeText(s, x, y); } ctx.fillStyle = col || TH.fg;
  const m = /▁+/.exec(s); if (!m) ctx.fillText(s, x, y); else { const w = t => ctx.measureText(t).width, X0 = o.a === "center" ? x - w(s) / 2 : o.a === "right" ? x - w(s) : x, a = s.slice(0, m.index), al = ctx.globalAlpha; ctx.textAlign = "left"; ctx.fillText(a, X0, y); ctx.fillText(s.slice(m.index + m[0].length), X0 + w(a + m[0]), y); ctx.globalAlpha = al * .35; ctx.fillText(m[0], X0 + w(a), y); ctx.globalAlpha = al; }
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; }
const lineTo = (a, b, c, d) => { ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke(); };
const dot = (x, y, r, col, ring) => { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = col; ctx.fill(); if (ring) { ctx.lineWidth = 2; ctx.strokeStyle = TH.surf; ctx.stroke(); } };
const mw = (s, n, b) => { ctx.font = F(n, b); return ctx.measureText(s).width; };
const PX = x => W / 2 + (x - W / 2) * vw.k + vw.x, PY = y => H / 2 + (y - H / 2) * vw.k + vw.y;
const DRAW = { line: drawLine, ring: drawRing, heat: drawHeat, scatter: drawScatter, bars: drawBars, axes: drawAxes, nb: drawNb, mid: drawMid, ctx: drawCtx, journey: drawJourney, jtoken: drawJourney };
function draw() {
  const dpr = devicePixelRatio || 1, r = cv.getBoundingClientRect(); W = r.width; H = r.height; if (!W) return;
  const pw = Math.round(W * dpr), ph = Math.round(H * dpr); if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H); ctx.globalAlpha = 1; ctx.setLineDash([]);
  if (!fail) DRAW[view]();
  $("wrap").classList.toggle("hz", canZoom()); cv.setAttribute("aria-label", VIEWS[view].name + ": " + text[inG()] + ". Values are in the side panel.");
}
new ResizeObserver(redraw).observe($("wrap"));

// ───────── Word views ─────────
const dimmed = w => focusId != null && focusId !== w.id;
function drawLine() {
  const S = series(); if (!S.length) return;
  const L = 54, R = 16, T = 58, B = 40, pw = W - L - R, ph = H - T - B; let lo = 0, hi = 0;
  S.forEach(w => { for (let i = Math.floor(x0); i <= Math.ceil(x1); i++) { lo = Math.min(lo, w.vec[i]); hi = Math.max(hi, w.vec[i]); } });
  if (hi === lo) { hi = .1; lo = -.1; } const pad = (hi - lo) * .08; lo -= pad; hi += pad;
  const X = i => L + (i - x0) / (x1 - x0) * pw, Y = v => T + (hi - v) / (hi - lo) * ph, st = niceStep((hi - lo) / 5), xs = Math.max(1, niceStep((x1 - x0) / Math.max(3, pw / 90)));
  ctx.lineWidth = 1; for (let v = Math.ceil(lo / st) * st; v <= hi; v += st) { ctx.strokeStyle = Math.abs(v) < st / 2 ? TH.axis : TH.line; lineTo(L, Y(v), W - R, Y(v)); txt(fmt(Math.abs(v) < st / 2 ? 0 : v, 2), L - 8, Y(v), TH.mut, { s: 11, a: "right", halo: false }); }
  for (let i = Math.ceil(x0 / xs) * xs; i <= x1; i += xs) txt(i, X(i), H - B + 14, TH.mut, { s: 11, a: "center", halo: false });
  txt("dimension", W - R, H - 10, TH.mut, { s: 11, a: "right", halo: false }); txt("value", 10, T - 14, TH.mut, { s: 11, halo: false });
  ctx.save(); ctx.beginPath(); ctx.rect(L, T, pw, ph); ctx.clip();
  [...S].sort((a, b) => (a.id === focusId) - (b.id === focusId)).forEach(w => {
    ctx.strokeStyle = wcol(w); ctx.globalAlpha = dimmed(w) ? .15 : 1; ctx.lineWidth = x1 - x0 > 250 ? 1.2 : 2; ctx.lineJoin = "round"; ctx.setLineDash(wdash(w)); ctx.beginPath();
    const a = Math.max(0, Math.floor(x0)), b = Math.min(639, Math.ceil(x1)); for (let i = a; i <= b; i++) i === a ? ctx.moveTo(X(i), Y(w.vec[i])) : ctx.lineTo(X(i), Y(w.vec[i])); ctx.stroke(); ctx.setLineDash([]);
    if (x1 - x0 < 120) for (let i = Math.ceil(x0); i <= x1; i++) dot(X(i), Y(w.vec[i]), 3, wcol(w));
  }); ctx.globalAlpha = 1;
  if (hover != null) { ctx.strokeStyle = TH.mut; ctx.lineWidth = 1; lineTo(X(hover), T, X(hover), T + ph); S.forEach(w => dot(X(hover), Y(w.vec[hover]), 4, wcol(w), 1)); }
  ctx.restore(); cv._m = { L, pw };
}
const ang = i => -Math.PI / 2 + i / 640 * 2 * Math.PI;
function ringTicks(cx, cy, r) { for (let i = 0; i < 640; i += 80) txt(i, cx + Math.cos(ang(i)) * r, cy + Math.sin(ang(i)) * r, TH.mut, { s: 11, a: "center", halo: false }); }
function drawRing() {
  const S = series(); if (!S.length) return; const cx = W / 2, cy = H / 2, Rm = Math.min(W, H) / 2 - 34, Rb = Rm * .62, Rs = Rm * .36; let vm = 0;
  S.forEach(w => w.vec.forEach(v => vm = Math.max(vm, Math.abs(v)))); vm = (vm || .1) * 1.05; const rad = v => Rb + v / vm * Rs;
  [-vm, -vm / 2, 0, vm / 2, vm].forEach(v => { ctx.lineWidth = v === 0 ? 2 : 1; ctx.strokeStyle = v === 0 ? TH.axis : TH.line; ctx.beginPath(); ctx.arc(cx, cy, rad(v), 0, 7); ctx.stroke(); });
  ctx.lineWidth = 1; ctx.strokeStyle = TH.line; for (let i = 0; i < 640; i += 80) lineTo(cx + Math.cos(ang(i)) * rad(-vm), cy + Math.sin(ang(i)) * rad(-vm), cx + Math.cos(ang(i)) * rad(vm), cy + Math.sin(ang(i)) * rad(vm)); ringTicks(cx, cy, rad(vm) + 16);
  S.forEach(w => { ctx.strokeStyle = wcol(w); ctx.globalAlpha = dimmed(w) ? .15 : 1; ctx.lineWidth = 1.3; ctx.setLineDash(wdash(w)); ctx.beginPath(); for (let i = 0; i <= 640; i++) { const j = i % 640, r = rad(w.vec[j]); ctx[i ? "lineTo" : "moveTo"](cx + Math.cos(ang(j)) * r, cy + Math.sin(ang(j)) * r); } ctx.stroke(); }); ctx.globalAlpha = 1; ctx.setLineDash([]);
  [-vm, 0, vm].forEach(v => txt(fmt(v, 2), cx + 4, cy - rad(v) + (v === vm ? 9 : -8), TH.fg2, { s: 11 }));
  if (hover != null) { const a = ang(hover), c = Math.cos(a), s = Math.sin(a); ctx.strokeStyle = TH.fg2; ctx.lineWidth = 1; lineTo(cx + c * rad(-vm), cy + s * rad(-vm), cx + c * rad(vm), cy + s * rad(vm)); S.forEach(w => dot(cx + c * rad(w.vec[hover]), cy + s * rad(w.vec[hover]), 4, wcol(w), 1)); }
  cv._ring = { cx, cy };
}
function drawHeat() {
  const S = series(); if (!S.length) return; const cx = W / 2, cy = H / 2, Ro = Math.min(W, H) / 2 - 34, Ri = Ro * .26; let vm = 0; S.forEach(w => w.vec.forEach(v => vm = Math.max(vm, Math.abs(v)))); vm = vm || .1;
  const neutral = hexRGB(TH.neutral), neg = hexRGB(TH.S[0]), pos = hexRGB(TH.S[7]), n = S.length, th = Math.min((Ro - Ri) / n, Ro * .2), half = Math.PI / 640 * 1.15;
  S.forEach((w, k) => { const r = Ro - th * (k + .5); ctx.lineWidth = Math.max(1, th - 2); ctx.globalAlpha = dimmed(w) ? .2 : 1; for (let i = 0; i < 640; i++) { ctx.strokeStyle = valColor(w.vec[i] / vm, neutral, neg, pos); ctx.beginPath(); ctx.arc(cx, cy, r, ang(i) - half, ang(i) + half); ctx.stroke(); } }); ctx.globalAlpha = 1;
  S.forEach((w, k) => txt(w.token, cx, cy - Ro + th * (k + .5), TH.fg, { s: 12, b: 1, a: "center" })); ringTicks(cx, cy, Ro + 16);
  if (hover != null) { const a = ang(hover); ctx.strokeStyle = TH.fg; ctx.lineWidth = 2; lineTo(cx + Math.cos(a) * (Ro - th * n), cy + Math.sin(a) * (Ro - th * n), cx + Math.cos(a) * (Ro + 5), cy + Math.sin(a) * (Ro + 5)); }
  const sw = Math.min(150, W * .36), bx = 16, by = H - 22; for (let i = 0; i < sw; i++) { ctx.fillStyle = valColor(i / (sw - 1) * 2 - 1, neutral, neg, pos); ctx.fillRect(bx + i, by, 1.2, 8); }
  txt(fmt(-vm, 2), bx, by - 9, TH.fg2, { s: 11 }); txt("0", bx + sw / 2, by - 9, TH.fg2, { s: 11, a: "center" }); txt(fmt(vm, 2), bx + sw, by - 9, TH.fg2, { s: 11, a: "right" }); cv._ring = { cx, cy };
}
function drawScatter() {
  const P = pair(); if (P.length < 2) return; const [A, B] = P, a = A.vec, b = B.vec, Lm = 58, Tm = 20, Bm = 46, sd = Math.min(W - Lm - 18, H - Tm - Bm), ox = Lm + (W - Lm - 18 - sd) / 2, oy = Tm + (H - Tm - Bm - sd) / 2;
  let m = 0; for (let i = 0; i < 640; i++) m = Math.max(m, Math.abs(a[i]), Math.abs(b[i])); m = (m || .1) * 1.08; const X = v => ox + (v + m) / (2 * m) * sd, Y = v => oy + (m - v) / (2 * m) * sd, st = niceStep(m / 2.5);
  ctx.lineWidth = 1; for (let v = Math.ceil(-m / st) * st; v <= m; v += st) { const z = Math.abs(v) < st / 2; ctx.strokeStyle = z ? TH.axis : TH.line; lineTo(ox, Y(v), ox + sd, Y(v)); lineTo(X(v), oy, X(v), oy + sd); txt(fmt(z ? 0 : v, 2), ox - 6, Y(v), TH.mut, { s: 11, a: "right", halo: false }); txt(fmt(z ? 0 : v, 2), X(v), oy + sd + 12, TH.mut, { s: 11, a: "center", halo: false }); }
  ctx.setLineDash([5, 4]); ctx.strokeStyle = TH.mut; lineTo(X(-m), Y(-m), X(m), Y(m)); ctx.setLineDash([]);
  const tp = topDiff(a, b, 10), set = new Set(tp); ctx.globalAlpha = .5; for (let i = 0; i < 640; i++) if (!set.has(i)) dot(X(a[i]), Y(b[i]), 2.6, TH.S[0]); ctx.globalAlpha = 1;
  const it = tp.map((i, n) => { dot(X(a[i]), Y(b[i]), 4.5, TH.S[7], 1); return { x: X(a[i]), y: Y(b[i]), r: 5, w: mw(i, 11), h: 13, pri: 10 - n, s: i }; }); placeLabels(it, W, H, it).forEach(p => p.show && txt(p.s, p.lx, p.ly, TH.fg, { s: 11 }));
  txt("A: " + A.token, ox + sd / 2, oy + sd + 31, TH.fg, { b: 1, a: "center" }); ctx.save(); ctx.translate(ox - 46, oy + sd / 2); ctx.rotate(-Math.PI / 2); txt("B: " + B.token, 0, 0, TH.fg, { b: 1, a: "center" }); ctx.restore();
  if (hover != null) { ctx.strokeStyle = TH.fg; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X(a[hover]), Y(b[hover]), 8, 0, 7); ctx.stroke(); } cv._sc = { X, Y, a, b, A, B };
}
function drawBars() {
  const P = pair(); if (P.length < 2) return; const [A, B] = P, a = A.vec, b = B.vec, N = 24, idx = topDiff(a, b, N), L = 54, T = 18, pw = W - L - 14, ph = H - T - 42; let m = 0; idx.forEach(i => m = Math.max(m, Math.abs(a[i]), Math.abs(b[i]))); m = (m || .1) * 1.1;
  const Y = v => T + (m - v) / (2 * m) * ph, gw = pw / N, bwd = Math.min(16, gw * .36), st = niceStep(m / 3); ctx.lineWidth = 1;
  if (hover != null) { ctx.fillStyle = TH.line; ctx.fillRect(L + hover * gw, T, gw, ph); }
  for (let v = Math.ceil(-m / st) * st; v <= m; v += st) { const z = Math.abs(v) < st / 2; ctx.strokeStyle = z ? TH.axis : TH.line; lineTo(L, Y(v), L + pw, Y(v)); txt(fmt(z ? 0 : v, 2), L - 8, Y(v), TH.mut, { s: 11, a: "right", halo: false }); }
  idx.forEach((i, k) => { const c = L + (k + .5) * gw; [[a, A, -bwd - 1], [b, B, 1]].forEach(([v, w, dx]) => { const h = Math.abs(Y(v[i]) - Y(0)), up = v[i] >= 0; ctx.fillStyle = wcol(w); ctx.beginPath(); ctx.roundRect(c + dx, up ? Y(0) - h : Y(0), bwd, h, up ? [3, 3, 0, 0] : [0, 0, 3, 3]); ctx.fill(); }); if (gw >= 24 || k % (gw >= 13 ? 2 : 3) === 0) txt(i, c, H - 29, TH.mut, { s: 11, a: "center", halo: false }); });
  txt("dimension", L + pw, H - 10, TH.mut, { s: 11, a: "right", halo: false }); cv._bar = { L, gw, idx, N, a, b, A, B };
}
// ───────── Axes ─────────
// axCur: the direction shown; axSel: the direction the user explicitly chose (written to the address)
const axLab = e => e.label ? e.label + " · " + e.words.slice(0, 3).join(", ") : e.name, pct = p => fmt(p * 100, p * 1000 % 10 ? 1 : 0) + "%";
const axRows = n => axisRows(ax.z, axAll, $("axok").checked, n);
async function axPick(id, user) {
  if (user) { axSel = id; writeHash(true); } axCur = id; axDet = axErr = null; if (id == null) return; const my = ++axSeq; renderSide(); redraw();
  try { const d = await api("axis", { d: id }); if (my !== axSeq) return; if (d.error) axErr = d.error; else axDet = d; } catch { if (my === axSeq) axErr = "Could not get the direction's details."; }
  if (my === axSeq) { renderSide(); redraw(); }
}
function drawAxes() {
  if (!ax) return; const T = 40, B = 36, small = W < 560, rh = small ? 36 : 30, n = Math.max(4, Math.floor((H - T - B) / rh)), R = axRows(n), L = small ? 14 : Math.min(300, W * .38), right = W - 52, mx = Math.max(4, ...R.map(r => Math.abs(r.z)));
  txt(ax.token, 14, 20, TH.fg, { s: 14, b: 1 });
  if (!$("axok").checked) { let lx = W - 14; [["not tested", TH.axis], ["tested end", TH.acc]].forEach(([s, c]) => { txt(s, lx, 20, TH.fg2, { s: 12, a: "right", halo: false }); lx -= mw(s, 12) + 10; dot(lx, 20, 4.5, c); lx -= 18; }); }
  const bh = small ? 8 : 16, step = niceStep(mx / 4), X = v => L + v / mx * (right - L), yb = T + R.length * rh;
  if (R.length) { for (let v = 0; v <= mx; v += step) { ctx.strokeStyle = v ? TH.line : TH.axis; ctx.lineWidth = 1; lineTo(X(v), T, X(v), yb); txt(fmt(v, step < 1 ? 1 : 0), X(v), yb + 12, TH.mut, { s: 11, a: "center", halo: false }); } txt("standard deviations", right, yb + 26, TH.mut, { s: 11, a: "right", halo: false }); }
  R.forEach((r, i) => { const y = T + i * rh, on = r.id === axCur; if (on || hover === i) { ctx.fillStyle = TH.line; ctx.globalAlpha = on ? 1 : .55; ctx.beginPath(); ctx.roundRect(6, y + 1, W - 12, rh - 2, 7); ctx.fill(); ctx.globalAlpha = 1; }
    const by = small ? y + 22 : y + (rh - bh) / 2, w = Math.max(2, Math.abs(r.z) / mx * (right - L)); ctx.fillStyle = r.end.ok ? TH.acc : TH.axis; ctx.beginPath(); ctx.roundRect(L, by, w, bh, [0, 4, 4, 0]); ctx.fill();
    let s = axLab(r.end), mxw = small ? W - 28 : L - 24; while (s.length > 4 && mw(s, 12, on) > mxw) s = s.replace(/…$/, "").slice(0, -1) + "…";
    txt(s, small ? L : L - 10, small ? y + 12 : y + rh / 2, TH.fg, { s: 12, b: on, a: small ? "left" : "right", halo: small && !on && hover !== i }); txt(fmt(Math.abs(r.z), 1), L + w + 6, by + bh / 2, TH.fg2, { s: 12, halo: false }); });
  if (!R.length) txt("Does not stand out at any tested end.", W / 2, H / 2, TH.fg2, { a: "center" });
  cv._ax = { T, rh, R };
}
function axSide() {
  let h = ""; const A = axCur == null ? null : axAll[axCur], z = A && ax.z[axCur], weak = Math.abs(z) < 1, k = z < 0 && !weak ? 1 : 0;
  if (A) { h += sec(`Direction ${axCur}`, `<dl class="kv"><dt>${tk(ax.token)}</dt><dd>${weak ? `does not stand out (${fmt(z, 1)} SD)` : `${fmt(Math.abs(z), 1)} SD at the ${k ? "minus" : "plus"} end`}</dd><dt>Stability</dt><dd>${fmt(A.stab, 2)}</dd></dl>`);
    if (axErr) h += `<p class="err">${esc(axErr)}</p>`;
    if (axDet) [k, 1 - k].forEach(i => { const e = axDet.ends[i], m = Math.abs(e.top[0][1]) || 1;
      h += sec(`${i ? "Minus" : "Plus"} end${e.label ? ": " + esc(e.label) : ""}`, `<dl class="kv"><dt>Intruder word (chance 20%)</dt><dd>${pct(e.intr)}</dd>${e.label ? `<dt>Label separation (AUC)</dt><dd>${fmt(e.auc, 2)}</dd><dt>Hits in the top ranks</dt><dd>${Math.round(e.prec * 100)}%</dd>` : ""}</dl><p class="wl">${e.words.map(esc).join(", ")}</p><div class="list">${e.top.slice(0, 12).map(t => row(tk(t[0]), fmt(Math.abs(t[1]), 1), Math.abs(t[1]) / m, e.ok ? null : "var(--axis)", `type="button" data-ref="${esc(t[2])}"`, "button")).join("")}</div>`, e.ok ? "tested" : "not tested"); }); }
  if (!ax.in) h += `<p class="wl">${tk(ax.token)} is not one of the tokens that were measured; its score was computed anyway.</p>`;
  return h;
}
const axListHtml = () => { const ok = axAll.filter(a => a.ends[0].ok).sort((a, b) => axLab(a.ends[0]).localeCompare(axLab(b.ends[0]), "en")); return sec("Tested directions", `<input id="axf" type="search" placeholder="Search" aria-label="Search directions" value="${esc(axFind)}"><div class="list">${ok.map(a => `<button type="button" class="li${a.id === axCur ? " on" : ""}" data-ax="${a.id}" data-s="${esc(axLab(a.ends[0]).toLowerCase())}"><i></i><span class="t">${esc(axLab(a.ends[0]))}</span><span class="num">${fmt(ax.z[a.id], 1)}</span></button>`).join("")}</div>`, ok.length + " directions · " + esc(ax.token)); };
function axFilter() { const q = axFind.trim().toLowerCase(); side.querySelectorAll("[data-ax]").forEach(e => e.hidden = !!q && !e.dataset.s.includes(q)); }
$("axok").onchange = () => { store.set("axok", $("axok").checked ? 1 : 0); if (ax && axSel == null) axPick((axRows(1)[0] || {}).id ?? null, false); redraw(); };
$("axok").checked = store.get("axok", "0") === "1";
// ───────── Neighbor views ─────────
function drawNb() {
  if (!nb) return; const cx = W / 2, cy = H / 2, Rm = Math.min(W, H) / 2 - 46, rx = Math.max(...nb.pts.map(p => p.r)) * 1.05 || 1, ox = PX(cx), oy = PY(cy);
  [.25, .5, .75, 1].forEach(f => { ctx.strokeStyle = TH.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(ox, oy, Rm * f * vw.k, 0, 7); ctx.stroke(); });
  nb.pts.forEach((p, i) => { p.px = PX(cx + Math.cos(p.ang) * p.r / rx * Rm); p.py = PY(cy + Math.sin(p.ang) * p.r / rx * Rm); });
  if (hover != null) { ctx.strokeStyle = TH.acc; ctx.lineWidth = 2; lineTo(ox, oy, nb.pts[hover].px, nb.pts[hover].py); }
  const it = nb.pts.map((p, i) => ({ x: p.px, y: p.py, r: i === hover ? 7 : 5, w: mw(p.token, 12), h: 15, pri: i === hover ? 99 : -i, force: i === hover, left: p.px < ox, s: p.token, i }));
  const ci = { x: ox, y: oy, r: 9, w: mw(nb.query.token, 14, 1), h: 18, pri: 1e3, force: 1, c: 1, s: nb.query.token }; placeLabels([...it, ci], W, H, [...it, ci]);
  it.forEach(p => { ctx.globalAlpha = .5 + .5 * (1 - nb.pts[p.i].r / rx); dot(p.x, p.y, p.r, TH.acc, 1); }); ctx.globalAlpha = 1; dot(ox, oy, 9, TH.hot, 1);
  [.25, .5, .75, 1].forEach(f => txt("cos " + fmt(1 - f * rx, 2), ox, oy - Rm * f * vw.k, TH.mut, { s: 11, a: "center" }));
  it.forEach(p => p.show && txt(p.s, p.lx, p.ly, p.i === hover ? TH.fg : TH.fg2, { b: p.i === hover })); txt(ci.s, ci.lx, ci.ly, TH.fg, { s: 14, b: 1 });
}
function drawMid() {
  if (!bw) return; const n = bw.anchors.length, cx = W / 2, cy = H / 2, Rc = n === 2 ? H / 2 - 84 : Math.min(W - 150, H - 168) / 2, T = +$("nt").value;
  const A = bw.anchors.map((a, j) => { const t = -Math.PI / 2 + 2 * Math.PI * j / n; return { ...a, x: PX(cx + Math.cos(t) * Rc), y: PY(cy + Math.sin(t) * Rc), t, c: TH.S[j % 8] }; });
  ctx.strokeStyle = TH.axis; ctx.lineWidth = 1; ctx.beginPath(); A.forEach((a, j) => j ? ctx.lineTo(a.x, a.y) : ctx.moveTo(a.x, a.y)); ctx.closePath(); ctx.stroke();
  bw.pts.forEach(p => { const m = Math.max(...p.cos), w = p.cos.map(c => Math.exp(T * (c - m))), s = w.reduce((x, y) => x + y, 0); p.w = w.map(x => x / s); p.px = p.py = 0; p.w.forEach((x, j) => { p.px += x * A[j].x; p.py += x * A[j].y; }); p.dom = p.w.indexOf(Math.max(...p.w)); });
  if (hover != null) { const p = bw.pts[hover]; p.w.forEach((x, j) => { ctx.strokeStyle = A[j].c; ctx.globalAlpha = .25 + .75 * x; ctx.lineWidth = 1 + 3 * x; lineTo(p.px, p.py, A[j].x, A[j].y); }); ctx.globalAlpha = 1; }
  const it = bw.pts.map((p, i) => ({ x: p.px, y: p.py, r: i === hover ? 7 : 5, w: mw(p.token, 12), h: 15, pri: i === hover ? 99 : -i, force: i === hover, s: p.token, i, c: A[p.dom].c }));
  const an = A.map(a => ({ x: a.x, y: a.y, r: 10, w: mw(a.token, 14, 1), h: 18, pri: 1e3, force: 1, s: a.token, c: a.c, left: Math.cos(a.t) < -.3 })); placeLabels([...it, ...an], W, H, [...it, ...an]);
  it.forEach(p => dot(p.x, p.y, p.r, p.c, 1)); an.forEach(p => dot(p.x, p.y, p.r, p.c, 1)); it.forEach(p => p.show && txt(p.s, p.lx, p.ly, p.i === hover ? TH.fg : TH.fg2, { b: p.i === hover })); an.forEach(p => txt(p.s, p.lx, p.ly, TH.fg, { s: 14, b: 1 }));
}
// ───────── Sentence focus ─────────
let cstep = 0, anim = null; const LAYMS = 450;
const PLAY = '<svg viewBox="0 0 16 16"><path d="M4 2l10 6-10 6z"/></svg>', PAUSE = '<svg viewBox="0 0 16 16"><path d="M3 2h4v12H3zM9 2h4v12H9z"/></svg>', AGAIN = '<svg viewBox="0 0 16 16"><path d="M8 2a6 6 0 105.7 4.2l-1.9.6A4 4 0 118 4v2.5L12.5 3 8-.5z"/></svg>';
function pickStep(i, play) { if (!cx_) return; cstep = Math.max(0, Math.min(cx_.steps.length - 1, i)); if (!play) anim = null; renderStrip(); renderSide(); redraw(); if (play) startTraj(cstep); }
function renderStrip() { const s = $("cstrip"); if (!cx_) { s.innerHTML = ""; return; } s.innerHTML = cx_.steps.map((p, i) => `<button type="button" aria-pressed="${i === cstep}">${esc(p.tok.replace(/^▁/, "") || p.tok)}</button>`).join(""); [...s.children].forEach((b, i) => b.onclick = () => pickStep(i)); const b = s.children[cstep]; s.scrollTo({ left: b.offsetLeft - s.clientWidth / 2 + b.offsetWidth / 2 }); $("cprev").disabled = cstep === 0; $("cnext").disabled = cstep === cx_.steps.length - 1; }
async function startTraj(i) { let t; const my = seq; try { t = await api("traj", { q: text.sent.trim(), t: i, k: nKc }); } catch { return; } if (my !== seq || t.error || view !== "ctx" || cstep !== i) return; anim = { i, tr: t, t0: performance.now(), done: false }; redraw(); }
$("cprev").onclick = () => pickStep(cstep - 1); $("cnext").onclick = () => pickStep(cstep + 1); $("ctplay").innerHTML = PLAY; $("ctplay").onclick = () => pickStep(cstep, true);
function layoutB(R) {
  const st = cx_.steps, pts = []; st.forEach((p, i) => ["e", "f"].forEach(k => pts.push({ i, k, v: p[k] }))); const xs = pts.map(p => p.v[0]), ys = pts.map(p => p.v[1]), a = Math.min(...xs), b = Math.max(...xs), c = Math.min(...ys), d = Math.max(...ys), px = R + 14, py = R + 26, sc = Math.min((W - 2 * px) / Math.max(b - a, 1e-6), (H - px - py) / Math.max(d - c, 1e-6));
  pts.forEach(p => { p.x = W / 2 + (p.v[0] - (a + b) / 2) * sc; p.y = (py + H - px) / 2 + (p.v[1] - (c + d) / 2) * sc; }); let md = 1e9; for (let i = 0; i < pts.length; i++) for (let j = 0; j < i; j++) md = Math.min(md, Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y));
  st.forEach(p => p.B = {}); pts.forEach(p => st[p.i].B[p.k] = { x: PX(p.x), y: PY(p.y), R: R * vw.k }); return 1.9 * R - md;
}
function arrowB(A, B, col, w) { const a = Math.atan2(B.y - A.y, B.x - A.x), d = Math.hypot(B.x - A.x, B.y - A.y); if (d < 2.1 * A.R) return; const c = Math.cos(a), s = Math.sin(a), x = B.x - c * B.R, y = B.y - s * B.R; ctx.strokeStyle = ctx.fillStyle = col; ctx.lineWidth = w; lineTo(A.x + c * A.R, A.y + s * A.R, x - c * 6, y - s * 6); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - c * 9 - s * 4.5, y - s * 9 + c * 4.5); ctx.lineTo(x - c * 9 + s * 4.5, y - s * 9 - c * 4.5); ctx.fill(); }
function drawCtx() {
  if (!cx_) return; const st = cx_.steps, KS = ["e", "f"], NK = { e: "nne", f: "nnf" }, sv = vw; vw = { k: 1, x: 0, y: 0 };
  let lo = 1, hi = Math.max(14, Math.min(W, H) / 2 - 20); for (let i = 0; i < 14; i++) { const m = (lo + hi) / 2; layoutB(m) <= 0 ? lo = m : hi = m; } vw = sv; const R = Math.max(lo, 14); layoutB(R);
  st.forEach((p, i) => { ctx.globalAlpha = i === cstep ? 1 : .35; arrowB(p.B.e, p.B.f, TH.CC.f, i === cstep ? 2.2 : 1.2); }); ctx.globalAlpha = 1;
  const lab = [];
  st.map((_, i) => i).sort((a, b) => (a === cstep) - (b === cstep)).forEach(i => KS.forEach(k => {
    const p = st[i], on = i === cstep, b = p.B[k], l = p[NK[k]], col = TH.CC[k], rmax = Math.max(...l.map(v => v[2]), 1e-3) * 1.05, rr = Math.max(b.R - 9, 6); if (b.x + b.R < -150 || b.x - b.R > W + 150 || b.y + b.R < -40 || b.y - b.R > H + 40) return;
    ctx.globalAlpha = on ? 1 : .55; ctx.beginPath(); ctx.arc(b.x, b.y, b.R, 0, 7); ctx.fillStyle = TH.surf; ctx.globalAlpha = on ? .85 : .5; ctx.fill(); ctx.globalAlpha = on ? .16 : .07; ctx.fillStyle = col; ctx.fill(); ctx.globalAlpha = on ? 1 : .5; ctx.strokeStyle = col; ctx.lineWidth = on ? 2.2 : 1.2; ctx.stroke();
    const A = k === "f" && anim && anim.i === i;
    if (A) drawTraj(b, rr, lab); else {
      const PP = relaxLocal(l.map(v => ({ x: Math.cos(v[3]) * v[2] / rmax * rr, y: Math.sin(v[3]) * v[2] / rmax * rr })), rr, on ? 15 : 8);
      l.forEach((v, j) => { const x = b.x + PP[j].x, y = b.y + PP[j].y; ctx.globalAlpha = on ? .4 : .2; ctx.strokeStyle = col; ctx.lineWidth = 1; lineTo(b.x, b.y, x, y); ctx.globalAlpha = on ? 1 : .6; dot(x, y, on ? 4 : 2.5, col); if ((on && b.R > 26) || b.R > 60) lab.push({ x, y, r: 4, s: v[0], z: 11, pri: (on ? 50 : 0) - j, col: on ? TH.fg : TH.fg2 }); });
      ctx.globalAlpha = on ? 1 : .7; ctx.fillStyle = col; ctx.beginPath(); if (k === "e") ctx.rect(b.x - 5, b.y - 5, 10, 10); else ctx.arc(b.x, b.y, 5, 0, 7); ctx.fill();
    } ctx.globalAlpha = 1;
    lab.push({ x: b.x, y: b.y - b.R - 4, r: 0, s: (i + 1) + " " + p.tok + (k === "f" ? " output" : ""), z: 12, b: 1, pri: on ? 200 : 100 - i, force: on, col: on ? TH.fg : TH.fg2, top: 1 });
  }));
  lab.forEach(p => { p.w = mw(p.s, p.z, p.b); p.h = p.z + 3; if (p.top) { p.y -= p.h / 2; p.r = -p.w / 2 - 3; } }); placeLabels(lab, W, H).forEach(p => p.show && txt(p.s, p.lx, p.ly, p.col, { s: p.z, b: p.b }));
  if (anim && !anim.done) redraw();
}
function drawTraj(b, rr, lab) {
  const t = anim.tr, n = t.layers.length - 1, L = reduced ? n : Math.min(n, (performance.now() - anim.t0) / LAYMS); if (L >= n) anim.done = true; let mr = 1e-6; t.fx.forEach(p => mr = Math.max(mr, Math.hypot(p[0], p[1]))); t.layers.forEach(l => mr = Math.max(mr, Math.hypot(l.p[0], l.p[1])));
  const sc = rr * .92 / mr; relaxLocal(t.fx.map(p => ({ x: p[0] * sc, y: p[1] * sc })), rr, 13).forEach((p, j) => { dot(b.x + p.x, b.y + p.y, 3.5, j === t.own ? TH.CC.e : TH.CC.f); lab.push({ x: b.x + p.x, y: b.y + p.y, r: 4, s: t.frame[j] + (j === t.own ? " (input)" : ""), z: 11, pri: 60 - j, col: TH.fg }); });
  const i0 = Math.floor(L), i1 = Math.min(n, i0 + 1), u = L - i0, s = u * u * (3 - 2 * u), pos = l => [b.x + t.layers[l].p[0] * sc, b.y + t.layers[l].p[1] * sc], a = pos(i0), c = pos(i1), cur = [a[0] + (c[0] - a[0]) * s, a[1] + (c[1] - a[1]) * s];
  ctx.strokeStyle = TH.CC.f; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(...pos(0)); for (let l = 1; l <= i0; l++) ctx.lineTo(...pos(l)); ctx.lineTo(...cur); ctx.stroke(); dot(cur[0], cur[1], 6, TH.surf); ctx.strokeStyle = TH.CC.f; ctx.lineWidth = 2.5; ctx.stroke();
  const ly = Math.round(L), tp = t.layers[ly].top[0]; lab.push({ x: b.x, y: b.y + b.R + 12, r: 0, s: "layer " + ly + "/" + n + " · nearest: " + tp[0] + " (" + fmt(tp[1]) + ")", z: 12, b: 1, pri: 300, force: 1, col: TH.fg, top: 1 });
}
// ───────── Journey ─────────
let jL = 0, jplaying = false, jlast = 0, jz = .35, jpan = [0, 0], jfix = false, jside = -1; const JSPEED = .08, jl = $("jl"), jBtn = $("jplay");
const jTs = () => jn.ts || (jn.ts = jn.layers.map(l => l.t)), jArcPos = () => jAt(jn.arc, jInv(jTs(), jL) * JN);
function jStep(dt) { const s = jArcPos() + dt * JSPEED * $("jsp").value; return s >= jn.arc[jn.arc.length - 1] ? jn.nl : jAt(jTs(), jInv(jn.arc, s) / JN); }
function startJourney(d) {
  jn = d; if (!jn.arc) jn.arc = jArc(jn.path); jl.max = jn.nl; jL = 0; jpan = [0, 0]; jside = -1; jn.lab = null;
  const b = jn.path.length > 1; ["jprev", "jnext", "jplay"].forEach(i => $(i).disabled = !b); jl.disabled = !b;
  const n = jn.nl, all = jn.seg || Array.from({ length: n + 1 }, (_, i) => i); let lastX = -99; const wd = $("jt").clientWidth || 600;
  $("jt").innerHTML = all.map((s, i) => ({ s: jn.seg ? s.replace(/^▁/, "") || s : i, i })).filter(o => { const x = n ? o.i / n * wd : 0, need = jn.seg ? Math.min(90, String(o.s).length * 6.5 + 14) : 22; if (o.i && x - lastX < need && o.i !== n) return 0; if (o.i === n && o.i && x - lastX < need * 1.3) return 0; lastX = x; return 1; }).map(o => `<button type="button" data-i="${o.i}" style="left:${n ? o.i / n * 100 : 0}%">${esc(o.s)}</button>`).join("");
  $("jt").querySelectorAll("button").forEach(x => x.onclick = () => seek(+x.dataset.i)); jPlay(b && !reduced);
}
function jPlay(on) { jplaying = on; jlast = performance.now(); jBtn.innerHTML = on ? PAUSE : jn && jL >= jn.nl && jn.nl ? AGAIN : PLAY; jBtn.setAttribute("aria-label", on ? "Pause" : "Play"); if (on) redraw(); }
function seek(v) { if (!jn) return; jL = Math.max(0, Math.min(jn.nl, v)); jPlay(false); redraw(); }
const toggleJ = () => { if (!jn || jn.path.length < 2) return; if (!jplaying && jL >= jn.nl) jL = 0; jPlay(!jplaying); };
jBtn.onclick = toggleJ; jl.oninput = () => seek(+jl.value); $("jprev").onclick = () => seek(Math.ceil(jL - 1e-6) - 1); $("jnext").onclick = () => seek(Math.floor(jL + 1e-6) + 1);
$("jfix").onclick = () => setFix(!jfix); function setFix(on) { jfix = on; jpan = [0, 0]; $("jfix").setAttribute("aria-pressed", on); if (on && jn) { const b = jBox(); jz = Math.max(.02, Math.min(6, jBase() / Math.min((W - 90) / b.w, (H - 120) / b.h))); } else jz = .35; redraw(); }
const jBase = () => Math.min(W, H - 16) / 2 - 46;
function jBox() { const a = [...jn.tx, ...jn.path], x = a.map(p => p[0]), y = a.map(p => p[1]), l = Math.min(...x), r = Math.max(...x), t = Math.min(...y), b = Math.max(...y); return { w: r - l || 1, h: b - t || 1, c: [(l + r) / 2, (t + b) / 2] }; }
const jName = () => { const T = Math.floor(jL + 1e-6); return !jn.seg ? jn.tok + " · layer " + fmt(jL, 1) + " / " + jn.nl : jL - T < .02 ? jn.seg[T] + " · " + (T + 1) + " / " + jn.seg.length : jn.seg[T] + " → " + jn.seg[T + 1]; };
const jName0 = T => jn.seg ? (T + 1) + " " + jn.seg[T] : "L" + T;
function jLabels(sc, act) { // the map moves rigidly: the layout is computed only when the scale or the set of neighbors changes, so labels do not jump during playback
  const key = sc + "|" + act.join(); if (jn.lab && jn.lab.key === key) return jn.lab.it; const A = new Set(act); const it = jn.tx.map((p, k) => ({ x: p[0] * sc, y: p[1] * sc, r: 4, w: mw(jn.tokens[k], 12), h: 15, pri: (A.has(k) ? 1e4 : 0) + jn.layers.reduce((s, l) => s + (l.t % 1 === 0 ? l.m[k] : 0), 0), force: A.has(k), leader: A.has(k), k })); jn.path.forEach((p, l) => { const T = jn.layers[l].t; if (T === Math.round(T)) it.push({ x: p[0] * sc, y: p[1] * sc, r: 4, w: mw(jName0(T), 11, 1), h: 14, pri: 1e5 - T, stop: l }); }); placeLabels(it, 0, 0, it); it.forEach(p => { p.dx = p.lx - p.x; p.dy = p.ly - p.y; }); jn.lab = { key, it }; return it;
}
function drawJourney() {
  if (!jn || !jn.path) return; const now = performance.now(); if (jplaying) { jL = jStep((now - jlast) / 1000); jlast = now; if (jL >= jn.nl) jPlay(false); } jl.value = jL; jl.setAttribute("aria-valuetext", jName());
  const Ls = jn.layers, PA = jn.path, nS = PA.length - 1, tau = jInv(jTs(), jL), pos = crom(PA, tau), sc = jBase() / jz, cam = jfix ? jBox().c : pos, sx = x => W / 2 + jpan[0] + (x - cam[0]) * sc, sy = y => H / 2 + jpan[1] + (y - cam[1]) * sc, cx = sx(pos[0]), cy = sy(pos[1]), i0 = Math.max(0, Math.min(Math.floor(tau), nS - 1)), i1 = Math.min(i0 + 1, nS), u = tau - i0;
  const g = niceStep(jz / 3); ctx.lineWidth = 1; for (let r = g, c = 0; r * sc < Math.hypot(W, H) && c < 40; r += g, c++) { ctx.lineWidth = 1; ctx.strokeStyle = TH.line; ctx.beginPath(); ctx.arc(cx, cy, r * sc, 0, 7); ctx.stroke(); txt(String(+r.toFixed(4)), cx + r * sc + 4, cy, TH.mut, { s: 10 }); }
  const lb = jLabels(sc, jn.tx.map((_, k) => k).filter(k => Ls[i0].m[k] + (Ls[i1].m[k] - Ls[i0].m[k]) * u > .4)), items = []; jn.tx.forEach((p, k) => { const x = sx(p[0]), y = sy(p[1]); if (x < -90 || x > W + 90 || y < -20 || y > H + 20) return; items.push({ k, x, y, al: Ls[i0].m[k] + (Ls[i1].m[k] - Ls[i0].m[k]) * u }); }); items.sort((a, b) => a.al - b.al); cv._j = items;
  items.forEach(p => { ctx.globalAlpha = .35 + .65 * p.al; dot(p.x, p.y, p.al > .5 ? 4.5 : 2.5, p.al > .5 ? TH.acc : TH.mut); }); ctx.globalAlpha = 1;
  const seg = (a, b) => { ctx.beginPath(); for (let t = a; t <= b + 1e-9; t += .1) { const p = crom(PA, Math.min(t, b)); ctx[t === a ? "moveTo" : "lineTo"](sx(p[0]), sy(p[1])); } ctx.stroke(); };
  ctx.lineWidth = 2; ctx.strokeStyle = TH.hot; ctx.globalAlpha = .4; ctx.setLineDash([4, 5]); if (tau < nS) seg(tau, nS); ctx.globalAlpha = 1; ctx.setLineDash([]); ctx.lineWidth = 2.5; if (tau > 0) seg(0, tau);
  PA.forEach((p, l) => { const x = sx(p[0]), y = sy(p[1]), T = Ls[l].t, K = T === Math.round(T); ctx.globalAlpha = l <= tau ? 1 : .45; dot(x, y, K ? 4 : 1.5, TH.hot, K); ctx.globalAlpha = 1; });
  items.forEach(p => { const l = lb[p.k], hv = p.k === hover; if (!(hv || p.al > .4 || l.show)) return; ctx.globalAlpha = hv ? 1 : p.al < .4 ? .5 : 1; if (l.lead) { ctx.strokeStyle = TH.acc; ctx.lineWidth = 1; lineTo(p.x, p.y, p.x + l.dx + l.w / 2, p.y + l.dy); } txt(jn.tokens[p.k], p.x + l.dx, p.y + l.dy, hv || p.al > .5 ? TH.fg : TH.fg2, { b: hv }); }); ctx.globalAlpha = 1;
  lb.forEach(l => { if (l.stop == null || !l.show) return; const p = PA[l.stop], x = sx(p[0]), y = sy(p[1]), T = Ls[l.stop].t; if (Math.hypot(x - cx, y - cy) > 14) txt(jName0(T), x + l.dx, y + l.dy, l.stop <= tau ? TH.hot : TH.mut, { s: 11, b: 1 }); });
  dot(cx, cy, 9, TH.hot, 1); const nm = jName(), nw = mw(nm, 13, 1) + 18; ctx.fillStyle = TH.surf; ctx.strokeStyle = TH.hot; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(14, H - 42, nw + 14, 28, 8); ctx.fill(); ctx.stroke(); dot(27, H - 28, 4.5, TH.hot); txt(nm, 38, H - 28, TH.fg, { s: 13, b: 1, halo: false });
  $("jt").querySelectorAll("button").forEach(b => b.classList.toggle("on", +b.dataset.i === Math.round(jL))); const L = Math.min(nS, Math.round(tau)); if (L !== jside) { jside = L; renderSide(); } if (jplaying) redraw();
}
// ───────── Side panel ─────────
const row = (t, v, f, c, at = "", tag = "div") => `<${tag} class="li" ${at} style="--c:${c || "var(--accent)"}"><i></i><span class="t">${t}</span><span class="num">${v}</span>${f == null ? "" : `<span class="bar"><u style="width:${Math.max(0, Math.min(100, f * 100))}%"></u></span>`}</${tag}>`;
const nnList = (l, c) => `<div class="list">${l.map(x => row(tk(x[0]), fmt(x[1]), x[1], c)).join("")}</div>`;
const sec = (h, b, s) => `<section><h2>${h}${s ? `<small>${s}</small>` : ""}</h2>${b}</section>`;
function renderSide() {
  let h = ""; const ok = !busy && !fail;
  if (ok && words.length) {
    const V = valid(), dm = $("diff").checked && V.length > 1 && !$("diff").parentNode.hidden;
    h += sec("Words", `<div class="list">${words.map((w, i) => `<div class="li" data-w="${w.vec ? w.id : ""}" style="--c:${w.vec ? wcol(w) : "var(--err)"}"><i></i><span class="t">${w.vec ? tk(w.token) + (dm && w === V[0] ? " <span class='sp'>(subtracted)</span>" : "") : `<span class="err">${esc(w.query)}: not in the vocabulary</span>`}</span><span class="num">${w.vec ? "#" + w.id : ""}<button class="x" type="button" data-x="${i}" aria-label="Remove ${esc(w.query)}">×</button></span></div>`).join("")}</div>`);
    const P = pair(); if ((view === "scatter" || view === "bars") && P.length) {
      const opt = (p, n) => `<select data-p="${n}" aria-label="Word ${n ? "B" : "A"}">${V.map(w => `<option value="${w.id}" ${w === p ? "selected" : ""}>${esc(w.token)}</option>`).join("")}</select>`, s = pairStats(P[0].vec, P[1].vec);
      if (V.length > 2) h += sec("Compare", `<dl class="kv"><dt>A</dt><dd>${opt(P[0], 0)}</dd><dt>B</dt><dd>${opt(P[1], 1)}</dd></dl>`);
      h += sec("Similarity", `<dl class="kv"><dt>Cosine</dt><dd>${fmt(s.cos)}</dd><dt>Pearson r</dt><dd>${fmt(s.r)}</dd></dl>`);
      h += sec("Most differing dimensions", `<div class="list">${topDiff(P[0].vec, P[1].vec, 10).map((i, k) => row("dimension " + i, fmt(P[1].vec[i] - P[0].vec[i]), null, "var(--s8)", `data-h="${view === "bars" ? k : i}"`)).join("")}</div>`, "B − A");
    }
  }
  if (ok && nb) h += sec("Nearest " + nb.pts.length + " tokens", `<div class="list">${nb.pts.map((p, i) => row(tk(p.token), fmt(p.cos), p.cos, null, `type="button" data-h="${i}"`, "button")).join("")}</div>`, "cosine");
  if (ok && bw) h += sec("Corners", `<div class="list">${bw.anchors.map((a, j) => row(tk(a.token), `#${a.id}<button class="x" type="button" data-x="${j}" aria-label="Remove ${esc(a.token)}" ${bw.anchors.length < 3 ? "hidden" : ""}>×</button>`, null, TH.S[j % 8])).join("")}</div>`) + sec(bw.pts.length + " tokens in between", `<div class="list">${bw.pts.map((p, i) => row(tk(p.token), fmt(p.cos.reduce((a, b) => a + b, 0) / p.cos.length), null, TH.S[p.cos.indexOf(Math.max(...p.cos)) % 8], `type="button" data-h="${i}" ${bw.anchors.length >= 8 ? "disabled" : ""}`, "button")).join("")}</div>`, "mean cosine");
  if (ok && cx_) { const s = cx_.steps[cstep], d = Math.hypot(s.e[0] - s.f[0], s.e[1] - s.f[1]); h += sec(`<span>${tk(s.tok)}</span>`, `<dl class="kv"><dt>Cosine, input → output</dt><dd>${fmt(s.cef)}</dd><dt>Distance (1 − cosine)</dt><dd>${fmt(s.def)}</dd><dt>Distance on the map</dt><dd>${fmt(d)}</dd><dt>Vector length, input</dt><dd>${fmt(s.ne, 1)}</dd><dt>Vector length, output</dt><dd>${fmt(s.nf, 1)}</dd><dt>Map stress</dt><dd>${fmt(cx_.stress)}</dd></dl>`, (cstep + 1) + " / " + cx_.steps.length) + sec("Nearest to the output", nnList(s.nnf, "var(--s2)"), "last layer") + sec("Nearest to the input", nnList(s.nne, "var(--s3)"), "embedding"); }
  if (ok && jn && jn.layers) { const l = jn.layers[Math.max(0, Math.min(jn.layers.length - 1, Math.round(jInv(jTs(), jL))))]; h += sec("Nearest now", nnList(l.top, null), "cosine") + sec("Position", `<dl class="kv"><dt>Cosine to the input token</dt><dd>${fmt(l.own)}</dd><dt>Map accuracy</dt><dd>${Math.round(l.prec * 100)}%</dd><dt>Common part</dt><dd>${fmt(l.h)}</dd></dl>`) + sec("Legend", `<div class="key"><span style="--c:var(--hot)"><i></i>Current point and stops</span><span style="--c:var(--hot)"><i class="ds"></i>Path ahead</span><span><i></i>Current neighbors</span><span style="--c:var(--mut)"><i></i>Neighbors of other stops and points in between</span></div>`); }
  if (ok && cx_) h += sec("Legend", `<div class="key"><span style="--c:var(--s3)"><i class="sq"></i>Embedding (input)</span><span style="--c:var(--s2)"><i></i>Last layer's output</span></div>`);
  if (ok && ax && axAll) h += axSide();
  const open = side.querySelector("details") ? side.querySelector("details").open : innerWidth > 900; h += `<details ${open ? "open" : ""}><summary>How to read this view</summary><ul>${VIEWS[view].how.map(s => `<li>${s}</li>`).join("")}${inG() !== "sent" ? `<li>Spelling: ${SYN}</li>` : ""}<li><kbd>/</kbd> goes to the text box.${canZoom() ? " <kbd>+</kbd> <kbd>−</kbd> zoom, <kbd>0</kbd> resets." : ""}</li></ul></details>`;
  if (ok && ax && axAll) h += axListHtml();
  side.innerHTML = h;
  if ($("axf")) { axFilter(); $("axf").oninput = e => { axFind = e.target.value; axFilter(); }; }
  side.querySelectorAll("[data-ax]").forEach(e => e.onclick = () => { axPick(+e.dataset.ax, true); side.scrollTo({ top: 0 }); if (innerWidth <= 900) side.scrollIntoView({ block: "start" }); });
  side.querySelectorAll("[data-ref]").forEach(e => e.onclick = () => { axSel = axCur; submit(e.dataset.ref, true); });
  side.querySelectorAll("[data-w]").forEach(e => { e.onmouseenter = () => { focusId = e.dataset.w ? +e.dataset.w : null; redraw(); }; e.onmouseleave = () => { focusId = null; redraw(); }; });
  side.querySelectorAll("[data-x]").forEach(e => e.onclick = ev => { ev.stopPropagation(); const q = text.words.split(",").filter(s => s.trim()); if (view === "mid") q.splice(0, q.length, ...bw.anchors.map(a => a.ref)); q.splice(+e.dataset.x, 1); focusId = null; submit(q.map(s => s.trim()).join(", ")); });
  side.querySelectorAll("[data-h]").forEach(e => { e.onmouseenter = e.onfocus = () => { hover = +e.dataset.h; redraw(); }; e.onmouseleave = e.onblur = () => { hover = null; redraw(); }; if (e.tagName === "BUTTON") e.onclick = () => choose(+e.dataset.h); });
  side.querySelectorAll("[data-p]").forEach(e => e.onchange = () => { const n = +e.dataset.p, P = pair().map(w => w.id), v = +e.value; if (P[1 - n] === v) P[1 - n] = P[n]; P[n] = v; pairSel = P; renderSide(); redraw(); });
}
function markRow(scroll) { side.querySelectorAll("[data-h]").forEach(e => { const on = hover != null && +e.dataset.h === hover; e.classList.toggle("on", on); if (on && scroll && innerWidth > 900) e.scrollIntoView({ block: "nearest" }); }); }
function choose(i) { if (view === "nb" && nb) submit(nb.pts[i].ref); else if (view === "mid" && bw && bw.anchors.length < 8) submit(text.words.trim().replace(/,\s*$/, "") + ", " + bw.pts[i].ref); }
// ───────── Mouse, touch, keyboard ─────────
function showTip(x, y, head, rows) { tip.innerHTML = `<b>${head}</b>` + rows.map(r => `<div><span>${r[0]}</span><span>${r[1]}</span></div>`).join(""); tip.hidden = false; const w = tip.offsetWidth, h = tip.offsetHeight; tip.style.left = Math.max(6, x + 16 + w > W - 6 ? x - w - 14 : x + 16) + "px"; tip.style.top = Math.max(6, Math.min(H - h - 6, y - h / 2)) + "px"; }
const hideTip = () => tip.hidden = true;
const near = (arr, x, y, X, Y, d = 16) => { let b = null; arr.forEach((p, i) => { const q = Math.hypot(X(p) - x, Y(p) - y); if (q < d) { d = q; b = i; } }); return b; };
const vals = (S, i) => S.map(w => [`<i style="color:${wcol(w)}">●</i> ` + tk(w.token), fmt(w.vec[i], 4)]);
function onHover(x, y) {
  const old = hover; let t = null; cv.style.cursor = "default"; if (busy || fail) return;
  if (view === "line" && cv._m && words.length) { const i = Math.round(x0 + (x - cv._m.L) / cv._m.pw * (x1 - x0)); hover = i < 0 || i > 639 || x < cv._m.L ? null : i; if (hover != null) t = ["dimension " + i, vals(series(), i)]; cv.style.cursor = "crosshair"; }
  else if ((view === "ring" || view === "heat") && cv._ring && words.length) { let a = Math.atan2(y - cv._ring.cy, x - cv._ring.cx) + Math.PI / 2; if (a < 0) a += 2 * Math.PI; hover = Math.round(a / (2 * Math.PI) * 640) % 640; t = ["dimension " + hover, vals(series(), hover)]; }
  else if ((view === "scatter" && cv._sc || view === "bars" && cv._bar) && pair().length) { const s = view === "scatter" ? cv._sc : cv._bar; let i = null; if (view === "scatter") hover = i = near(Array.from(s.a, (_, k) => k), x, y, k => s.X(s.a[k]), k => s.Y(s.b[k])); else { const k = Math.floor((x - s.L) / s.gw); hover = k >= 0 && k < s.N ? k : null; if (hover != null) i = s.idx[k]; } if (i != null) t = ["dimension " + i, [...vals([s.A, s.B], i), ["difference (B − A)", fmt(s.b[i] - s.a[i], 4)]]]; }
  else if (view === "axes" && ax && cv._ax) { const i = Math.floor((y - cv._ax.T) / cv._ax.rh), r = cv._ax.R[i]; hover = r ? i : null; if (r) { cv.style.cursor = "pointer"; t = [esc(axLab(r.end)), [["direction", r.id], [r.z < 0 ? "minus end" : "plus end", fmt(Math.abs(r.z), 2) + " SD"], ["intruder word", pct(r.end.intr)], ["stability", fmt(r.stab, 2)]]]; } }
  else if (view === "nb" && nb) { hover = near(nb.pts, x, y, p => p.px, p => p.py); if (hover != null) { const p = nb.pts[hover]; cv.style.cursor = "pointer"; t = [tk(p.token), [["cosine", fmt(p.cos)], ["distance", fmt(p.r)], ["token", "#" + p.id]]]; } else cv.style.cursor = "grab"; }
  else if (view === "mid" && bw) { hover = near(bw.pts, x, y, p => p.px, p => p.py); if (hover != null) { const p = bw.pts[hover]; cv.style.cursor = "pointer"; t = [tk(p.token), [...bw.anchors.map((a, j) => [`<i style="color:${TH.S[j % 8]}">●</i> ` + tk(a.token), fmt(p.cos[j])]), ["token", "#" + p.id]]]; } else cv.style.cursor = "grab"; }
  else if (view === "ctx" && cx_) { let b = null, bd = 1e9; cx_.steps.forEach((p, i) => p.B && ["e", "f"].forEach(k => { const d = Math.hypot(p.B[k].x - x, p.B[k].y - y); if (d < p.B[k].R && d < bd) { bd = d; b = { i, k }; } })); cv._hc = b; cv.style.cursor = b ? "pointer" : "grab"; if (b && b.i !== cstep) { const s = cx_.steps[b.i]; t = [tk(s.tok) + (b.k === "f" ? " · output" : " · input"), s[b.k === "f" ? "nnf" : "nne"].slice(0, 4).map(v => [tk(v[0]), fmt(v[1])])]; } }
  else if (isJn() && jn && cv._j) { cv.style.cursor = "grab"; const b = near(cv._j, x, y, p => p.x, p => p.y); hover = b == null ? null : cv._j[b].k; if (b != null) { const p = crom(jn.path, jInv(jTs(), jL)), k = hover, L = jn.layers[jside] || jn.layers[0], tp = L.top.find(v => v[0] === jn.tokens[k]); t = [tk(jn.tokens[k]), [["distance on the map", fmt(Math.hypot(jn.tx[k][0] - p[0], jn.tx[k][1] - p[1]))], ...(tp ? [["cosine", fmt(tp[1])]] : []), ["among the 20 nearest", L.m[k] ? "yes" : "no"]]]; } }
  t ? showTip(x, y, t[0], t[1]) : hideTip(); if (old !== hover) { markRow(1); redraw(); }
}
function zoomAt(f, x, y) {
  if (view === "line") { if (!cv._m) return; const c = x0 + (x - cv._m.L) / cv._m.pw * (x1 - x0); let a = c - (c - x0) / f, b = c + (x1 - c) / f; a = Math.max(0, a); b = Math.min(639, b); if (b - a < 8) return; x0 = a; x1 = b; }
  else if (isJn()) { const o = jz; jz = Math.max(.02, Math.min(6, jz / f)); jpan = jpan.map(v => v * o / jz); }
  else if (isPlane()) { const k = Math.max(.6, Math.min(14, vw.k * f)), g = k / vw.k; vw = { k, x: (x - W / 2) * (1 - g) + vw.x * g, y: (y - H / 2) * (1 - g) + vw.y * g }; } else return;
  hideTip(); redraw();
}
function panBy(dx, dy) { if (view === "line") { const d = dx / cv._m.pw * (x1 - x0); let a = x0 - d, b = x1 - d; if (a < 0) { b -= a; a = 0; } if (b > 639) { a -= b - 639; b = 639; } x0 = a; x1 = b; } else if (isJn()) jpan = [jpan[0] + dx, jpan[1] + dy]; else if (isPlane()) vw = { ...vw, x: vw.x + dx, y: vw.y + dy }; else return; hideTip(); redraw(); }
const zc = f => { const B = view === "ctx" && cx_ && cx_.steps[cstep].B, b = B && (B.f.x > 0 && B.f.x < W && B.f.y > 0 && B.f.y < H ? B.f : B.e.x > 0 && B.e.x < W && B.e.y > 0 && B.e.y < H ? B.e : null); zoomAt(f, b ? b.x : W / 2, b ? b.y : H / 2); };
function resetView() { x0 = 0; x1 = 639; vw = { k: 1, x: 0, y: 0 }; if (isJn()) setFix(false); redraw(); }
const ptr = new Map(); let moved = 0, pinch = 0; const at = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
cv.onpointerdown = e => { if (e.button) return; try { cv.setPointerCapture(e.pointerId); } catch { } ptr.set(e.pointerId, at(e)); if (ptr.size === 1) moved = 0; pinch = 0; };
cv.onpointermove = e => {
  const p = at(e), o = ptr.get(e.pointerId); if (!o) { onHover(...p); return; } ptr.set(e.pointerId, p);
  if (ptr.size === 2) { const [a, b] = [...ptr.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) zoomAt(d / pinch, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); pinch = d; moved = 99; return; }
  moved += Math.abs(p[0] - o[0]) + Math.abs(p[1] - o[1]); if (moved > 6) { if (canZoom()) { cv.style.cursor = "grabbing"; panBy(p[0] - o[0], p[1] - o[1]); } else onHover(...p); }
};
const up = (e, ok) => { if (!ptr.delete(e.pointerId)) return; pinch = 0; if (!ok || moved > 6) return; onHover(...at(e)); if (view === "ctx") { if (cv._hc) pickStep(cv._hc.i, cv._hc.k === "e"); } else if (hover != null && (view === "nb" || view === "mid") && !busy) choose(hover); else if (view === "axes" && ax && hover != null && cv._ax.R[hover]) axPick(cv._ax.R[hover].id, true); };
cv.onpointerup = e => up(e, 1); cv.onpointercancel = e => up(e, 0); cv.onpointerleave = e => { if (e.pointerType !== "touch") { hideTip(); if (hover != null) { hover = null; markRow(); redraw(); } } };
cv.addEventListener("wheel", e => { if (!canZoom()) return; e.preventDefault(); zoomAt(e.deltaY < 0 ? (view === "line" ? 1.25 : 1.12) : 1 / (view === "line" ? 1.25 : 1.12), ...at(e)); }, { passive: false });
cv.ondblclick = () => { if (view === "line") resetView(); };
$("zin").onclick = () => zc(1.4); $("zout").onclick = () => zc(1 / 1.4); $("reset").onclick = resetView;
addEventListener("keydown", e => {
  const t = e.target; if (e.ctrlKey || e.metaKey || e.altKey) return; if (e.key === "Escape" && t === qEl) { qEl.blur(); return; } if (/^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) return;
  if (e.key === "/") { e.preventDefault(); qEl.focus(); qEl.select(); } else if (e.key === "+" || e.key === "=") zc(1.4); else if (e.key === "-") zc(1 / 1.4); else if (e.key === "0" && canZoom()) resetView();
  else if (e.key === " " && t.tagName !== "BUTTON" && t.tagName !== "SUMMARY" && (isJn() || view === "ctx")) { e.preventDefault(); isJn() ? toggleJ() : pickStep(cstep, true); } else if (e.key === "ArrowLeft") isJn() ? $("jprev").click() : view === "ctx" && pickStep(cstep - 1); else if (e.key === "ArrowRight") isJn() ? $("jnext").click() : view === "ctx" && pickStep(cstep + 1);
});
// ───────── Settings ─────────
$("nk").onchange = () => { const v = Math.max(5, Math.min(+$("nk").max, Math.round(+$("nk").value) || 5)); $("nk").value = v; if (view === "ctx") nKc = v; else nK = v; load(); };
$("nasc").onchange = $("nv").onchange = () => load(); $("nt").oninput = redraw; $("diff").onchange = () => { renderSide(); redraw(); };
$("var").onclick = async () => { const f = text.words.split(",")[0].trim(); if (!f) return; try { const v = await api("variants", { q: f }); if (v.length) submit(v.join(", ")); } catch { fail = { msg: "Could not reach the server.", retry: 1 }; overlay(); } };
view = "line"; setTheme(store.get("theme", "auto"));
{ const s = readHash(), v = VIEWS[s.m] ? s.m : VIEWS[store.get("view")] ? store.get("view") : "line"; axSel = axArg(s.a); view = null; go(v, s.q, undefined); writeHash(false); }
