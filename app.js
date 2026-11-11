'use strict';
const KEY = 'heures-app-v1'; // same key as v1 so existing data is kept
const DAYS = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi'];
const DEFAULT_JOBS = [
  {id:'lona', label:'Lona', color:'#007e6e'},
  {id:'papers', label:'Papers', color:'#2563eb'},
  {id:'papersPremium', label:'Papers premium', color:'#7c3aed'},
  {id:'oneSheet', label:'One sheet', color:'#ea580c'},
  {id:'spectaculaire', label:'Spectaculaire', color:'#db2777'},
  {id:'spectaculaireGrua', label:'Spectaculaire (grua)', color:'#b45309'},
  {id:'structures', label:'Structures', color:'#f4da00'},
];
const PALETTE = ['#0891b2','#65a30d','#9333ea','#e11d48','#0d9488','#ca8a04','#4f46e5','#c2410c'];
const DEFAULT_SETTINGS = { name: '', extraFrom: 24, overFrom: 40 };
const MOIS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const reduceMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- dates ----------
const pad = n => String(n).padStart(2,'0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parseIso = s => { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); };
function mondayOf(d){ const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate()-((x.getDay()+6)%7)); return x; }
const addDays = (d,n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };
const fmtShort = d => d.toLocaleDateString('fr-CA',{day:'numeric',month:'short'}).replace(/[\u202f\u00a0]/g,' ');
const fmtLong = d => `${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;
function rangeText(mon){ const fri = addDays(mon,4); return `${mon.getDate()} ${MOIS[mon.getMonth()]}${mon.getFullYear()!==fri.getFullYear()?' '+mon.getFullYear():''} au ${fmtLong(fri)}`; }
const fmtHM = min => { min = Math.max(0, Math.round(min)); return `${Math.floor(min/60)} h ${pad(min%60)}`; };

// ---------- colors ----------
const hexRgb = h => { h = h.replace('#',''); if (h.length===3) h = h.split('').map(c=>c+c).join(''); return [0,2,4].map(i => parseInt(h.substr(i,2),16)); };
const onColor = h => { const [r,g,b] = hexRgb(h); return (0.299*r + 0.587*g + 0.114*b) > 165 ? '#171b1d' : '#ffffff'; };
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// ---------- storage + migration ----------
function load(){ try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch(e){ return null; } }
let state = load() || { current: iso(mondayOf(new Date())), weeks: {} };
if (!state.weeks) state.weeks = {};
if (!state.current) state.current = iso(mondayOf(new Date()));
state.settings = Object.assign({}, DEFAULT_SETTINGS, state.settings || {});
if (!Array.isArray(state.settings.jobs) || !state.settings.jobs.length) {
  // v1/v2 -> v3: default job list (old ids kept, so counts are preserved) + new "Structures"
  state.settings.jobs = DEFAULT_JOBS.map(j => ({...j}));
}
state.version = 3;
const S = () => state.settings;
const JOBS = () => S().jobs;
const userName = () => (S().name || '').trim();
function save(){ localStorage.setItem(KEY, JSON.stringify(state)); }
save();
function emptyDay(){ return { h:0, m:0, jobs:{} }; }
function week(){
  let w = state.weeks[state.current];
  if (!w) w = state.weeks[state.current] = { days: DAYS.map(emptyDay) };
  w.days.forEach(d => { d.jobs = d.jobs || {}; });
  return w;
}
const dayMin = d => (Number(d.h)||0)*60 + (Number(d.m)||0);
function totals(w){
  const t = { min: 0, jobs: {} };
  JOBS().forEach(j => t.jobs[j.id] = 0);
  w.days.forEach(d => { t.min += dayMin(d); JOBS().forEach(j => t.jobs[j.id] += Number(d.jobs[j.id])||0); });
  const a = Math.max(0, Number(S().extraFrom)||0) * 60, b = Math.max(a, (Number(S().overFrom)||0) * 60);
  t.extra = Math.max(0, Math.min(t.min, b) - a);
  t.over = Math.max(0, t.min - b);
  t.a = a; t.b = b;
  return t;
}

// ---------- UI helpers ----------
const $ = s => document.querySelector(s);
function toast(msg){ const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2600); }
function retrigger(el, cls){ el.classList.remove('pop','popdown'); void el.offsetWidth; el.classList.add(cls); }
function countTo(el, to, fmt){
  const from = Number(el.dataset.val || 0); el.dataset.val = to;
  if (reduceMotion() || from === to) { el.textContent = fmt(to); return; }
  const t0 = performance.now(), dur = 600;
  cancelAnimationFrame(el._raf);
  const step = now => { const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1-p, 3);
    el.textContent = fmt(from + (to - from) * e); if (p < 1) el._raf = requestAnimationFrame(step); };
  el._raf = requestAnimationFrame(step);
}
const fmtInt = v => String(Math.round(v));

// ---------- render ----------
let slideDir = '';
function render(){
  const mon = parseIso(state.current), w = week();
  $('#weekRange').textContent = 'Semaine du ' + fmtShort(mon) + ' au ' + fmtShort(addDays(mon,4)) + ' ' + addDays(mon,4).getFullYear();
  $('#weekPicker').value = state.current;
  $('#userName').textContent = userName() || 'Touche ⚙️ pour entrer ton nom';
  const todayIso = iso(new Date());
  const main = $('#days'); main.innerHTML = '';
  main.className = slideDir; slideDir = '';
  w.days.forEach((d, i) => {
    const date = addDays(mon, i), isToday = iso(date) === todayIso;
    const card = document.createElement('section');
    card.className = 'card day' + (isToday ? ' today' : '') + (main.className ? '' : ' enter');
    card.style.setProperty('--i', i);
    card.innerHTML = `
      <div class="dayhead"><h2>${DAYS[i]}${isToday ? '<span class="badge">Aujourd’hui</span>' : ''}</h2>
        <span><span class="date">${fmtLong(date)}</span><span class="daytot">${fmtHM(dayMin(d))}</span></span></div>
      <div class="hours"><span class="lbl">⏱ Heures</span>
        <input type="number" inputmode="numeric" min="0" max="24" data-f="h" value="${d.h||''}" placeholder="0"><span class="u">h</span>
        <input type="number" inputmode="numeric" min="0" max="59" data-f="m" value="${d.m||''}" placeholder="00"><span class="u">min</span></div>
      <div class="jobs">${JOBS().map(j => `
        <div class="job" style="--c:${j.color};--on:${onColor(j.color)}"><span class="name">${esc(j.label)}</span>
          <button class="step" data-j="${j.id}" data-d="-1" aria-label="moins ${esc(j.label)}">−</button>
          <span class="qty" data-q="${j.id}">${d.jobs[j.id]||0}</span>
          <button class="step plus" data-j="${j.id}" data-d="1" aria-label="plus ${esc(j.label)}">+</button></div>`).join('')}
      </div>`;
    card.querySelectorAll('input').forEach(inp => inp.addEventListener('input', () => {
      let v = parseInt(inp.value, 10); if (isNaN(v) || v < 0) v = 0;
      const max = inp.dataset.f === 'h' ? 24 : 59; if (v > max) { v = max; inp.value = v; }
      d[inp.dataset.f] = v; save();
      card.querySelector('.daytot').textContent = fmtHM(dayMin(d));
      updateSummary();
    }));
    card.querySelectorAll('.step').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.j, delta = Number(b.dataset.d), before = Number(d.jobs[id])||0;
      d.jobs[id] = Math.max(0, before + delta);
      const q = card.querySelector(`[data-q="${id}"]`); q.textContent = d.jobs[id];
      if (d.jobs[id] !== before) retrigger(q, delta > 0 ? 'pop' : 'popdown');
      if (navigator.vibrate) navigator.vibrate(8);
      save(); updateSummary();
    }));
    main.appendChild(card);
  });
  buildSummary(); updateSummary();
  const wd = new Date().getDay(), endOfWeek = wd === 5 || wd === 6 || wd === 0;
  const isCur = state.current === iso(mondayOf(new Date()));
  $('#pdfBtn').classList.toggle('friday', endOfWeek && isCur);
  $('#pdfBtn').textContent = endOfWeek && isCur ? '🎉 Fin de semaine — Générer le PDF' : '📄 Générer le PDF';
}

function buildSummary(){
  const s = S();
  $('#summary').innerHTML = `<h2>Résumé de la semaine</h2>
    <div class="sumgrid">
      <div class="tile total"><div class="k">Total heures</div><div class="v" id="vTotal">0 h 00</div></div>
      <div class="tile extra" id="tExtra"><div class="k">Extra (${s.extraFrom} h à ${s.overFrom} h)</div><div class="v" id="vExtra">0 h 00</div></div>
      <div class="tile over wide" id="tOver"><div class="k">Heures supp. (+${s.overFrom} h)</div><div class="v" id="vOver">0 h 00</div></div>
      <div class="progress"><div class="ptrack"><div class="pfill" id="pFill"></div><i class="pmark" id="mA"></i><i class="pmark" id="mB"></i></div>
        <div class="plabels"><span id="lA">${s.extraFrom} h</span><span id="lB">${s.overFrom} h</span></div></div>
      ${JOBS().map(j => `<div class="tile job-t" style="--c:${j.color}"><div class="k">${esc(j.label)}</div><div class="v" data-t="${j.id}">0</div></div>`).join('')}
    </div>`;
  $('#summary').querySelectorAll('.v').forEach(v => v.dataset.val = 0);
}
function updateSummary(){
  const t = totals(week());
  countTo($('#vTotal'), t.min, fmtHM);
  countTo($('#vExtra'), t.extra, fmtHM);
  countTo($('#vOver'), t.over, fmtHM);
  $('#tExtra').classList.toggle('glow', t.extra > 0);
  $('#tOver').classList.toggle('glow', t.over > 0);
  JOBS().forEach(j => { const el = $(`[data-t="${j.id}"]`); if (el) countTo(el, t.jobs[j.id], fmtInt); });
  const scale = Math.max(t.b * 1.2, t.min, 60);
  $('#pFill').style.transform = `scaleX(${Math.min(1, t.min/scale)})`;
  $('#pFill').className = 'pfill ' + (t.min > t.b ? 's2' : t.min > t.a ? 's1' : 's0');
  ['A','B'].forEach(k => { const pct = (k==='A'?t.a:t.b)/scale*100;
    $('#m'+k).style.left = pct + '%'; $('#l'+k).style.left = pct + '%'; });
}

function goWeek(mon, dir){ state.current = iso(mondayOf(mon)); save(); slideDir = reduceMotion() ? '' : dir; render(); window.scrollTo({top:0, behavior: reduceMotion() ? 'auto' : 'smooth'}); }
$('#prevWeek').onclick = () => goWeek(addDays(parseIso(state.current), -7), 'slide-l');
$('#nextWeek').onclick = () => goWeek(addDays(parseIso(state.current), 7), 'slide-r');
$('#weekPicker').onchange = e => { if (e.target.value) goWeek(parseIso(e.target.value), e.target.value < state.current ? 'slide-l' : 'slide-r'); };
$('#newWeekBtn').onclick = () => {
  const next = addDays(parseIso(state.current), 7);
  if (!confirm(`Commencer la semaine du ${rangeText(next)} ?\nLa semaine actuelle reste sauvegardée (flèche ‹ pour y revenir).`)) return;
  goWeek(next, 'slide-r'); toast('Nouvelle semaine commencée ✅');
};
$('#resetBtn').onclick = () => {
  if (!confirm('Effacer toutes les heures et quantités de cette semaine ?')) return;
  state.weeks[state.current] = { days: DAYS.map(emptyDay) }; save(); render(); toast('Semaine réinitialisée');
};

// ---------- settings ----------
let draftJobs = [];
function renderJobEditor(){
  const ed = $('#jobEditor');
  ed.innerHTML = draftJobs.map((j,i) => `<div class="jrow" data-i="${i}">
      <input type="color" value="${j.color}" aria-label="Couleur">
      <input type="text" value="${esc(j.label)}" placeholder="Nom de la tâche" maxlength="30">
      <button class="mini" data-a="up" aria-label="Monter" ${i===0?'disabled':''}>↑</button>
      <button class="mini" data-a="down" aria-label="Descendre" ${i===draftJobs.length-1?'disabled':''}>↓</button>
      <button class="mini del" data-a="del" aria-label="Supprimer">✕</button></div>`).join('') || '<p class="note">Aucune tâche.</p>';
  ed.querySelectorAll('.jrow').forEach(row => {
    const i = Number(row.dataset.i);
    row.querySelector('input[type=color]').oninput = e => { draftJobs[i].color = e.target.value; };
    row.querySelector('input[type=text]').oninput = e => { draftJobs[i].label = e.target.value; };
    row.querySelectorAll('.mini').forEach(b => b.onclick = () => {
      const a = b.dataset.a;
      if (a === 'up' && i > 0) [draftJobs[i-1], draftJobs[i]] = [draftJobs[i], draftJobs[i-1]];
      if (a === 'down' && i < draftJobs.length-1) [draftJobs[i+1], draftJobs[i]] = [draftJobs[i], draftJobs[i+1]];
      if (a === 'del') { if (!confirm(`Retirer « ${draftJobs[i].label} » de la liste ?\n(Les quantités déjà entrées sont gardées si tu la remets.)`)) return; draftJobs.splice(i,1); }
      renderJobEditor();
    });
  });
}
function openSettings(){
  $('#setName').value = S().name; $('#setExtra').value = S().extraFrom; $('#setOver').value = S().overFrom;
  draftJobs = JOBS().map(j => ({...j})); renderJobEditor();
  $('#settings').hidden = false; $('#settings').classList.remove('enter'); void $('#settings').offsetWidth; $('#settings').classList.add('enter');
  window.scrollTo({top:0});
}
$('#settingsBtn').onclick = () => { if ($('#settings').hidden) openSettings(); else $('#settings').hidden = true; };
$('#setCancel').onclick = () => { $('#settings').hidden = true; };
$('#addJob').onclick = () => {
  const used = new Set(draftJobs.map(j => j.color));
  draftJobs.push({ id: 'job_' + Date.now().toString(36), label: '', color: PALETTE.find(c => !used.has(c)) || PALETTE[draftJobs.length % PALETTE.length] });
  renderJobEditor(); const inputs = $('#jobEditor').querySelectorAll('input[type=text]'); inputs[inputs.length-1].focus();
};
$('#resetJobs').onclick = () => {
  if (!confirm('Remettre la liste par défaut (Lona, Papers, …, Structures) ?')) return;
  draftJobs = DEFAULT_JOBS.map(j => ({...j})); renderJobEditor();
};
$('#setSave').onclick = () => {
  let ex = parseFloat($('#setExtra').value), ov = parseFloat($('#setOver').value);
  if (isNaN(ex) || ex < 0) ex = 24; if (isNaN(ov) || ov < 0) ov = 40;
  if (ov < ex) { alert('Le seuil des heures supp. doit être plus grand ou égal au seuil Extra.'); return; }
  const jobs = draftJobs.map(j => ({...j, label: j.label.trim()})).filter(j => j.label);
  state.settings = { name: $('#setName').value.trim().slice(0,60), extraFrom: ex, overFrom: ov, jobs };
  save(); $('#settings').hidden = true; render(); toast('Réglages enregistrés ✅');
};

// ---------- confetti (canvas, ~2 s) ----------
function confetti(){
  if (reduceMotion()) return;
  const c = $('#confetti'), ctx = c.getContext('2d'), dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = innerWidth * dpr; c.height = innerHeight * dpr; ctx.scale(dpr, dpr);
  const cols = ['#f4da00','#007e6e','#16a34a','#dc2626','#2563eb','#ffffff', ...JOBS().map(j => j.color)];
  const P = Array.from({length: 140}, () => ({ x: innerWidth/2, y: innerHeight*0.75, vx: (Math.random()-0.5)*14, vy: -Math.random()*16-6,
    s: Math.random()*7+4, r: Math.random()*6, vr: (Math.random()-0.5)*0.4, c: cols[Math.floor(Math.random()*cols.length)] }));
  const t0 = performance.now();
  (function frame(now){
    const el = now - t0; ctx.clearRect(0,0,innerWidth,innerHeight);
    P.forEach(p => { p.vy += 0.42; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.r); ctx.globalAlpha = Math.max(0, 1 - el/2200); ctx.fillStyle = p.c; ctx.fillRect(-p.s/2,-p.s/4,p.s,p.s/2); ctx.restore(); });
    if (el < 2200) requestAnimationFrame(frame); else ctx.clearRect(0,0,innerWidth,innerHeight);
  })(t0);
}

// ---------- PDF ----------
let logoData = null;
(function preloadLogo(){
  const img = new Image(); img.onload = () => { try { const cv = document.createElement('canvas'); cv.width = cv.height = 160;
    cv.getContext('2d').drawImage(img,0,0,160,160); logoData = cv.toDataURL('image/png'); } catch(e){} }; img.src = 'assets/logo-160.png';
})();
function buildPdf(){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  const mon = parseIso(state.current), w = week(), t = totals(w), jobs = JOBS(), s = S();
  const DARK = [8,11,12], YEL = [244,218,0], BR = [0,126,110], OK = [22,163,74], RED = [220,38,38];
  // header band
  doc.setFillColor(...DARK); doc.rect(0,0,W,96,'F');
  doc.setFillColor(...BR); doc.rect(0,96,W,4,'F');
  doc.setFillColor(...YEL); doc.rect(0,100,W,4,'F');
  let tx = 40;
  if (logoData) { doc.setFillColor(248,248,244); doc.roundedRect(34,16,64,64,10,10,'F'); doc.addImage(logoData,'PNG',38,20,56,56); tx = 114; }
  doc.setTextColor(...YEL); doc.setFont('helvetica','bold'); doc.setFontSize(11);
  doc.text('AZ TECH MANIA', tx, 32);
  doc.setTextColor(255,255,255); doc.setFontSize(22);
  doc.text('Rapport hebdomadaire des heures', tx, 56);
  doc.setFont('helvetica','normal'); doc.setFontSize(12);
  doc.text(`${userName() ? userName() + '   •   ' : ''}Semaine du ${rangeText(mon)}`, tx, 78);
  doc.setFontSize(9); doc.setTextColor(200,205,200);
  doc.text(`Généré le ${fmtLong(new Date())} à ${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`, W-40, 78, {align:'right'});

  const overLabel = `Heures supp. (+${s.overFrom} h)`;
  const head = [['Jour','Date','Heures', ...jobs.map(j => j.label), 'Extra', overLabel]];
  const body = w.days.map((d,i) => [DAYS[i], fmtShort(addDays(mon,i)), fmtHM(dayMin(d)), ...jobs.map(j => String(d.jobs[j.id]||0)), '', '']);
  const foot = [['TOTAL','', fmtHM(t.min), ...jobs.map(j => String(t.jobs[j.id])), fmtHM(t.extra), fmtHM(t.over)]];
  const extraCol = head[0].length - 2, overCol = head[0].length - 1;
  const many = jobs.length > 7;
  doc.autoTable({
    head, body, foot, startY: 126, theme: 'grid', showFoot: 'lastPage',
    margin: { left: 40, right: 40 },
    styles: { font:'helvetica', fontSize: many ? 9 : 10, cellPadding: 6, halign: 'center', valign: 'middle', lineColor: [220,222,217], lineWidth: 0.8, textColor:[23,27,29] },
    headStyles: { fillColor: [23,27,29], textColor: 255, fontStyle: 'bold', fontSize: many ? 7.5 : 8.5 },
    footStyles: { fillColor: DARK, textColor: 255, fontStyle: 'bold', fontSize: 11 },
    alternateRowStyles: { fillColor: [244,245,240] },
    columnStyles: { 0: { halign:'left', fontStyle:'bold', cellWidth: 62 }, 1: { cellWidth: 52 }, 2: { fontStyle:'bold', cellWidth: 58 }, [extraCol]: { cellWidth: 58 }, [overCol]: { cellWidth: 70 } },
    didParseCell: data => {
      const c = data.column.index;
      if (data.section === 'head' && c >= 3 && c < extraCol) { const j = jobs[c-3]; data.cell.styles.fillColor = hexRgb(j.color); data.cell.styles.textColor = hexRgb(onColor(j.color)); }
      if (data.section === 'head' && c === extraCol) data.cell.styles.fillColor = OK;
      if (data.section === 'head' && c === overCol) data.cell.styles.fillColor = RED;
      if (data.section === 'body' && c >= extraCol) data.cell.styles.fillColor = [250,250,248];
      if (data.section === 'foot' && c === extraCol) { data.cell.styles.fillColor = OK; data.cell.styles.textColor = 255; }
      if (data.section === 'foot' && c === overCol) { data.cell.styles.fillColor = RED; data.cell.styles.textColor = 255; }
      if (data.section === 'foot' && c === 2) { data.cell.styles.textColor = YEL; }
    },
  });
  // summary boxes
  const y = doc.lastAutoTable.finalY + 28;
  const boxes = [
    { k:'Total des heures', v: fmtHM(t.min), c:[23,27,29], tc: YEL },
    { k:`Extra (${s.extraFrom} h à ${s.overFrom} h)`, v: fmtHM(t.extra), c: OK },
    { k:`Heures supp. (+${s.overFrom} h)`, v: fmtHM(t.over), c: RED },
    { k:'Total side jobs', v: String(Object.values(t.jobs).reduce((a,b)=>a+b,0)), c: BR },
  ];
  const bw = (W - 80 - (boxes.length-1)*16) / boxes.length;
  boxes.forEach((b,i) => {
    const x = 40 + i*(bw+16);
    doc.setFillColor(...b.c); doc.roundedRect(x, y, bw, 66, 10, 10, 'F');
    doc.setTextColor(...(b.tc || [255,255,255])); doc.setFont('helvetica','normal'); doc.setFontSize(10.5); doc.text(b.k, x+16, y+22);
    doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(22); doc.text(b.v, x+16, y+52);
  });
  // footer
  doc.setFillColor(...YEL); doc.rect(0,H-6,W,6,'F');
  doc.setTextColor(90,98,102); doc.setFont('helvetica','normal'); doc.setFontSize(9);
  doc.text(`${userName() ? userName() + ' — ' : ''}AZ Tech Mania`, 40, H-18); doc.text('Page 1', W-40, H-18, {align:'right'});
  return doc;
}

$('#pdfBtn').onclick = async () => {
  try {
    const doc = buildPdf();
    if ($('#pdfBtn').classList.contains('friday')) confetti();
    const safe = userName().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9]+/g,'_').replace(/^_|_$/g,'');
    const fname = `Heures_${safe ? safe + '_' : ''}semaine_${state.current}.pdf`;
    const blob = doc.output('blob');
    const file = new File([blob], fname, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: fname }); return; }
      catch (e) { if (e && e.name === 'AbortError') return; }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = fname;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    toast('PDF créé ✅');
  } catch (e) { console.error(e); alert('Erreur PDF : ' + e.message); }
};

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(()=>{}));
render();
if (!userName() && !localStorage.getItem(KEY + '-asked')) { localStorage.setItem(KEY + '-asked', '1'); openSettings(); }
