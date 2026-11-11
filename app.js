'use strict';
const NAME = 'Othmane Khabar';
const KEY = 'heures-app-v1';
const DAYS = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi'];
const JOBS = [
  {id:'lona', label:'Lona', color:[37,99,235]},
  {id:'papers', label:'Papers', color:[13,148,136]},
  {id:'papersPremium', label:'Papers premium', color:[124,58,237]},
  {id:'oneSheet', label:'One sheet', color:[234,88,12]},
  {id:'spectaculaire', label:'Spectaculaire', color:[219,39,119]},
  {id:'spectaculaireGrua', label:'Spectaculaire (grua)', color:[202,138,4]},
];
const EXTRA_AFTER_MIN = 24 * 60;
const MOIS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];

// ---------- dates ----------
const pad = n => String(n).padStart(2,'0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parseIso = s => { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); };
function mondayOf(d){ const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); const wd = (x.getDay()+6)%7; x.setDate(x.getDate()-wd); return x; }
const addDays = (d,n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };
const fmtShort = d => d.toLocaleDateString('fr-CA',{day:'numeric',month:'short'}).replace(/[\u202f\u00a0]/g,' ');
const fmtLong = d => `${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;
function rangeText(mon){ const fri = addDays(mon,4); return `${fmtLong(mon).replace(' '+mon.getFullYear(), mon.getFullYear()===fri.getFullYear()?'':' '+mon.getFullYear())} au ${fmtLong(fri)}`; }
const fmtHM = min => `${Math.floor(min/60)} h ${pad(min%60)}`;

// ---------- storage ----------
function emptyWeek(){ return { days: DAYS.map(() => ({ h:0, m:0, jobs: Object.fromEntries(JOBS.map(j => [j.id,0])) })) }; }
function load(){ try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch(e){ return null; } }
let state = load() || { current: iso(mondayOf(new Date())), weeks: {} };
function save(){ localStorage.setItem(KEY, JSON.stringify(state)); }
function week(){ if (!state.weeks[state.current]) state.weeks[state.current] = emptyWeek(); return state.weeks[state.current]; }
const dayMin = d => (Number(d.h)||0)*60 + (Number(d.m)||0);

function totals(w){
  const t = { min: 0, jobs: Object.fromEntries(JOBS.map(j => [j.id,0])) };
  w.days.forEach(d => { t.min += dayMin(d); JOBS.forEach(j => t.jobs[j.id] += d.jobs[j.id]||0); });
  t.extra = Math.max(0, t.min - EXTRA_AFTER_MIN);
  return t;
}

// ---------- UI ----------
const $ = s => document.querySelector(s);
function toast(msg){ const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2600); }
const rgb = c => `rgb(${c.join(',')})`;

function render(){
  const mon = parseIso(state.current), w = week();
  $('#weekRange').textContent = 'Semaine du ' + fmtShort(mon) + ' au ' + fmtShort(addDays(mon,4)) + ' ' + addDays(mon,4).getFullYear();
  $('#weekPicker').value = state.current;
  const todayIso = iso(new Date());
  const main = $('#days'); main.innerHTML = '';
  w.days.forEach((d, i) => {
    const date = addDays(mon, i), isToday = iso(date) === todayIso;
    const card = document.createElement('section');
    card.className = 'card day' + (isToday ? ' today' : '');
    card.innerHTML = `
      <div class="dayhead"><h2>${DAYS[i]}${isToday ? '<span class="badge">Aujourd’hui</span>' : ''}</h2><span class="date">${fmtLong(date)}</span></div>
      <div class="hours"><span class="lbl">⏱ Heures</span>
        <input type="number" inputmode="numeric" min="0" max="24" data-f="h" value="${d.h||''}" placeholder="0"><span class="u">h</span>
        <input type="number" inputmode="numeric" min="0" max="59" data-f="m" value="${d.m||''}" placeholder="00"><span class="u">min</span></div>
      <div class="jobs">${JOBS.map(j => `
        <div class="job"><span class="name"><span class="dot" style="background:${rgb(j.color)}"></span>${j.label}</span>
          <button class="step" data-j="${j.id}" data-d="-1" aria-label="moins">−</button>
          <span class="qty" data-q="${j.id}">${d.jobs[j.id]||0}</span>
          <button class="step plus" data-j="${j.id}" data-d="1" aria-label="plus">+</button></div>`).join('')}
      </div>`;
    card.querySelectorAll('input').forEach(inp => inp.addEventListener('input', () => {
      let v = parseInt(inp.value, 10); if (isNaN(v) || v < 0) v = 0;
      const max = inp.dataset.f === 'h' ? 24 : 59; if (v > max) { v = max; inp.value = v; }
      d[inp.dataset.f] = v; save(); renderSummary();
    }));
    card.querySelectorAll('.step').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.j; d.jobs[id] = Math.max(0, (d.jobs[id]||0) + Number(b.dataset.d));
      card.querySelector(`[data-q="${id}"]`).textContent = d.jobs[id];
      if (navigator.vibrate) navigator.vibrate(8);
      save(); renderSummary();
    }));
    main.appendChild(card);
  });
  renderSummary();
  const isFriday = new Date().getDay() === 5 || new Date().getDay() === 6;
  $('#pdfBtn').classList.toggle('friday', isFriday && state.current === iso(mondayOf(new Date())));
  $('#pdfBtn').textContent = isFriday ? '📄 Fin de semaine — Générer le PDF' : '📄 Générer le PDF';
}

function renderSummary(){
  const t = totals(week());
  $('#summary').innerHTML = `<h2>Résumé de la semaine</h2>
    <div class="sumgrid">
      <div class="tile total"><div class="k">Total heures</div><div class="v">${fmtHM(t.min)}</div></div>
      <div class="tile extra"><div class="k">Extra (après 24 h)</div><div class="v">${fmtHM(t.extra)}</div></div>
      ${JOBS.map(j => `<div class="tile"><div class="k"><span class="dot" style="background:${rgb(j.color)}"></span>${j.label}</div><div class="v">${t.jobs[j.id]}</div></div>`).join('')}
    </div>`;
}

function goWeek(mon){ state.current = iso(mondayOf(mon)); save(); render(); window.scrollTo({top:0}); }
$('#prevWeek').onclick = () => goWeek(addDays(parseIso(state.current), -7));
$('#nextWeek').onclick = () => goWeek(addDays(parseIso(state.current), 7));
$('#weekPicker').onchange = e => { if (e.target.value) goWeek(parseIso(e.target.value)); };
$('#newWeekBtn').onclick = () => {
  const next = addDays(parseIso(state.current), 7);
  if (!confirm(`Commencer la semaine du ${rangeText(next)} ?\nLa semaine actuelle reste sauvegardée (flèche ‹ pour y revenir).`)) return;
  goWeek(next); toast('Nouvelle semaine commencée ✅');
};
$('#resetBtn').onclick = () => {
  if (!confirm('Effacer toutes les heures et quantités de cette semaine ?')) return;
  state.weeks[state.current] = emptyWeek(); save(); render(); toast('Semaine réinitialisée');
};

// ---------- PDF ----------
function buildPdf(){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  const mon = parseIso(state.current), w = week(), t = totals(w);
  // header band
  doc.setFillColor(37,99,235); doc.rect(0,0,W,92,'F');
  doc.setFillColor(13,148,136); doc.rect(0,86,W,6,'F');
  doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(24);
  doc.text('Rapport hebdomadaire des heures', 40, 42);
  doc.setFont('helvetica','normal'); doc.setFontSize(13);
  doc.text(`${NAME}   •   Semaine du ${rangeText(mon)}`, 40, 68);
  doc.setFontSize(10); doc.text(`Généré le ${fmtLong(new Date())} à ${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`, W-40, 68, {align:'right'});

  const head = [['Jour','Date','Heures', ...JOBS.map(j => j.label), 'Extra']];
  const body = w.days.map((d,i) => [DAYS[i], fmtShort(addDays(mon,i)), fmtHM(dayMin(d)), ...JOBS.map(j => String(d.jobs[j.id]||0)), '']);
  const foot = [['TOTAL','', fmtHM(t.min), ...JOBS.map(j => String(t.jobs[j.id])), fmtHM(t.extra)]];
  const extraCol = head[0].length - 1;
  doc.autoTable({
    head, body, foot, startY: 120, theme: 'grid', showFoot: 'lastPage',
    margin: { left: 40, right: 40 },
    styles: { font:'helvetica', fontSize: 11, cellPadding: 8, halign: 'center', valign: 'middle', lineColor: [226,232,240], lineWidth: 0.8, textColor:[15,23,42] },
    headStyles: { fillColor: [30,64,175], textColor: 255, fontStyle: 'bold', fontSize: 10 },
    footStyles: { fillColor: [15,23,42], textColor: 255, fontStyle: 'bold', fontSize: 12 },
    alternateRowStyles: { fillColor: [241,245,249] },
    columnStyles: { 0: { halign:'left', fontStyle:'bold' }, 2: { fontStyle:'bold' } },
    didParseCell: data => {
      const c = data.column.index;
      if (data.section === 'head' && c >= 3 && c < extraCol) data.cell.styles.fillColor = JOBS[c-3].color;
      if (data.section === 'head' && c === extraCol) data.cell.styles.fillColor = [22,163,74];
      if (data.section === 'foot' && c === extraCol) { data.cell.styles.fillColor = [22,163,74]; data.cell.styles.textColor = 255; }
      if (data.section === 'body' && c === extraCol) data.cell.styles.fillColor = [248,250,252];
    },
  });
  // summary boxes
  let y = doc.lastAutoTable.finalY + 30;
  const boxes = [
    { k:'Total des heures', v: fmtHM(t.min), c:[30,64,175] },
    { k:'Extra (au-delà de 24 h)', v: fmtHM(t.extra), c:[22,163,74] },
    { k:'Total side jobs', v: String(Object.values(t.jobs).reduce((a,b)=>a+b,0)), c:[13,148,136] },
  ];
  const bw = (W - 80 - 2*20) / 3;
  boxes.forEach((b,i) => {
    const x = 40 + i*(bw+20);
    doc.setFillColor(...b.c); doc.roundedRect(x, y, bw, 64, 10, 10, 'F');
    doc.setTextColor(255,255,255); doc.setFont('helvetica','normal'); doc.setFontSize(11); doc.text(b.k, x+16, y+22);
    doc.setFont('helvetica','bold'); doc.setFontSize(22); doc.text(b.v, x+16, y+50);
  });
  doc.setTextColor(100,116,139); doc.setFont('helvetica','normal'); doc.setFontSize(9);
  doc.text(`${NAME} — Mes heures`, 40, H-24); doc.text('Page 1', W-40, H-24, {align:'right'});
  return doc;
}

$('#pdfBtn').onclick = async () => {
  try {
    const doc = buildPdf();
    const fname = `Heures_${NAME.replace(/\s+/g,'_')}_${state.current}.pdf`;
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
