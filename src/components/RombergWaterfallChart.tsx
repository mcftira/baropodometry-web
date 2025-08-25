'use client';

import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface WaterfallProps {
  romberg: any;
  cotton: any;
}

const RombergWaterfallChart: React.FC<WaterfallProps> = ({ romberg, cotton }) => {
  const [selectedEffect, setSelectedEffect] = useState<'romberg' | 'cotton'>('romberg');
  
  // Prepare waterfall data
  const prepareWaterfallData = (data: any) => {
    if (!data) return [];
    
    const metrics = ['length_mm', 'area_mm2', 'velocity_mm_s', 'l_s_ratio', 'ellipse_ratio', 
                    'velocity_variance_total_mm_s', 'velocity_variance_ml_mm_s', 'velocity_variance_ap_mm_s',
                    'ap_acceleration_mm_s2', 'lfs'];
    
    return metrics.map(metric => {
      const metricData = data[metric];
      if (!metricData) return null;
      
      const value = (metricData.ratio - 1) * 100; // Convert ratio to percentage change
      const displayName = metric
        .replace(/_/g, ' ')
        .replace('mm', '')
        .replace('mm2', '²')
        .replace('mm s', '/s')
        .replace('s2', 's²')
        .replace('lfs', 'LFS')
        .replace('l s', 'L/S');
      
      return {
        name: displayName,
        value: value,
        displayValue: metricData.pct_change,
        ratio: metricData.ratio,
        fill: value > 0 ? '#ef4444' : '#10b981', // Red for increase, green for decrease
      };
    }).filter(Boolean);
  };
  
  const waterfallData = selectedEffect === 'romberg' 
    ? prepareWaterfallData(romberg)
    : prepareWaterfallData(cotton);

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload[0]) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-sm">{data.name}</p>
          <p className="text-sm">
            Ratio: <span className="font-bold">{data.ratio?.toFixed(2)}</span>
          </p>
          <p className="text-sm">
            Change: <span className={`font-bold ${data.value > 0 ? 'text-red-500' : 'text-green-500'}`}>
              {data.displayValue}
            </span>
          </p>
        </div>
      );
    }
    return null;
  };

  // Calculate summary statistics
  const avgChange = waterfallData.reduce((sum, item) => sum + item.value, 0) / waterfallData.length;
  const maxIncrease = Math.max(...waterfallData.map(item => item.value));
  const maxDecrease = Math.min(...waterfallData.map(item => item.value));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full"
    >
      {/* Header with toggle */}
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-sm font-medium text-gray-700">Sensory Condition Effects</h4>
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedEffect('romberg')}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              selectedEffect === 'romberg' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Romberg (B/A)
          </button>
          <button
            onClick={() => setSelectedEffect('cotton')}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              selectedEffect === 'cotton' 
                ? 'bg-green-500 text-white' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Cotton (C/B)
          </button>
        </div>
      </div>

      {/* Effect Description */}
      <div className={`p-3 rounded-lg mb-4 ${
        selectedEffect === 'romberg' ? 'bg-blue-50' : 'bg-green-50'
      }`}>
        <p className="text-xs text-gray-600">
          {selectedEffect === 'romberg' 
            ? 'Romberg Effect: Changes when closing eyes (Visual system removal)'
            : 'Cotton Effect: Changes with cotton rolls + closed eyes (Stomatognathic modulation)'}
        </p>
      </div>

      {/* Waterfall Chart */}
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={waterfallData}
          margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey="name" 
            angle={-45}
            textAnchor="end"
            height={100}
            tick={{ fontSize: 10 }}
          />
          <YAxis 
            tick={{ fontSize: 10 }}
            label={{ value: '% Change', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }}
            domain={[-100, 200]}
          />
          <Tooltip content={<CustomTooltip />} />
          
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {waterfallData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3 mt-4">
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="flex items-center gap-1 mb-1">
            {avgChange > 0 ? (
              <TrendingUp className="w-4 h-4 text-red-500" />
            ) : avgChange < 0 ? (
              <TrendingDown className="w-4 h-4 text-green-500" />
            ) : (
              <Minus className="w-4 h-4 text-gray-500" />
            )}
            <span className="text-xs text-gray-600">Average</span>
          </div>
          <div className={`text-lg font-bold ${
            avgChange > 0 ? 'text-red-600' : 'text-green-600'
          }`}>
            {avgChange > 0 ? '+' : ''}{avgChange.toFixed(1)}%
          </div>
        </div>
        
        <div className="bg-red-50 p-3 rounded-lg">
          <div className="flex items-center gap-1 mb-1">
            <TrendingUp className="w-4 h-4 text-red-500" />
            <span className="text-xs text-gray-600">Max Increase</span>
          </div>
          <div className="text-lg font-bold text-red-600">
            +{maxIncrease.toFixed(1)}%
          </div>
        </div>
        
        <div className="bg-green-50 p-3 rounded-lg">
          <div className="flex items-center gap-1 mb-1">
            <TrendingDown className="w-4 h-4 text-green-500" />
            <span className="text-xs text-gray-600">Max Decrease</span>
          </div>
          <div className="text-lg font-bold text-green-600">
            {maxDecrease.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Interpretation Guide */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <p className="text-xs text-gray-600">
          <span className="font-medium">Interpretation:</span>{' '}
          {selectedEffect === 'romberg' ? (
            <>
              Red bars (↑) indicate increased instability without vision. 
              Large increases suggest visual dependency.
            </>
          ) : (
            <>
              Green bars (↓) indicate stabilization with cotton rolls. 
              Reductions suggest stomatognathic influence on posture.
            </>
          )}
        </p>
      </div>
    </motion.div>
  );
};

export default RombergWaterfallChart;
