import React, { useState, useEffect, useRef } from 'react';
import { 
    ShieldAlert, Search, Edit2, CheckCircle2, ArrowRight, 
    Link as LinkIcon, Play, Shield, Terminal, Zap, FileCheck, CheckCircle, AlertCircle, Download, FileText, Activity, ExternalLink
} from 'lucide-react';
import { 
    Project, ProjectStatus, DOMAINS, CAPABILITIES, RiskTier, 
    ClassificationState, AuditLog, AgentRole, TestProtocol, TestResult, TestCategory 
} from '../types';
import { analyzeSystemRisk, generateAuditAttack, queryTargetModel, judgeInteraction, generateBenchmarkPrompt } from '../services/geminiService';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

interface NewAssessmentProps {
  onProjectCreate: (project: Project) => void;
  currentUser: string;
}

const NewAssessment: React.FC<NewAssessmentProps> = ({ onProjectCreate, currentUser }) => {
  const [step, setStep] = useState(1);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiReasoning, setAiReasoning] = useState<string | null>(null);
  const [showManualOverride, setShowManualOverride] = useState(false);
  
  // Project Info State
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  
  // Risk State
  const [riskState, setRiskState] = useState<ClassificationState>({
    domain: '',
    capabilities: [],
    isHighAutonomy: false,
    calculatedTier: null,
  });
  const [aiDeterminedTier, setAiDeterminedTier] = useState<RiskTier | null>(null);

  // Technical State
  const [endpointUrl, setEndpointUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'IDLE' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [connectionErrorMsg, setConnectionErrorMsg] = useState('');

  // Evaluator State
  const [isAuditRunning, setIsAuditRunning] = useState(false);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  
  // Dual-Suite Protocols
  const [protocols, setProtocols] = useState<TestProtocol[]>([
    // Suite A: Core Benchmarks (Section 4)
    { id: 'bias', name: 'Fairness (Prop F1)', description: 'Demographic Parity Check', category: 'SUITE_A_CORE', requiredForTiers: [RiskTier.TIER_2, RiskTier.TIER_3], active: true },
    { id: 'robustness', name: 'Robustness (Prop R1)', description: 'Noise Perturbation Test', category: 'SUITE_A_CORE', requiredForTiers: [RiskTier.TIER_2, RiskTier.TIER_3], active: true },
    { id: 'transparency', name: 'Transparency (Prop T1)', description: 'Documentation Audit', category: 'SUITE_A_CORE', requiredForTiers: [RiskTier.TIER_2, RiskTier.TIER_3], active: true },
    { id: 'explainability', name: 'Explainability (Prop T2)', description: 'CoT Reasoning Check', category: 'SUITE_A_CORE', requiredForTiers: [RiskTier.TIER_3], active: true },
    { id: 'privacy_doc', name: 'Privacy (Prop P1)', description: 'Data Minimization Audit', category: 'SUITE_A_CORE', requiredForTiers: [RiskTier.TIER_2, RiskTier.TIER_3], active: true },

    // Suite B: Adversarial (Section 5)
    { id: 'evasion', name: 'Evasion (Protocol 1)', description: 'PGD Attack Resilience', category: 'SUITE_B_ADVERSARIAL', requiredForTiers: [RiskTier.TIER_3], active: true },
    { id: 'poison', name: 'Poisoning (Protocol 2)', description: 'Backdoor Trigger Test', category: 'SUITE_B_ADVERSARIAL', requiredForTiers: [RiskTier.TIER_3], active: true },
    { id: 'privacy_inf', name: 'Inference (Protocol 3)', description: 'PII Leakage Probe', category: 'SUITE_B_ADVERSARIAL', requiredForTiers: [RiskTier.TIER_3], active: true },
    { id: 'redteam', name: 'Misuse (Protocol 4)', description: 'Jailbreak Red Teaming', category: 'SUITE_B_ADVERSARIAL', requiredForTiers: [RiskTier.TIER_3], active: true },
  ]);

  const logScrollRef = useRef<HTMLDivElement>(null);

  // --- Step 1 Logic (Risk Classification) ---
  const calculateRisk = () => {
    const { domain, capabilities, isHighAutonomy } = riskState;
    if (!domain && !description) {
        setRiskState(s => ({ ...s, calculatedTier: null }));
        return;
    }
    let logicalTier = RiskTier.TIER_1;
    const isProhibited = DOMAINS.PROHIBITED.some(p => domain === p);
    if (isProhibited) {
       logicalTier = RiskTier.TIER_4;
    } else {
        const isHighRiskDomain = DOMAINS.HIGH_RISK.includes(domain);
        const hasCapabilities = capabilities.length > 0;
        if (hasCapabilities || (isHighRiskDomain && isHighAutonomy)) {
            logicalTier = RiskTier.TIER_3;
        } else if (isHighRiskDomain && !hasCapabilities) {
            logicalTier = RiskTier.TIER_2;
        } else {
            logicalTier = RiskTier.TIER_1;
        }
    }
    setRiskState(s => ({ ...s, calculatedTier: logicalTier }));
  };

  useEffect(() => {
    calculateRisk();
  }, [riskState.domain, riskState.capabilities, riskState.isHighAutonomy]);

  const handleAnalyze = async () => {
    if (!description.trim()) return;
    setIsAnalyzing(true);
    setAiReasoning(null);
    setAiDeterminedTier(null);
    
    const result = await analyzeSystemRisk(description);
    
    let matchedDomain = result.suggestedDomain;
    const allDomains = [...DOMAINS.HIGH_RISK, ...DOMAINS.LOW_RISK, ...DOMAINS.PROHIBITED];
    const found = allDomains.find(d => d.toLowerCase() === result.suggestedDomain.toLowerCase());
    if (found) matchedDomain = found;

    const matchedCapabilities = CAPABILITIES.filter(cap => result.detectedCapabilities.includes(cap));

    setRiskState({
        domain: matchedDomain,
        capabilities: matchedCapabilities,
        isHighAutonomy: result.isHighAutonomy,
        calculatedTier: null 
    });
    
    setAiReasoning(result.reasoning);
    setAiDeterminedTier(result.suggestedTier);
    setIsAnalyzing(false);
    setShowManualOverride(false); 
  };

  const getTierColor = (tier: RiskTier | null) => {
    switch (tier) {
      case RiskTier.TIER_1: return 'bg-green-50 text-green-900 border-green-200';
      case RiskTier.TIER_2: return 'bg-yellow-50 text-yellow-900 border-yellow-200';
      case RiskTier.TIER_3: return 'bg-orange-50 text-orange-900 border-orange-200';
      case RiskTier.TIER_4: return 'bg-red-50 text-red-900 border-red-200';
      default: return 'bg-gray-50 text-gray-500 border-gray-200';
    }
  };

  const displayTier = (!showManualOverride && aiDeterminedTier) ? aiDeterminedTier : riskState.calculatedTier;

  // --- Step 2 Logic (Technical Connection) ---
  const handleTestConnection = async () => {
    if (!endpointUrl) return;
    setIsTestingConnection(true);
    setConnectionStatus('IDLE');
    setConnectionErrorMsg('');
    
    try {
        // Perform a real check by sending a test message
        const response = await queryTargetModel("Hello", endpointUrl, apiKey);
        
        if (response.startsWith("[Connection Failed]")) {
            setConnectionStatus('ERROR');
            setConnectionErrorMsg(response);
        } else {
            setConnectionStatus('SUCCESS');
        }
    } catch (e: any) {
        setConnectionStatus('ERROR');
        setConnectionErrorMsg(e.message || "Unknown Connection Error");
    } finally {
        setIsTestingConnection(false);
    }
  };

  // --- Step 3 Logic (Evaluator) ---
  useEffect(() => {
    if (logScrollRef.current) logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight;
  }, [logs]);

  const addLog = (role: AgentRole, content: string, metadata?: any) => {
    setLogs(prev => [...prev, {
      id: Math.random().toString(36).substring(7),
      role,
      content,
      timestamp: Date.now(),
      metadata
    }]);
  };

  const updateTestStatus = (protocolId: string, status: TestResult['status'], score: number) => {
      setTestResults(prev => {
          const existing = prev.filter(r => r.protocolId !== protocolId);
          return [...existing, { protocolId, status, score, logs: [] }];
      });
  };

  const runSingleTest = async (protocol: TestProtocol) => {
    updateTestStatus(protocol.id, 'RUNNING', 0);
    
    // Determine context for prompt
    let prompt = "";
    if (protocol.category === 'SUITE_A_CORE') {
        prompt = await generateBenchmarkPrompt(protocol.id, description);
    } else {
        prompt = await generateAuditAttack(protocol.id, description);
    }

    addLog(AgentRole.AUDITOR, `[${protocol.id.toUpperCase()}] ${prompt}`);
    await new Promise(r => setTimeout(r, 800));

    // Call Real API (or fallback if URL is bad/demo)
    const response = await queryTargetModel(prompt, endpointUrl, apiKey);
    addLog(AgentRole.TARGET, response);
    await new Promise(r => setTimeout(r, 800));

    const judgment = await judgeInteraction(prompt, response, protocol.id);
    addLog(AgentRole.JUDGE, `Verdict: ${judgment.verdict}. ${judgment.reasoning}`, { verdict: judgment.verdict });
    
    updateTestStatus(protocol.id, judgment.verdict, judgment.score);
  };

  const runFullAudit = async (category?: TestCategory) => {
    if (isAuditRunning) return;
    setIsAuditRunning(true);
    setLogs([]);
    setTestResults([]);

    // Filter protocols based on detected Risk Tier and Category
    const relevantProtocols = protocols.filter(p => {
        if (category && p.category !== category) return false;
        if (!p.active) return false;
        if (!displayTier) return false;
        return p.requiredForTiers.includes(displayTier);
    });

    if (relevantProtocols.length === 0) {
        addLog(AgentRole.JUDGE, "No relevant protocols for this Tier/Selection.");
        setIsAuditRunning(false);
        return;
    }

    for (const protocol of relevantProtocols) {
        await runSingleTest(protocol);
        await new Promise(r => setTimeout(r, 500));
    }
    setIsAuditRunning(false);
  };

  const getPassRate = (category: TestCategory) => {
      const relevant = protocols.filter(p => p.category === category && displayTier && p.requiredForTiers.includes(displayTier));
      if (relevant.length === 0) return 0; 
      const passed = relevant.filter(p => testResults.find(r => r.protocolId === p.id && r.status === 'PASS'));
      return (passed.length / relevant.length) * 100;
  };

  // --- Report Generation (Step 4) ---
  const generateSafetyReportPDF = () => {
    const doc = new jsPDF();
    const safetyScore = (testResults.filter(r => r.status === 'PASS').length / (testResults.length || 1) * 100).toFixed(0);

    // Header
    doc.setFillColor(0, 158, 219); // UN Blue
    doc.rect(0, 0, 210, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("AI SAFETY CASE REPORT", 105, 18, { align: "center" });
    
    doc.setFontSize(10);
    doc.text("United Nations International Computing Centre", 105, 25, { align: "center" });

    // Section 1: Executive Summary
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("1. Executive Summary", 14, 45);

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    const summaryData = [
        ["System Name", projectName || "Untitled Project"],
        ["Risk Classification", displayTier || "Unclassified"],
        ["Domain", riskState.domain || "N/A"],
        ["Safety Score", `${safetyScore}%`],
        ["Assessment Date", new Date().toLocaleDateString()]
    ];

    autoTable(doc, {
        startY: 50,
        head: [['Metric', 'Value']],
        body: summaryData,
        theme: 'striped',
        headStyles: { fillColor: [0, 158, 219] },
        styles: { fontSize: 10 }
    });

    // Section 2: Visual Charts (Simulated with bars)
    let finalY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("2. Benchmark Performance (Pass Rate)", 14, finalY);

    const suiteAPassRate = getPassRate('SUITE_A_CORE');
    const suiteBPassRate = getPassRate('SUITE_B_ADVERSARIAL');

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Core Safety Compliance (Suite A)", 14, finalY + 10);
    doc.setFillColor(200, 200, 200);
    doc.rect(14, finalY + 12, 100, 6, 'F'); 
    doc.setFillColor(0, 158, 219);
    doc.rect(14, finalY + 12, suiteAPassRate, 6, 'F');
    doc.text(`${suiteAPassRate.toFixed(0)}%`, 120, finalY + 16);

    doc.text("Adversarial Resilience (Suite B)", 14, finalY + 25);
    doc.setFillColor(200, 200, 200);
    doc.rect(14, finalY + 27, 100, 6, 'F');
    doc.setFillColor(220, 50, 50); 
    doc.rect(14, finalY + 27, suiteBPassRate, 6, 'F');
    doc.text(`${suiteBPassRate.toFixed(0)}%`, 120, finalY + 31);

    // Section 3: Detailed Audit Logs
    finalY = finalY + 45;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("3. Detailed Audit Logs (Appendix)", 14, finalY);

    const logData = logs.map(l => {
        return [
            new Date(l.timestamp).toLocaleTimeString(),
            l.role,
            l.content,
            l.metadata?.verdict || '-'
        ];
    });

    autoTable(doc, {
        startY: finalY + 5,
        head: [['Time', 'Agent', 'Message/Content', 'Verdict']],
        body: logData,
        theme: 'grid',
        headStyles: { fillColor: [51, 51, 51] },
        columnStyles: {
            2: { cellWidth: 90 }, 
        },
        styles: { fontSize: 8, overflow: 'linebreak' }
    });

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(`Page ${i} of ${pageCount}`, 195, 290, { align: "right" });
        doc.text(`UNICC AI Safety Framework v3.0 - Generated Report`, 14, 290);
    }

    doc.save(`Safety_Report_${projectName.replace(/\s+/g, '_')}.pdf`);
  };

  // --- Final Submission ---
  const handleSubmit = () => {
    const newProject: Project = {
        id: Math.random().toString(36).substring(7),
        name: projectName || 'Untitled Project',
        description,
        owner: currentUser,
        status: ProjectStatus.PENDING_REVIEW,
        submittedAt: Date.now(),
        domain: riskState.domain,
        capabilities: riskState.capabilities,
        isHighAutonomy: riskState.isHighAutonomy,
        riskTier: displayTier,
        riskReasoning: aiReasoning || 'Manual classification',
        connectionType: 'API',
        endpointUrl,
        auditLogs: logs,
        testResults,
        safetyScore: testResults.filter(r => r.status === 'PASS').length / (testResults.length || 1) * 100
    };
    onProjectCreate(newProject);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
        <div className="flex items-center justify-between">
            <div>
                <h2 className="text-2xl font-bold text-unDark">New Assessment</h2>
                <p className="text-gray-500">Register and certify a new AI system.</p>
            </div>
            {/* Stepper */}
            <div className="flex items-center space-x-2">
                {[1, 2, 3, 4].map(s => (
                    <div key={s} className="flex items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                            step === s ? 'bg-unBlue text-white' : 
                            step > s ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                        }`}>
                            {step > s ? <CheckCircle2 size={16} /> : s}
                        </div>
                        {s < 4 && <div className={`w-8 h-1 ${step > s ? 'bg-green-500' : 'bg-gray-200'}`}></div>}
                    </div>
                ))}
            </div>
        </div>

        {/* --- STEP 1: METADATA & RISK --- */}
        {step === 1 && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fadeIn">
                <div className="lg:col-span-8 space-y-6">
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <h3 className="text-lg font-semibold mb-4">Project Metadata</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
                                <input 
                                    type="text" 
                                    value={projectName}
                                    onChange={(e) => setProjectName(e.target.value)}
                                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-unBlue outline-none"
                                    placeholder="e.g. Refugee Logistics Assistant"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">System Description</label>
                                <textarea 
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-unBlue outline-none text-sm resize-none"
                                    placeholder="Describe the AI's purpose, deployment context, and capabilities..."
                                />
                            </div>
                            <button 
                                onClick={handleAnalyze}
                                disabled={isAnalyzing || !description}
                                className={`px-4 py-2 rounded-lg text-white font-medium flex items-center space-x-2 ${
                                    isAnalyzing || !description ? 'bg-gray-300' : 'bg-unBlue hover:bg-blue-600'
                                }`}
                            >
                                {isAnalyzing ? <span>Analyzing...</span> : <><Search size={16} /><span>Analyze Risk</span></>}
                            </button>
                        </div>
                    </div>

                    {/* Manual/Auto Risk Inputs */}
                    {(displayTier || showManualOverride) && (
                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm animate-slideIn">
                             <div className="flex justify-between items-center mb-4">
                                <h3 className="font-semibold text-gray-800">Risk Factors</h3>
                                {!showManualOverride && (
                                    <button onClick={() => setShowManualOverride(true)} className="text-xs text-unBlue flex items-center hover:underline">
                                        <Edit2 size={12} className="mr-1"/> Edit Analysis
                                    </button>
                                )}
                             </div>
                             
                             <div className={`grid grid-cols-2 gap-4 ${!showManualOverride ? 'pointer-events-none opacity-80' : ''}`}>
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase">Domain</label>
                                    <select 
                                        className="w-full mt-1 p-2 border rounded-md text-sm"
                                        value={riskState.domain}
                                        onChange={(e) => setRiskState(s => ({ ...s, domain: e.target.value }))}
                                    >
                                        <option value="">Select Domain</option>
                                        <optgroup label="High Risk">{DOMAINS.HIGH_RISK.map(d => <option key={d} value={d}>{d}</option>)}</optgroup>
                                        <optgroup label="Low Risk">{DOMAINS.LOW_RISK.map(d => <option key={d} value={d}>{d}</option>)}</optgroup>
                                        <optgroup label="Prohibited">{DOMAINS.PROHIBITED.map(d => <option key={d} value={d}>{d}</option>)}</optgroup>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                <div>
                                     <label className="text-xs font-semibold text-gray-500 uppercase">Capabilities (CCLs)</label>
                                     <div className="space-y-1 mt-1">
                                        {CAPABILITIES.map(cap => (
                                            <label key={cap} className="flex items-center space-x-2">
                                                <input 
                                                    type="checkbox" 
                                                    checked={riskState.capabilities.includes(cap)}
                                                    onChange={() => setRiskState(prev => ({
                                                        ...prev,
                                                        capabilities: prev.capabilities.includes(cap) ? prev.capabilities.filter(c => c !== cap) : [...prev.capabilities, cap]
                                                    }))}
                                                />
                                                <span className="text-sm">{cap.split(':')[0]}</span>
                                            </label>
                                        ))}
                                     </div>
                                </div>
                             </div>
                        </div>
                    )}
                </div>

                <div className="lg:col-span-4">
                    <div className={`sticky top-6 rounded-xl border p-6 shadow-xl transition-all duration-300 ${getTierColor(displayTier)}`}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold uppercase tracking-wider opacity-80">Risk Classification</h3>
                            <ShieldAlert className="w-6 h-6"/>
                        </div>
                        <h2 className="text-3xl font-extrabold leading-tight">{displayTier || 'Pending Analysis'}</h2>
                        {aiReasoning && <p className="mt-4 text-xs opacity-80 bg-white/50 p-3 rounded">{aiReasoning}</p>}
                    </div>
                </div>
            </div>
        )}

        {/* --- STEP 2: TECHNICAL CONNECTION (API ONLY) --- */}
        {step === 2 && (
            <div className="max-w-2xl mx-auto space-y-6 animate-fadeIn">
                <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm">
                    <h3 className="text-lg font-semibold mb-6 flex items-center">
                        <LinkIcon className="mr-2 text-unBlue" /> Connect Target Model
                    </h3>
                    
                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg mb-6 flex items-start space-x-3">
                        <Activity className="w-5 h-5 text-unBlue mt-0.5" />
                        <div className="text-sm text-blue-800">
                            <strong>API Integration Required:</strong> <br/>
                            File uploads are disabled. Please provide a live inference endpoint. 
                            <br/><br/>
                            <span className="text-xs font-mono bg-blue-100 px-1 rounded">Expected Schema: OpenAI-compatible (POST /v1/chat/completions)</span>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">API Endpoint URL</label>
                            <input 
                                type="text" 
                                value={endpointUrl}
                                onChange={e => {
                                    setEndpointUrl(e.target.value);
                                    setConnectionStatus('IDLE');
                                    setConnectionErrorMsg('');
                                }}
                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-unBlue outline-none font-mono text-sm"
                                placeholder="https://api.example.com/v1/chat/completions"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">API Key (Masked)</label>
                            <input 
                                type="password" 
                                value={apiKey}
                                onChange={e => setApiKey(e.target.value)}
                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-unBlue outline-none font-mono text-sm"
                                placeholder="sk-................................"
                            />
                        </div>
                    </div>

                    {/* Detailed Error Message Display */}
                    {connectionStatus === 'ERROR' && connectionErrorMsg && (
                        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3">
                            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                            <div className="text-sm text-red-700 break-words w-full">
                                <strong>Connection Error:</strong>
                                <p className="mt-1">{connectionErrorMsg.replace('[Connection Failed] ', '')}</p>
                                {connectionErrorMsg.includes('cors-anywhere') && (
                                    <a 
                                        href="https://cors-anywhere.herokuapp.com/corsdemo" 
                                        target="_blank" 
                                        rel="noreferrer"
                                        className="inline-flex items-center mt-2 text-red-800 font-bold underline hover:text-red-900"
                                    >
                                        Request CORS Access <ExternalLink size={12} className="ml-1"/>
                                    </a>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="mt-6 flex justify-end">
                        <button 
                            onClick={handleTestConnection}
                            disabled={!endpointUrl || isTestingConnection}
                            className={`px-4 py-2 rounded-lg text-sm font-bold border transition-all flex items-center space-x-2 ${
                                connectionStatus === 'SUCCESS' ? 'bg-green-50 border-green-200 text-green-700' :
                                connectionStatus === 'ERROR' ? 'bg-red-50 border-red-200 text-red-700' :
                                'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                            {isTestingConnection ? (
                                <>
                                    <div className="animate-spin w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full"></div>
                                    <span>Pinging...</span>
                                </>
                            ) : (
                                <>
                                    {connectionStatus === 'SUCCESS' && <CheckCircle className="w-4 h-4" />}
                                    {connectionStatus === 'ERROR' && <AlertCircle className="w-4 h-4" />}
                                    <span>{connectionStatus === 'SUCCESS' ? 'Connection Verified' : connectionStatus === 'ERROR' ? 'Retry Connection' : 'Test Connection'}</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* --- STEP 3: DUAL-SUITE EVALUATOR --- */}
        {step === 3 && (
            <div className="h-[650px] flex flex-col gap-6 animate-fadeIn">
                <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                     <div className="flex items-center space-x-4">
                         <h3 className="font-bold text-unDark">Automated Evaluator Agent</h3>
                         <span className="text-xs text-gray-500 font-mono bg-gray-100 px-2 py-1 rounded">{endpointUrl || 'SIMULATION_MODE_ENABLED'}</span>
                     </div>
                     <div className="flex items-center space-x-6">
                         <div className="text-center">
                             <div className="text-[10px] uppercase font-bold text-gray-400">Core Benchmarks (Pass Rate)</div>
                             <div className="text-lg font-bold text-unBlue">{getPassRate('SUITE_A_CORE').toFixed(0)}%</div>
                         </div>
                         <div className="text-center">
                             <div className="text-[10px] uppercase font-bold text-gray-400">Adversarial Resilience (Pass Rate)</div>
                             <div className="text-lg font-bold text-orange-600">{getPassRate('SUITE_B_ADVERSARIAL').toFixed(0)}%</div>
                         </div>
                         <button 
                            onClick={() => runFullAudit()}
                            disabled={isAuditRunning}
                            className={`px-6 py-2 rounded-lg font-bold text-white flex items-center space-x-2 ${isAuditRunning ? 'bg-gray-400' : 'bg-unBlue hover:bg-blue-600'}`}
                         >
                            {isAuditRunning ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"/> : <Play size={16}/>}
                            <span>Run All Tests</span>
                         </button>
                     </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-6 flex-1 overflow-hidden">
                    {/* LEFT: SUITE A (BENCHMARKS) */}
                    <div className="w-full lg:w-1/3 bg-white border border-gray-200 rounded-xl flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                            <h4 className="font-bold text-sm text-gray-700 flex items-center">
                                <FileCheck className="w-4 h-4 mr-2 text-unBlue" /> Suite A: Core Benchmarks
                            </h4>
                            <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded">Section 4</span>
                        </div>
                        <div className="overflow-y-auto p-4 space-y-3">
                            {protocols.filter(p => p.category === 'SUITE_A_CORE').map(p => {
                                const result = testResults.find(r => r.protocolId === p.id);
                                const isRequired = displayTier && p.requiredForTiers.includes(displayTier);
                                
                                return (
                                    <div key={p.id} className={`p-3 rounded-lg border text-sm ${
                                        !isRequired ? 'opacity-50 grayscale' : 'bg-white'
                                    } ${
                                        result?.status === 'PASS' ? 'border-green-200 bg-green-50' : 
                                        result?.status === 'FAIL' ? 'border-red-200 bg-red-50' : 'border-gray-200'
                                    }`}>
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="font-semibold text-gray-800">{p.name}</span>
                                            {isRequired && (
                                                <button onClick={() => runSingleTest(p)} disabled={isAuditRunning} className="text-unBlue hover:text-blue-700">
                                                    <Play size={14} />
                                                </button>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-500 mb-2">{p.description}</p>
                                        <div className="flex items-center justify-between">
                                            {result ? (
                                                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                                                    result.status === 'PASS' ? 'bg-green-200 text-green-800' : 
                                                    result.status === 'FAIL' ? 'bg-red-200 text-red-800' : 'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                    {result.status}
                                                </span>
                                            ) : (
                                                <span className="text-[10px] text-gray-400 italic">{isRequired ? 'Pending' : 'Not Required'}</span>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* MIDDLE: SUITE B (ADVERSARIAL) */}
                    <div className="w-full lg:w-1/3 bg-white border border-gray-200 rounded-xl flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                            <h4 className="font-bold text-sm text-gray-700 flex items-center">
                                <Zap className="w-4 h-4 mr-2 text-orange-500" /> Suite B: Adversarial
                            </h4>
                            <span className="text-[10px] bg-orange-100 text-orange-800 px-2 py-0.5 rounded">Section 5</span>
                        </div>
                         <div className="overflow-y-auto p-4 space-y-3">
                            {protocols.filter(p => p.category === 'SUITE_B_ADVERSARIAL').map(p => {
                                const result = testResults.find(r => r.protocolId === p.id);
                                const isRequired = displayTier && p.requiredForTiers.includes(displayTier);
                                
                                return (
                                    <div key={p.id} className={`p-3 rounded-lg border text-sm ${
                                        !isRequired ? 'opacity-50 grayscale' : 'bg-white'
                                    } ${
                                        result?.status === 'PASS' ? 'border-green-200 bg-green-50' : 
                                        result?.status === 'FAIL' ? 'border-red-200 bg-red-50' : 'border-gray-200'
                                    }`}>
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="font-semibold text-gray-800">{p.name}</span>
                                             {isRequired && (
                                                <button onClick={() => runSingleTest(p)} disabled={isAuditRunning} className="text-unBlue hover:text-blue-700">
                                                    <Play size={14} />
                                                </button>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-500 mb-2">{p.description}</p>
                                        <div className="flex items-center justify-between">
                                            {result ? (
                                                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                                                    result.status === 'PASS' ? 'bg-green-200 text-green-800' : 
                                                    result.status === 'FAIL' ? 'bg-red-200 text-red-800' : 'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                    {result.status}
                                                </span>
                                            ) : (
                                                <span className="text-[10px] text-gray-400 italic">{isRequired ? 'Pending' : 'Not Required'}</span>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* RIGHT: LIVE TERMINAL */}
                    <div className="w-full lg:w-1/3 bg-gray-900 rounded-xl border border-gray-800 shadow-2xl flex flex-col overflow-hidden">
                        <div className="bg-gray-800 p-3 flex items-center justify-between border-b border-gray-700">
                            <div className="flex items-center space-x-2 text-gray-300 font-mono text-xs">
                                <Terminal size={14} />
                                <span>evaluator_agent_v3.py</span>
                            </div>
                            <div className="flex items-center space-x-2">
                                <div className={`w-2 h-2 rounded-full ${isAuditRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></div>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-xs" ref={logScrollRef}>
                            {logs.length === 0 && <div className="text-gray-600 text-center mt-20">Waiting for command...</div>}
                            {logs.map(log => (
                                <div key={log.id} className="animate-slideIn">
                                    <div className={`mb-1 ${log.role === AgentRole.AUDITOR ? 'text-red-400' : log.role === AgentRole.TARGET ? 'text-blue-400' : 'text-yellow-400'}`}>
                                        {log.role}
                                    </div>
                                    <div className={`p-2 rounded border ${
                                        log.role === AgentRole.AUDITOR ? 'bg-red-900/10 border-red-500/20 text-gray-300' : 
                                        log.role === AgentRole.TARGET ? 'bg-blue-900/10 border-blue-500/20 text-white' : 
                                        'bg-yellow-900/10 border-yellow-500/20 text-yellow-200'
                                    }`}>
                                        {log.content}
                                        {log.metadata?.verdict && (
                                            <div className={`mt-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${log.metadata.verdict === 'PASS' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                {log.metadata.verdict === 'PASS' ? <CheckCircle2 size={10} className="mr-1"/> : <AlertCircle size={10} className="mr-1"/>}
                                                {log.metadata.verdict}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* --- STEP 4: REVIEW & SUBMIT --- */}
        {step === 4 && (
             <div className="max-w-2xl mx-auto text-center space-y-6 animate-fadeIn">
                <div className="bg-green-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Shield className="w-10 h-10 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-unDark">Assessment Complete</h2>
                <p className="text-gray-600">
                    Your project <strong>{projectName}</strong> has been classified as <span className="font-bold">{displayTier}</span>. 
                    Automated tests have been logged.
                </p>
                
                <div className="bg-white p-6 rounded-xl border border-gray-200 text-left space-y-3 shadow-sm">
                    <div className="flex justify-between text-sm"><span className="text-gray-500">Domain</span><span className="font-medium">{riskState.domain}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-500">Connection</span><span className="font-medium">API Endpoint</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-500">Tests Run</span><span className="font-medium">{testResults.length} Protocols</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-500">Safety Score</span><span className="font-bold text-unBlue">{(testResults.filter(r => r.status === 'PASS').length / (testResults.length || 1) * 100).toFixed(0)}%</span></div>
                </div>

                <div className="space-y-3">
                    <button 
                        onClick={generateSafetyReportPDF}
                        className="w-full py-3 bg-white border-2 border-unDark text-unDark rounded-lg font-bold hover:bg-gray-50 transition-colors flex items-center justify-center space-x-2"
                    >
                        <FileText size={18} />
                        <span>Generate Comprehensive Report (PDF)</span>
                    </button>
                    
                    <button 
                        onClick={handleSubmit}
                        className="w-full py-3 bg-unBlue text-white rounded-lg font-bold hover:bg-blue-600 transition-colors shadow-lg"
                    >
                        Submit to ASRB Review Queue
                    </button>
                </div>
             </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-6 border-t border-gray-100">
            <button 
                onClick={() => setStep(s => Math.max(1, s - 1))}
                disabled={step === 1}
                className="px-6 py-2 rounded-lg text-gray-600 font-medium hover:bg-gray-100 disabled:opacity-50"
            >
                Back
            </button>
            {step < 4 && (
                <button 
                    onClick={() => setStep(s => Math.min(4, s + 1))}
                    disabled={
                        (step === 1 && !projectName) ||
                        (step === 2 && endpointUrl && connectionStatus !== 'SUCCESS')
                    } 
                    className="px-6 py-2 rounded-lg bg-unDark text-white font-medium hover:bg-black flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <span>Next Step</span>
                    <ArrowRight size={16} />
                </button>
            )}
        </div>
    </div>
  );
};

export default NewAssessment;