'use client';

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle, ArrowUp, ArrowDown } from 'lucide-react';

interface VNStatusProps {
  data: {
    A?: any;
    B?: any;
    C?: any;
  };
}

const VNStatusDistribution: React.FC<VNStatusProps> = ({ data }) => {
  // Count VN statuses for each test
  const countVNStatuses = (test: any) => {
    if (!test?.page1?.global_metrics) return { below: 0, within: 0, above: 0, not_printed: 0 };
    
    const counts = { below: 0, within: 0, above: 0, not_printed: 0 };
    const globals = test.page1.global_metrics;
    
    // Count global metrics VN statuses
    Object.values(globals).forEach((metric: any) => {
      if (metric?.vn_status) {
        counts[metric.vn_status as keyof typeof counts]++;
      }
    });
    
    // Add COP VN statuses
    if (test.page1.cop_x_vn_status) counts[test.page1.cop_x_vn_status as keyof typeof counts]++;
    if (test.page1.cop_y_vn_status) counts[test.page1.cop_y_vn_status as keyof typeof counts]++;
    
    return counts;
  };
  
  const countsA = countVNStatuses(data.A);
  const countsB = countVNStatuses(data.B);
  const countsC = countVNStatuses(data.C);
  
  // Prepare data for stacked bar chart
  const chartData = [
    {
      name: 'Neutral',
      below: countsA.below,
      within: countsA.within,
      above: countsA.above,
      not_printed: countsA.not_printed,
      total: countsA.below + countsA.within + countsA.above,
    },
    {
      name: 'Closed Eyes',
      below: countsB.below,
      within: countsB.within,
      above: countsB.above,
      not_printed: countsB.not_printed,
      total: countsB.below + countsB.within + countsB.above,
    },
    {
      name: 'Cotton Rolls',
      below: countsC.below,
      within: countsC.within,
      above: countsC.above,
      not_printed: countsC.not_printed,
      total: countsC.below + countsC.within + countsC.above,
    },
  ];
  
  // Calculate compliance percentages
  const getComplianceRate = (counts: any) => {
    const total = counts.below + counts.within + counts.above;
    if (total === 0) return 0;
    return (counts.within / total * 100).toFixed(1);
  };
  
  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-sm mb-2">{label}</p>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded"></div>
              <span className="text-xs">Below: {data.below}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              <span className="text-xs">Within: {data.within}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-500 rounded"></div>
              <span className="text-xs">Above: {data.above}</span>
            </div>
            <div className="border-t pt-1 mt-1">
              <span className="text-xs font-medium">
                Compliance: {getComplianceRate(data)}%
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // Individual metric details
  const getMetricDetails = (test: any) => {
    if (!test?.page1?.global_metrics) return [];
    
    const details: any[] = [];
    const globals = test.page1.global_metrics;
    
    // Process each metric
    const metricNames: { [key: string]: string } = {
      length_mm: 'Length',
      area_mm2: 'Area',
      velocity_mm_s: 'Velocity',
      l_s_ratio: 'L/S Ratio',
      ellipse_ratio: 'Ellipse Ratio',
      lfs: 'LFS',
      ap_acceleration_mm_s2: 'AP Accel',
      velocity_variance_total_mm_s: 'Vel Var Total',
      velocity_variance_ml_mm_s: 'Vel Var ML',
      velocity_variance_ap_mm_s: 'Vel Var AP',
    };
    
    Object.entries(metricNames).forEach(([key, displayName]) => {
      if (globals[key]) {
        details.push({
          name: displayName,
          value: globals[key].value,
          status: globals[key].vn_status,
        });
      }
    });
    
    // Add COP metrics
    if (test.page1.cop_mean_x_mm !== undefined) {
      details.push({
        name: 'COP X',
        value: test.page1.cop_mean_x_mm,
        status: test.page1.cop_x_vn_status,
      });
    }
    if (test.page1.cop_mean_y_mm !== undefined) {
      details.push({
        name: 'COP Y',
        value: test.page1.cop_mean_y_mm,
        status: test.page1.cop_y_vn_status,
      });
    }
    
    return details;
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full"
    >
      <h4 className="text-sm font-medium text-gray-700 mb-4">V.N. Status Distribution</h4>
      
      {/* Stacked Bar Chart */}
      <ResponsiveContainer width="100%" height={200}>
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip content={<CustomTooltip />} />
          
          <Bar dataKey="below" stackId="a" fill="#ef4444" name="Below" />
          <Bar dataKey="within" stackId="a" fill="#10b981" name="Within" />
          <Bar dataKey="above" stackId="a" fill="#f59e0b" name="Above" />
        </BarChart>
      </ResponsiveContainer>

      {/* Compliance Cards */}
      <div className="grid grid-cols-3 gap-3 mt-4">
        {chartData.map((test, idx) => {
          const complianceRate = getComplianceRate(test);
          const isGood = parseFloat(complianceRate) > 50;
          
          return (
            <div key={idx} className="bg-gray-50 p-3 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">{test.name}</div>
              <div className={`text-xl font-bold ${isGood ? 'text-green-600' : 'text-yellow-600'}`}>
                {complianceRate}%
              </div>
              <div className="text-xs text-gray-500">compliance</div>
              <div className="flex items-center gap-1 mt-2">
                {isGood ? (
                  <CheckCircle className="w-3 h-3 text-green-500" />
                ) : (
                  <AlertCircle className="w-3 h-3 text-yellow-500" />
                )}
                <span className="text-xs text-gray-600">
                  {test.within}/{test.total} within
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detailed Breakdown */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <p className="text-xs font-medium text-gray-700 mb-2">Key Outliers:</p>
        <div className="grid grid-cols-3 gap-2">
          {['A', 'B', 'C'].map((testKey) => {
            const test = data[testKey as keyof typeof data];
            const details = getMetricDetails(test);
            const outliers = details.filter(d => d.status === 'below' || d.status === 'above');
            
            return (
              <div key={testKey} className="space-y-1">
                <div className="text-xs font-medium text-gray-600">
                  {testKey === 'A' ? 'Neutral' : testKey === 'B' ? 'Closed Eyes' : 'Cotton Rolls'}
                </div>
                {outliers.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="flex items-center gap-1">
                    {item.status === 'below' ? (
                      <ArrowDown className="w-3 h-3 text-red-500" />
                    ) : (
                      <ArrowUp className="w-3 h-3 text-yellow-500" />
                    )}
                    <span className="text-xs text-gray-600">{item.name}</span>
                  </div>
                ))}
                {outliers.length === 0 && (
                  <span className="text-xs text-gray-400">All within range</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-4">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-red-500 rounded"></div>
          <span className="text-xs text-gray-600">Below Normal</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-500 rounded"></div>
          <span className="text-xs text-gray-600">Within Normal</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-yellow-500 rounded"></div>
          <span className="text-xs text-gray-600">Above Normal</span>
        </div>
      </div>
    </motion.div>
  );
};

export default VNStatusDistribution;
