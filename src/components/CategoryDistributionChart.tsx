import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { BarChart3, ArrowUpRight } from 'lucide-react';
import { BookItem, BookCategory } from '../types.ts';

interface CategoryDistributionChartProps {
  books: BookItem[];
  categories: BookCategory[];
  onSelectCategory?: (categoryName: string) => void;
}

interface ChartRow {
  category: string;
  shortName: string;
  code: string;
  shelfZone: string;
  titlesCount: number;
  availableCopies: number;
  borrowedCopies: number;
  totalCopies: number;
  availabilityRate: number;
}

export const CategoryDistributionChart: React.FC<
  CategoryDistributionChartProps
> = ({ books, categories, onSelectCategory }) => {
  const [chartMode, setChartMode] = useState<'grouped' | 'stacked'>('grouped');

  const chartData = useMemo<ChartRow[]>(() => {
    const categoryNames =
      categories.length > 0
        ? categories.map((c) => ({
            name: c.name,
            code: c.code,
            shelfZone: c.shelfZone,
          }))
        : Array.from(new Set(books.map((b) => b.category))).map((name, idx) => ({
            name,
            code: `CAT-${idx + 1}`,
            shelfZone: 'Main Hall',
          }));

    return categoryNames.map((cat) => {
      const catBooks = books.filter((b) => b.category === cat.name);
      const totalCopies = catBooks.reduce(
        (sum, b) => sum + (b.totalCopies || 0),
        0
      );
      const availableCopies = catBooks.reduce(
        (sum, b) => sum + (b.availableCopies || 0),
        0
      );
      const borrowedCopies = Math.max(0, totalCopies - availableCopies);
      const availabilityRate =
        totalCopies > 0 ? Math.round((availableCopies / totalCopies) * 100) : 100;

      const shortName =
        cat.name.length > 20 ? `${cat.name.slice(0, 18)}…` : cat.name;

      return {
        category: cat.name,
        shortName,
        code: cat.code,
        shelfZone: cat.shelfZone,
        titlesCount: catBooks.length,
        availableCopies,
        borrowedCopies,
        totalCopies,
        availabilityRate,
      };
    });
  }, [books, categories]);

  const totals = useMemo(() => {
    return chartData.reduce(
      (acc, row) => ({
        available: acc.available + row.availableCopies,
        borrowed: acc.borrowed + row.borrowedCopies,
        total: acc.total + row.totalCopies,
      }),
      { available: 0, borrowed: 0, total: 0 }
    );
  }, [chartData]);

  return (
    <section className="rounded-xl bg-white text-[#1E1B18] border border-neutral-200 p-6 shadow-sm space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-200 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-[#641526]" />
            <h3 className="font-display text-lg font-bold text-[#641526]">
              Book Copies Distribution by Category (Available vs. Borrowed)
            </h3>
          </div>
          <p className="text-xs text-neutral-600">
            Interactive comparison of available shelf copies and checked-out copies across BNHS library wings. Click any category bar to inspect its catalog titles.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-4 text-xs pr-2">
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-xs bg-[#641526] inline-block" />
              <span className="text-neutral-600">Available:</span>
              <span className="font-mono font-bold text-[#641526] tabular-nums">
                {totals.available}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-xs bg-[#D4AF37] inline-block" />
              <span className="text-neutral-600">Borrowed:</span>
              <span className="font-mono font-bold text-[#9A7209] tabular-nums">
                {totals.borrowed}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 p-1 bg-neutral-100 rounded-lg">
            <button
              type="button"
              onClick={() => setChartMode('grouped')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                chartMode === 'grouped'
                  ? 'bg-[#641526] text-white shadow-sm'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Side-by-Side
            </button>
            <button
              type="button"
              onClick={() => setChartMode('stacked')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                chartMode === 'stacked'
                  ? 'bg-[#641526] text-white shadow-sm'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Stacked Total
            </button>
          </div>
        </div>
      </div>

      {/* Recharts Interactive Bar Chart */}
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 12, right: 20, left: 0, bottom: 16 }}
            barGap={6}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#E5E5E5"
            />
            <XAxis
              dataKey="shortName"
              tick={{ fill: '#404040', fontSize: 11, fontWeight: 500 }}
              axisLine={{ stroke: '#D4D4D4' }}
              tickLine={false}
              interval={0}
            />
            <YAxis
              tick={{ fill: '#525252', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              label={{
                value: 'Book Copies',
                angle: -90,
                position: 'insideLeft',
                style: { fill: '#737373', fontSize: 11 },
              }}
            />
            <Tooltip
              cursor={{ fill: '#641526', fillOpacity: 0.05 }}
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const row = payload[0].payload as ChartRow;
                return (
                  <div className="rounded-lg bg-[#3A0A14] text-white p-3.5 shadow-xl border border-[#D4AF37]/50 text-xs space-y-2 min-w-[230px]">
                    <div className="border-b border-white/15 pb-1.5">
                      <div className="font-display font-bold text-sm text-white">
                        {row.category}
                      </div>
                      <div className="text-[11px] text-[#D4AF37]">
                        {row.code} · {row.shelfZone} · {row.titlesCount} titles
                      </div>
                    </div>
                    <div className="space-y-1 font-mono tabular-nums">
                      <div className="flex items-center justify-between">
                        <span className="text-white/80">Available Copies:</span>
                        <span className="font-bold text-emerald-400">
                          {row.availableCopies}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-white/80">Borrowed Copies:</span>
                        <span className="font-bold text-[#D4AF37]">
                          {row.borrowedCopies}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-t border-white/15 pt-1">
                        <span className="text-white/80">Total Registered:</span>
                        <span className="font-bold text-white">
                          {row.totalCopies} ({row.availabilityRate}% avail.)
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }}
            />
            <Legend
              verticalAlign="top"
              height={32}
              wrapperStyle={{ fontSize: '12px', fontWeight: 600 }}
            />
            <Bar
              dataKey="availableCopies"
              name="Available Copies"
              stackId={chartMode === 'stacked' ? 'copies' : undefined}
              fill="#641526"
              radius={chartMode === 'stacked' ? [0, 0, 4, 4] : [4, 4, 0, 0]}
              className="cursor-pointer"
              onClick={(data: any) => {
                const cat = data?.category || data?.payload?.category;
                if (onSelectCategory && cat) {
                  onSelectCategory(cat);
                }
              }}
            />
            <Bar
              dataKey="borrowedCopies"
              name="Borrowed Copies"
              stackId={chartMode === 'stacked' ? 'copies' : undefined}
              fill="#D4AF37"
              radius={[4, 4, 0, 0]}
              className="cursor-pointer"
              onClick={(data: any) => {
                const cat = data?.category || data?.payload?.category;
                if (onSelectCategory && cat) {
                  onSelectCategory(cat);
                }
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Quick Category Drill-Down Strip */}
      <div className="pt-2 border-t border-neutral-200 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-neutral-500">
          Filter Book Catalog by Category:
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          {chartData.map((item) => (
            <button
              key={item.category}
              type="button"
              onClick={() => onSelectCategory?.(item.category)}
              className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-800 hover:border-[#641526] hover:text-[#641526] transition-colors whitespace-nowrap shrink-0"
            >
              <span>{item.category}</span>
              <span className="font-mono text-[11px] text-neutral-500 tabular-nums">
                ({item.availableCopies}/{item.totalCopies})
              </span>
              <ArrowUpRight className="h-3 w-3 text-[#641526]" />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};
