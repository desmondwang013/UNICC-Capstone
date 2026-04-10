import React from 'react';
import { UserRole } from '../types';
import { UserCog, Key, Trash2 } from 'lucide-react';

interface SettingsProps {
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
  onResetData: () => void;
}

const Settings: React.FC<SettingsProps> = ({ userRole, setUserRole, onResetData }) => {
  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fadeIn">
      <div>
        <h2 className="text-2xl font-bold text-unDark">Settings</h2>
        <p className="text-gray-500">Platform configuration and user preferences.</p>
      </div>

      {/* Role Toggle */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
            <UserCog className="mr-2 text-unBlue" /> User Role Simulation
        </h3>
        <p className="text-sm text-gray-600 mb-4">
            Toggle your active role to experience different parts of the governance workflow.
        </p>
        <div className="flex space-x-4">
            <button 
                onClick={() => setUserRole(UserRole.PROJECT_OWNER)}
                className={`flex-1 py-3 px-4 rounded-lg border-2 text-center font-bold transition-all ${
                    userRole === UserRole.PROJECT_OWNER ? 'border-unBlue text-unBlue bg-blue-50' : 'border-gray-200 text-gray-500'
                }`}
            >
                Project Owner
            </button>
            <button 
                onClick={() => setUserRole(UserRole.ASRB_AUDITOR)}
                className={`flex-1 py-3 px-4 rounded-lg border-2 text-center font-bold transition-all ${
                    userRole === UserRole.ASRB_AUDITOR ? 'border-purple-500 text-purple-700 bg-purple-50' : 'border-gray-200 text-gray-500'
                }`}
            >
                ASRB Auditor
            </button>
        </div>
      </div>

      {/* API Key Config (Visual Only) */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm opacity-60 pointer-events-none">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Key className="mr-2 text-unBlue" /> Judge Agent Configuration
        </h3>
        <p className="text-sm text-gray-600 mb-4">
            Configure the API key used by the "Judge" LLM for scoring adversarial tests. (Managed by Environment in Sandbox).
        </p>
        <input 
            type="password" 
            value="sk-xxxxxxxxxxxxxxxxxxxxxxxx" 
            readOnly
            className="w-full p-3 bg-gray-100 border border-gray-200 rounded-lg text-gray-500 font-mono text-sm"
        />
      </div>

      {/* Data Management */}
      <div className="bg-white p-6 rounded-xl border border-red-100 shadow-sm">
        <h3 className="text-lg font-semibold mb-4 flex items-center text-red-700">
            <Trash2 className="mr-2" /> Data Management
        </h3>
        <p className="text-sm text-gray-600 mb-4">
            Clear all local storage data, including saved projects, test logs, and audit results. This will reset the application to its initial state.
        </p>
        <button 
            onClick={onResetData}
            className="px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg font-bold hover:bg-red-100 transition-colors"
        >
            Reset Application Data
        </button>
      </div>
    </div>
  );
};

export default Settings;