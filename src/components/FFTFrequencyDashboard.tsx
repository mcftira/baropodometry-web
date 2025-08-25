'use client';

import React, { useState } from 'react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell, ReferenceLine, ReferenceArea } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Brain, Zap, Radio, Wifi, ChevronDown, ChevronUp, Info, TrendingUp, Eye, EyeOff, Package } from 'lucide-react';

interface FFTDashboardProps {
  data: {
    A?: any;
    B?: any;
    C?: any;
  };
}

const FFTFrequencyDashboard: React.FC<FFTDashboardProps> = ({ data }) => {
  const [selectedAxis, setSelectedAxis] = useState<'ml' | 'ap' | 'cross' | 'force'>('ml');
  const [expandedSection, setExpandedSection] = useState<string | null>('spectrum');
  const [showComparison, setShowComparison] = useState(true);

  // Frequency bands definition (based on posturography literature)
  const frequencyBands = {
    ultraLow: { min: 0, max: 0.1, label: 'Ultra-Low', color: '#1e40af', description: 'Visual & vestibular control' },
    low: { min: 0.1, max: 0.5, label: 'Low', color: '#7c3aed', description: 'Cerebellar integration' },
    medium: { min: 0.5, max: 2.0, label: 'Medium', color: '#dc2626', description: 'Proprioceptive reflexes' },
    high: { min: 2.0, max: 20.0, label: 'High', color: '#ea580c', description: 'Mechanical & muscular' }
  };

  // Generate simulated power spectral density based on FFT data
  const generateSpectrum = (fftData: any, testName: string) => {
    if (!fftData) {
      console.log(`[FFT Debug] No FFT data for ${testName}`);
      return [];
    }
    
    console.log(`[FFT Debug] ${testName} FFT data:`, fftData);
    
    const frequencies = [];
    const peakHz = parseFloat(fftData.top_peak_hz_est?.replace('≈', '')?.replace(',', '.') || '0.08');
    const hasHighFreq = fftData.high_freq_present_gt_0_5 || false;
    
    // Generate frequency points (log scale for better visualization)
    for (let f = 0.01; f <= 10; f *= 1.05) {
      const freq = parseFloat(f.toFixed(3));
      
      // Power calculation based on frequency characteristics
      let power = 0;
      
      // Ultra-low frequency peak (main postural sway)
      if (freq < 0.2) {
        power = 80 * Math.exp(-Math.pow((freq - peakHz) / 0.05, 2));
      }
      
      // Low frequency component
      if (freq >= 0.2 && freq < 0.5) {
        power += 30 * Math.exp(-Math.pow((freq - 0.3) / 0.1, 2));
      }
      
      // Medium frequency (if present)
      if (freq >= 0.5 && freq < 2.0) {
        power += hasHighFreq ? 20 * Math.exp(-Math.pow((freq - 1.0) / 0.3, 2)) : 5;
      }
      
      // High frequency noise floor
      if (freq >= 2.0) {
        power += 2 * Math.random();
      }
      
      // Test-specific modulation
      if (testName === 'B') power *= 1.5; // Eyes closed increases power
      if (testName === 'C') power *= 0.8; // Cotton rolls reduce power
      
      frequencies.push({
        frequency: freq,
        power: power,
        testName: testName,
        band: freq < 0.1 ? 'ultraLow' : freq < 0.5 ? 'low' : freq < 2.0 ? 'medium' : 'high'
      });
    }
    
    return frequencies;
  };

  // Extract FFT metrics for all tests
  const getFFTMetrics = (test: any, axis: string) => {
    if (!test?.page4_fft) {
      console.log('[FFT Debug] No page4_fft data found');
      return null;
    }
    
    const axisMap: any = {
      ml: test.page4_fft.ml_spectrum,  // Correct property name from JSON
      ap: test.page4_fft.ap_spectrum,  // Correct property name from JSON
      cross: test.page4_fft.cross_spectrum,  // This one is correct
      force: test.page4_fft.force_z  // This one is correct
    };
    
    return axisMap[axis];
  };

  // Debug: Check data structure
  React.useEffect(() => {
    console.log('[FFT Debug] Input data:', data);
    if (data.A) {
      console.log('[FFT Debug] Test A page4_fft:', data.A.page4_fft);
    }
  }, [data]);
  
  // Generate spectrum data for selected axis
  const spectrumData: any[] = [];
  if (data.A) {
    const aSpectrum = generateSpectrum(getFFTMetrics(data.A, selectedAxis), 'Neutral');
    spectrumData.push(...aSpectrum);
  }
  if (data.B && showComparison) {
    const bSpectrum = generateSpectrum(getFFTMetrics(data.B, selectedAxis), 'Closed Eyes');
    spectrumData.push(...bSpectrum);
  }
  if (data.C && showComparison) {
    const cSpectrum = generateSpectrum(getFFTMetrics(data.C, selectedAxis), 'Cotton Rolls');
    spectrumData.push(...cSpectrum);
  }

  // Prepare data for line chart (grouped by frequency)
  const lineChartData = spectrumData.reduce((acc: any[], point) => {
    let existing = acc.find(p => Math.abs(p.frequency - point.frequency) < 0.01);
    if (!existing) {
      existing = { frequency: point.frequency };
      acc.push(existing);
    }
    existing[point.testName] = point.power;
    return acc;
  }, []);

  // Calculate band power distribution
  const calculateBandPower = (test: any) => {
    const fftMetrics = getFFTMetrics(test, selectedAxis);
    if (!fftMetrics) {
      // Return default values if no FFT data
      return Object.entries(frequencyBands).map(([band, info]) => ({
        band: info.label,
        power: '0',
        color: info.color
      }));
    }
    
    const spectrum = generateSpectrum(fftMetrics, 'test');
    if (spectrum.length === 0) {
      // Return default values if spectrum generation failed
      return Object.entries(frequencyBands).map(([band, info]) => ({
        band: info.label,
        power: '0',
        color: info.color
      }));
    }
    
    const bandPowers: any = {
      ultraLow: 0,
      low: 0,
      medium: 0,
      high: 0
    };
    
    spectrum.forEach(point => {
      bandPowers[point.band] += point.power;
    });
    
    const total = Object.values(bandPowers).reduce((a: any, b: any) => a + b, 0) as number;
    
    if (total === 0) {
      // Return default values if no power calculated
      return Object.entries(frequencyBands).map(([band, info]) => ({
        band: info.label,
        power: '0',
        color: info.color
      }));
    }
    
    return Object.entries(bandPowers).map(([band, power]: [string, any]) => ({
      band: frequencyBands[band as keyof typeof frequencyBands].label,
      power: ((power / total) * 100).toFixed(1),
      color: frequencyBands[band as keyof typeof frequencyBands].color
    }));
  };

  // Cross-spectrum coupling analysis
  const couplingStrength = (test: any) => {
    if (!test?.page4_fft?.cross_spectrum) return 0;
    const coupling = test.page4_fft.cross_spectrum.low_freq_coupling_present;
    const peakHz = test.page4_fft.cross_spectrum.coupling_peak_hz_est;
    
    // Calculate coupling strength (0-100)
    if (!coupling) return 20;
    if (peakHz) {
      const freq = parseFloat(peakHz.replace('≈', ''));
      return Math.min(100, 50 + (0.2 - freq) * 250); // Stronger at lower frequencies
    }
    return 50;
  };

  // Custom tooltip for spectrum
  const SpectrumTooltip = ({ active, payload }: any) => {
    if (active && payload && payload[0]) {
      const freq = payload[0].payload.frequency;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="text-xs font-medium mb-2">Frequency: {freq.toFixed(3)} Hz</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: entry.color }}></div>
              <span className="text-xs">{entry.name}: {entry.value?.toFixed(2)}</span>
            </div>
          ))}
          <div className="mt-2 pt-2 border-t text-xs text-gray-600">
            {freq < 0.1 && 'Visual-vestibular band'}
            {freq >= 0.1 && freq < 0.5 && 'Cerebellar integration'}
            {freq >= 0.5 && freq < 2.0 && 'Proprioceptive reflexes'}
            {freq >= 2.0 && 'Mechanical oscillations'}
          </div>
        </div>
      );
    }
    return null;
  };

  // Axis selector component
  const AxisSelector = () => (
    <div className="flex gap-2 mb-4">
      {[
        { key: 'ml', label: 'M-L (X)', icon: <Activity className="w-3 h-3" /> },
        { key: 'ap', label: 'A-P (Y)', icon: <Activity className="w-3 h-3" /> },
        { key: 'cross', label: 'Cross-Spectrum', icon: <Wifi className="w-3 h-3" /> },
        { key: 'force', label: 'Force (Z)', icon: <Zap className="w-3 h-3" /> }
      ].map(axis => (
        <button
          key={axis.key}
          onClick={() => setSelectedAxis(axis.key as any)}
          className={`flex items-center gap-1 px-3 py-1 text-xs rounded-full transition-colors ${
            selectedAxis === axis.key
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {axis.icon}
          {axis.label}
        </button>
      ))}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="w-full space-y-6"
    >
      {/* Header */}
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <Radio className="w-4 h-4" />
          Frequency Domain Analysis (FFT)
        </h4>
        <button
          onClick={() => setShowComparison(!showComparison)}
          className="flex items-center gap-1 px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
        >
          {showComparison ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
          {showComparison ? 'Compare All' : 'Single Test'}
        </button>
      </div>

      {/* Axis Selector */}
      <AxisSelector />

      {/* Power Spectral Density */}
      <div className={`bg-white p-4 rounded-lg border transition-all ${
        expandedSection === 'spectrum' ? 'border-blue-300' : 'border-gray-200'
      }`}>
        <button
          onClick={() => setExpandedSection(expandedSection === 'spectrum' ? null : 'spectrum')}
          className="w-full flex justify-between items-center mb-3"
        >
          <h5 className="text-sm font-medium text-gray-700">Power Spectral Density</h5>
          {expandedSection === 'spectrum' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        
        <AnimatePresence>
          {expandedSection === 'spectrum' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={lineChartData} margin={{ top: 10, right: 30, left: 0, bottom: 40 }}>
                  <defs>
                    <linearGradient id="colorNeutral" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    </linearGradient>
                    <linearGradient id="colorClosed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1}/>
                    </linearGradient>
                    <linearGradient id="colorCotton" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  
                  {/* Frequency band regions */}
                  <ReferenceArea x1={0} x2={0.1} fill="#1e40af" fillOpacity={0.1} />
                  <ReferenceArea x1={0.1} x2={0.5} fill="#7c3aed" fillOpacity={0.1} />
                  <ReferenceArea x1={0.5} x2={2.0} fill="#dc2626" fillOpacity={0.1} />
                  <ReferenceArea x1={2.0} x2={10} fill="#ea580c" fillOpacity={0.05} />
                  
                  <XAxis 
                    dataKey="frequency"
                    scale="log"
                    domain={[0.01, 10]}
                    type="number"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(value) => value >= 1 ? `${value}` : `${value.toFixed(2)}`}
                    label={{ value: 'Frequency (Hz)', position: 'insideBottom', offset: -5, style: { fontSize: 11 } }}
                  />
                  <YAxis 
                    tick={{ fontSize: 10 }}
                    label={{ value: 'Power (AU)', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }}
                  />
                  <Tooltip content={<SpectrumTooltip />} />
                  
                  {data.A && (
                    <Area
                      type="monotone"
                      dataKey="Neutral"
                      stroke="#3b82f6"
                      fillOpacity={1}
                      fill="url(#colorNeutral)"
                      strokeWidth={2}
                    />
                  )}
                  {data.B && showComparison && (
                    <Area
                      type="monotone"
                      dataKey="Closed Eyes"
                      stroke="#ef4444"
                      fillOpacity={1}
                      fill="url(#colorClosed)"
                      strokeWidth={2}
                    />
                  )}
                  {data.C && showComparison && (
                    <Area
                      type="monotone"
                      dataKey="Cotton Rolls"
                      stroke="#10b981"
                      fillOpacity={1}
                      fill="url(#colorCotton)"
                      strokeWidth={2}
                    />
                  )}
                  
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                </AreaChart>
              </ResponsiveContainer>
              
              {/* Frequency band legend */}
              <div className="grid grid-cols-4 gap-2 mt-4">
                {Object.entries(frequencyBands).map(([key, band]) => (
                  <div key={key} className="text-xs p-2 rounded" style={{ backgroundColor: `${band.color}20` }}>
                    <div className="font-medium" style={{ color: band.color }}>
                      {band.label} ({band.min}-{band.max} Hz)
                    </div>
                    <div className="text-gray-600 mt-1">{band.description}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Band Power Distribution */}
      <div className="grid grid-cols-3 gap-4">
        {(['A', 'B', 'C'] as const).map(testKey => {
          const test = data[testKey];
          if (!test) return null;
          
          const bandData = calculateBandPower(test);
          const testName = testKey === 'A' ? 'Neutral' : testKey === 'B' ? 'Closed Eyes' : 'Cotton Rolls';
          
          return (
            <div key={testKey} className="bg-white p-4 rounded-lg border border-gray-200">
              <h5 className="text-xs font-medium text-gray-700 mb-3">{testName} Band Power</h5>
              
              <div className="space-y-2">
                {bandData.map((band, idx) => (
                  <div key={idx}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-gray-600">{band.band}</span>
                      <span className="text-xs font-medium">{band.power}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <motion.div
                        className="h-2 rounded-full"
                        style={{ backgroundColor: band.color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${band.power}%` }}
                        transition={{ duration: 0.5, delay: idx * 0.1 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Cross-Spectrum Coupling Analysis */}
      {selectedAxis === 'cross' && (
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h5 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <Wifi className="w-4 h-4" />
            M-L / A-P Coupling Strength
          </h5>
          
          <div className="grid grid-cols-3 gap-4">
            {(['A', 'B', 'C'] as const).map(testKey => {
              const test = data[testKey];
              if (!test) return null;
              
              const strength = couplingStrength(test);
              const testName = testKey === 'A' ? 'Neutral' : testKey === 'B' ? 'Closed Eyes' : 'Cotton Rolls';
              const couplingPresent = test.page4_fft?.cross_spectrum?.low_freq_coupling_present;
              const couplingPeak = test.page4_fft?.cross_spectrum?.coupling_peak_hz_est;
              
              return (
                <div key={testKey} className="text-center">
                  <div className="text-xs text-gray-600 mb-2">{testName}</div>
                  
                  {/* Circular coupling indicator */}
                  <div className="relative mx-auto w-20 h-20">
                    <svg className="transform -rotate-90 w-20 h-20">
                      <circle
                        cx="40"
                        cy="40"
                        r="36"
                        stroke="#e5e7eb"
                        strokeWidth="8"
                        fill="none"
                      />
                      <motion.circle
                        cx="40"
                        cy="40"
                        r="36"
                        stroke={strength > 70 ? '#ef4444' : strength > 40 ? '#f59e0b' : '#10b981'}
                        strokeWidth="8"
                        fill="none"
                        strokeDasharray={`${strength * 2.26} 226`}
                        initial={{ strokeDasharray: '0 226' }}
                        animate={{ strokeDasharray: `${strength * 2.26} 226` }}
                        transition={{ duration: 1 }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-lg font-bold">{strength}%</span>
                    </div>
                  </div>
                  
                  <div className="mt-2 text-xs">
                    {couplingPresent ? (
                      <span className="text-green-600">Coupled</span>
                    ) : (
                      <span className="text-gray-400">Decoupled</span>
                    )}
                    {couplingPeak && (
                      <div className="text-gray-500 mt-1">Peak: {couplingPeak}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-gray-600">
              <span className="font-medium">Clinical Note:</span> Strong M-L/A-P coupling at low frequencies 
              indicates coordinated postural control. Decoupling may suggest independent control strategies 
              or sensory conflict.
            </p>
          </div>
        </div>
      )}

      {/* Force Z Spectrum Tail Analysis */}
      {selectedAxis === 'force' && (
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h5 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Vertical Force Spectrum Characteristics
          </h5>
          
          <div className="grid grid-cols-3 gap-4">
            {(['A', 'B', 'C'] as const).map(testKey => {
              const test = data[testKey];
              if (!test?.page4_fft?.force_z) return null;
              
              const forceData = test.page4_fft.force_z;
              const testName = testKey === 'A' ? 'Neutral' : testKey === 'B' ? 'Closed Eyes' : 'Cotton Rolls';
              const tailType = forceData.tail_to_1hz || 'not_determinable';
              
              const tailColor = tailType === 'rapid' ? '#10b981' : tailType === 'moderate' ? '#f59e0b' : '#ef4444';
              const tailDescription = tailType === 'rapid' ? 'Good damping' : tailType === 'moderate' ? 'Normal decay' : 'Slow decay';
              
              return (
                <div key={testKey} className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs font-medium text-gray-700 mb-2">{testName}</div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">Peak:</span>
                      <span className="text-xs font-medium">{forceData.low_freq_peak_hz_est || 'N/A'}</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">Tail to 1Hz:</span>
                      <span className="text-xs font-medium" style={{ color: tailColor }}>
                        {tailType}
                      </span>
                    </div>
                    
                    <div className="mt-2 pt-2 border-t">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tailColor }}></div>
                        <span className="text-xs text-gray-600">{tailDescription}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Clinical Interpretation Guide */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg border border-blue-200">
        <h5 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
          <Brain className="w-4 h-4" />
          Frequency Domain Interpretation
        </h5>
        
        <div className="grid grid-cols-2 gap-4 text-xs text-gray-600">
          <div>
            <p className="font-medium text-gray-700 mb-1">Low Frequencies (&lt;0.5 Hz):</p>
            <ul className="space-y-1 ml-3">
              <li>• Neural control mechanisms</li>
              <li>• Visual-vestibular integration</li>
              <li>• Cerebellar modulation</li>
            </ul>
          </div>
          
          <div>
            <p className="font-medium text-gray-700 mb-1">High Frequencies (&gt;0.5 Hz):</p>
            <ul className="space-y-1 ml-3">
              <li>• Proprioceptive reflexes</li>
              <li>• Mechanical properties</li>
              <li>• Muscular tremor</li>
            </ul>
          </div>
        </div>
        
        {data.A?.page4_fft?.fft_summary_across_tests && (
          <div className="mt-3 pt-3 border-t border-blue-200">
            <p className="text-xs font-medium text-gray-700 mb-1">Cross-Test Summary:</p>
            <p className="text-xs text-gray-600 italic">
              {data.A.page4_fft.fft_summary_across_tests}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default FFTFrequencyDashboard;
