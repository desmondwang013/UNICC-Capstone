import React from 'react';
import { LayoutDashboard, ShieldAlert, FileText, Settings, ShieldCheck, Activity, BookOpen, PlusCircle, Gavel } from 'lucide-react';
import { UserRole } from '../types';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userRole: UserRole;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, userRole }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'new-assessment', label: 'New Assessment', icon: PlusCircle },
    { id: 'asrb-review', label: 'ASRB Review', icon: Gavel, restrictedTo: UserRole.ASRB_AUDITOR },
    { id: 'monitoring', label: 'Live Monitoring', icon: Activity },
    { id: 'help', label: 'Help & Resources', icon: BookOpen },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-screen flex flex-col fixed left-0 top-0 z-10">
      <div className="p-6 border-b border-gray-100 flex items-center space-x-3">
        <div className="w-8 h-8 bg-unBlue rounded-md flex items-center justify-center">
             <ShieldCheck className="text-white w-5 h-5" />
        </div>
        <div>
            <h1 className="text-lg font-bold text-unDark tracking-tight">UNICC AI Safety</h1>
            <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Governance Platform</p>
        </div>
      </div>
      
      <div className="px-6 py-4">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Current Role</div>
        <div className={`text-xs font-bold px-2 py-1 rounded inline-block ${userRole === UserRole.ASRB_AUDITOR ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
            {userRole}
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item) => {
          if (item.restrictedTo && item.restrictedTo !== userRole) return null;
          
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors duration-200 ${
                isActive
                  ? 'bg-blue-50 text-unBlue'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-unDark'
              }`}
            >
              <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-100">
        <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center space-x-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-xs font-semibold text-gray-600">Platform Online</span>
            </div>
            <p className="text-[10px] text-gray-400">v3.0.1 (Governance Ed.)</p>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;