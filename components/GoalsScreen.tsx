
import React, { useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '../utils/formatters';
import { BarChart3, Maximize2, Minimize2 } from 'lucide-react';

interface GoalsScreenProps {
  currentMonthRevenue: number;
  monthlyGoal: number;
  logo: string | null;
  isFullScreen: boolean;
  onToggleFullScreen: () => void;
}

export const GoalsScreen: React.FC<GoalsScreenProps> = ({ 
  currentMonthRevenue, 
  monthlyGoal, 
  logo,
  isFullScreen,
  onToggleFullScreen
}) => {
  // Auto-reload every 15 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      window.location.reload();
    }, 15 * 60 * 1000); // 15 minutes

    return () => clearInterval(interval);
  }, []);

  // Calculate percentage
  // Avoid division by zero
  const percentage = monthlyGoal > 0 
    ? Math.min(100, Math.max(0, (currentMonthRevenue / monthlyGoal) * 100)) 
    : 0;

  const displayPercentage = monthlyGoal > 0 
    ? ((currentMonthRevenue / monthlyGoal) * 100).toFixed(0)
    : '0';

  // Determine Color Scheme based on progress
  let activeColor = '#ef4444'; // Red (0-25%)
  let activeTextColor = 'text-red-500';

  if (percentage >= 100) {
    activeColor = '#10b981'; // Green (100%+)
    activeTextColor = 'text-emerald-500';
  } else if (percentage > 50) {
    activeColor = '#3b82f6'; // Blue (51-99%)
    activeTextColor = 'text-blue-500';
  } else if (percentage > 25) {
    activeColor = '#f97316'; // Orange (26-50%)
    activeTextColor = 'text-orange-500';
  }

  // Data for the Gauge
  // Value is the achieved amount, Remainder is the rest to reach 100% (or 0 if exceeded)
  const data = [
    { name: 'Achieved', value: percentage },
    { name: 'Remaining', value: 100 - percentage }
  ];

  const COLORS = [activeColor, '#27272a']; // Dynamic Color and Zinc-800

  // Get current month name in Uppercase
  const currentMonthName = new Date().toLocaleString('pt-BR', { month: 'long' }).toUpperCase();

  return (
    <div className={`flex flex-col items-center justify-center min-h-[80vh] bg-black text-white p-8 rounded-3xl animate-in fade-in zoom-in duration-500 border border-zinc-900 shadow-2xl relative ${isFullScreen ? 'h-screen w-screen border-none rounded-none' : ''}`}>
      
      {/* Full Screen Toggle Button */}
      <button 
        onClick={onToggleFullScreen}
        className="absolute top-6 right-6 p-3 bg-zinc-800/50 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-full transition-all z-50 backdrop-blur-sm"
        title={isFullScreen ? "Sair da Tela Cheia" : "Tela Cheia"}
      >
        {isFullScreen ? <Minimize2 size={24} /> : <Maximize2 size={24} />}
      </button>

      {/* Top Section: Logo */}
      <div className="mb-4 mt-8">
        {logo ? (
          <div className="p-2">
             <img src={logo} alt="Logo Cliente" className="h-20 w-auto object-contain" />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 p-4 text-zinc-600">
             <BarChart3 size={32} />
          </div>
        )}
      </div>

      {/* Center Section: Gauge Chart */}
      <div 
        className="relative w-80 h-40 mb-4 transition-all duration-700"
        style={{ filter: `drop-shadow(0 0 15px ${activeColor}50)` }} // Neon Glow
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="100%" // Half circle
              startAngle={180}
              endAngle={0}
              innerRadius={100}
              outerRadius={140}
              paddingAngle={0}
              dataKey="value"
              stroke="none"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        
        {/* Centered Text inside the gauge */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-0 pointer-events-none">
          <span className={`text-7xl font-bold leading-none tracking-tighter ${activeTextColor} animate-pulse`}>
            {displayPercentage}%
          </span>
        </div>
      </div>

      <div className="text-center mb-12">
        <h2 className={`font-medium tracking-widest text-sm uppercase mt-4 ${activeTextColor}`}>
          META ATINGIDA
        </h2>
         <p className="text-zinc-500 text-xs mt-2 uppercase opacity-0">
            META: {formatCurrency(monthlyGoal)}
         </p>
      </div>

      {/* Bottom Section: Values */}
      <div className="text-center flex flex-col items-center gap-2">
        <h3 className="text-xl text-zinc-400 font-medium uppercase tracking-widest">
          TOTAL EM VENDAS
        </h3>
        
        <h1 className={`text-7xl md:text-8xl font-bold tracking-tight ${activeTextColor}`}>
          {formatCurrency(currentMonthRevenue)}
        </h1>

        <p className="text-xl text-zinc-500 uppercase tracking-widest font-semibold mt-2">
          MÊS {currentMonthName}
        </p>
      </div>

    </div>
  );
};
