import React from 'react';
import { Calendar, Download } from 'lucide-react';
import { DailyRecord } from '../types';
import { formatDate, formatCurrency } from '../utils/formatters';

interface DataTableProps {
  data: DailyRecord[];
  onEdit: (record: DailyRecord) => void;
  onDelete: (id: string) => void;
  onExport: () => void;
}

export const DataTable: React.FC<DataTableProps> = ({ data, onExport }) => {
  // Sort by date descending
  const sortedData = [...data].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="bg-zinc-900 rounded-xl shadow-lg border border-zinc-800 overflow-hidden">
      <div className="p-6 border-b border-zinc-800 flex flex-col sm:flex-row justify-between items-center gap-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Calendar size={20} className="text-primary-500" />
          Resumo Diário (Automático)
        </h3>
        <button 
          type="button"
          onClick={onExport}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm rounded-lg transition-colors border border-zinc-700"
        >
          <Download size={16} />
          Exportar .XLSX
        </button>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-zinc-400">
          <thead className="bg-zinc-950 text-zinc-200 uppercase text-xs font-semibold">
            <tr>
              <th className="px-6 py-4">Data</th>
              <th className="px-6 py-4">Leads Criados</th>
              <th className="px-6 py-4 hidden lg:table-cell">Agendamentos</th>
              <th className="px-6 py-4 hidden lg:table-cell">Comparecimentos</th>
              <th className="px-6 py-4 text-emerald-500">Vendas (Ganhas)</th>
              <th className="px-6 py-4 text-blue-400 text-right">Faturamento</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {sortedData.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">
                  Nenhum dado encontrado no período.
                </td>
              </tr>
            ) : (
              sortedData.map((record) => (
                <tr key={record.id} className="hover:bg-zinc-800/50 transition-colors group">
                  <td className="px-6 py-4 font-medium text-white whitespace-nowrap">{formatDate(record.date)}</td>
                  <td className="px-6 py-4">{record.leads}</td>
                  <td className="px-6 py-4 hidden lg:table-cell">{record.scheduled}</td>
                  <td className="px-6 py-4 hidden lg:table-cell">{record.attended}</td>
                  <td className="px-6 py-4 font-bold text-emerald-500">{record.sales}</td>
                  <td className="px-6 py-4 text-right font-medium text-blue-400">{formatCurrency(record.revenue)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};