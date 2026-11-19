'use client';

import { useState } from 'react';
// 1. 引入追溯码规则配置组件 (把你之前的 TraceConfigPage 稍微抽成组件或者直接在这渲染)
import TraceConfigPage from './trace-config/page'; // 或者对应路径
// 2. 引入用户管理组件 (见下方说明)
import UserManager from '@/components/admin/UserManager';

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState('users'); // 默认停留在用户管理

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* 页头 */}
        <div className="flex items-center justify-between mb-6 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">🛡️ 标签打印系统 · 管理员控制台</h1>
            <p className="text-sm text-gray-500 mt-1">
              管理系统用户账号、分配操作员权限以及配置追溯码映射关系与绑定规则
            </p>
          </div>
          <a
            href="/"
            className="px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-sm font-medium transition-all"
          >
            ← 返回打印控制台
          </a>
        </div>

        {/* 顶层主功能选项卡 (Tab) */}
        <div className="flex border-b border-gray-200 mb-6 bg-white rounded-t-xl px-4 pt-2 shadow-sm">
          <button
            onClick={() => setActiveTab('users')}
            className={`py-3 px-6 font-semibold text-sm transition-all border-b-2 ${
              activeTab === 'users'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            👥 账号与用户管理
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`py-3 px-6 font-semibold text-sm transition-all border-b-2 ${
              activeTab === 'config'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            ⚙️ 追溯码映射与规则配置
          </button>
        </div>

        {/* 选项卡内容区 */}
        <div className="bg-white p-6 rounded-b-xl shadow-sm border border-gray-200">
          {activeTab === 'users' && <UserManager />}
          {activeTab === 'config' && <TraceConfigPage />}
        </div>
      </div>
    </div>
  );
}