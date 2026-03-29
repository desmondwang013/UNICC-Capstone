import React, { useState, useEffect } from 'react';
import { AlertTriangle, Shield, CheckCircle2, Search, Edit2, RotateCcw } from 'lucide-react';
import { DOMAINS, CAPABILITIES, RiskTier, ClassificationState } from '../types';
import { analyzeSystemRisk } from '../services/geminiService';

const RiskClassifier: React.FC = () => {
  const [description, setDescription] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showManualOverride, setShowManualOverride] = useState(false);
  const [aiReasoning, setAiReasoning] = useState<string | null>(null);

  // We add a separate state to hold the AI's direct opinion.
  // This ensures that if the AI explicitly says "Tier 2", we respect that 
  // unless the user manually changes the inputs (domain/capabilities).
  const [aiDeterminedTier, setAiDeterminedTier] = useState<RiskTier | null>(null);

  const [state, setState] = useState<ClassificationState>({
    domain: '',
    capabilities: [],
    isHighAutonomy: false,
    calculatedTier: null,
  });

  const calculateRisk = () => {
    const { domain, capabilities, isHighAutonomy } = state;
    
    // If the user hasn't started yet
    if (!domain && !description) {
        setState(s => ({ ...s, calculatedTier: null }));
        return;
    }

    // PRIORITY: If we have an AI determined tier and the user hasn't opened manual controls
    // to edit the inputs, we trust the AI's holistic judgment to prevent mismatch.
    // However, we still run the logic to see if it aligns.
    // Ideally, if the inputs map correctly, logic aligns.
    
    let logicalTier = RiskTier.TIER_1; // Default

    // 1. Check for Prohibited Use Cases
    const isProhibited = DOMAINS.PROHIBITED.some(p => domain === p); // Exact match preferred
    if (isProhibited) {
       logicalTier = RiskTier.TIER_4;
    } else {
        const isHighRiskDomain = DOMAINS.HIGH_RISK.includes(domain);
        const hasCapabilities = capabilities.length > 0;

        // 2. Logic Implementation from Framework
        if (hasCapabilities || (isHighRiskDomain && isHighAutonomy)) {
            logicalTier = RiskTier.TIER_3;
        } else if (isHighRiskDomain && !hasCapabilities) {
            logicalTier = RiskTier.TIER_2;
        } else {
            logicalTier = RiskTier.TIER_1;
        }
    }

    setState(s => ({ ...s, calculatedTier: logicalTier }));
  };

  // Re-calculate when inputs change
  useEffect(() => {
    // We only auto-calculate if we are in "Manual" mode OR if we just loaded data.
    // But to keep it simple: The inputs (domain/capabilities) drive the output.
    // If the AI returned valid inputs, this function will yield the same result as the AI.
    calculateRisk();
  }, [state.domain, state.capabilities, state.isHighAutonomy]);

  const handleAnalyze = async () => {
    if (!description.trim()) return;
    
    setIsAnalyzing(true);
    setAiReasoning(null);
    setAiDeterminedTier(null);
    
    // Call AI Service
    const result = await analyzeSystemRisk(description);
    
    // Map AI result to state
    // The service now returns a suggestedDomain from the strict list if possible.
    let matchedDomain = result.suggestedDomain;
    
    // Fallback search if the AI returned something slightly off (though prompt forbids it)
    const allDomains = [...DOMAINS.HIGH_RISK, ...DOMAINS.LOW_RISK, ...DOMAINS.PROHIBITED];
    const found = allDomains.find(d => d.toLowerCase() === result.suggestedDomain.toLowerCase());
    if (found) matchedDomain = found;

    // Map capabilities
    const matchedCapabilities = CAPABILITIES.filter(cap => 
        result.detectedCapabilities.includes(cap)
    );

    // Update state inputs
    setState({
        domain: matchedDomain,
        capabilities: matchedCapabilities,
        isHighAutonomy: result.isHighAutonomy,
        calculatedTier: null // Will be updated by effect
    });
    
    setAiReasoning(result.reasoning);
    setAiDeterminedTier(result.suggestedTier); // We can use this for debugging or overriding
    setIsAnalyzing(false);
    setShowManualOverride(false); 
  };

  const handleCapabilityToggle = (cap: string) => {
    setState(prev => ({
      ...prev,
      capabilities: prev.capabilities.includes(cap)
        ? prev.capabilities.filter(c => c !== cap)
        : [...prev.capabilities, cap]
    }));
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

  // Display logic: If we haven't manually overridden, and we have an AI tier, 
  // check if there is a mismatch. If inputs map correctly, they should match.
  // If there is a slight mismatch due to domain mapping falling to "Other" but AI said "Tier 2",
  // we might want to trust the AI's Tier for the display until user edits.
  const displayTier = (!showManualOverride && aiDeterminedTier) ? aiDeterminedTier : state.calculatedTier;

  return (
    <div className="space-y-6 animate-fadeIn max-w-6xl mx-auto">
      <div className="flex justify-between items-start">
        <div>
            <h2 className="text-2xl font-bold text-unDark">Risk Classification Matrix</h2>
            <p className="text-gray-500 mt-1">Section 3.2: Automated Risk Tier Determination</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Input & Manual Controls */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* AI Analysis Input */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-lg font-semibold text-unDark mb-4 flex items-center">
                <Search className="w-5 h-5 text-unBlue mr-2" />
                System Analysis
            </h3>
            
            <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-700">Describe the AI System</label>
                <textarea 
                    className="w-full h-32 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-unBlue focus:border-unBlue outline-none resize-none text-sm"
                    placeholder="e.g., A chatbot for assisting with visa applications that automatically processes biometric data and approves simple cases without human oversight."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                />
                
                <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-400">
                        The AI agent will check for prohibited use cases, critical capabilities, and high-risk domains.
                    </p>
                    <button 
                        onClick={handleAnalyze}
                        disabled={isAnalyzing || !description}
                        className={`px-6 py-2.5 rounded-lg text-white font-medium shadow-sm transition-all flex items-center space-x-2 ${
                            isAnalyzing || !description ? 'bg-gray-300 cursor-not-allowed' : 'bg-unBlue hover:bg-blue-600'
                        }`}
                    >
                        {isAnalyzing ? (
                            <>
                                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                                <span>Analyzing...</span>
                            </>
                        ) : (
                            <>
                                <Search size={16} />
                                <span>Analyze Risk Tier</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
          </div>

          {/* Analysis Results / Reasoning */}
          {aiReasoning && (
             <div className="bg-blue-50/50 p-6 rounded-xl border border-blue-100 animate-slideIn">
                <div className="flex items-start space-x-3">
                    <div className="mt-1">
                        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-unBlue">
                            <Shield size={14} />
                        </div>
                    </div>
                    <div className="flex-1">
                        <h4 className="text-sm font-bold text-unDark mb-1">Classifier Agent Reasoning</h4>
                        <p className="text-sm text-gray-700 leading-relaxed">{aiReasoning}</p>
                    </div>
                </div>
             </div>
          )}

          {/* Manual Override Section */}
          <div className="border-t border-gray-200 pt-6">
             {(!showManualOverride && displayTier) ? (
                 <button 
                    onClick={() => setShowManualOverride(true)}
                    className="text-sm text-gray-500 hover:text-unBlue flex items-center space-x-2 transition-colors"
                 >
                    <Edit2 size={14} />
                    <span>Review & Edit Classification Details</span>
                 </button>
             ) : (
                 <div className={`transition-all duration-500 ${showManualOverride ? 'opacity-100' : 'opacity-50 pointer-events-none grayscale'}`}>
                     <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-unDark">Classification Details</h3>
                        {displayTier && !showManualOverride && (
                            <span className="text-xs bg-gray-100 px-2 py-1 rounded">Auto-Detected</span>
                        )}
                     </div>
                     
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                             <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Domain of Application</label>
                             <select 
                                className="w-full p-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-unBlue outline-none"
                                value={state.domain}
                                onChange={(e) => setState(s => ({ ...s, domain: e.target.value }))}
                            >
                                <option value="">-- Select Domain --</option>
                                <optgroup label="High Risk">
                                    {DOMAINS.HIGH_RISK.map(d => <option key={d} value={d}>{d}</option>)}
                                </optgroup>
                                <optgroup label="Low Risk">
                                    {DOMAINS.LOW_RISK.map(d => <option key={d} value={d}>{d}</option>)}
                                </optgroup>
                                <optgroup label="Prohibited">
                                    {DOMAINS.PROHIBITED.map(d => <option key={d} value={d}>{d}</option>)}
                                </optgroup>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        <div>
                             <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Autonomy Level</label>
                             <div className="flex items-center space-x-3 h-[42px]">
                                <label className="flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={state.isHighAutonomy}
                                        onChange={(e) => setState(s => ({ ...s, isHighAutonomy: e.target.checked }))}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-unBlue relative"></div>
                                    <span className="ml-3 text-sm font-medium text-gray-700">High Autonomy</span>
                                </label>
                             </div>
                        </div>
                     </div>

                     <div className="mt-4">
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Critical Capability Levels (CCLs)</label>
                        <div className="space-y-2">
                             {CAPABILITIES.map(cap => (
                                <label key={cap} className="flex items-center space-x-2 p-2 border border-gray-100 rounded hover:bg-gray-50 cursor-pointer bg-white">
                                    <input 
                                        type="checkbox"
                                        checked={state.capabilities.includes(cap)}
                                        onChange={() => handleCapabilityToggle(cap)}
                                        className="w-4 h-4 text-unBlue rounded border-gray-300 focus:ring-unBlue"
                                    />
                                    <span className="text-sm text-gray-700">{cap}</span>
                                </label>
                            ))}
                        </div>
                     </div>
                 </div>
             )}
          </div>

        </div>

        {/* Right Column: Result Card */}
        <div className="lg:col-span-4">
            <div className={`sticky top-6 rounded-xl border p-6 shadow-xl transition-all duration-300 ${getTierColor(displayTier)}`}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider opacity-80">Risk Tier</h3>
                    {displayTier === RiskTier.TIER_4 ? <AlertTriangle className="w-6 h-6"/> : <Shield className="w-6 h-6"/>}
                </div>
                
                <div className="mb-6">
                    <h2 className="text-3xl font-extrabold mt-1 leading-tight tracking-tight">
                        {displayTier || 'Pending Analysis...'}
                    </h2>
                    {displayTier && (
                        <p className="mt-2 text-sm opacity-80 font-medium">
                            Based on {state.domain || 'Analysis'} 
                            {state.capabilities.length > 0 && ` + ${state.capabilities.length} CCLs`}
                        </p>
                    )}
                </div>

                <div className="space-y-4 text-sm bg-white/60 p-5 rounded-lg backdrop-blur-sm border border-black/5">
                    <h4 className="font-bold opacity-90 uppercase text-xs tracking-wide">Required Protocols</h4>
                    <ul className="space-y-3">
                        {displayTier === RiskTier.TIER_1 && (
                            <li className="flex items-start"><CheckCircle2 className="w-4 h-4 mr-2 mt-0.5 shrink-0"/> <span>Standard Documentation</span></li>
                        )}
                        {displayTier === RiskTier.TIER_2 && (
                            <>
                                <li className="flex items-start"><CheckCircle2 className="w-4 h-4 mr-2 mt-0.5 shrink-0"/> <span>Human-in-the-loop Plan</span></li>
                                <li className="flex items-start"><CheckCircle2 className="w-4 h-4 mr-2 mt-0.5 shrink-0"/> <span>Bias & Fairness Testing</span></li>
                            </>
                        )}
                        {displayTier === RiskTier.TIER_3 && (
                            <>
                                <li className="flex items-start"><CheckCircle2 className="w-4 h-4 mr-2 mt-0.5 shrink-0"/> <span>Full Adversarial Audit (Red Teaming)</span></li>
                                <li className="flex items-start"><CheckCircle2 className="w-4 h-4 mr-2 mt-0.5 shrink-0"/> <span>Model Card & Data Genealogy</span></li>
                                <li className="flex items-start"><CheckCircle2 className="w-4 h-4 mr-2 mt-0.5 shrink-0"/> <span>Independent 3rd Party Review</span></li>
                            </>
                        )}
                        {displayTier === RiskTier.TIER_4 && (
                            <li className="flex items-start font-bold text-red-700"><AlertTriangle className="w-4 h-4 mr-2 mt-0.5 shrink-0"/> <span>DEPLOYMENT FORBIDDEN</span></li>
                        )}
                        {!displayTier && <li className="italic opacity-60">Enter a description to determine protocols.</li>}
                    </ul>
                </div>
                
                {displayTier && (
                     <div className="mt-6 flex justify-center">
                        <button 
                            onClick={() => {
                                setDescription('');
                                setState({ domain: '', capabilities: [], isHighAutonomy: false, calculatedTier: null });
                                setAiReasoning(null);
                                setAiDeterminedTier(null);
                                setShowManualOverride(false);
                            }}
                            className="text-xs font-semibold uppercase tracking-wide opacity-60 hover:opacity-100 flex items-center"
                        >
                            <RotateCcw className="w-3 h-3 mr-1" />
                            Reset Analysis
                        </button>
                     </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default RiskClassifier;
