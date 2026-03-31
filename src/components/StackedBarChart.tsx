import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface StackedBarChartProps {
  matrix: number[][];
  categories: string[];
  colors?: string[];
  width?: number | string;
  height?: number | string;
}

export default function StackedBarChart({
  matrix,
  categories,
  colors,
  width = "100%",
  height = 500,
}: StackedBarChartProps) {
  // Calculate T1 and T2 totals for each category
  const data = [
    {
      name: 'T1 (初始)',
      ...Object.fromEntries(categories.map((cat, i) => {
        const row = matrix[i] || [];
        const total = row.reduce((sum, val) => sum + (val || 0), 0);
        return [cat, total];
      }))
    },
    {
      name: 'T2 (末期)',
      ...Object.fromEntries(categories.map((cat, j) => {
        const total = matrix.reduce((sum, row) => sum + (row?.[j] || 0), 0);
        return [cat, total];
      }))
    }
  ];

  const defaultColors = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088fe', '#00c49f'];

  return (
    <div style={{ height, width }} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
          <XAxis 
            dataKey="name" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#6b7280', fontSize: 12, fontWeight: 500 }}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#6b7280', fontSize: 12 }}
            label={{ value: '面积 (ha)', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 10 }}
          />
          <Tooltip 
            cursor={{ fill: '#f9fafb' }}
            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
          />
          <Legend iconType="circle" />
          {categories.map((cat, i) => (
            <Bar 
              key={cat} 
              dataKey={cat} 
              stackId="a" 
              fill={colors?.[i] || defaultColors[i % defaultColors.length]} 
              radius={i === categories.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
