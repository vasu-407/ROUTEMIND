import React from 'react';
import { motion } from 'framer-motion';

const KpiCard = ({ title, value, unit, icon, colorClass, trend }) => {
  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col justify-between h-32"
    >
      <div className="flex justify-between items-start">
        <span className="text-gray-500 font-medium text-sm">{title}</span>
        <div className={`p-2 rounded-lg bg-opacity-20 ${colorClass}`}>
          {icon}
        </div>
      </div>
      
      <div>
        <div className="flex items-baseline">
          <h2 className="text-3xl font-bold text-gray-800">{value}</h2>
          {unit && <span className="ml-1 text-sm font-medium text-gray-500">{unit}</span>}
        </div>
        {trend && (
          <p className={`text-xs mt-1 ${trend.positive ? 'text-green-500' : 'text-red-500'} font-medium`}>
            {trend.positive ? '↑' : '↓'} {trend.value} vs yesterday
          </p>
        )}
      </div>
    </motion.div>
  );
};

export default KpiCard;
