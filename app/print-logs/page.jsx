'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';

const FALLBACK_TYPES = [
  '产品标签 打印',
  '产品标签 预览',
  '充电器标签 打印',
  '充电器标签 预览',
  '客户标签 打印',
  '客户标签 预览',
];

const STATUS_LABELS = {
  SUCCESS: '成功',
  FAILED: '失败',
  PREVIEW: '预览',
};

// 解析 content_summary（可能是 JSON 字符串）
function parseSummary(row) {
  if (!row.contentSummary) return null;
  try {
    const parsed = JSON.parse(row.contentSummary);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function formatTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { hour12: false });
}

function SummaryCell({ row }) {
  const summary = parseSummary(row);
  if (!summary) {
    return (
      <span className="text-gray-600 break-all line-clamp-2">
        {row.contentSummary || '-'}
      </span>
    );
  }

  const fields = [
    summary.copies != null && `数量:${summary.copies}`,
    summary.model && `型号:${summary.model}`,
    summary.capacity && `容量:${summary.capacity}`,
    summary.color && `颜色:${summary.color}`,
    summary.lang && `语言:${summary.lang}`,
    summary.customerCode && `客户:${summary.customerCode}`,
    summary.productCode && `料号:${summary.productCode}`,
    Array.isArray(summary.barcodes) && summary.barcodes.length > 0
      ? `条码:${summary.barcodes.join(',')}`
      : '',
    summary.printerName && `打印机:${summary.printerName}`,
    summary.error && `错误:${summary.error}`,
  ].filter(Boolean);

  return (
    <div className="text-xs text-gray-700 leading-relaxed">
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {fields.map((field) => (
          <span key={field} className="whitespace-nowrap">{field}</span>
        ))}
      </div>
      {Array.isArray(summary.barcodes) && summary.barcodes.length > 6 && (
        <span className="text-gray-400">（共 {summary.barcodes.length} 个条码，仅显示首尾）</span>
      )}
    </div>
  );
}

export default function PrintLogsPage() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [printTypes, setPrintTypes] = useState([]);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [printType, setPrintType] = useState('');
  const [status, setStatus] = useState('');
  const [date, setDate] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const autoRefreshRef = useRef(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (printType) params.set('printType', printType);
      if (status) params.set('status', status);
      if (keyword) params.set('keyword', keyword);
      if (date) params.set('date', date);

      const response = await fetch(`/api/print-log?${params.toString()}`);
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || '查询失败');
      }
      setLogs(result.data || []);
      setTotal(result.total || 0);
      setTotalPages(result.totalPages || 1);
      setPrintTypes((prev) => [...new Set([...prev, ...(result.printTypes || [])])]);
    } catch (err) {
      setError(err.message || '加载失败，请检查数据库连接');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, printType, status, keyword, date]);

  // 筛选/翻页时重新查询
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // 自动刷新（30 秒一次），便于车间实时查看
  useEffect(() => {
    autoRefreshRef.current = setInterval(() => {
      fetchLogs();
    }, 30000);
    return () => clearInterval(autoRefreshRef.current);
  }, [fetchLogs]);

  const handleSearch = () => {
    setPage(1);
    setKeyword(keywordInput.trim());
  };

  const handleFilterChange = (setter) => (value) => {
    setPage(1);
    setter(value);
  };

  const typeOptions = [...new Set([...FALLBACK_TYPES, ...printTypes])];

  return (
    <main className="p-6 max-w-6xl mx-auto font-sans">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-xl font-bold">📋 打印日志</h1>
        <div className="flex items-center gap-3 text-sm">
          <button
            onClick={() => fetchLogs()}
            disabled={loading}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
          >
            {loading ? '⏳ 加载中...' : '🔄 刷新'}
          </button>
          <Link href="/" className="text-blue-600 hover:text-blue-800 underline">
            ← 返回打印控制台
          </Link>
        </div>
      </div>

      {/* 筛选栏 */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4 flex flex-wrap items-end gap-3 text-sm">
        <div>
          <label className="block text-xs text-gray-500 mb-1">标签类型</label>
          <select
            value={printType}
            onChange={(e) => handleFilterChange(setPrintType)(e.target.value)}
            className="p-2 border border-gray-300 rounded-md bg-white min-w-[150px]"
          >
            <option value="">全部类型</option>
            {typeOptions.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">状态</label>
          <select
            value={status}
            onChange={(e) => handleFilterChange(setStatus)(e.target.value)}
            className="p-2 border border-gray-300 rounded-md bg-white"
          >
            <option value="">全部状态</option>
            <option value="SUCCESS">成功</option>
            <option value="FAILED">失败</option>
            <option value="PREVIEW">预览</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">日期</label>
          <input
            type="date"
            value={date}
            onChange={(e) => handleFilterChange(setDate)(e.target.value)}
            className="p-2 border border-gray-300 rounded-md bg-white"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">关键词（内容/IP）</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="如条码、型号、IP"
              className="p-2 border border-gray-300 rounded-md bg-white w-40"
            />
            <button
              onClick={handleSearch}
              className="px-3 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-800 transition-colors"
            >
              搜索
            </button>
          </div>
        </div>
        <div className="ml-auto">
          <label className="block text-xs text-gray-500 mb-1">每页</label>
          <select
            value={pageSize}
            onChange={(e) => {
              setPage(1);
              setPageSize(Number(e.target.value));
            }}
            className="p-2 border border-gray-300 rounded-md bg-white"
          >
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">
          ⚠️ {error}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs text-gray-500 flex items-center justify-between">
          <span>共 <strong>{total}</strong> 条记录</span>
          <span>每 30 秒自动刷新</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-2.5 whitespace-nowrap">打印时间</th>
                <th className="px-4 py-2.5 whitespace-nowrap">类型</th>
                <th className="px-4 py-2.5">内容摘要</th>
                <th className="px-4 py-2.5 whitespace-nowrap">IP 地址</th>
                <th className="px-4 py-2.5 whitespace-nowrap">状态</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                    {loading ? '⏳ 加载中...' : '暂无打印日志'}
                  </td>
                </tr>
              ) : (
                logs.map((row) => (
                  <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                      {formatTime(row.createdAt)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{row.printType}</td>
                    <td className="px-4 py-3 max-w-md">
                      <SummaryCell row={row} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">{row.ipAddress}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          row.status === 'FAILED'
                            ? 'bg-red-100 text-red-700'
                            : row.status === 'PREVIEW'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {STATUS_LABELS[row.status] || row.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between text-sm">
            <span className="text-gray-500">
              第 {page} / {totalPages} 页
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 border border-gray-300 rounded-md disabled:text-gray-300 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                ← 上一页
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 border border-gray-300 rounded-md disabled:text-gray-300 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                下一页 →
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
