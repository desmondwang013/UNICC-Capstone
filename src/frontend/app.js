/* ── Config ── */
const API = 'http://localhost:8000';

/* ── State ── */
let currentProvider = 'anthropic';
let currentMode     = 'paste';
let currentFile     = null;
let currentReport   = null;
let history         = [];

/* ── Navigation ── */
function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${name}`).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const nb = document.getElementById(`nav-${name}`);
  if (nb) nb.classList.add('active');
  if (name === 'history') renderHistory();
}

/* ── Input mode ── */
function setMode(m) {
  currentMode = m;
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`mode-${m}`).classList.add('active');
  document.getElementById('mode-paste-area').classList.toggle('hidden', m !== 'paste');
  document.getElementById('mode-upload-area').classList.toggle('hidden', m !== 'upload');
}

/* ── File handling ── */
function handleFileSelect(e) {
  setFile(e.target.files[0]);
}
function handleDragOver(e) {
  e.preventDefault();
  document.getElementById('dropzone').classList.add('drag-over');
}
function handleDragLeave() {
  document.getElementById('dropzone').classList.remove('drag-over');
}
function handleDrop(e) {
  e.preventDefault();
  document.getElementById('dropzone').classList.remove('drag-over');
  const f = e.dataTransfer.files[0];
  if (f) setFile(f);
}
function setFile(f) {
  if (!f) return;
  currentFile = f;
  const info = document.getElementById('file-info');
  info.classList.remove('hidden');
  info.innerHTML = `📄 <strong>${f.name}</strong> — ${(f.size/1024).toFixed(1)} KB`;
}

/* ── Settings ── */
function toggleSettings() {
  const body    = document.getElementById('settings-body');
  const chevron = document.getElementById('settings-chevron');
  body.classList.toggle('hidden');
  chevron.classList.toggle('open');
}
function setProvider(p) {
  currentProvider = p;
  document.querySelectorAll('.provider-tab').forEach(t => t.classList.remove('active'));
  document.getElementById(`tab-${p}`).classList.add('active');
  ['anthropic','openai','local_slm'].forEach(id => {
    document.getElementById(`fields-${id}`).classList.toggle('hidden', id !== p);
  });
  updateProviderTag();
}
function updateProviderTag() {
  const tag = document.getElementById('provider-tag');
  if (currentProvider === 'anthropic') {
    tag.textContent = document.getElementById('anthropic_model').options[document.getElementById('anthropic_model').selectedIndex].text;
  } else if (currentProvider === 'openai') {
    tag.textContent = document.getElementById('openai_model').options[document.getElementById('openai_model').selectedIndex].text;
  } else {
    tag.textContent = document.getElementById('slm_model').value || 'Local SLM';
  }
}

/* ── Build LLM config ── */
function getLLMConfig() {
  if (currentProvider === 'anthropic') {
    const k = document.getElementById('anthropic_key').value.trim();
    const m = document.getElementById('anthropic_model').value;
    return k ? { provider: 'anthropic', model: m, api_key: k } : null;
  }
  if (currentProvider === 'openai') {
    const k = document.getElementById('openai_key').value.trim();
    if (!k) { showError('OpenAI API key is required.'); return undefined; }
    return { provider: 'openai', model: document.getElementById('openai_model').value, api_key: k };
  }
  if (currentProvider === 'local_slm') {
    return {
      provider: 'local_slm',
      model:    document.getElementById('slm_model').value.trim() || 'llama3.2',
      base_url: document.getElementById('slm_url').value.trim()  || 'http://localhost:11434/v1',
    };
  }
  return null;
}

/* ── Submit ── */
async function submitEvaluation() {
  clearError();
  const llmConfig = getLLMConfig();
  if (llmConfig === undefined) return;

  setLoading(true);
  showProgress(true);

  try {
    let report;

    if (currentMode === 'upload' && currentFile) {
      report = await submitFile(llmConfig);
    } else {
      const content = document.getElementById('paste-content').value.trim();
      if (!content) { showError('Please paste content or upload a file.'); return; }
      report = await submitText(content, llmConfig);
    }

    currentReport = report;
    history.unshift(report);
    renderReport(report);
    showView('results');

  } catch (e) {
    showError(`Evaluation failed: ${e.message}`);
  } finally {
    setLoading(false);
    showProgress(false);
  }
}

async function submitText(content, llmConfig) {
  advanceProgress(2);
  const body = {
    content,
    context:    document.getElementById('context-input').value.trim() || null,
    llm_config: llmConfig,
  };
  const res = await fetch(`${API}/evaluate`, {
    method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body),
  });
  if (!res.ok) { const e = await res.json().catch(()=>({detail:'Unknown error'})); throw new Error(e.detail); }
  advanceProgress(4);
  return res.json();
}

async function submitFile(llmConfig) {
  advanceProgress(2);
  const fd = new FormData();
  fd.append('file', currentFile);
  const ctx = document.getElementById('context-input').value.trim();
  if (ctx) fd.append('context', ctx);
  if (llmConfig) fd.append('llm_config_json', JSON.stringify(llmConfig));

  const res = await fetch(`${API}/evaluate/upload`, { method: 'POST', body: fd });
  if (!res.ok) { const e = await res.json().catch(()=>({detail:'Unknown error'})); throw new Error(e.detail); }
  advanceProgress(4);
  return res.json();
}

/* ── Progress steps ── */
let _progressStep = 0;
function showProgress(on) {
  const panel = document.getElementById('progress-panel');
  panel.classList.toggle('hidden', !on);
  if (on) {
    _progressStep = 0;
    document.querySelectorAll('.progress-step').forEach(s => {
      s.classList.remove('active','done');
    });
    advanceProgress(1);
  }
}
function advanceProgress(to) {
  for (let i = 1; i <= 4; i++) {
    const el = document.getElementById(`step-${i}`);
    if (!el) continue;
    el.classList.remove('active','done');
    if (i < to) el.classList.add('done');
    if (i === to) el.classList.add('active');
  }
  _progressStep = to;
}

function setLoading(on) {
  const btn = document.getElementById('submit-btn');
  btn.disabled = on;
  document.getElementById('submit-text').textContent = on ? 'Evaluating...' : 'Run Safety Evaluation';
  document.getElementById('submit-spinner').classList.toggle('hidden', !on);
}
function showError(msg) {
  const el = document.getElementById('submit-error');
  el.textContent = msg; el.classList.remove('hidden');
}
function clearError() {
  document.getElementById('submit-error').classList.add('hidden');
}

/* ── Render report ── */
function renderReport(r) {
  // Top bar
  document.getElementById('result-filename').textContent = r.filename || 'Pasted content';
  document.getElementById('result-ctype').textContent    = r.content_type;
  document.getElementById('result-ts').textContent       = fmtTs(r.timestamp);

  // Verdict banner
  const banner = document.getElementById('verdict-banner');
  banner.className = `verdict-banner ${verdictCls(r.deployment_verdict)}`;
  document.getElementById('vb-icon').textContent    = verdictIcon(r.deployment_verdict);
  document.getElementById('vb-verdict').textContent = r.deployment_verdict;
  document.getElementById('vb-summary').textContent = r.final_recommendation?.slice(0, 160) + '...';
  document.getElementById('vb-score').textContent   = Math.round(r.final_score) + '/100';
  document.getElementById('vb-tier').textContent    = tierShort(r.final_risk_tier);
  document.getElementById('vb-agree').textContent   = r.judge_agreement_level;

  // Top deductions
  renderDeductions(r.top_deductions || []);

  // Judge cards
  const grid = document.getElementById('judges-grid');
  grid.innerHTML = '';
  const colors = ['#ea4335','#1a73e8','#34a853'];
  r.verdicts.forEach((v, i) => grid.appendChild(buildJudgeCard(v, colors[i])));

  // Conditions
  const condSec = document.getElementById('conditions-section');
  if (r.conditions?.length) {
    condSec.classList.remove('hidden');
    document.getElementById('conditions-list').innerHTML = r.conditions.map((c, i) =>
      `<div class="condition-item"><span class="cond-num">${i+1}.</span><span>${c}</span></div>`
    ).join('');
  } else condSec.classList.add('hidden');

  // Lists
  renderFindingList('consensus-list', r.consensus_findings, false);
  renderFindingList('dissent-list',   r.dissenting_views,   true);

  // Critiques
  const cg = document.getElementById('critiques-body');
  cg.innerHTML = '';
  r.critiques.forEach(c => cg.appendChild(buildCritiqueCard(c)));
  cg.classList.add('hidden');
  document.getElementById('critiques-toggle-btn').textContent = 'Show ▾';

  // Synthesis
  document.getElementById('synthesis-text').textContent = r.full_synthesis;
}

function renderDeductions(deductions) {
  const list = document.getElementById('deductions-list');
  if (!deductions.length) {
    list.innerHTML = `<div style="color:var(--text-3);font-size:13px;padding:8px 0">No specific violations identified.</div>`;
    return;
  }
  list.innerHTML = deductions.map(d => `
    <div class="deduction-card">
      <div class="ded-rank">#${d.rank}</div>
      <div class="ded-body">
        <div class="ded-excerpt sev-${d.severity}">"${d.excerpt}"</div>
        <div class="ded-meta">
          <span class="ded-violation">${d.violation}</span>
          <span class="sev-pill sev-${d.severity}">${d.severity}</span>
          <span class="ded-judges">${d.judges?.join(', ') || ''}</span>
        </div>
      </div>
    </div>`).join('');
}

function buildJudgeCard(v, color) {
  const t = tierNum(v.risk_tier);
  const dims = v.dimension_scores.map(d => `
    <li class="dim-item">
      <span class="dim-name">${d.dimension}</span>
      <div class="dim-bar-wrap">
        <div class="dim-bar-bg"><div class="dim-bar-fill" style="width:${(d.score/5)*100}%;background:${color}"></div></div>
        <span class="dim-score-val">${d.score.toFixed(1)}</span>
      </div>
    </li>`).join('');
  const findings = v.key_findings.slice(0,3).map(f=>`<div class="jc-finding">${f}</div>`).join('');

  const card = document.createElement('div');
  card.className = 'judge-card';
  card.innerHTML = `
    <div class="jc-header"><div class="jc-dot" style="background:${color}"></div><div class="jc-name">${v.judge_name}</div></div>
    <div class="jc-score" style="color:${color}">${Math.round(v.overall_score)}<span style="font-size:13px;color:var(--text-3)">/100</span></div>
    <span class="jc-tier t${t}">${v.risk_tier}</span>
    <ul class="dim-list">${dims}</ul>
    <div class="jc-findings"><div class="jc-findings-lbl">Key Findings</div>${findings}</div>`;
  return card;
}

function buildCritiqueCard(c) {
  const agrees    = c.agreements.slice(0,2).map(a=>`<div class="crit-agree">${a}</div>`).join('');
  const disagrees = c.disagreements.slice(0,2).map(d=>`<div class="crit-disagree">${d}</div>`).join('');
  const revised   = c.revised_risk_tier
    ? `<div style="font-size:11px;margin-top:6px;color:var(--text-3)">Revised: <strong>${c.revised_risk_tier}</strong></div>` : '';
  const card = document.createElement('div');
  card.className = 'critique-card';
  card.innerHTML = `
    <div class="crit-header"><strong>${c.from_judge}</strong> reviewing <strong>${c.about_judge}</strong></div>
    ${agrees}${disagrees}
    ${c.additional_insights ? `<div class="crit-insight">${c.additional_insights.slice(0,140)}...</div>` : ''}
    ${revised}`;
  return card;
}

function renderFindingList(id, items, dissent) {
  const el = document.getElementById(id);
  if (!items?.length) { el.innerHTML = `<p style="color:var(--text-3);font-size:13px">None identified.</p>`; return; }
  el.innerHTML = `<ul class="finding-list ${dissent?'dissent-list':''}">${items.map(i=>`<li>${i}</li>`).join('')}</ul>`;
}

function toggleCritiques() {
  const body = document.getElementById('critiques-body');
  const btn  = document.getElementById('critiques-toggle-btn');
  const h = body.classList.toggle('hidden');
  btn.textContent = h ? 'Show ▾' : 'Hide ▴';
}

/* ── History ── */
function renderHistory() {
  const tbody = document.getElementById('history-tbody');
  const empty = document.getElementById('history-empty');
  const card  = document.getElementById('history-table-card');
  if (!history.length) {
    empty.classList.remove('hidden'); card.classList.add('hidden'); return;
  }
  empty.classList.add('hidden'); card.classList.remove('hidden');
  tbody.innerHTML = history.map((r, i) => `
    <tr>
      <td><strong>${r.filename || 'Pasted content'}</strong></td>
      <td><span style="color:var(--text-2)">${r.content_type}</span></td>
      <td style="color:var(--text-2)">${fmtTs(r.timestamp)}</td>
      <td><strong>${Math.round(r.final_score)}</strong>/100</td>
      <td>${tierShort(r.final_risk_tier)}</td>
      <td><span class="vpill ${vpillCls(r.deployment_verdict)}">${r.deployment_verdict}</span></td>
      <td><button class="btn-view" onclick="viewHistory(${i})">View</button></td>
    </tr>`).join('');
}
function viewHistory(i) {
  currentReport = history[i];
  renderReport(currentReport);
  showView('results');
}

/* ── Export ── */
function downloadReport() {
  if (!currentReport) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(currentReport, null, 2)], {type:'application/json'}));
  a.download = `safety-report-${currentReport.evaluation_id}.json`;
  a.click();
}

/* ── Helpers ── */
function verdictCls(v) {
  if (!v) return '';
  if (v.includes('WITH')) return 'conditions';
  if (v.includes('APPROVED')) return 'approved';
  if (v.includes('HUMAN')) return 'human-review';
  if (v.includes('REJECTED')) return 'rejected';
  return '';
}
function vpillCls(v) {
  if (!v) return '';
  if (v.includes('WITH')) return 'vp-conditions';
  if (v.includes('APPROVED')) return 'vp-approved';
  if (v.includes('HUMAN')) return 'vp-human';
  return 'vp-rejected';
}
function verdictIcon(v) {
  if (!v) return '•';
  if (v.includes('WITH')) return '⚠️';
  if (v.includes('APPROVED')) return '✅';
  if (v.includes('HUMAN')) return '👁️';
  return '🚫';
}
function tierShort(t) { return t?.replace('Tier ','T').replace(' - ',' ') || ''; }
function tierNum(t)   { const m = t?.match(/Tier (\d)/); return m ? m[1] : '1'; }
function fmtTs(ts)    { try { return new Date(ts).toLocaleString(); } catch { return ts; } }
