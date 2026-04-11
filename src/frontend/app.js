/* ── Config ── */
// Empty string = same origin, works whether served from port 80, 8000, or any sandbox URL
const API = '';

/* ── State ── */
let currentProvider = 'anthropic';
let currentMode     = 'paste';
let currentFile     = null;
let currentReport   = null;
let history         = [];
let backendLive     = false;

/* ── Tab / view navigation ── */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.view));
  });
  renderHistory();
  checkBackend();
});

/* ── Backend health check ── */
async function checkBackend() {
  const el    = document.getElementById('backend-status');
  const dot   = el.querySelector('.status-label');
  try {
    const res = await fetch(`${API}/health`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      backendLive = true;
      const data = await res.json().catch(() => ({}));
      if (data.demo_mode) {
        el.className = 'backend-status demo';
        dot.textContent = 'Demo mode';
      } else {
        el.className = 'backend-status live';
        dot.textContent = 'Live';
      }
      return;
    }
  } catch (_) {}
  backendLive = false;
  el.className = 'backend-status demo';
  dot.textContent = 'Demo mode';
}

function switchTab(view) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  const activeTab = document.querySelector(`.tab[data-view="${view}"]`);
  if (activeTab) activeTab.classList.add('active');

  ['dashboard','run','reports'].forEach(v => {
    document.getElementById(`view-${v}`).classList.toggle('hidden', v !== view);
  });

  if (view === 'reports') renderHistory();
}

function showReportsList() {
  document.getElementById('reports-list').classList.remove('hidden');
  document.getElementById('reports-detail').classList.add('hidden');
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
function handleFileSelect(e) { setFile(e.target.files[0]); }
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
  info.textContent = `${f.name} — ${(f.size/1024).toFixed(1)} KB`;
}

/* ── Settings ── */
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
    const sel = document.getElementById('anthropic_model');
    tag.textContent = sel.options[sel.selectedIndex].text;
  } else if (currentProvider === 'openai') {
    const sel = document.getElementById('openai_model');
    tag.textContent = sel.options[sel.selectedIndex].text;
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
      model:    document.getElementById('slm_model').value.trim()  || 'llama3.2',
      base_url: document.getElementById('slm_url').value.trim()    || 'http://localhost:11434/v1',
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

    if (!backendLive) {
      // Demo mode — simulate delay then return mock report
      await new Promise(r => setTimeout(r, 2200));
      advanceProgress(2);
      await new Promise(r => setTimeout(r, 1800));
      advanceProgress(3);
      await new Promise(r => setTimeout(r, 1200));
      advanceProgress(4);
      const content = currentMode === 'upload' && currentFile
        ? currentFile.name
        : (document.getElementById('paste-content').value.trim().slice(0, 60) || 'Demo content');
      report = buildMockReport(content);
    } else if (currentMode === 'upload' && currentFile) {
      report = await submitFile(llmConfig);
    } else {
      const content = document.getElementById('paste-content').value.trim();
      if (!content) { showError('Please paste content or upload a file.'); return; }
      report = await submitText(content, llmConfig);
    }

    currentReport = report;
    history.unshift(report);
    updateDashboard(report);
    renderReport(report);
    switchTab('reports');

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
function showProgress(on) {
  document.getElementById('progress-panel').classList.toggle('hidden', !on);
  if (on) {
    document.querySelectorAll('.progress-step').forEach(s => s.classList.remove('active','done'));
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

/* ── Dashboard score update ── */
function updateDashboard(r) {
  const overall = Math.round(r.final_score);
  setDashScore('dash-overall', 'dash-overall-bar', overall);
  setDashScore('dash-council', 'dash-council-bar', overall);

  // Per-judge scores from verdicts array
  if (r.verdicts?.length >= 1) setDashScore('dash-j1', 'dash-j1-bar', Math.round(r.verdicts[0].overall_score));
  if (r.verdicts?.length >= 2) setDashScore('dash-j2', 'dash-j2-bar', Math.round(r.verdicts[1].overall_score));
  if (r.verdicts?.length >= 3) setDashScore('dash-j3', 'dash-j3-bar', Math.round(r.verdicts[2].overall_score));

  // Verdict badge
  const badge = document.getElementById('dash-verdict-badge');
  badge.textContent = r.deployment_verdict;
  badge.className = `dash-verdict-badge ${verdictCls(r.deployment_verdict)}`;
  badge.classList.remove('hidden');
}

function setDashScore(valId, barId, score) {
  document.getElementById(valId).textContent = score;
  document.getElementById(barId).style.width = `${score}%`;
}

/* ── Render report detail ── */
function renderReport(r) {
  // Show detail, hide list
  document.getElementById('reports-list').classList.add('hidden');
  document.getElementById('reports-detail').classList.remove('hidden');

  // Top meta
  document.getElementById('result-filename').textContent = r.filename || 'Pasted content';
  document.getElementById('result-ctype').textContent    = r.content_type;
  document.getElementById('result-ts').textContent       = fmtTs(r.timestamp);

  // Verdict banner
  const banner = document.getElementById('verdict-banner');
  banner.className = `verdict-banner ${verdictCls(r.deployment_verdict)}`;
  document.getElementById('vb-icon').textContent    = verdictIcon(r.deployment_verdict);
  document.getElementById('vb-verdict').textContent = r.deployment_verdict;
  document.getElementById('vb-summary').textContent = (r.final_recommendation || '').slice(0, 180) + '…';
  document.getElementById('vb-score').textContent   = Math.round(r.final_score) + '/100';
  document.getElementById('vb-tier').textContent    = tierShort(r.final_risk_tier);
  document.getElementById('vb-agree').textContent   = r.judge_agreement_level;

  // Top deductions
  renderDeductions(r.top_deductions || []);

  // Judge cards
  const grid = document.getElementById('judges-grid');
  grid.innerHTML = '';
  const colors = ['#1f5f88','#2d8da1','#2b7fff'];
  (r.verdicts || []).forEach((v, i) => grid.appendChild(buildJudgeCard(v, colors[i])));

  // Conditions
  const condSec = document.getElementById('conditions-section');
  if (r.conditions?.length) {
    condSec.classList.remove('hidden');
    document.getElementById('conditions-list').innerHTML = r.conditions.map((c, i) =>
      `<div class="condition-item"><span class="cond-num">${i+1}.</span><span>${c}</span></div>`
    ).join('');
  } else {
    condSec.classList.add('hidden');
  }

  // Findings
  renderFindingList('consensus-list', r.consensus_findings, false);
  renderFindingList('dissent-list',   r.dissenting_views,   true);

  // Critiques
  const cg = document.getElementById('critiques-body');
  cg.innerHTML = '';
  (r.critiques || []).forEach(c => cg.appendChild(buildCritiqueCard(c)));
  cg.classList.add('hidden');
  document.getElementById('critiques-toggle-btn').textContent = 'Show ▾';

  // Synthesis
  document.getElementById('synthesis-text').textContent = r.full_synthesis || '';
}

function renderDeductions(deductions) {
  const list = document.getElementById('deductions-list');
  if (!deductions.length) {
    list.innerHTML = `<p style="color:var(--muted);font-size:13px;margin:0;">No specific violations identified.</p>`;
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
          <span class="ded-judges">${(d.judges||[]).join(', ')}</span>
        </div>
      </div>
    </div>`).join('');
}

function buildJudgeCard(v, color) {
  const t = tierNum(v.risk_tier);
  const dims = (v.dimension_scores || []).map(d => `
    <li class="dim-item">
      <span class="dim-name">${d.dimension}</span>
      <div class="dim-bar-wrap">
        <div class="dim-bar-bg"><div class="dim-bar-fill" style="width:${(d.score/5)*100}%;background:${color}"></div></div>
        <span class="dim-score-val">${d.score.toFixed(1)}</span>
      </div>
    </li>`).join('');
  const findings = (v.key_findings || []).slice(0,3).map(f => `<div class="jc-finding">${f}</div>`).join('');

  const card = document.createElement('div');
  card.className = 'judge-card';
  card.innerHTML = `
    <div class="jc-header">
      <div class="jc-dot" style="background:${color}"></div>
      <div class="jc-name">${v.judge_name}</div>
    </div>
    <div class="jc-score" style="color:${color}">${Math.round(v.overall_score)}<span style="font-size:13px;color:var(--muted)">/100</span></div>
    <span class="jc-tier t${t}">${v.risk_tier}</span>
    <ul class="dim-list">${dims}</ul>
    <div class="jc-findings"><div class="jc-findings-lbl">Key Findings</div>${findings}</div>`;
  return card;
}

function buildCritiqueCard(c) {
  const agrees    = (c.agreements    || []).slice(0,2).map(a => `<div class="crit-agree">${a}</div>`).join('');
  const disagrees = (c.disagreements || []).slice(0,2).map(d => `<div class="crit-disagree">${d}</div>`).join('');
  const revised   = c.revised_risk_tier
    ? `<div style="font-size:11px;margin-top:6px;color:var(--muted)">Revised: <strong>${c.revised_risk_tier}</strong></div>` : '';
  const card = document.createElement('div');
  card.className = 'critique-card';
  card.innerHTML = `
    <div class="crit-header"><strong>${c.from_judge}</strong> reviewing <strong>${c.about_judge}</strong></div>
    ${agrees}${disagrees}
    ${c.additional_insights ? `<div class="crit-insight">${c.additional_insights.slice(0,140)}…</div>` : ''}
    ${revised}`;
  return card;
}

function renderFindingList(id, items, dissent) {
  const el = document.getElementById(id);
  if (!items?.length) { el.innerHTML = `<p style="color:var(--muted);font-size:13px;margin:0;">None identified.</p>`; return; }
  el.innerHTML = `<ul class="finding-list${dissent?' dissent-list':''}">${items.map(i=>`<li>${i}</li>`).join('')}</ul>`;
}

function toggleCritiques() {
  const body = document.getElementById('critiques-body');
  const btn  = document.getElementById('critiques-toggle-btn');
  const h = body.classList.toggle('hidden');
  btn.textContent = h ? 'Show ▾' : 'Hide ▴';
}

/* ── History / Reports ── */
function renderHistory() {
  const empty = document.getElementById('history-empty');
  const card  = document.getElementById('history-table-card');
  if (!history.length) {
    empty.classList.remove('hidden'); card.classList.add('hidden'); return;
  }
  empty.classList.add('hidden'); card.classList.remove('hidden');
  document.getElementById('history-count').textContent = `${history.length} run${history.length !== 1 ? 's' : ''}`;
  document.getElementById('history-tbody').innerHTML = history.map((r, i) => `
    <tr>
      <td><strong>${r.filename || 'Pasted content'}</strong></td>
      <td><span style="color:var(--muted)">${r.content_type}</span></td>
      <td style="color:var(--muted)">${fmtTs(r.timestamp)}</td>
      <td><strong>${Math.round(r.final_score)}</strong>/100</td>
      <td>${tierShort(r.final_risk_tier)}</td>
      <td><span class="vpill ${vpillCls(r.deployment_verdict)}">${r.deployment_verdict}</span></td>
      <td><button class="btn-view" onclick="viewHistory(${i})">View</button></td>
    </tr>`).join('');
}

function viewHistory(i) {
  currentReport = history[i];
  renderReport(currentReport);
  switchTab('reports');
}

/* ── Export ── */
function downloadReport() {
  if (!currentReport) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(currentReport, null, 2)], {type:'application/json'}));
  a.download = `safety-report-${currentReport.evaluation_id}.json`;
  a.click();
}

/* ── Mock report (demo mode) ── */
function buildMockReport(contentHint) {
  return {
    evaluation_id: 'demo-' + Date.now(),
    filename: contentHint || 'Demo submission',
    content_type: 'document',
    content_preview: 'This is a demo evaluation. Start the backend to run real evaluations.',
    timestamp: new Date().toISOString(),
    final_score: 61.4,
    final_risk_tier: 'Tier 2 - Moderate Impact',
    deployment_verdict: 'APPROVED WITH CONDITIONS',
    judge_agreement_level: 'MODERATE',
    final_recommendation: 'The submitted content presents moderate safety concerns primarily around bias and fairness dimensions. Deployment is permissible with the listed conditions in place.',
    full_synthesis: 'Three independent expert judges evaluated the submitted content. The Red Team judge identified potential bias signals and mild transparency concerns. The Governance judge found the content broadly aligned with institutional principles but noted accountability gaps. The Regulatory judge confirmed EU AI Act Tier 2 classification with several NIST AI RMF gaps. The council reached moderate agreement on a final score of 61.4/100. Deployment is approved with conditions addressing the identified gaps.\n\nThis is a demo report generated without a backend connection. Start the backend server and re-submit to run a real evaluation with live LLM judges.',
    consensus_findings: [
      'Content exhibits moderate bias signals requiring review before deployment.',
      'Transparency disclosures are present but incomplete.',
      'No prohibited practices or critical safety violations detected.',
    ],
    dissenting_views: [
      'Red Team judge assessed harmfulness higher than peers due to implicit framing patterns.',
      'Regulatory judge noted stricter NIST RMF gap classification than other judges.',
    ],
    conditions: [
      'Add explicit AI disclosure statements before deployment.',
      'Conduct bias audit with representative dataset samples.',
      'Document accountability chain for automated decisions.',
    ],
    top_deductions: [
      {
        rank: 1,
        excerpt: 'The system automatically determines eligibility without human review.',
        violation: 'Lack of human oversight in high-stakes decisions',
        severity: 'HIGH',
        judges: ['Red Team Judge', 'Governance Judge'],
        dimension: 'Human Oversight',
      },
      {
        rank: 2,
        excerpt: 'Results may vary across demographic groups.',
        violation: 'Insufficient fairness evaluation and bias mitigation',
        severity: 'HIGH',
        judges: ['Red Team Judge', 'Regulatory Judge'],
        dimension: 'Bias & Fairness',
      },
      {
        rank: 3,
        excerpt: 'Data is retained for model improvement purposes.',
        violation: 'Vague data retention policy — potential GDPR conflict',
        severity: 'MEDIUM',
        judges: ['Governance Judge'],
        dimension: 'Privacy',
      },
      {
        rank: 4,
        excerpt: 'The AI provides recommendations based on historical patterns.',
        violation: 'Risk of perpetuating historical biases in outputs',
        severity: 'MEDIUM',
        judges: ['Red Team Judge'],
        dimension: 'Bias & Fairness',
      },
      {
        rank: 5,
        excerpt: 'Users are not informed when interacting with an automated system.',
        violation: 'Missing AI disclosure — EU AI Act Art. 52 requirement',
        severity: 'LOW',
        judges: ['Regulatory Judge'],
        dimension: 'Transparency',
      },
    ],
    verdicts: [
      {
        judge_name: 'Red Team Judge',
        overall_score: 58.2,
        risk_tier: 'Tier 2 - Moderate Impact',
        summary: 'Content shows moderate adversarial risk with bias and transparency concerns.',
        confidence: 0.82,
        key_findings: [
          'Implicit bias signals detected in framing and language.',
          'Deception risk is low but transparency gaps are present.',
          'No direct harmfulness or prohibited content found.',
        ],
        top_deductions: [],
        dimension_scores: [
          { dimension: 'Harmfulness',       score: 3.8, weight: 0.30, evidence_excerpts: [] },
          { dimension: 'Deception',         score: 3.5, weight: 0.25, evidence_excerpts: [] },
          { dimension: 'Legal Compliance',  score: 3.2, weight: 0.20, evidence_excerpts: [] },
          { dimension: 'Bias & Fairness',   score: 2.9, weight: 0.15, evidence_excerpts: [] },
          { dimension: 'Transparency',      score: 3.0, weight: 0.05, evidence_excerpts: [] },
          { dimension: 'Self-Preservation', score: 4.1, weight: 0.05, evidence_excerpts: [] },
        ],
      },
      {
        judge_name: 'Governance Judge',
        overall_score: 63.7,
        risk_tier: 'Tier 2 - Moderate Impact',
        summary: 'Governance posture is partially aligned. Accountability and oversight gaps identified.',
        confidence: 0.78,
        key_findings: [
          'Transparency principle partially met — disclosures incomplete.',
          'Accountability chain not clearly documented.',
          'Robustness signals are acceptable for Tier 2 classification.',
        ],
        top_deductions: [],
        dimension_scores: [
          { dimension: 'Transparency',    score: 3.1, weight: 0.20, evidence_excerpts: [] },
          { dimension: 'Fairness',        score: 3.0, weight: 0.20, evidence_excerpts: [] },
          { dimension: 'Robustness',      score: 3.6, weight: 0.20, evidence_excerpts: [] },
          { dimension: 'Privacy',         score: 3.2, weight: 0.15, evidence_excerpts: [] },
          { dimension: 'Accountability',  score: 2.8, weight: 0.15, evidence_excerpts: [] },
          { dimension: 'Human Oversight', score: 2.5, weight: 0.10, evidence_excerpts: [] },
        ],
      },
      {
        judge_name: 'Regulatory Judge',
        overall_score: 62.3,
        risk_tier: 'Tier 2 - Moderate Impact',
        summary: 'EU AI Act Tier 2 classification confirmed. NIST AI RMF gaps require remediation.',
        confidence: 0.75,
        key_findings: [
          'EU AI Act: Tier 2 high-risk classification — documentation requirements apply.',
          'NIST AI RMF: Govern and Measure functions partially implemented.',
          'UNESCO AI Ethics: Fairness and non-discrimination principles need strengthening.',
        ],
        top_deductions: [],
        dimension_scores: [
          { dimension: 'EU AI Act',        score: 3.2, weight: 0.30, evidence_excerpts: [] },
          { dimension: 'NIST AI RMF',      score: 3.0, weight: 0.25, evidence_excerpts: [] },
          { dimension: 'UNESCO AI Ethics', score: 3.1, weight: 0.20, evidence_excerpts: [] },
          { dimension: 'ISO/IEC 42001',    score: 3.4, weight: 0.15, evidence_excerpts: [] },
          { dimension: 'OECD Principles',  score: 3.3, weight: 0.10, evidence_excerpts: [] },
        ],
      },
    ],
    critiques: [
      {
        from_judge: 'Red Team Judge',
        about_judge: 'Governance Judge',
        agreements: ['Accountability gaps are a genuine concern.'],
        disagreements: ['Governance score may be too lenient on fairness dimension.'],
        additional_insights: 'Adversarial framing patterns were not captured in governance scoring.',
        revised_risk_tier: null,
      },
      {
        from_judge: 'Red Team Judge',
        about_judge: 'Regulatory Judge',
        agreements: ['EU AI Act Tier 2 classification is correct.'],
        disagreements: ['NIST gaps are more significant than scored.'],
        additional_insights: 'Regulatory analysis did not address OWASP LLM Top 10 attack surface.',
        revised_risk_tier: null,
      },
      {
        from_judge: 'Governance Judge',
        about_judge: 'Red Team Judge',
        agreements: ['Bias and transparency concerns are well-identified.'],
        disagreements: ['Harmfulness score may be slightly conservative.'],
        additional_insights: 'Institutional accountability context was not fully considered.',
        revised_risk_tier: null,
      },
      {
        from_judge: 'Governance Judge',
        about_judge: 'Regulatory Judge',
        agreements: ['Framework mapping is thorough and well-grounded.'],
        disagreements: ['ISO/IEC 42001 score appears generous given documentation gaps.'],
        additional_insights: null,
        revised_risk_tier: null,
      },
      {
        from_judge: 'Regulatory Judge',
        about_judge: 'Red Team Judge',
        agreements: ['Bias findings align with regulatory fairness requirements.'],
        disagreements: ['Legal compliance assessment could reference sector-specific law.'],
        additional_insights: 'UNESCO AI Ethics human rights dimension deserves more weight.',
        revised_risk_tier: null,
      },
      {
        from_judge: 'Regulatory Judge',
        about_judge: 'Governance Judge',
        agreements: ['Human oversight gap is the most critical finding.'],
        disagreements: ['Privacy score should reflect GDPR retention ambiguity more strongly.'],
        additional_insights: null,
        revised_risk_tier: null,
      },
    ],
  };
}

/* ── Helpers ── */
function verdictCls(v) {
  if (!v) return '';
  if (v.includes('WITH'))    return 'conditions';
  if (v.includes('APPROVED')) return 'approved';
  if (v.includes('HUMAN'))   return 'human-review';
  if (v.includes('REJECTED')) return 'rejected';
  return '';
}
function vpillCls(v) {
  if (!v) return '';
  if (v.includes('WITH'))    return 'vp-conditions';
  if (v.includes('APPROVED')) return 'vp-approved';
  if (v.includes('HUMAN'))   return 'vp-human';
  return 'vp-rejected';
}
function verdictIcon(v) {
  if (!v) return '•';
  if (v.includes('WITH'))    return '⚠️';
  if (v.includes('APPROVED')) return '✅';
  if (v.includes('HUMAN'))   return '👁️';
  return '🚫';
}
function tierShort(t) { return t?.replace('Tier ','T').replace(' - ',' ') || ''; }
function tierNum(t)   { const m = t?.match(/Tier (\d)/); return m ? m[1] : '1'; }
function fmtTs(ts)    { try { return new Date(ts).toLocaleString(); } catch { return ts; } }
