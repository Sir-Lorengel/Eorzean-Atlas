'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// CHARTS — canvas graph rendering (Gil, MGP, Venture, Seals)
// ═══════════════════════════════════════════════════════════════════════════

function formatGil(n) {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1e9) return sign + (abs / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B';
  if (abs >= 1e6) return sign + (abs / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
  if (abs >= 1e3) return sign + (abs / 1e3).toFixed(1).replace(/\.?0+$/, '') + 'k';
  return n.toLocaleString();
}

// Unified line graph renderer. All four currency trackers share this logic.
// Differences are passed in via opts: colors, data source, empty message,
// y-axis label formatter, padding calculation, and optional cap line.
// Per-card chart type ('line' | 'bar') is stored on the persisted `ui` object,
// keyed by canvas id, and defaults to 'line'.
function chartTypeFor(canvasId) {
  const type = typeof ui !== 'undefined' && ui.chartTypes ? ui.chartTypes[canvasId] : null;
  return ['bar', 'step', 'delta', 'highlow'].includes(type) ? type : 'line';
}

function dayKeyFor(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function latestEntryPerDay(points) {
  const byDay = new Map();
  points.forEach(point => {
    const date = new Date(point.date);
    const key = dayKeyFor(date);
    const existing = byDay.get(key);
    if (!existing || date.getTime() >= new Date(existing.date).getTime()) {
      byDay.set(key, point);
    }
  });
  return Array.from(byDay.values())
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

function chartTrendEnabled(canvasId) {
  return !!(typeof ui !== 'undefined' && ui.chartTrends && ui.chartTrends[canvasId]);
}

function rollingAveragePoints(points, windowSize = 7) {
  return points.map((point, index) => {
    const start = Math.max(0, index - windowSize + 1);
    const slice = points.slice(start, index + 1);
    const avg = slice.reduce((sum, p) => sum + p.amount, 0) / slice.length;
    return { ...point, amount: avg };
  });
}

function graphTooltipEl() {
  let tip = document.getElementById('graph-tooltip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'graph-tooltip';
    tip.className = 'graph-tooltip';
    document.body.appendChild(tip);
  }
  return tip;
}

function attachGraphTooltip({ canvas, plotPts, times, toX, yLabelFn, chartType }) {
  const tip = graphTooltipEl();
  const dateFmt = rangeDate => rangeDate.toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit'
  });
  canvas.onmousemove = event => {
    if (!plotPts.length) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    let nearest = 0;
    let nearestDist = Infinity;
    times.forEach((time, i) => {
      const dist = Math.abs(toX(time) - x);
      if (dist < nearestDist) { nearest = i; nearestDist = dist; }
    });
    const point = plotPts[nearest];
    const prev = nearest > 0 ? plotPts[nearest - 1] : null;
    const delta = chartType === 'delta'
      ? point.amount
      : prev ? point.amount - prev.amount : null;
    const deltaText = delta === null
      ? 'first visible entry'
      : `${delta >= 0 ? '+' : ''}${yLabelFn(delta)} from previous`;
    tip.innerHTML = `
      <div class="graph-tooltip-title">${dateFmt(new Date(point.date))}</div>
      <div class="graph-tooltip-value">${chartType === 'delta' ? 'Change ' : ''}${yLabelFn(point.amount)}</div>
      <div class="graph-tooltip-delta">${deltaText}</div>
    `;
    tip.style.left = `${event.clientX + 12}px`;
    tip.style.top = `${event.clientY + 12}px`;
    tip.style.display = 'block';
  };
  canvas.onmouseleave = () => { tip.style.display = 'none'; };
}

function renderGraph({ canvasId, data, range, accent, accentRgb, emptyMsg, yLabelFn, yPadFn, capValue, latestDaily = false }) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const chartType = chartTypeFor(canvasId);
  const showTrend = chartTrendEnabled(canvasId);

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

  const cutoffs = { '24h': Date.now() - 864e5, '7d': Date.now() - 7*864e5, '30d': Date.now() - 30*864e5, '1y': Date.now() - 365*864e5, 'all': 0 };
  const cutoff  = cutoffs[range] ?? 0;
  const filteredPts = [...data]
    .filter(p => new Date(p.date).getTime() >= cutoff)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const pts = latestDaily && range !== '24h'
    ? latestEntryPerDay(filteredPts)
    : filteredPts;

  if (pts.length === 0) {
    canvas.onmousemove = null;
    canvas.onmouseleave = null;
    ctx.fillStyle = textDim;
    ctx.font = `italic 13px 'Lora', Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emptyMsg, W / 2, H / 2);
    return;
  }

  const isDelta = chartType === 'delta';
  if (isDelta && pts.length < 2) {
    canvas.onmousemove = null;
    canvas.onmouseleave = null;
    ctx.fillStyle = textDim;
    ctx.font = `italic 13px 'Lora', Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Log at least two entries to show changes.', W / 2, H / 2);
    return;
  }

  const plotPts = isDelta
    ? pts.slice(1).map((p, i) => ({ ...p, amount: p.amount - pts[i].amount }))
    : pts;
  const amounts = plotPts.map(p => p.amount);
  const times   = plotPts.map(p => new Date(p.date).getTime());
  const minAmt  = Math.min(...amounts);
  const maxAmt  = !isDelta && capValue != null ? Math.max(...amounts, capValue) : Math.max(...amounts);
  const minT    = times[0];
  const maxT    = times[times.length - 1];
  const tSpan   = maxT - minT || 1;
  const yPad    = Math.abs(yPadFn(minAmt, maxAmt));
  const yMin    = isDelta ? Math.min(0, minAmt - yPad) : Math.max(0, minAmt - yPad);
  const yMax    = isDelta ? Math.max(0, maxAmt + yPad) : maxAmt + yPad;
  const ySpan   = yMax - yMin || 1;

  const pad = { top: 16, right: 16, bottom: 36, left: 66 };
  const cW  = W - pad.left - pad.right;
  const cH  = H - pad.top  - pad.bottom;

  const toX = t => pad.left + ((t - minT) / tSpan) * cW;
  const toY = v => pad.top  + cH - ((v - yMin) / ySpan) * cH;
  const drawTrend = () => {
    if (!showTrend || plotPts.length < 2) return;
    const trendPts = rollingAveragePoints(plotPts);
    ctx.save();
    ctx.strokeStyle = `rgba(${accentRgb},0.75)`;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    trendPts.forEach((p, i) => {
      const x = toX(new Date(p.date).getTime());
      const y = toY(p.amount);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  };
  attachGraphTooltip({ canvas, plotPts, times, toX, yLabelFn, chartType });

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
  const maxLabels = Math.min(plotPts.length, 7);
  const step = Math.max(1, Math.floor((plotPts.length - 1) / (maxLabels - 1 || 1)));
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for (let i = 0; i < plotPts.length; i += step) {
    const d = new Date(plotPts[i].date);
    const label = range === '24h'
      ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      : (range === '1y' || range === 'all')
        ? d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
        : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const x = toX(times[i]);
    ctx.fillStyle = textDim; ctx.fillText(label, x, pad.top + cH + 6);
    ctx.strokeStyle = ruleColor; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, pad.top + cH); ctx.lineTo(x, pad.top + cH + 4); ctx.stroke();
  }

  if (isDelta && yMin < 0 && yMax > 0) {
    const zeroY = toY(0);
    ctx.strokeStyle = `rgba(${accentRgb},0.28)`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad.left, zeroY); ctx.lineTo(pad.left + cW, zeroY); ctx.stroke();
  }

  // Optional cap line (used by Company Seals)
  if (!isDelta && capValue != null) {
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
  if (chartType === 'bar' || isDelta) {
    const baseY = isDelta ? toY(0) : pad.top + cH;
    const slot  = cW / plotPts.length;
    const barW  = Math.max(2, Math.min(slot * 0.7, 40));
    plotPts.forEach((p, i) => {
      const x = toX(times[i]);
      const y = isDelta && p.amount < 0 ? baseY : toY(p.amount);
      const h = isDelta ? Math.abs(baseY - toY(p.amount)) : Math.max(0, baseY - y);
      ctx.fillStyle = !isDelta || p.amount >= 0 ? `rgba(${accentRgb},0.55)` : 'rgba(176,68,44,0.45)';
      ctx.fillRect(x - barW / 2, y, barW, h);
      ctx.strokeStyle = !isDelta || p.amount >= 0 ? accent : '#b0442c'; ctx.lineWidth = 1.5;
      ctx.strokeRect(x - barW / 2, y, barW, h);
    });
    drawTrend();
    return;
  }

  if (plotPts.length === 1) {
    ctx.beginPath(); ctx.arc(toX(times[0]), toY(amounts[0]), 5, 0, Math.PI * 2);
    ctx.fillStyle = accent; ctx.fill();
    return;
  }

  if (chartType === 'step') {
    ctx.beginPath();
    ctx.moveTo(toX(times[0]), toY(amounts[0]));
    for (let i = 1; i < plotPts.length; i++) {
      ctx.lineTo(toX(times[i]), toY(amounts[i - 1]));
      ctx.lineTo(toX(times[i]), toY(amounts[i]));
    }
    ctx.strokeStyle = accent; ctx.lineWidth = 2;
    ctx.lineJoin = 'miter'; ctx.lineCap = 'butt'; ctx.stroke();

    plotPts.forEach((p, i) => {
      ctx.beginPath(); ctx.arc(toX(times[i]), toY(p.amount), 3.5, 0, Math.PI * 2);
      ctx.fillStyle = accent; ctx.fill();
      ctx.strokeStyle = '#f5efe1'; ctx.lineWidth = 1.5; ctx.stroke();
    });
    drawTrend();
    return;
  }

  if (chartType === 'highlow') {
    const high = Math.max(...amounts);
    const low = Math.min(...amounts);
    const highIndex = amounts.indexOf(high);
    const lowIndex = amounts.indexOf(low);
    const highY = toY(high);
    const lowY = toY(low);

    ctx.save();
    ctx.fillStyle = `rgba(${accentRgb},0.07)`;
    ctx.fillRect(pad.left, highY, cW, Math.max(1, lowY - highY));
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = `rgba(${accentRgb},0.62)`;
    ctx.beginPath(); ctx.moveTo(pad.left, highY); ctx.lineTo(pad.left + cW, highY); ctx.stroke();
    ctx.strokeStyle = 'rgba(176,68,44,0.55)';
    ctx.beginPath(); ctx.moveTo(pad.left, lowY); ctx.lineTo(pad.left + cW, lowY); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = `11px 'Cormorant Garamond', serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = `rgba(${accentRgb},0.8)`;
    ctx.fillText(`high ${yLabelFn(high)}`, pad.left + 6, highY - 3);
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(176,68,44,0.78)';
    ctx.fillText(`low ${yLabelFn(low)}`, pad.left + 6, lowY + 3);
    ctx.restore();

    ctx.beginPath();
    ctx.moveTo(toX(times[0]), toY(amounts[0]));
    for (let i = 1; i < plotPts.length; i++) ctx.lineTo(toX(times[i]), toY(amounts[i]));
    ctx.strokeStyle = accent; ctx.lineWidth = 2;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();

    plotPts.forEach((p, i) => {
      const isExtreme = i === highIndex || i === lowIndex;
      ctx.beginPath(); ctx.arc(toX(times[i]), toY(p.amount), isExtreme ? 5 : 3.5, 0, Math.PI * 2);
      ctx.fillStyle = i === lowIndex ? '#b0442c' : accent; ctx.fill();
      ctx.strokeStyle = '#f5efe1'; ctx.lineWidth = 1.5; ctx.stroke();
    });
    drawTrend();
    return;
  }

  // Area fill
  const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + cH);
  grad.addColorStop(0, `rgba(${accentRgb},0.20)`);
  grad.addColorStop(1, `rgba(${accentRgb},0.01)`);
  ctx.beginPath();
  ctx.moveTo(toX(times[0]), toY(amounts[0]));
  for (let i = 1; i < plotPts.length; i++) ctx.lineTo(toX(times[i]), toY(amounts[i]));
  ctx.lineTo(toX(times[times.length - 1]), pad.top + cH);
  ctx.lineTo(toX(times[0]), pad.top + cH);
  ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();

  // Line
  ctx.beginPath();
  ctx.moveTo(toX(times[0]), toY(amounts[0]));
  for (let i = 1; i < plotPts.length; i++) ctx.lineTo(toX(times[i]), toY(amounts[i]));
  ctx.strokeStyle = accent; ctx.lineWidth = 2;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();

  // Data points
  plotPts.forEach((p, i) => {
    ctx.beginPath(); ctx.arc(toX(times[i]), toY(p.amount), 3.5, 0, Math.PI * 2);
    ctx.fillStyle = accent; ctx.fill();
    ctx.strokeStyle = '#f5efe1'; ctx.lineWidth = 1.5; ctx.stroke();
  });
  drawTrend();
}

function renderGilGraph(range) {
  renderGraph({
    canvasId: 'gil-graph', data: gilData, range,
    accent: '#b1882a', accentRgb: '177,136,42',
    emptyMsg: 'No entries for this period — log a gil balance below.',
    yLabelFn: v => formatGil(Math.round(v)),
    yPadFn: (min, max) => (max - min) * 0.12 || max * 0.1 || 1000,
    latestDaily: true,
  });
}

function renderMgpGraph(range) {
  renderGraph({
    canvasId: 'mgp-graph', data: mgpData, range,
    accent: '#7b4fab', accentRgb: '123,79,171',
    emptyMsg: 'No entries for this period — log an MGP balance below.',
    yLabelFn: v => formatGil(Math.round(v)),
    yPadFn: (min, max) => (max - min) * 0.12 || max * 0.1 || 1000,
    latestDaily: true,
  });
}

function renderVentureGraph(range) {
  renderGraph({
    canvasId: 'venture-graph', data: ventureData, range,
    accent: '#2e7d6e', accentRgb: '46,125,110',
    emptyMsg: 'No entries for this period — log a Venture balance below.',
    yLabelFn: v => Math.round(v).toLocaleString(),
    yPadFn: (min, max) => (max - min) * 0.12 || max * 0.1 || 10,
    latestDaily: true,
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
    latestDaily: true,
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
    latestDaily: true,
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
    latestDaily: true,
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
    latestDaily: true,
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
    latestDaily: true,
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

function renderJobLevelGraph(job, accentVar, canvasId, range) {
  const [hex, rgb] = JOB_ACCENT_HEX[accentVar] || ['#b1882a', '177,136,42'];
  renderGraph({
    canvasId, data: jobLevels[job.id] || [], range,
    accent: hex, accentRgb: rgb,
    emptyMsg: 'No levels logged for this period.',
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
    latestDaily: true,
  });
}
