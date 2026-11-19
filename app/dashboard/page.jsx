'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend, ResponsiveContainer,
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#64748b'];

function colorFor(name) {
  const pureName = String(name).replace(/\s*\(\d+\)$/, ''); // 去掉字典里的(01)后缀
  const colorNames = {
    '黑色': '#1f2937', '黑': '#1f2937', 'Black': '#1f2937',
    '白色': '#cbd5e1', '白': '#cbd5e1', 'White': '#cbd5e1',
    '红色': '#ef4444', '红': '#ef4444',
    '蓝色': '#3b82f6', '蓝': '#3b82f6',
    '绿色': '#10b981', '绿': '#10b981',
  };
  return colorNames[pureName] || null;
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
    <div className="bg-white border border-gray-200 rounded px-3 py-2 text-xs shadow z-50">
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
  const items = payload.filter((p) => (p.value || 0) > 0);
  if (!items.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded px-3 py-2 text-xs shadow z-50">
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

function Empty({ text = '暂无数据' }) {
  return <div className="text-center py-10 text-gray-400 text-sm">{text}</div>;
}

// 图表通用容器，统一卡片高度样式
function ChartCard({ title, children }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm flex flex-col h-full">
      <h3 className="text-sm font-bold text-gray-700 mb-4">{title}</h3>
      <div className="flex-1 min-h-[220px]">{children}</div>
    </div>
  );
}

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState('trace'); // 'print' | 'trace'
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [traceData, setTraceData] = useState(null);
  const [traceLoading, setTraceLoading] = useState(true);
  const [traceError, setTraceError] = useState('');

  const today = new Date();
  const [startDate, setStartDate] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState(today.toISOString().slice(0, 10));

  const fetchData = async () => {
    setLoading(true); setError('');
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

  const fetchTrace = async () => {
    setTraceLoading(true); setTraceError('');
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const res = await fetch(`/api/trace/stats?${params}`);
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      setTraceData(result.data);
    } catch (err) {
      setTraceError(err.message);
    } finally {
      setTraceLoading(false);
    }
  };

  const handleQuery = () => {
    if (activeTab === 'print') fetchData();
    else fetchTrace();
  };

  // 首次加载或切换 Tab 时，如果没数据就拉一下
  useEffect(() => {
    if (activeTab === 'print' && !data) fetchData();
    if (activeTab === 'trace' && !traceData) fetchTrace();
  }, [activeTab]);

  return (
    <main className="p-6 max-w-7xl w-full mx-auto font-sans bg-gray-50 min-h-screen">
      {/* 顶栏 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-bold text-gray-800">📊 产品数据看板</h1>
          
          {/* Tab 切换器 */}
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('trace')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                activeTab === 'trace' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              追溯码产量分析
            </button>
            <button
              onClick={() => setActiveTab('print')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                activeTab === 'print' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              产品标签日志分析
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="p-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <span className="text-gray-400">至</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="p-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <button
            onClick={handleQuery}
            className="px-4 py-1.5 bg-blue-600 text-white rounded shadow-sm hover:bg-blue-700 transition-colors"
          >
            查询
          </button>
          <Link href="/" className="text-blue-600 hover:text-blue-800 hover:underline ml-2">
            ← 返回首页
          </Link>
        </div>
      </div>

      {/* ==================== 1. 打印日志 Tab ==================== */}
      {activeTab === 'print' && (
        <div className="animate-in fade-in duration-300">
          {error && <div className="bg-red-50 text-red-700 rounded p-3 mb-4 text-sm border border-red-200">⚠️ {error}</div>}
          {loading && !data && <div className="text-center py-20 text-gray-400">加载中...</div>}

          {data && (
            <>
              {/* 数字概览 */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                <StatCard label="今日打印次数" value={data.todayCount} sub={`打印张数 ${data.todayCopies}`} />
                <StatCard label="本月打印次数" value={data.monthCount} sub={`打印张数 ${data.monthCopies}`} />
                <StatCard label="总打印次数" value={data.totalCount} sub={`总打印张数 ${data.totalCopies}`} />
              </div>

              {/* 趋势图 */}
              <div className="mb-6">
                <ChartCard title="每日打印量趋势">
                  {data.daily.length === 0 ? <Empty /> : (
                    <ResponsiveContainer width="100%" height={240}>
                      <LineChart data={data.daily}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" tickLine={false} />
                        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line type="monotone" dataKey="count" name="打印次数" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                        <Line type="monotone" dataKey="copies" name="打印张数" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </ChartCard>
              </div>

              {/* 分类图 - 第一排 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <ChartCard title="型号排行">
                  {data.modelStats.length === 0 ? <Empty /> : (
                    <ResponsiveContainer width="100%" height={Math.max(200, data.modelStats.length * 35)}>
                      <BarChart data={data.modelStats} layout="vertical" margin={{ left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} tickLine={false} axisLine={false} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f3f4f6' }} />
                        <Bar dataKey="value" name="打印张数" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </ChartCard>

                <ChartCard title="容量分布">
                  {data.capacityStats.length === 0 ? <Empty /> : (
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={data.capacityStats} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50}
                          label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`} labelLine={{ strokeWidth: 1 }}
                        >
                          {data.capacityStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </ChartCard>
              </div>

              {/* 分类图 - 第二排 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ChartCard title="颜色分布">
                  {data.colorStats.length === 0 ? <Empty /> : (
                    <ResponsiveContainer width="100%" height={Math.max(180, data.colorStats.length * 35)}>
                      <BarChart data={data.colorStats} layout="vertical" margin={{ left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={60} tickLine={false} axisLine={false} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f3f4f6' }} />
                        <Bar dataKey="value" name="打印张数" radius={[0, 4, 4, 0]} barSize={20}>
                          {data.colorStats.map((entry, i) => (
                            <Cell key={i} fill={colorFor(entry.name) || COLORS[i % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </ChartCard>

                <ChartCard title="型号 × 颜色（前10型号）">
                  {data.stackedData.length === 0 ? <Empty /> : (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={data.stackedData} layout="vertical" margin={{ left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                        <YAxis type="category" dataKey="model" tick={{ fontSize: 11 }} width={80} tickLine={false} axisLine={false} />
                        <Tooltip content={<StackedTooltip />} cursor={{ fill: '#f3f4f6' }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        {data.stackedColors.map((color, i) => (
                          <Bar key={color} dataKey={color} stackId="a" fill={colorFor(color) || COLORS[i % COLORS.length]} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </ChartCard>
              </div>
            </>
          )}
        </div>
      )}

      {/* ==================== 2. 追溯码 Tab ==================== */}
      {activeTab === 'trace' && (
        <div className="animate-in fade-in duration-300">
          {traceError && <div className="bg-red-50 text-red-700 rounded p-3 mb-4 text-sm border border-red-200">⚠️ {traceError}</div>}
          {traceLoading && !traceData && <div className="text-center py-20 text-gray-400">加载中...</div>}

          {traceData && (
            <>
              {/* 数字概览 */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                <StatCard label="今日追溯码" value={traceData.todayCount} />
                <StatCard label="本月追溯码" value={traceData.monthCount} />
                <StatCard label="区间总数" value={traceData.totalCount} />
              </div>

              {/* 趋势图 */}
              <div className="mb-6">
                <ChartCard title="每日追溯码生成量">
                  {traceData.daily.length === 0 ? <Empty /> : (
                    <ResponsiveContainer width="100%" height={240}>
                      <LineChart data={traceData.daily}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line type="monotone" dataKey="count" name="追溯码数" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </ChartCard>
              </div>

              {/* 分类图 - 第一排 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <ChartCard title="客户排行">
                  {traceData.customerStats.length === 0 ? <Empty /> : (
                    <ResponsiveContainer width="100%" height={Math.max(200, traceData.customerStats.length * 35)}>
                      <BarChart data={traceData.customerStats} layout="vertical" margin={{ left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} tickLine={false} axisLine={false} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f3f4f6' }} />
                        <Bar dataKey="value" name="追溯码数" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </ChartCard>

                <ChartCard title="型号排行">
                  {traceData.modelStats.length === 0 ? <Empty /> : (
                    <ResponsiveContainer width="100%" height={Math.max(200, traceData.modelStats.length * 35)}>
                      <BarChart data={traceData.modelStats} layout="vertical" margin={{ left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} tickLine={false} axisLine={false} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f3f4f6' }} />
                        <Bar dataKey="value" name="追溯码数" fill="#06b6d4" radius={[0, 4, 4, 0]} barSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </ChartCard>
              </div>

              {/* 分类图 - 第二排 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ChartCard title="颜色分布">
                  {traceData.colorStats.length === 0 ? <Empty /> : (
                    <ResponsiveContainer width="100%" height={Math.max(180, traceData.colorStats.length * 35)}>
                      <BarChart data={traceData.colorStats} layout="vertical" margin={{ left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={60} tickLine={false} axisLine={false} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f3f4f6' }} />
                        <Bar dataKey="value" name="追溯码数" radius={[0, 4, 4, 0]} barSize={20}>
                          {traceData.colorStats.map((entry, i) => (
                            <Cell key={i} fill={colorFor(entry.name) || COLORS[i % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </ChartCard>

                <ChartCard title="型号 × 颜色（前10型号）">
                  {traceData.stackedData.length === 0 ? <Empty /> : (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={traceData.stackedData} layout="vertical" margin={{ left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                        <YAxis type="category" dataKey="model" tick={{ fontSize: 11 }} width={100} tickLine={false} axisLine={false} />
                        <Tooltip content={<StackedTooltip />} cursor={{ fill: '#f3f4f6' }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        {traceData.stackedColors.map((color, i) => (
                          <Bar key={color} dataKey={color} stackId="a" fill={colorFor(color) || COLORS[i % COLORS.length]} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </ChartCard>
              </div>
            </>
          )}
        </div>
      )}
    </main>
  );
}