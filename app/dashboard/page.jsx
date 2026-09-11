'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend, ResponsiveContainer,
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#64748b'];

function colorFor(name) {
  const colorNames = {
    '黑色': '#1f2937', '黑': '#1f2937', 'Black': '#1f2937',
    '白色': '#e5e7eb', '白': '#e5e7eb', 'White': '#e5e7eb',
    '红色': '#ef4444', '红': '#ef4444',
    '蓝色': '#3b82f6', '蓝': '#3b82f6',
    '绿色': '#10b981', '绿': '#10b981',
  };
  return colorNames[name] || null;
}

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 shadow-sm">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-2xl font-bold text-gray-800 mt-0.5">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded px-3 py-2 text-xs shadow">
      <div className="font-medium text-gray-700 mb-1">{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }} className="flex justify-between gap-3">
          <span>{p.name || p.dataKey}</span>
          <span className="font-medium">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

function StackedTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  // 只保留 value > 0 的项
  const items = payload.filter((p) => (p.value || 0) > 0);
  if (!items.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded px-3 py-2 text-xs shadow">
      <div className="font-medium text-gray-700 mb-1">{label}</div>
      {items.map((p, i) => (
        <div key={i} style={{ color: p.color }} className="flex justify-between gap-3">
          <span>{p.name || p.dataKey}</span>
          <span className="font-medium">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const today = new Date();
  const [startDate, setStartDate] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState(today.toISOString().slice(0, 10));

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const res = await fetch(`/api/print-log/stats?${params}`);
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      setData(result.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  return (
    <main className="p-6 max-w-7xl w-full mx-auto font-sans">
      {/* 顶栏 */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <h1 className="text-xl font-bold">📊 产品标签打印分析</h1>
        <div className="flex items-center gap-3 text-sm">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="p-1.5 border border-gray-300 rounded text-xs"
          />
          <span className="text-gray-400">至</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="p-1.5 border border-gray-300 rounded text-xs"
          />
          <button
            onClick={fetchData}
            className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            查询
          </button>
          <Link href="/" className="text-blue-600 hover:text-blue-800 underline">
            ← 返回首页
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 mb-4 text-sm">⚠️ {error}</div>
      )}

      {loading && !data && (
        <div className="text-center py-20 text-gray-400">加载中...</div>
      )}

      {data && (
        <>
          {/* 顶部数字卡片 */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
            <StatCard label="今日打印次数" value={data.todayCount} sub={`打印张数 ${data.todayCopies}`} />
            <StatCard label="本月打印次数" value={data.monthCount} sub={`打印张数 ${data.monthCopies}`} />
            <StatCard label="总打印次数" value={data.totalCount} sub={`总打印张数 ${data.totalCopies}`} />
          </div>

          {/* 每日趋势折线图 */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">每日打印量趋势</h2>
            {data.daily.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">暂无数据</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data.daily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="count" name="打印次数" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="copies" name="打印张数" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* 型号 + 容量 并排 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">型号排行</h2>
              {data.modelStats.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">暂无数据</div>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(180, data.modelStats.length * 32)}>
                  <BarChart data={data.modelStats} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name="打印张数" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">容量分布</h2>
              {data.capacityStats.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">暂无数据</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={data.capacityStats}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={{ strokeWidth: 1 }}
                    >
                      {data.capacityStats.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* 颜色分布 + 型号×颜色堆叠 并排 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">颜色分布</h2>
              {data.colorStats.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">暂无数据</div>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(160, data.colorStats.length * 36)}>
                  <BarChart data={data.colorStats} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={60} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name="打印张数" radius={[0, 4, 4, 0]}>
                      {data.colorStats.map((entry, i) => (
                        <Cell key={i} fill={colorFor(entry.name) || COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">型号 × 颜色（前10型号）</h2>
              {data.stackedData.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">暂无数据</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={data.stackedData} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="model" tick={{ fontSize: 11 }} width={80} />
                    <Tooltip content={<StackedTooltip  />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {data.stackedColors.map((color, i) => (
                      <Bar
                        key={color}
                        dataKey={color}
                        stackId="a"
                        fill={colorFor(color) || COLORS[i % COLORS.length]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </>
      )}
    </main>
  );
}
