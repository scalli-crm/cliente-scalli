
import React, { useMemo } from 'react';
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { DailyRecord } from '../types';
import { formatCurrency } from '../utils/formatters';

interface ChartsSectionProps {
  data: DailyRecord[];
}

export const ChartsSection: React.FC<ChartsSectionProps> = ({ data }) => {
  
  // Calculate Last 6 Months Data grouped by Month
  const monthlyData = useMemo(() => {
    const today = new Date();
    const last6Months = [];

    // Generate last 6 months keys
    for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        last6Months.push(d);
    }

    return last6Months.map(date => {
        const monthKey = date.toISOString().slice(0, 7); // Format YYYY-MM
        // Portuguese Month Name (e.g., "jan 2025")
        const monthLabel = date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });

        // Filter records belonging to this month
        const recordsInMonth = data.filter(r => r.date.startsWith(monthKey));

        // Aggregate
        const totalRevenue = recordsInMonth.reduce((acc, r) => acc + r.revenue, 0);
        const totalDeals = recordsInMonth.reduce((acc, r) => acc + r.sales, 0);

        return {
            name: monthLabel,
            revenue: totalRevenue,
            deals: totalDeals
        };
    });
  }, [data]);

  return (
    <div className="grid grid-cols-1 gap-6 mb-8">
      
      {/* Closed Deals History (Dual Axis) */}
      <div className="bg-zinc-900 rounded-xl p-6 shadow-lg border border-zinc-800">
        <div className="flex justify-between items-center mb-6 border-b border-zinc-800 pb-4">
            <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="w-1.5 h-6 bg-primary-500 rounded-sm"></span>
                Histórico de Negócios Fechados
                </h3>
                <p className="text-xs text-zinc-500 mt-1 ml-3.5">Comparativo Valor vs. Quantidade (Últimos 6 Meses)</p>
            </div>
        </div>

        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <ComposedChart data={monthlyData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                </linearGradient>
              </defs>
              
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              
              <XAxis 
                dataKey="name" 
                stroke="#71717a" 
                tick={{fill: '#71717a', fontSize: 12}}
                tickLine={false}
                axisLine={{ stroke: '#3f3f46' }}
              />
              
              {/* Left Axis: Revenue */}
              <YAxis 
                yAxisId="left"
                stroke="#0ea5e9" 
                tick={{fill: '#0ea5e9', fontSize: 11, fontWeight: 600}}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => {
                    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                    if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
                    return value;
                }}
              />

              {/* Right Axis: Deals Count */}
              <YAxis 
                yAxisId="right"
                orientation="right"
                stroke="#f97316" 
                tick={{fill: '#f97316', fontSize: 12, fontWeight: 600}}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />

              <Tooltip 
                contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', color: '#fff', borderRadius: '8px' }}
                itemStyle={{ fontSize: '12px' }}
                labelStyle={{ marginBottom: '8px', color: '#a1a1aa' }}
                formatter={(value: any, name: string) => {
                    if (name === 'Valor Fechado') return formatCurrency(value);
                    return value;
                }}
              />
              
              <Legend verticalAlign="top" height={36} iconType="circle" />

              {/* Lines */}
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="revenue" 
                name="Valor Fechado" 
                stroke="#0ea5e9" 
                strokeWidth={3}
                dot={{ r: 4, fill: '#0ea5e9', strokeWidth: 2, stroke: '#000' }}
                activeDot={{ r: 6, fill: '#fff' }}
              />

              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="deals" 
                name="Negócios Fechados" 
                stroke="#f97316" 
                strokeWidth={3}
                dot={{ r: 4, fill: '#f97316', strokeWidth: 2, stroke: '#000' }}
                activeDot={{ r: 6, fill: '#fff' }}
              />

            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
