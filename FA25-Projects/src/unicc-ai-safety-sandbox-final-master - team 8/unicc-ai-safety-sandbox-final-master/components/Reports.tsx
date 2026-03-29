import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Award, Download, CheckCircle, FileCheck, XCircle, ShieldCheck } from 'lucide-react';

const Reports: React.FC = () => {
  // Mock Data for charts matching the new Dual-Suite structure
  const data = [
    { name: 'Suite A: Core', progress: 100, full: 100 },
    { name: 'Suite B: Adversarial', progress: 85, full: 100 },
    { name: 'Transparency', progress: 100, full: 100 },
    { name: 'Privacy', progress: 90, full: 100 },
  ];

  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-unDark">AI Safety Case Report</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Progress Dashboard */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-lg font-semibold mb-6 flex items-center">
                <FileCheck className="w-5 h-5 text-unBlue mr-2" />
                Benchmark Completion Status
            </h3>
            <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} layout="vertical" margin={{ left: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" domain={[0, 100]} hide />
                        <YAxis dataKey="name" type="category" width={120} tick={{fontSize: 12}} />
                        <Tooltip />
                        <Bar dataKey="progress" fill="#009EDB" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
                 <div className="bg-green-50 p-4 rounded-lg flex items-center border border-green-100">
                    <ShieldCheck className="text-green-600 w-8 h-8 mr-3" />
                    <div>
                        <div className="text-2xl font-bold text-green-700">92%</div>
                        <div className="text-xs text-green-600">Core Safety (Suite A)</div>
                    </div>
                 </div>
                 <div className="bg-orange-50 p-4 rounded-lg flex items-center border border-orange-100">
                    <CheckCircle className="text-orange-600 w-8 h-8 mr-3" />
                    <div>
                        <div className="text-2xl font-bold text-orange-700">85%</div>
                        <div className="text-xs text-orange-600">Resilience (Suite B)</div>
                    </div>
                 </div>
            </div>
        </div>

        {/* Certificate Preview */}
        <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-lg relative overflow-hidden">
            {/* Watermark */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-[0.03]">
                <Award size={300} />
            </div>

            <div className="border-4 border-double border-gray-200 h-full p-6 flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-unBlue text-white rounded-full flex items-center justify-center mb-4">
                    <Award size={32} />
                </div>
                
                <h2 className="text-2xl font-serif font-bold text-unDark mb-2">Certificate of Conformance</h2>
                <p className="text-sm text-gray-500 uppercase tracking-widest mb-8">United Nations International Computing Centre</p>

                <div className="w-full space-y-4 text-left mb-8 text-sm">
                    <div className="flex justify-between border-b border-dotted border-gray-300 pb-1">
                        <span className="text-gray-500">System Name:</span>
                        <span className="font-semibold">Agri-Logistics Optimizer v4</span>
                    </div>
                    <div className="flex justify-between border-b border-dotted border-gray-300 pb-1">
                        <span className="text-gray-500">Approved Domain:</span>
                        <span className="font-semibold">Essential Services</span>
                    </div>
                    <div className="flex justify-between border-b border-dotted border-gray-300 pb-1">
                        <span className="text-gray-500">Risk Classification:</span>
                        <span className="font-bold text-orange-600">Tier 3 (High Impact)</span>
                    </div>
                    <div className="flex justify-between border-b border-dotted border-gray-300 pb-1">
                        <span className="text-gray-500">Compliance Status:</span>
                        <span className="font-bold text-green-600">PROVISIONAL PASS</span>
                    </div>
                     <div className="flex justify-between border-b border-dotted border-gray-300 pb-1">
                        <span className="text-gray-500">Date of Issuance:</span>
                        <span className="font-semibold">{currentDate}</span>
                    </div>
                </div>

                <div className="mt-auto pt-6 flex w-full justify-between items-end">
                    <div className="text-left">
                        <div className="h-10 w-32 border-b border-black mb-1">
                            {/* Signature simulation */}
                            <span className="font-cursive text-lg ml-2 italic text-gray-600">Dr. A. Smith</span>
                        </div>
                        <p className="text-[10px] uppercase text-gray-500">Chief Safety Officer</p>
                    </div>
                    <div className="w-20 h-20 border-2 border-unBlue rounded-full flex items-center justify-center rotate-[-15deg] opacity-80">
                         <span className="text-[10px] font-bold text-unBlue text-center leading-tight">OFFICIAL<br/>AUDIT<br/>PASSED</span>
                    </div>
                </div>
            </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button className="bg-unDark text-white px-6 py-3 rounded-lg flex items-center space-x-2 hover:bg-black transition-colors">
            <Download size={18} />
            <span>Generate & Download PDF</span>
        </button>
      </div>
    </div>
  );
};

export default Reports;