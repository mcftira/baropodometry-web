'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, Footprints, TrendingUp, TrendingDown } from 'lucide-react';

interface LoadBalanceProps {
  data: {
    A?: any;
    B?: any;
    C?: any;
  };
}

const LoadBalanceVisualization: React.FC<LoadBalanceProps> = ({ data }) => {
  const [selectedTest, setSelectedTest] = useState<'A' | 'B' | 'C'>('A');
  
  const test = data[selectedTest];
  
  // Extract load data
  const leftLoad = test?.page1?.page6_left_load_pct || 50;
  const rightLoad = test?.page1?.page6_right_load_pct || 50;
  const quadrants = test?.page1?.quadrant_loads_pct || [25, 25, 25, 25];
  const leftPressure = test?.page1?.left_mean_pressure || 0;
  const rightPressure = test?.page1?.right_mean_pressure || 0;
  
  // Calculate asymmetry
  const loadAsymmetry = Math.abs(leftLoad - rightLoad);
  const pressureAsymmetry = Math.abs(leftPressure - rightPressure);
  
  // Foot data from page 2
  const leftFoot = test?.page2?.left || {};
  const rightFoot = test?.page2?.right || {};
  const lessStableFoot = test?.page2?.foot_stabilograms?.less_stable_foot;
  
  // Color intensity based on load percentage
  const getColorIntensity = (value: number, max: number = 100) => {
    const intensity = Math.min(value / max, 1);
    return `rgba(239, 68, 68, ${intensity * 0.8})`; // Red with varying opacity
  };
  
  // Foot component
  const Foot = ({ side, load, pressure, footData, isLessStable }: any) => {
    const isLeft = side === 'left';
    const frontQuad = isLeft ? quadrants[0] : quadrants[1];
    const backQuad = isLeft ? quadrants[2] : quadrants[3];
    
    return (
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, delay: isLeft ? 0 : 0.1 }}
        className="relative"
      >
        {/* Foot outline */}
        <svg
          width="150"
          height="250"
          viewBox="0 0 150 250"
          className={`${isLeft ? '' : 'scale-x-[-1]'}`}
        >
          {/* Foot shape */}
          <path
            d="M 75 10 
               C 40 10, 20 30, 20 60
               L 20 180
               C 20 210, 30 230, 50 240
               L 100 240
               C 120 230, 130 210, 130 180
               L 130 60
               C 130 30, 110 10, 75 10 Z"
            fill={getColorIntensity(load)}
            stroke="#374151"
            strokeWidth="2"
          />
          
          {/* Toes */}
          <circle cx="75" cy="25" r="8" fill={getColorIntensity(frontQuad, 50)} />
          <circle cx="55" cy="30" r="6" fill={getColorIntensity(frontQuad, 50)} />
          <circle cx="95" cy="30" r="6" fill={getColorIntensity(frontQuad, 50)} />
          <circle cx="45" cy="35" r="5" fill={getColorIntensity(frontQuad, 50)} />
          <circle cx="105" cy="35" r="5" fill={getColorIntensity(frontQuad, 50)} />
          
          {/* Quadrant division line */}
          <line
            x1="20"
            y1="120"
            x2="130"
            y2="120"
            stroke="#6b7280"
            strokeWidth="1"
            strokeDasharray="5,5"
            opacity="0.5"
          />
          
          {/* Front quadrant text */}
          <text
            x="75"
            y="80"
            textAnchor="middle"
            className="fill-white text-sm font-bold"
          >
            {frontQuad}%
          </text>
          
          {/* Back quadrant text */}
          <text
            x="75"
            y="180"
            textAnchor="middle"
            className="fill-white text-sm font-bold"
          >
            {backQuad}%
          </text>
          
          {/* Less stable indicator */}
          {isLessStable && (
            <motion.circle
              cx="75"
              cy="120"
              r="20"
              fill="none"
              stroke="#fbbf24"
              strokeWidth="3"
              strokeDasharray="5,5"
              initial={{ scale: 0 }}
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          )}
        </svg>
        
        {/* Foot label and data */}
        <div className="text-center mt-2">
          <div className="text-sm font-medium text-gray-700">
            {isLeft ? 'Left' : 'Right'} Foot
          </div>
          <div className="text-lg font-bold text-gray-900">{load}%</div>
          <div className="text-xs text-gray-500">Load</div>
          
          {/* Pressure */}
          <div className="mt-2 text-xs">
            <span className="text-gray-600">Pressure: </span>
            <span className="font-medium">{pressure.toFixed(1)}</span>
          </div>
          
          {/* Stability indicator */}
          {isLessStable && (
            <div className="mt-1 px-2 py-1 bg-yellow-100 rounded-full">
              <span className="text-xs text-yellow-700 font-medium">Less Stable</span>
            </div>
          )}
        </div>
        
        {/* Foot metrics */}
        <div className="mt-3 space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-600">Length:</span>
            <span className="font-medium">{footData.length_mm?.toFixed(1) || '-'} mm</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Area:</span>
            <span className="font-medium">{footData.area_mm2?.toFixed(1) || '-'} mm²</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Velocity:</span>
            <span className="font-medium">{footData.velocity_mm_s?.toFixed(2) || '-'} mm/s</span>
          </div>
        </div>
      </motion.div>
    );
  };
  
  // Center of pressure indicator
  const copX = test?.page1?.cop_mean_x_mm || 0;
  const copY = test?.page1?.cop_mean_y_mm || 0;
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="w-full"
    >
      {/* Header with test selector */}
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-sm font-medium text-gray-700">Load Distribution & Balance</h4>
        <div className="flex gap-2">
          {(['A', 'B', 'C'] as const).map((testKey) => (
            <button
              key={testKey}
              onClick={() => setSelectedTest(testKey)}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                selectedTest === testKey
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {testKey === 'A' ? 'Neutral' : testKey === 'B' ? 'Closed Eyes' : 'Cotton Rolls'}
            </button>
          ))}
        </div>
      </div>
      
      {/* Main visualization */}
      <div className="grid grid-cols-2 gap-8">
        {/* Left foot */}
        <Foot
          side="left"
          load={leftLoad}
          pressure={leftPressure}
          footData={leftFoot}
          isLessStable={lessStableFoot === 'left'}
        />
        
        {/* Right foot */}
        <Foot
          side="right"
          load={rightLoad}
          pressure={rightPressure}
          footData={rightFoot}
          isLessStable={lessStableFoot === 'right'}
        />
      </div>
      
      {/* Center of Pressure indicator */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-medium text-gray-700">Center of Pressure</span>
        </div>
        
        <div className="relative h-32 bg-white rounded-lg border-2 border-gray-200">
          {/* CoP visualization */}
          <div className="absolute inset-0 flex items-center justify-center">
            {/* Grid lines */}
            <div className="absolute inset-0">
              <div className="absolute top-1/2 left-0 right-0 border-t border-gray-300"></div>
              <div className="absolute left-1/2 top-0 bottom-0 border-l border-gray-300"></div>
            </div>
            
            {/* CoP point */}
            <motion.div
              className="absolute w-4 h-4 bg-red-500 rounded-full shadow-lg"
              style={{
                left: `${50 + (copX / 10) * 20}%`,
                top: `${50 - (copY / 10) * 20}%`,
              }}
              initial={{ scale: 0 }}
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            
            {/* CoP values */}
            <div className="absolute bottom-2 left-2 text-xs text-gray-600">
              X: {copX.toFixed(1)} mm
            </div>
            <div className="absolute bottom-2 right-2 text-xs text-gray-600">
              Y: {copY.toFixed(1)} mm
            </div>
          </div>
        </div>
      </div>
      
      {/* Asymmetry indicators */}
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div className="bg-blue-50 p-3 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Footprints className="w-4 h-4 text-blue-500" />
            <span className="text-xs text-gray-600">Load Asymmetry</span>
          </div>
          <div className={`text-lg font-bold ${
            loadAsymmetry < 5 ? 'text-green-600' : loadAsymmetry < 10 ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {loadAsymmetry.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {loadAsymmetry < 5 ? 'Balanced' : loadAsymmetry < 10 ? 'Mild asymmetry' : 'Significant asymmetry'}
          </div>
        </div>
        
        <div className="bg-purple-50 p-3 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            {pressureAsymmetry > 10 ? (
              <TrendingUp className="w-4 h-4 text-purple-500" />
            ) : (
              <TrendingDown className="w-4 h-4 text-purple-500" />
            )}
            <span className="text-xs text-gray-600">Pressure Difference</span>
          </div>
          <div className="text-lg font-bold text-purple-600">
            {pressureAsymmetry.toFixed(1)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {leftPressure > rightPressure ? 'Left > Right' : 'Right > Left'}
          </div>
        </div>
      </div>
      
      {/* Load progression across tests */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <p className="text-xs font-medium text-gray-700 mb-2">Load Shift Pattern:</p>
        <div className="flex items-center justify-between">
          {(['A', 'B', 'C'] as const).map((testKey, idx) => {
            const testData = data[testKey];
            const left = testData?.page1?.page6_left_load_pct || 50;
            const right = testData?.page1?.page6_right_load_pct || 50;
            
            return (
              <React.Fragment key={testKey}>
                <div className="text-center">
                  <div className="text-xs text-gray-600">
                    {testKey === 'A' ? 'Neutral' : testKey === 'B' ? 'Closed Eyes' : 'Cotton'}
                  </div>
                  <div className="text-sm font-medium mt-1">
                    <span className="text-blue-600">{left}%</span>
                    {' / '}
                    <span className="text-green-600">{right}%</span>
                  </div>
                </div>
                {idx < 2 && (
                  <div className="text-gray-400">→</div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};

export default LoadBalanceVisualization;
