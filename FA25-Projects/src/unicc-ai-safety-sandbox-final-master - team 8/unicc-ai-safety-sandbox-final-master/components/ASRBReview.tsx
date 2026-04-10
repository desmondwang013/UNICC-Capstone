import React, { useState } from 'react';
import { Project, ProjectStatus, UserRole, RiskTier } from '../types';
import { CheckCircle, XCircle, AlertTriangle, FileText, ChevronRight, Gavel } from 'lucide-react';

interface ASRBReviewProps {
  projects: Project[];
  onUpdateStatus: (id: string, status: ProjectStatus) => void;
  userRole: UserRole;
}

const ASRBReview: React.FC<ASRBReviewProps> = ({ projects, onUpdateStatus, userRole }) => {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const pendingProjects = projects.filter(p => p.status === ProjectStatus.PENDING_REVIEW);

  if (userRole !== UserRole.ASRB_AUDITOR) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="bg-gray-100 p-6 rounded-full mb-4">
                <Gavel className="w-12 h-12 text-gray-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-700">Access Restricted</h2>
            <p className="text-gray-500 mt-2 max-w-md">Only authorized members of the AI Safety Review Board (ASRB) can access this governance dashboard.</p>
        </div>
    );
  }

  if (selectedProject) {
      return (
          <div className="animate-fadeIn max-w-5xl mx-auto">
              <button onClick={() => setSelectedProject(null)} className="text-sm text-gray-500 hover:text-unBlue mb-4 flex items-center">
                  &larr; Back to Queue
              </button>
              
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="p-8 border-b border-gray-100 flex justify-between items-start">
                      <div>
                          <div className="flex items-center space-x-3 mb-2">
                              <h2 className="text-2xl font-bold text-unDark">{selectedProject.name}</h2>
                              <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                  selectedProject.riskTier === RiskTier.TIER_4 ? 'bg-red-100 text-red-800' :
                                  selectedProject.riskTier === RiskTier.TIER_3 ? 'bg-orange-100 text-orange-800' :
                                  'bg-green-100 text-green-800'
                              }`}>
                                  {selectedProject.riskTier}
                              </span>
                          </div>
                          <p className="text-gray-500 text-sm max-w-2xl">{selectedProject.description}</p>
                      </div>
                      <div className="text-right">
                          <p className="text-xs text-gray-400 uppercase tracking-wide">Submission Date</p>
                          <p className="font-medium text-unDark">{new Date(selectedProject.submittedAt).toLocaleDateString()}</p>
                      </div>
                  </div>

                  <div className="grid grid-cols-3 divide-x divide-gray-100">
                      <div className="p-6">
                          <h4 className="font-bold text-gray-700 mb-4 text-sm uppercase tracking-wide">Risk Profile</h4>
                          <div className="space-y-3 text-sm">
                              <div><span className="text-gray-500 block">Domain:</span> <span className="font-medium">{selectedProject.domain}</span></div>
                              <div>
                                  <span className="text-gray-500 block">Capabilities:</span> 
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {selectedProject.capabilities.length > 0 ? selectedProject.capabilities.map(c => (
                                        <span key={c} className="bg-gray-100 px-2 py-0.5 rounded text-xs">{c.split(':')[0]}</span>
                                    )) : <span className="text-gray-400 italic">None detected</span>}
                                  </div>
                              </div>
                              <div className="bg-blue-50 p-3 rounded text-xs text-blue-800 mt-2">
                                  <strong>Reasoning:</strong> {selectedProject.riskReasoning}
                              </div>
                          </div>
                      </div>
                      <div className="p-6">
                           <h4 className="font-bold text-gray-700 mb-4 text-sm uppercase tracking-wide">Safety Audit Results</h4>
                           <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600">Safety Score</span>
                                    <span className={`text-xl font-bold ${selectedProject.safetyScore > 80 ? 'text-green-600' : 'text-red-600'}`}>
                                        {selectedProject.safetyScore.toFixed(0)}%
                                    </span>
                                </div>
                                <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                                    <div className={`h-full ${selectedProject.safetyScore > 80 ? 'bg-green-500' : 'bg-red-500'}`} style={{ width: `${selectedProject.safetyScore}%` }}></div>
                                </div>
                                <div className="text-xs text-gray-500 mt-2">
                                    Based on {selectedProject.auditLogs.filter(l => l.metadata?.verdict).length} automated adversarial tests.
                                </div>
                           </div>
                      </div>
                      <div className="p-6 bg-gray-50 flex flex-col justify-center space-y-3">
                           <h4 className="font-bold text-gray-700 text-sm uppercase tracking-wide mb-1">ASRB Decision</h4>
                           <button 
                                onClick={() => {
                                    onUpdateStatus(selectedProject.id, ProjectStatus.APPROVED);
                                    setSelectedProject(null);
                                }}
                                className="w-full py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 flex items-center justify-center"
                            >
                                <CheckCircle size={18} className="mr-2"/> Override & Approve
                           </button>
                           <button 
                                onClick={() => {
                                    onUpdateStatus(selectedProject.id, ProjectStatus.REJECTED);
                                    setSelectedProject(null);
                                }}
                                className="w-full py-2 bg-white border border-red-200 text-red-600 rounded-lg font-bold hover:bg-red-50 flex items-center justify-center"
                            >
                                <XCircle size={18} className="mr-2"/> Reject Project
                           </button>
                      </div>
                  </div>
              </div>
          </div>
      );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex justify-between items-center">
        <div>
            <h2 className="text-2xl font-bold text-unDark">ASRB Review Queue</h2>
            <p className="text-gray-500">Pending safety cases requiring human validation.</p>
        </div>
        <div className="bg-orange-100 text-orange-800 px-4 py-2 rounded-full font-bold text-sm">
            {pendingProjects.length} Pending
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {pendingProjects.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
                <CheckCircle className="w-12 h-12 text-green-200 mx-auto mb-4" />
                <p>All caught up! No projects pending review.</p>
            </div>
        ) : (
            <div className="divide-y divide-gray-100">
                {pendingProjects.map(project => (
                    <div key={project.id} className="p-6 hover:bg-gray-50 transition-colors flex items-center justify-between group cursor-pointer" onClick={() => setSelectedProject(project)}>
                        <div className="flex items-center space-x-4">
                            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                                project.riskTier === RiskTier.TIER_4 ? 'bg-red-100 text-red-600' :
                                project.riskTier === RiskTier.TIER_3 ? 'bg-orange-100 text-orange-600' :
                                'bg-green-100 text-green-600'
                            }`}>
                                <AlertTriangle size={20} />
                            </div>
                            <div>
                                <h3 className="font-bold text-unDark text-lg">{project.name}</h3>
                                <div className="flex items-center space-x-2 text-sm text-gray-500">
                                    <span>{project.owner}</span>
                                    <span>•</span>
                                    <span>{project.domain}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center space-x-6">
                            <div className="text-right">
                                <div className="text-sm font-semibold text-unDark">Safety Score</div>
                                <div className={`text-lg font-bold ${project.safetyScore > 80 ? 'text-green-600' : 'text-red-600'}`}>
                                    {project.safetyScore.toFixed(0)}%
                                </div>
                            </div>
                            <ChevronRight className="text-gray-300 group-hover:text-unBlue" />
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  );
};

export default ASRBReview;