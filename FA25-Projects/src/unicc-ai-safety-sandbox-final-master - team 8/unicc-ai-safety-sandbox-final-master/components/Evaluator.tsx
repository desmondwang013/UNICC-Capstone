import React, { useState, useRef, useEffect } from 'react';
import { Play, Shield, Terminal, AlertCircle, CheckCircle, Lock, Server, Skull } from 'lucide-react';
import { TestProtocol, AgentRole, AuditLog, RiskTier } from '../types';
import { generateAuditAttack, judgeInteraction, simulateTargetResponse } from '../services/geminiService';

const Evaluator: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [protocols, setProtocols] = useState<TestProtocol[]>([
    { 
        id: 'evasion', 
        name: 'Evasion Testing', 
        description: 'Run PGD (Projected Gradient Descent) Attack', 
        category: 'SUITE_B_ADVERSARIAL',
        requiredForTiers: [RiskTier.TIER_3],
        active: false 
    },
    { 
        id: 'poison', 
        name: 'Data Poisoning', 
        description: 'Check for Backdoor Triggers', 
        category: 'SUITE_B_ADVERSARIAL',
        requiredForTiers: [RiskTier.TIER_3],
        active: false 
    },
    { 
        id: 'privacy', 
        name: 'Privacy Leakage', 
        description: 'Run Membership Inference Attack', 
        category: 'SUITE_B_ADVERSARIAL',
        requiredForTiers: [RiskTier.TIER_3],
        active: false 
    },
    { 
        id: 'redteam', 
        name: 'Red Teaming', 
        description: 'Run Misuse/Jailbreak Prompts', 
        category: 'SUITE_B_ADVERSARIAL',
        requiredForTiers: [RiskTier.TIER_3],
        active: true 
    },
  ]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const toggleProtocol = (id: string) => {
    setProtocols(prev => prev.map(p => p.id === id ? { ...p, active: !p.active } : p));
  };

  const addLog = (role: AgentRole, content: string, metadata?: any) => {
    setLogs(prev => [...prev, {
      id: Math.random().toString(36).substring(7),
      role,
      content,
      timestamp: Date.now(),
      metadata
    }]);
  };

  const runAudit = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setLogs([]); // Clear previous run

    const activeProtocols = protocols.filter(p => p.active);
    
    if (activeProtocols.length === 0) {
        addLog(AgentRole.JUDGE, "No protocols selected. Aborting audit.");
        setIsRunning(false);
        return;
    }

    // Sequence for Red Teaming (Simplified for demo)
    for (const protocol of activeProtocols) {
        addLog(AgentRole.JUDGE, `Initializing Protocol: ${protocol.name}...`);
        
        // 1. Auditor Generates Attack
        const attackVector = protocol.name;
        const attackPrompt = await generateAuditAttack(attackVector);
        addLog(AgentRole.AUDITOR, attackPrompt);

        // Artificial delay for UI pacing
        await new Promise(r => setTimeout(r, 1500));

        // 2. Target Responds
        const targetResponse = await simulateTargetResponse(attackPrompt);
        addLog(AgentRole.TARGET, targetResponse);

        await new Promise(r => setTimeout(r, 1500));

        // 3. Judge Evaluates
        const judgment = await judgeInteraction(attackPrompt, targetResponse, attackVector);
        addLog(AgentRole.JUDGE, `Verdict: ${judgment.verdict}. Reason: ${judgment.reasoning}`, { verdict: judgment.verdict });
        
        await new Promise(r => setTimeout(r, 1000));
    }

    setIsRunning(false);
  };

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col lg:flex-row gap-6">
      
      {/* Control Panel */}
      <div className="w-full lg:w-1/3 flex flex-col gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex-1 overflow-y-auto">
            <h2 className="text-xl font-bold text-unDark mb-2">Test Configuration</h2>
            <p className="text-sm text-gray-500 mb-6">Select adversarial protocols to run against the target model.</p>
            
            <div className="space-y-4">
                {protocols.map(p => (
                    <div 
                        key={p.id} 
                        onClick={() => !isRunning && toggleProtocol(p.id)}
                        className={`p-4 rounded-lg border cursor-pointer transition-all ${
                            p.active 
                            ? 'border-unBlue bg-blue-50 ring-1 ring-unBlue' 
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        } ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <div className="flex justify-between items-center">
                            <span className={`font-semibold ${p.active ? 'text-unBlue' : 'text-gray-700'}`}>{p.name}</span>
                            <div className={`w-4 h-4 rounded-full border ${p.active ? 'bg-unBlue border-unBlue' : 'border-gray-300'}`}></div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{p.description}</p>
                    </div>
                ))}
            </div>

            <button 
                onClick={runAudit}
                disabled={isRunning}
                className={`mt-8 w-full py-4 rounded-lg font-bold text-white shadow-lg flex items-center justify-center space-x-2 transition-all ${
                    isRunning 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-unBlue hover:bg-blue-600 active:scale-95'
                }`}
            >
                {isRunning ? (
                    <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        <span>Running Audit...</span>
                    </>
                ) : (
                    <>
                        <Play size={20} fill="currentColor" />
                        <span>Start Evaluation Agent</span>
                    </>
                )}
            </button>
        </div>
      </div>

      {/* Visualization Panel */}
      <div className="w-full lg:w-2/3 bg-gray-900 rounded-xl border border-gray-800 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gray-800 p-4 border-b border-gray-700 flex justify-between items-center">
            <div className="flex items-center space-x-2">
                <Terminal className="text-gray-400" size={18} />
                <span className="text-gray-200 font-mono text-sm">Mainnet_Audit_Log_v2.log</span>
            </div>
            <div className="flex space-x-2">
                <span className="w-3 h-3 rounded-full bg-red-500"></span>
                <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                <span className="w-3 h-3 rounded-full bg-green-500"></span>
            </div>
        </div>

        {/* Pipeline Visualizer (Top) */}
        <div className="bg-gray-800/50 p-4 border-b border-gray-700 flex justify-around items-center py-6">
            <div className={`flex flex-col items-center transition-opacity ${isRunning ? 'opacity-100' : 'opacity-50'}`}>
                <div className="w-12 h-12 bg-red-900/50 rounded-lg flex items-center justify-center border border-red-500/30 text-red-400 mb-2">
                    <Skull size={24} />
                </div>
                <span className="text-xs font-mono text-red-400">AUDITOR</span>
            </div>
            <div className="h-px w-16 bg-gray-600 relative">
                {isRunning && <div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full animate-ping left-0"></div>}
            </div>
             <div className={`flex flex-col items-center transition-opacity ${isRunning ? 'opacity-100' : 'opacity-50'}`}>
                <div className="w-12 h-12 bg-blue-900/50 rounded-lg flex items-center justify-center border border-blue-500/30 text-blue-400 mb-2">
                    <Server size={24} />
                </div>
                <span className="text-xs font-mono text-blue-400">TARGET</span>
            </div>
             <div className="h-px w-16 bg-gray-600 relative"></div>
             <div className={`flex flex-col items-center transition-opacity ${isRunning ? 'opacity-100' : 'opacity-50'}`}>
                <div className="w-12 h-12 bg-yellow-900/50 rounded-lg flex items-center justify-center border border-yellow-500/30 text-yellow-400 mb-2">
                    <Lock size={24} />
                </div>
                <span className="text-xs font-mono text-yellow-400">JUDGE</span>
            </div>
        </div>

        {/* Chat Log */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 font-mono text-sm" ref={scrollRef}>
            {logs.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-gray-600">
                    <Shield size={48} className="mb-4 opacity-20" />
                    <p>Ready to initialize audit sequence.</p>
                </div>
            )}
            {logs.map((log) => (
                <div key={log.id} className="animate-slideIn">
                    {log.role === AgentRole.AUDITOR && (
                        <div className="flex gap-4">
                            <div className="w-8 h-8 rounded bg-red-500/10 flex items-center justify-center border border-red-500/20 shrink-0">
                                <Skull size={14} className="text-red-500" />
                            </div>
                            <div className="flex-1">
                                <p className="text-red-400 text-xs mb-1">AUDITOR (Attacker)</p>
                                <div className="p-3 bg-red-900/10 border border-red-500/10 rounded text-gray-300">
                                    {log.content}
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {log.role === AgentRole.TARGET && (
                        <div className="flex gap-4">
                            <div className="w-8 h-8 rounded bg-blue-500/10 flex items-center justify-center border border-blue-500/20 shrink-0">
                                <Server size={14} className="text-blue-500" />
                            </div>
                            <div className="flex-1">
                                <p className="text-blue-400 text-xs mb-1">TARGET MODEL</p>
                                <div className="p-3 bg-blue-900/10 border border-blue-500/10 rounded text-white">
                                    {log.content}
                                </div>
                            </div>
                        </div>
                    )}

                    {log.role === AgentRole.JUDGE && (
                         <div className="flex gap-4">
                            <div className="w-8 h-8 rounded bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20 shrink-0">
                                <Lock size={14} className="text-yellow-500" />
                            </div>
                            <div className="flex-1">
                                <p className="text-yellow-400 text-xs mb-1">JUDGE AGENT</p>
                                <div className={`p-3 border rounded flex items-center justify-between ${
                                    log.metadata?.verdict === 'PASS' 
                                    ? 'bg-green-900/20 border-green-500/30 text-green-200'
                                    : log.metadata?.verdict === 'FAIL'
                                    ? 'bg-red-900/20 border-red-500/30 text-red-200'
                                    : 'bg-yellow-900/10 border-yellow-500/10 text-yellow-200'
                                }`}>
                                    <span>{log.content}</span>
                                    {log.metadata?.verdict === 'PASS' && <CheckCircle size={18} />}
                                    {log.metadata?.verdict === 'FAIL' && <AlertCircle size={18} />}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default Evaluator;