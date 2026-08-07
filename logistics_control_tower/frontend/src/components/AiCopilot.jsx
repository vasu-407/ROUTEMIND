import React from 'react';
import { motion } from 'framer-motion';

const AiCopilot = ({ explanation }) => {
  if (!explanation) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-amazon-dark text-white p-6 rounded-xl shadow-2xl mt-6 border-l-4 border-amazon-orange"
    >
      <div className="flex items-center mb-4">
        <span className="text-amazon-orange font-bold text-xl mr-2">✦ AI Copilot</span>
        <span className="bg-green-500 text-xs px-2 py-1 rounded-full font-semibold">{explanation.confidence_score * 100}% Confidence</span>
      </div>
      
      <p className="text-lg mb-4 text-gray-200">{explanation.reason_changed}</p>
      
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-gray-800 p-3 rounded-lg">
          <p className="text-sm text-gray-400 uppercase">Impact</p>
          <p className="font-bold text-xl text-amazon-orange">{explanation.business_impact}</p>
        </div>
        <div className="bg-gray-800 p-3 rounded-lg">
          <p className="text-sm text-gray-400 uppercase">ETA Change</p>
          <p className="font-bold text-xl text-green-400">{explanation.eta_improvement_mins} mins</p>
        </div>
        <div className="bg-gray-800 p-3 rounded-lg">
          <p className="text-sm text-gray-400 uppercase">Constraints Fixed</p>
          <p className="font-bold text-md text-blue-300">{explanation.constraint_triggered.join(", ")}</p>
        </div>
      </div>
      
      <div className="flex justify-between items-center border-t border-gray-700 pt-4">
        <p className="text-sm text-gray-400">Recommendation: <strong className="text-white">{explanation.supervisor_recommendation}</strong></p>
        <button className="bg-amazon-orange hover:bg-yellow-500 text-amazon-dark font-bold py-2 px-6 rounded transition-colors">
          Approve AI Replan
        </button>
      </div>
    </motion.div>
  );
};

export default AiCopilot;
