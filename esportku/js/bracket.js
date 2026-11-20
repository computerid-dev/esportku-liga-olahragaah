const mid = (r, i) => `r${r}m${i}`;
export const seeds = n => { let a = [1, 2]; while (a.length < n) a = a.flatMap(x => [x, a.length * 2 + 1 - x]); return a; };

export const parse = (text, set) => {
  const p = String(text).split(",").map(x => x.trim().split("-").map(Number)).filter(x => x.length === 2 && x.every(n => Number.isFinite(n) && n >= 0));
  return set ? p : p.slice(0, 1);
};
export const tally = (sets, set) => set
  ? { sa: sets.filter(s => s[0] > s[1]).length, sb: sets.filter(s => s[1] > s[0]).length }
  : { sa: sets[0][0], sb: sets[0][1] };

const mk = (round, idx, x, y) => ({ round, idx, a: x?.id || null, b: y?.id || null, na: x?.name || "", nb: y?.name || "", sets: [], sa: 0, sb: 0, done: false, bye: false, when: "" });

// Mengisi pemenang match ke slot babak berikutnya, mengembalikan id match tujuan
export const feed = (M, m) => {
  const next = M[mid(m.round + 1, m.idx >> 1)];
  if (!next || !m.done) return null;
  const aWins = m.bye ? !!m.a : m.sa > m.sb, w = aWins ? [m.a, m.na] : [m.b, m.nb], s = m.idx % 2 ? "b" : "a";
  next[s] = w[0]; next["n" + s] = w[1];
  return mid(m.round + 1, m.idx >> 1);
};

export const gen = (teams, format, direct) => {
  const M = {};
  if (format === "roundrobin") {
    let k = 0;
    teams.forEach((x, i) => teams.slice(i + 1).forEach(y => { M["m" + String(++k).padStart(3, "0")] = mk(1, k, x, y); }));
    return M;
  }
  const n = 2 ** Math.ceil(Math.log2(teams.length)), o = direct ? Array.from({ length: n }, (_, i) => i + 1) : seeds(n);
  for (let i = 0; i < n / 2; i++) M[mid(1, i)] = mk(1, i, teams[o[2 * i] - 1], teams[o[2 * i + 1] - 1]);
  for (let r = 2, c = n / 4; c >= 1; r++, c /= 2) for (let i = 0; i < c; i++) M[mid(r, i)] = mk(r, i);
  Object.values(M).filter(m => m.round === 1 && (!m.a || !m.b)).forEach(m => { m.bye = m.done = true; feed(M, m); });
  return M;
};

export const roundName = (r, last) => ["FINAL", "SEMIFINAL", "PEREMPAT FINAL"][last - r] || "BABAK " + r;

export const table = (teams, ms) => {
  const t = {};
  teams.forEach(x => t[x.id] = { id: x.id, logo: x.logo || "", n: x.name, p: 0, w: 0, d: 0, l: 0, f: 0, a: 0, pt: 0 });
  ms.filter(m => m.done && !m.bye && t[m.a] && t[m.b]).forEach(m => {
    const A = t[m.a], B = t[m.b];
    A.p++; B.p++; A.f += m.sa; A.a += m.sb; B.f += m.sb; B.a += m.sa;
    if (m.sa > m.sb) { A.w++; B.l++; A.pt += 3; } else if (m.sa < m.sb) { B.w++; A.l++; B.pt += 3; } else { A.d++; B.d++; A.pt++; B.pt++; }
  });
  return Object.values(t).sort((x, y) => y.pt - x.pt || (y.f - y.a) - (x.f - x.a) || y.f - x.f);
};

export const genGroups = (teams, n) => {
  const L = "ABCDEFGH", M = {}, g = Array.from({ length: n }, () => []);
  teams.forEach((t, i) => { const c = i % n; g[(i / n | 0) % 2 ? n - 1 - c : c].push(t); });
  g.forEach((ts, gi) => {
    let k = 0;
    ts.forEach(t => { t.grp = L[gi]; });
    ts.forEach((x, i) => ts.slice(i + 1).forEach(y => { M[`g${L[gi]}m${String(++k).padStart(2, "0")}`] = { ...mk(1, k, x, y), stage: "grup", grp: L[gi] }; }));
  });
  return M;
};

// Urutan seed babak gugur: juara grup dulu, lalu runner-up (digeser agar tidak bertemu satu grup di awal)
export const knockSeeds = (teams, ms) => {
  const gs = [...new Set(teams.map(t => t.grp))].sort();
  const top = gs.map(G => table(teams.filter(t => t.grp === G), ms.filter(m => m.stage === "grup")).slice(0, 2).map(r => r.id));
  const w = top.map(x => x[0]), r = top.map(x => x[1]), h = r.length > 2 ? Math.floor(r.length / 2) : 0;
  return [...w, ...r.slice(h), ...r.slice(0, h)].map(id => teams.find(t => t.id === id));
};

// Gugur ganda untuk 4/8/16/32 tim. Tiap match menyimpan rute pemenang (nw) dan kalah (nl) "idMatch:slot"
export const genDouble = (teams, direct) => {
  const n = teams.length, k = Math.log2(n), o = direct ? Array.from({ length: n }, (_, i) => i + 1) : seeds(n), M = {};
  const U = (r, i) => `r${r}m${i}`, L = (r, i) => `l${r}m${i}`, sd = i => (i % 2 ? "b" : "a");
  for (let r = 1; r <= k; r++) for (let i = 0; i < n / 2 ** r; i++) M[U(r, i)] = { ...(r === 1 ? mk(1, i, teams[o[2 * i] - 1], teams[o[2 * i + 1] - 1]) : mk(r, i)), stage: "gugur" };
  for (let r = 1; r <= 2 * (k - 1); r++) for (let i = 0; i < n / 2 ** (Math.ceil(r / 2) + 1); i++) M[L(r, i)] = { ...mk(r, i), stage: "lower" };
  M.gf = { ...mk(1, 0), stage: "final" };
  for (let r = 1; r <= k; r++) for (let i = 0; i < n / 2 ** r; i++) {
    const m = M[U(r, i)];
    m.nw = r < k ? `${U(r + 1, i >> 1)}:${sd(i)}` : "gf:a";
    m.nl = r === 1 ? `${L(1, i >> 1)}:${sd(i)}` : `${L(2 * (r - 1), i)}:b`;
  }
  for (let r = 1; r <= 2 * (k - 1); r++) for (let i = 0; i < n / 2 ** (Math.ceil(r / 2) + 1); i++)
    M[L(r, i)].nw = r % 2 ? `${L(r + 1, i)}:a` : r === 2 * (k - 1) ? "gf:b" : `${L(r + 1, i >> 1)}:${sd(i)}`;
  return M;
};

// Mengirim pemenang/kalah ke match tujuan, mengembalikan id match yang berubah
export const route = (M, m) => {
  const w = m.sa > m.sb, put = (ref, id, name) => { const [k, s] = ref.split(":"); M[k][s] = id; M[k]["n" + s] = name; return k; };
  return [m.nw && put(m.nw, w ? m.a : m.b, w ? m.na : m.nb), m.nl && put(m.nl, w ? m.b : m.a, w ? m.nb : m.na)].filter(Boolean);
};

// Firestore menolak array di dalam array, jadi skor set disimpan sebagai teks "25-20" dan dibaca kembali menjadi [25, 20]
export const pack = m => ({ ...m, sets: (m.sets || []).map(x => (Array.isArray(x) ? x.join("-") : x)) });
export const unpack = m => ({ ...m, sets: (m.sets || []).map(x => (Array.isArray(x) ? x : String(x).split("-").map(Number))) });
