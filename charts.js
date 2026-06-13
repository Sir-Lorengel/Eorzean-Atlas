'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// CHARTS — canvas graph rendering (Gil, MGP, Venture, Seals)
// ═══════════════════════════════════════════════════════════════════════════

function formatGil(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.?0+$/, '') + 'k';
  return n.toLocaleString();
}

// Unified line graph renderer. All four currency trackers share this logic.
// Differences are passed in via opts: colors, data source, empty message,
// y-axis label formatter, padding calculation, and optional cap line.
// Per-card chart type ('line' | 'bar') is stored on the persisted `ui` object,
// keyed by canvas id, and defaults to 'line'.
function chartTypeFor(canvasId) {
  return (typeof ui !== 'undefined' && ui.chartTypes && ui.chartTypes[canvasId] === 'bar')
    ? 'bar' : 'line';
}

function renderGraph({ canvasId, data, range, accent, accentRgb, emptyMsg, yLabelFn, yPadFn, capValue }) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const chartType = chartTypeFor(canvasId);

  const dpr = window.devicePixelRatio || 1;
  const W   = canvas.clientWidth || canvas.parentElement?.clientWidth || 600;
  const H   = 220;
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  canvas.style.height = H + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const textDim   = '#a89a7d';
  const ruleColor = 'rgba(42,29,16,0.10)';

  ctx.clearRect(0, 0, W, H);

  const cutoffs = { '7d': Date.now() - 7*864e5, '30d': Date.now() - 30*864e5, '1y': Date.now() - 365*864e5, 'all': 0 };
  const cutoff  = cutoffs[range] ?? 0;
  const pts = [...data]
    .filter(p => new Date(p.date).getTime() >= cutoff)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  if (pts.length === 0) {
    ctx.fillStyle = textDim;
    ctx.font = `italic 13px 'Lora', Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emptyMsg, W / 2, H / 2);
    return;
  }

  const amounts = pts.map(p => p.amount);
  const times   = pts.map(p => new Date(p.date).getTime());
  const minAmt  = Math.min(...amounts);
  const maxAmt  = capValue != null ? Math.max(...amounts, capValue) : Math.max(...amounts);
  const minT    = times[0];
  const maxT    = times[times.length - 1];
  const tSpan   = maxT - minT || 1;
  const yPad    = yPadFn(minAmt, maxAmt);
  const yMin    = Math.max(0, minAmt - yPad);
  const yMax    = maxAmt + yPad;
  const ySpan   = yMax - yMin || 1;

  const pad = { top: 16, right: 16, bottom: 36, left: 66 };
  const cW  = W - pad.left - pad.right;
  const cH  = H - pad.top  - pad.bottom;

  const toX = t => pad.left + ((t - minT) / tSpan) * cW;
  const toY = v => pad.top  + cH - ((v - yMin) / ySpan) * cH;

  // Y grid + labels
  const yTicks = 5;
  ctx.font = `11px 'Cormorant Garamond', serif`;
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= yTicks; i++) {
    const v = yMin + (ySpan / yTicks) * i;
    const y = toY(v);
    ctx.strokeStyle = ruleColor; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + cW, y); ctx.stroke();
    ctx.fillStyle = textDim; ctx.textAlign = 'right';
    ctx.fillText(yLabelFn(v), pad.left - 6, y);
  }

  // X labels — up to 7 evenly spaced points
  const maxLabels = Math.min(pts.length, 7);
  const step = Math.max(1, Math.floor((pts.length - 1) / (maxLabels - 1 || 1)));
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for (let i = 0; i < pts.length; i += step) {
    const d = new Date(pts[i].date);
    const label = (range === '1y' || range === 'all')
      ? d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
      : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const x = toX(times[i]);
    ctx.fillStyle = textDim; ctx.fillText(label, x, pad.top + cH + 6);
    ctx.strokeStyle = ruleColor; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, pad.top + cH); ctx.lineTo(x, pad.top + cH + 4); ctx.stroke();
  }

  // Optional cap line (used by Company Seals)
  if (capValue != null) {
    const capY = toY(capValue);
    if (capY >= pad.top && capY <= pad.top + cH) {
      ctx.save();
      ctx.strokeStyle = `rgba(${accentRgb},0.45)`;
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(pad.left, capY); ctx.lineTo(pad.left + cW, capY); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = `rgba(${accentRgb},0.6)`;
      ctx.font = `10px 'Cormorant Garamond', serif`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      ctx.fillText('cap', pad.left + 4, capY - 2);
      ctx.restore();
    }
  }

  // Bar chart — one bar per entry, positioned by date, height from axis floor.
  if (chartType === 'bar') {
    const baseY = pad.top + cH;
    const slot  = cW / pts.length;
    const barW  = Math.max(2, Math.min(slot * 0.7, 40));
    pts.forEach((p, i) => {
      const x = toX(times[i]);
      const y = toY(p.amount);
      const h = Math.max(0, baseY - y);
      ctx.fillStyle = `rgba(${accentRgb},0.55)`;
      ctx.fillRect(x - barW / 2, y, barW, h);
      ctx.strokeStyle = accent; ctx.lineWidth = 1.5;
      ctx.strokeRect(x - barW / 2, y, barW, h);
    });
    return;
  }

  if (pts.length === 1) {
    ctx.beginPath(); ctx.arc(toX(times[0]), toY(amounts[0]), 5, 0, Math.PI * 2);
    ctx.fillStyle = accent; ctx.fill();
    return;
  }

  // Area fill
  const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + cH);
  grad.addColorStop(0, `rgba(${accentRgb},0.20)`);
  grad.addColorStop(1, `rgba(${accentRgb},0.01)`);
  ctx.beginPath();
  ctx.moveTo(toX(times[0]), toY(amounts[0]));
  for (let i = 1; i < pts.length; i++) ctx.lineTo(toX(times[i]), toY(amounts[i]));
  ctx.lineTo(toX(times[times.length - 1]), pad.top + cH);
  ctx.lineTo(toX(times[0]), pad.top + cH);
  ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();

  // Line
  ctx.beginPath();
  ctx.moveTo(toX(times[0]), toY(amounts[0]));
  for (let i = 1; i < pts.length; i++) ctx.lineTo(toX(times[i]), toY(amounts[i]));
  ctx.strokeStyle = accent; ctx.lineWidth = 2;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();

  // Data points
  pts.forEach((p, i) => {
    ctx.beginPath(); ctx.arc(toX(times[i]), toY(p.amount), 3.5, 0, Math.PI * 2);
    ctx.fillStyle = accent; ctx.fill();
    ctx.strokeStyle = '#f5efe1'; ctx.lineWidth = 1.5; ctx.stroke();
  });
}

function renderGilGraph(range) {
  renderGraph({
    canvasId: 'gil-graph', data: gilData, range,
    accent: '#b1882a', accentRgb: '177,136,42',
    emptyMsg: 'No entries for this period — log a gil balance below.',
    yLabelFn: v => formatGil(Math.round(v)),
    yPadFn: (min, max) => (max - min) * 0.12 || max * 0.1 || 1000,
  });
}

function renderMgpGraph(range) {
  renderGraph({
    canvasId: 'mgp-graph', data: mgpData, range,
    accent: '#7b4fab', accentRgb: '123,79,171',
    emptyMsg: 'No entries for this period — log an MGP balance below.',
    yLabelFn: v => formatGil(Math.round(v)),
    yPadFn: (min, max) => (max - min) * 0.12 || max * 0.1 || 1000,
  });
}

function renderVentureGraph(range) {
  renderGraph({
    canvasId: 'venture-graph', data: ventureData, range,
    accent: '#2e7d6e', accentRgb: '46,125,110',
    emptyMsg: 'No entries for this period — log a Venture balance below.',
    yLabelFn: v => Math.round(v).toLocaleString(),
    yPadFn: (min, max) => (max - min) * 0.12 || max * 0.1 || 10,
  });
}

function renderSealGraph(range) {
  const cap = GC_RANKS.find(r => r.name === sealRank)?.cap || 90000;
  renderGraph({
    canvasId: 'seal-graph', data: sealEntries, range,
    accent: '#b0442c', accentRgb: '176,68,44',
    emptyMsg: 'No entries for this period — log a seal balance below.',
    yLabelFn: v => Math.round(v).toLocaleString(),
    yPadFn: (min, max) => (max - min) * 0.08,
    capValue: cap,
  });
}

function renderPoeticsGraph(range) {
  renderGraph({
    canvasId: 'poetics-graph', data: poeticsData, range,
    accent: '#3a6b85', accentRgb: '58,107,133',
    emptyMsg: 'No entries for this period — log a Poetics balance below.',
    yLabelFn: v => Math.round(v).toLocaleString(),
    yPadFn: (min, max) => (max - min) * 0.08,
    capValue: 2000,
  });
}

function renderMathematicsGraph(range) {
  renderGraph({
    canvasId: 'mathematics-graph', data: mathematicsData, range,
    accent: '#3a6b85', accentRgb: '58,107,133',
    emptyMsg: 'No entries for this period — log a Mathematics balance below.',
    yLabelFn: v => Math.round(v).toLocaleString(),
    yPadFn: (min, max) => (max - min) * 0.08,
    capValue: 2000,
  });
}

function renderMnomicsGraph(range) {
  renderGraph({
    canvasId: 'mnomics-graph', data: mnomicsData, range,
    accent: '#3a6b85', accentRgb: '58,107,133',
    emptyMsg: 'No entries for this period — log a Mnomics balance below.',
    yLabelFn: v => Math.round(v).toLocaleString(),
    yPadFn: (min, max) => (max - min) * 0.08,
    capValue: 2000,
  });
}

function renderWolfMarkGraph(range) {
  renderGraph({
    canvasId: 'wolf-mark-graph', data: wolfMarkData, range,
    accent: '#7a2418', accentRgb: '122,36,24',
    emptyMsg: 'No entries for this period — log a Wolf Mark balance below.',
    yLabelFn: v => Math.round(v).toLocaleString(),
    yPadFn: (min, max) => (max - min) * 0.08,
    capValue: 20000,
  });
}

// Job level history — shares the unified renderer. The job being viewed is held
// in `currentJobModal` (set by openJobHistory in app.js); accent/cap come from it.
function renderJobHistoryGraph(range) {
  if (typeof currentJobModal === 'undefined' || !currentJobModal) return;
  const job = currentJobModal;
  renderGraph({
    canvasId: 'job-history-graph', data: jobLevels[job.id] || [], range,
    accent: job.accentHex, accentRgb: job.accentRgb,
    emptyMsg: 'No levels logged for this period — record a level on the card.',
    yLabelFn: v => Math.round(v).toLocaleString(),
    yPadFn: (min, max) => (max - min) * 0.12 || 2,
    capValue: job.max,
  });
}

function renderTrophyCrystalGraph(range) {
  renderGraph({
    canvasId: 'trophy-crystal-graph', data: trophyCrystalData, range,
    accent: '#7a2418', accentRgb: '122,36,24',
    emptyMsg: 'No entries for this period — log a Trophy Crystal balance below.',
    yLabelFn: v => Math.round(v).toLocaleString(),
    yPadFn: (min, max) => (max - min) * 0.08,
    capValue: 20000,
  });
}
