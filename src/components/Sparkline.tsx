import React from 'react';
import { Grade } from '../types';
import { parseGrade } from '../utils';

interface SparklineProps {
  grades: Grade[];
  width?: number;
  height?: number;
}

export const Sparkline: React.FC<SparklineProps> = ({ grades, width = 70, height = 22 }) => {
  const numericGrades = grades
    .map(g => parseGrade(g.value))
    .filter((v): v is number => v !== null && !isNaN(v));

  if (numericGrades.length < 2) {
    return <span className="text-[11px] text-slate-500 italic">Dati insuff.</span>;
  }

  const pad = 4;
  const min = Math.min(...numericGrades, 4.5);
  const max = Math.max(...numericGrades, 10);
  const range = max - min || 1;

  const points = numericGrades
    .map((val, idx) => {
      const x = pad + (idx / (numericGrades.length - 1)) * (width - 2 * pad);
      const y = height - pad - ((val - min) / range) * (height - 2 * pad);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const lastVal = numericGrades[numericGrades.length - 1];
  const strokeColor = lastVal >= 6 ? 'var(--success)' : 'var(--danger)';

  return (
    <div className="inline-flex items-center justify-center">
      <svg width={width} height={height} className="overflow-visible">
        <polyline
          fill="none"
          stroke={strokeColor}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
        {/* Draw subtle end dot */}
        {points.split(' ').pop() && (
          <circle
            cx={points.split(' ').pop()?.split(',')[0]}
            cy={points.split(' ').pop()?.split(',')[1]}
            r="3"
            fill={strokeColor}
          />
        )}
      </svg>
    </div>
  );
};
