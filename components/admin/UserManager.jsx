'use client';

import { useState, useEffect } from 'react';

export default function UserManager() {
  const [users, setUsers] = useState([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('operator');
  const [loading, setLoading] = useState(false);

  // 1. 获取用户列表
  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (data.success) setUsers(data.data);
    } catch (err) {
      console.error('获取用户列表失败');
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // 2. 创建新用户
  const handleCreateUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role }),
      });
      const data = await res.json();
      if (data.success) {
        alert('🎉 用户创建成功！');
        setUsername('');
        setPassword('');
        fetchUsers();
      } else {
        alert(`创建失败: ${data.message}`);
      }
    } catch (err) {
      alert('创建用户发生错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b">
        ➕ 创建新用户/操作员账号
      </h2>

      {/* 新增用户表单 */}
      <form onSubmit={handleCreateUser} className="bg-gray-50 p-4 rounded-lg border mb-6 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">登录账号</label>
          <input
            type="text"
            required
            placeholder="例如: operator1"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm w-44 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">初始密码</label>
          <input
            type="password"
            required
            placeholder="设置密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm w-44 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">账号角色</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm w-36 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="operator">普通操作员</option>
            <option value="admin">系统管理员</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? '创建中...' : '确认创建用户'}
        </button>
      </form>

      {/* 用户列表表格 */}
      <h3 className="text-md font-bold text-gray-700 mb-3">现有用户账号列表</h3>
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-left text-sm text-gray-600">
          <thead className="bg-gray-100 text-gray-700 uppercase text-xs">
            <tr>
              <th className="py-3 px-4">用户名</th>
              <th className="py-3 px-4">角色</th>
              <th className="py-3 px-4">创建时间</th>
              <th className="py-3 px-4 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="py-3 px-4 font-semibold text-gray-900">{u.username}</td>
                <td className="py-3 px-4">
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded text-xs font-bold ${
                      u.role === 'admin'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {u.role === 'admin' ? '系统管理员' : '普通操作员'}
                  </span>
                </td>
                <td className="py-3 px-4 text-xs text-gray-400">
                  {new Date(u.createdAt || Date.now()).toLocaleDateString()}
                </td>
                <td className="py-3 px-4 text-right">
                  {u.username === 'admin' ? (
                    <span className="text-xs text-gray-300 font-medium px-2 py-1 bg-gray-50 rounded cursor-not-allowed">
                      🔒 系统内置
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={async () => {
                        if (confirm(`确定要删除用户 "${u.username}" 吗？`)) {
                          try {
                            const res = await fetch(`/api/admin/users/${u.id}`, {
                              method: 'DELETE',
                            });
                            const result = await res.json();
                            if (result.success) {
                              alert('删除成功！');
                              fetchUsers();
                            } else {
                              alert('删除失败: ' + result.message);
                            }
                          } catch (e) {
                            console.error('删除请求失败', e);
                            alert('网络错误，删除请求失败');
                          }
                        }
                      }}
                      className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 bg-red-50 hover:bg-red-100 rounded transition-colors cursor-pointer"
                    >
                      🗑️ 删除
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}