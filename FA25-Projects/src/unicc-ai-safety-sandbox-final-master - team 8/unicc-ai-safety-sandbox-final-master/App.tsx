import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import NewAssessment from './components/NewAssessment';
import ASRBReview from './components/ASRBReview';
import LiveMonitoring from './components/LiveMonitoring';
import HelpResources from './components/HelpResources';
import Settings from './components/Settings';
import { Project, ProjectStatus, UserRole, RiskTier } from './types';

// Mock Initial Data
const INITIAL_PROJECTS: Project[] = [
  {
    id: 'p1',
    name: 'Agri-Logistics Optimizer',
    description: 'Optimizes food delivery routes in conflict zones using satellite data.',
    owner: 'UNDP Tech Team',
    status: ProjectStatus.PENDING_REVIEW,
    submittedAt: Date.now() - 86400000 * 2,
    domain: 'Essential Services',
    capabilities: [],
    isHighAutonomy: true,
    riskTier: RiskTier.TIER_3,
    riskReasoning: 'Operates in essential services with high autonomy.',
    auditLogs: [],
    testResults: [],
    safetyScore: 85
  },
  {
    id: 'p2',
    name: 'DocuTranslatr v2',
    description: 'Internal document translation for meeting minutes.',
    owner: 'Secretariat',
    status: ProjectStatus.APPROVED,
    submittedAt: Date.now() - 86400000 * 10,
    domain: 'Translation',
    capabilities: [],
    isHighAutonomy: false,
    riskTier: RiskTier.TIER_1,
    riskReasoning: 'Standard administrative task.',
    auditLogs: [],
    testResults: [],
    safetyScore: 98
  }
];

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [userRole, setUserRole] = useState<UserRole>(UserRole.PROJECT_OWNER);
  
  // Initialize from LocalStorage or fallback to INITIAL_PROJECTS
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const saved = localStorage.getItem('unicc_projects');
      return saved ? JSON.parse(saved) : INITIAL_PROJECTS;
    } catch (e) {
      console.error("Failed to load projects from storage", e);
      return INITIAL_PROJECTS;
    }
  });

  // Save to LocalStorage whenever projects change
  useEffect(() => {
    localStorage.setItem('unicc_projects', JSON.stringify(projects));
  }, [projects]);

  const handleProjectCreate = (newProject: Project) => {
    setProjects(prev => [newProject, ...prev]);
    setActiveTab('dashboard');
  };

  const handleStatusUpdate = (id: string, status: ProjectStatus) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, status } : p));
  };

  const handleResetData = () => {
    if (confirm("Are you sure you want to delete all local data and reset to defaults?")) {
      localStorage.removeItem('unicc_projects');
      setProjects(INITIAL_PROJECTS);
      alert("System reset complete.");
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': 
        return <Dashboard projects={projects} setActiveTab={setActiveTab} />;
      case 'new-assessment': 
        return <NewAssessment onProjectCreate={handleProjectCreate} currentUser={userRole === UserRole.PROJECT_OWNER ? "You" : "Project Owner"} />;
      case 'asrb-review': 
        return <ASRBReview projects={projects} onUpdateStatus={handleStatusUpdate} userRole={userRole} />;
      case 'monitoring':
        return <LiveMonitoring projects={projects} onUpdateStatus={handleStatusUpdate} />;
      case 'help':
        return <HelpResources />;
      case 'settings':
        return <Settings userRole={userRole} setUserRole={setUserRole} onResetData={handleResetData} />;
      default: 
        return <Dashboard projects={projects} setActiveTab={setActiveTab} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-gray-800 font-sans flex">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} userRole={userRole} />
      
      <main className="flex-1 ml-64 p-8 overflow-y-auto h-screen">
        <div className="max-w-7xl mx-auto">
             {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default App;