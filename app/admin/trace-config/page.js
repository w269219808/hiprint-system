'use client';

import { useState, useEffect } from 'react';
// 1. 引入我们刚刚写的型号绑定关系管理组件
import RelationsManager from '@/components/admin/RelationsManager';

const CATEGORIES = [
  { key: 'model', name: '型号' },
  { key: 'capacity', name: '容量' },
  { key: 'color', name: '颜色' },
  { key: 'customer', name: '客户' },
  // 🆕 增加第 5 个 Tab：型号绑定规则配置
  { key: 'relations', name: '型号绑定规则' },
];

// 定义每个分类专属的 placeholder 提示
const PLACEHOLDER_MAP = {
  model: '例如: DL3500',
  capacity: '例如: 3500mAh',
  color: '例如: 黑色 或 银色',
  customer: '例如: 华为 或 小米',
};

export default function TraceConfigPage() {
  const [activeTab, setActiveTab] = useState('model');
  const [list, setList] = useState([]);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const fetchList = async () => {
    try {
      const res = await fetch('/api/admin/code-mappings');
      const data = await res.json();
      if (data.success) setList(data.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setMsg({ type: '', text: '' });
    setLoading(true);

    try {
      const res = await fetch('/api/admin/code-mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: activeTab, name, code }),
      });
      const data = await res.json();

      if (data.success) {
        setMsg({ type: 'success', text: '添加成功！' });
        setName('');
        setCode('');
        fetchList();
      } else {
        setMsg({ type: 'error', text: data.message });
      }
    } catch (err) {
      setMsg({ type: 'error', text: '提交失败' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('确定要删除这条配置吗？')) return;
    try {
      const res = await fetch(`/api/admin/code-mappings?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchList();
      } else {
        alert(data.message);
      }
    } catch (e) {
      alert('删除失败');
    }
  };

  // 当前分类的数据列表
  const currentList = list.filter((item) => item.category === activeTab);

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white min-h-screen">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">⚙️ 追溯码映射规则配置后台</h1>

      {/* 5大分类切换标签（包含新增的“型号绑定规则”） */}
      <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
        {CATEGORIES.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`py-2 px-6 font-medium text-sm transition-colors border-b-2 whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.key === 'relations' ? tab.name : `${tab.name}编码配置`}
          </button>
        ))}
      </div>

      {/* 🆕 如果当前点的是“型号绑定规则”，则直接渲染勾选管理组件 */}
      {activeTab === 'relations' ? (
        <RelationsManager />
      ) : (
        <>
          {/* 新增表单 */}
          <form onSubmit={handleAdd} className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6 flex items-end gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                {CATEGORIES.find((c) => c.key === activeTab)?.name}名称
              </label>
              <input
                type="text"
                required
                placeholder={PLACEHOLDER_MAP[activeTab]}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm w-48 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">2 位数字编码</label>
              <input
                type="text"
                required
                maxLength={2}
                placeholder="例如: 01"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm w-32 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '保存中...' : '添加映射'}
            </button>
          </form>

          {/* 提示信息 */}
          {msg.text && (
            <div
              className={`p-3 rounded-md mb-4 text-sm ${
                msg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}
            >
              {msg.text}
            </div>
          )}

          {/* 配置数据表格 */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-100 text-gray-700 uppercase text-xs">
                <tr>
                  <th className="py-3 px-4">名称</th>
                  <th className="py-3 px-4">2位数字编码</th>
                  <th className="py-3 px-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {currentList.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-gray-400">
                      暂无 {CATEGORIES.find((c) => c.key === activeTab)?.name} 配置，请在上方添加
                    </td>
                  </tr>
                ) : (
                  currentList.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium text-gray-900">{item.name}</td>
                      <td className="py-3 px-4">
                        <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded font-mono font-bold">
                          {item.code}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="text-red-600 hover:text-red-800 text-xs font-medium"
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}