'use client';

import { useState, useCallback, useEffect } from 'react';

const FIELD_ALIASES = {
  barcode: 'barcode',
  model: 'model',
  color: 'color',
  capacity: 'capacity',
  voltage: 'voltage',
  lang: 'lang',
  power: 'power',
};

function getTodayLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const PAGE_SIZE = 20;

export default function ReprintTracePanel({ onReprint }) {
  const [datePrefix, setDatePrefix] = useState(getTodayLocal());
  const [keyword, setKeyword] = useState('');
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [reprintingId, setReprintingId] = useState(null);
  
  // 🔑 新增：记录当前选中的记录
  const [selectedItem, setSelectedItem] = useState(null);

  // ===== 1. 查询历史追溯码 =====
  const handleSearch = useCallback(
    async (targetPage = 1, overrideDate) => {
      const date = overrideDate ?? datePrefix;
      if (!date && !keyword.trim()) {
        alert('请至少填写日期或关键词后再搜索');
        return;
      }

      setLoading(true);
      setSearched(true);
      
      // 🔑 搜索时清空之前的选中状态，防止误打旧数据
      setSelectedItem(null);
      onReprint?.([]); 

      try {
        const params = new URLSearchParams();
        if (date) params.set('datePrefix', date.replace(/-/g, ''));
        if (keyword.trim()) params.set('keyword', keyword.trim());
        params.set('page', String(targetPage));
        params.set('pageSize', String(PAGE_SIZE));

        const res = await fetch(`/api/trace/search?${params.toString()}`);
        const result = await res.json();
        if (!result.success) throw new Error(result.message || '查询失败');

        const data = result.data;
        if (Array.isArray(data)) {
          setList(data);
          setTotal(data.length);
        } else {
          setList(data?.list || []);
          setTotal(data?.total || 0);
        }
        setPage(targetPage);
      } catch (err) {
        console.error('❌ 查询历史追溯码失败:', err);
        alert('查询失败: ' + err.message);
        setList([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    [datePrefix, keyword, onReprint]
  );

  // 挂载时自动查当天
  useEffect(() => {
    handleSearch(1, getTodayLocal());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 回车触发搜索
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch(1);
    }
  };

  // ===== 2. 触发加载（选中） =====
  const handleTriggerReprint = (item) => {
    if (!item || !item.code) {
      alert('该记录缺少追溯码，无法补打');
      return;
    }

    if (reprintingId) {
      alert('上一次加载正在处理中，请稍候');
      return;
    }
    setReprintingId(item.id ?? item.code);

    try {
      onReprint?.([item.code]);
      setSelectedItem(item); // 🔑 记录选中项
    } catch (err) {
      console.error('❌ 触发失败:', err);
      alert('加载失败: ' + err.message);
    } finally {
      setTimeout(() => setReprintingId(null), 400);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="w-full bg-white p-4 rounded-lg border border-gray-200">
      <h3 className="font-semibold text-gray-700 mb-3">🔄 补打历史追溯码</h3>
      <p className="text-xs text-gray-400 mb-4">
        在此处搜索并选择此前已经生成的追溯码进行重新打印，补打操作
        <strong>不会消耗或改变</strong>当前的流水号计数器。
      </p>

      {/* 搜索过滤栏 */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">按日期筛选</label>
          <input
            type="date"
            value={datePrefix}
            onChange={(e) => setDatePrefix(e.target.value)}
            className="p-1.5 border border-gray-300 rounded text-xs"
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-gray-500 mb-1">
            关键词搜索（追溯码/型号）
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="输入完整或部分追溯码，回车搜索..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 p-1.5 border border-gray-300 rounded text-xs"
            />
            <button
              onClick={() => handleSearch(1)}
              disabled={loading}
              className="px-4 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? '查询中...' : '搜索'}
            </button>
          </div>
        </div>
      </div>

      {/* 🔑 当前选中状态提示条 */}
      {selectedItem && (
        <div className="mb-3 p-2 bg-blue-50 border border-blue-100 rounded text-xs text-blue-700 flex justify-between items-center">
          <span>
            🎯 当前已加载：<strong className="font-mono">{selectedItem.code}</strong>
          </span>
          <button
            onClick={() => {
              setSelectedItem(null);
              onReprint?.([]); // 通知父组件清空打印数据
            }}
            className="text-blue-500 hover:text-blue-700 underline"
          >
            取消选中
          </button>
        </div>
      )}

      {/* 搜索结果列表 */}
      <div className="border border-gray-200 rounded max-h-[350px] overflow-y-auto text-xs">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 z-10 bg-gray-50 shadow-sm">
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="p-2">追溯码</th>
              <th className="p-2">型号</th>
              <th className="p-2">容量</th>
              <th className="p-2">颜色</th>
              <th className="p-2">操作人</th>
              <th className="p-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center py-8 text-gray-400">
                  {searched && !loading
                    ? '未找到匹配的历史追溯码'
                    : '暂无数据，请先输入条件点击搜索'}
                </td>
              </tr>
            ) : (
              list.map((item) => {
                const isSelected = selectedItem?.code === item.code;
                const isReprinting = reprintingId === (item.id ?? item.code);

                return (
                  <tr
                    key={item.id ?? item.code}
                    className={`border-b border-gray-100 transition-colors ${
                      isSelected ? 'bg-blue-50/60' : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="p-2 font-mono text-blue-600 font-medium">
                      {item.code}
                    </td>
                    <td className="p-2">{item.model || '-'}</td>
                    <td className="p-2">{item.capacity || '-'}</td>
                    <td className="p-2">{item.color || '-'}</td>
                    <td className="p-2 text-gray-400">{item.printedBy || '-'}</td>
                    <td className="p-2 text-right">
                      <button
                        onClick={() => handleTriggerReprint(item)}
                        disabled={isReprinting}
                        className={`px-2.5 py-1 rounded transition-colors ${
                          isSelected
                            ? 'bg-blue-100 text-blue-700 font-medium cursor-default'
                            : 'bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50'
                        }`}
                      >
                        {isReprinting
                          ? '加载中...'
                          : isSelected
                          ? '✅ 已选中'
                          : '加载此码'}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
          <span>
            共 {total} 条，第 {page} / {totalPages} 页
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1 || loading}
              onClick={() => handleSearch(page - 1)}
              className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40"
            >
              上一页
            </button>
            <button
              disabled={page >= totalPages || loading}
              onClick={() => handleSearch(page + 1)}
              className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40"
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  );
}