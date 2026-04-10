import React from 'react';
import { Project, ProjectStatus } from '../types';
import { Activity, PauseCircle, ShieldCheck, Zap } from 'lucide-react';

interface LiveMonitoringProps {
  projects: Project[];
  onUpdateStatus: (id: string, status: ProjectStatus) => void;
}

const LiveMonitoring: React.FC<LiveMonitoringProps> = ({ projects, onUpdateStatus }) => {
  const activeProjects = projects.filter(p => p.status === ProjectStatus.APPROVED);

  return (
    <div className="space-y-6 animate-fadeIn">
       <div>
            <h2 className="text-2xl font-bold text-unDark">Live Monitoring</h2>
            <p className="text-gray-500">Real-time status of certified AI agents in production.</p>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeProjects.map(project => (
                <div key={project.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden relative">
                    <div className="absolute top-0 left-0 w-full h-1 bg-green-500"></div>
                    <div className="p-6">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="font-bold text-unDark truncate pr-4">{project.name}</h3>
                            <div className="flex items-center space-x-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded">
                                <Activity size={12} />
                                <span>LIVE</span>
                            </div>
                        </div>
                        
                        <div className="space-y-4 mb-6">
                             {/* Mock Metrics */}
                             <div>
                                <div className="flex justify-between text-xs text-gray-500 mb-1">
                                    <span>Drift Score</span>
                                    <span>0.02 (Low)</span>
                                </div>
                                <div className="w-full h-1.5 bg-gray-100 rounded-full">
                                    <div className="w-[2%] h-full bg-blue-500 rounded-full"></div>
                                </div>
                             </div>
                             <div>
                                <div className="flex justify-between text-xs text-gray-500 mb-1">
                                    <span>Latency</span>
                                    <span>45ms</span>
                                </div>
                                <div className="w-full h-1.5 bg-gray-100 rounded-full">
                                    <div className="w-[15%] h-full bg-green-500 rounded-full"></div>
                                </div>
                             </div>
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                            <div className="flex items-center space-x-2 text-gray-500 text-xs">
                                <ShieldCheck size={14} className="text-green-600" />
                                <span>Policy Active</span>
                            </div>
                            <button 
                                onClick={() => onUpdateStatus(project.id, ProjectStatus.SUSPENDED)}
                                className="text-xs font-bold text-red-600 hover:bg-red-50 px-3 py-1.5 rounded transition-colors flex items-center"
                            >
                                <PauseCircle size={14} className="mr-1" /> Suspend
                            </button>
                        </div>
                    </div>
                </div>
            ))}
            
            {activeProjects.length === 0 && (
                <div className="col-span-full text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                    <Zap className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No active agents deployed.</p>
                </div>
            )}
       </div>
    </div>
  );
};

export default LiveMonitoring;