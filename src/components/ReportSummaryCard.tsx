"use client";

import { 
  TrendingUp, AlertTriangle, CheckCircle, 
  Eye, Brain, Package, Activity 
} from 'lucide-react';

interface ReportSummaryCardProps {
  extracted?: any;
  augmentedText?: string;
}

export default function ReportSummaryCard({ extracted, augmentedText }: ReportSummaryCardProps) {
  if (!extracted && !augmentedText) return null;

  // Extract key findings from the data
  const romberg = extracted?.comparisons?.romberg_b_over_a;
  const cotton = extracted?.comparisons?.cotton_c_over_b;
  
  // Calculate overall stability trends
  const rombergTrend = romberg?.area_mm2?.ratio > 1.5 ? 'concerning' : 
                        romberg?.area_mm2?.ratio > 1.2 ? 'moderate' : 'normal';
  const cottonTrend = cotton?.area_mm2?.ratio < 0.8 ? 'improvement' :
                      cotton?.area_mm2?.ratio > 1.1 ? 'worsening' : 'stable';

  // Extract sensory dominance from augmented text if available
  const findSensoryRanking = (text: string) => {
    // Look for explicit sensory system names after PRIMARY:
    const sensorySystemRegex = /PRIMARY[:\s]+(visual|vestibular|proprioceptive|stomatognathic)/i;
    const match = text.match(sensorySystemRegex);
    if (match) {
      // Capitalize first letter
      return match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
    }
    // Fallback: look for any sensory ranking mention
    const fallbackMatch = text.match(/primary.*?(visual|vestibular|proprioceptive|stomatognathic)/i);
    if (fallbackMatch) {
      return fallbackMatch[1].charAt(0).toUpperCase() + fallbackMatch[1].slice(1).toLowerCase();
    }
    return null;
  };

  // Try to get sensory ranking from structured data first, then fall back to text parsing
  const primarySystem = extracted?.comparisons?.sensory_ranking?.primary 
    ? extracted.comparisons.sensory_ranking.primary.charAt(0).toUpperCase() + extracted.comparisons.sensory_ranking.primary.slice(1).toLowerCase()
    : (augmentedText ? findSensoryRanking(augmentedText) : null);

  return (
    <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 mb-6 border border-blue-200">
      <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
        <Activity className="h-5 w-5 text-blue-600" />
        Clinical Summary at a Glance
      </h2>
      
      <div className="grid gap-4 md:grid-cols-3">
        {/* Romberg Test */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-blue-600" />
              <h3 className="text-sm font-semibold">Romberg (B/A)</h3>
            </div>
            {rombergTrend === 'concerning' && <AlertTriangle className="h-4 w-4 text-orange-500" />}
            {rombergTrend === 'normal' && <CheckCircle className="h-4 w-4 text-green-500" />}
          </div>
          {romberg ? (
            <div className="space-y-1">
              <p className="text-xs text-gray-600">
                Area: <span className="font-semibold">{romberg.area_mm2?.ratio?.toFixed(2)}x</span>
                {romberg.area_mm2?.pct_change && ` (${romberg.area_mm2.pct_change})`}
              </p>
              <p className="text-xs text-gray-600">
                Velocity: <span className="font-semibold">{romberg.velocity_mm_s?.ratio?.toFixed(2)}x</span>
              </p>
              <p className="text-xs text-gray-600">
                Length: <span className="font-semibold">{romberg.length_mm?.ratio?.toFixed(2)}x</span>
              </p>
            </div>
          ) : (
            <p className="text-xs text-gray-500">Data processing...</p>
          )}
        </div>

        {/* Cotton Rolls Test */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-green-600" />
              <h3 className="text-sm font-semibold">Cotton Effect (C/B)</h3>
            </div>
            {cottonTrend === 'improvement' && <TrendingUp className="h-4 w-4 text-green-500" />}
            {cottonTrend === 'worsening' && <TrendingUp className="h-4 w-4 text-red-500 rotate-180" />}
          </div>
          {cotton ? (
            <div className="space-y-1">
              <p className="text-xs text-gray-600">
                Area: <span className="font-semibold">{cotton.area_mm2?.ratio?.toFixed(2)}x</span>
                {cotton.area_mm2?.pct_change && ` (${cotton.area_mm2.pct_change})`}
              </p>
              <p className="text-xs text-gray-600">
                Velocity: <span className="font-semibold">{cotton.velocity_mm_s?.ratio?.toFixed(2)}x</span>
              </p>
              <p className="text-xs text-gray-600">
                L/S Ratio: <span className="font-semibold">{cotton.l_s_ratio?.ratio?.toFixed(2)}x</span>
              </p>
            </div>
          ) : (
            <p className="text-xs text-gray-500">Data processing...</p>
          )}
        </div>

        {/* Sensory System Analysis */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-purple-600" />
              <h3 className="text-sm font-semibold">Sensory Analysis</h3>
            </div>
          </div>
          <div className="space-y-1">
            {primarySystem && (
              <p className="text-xs text-gray-600">
                Primary: <span className="font-semibold text-purple-700">{primarySystem}</span>
              </p>
            )}
            {extracted?.comparisons?.sensory_ranking?.secondary && (
              <p className="text-xs text-gray-600">
                Secondary: <span className="text-gray-500">{extracted.comparisons.sensory_ranking.secondary.charAt(0).toUpperCase() + extracted.comparisons.sensory_ranking.secondary.slice(1).toLowerCase()}</span>
              </p>
            )}
            {extracted?.tests?.A?.page1?.lfs != null && (
              <p className="text-xs text-gray-600">
                LFS Index: <span className="font-semibold">{extracted.tests.A.page1.lfs.toFixed(2)}</span>
              </p>
            )}
            {extracted?.tests?.A?.page8?.postural_index_arrow_value && (
              <p className="text-xs text-gray-600">
                P.I.: <span className="font-semibold">{extracted.tests.A.page8.postural_index_arrow_value}</span>
              </p>
            )}
            {!primarySystem && !extracted?.tests?.A?.page1?.lfs && !extracted?.tests?.A?.page8?.postural_index_arrow_value && (
              <p className="text-xs text-gray-500">Analyzing sensory contributions...</p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Indicators */}
      <div className="mt-4 flex flex-wrap gap-2">
        {rombergTrend === 'concerning' && (
          <span className="text-xs px-2 py-1 bg-orange-100 text-orange-800 rounded-full">
            ⚠️ Visual dependency elevated
          </span>
        )}
        {cottonTrend === 'improvement' && (
          <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full">
            ✓ Stomatognathic influence positive
          </span>
        )}
        {extracted?.tests?.B?.page1?.lfs > 0.3 && (
          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
            ℹ️ Low-frequency sway increased with eyes closed
          </span>
        )}
      </div>
    </div>
  );
}
