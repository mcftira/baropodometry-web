'use client';

import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { motion } from 'framer-motion';

interface PosturalRadarProps {
  data: {
    A?: any;
    B?: any;
    C?: any;
  };
}

const PosturalRadarChart: React.FC<PosturalRadarProps> = ({ data }) => {
  // Define the metrics we want to show on the radar
  const metrics = ['Length', 'Area', 'Velocity', 'L/S Ratio', 'Ellipse Ratio', 'LFS', 'Accel. AP', 'X Medium', 'Y Medium'];
  
  // Extract and normalize data for radar chart
  const getMetricValue = (test: any, metric: string): number => {
    if (!test?.page1?.global_metrics) return 0;
    
    const globals = test.page1.global_metrics;
    const cop = test.page1;
    
    // Map metric names to actual data fields and normalize to 0-100 scale
    switch (metric) {
      case 'Length':
        return Math.min((globals.length_mm?.value || 0) / 120 * 100, 100);
      case 'Area':
        return Math.min((globals.area_mm2?.value || 0) / 90 * 100, 100);
      case 'Velocity':
        return Math.min((globals.velocity_mm_s?.value || 0) / 8 * 100, 100);
      case 'L/S Ratio':
        return Math.min((globals.l_s_ratio?.value || 0) / 3 * 100, 100);
      case 'Ellipse Ratio':
        return (globals.ellipse_ratio?.value || 0) * 100;
      case 'LFS':
        return (globals.lfs?.value || 0) * 100;
      case 'Accel. AP':
        return Math.min((globals.ap_acceleration_mm_s2?.value || 0) / 30 * 100, 100);
      case 'X Medium':
        return Math.abs(cop.cop_mean_x_mm || 0) / 10 * 100;
      case 'Y Medium':
        return Math.abs(cop.cop_mean_y_mm || 0) / 10 * 100;
      default:
        return 0;
    }
  };

  // Prepare data for the radar chart
  const chartData = metrics.map(metric => ({
    metric,
    'Neutral (A)': data.A ? getMetricValue(data.A, metric) : 0,
    'Closed Eyes (B)': data.B ? getMetricValue(data.B, metric) : 0,
    'Cotton Rolls (C)': data.C ? getMetricValue(data.C, metric) : 0,
  }));

  // Get expanded/contracted axes from dashboard
  const getAxisHighlight = (metric: string, test: any) => {
    if (!test?.page8_dashboard) return 'normal';
    const expanded = test.page8_dashboard.radar_expanded_axes || [];
    const contracted = test.page8_dashboard.radar_contracted_axes || [];
    
    if (expanded.some((axis: string) => metric.toLowerCase().includes(axis.toLowerCase()))) {
      return 'expanded';
    }
    if (contracted.some((axis: string) => metric.toLowerCase().includes(axis.toLowerCase()))) {
      return 'contracted';
    }
    return 'normal';
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="w-full h-full"
    >
      <div className="mb-4">
        <h4 className="text-sm font-medium text-gray-700">Postural Index Multi-Dimensional Analysis</h4>
        <div className="flex items-center gap-4 mt-2">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span className="text-xs">Neutral</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-xs">Closed Eyes</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-xs">Cotton Rolls</span>
          </div>
        </div>
      </div>
      
      <ResponsiveContainer width="100%" height={400}>
        <RadarChart data={chartData}>
          <PolarGrid 
            gridType="polygon" 
            radialLines={true}
            stroke="#e5e7eb"
          />
          <PolarAngleAxis 
            dataKey="metric" 
            tick={{ fontSize: 11 }}
            className="text-gray-600"
          />
          <PolarRadiusAxis 
            angle={90} 
            domain={[0, 100]} 
            tick={{ fontSize: 10 }}
            tickCount={5}
          />
          
          <Radar 
            name="Neutral (A)" 
            dataKey="Neutral (A)" 
            stroke="#3b82f6" 
            fill="#3b82f6" 
            fillOpacity={0.2}
            strokeWidth={2}
          />
          <Radar 
            name="Closed Eyes (B)" 
            dataKey="Closed Eyes (B)" 
            stroke="#ef4444" 
            fill="#ef4444" 
            fillOpacity={0.2}
            strokeWidth={2}
          />
          <Radar 
            name="Cotton Rolls (C)" 
            dataKey="Cotton Rolls (C)" 
            stroke="#10b981" 
            fill="#10b981" 
            fillOpacity={0.2}
            strokeWidth={2}
          />
          
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.95)', 
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '12px'
            }}
            formatter={(value: number) => `${value.toFixed(1)}%`}
          />
        </RadarChart>
      </ResponsiveContainer>
      
      {/* Postural Index Scores */}
      <div className="grid grid-cols-3 gap-4 mt-4">
        {data.A?.page8_dashboard && (
          <div className="text-center p-2 bg-blue-50 rounded-lg">
            <div className="text-xs text-blue-600">Neutral</div>
            <div className="text-lg font-bold text-blue-700">
              {data.A.page8_dashboard.postural_index_score}
            </div>
            <div className="text-xs text-gray-500">P.I. Score</div>
          </div>
        )}
        {data.B?.page8_dashboard && (
          <div className="text-center p-2 bg-red-50 rounded-lg">
            <div className="text-xs text-red-600">Closed Eyes</div>
            <div className="text-lg font-bold text-red-700">
              {data.B.page8_dashboard.postural_index_score}
            </div>
            <div className="text-xs text-gray-500">P.I. Score</div>
          </div>
        )}
        {data.C?.page8_dashboard && (
          <div className="text-center p-2 bg-green-50 rounded-lg">
            <div className="text-xs text-green-600">Cotton Rolls</div>
            <div className="text-lg font-bold text-green-700">
              {data.C.page8_dashboard.postural_index_score}
            </div>
            <div className="text-xs text-gray-500">P.I. Score</div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default PosturalRadarChart;
