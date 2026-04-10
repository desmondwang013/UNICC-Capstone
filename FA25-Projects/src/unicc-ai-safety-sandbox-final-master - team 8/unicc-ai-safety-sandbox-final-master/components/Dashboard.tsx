import React from 'react';
import { Activity, Users, ShieldAlert, FileText, Clock, CheckCircle2 } from 'lucide-react';
import { Project, ProjectStatus, RiskTier } from '../types';

interface DashboardProps {
  projects: Project[];
  setActiveTab: (tab: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ projects, setActiveTab }) => {
  const activeProjects = projects.filter(p => p.status === ProjectStatus.APPROVED).length;
  const pendingReviews = projects.filter(p => p.status === ProjectStatus.PENDING_REVIEW).length;
  const highRiskCount = projects.filter(p => p.riskTier === RiskTier.TIER_3 || p.riskTier === RiskTier.TIER_4).length;
  const totalCertified = projects.filter(p => p.status === ProjectStatus.APPROVED).length;

  const stats = [
    { label: 'Live Agents', value: activeProjects.toString(), icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Pending ASRB', value: pendingReviews.toString(), icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'High Risk Systems', value: highRiskCount.toString(), icon: ShieldAlert, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Total Certified', value: totalCertified.toString(), icon: FileText, color: 'text-green-600', bg: 'bg-green-50' },
  ];

  const getStatusColor = (status: ProjectStatus) => {
    switch(status) {
        case ProjectStatus.APPROVED: return 'text-green-600 bg-green-50';
        case ProjectStatus.PENDING_REVIEW: return 'text-orange-600 bg-orange-50';
        case ProjectStatus.REJECTED: return 'text-red-600 bg-red-50';
        case ProjectStatus.SUSPENDED: return 'text-gray-600 bg-gray-100';
        default: return 'text-blue-600 bg-blue-50';
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex justify-between items-center">
        <div>
            <h2 className="text-2xl font-bold text-unDark">Governance Dashboard</h2>
            <p className="text-gray-500">Overview of AI system auditing and compliance.</p>
        </div>
        <button 
            onClick={() => setActiveTab('new-assessment')}
            className="bg-unBlue text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors shadow-sm"
        >
            + New Assessment
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => {
            const Icon = stat.icon;
            return (
                <div key={idx} className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-start justify-between hover:shadow-md transition-shadow">
                    <div>
                        <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                        <h3 className="text-3xl font-bold text-unDark mt-2">{stat.value}</h3>
                    </div>
                    <div className={`p-3 rounded-lg ${stat.bg}`}>
                        <Icon className={`w-6 h-6 ${stat.color}`} />
                    </div>
                </div>
            )
        })}
      </div>

      {/* Recent Activity Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
            <h3 className="font-semibold text-unDark">Recent Projects</h3>
            <button onClick={() => setActiveTab('asrb-review')} className="text-sm text-unBlue hover:underline">View Governance Queue</button>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
                    <tr>
                        <th className="px-6 py-3">System Name</th>
                        <th className="px-6 py-3">Domain</th>
                        <th className="px-6 py-3">Risk Tier</th>
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3">Owner</th>
                    </tr>
                </thead>
                <tbody>
                    {projects.slice(0, 5).map((project) => (
                        <tr key={project.id} className="bg-white border-b hover:bg-gray-50">
                            <td className="px-6 py-4 font-medium text-unDark">{project.name}</td>
                            <td className="px-6 py-4">{project.domain}</td>
                            <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                    project.riskTier === RiskTier.TIER_3 || project.riskTier === RiskTier.TIER_4 
                                    ? 'bg-red-100 text-red-800' 
                                    : project.riskTier === RiskTier.TIER_2 
                                    ? 'bg-orange-100 text-orange-800'
                                    : 'bg-green-100 text-green-800'
                                }`}>
                                    {project.riskTier?.split(':')[0] || 'Unknown'}
                                </span>
                            </td>
                            <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(project.status)}`}>
                                    {project.status}
                                </span>
                            </td>
                            <td className="px-6 py-4">{project.owner}</td>
                        </tr>
                    ))}
                    {projects.length === 0 && (
                        <tr>
                            <td colSpan={5} className="text-center py-8 text-gray-500 italic">No projects found. Start a new assessment.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;