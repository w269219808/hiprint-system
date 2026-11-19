'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import HiprintButton from '@/components/HiprintButton';
import { ProductPanel, ChargerPanel, CustomerPanel,CompanyPanel,TracePanel } from '@/components/labels';
import ReprintTracePanel from '@/components/ReprintTracePanel'; // 确保引入了路径
// 🔑 新增：引入刚才抽离的公共打印函数
import {
  buildPrintDataFromCodes,
  buildTraceTemplate,
  TRACE_PAPER_CONFIG,
} from '@/lib/traceTemplate';


const LABEL_TYPES = [
  { key: 'product', label: '📦 产品标签' },
  { key: 'trace', label: '🏷️ 追溯码标签' }, // <-- 加上这一行
  { key: 'charger', label: '🔌 充电器标签' },
  { key: 'customer', label: '🧾 客户标签' },
  { key: 'company', label: '🏢 公司标签' },
  { key: 'reprint', label: '🔄 补打' },
];

// 写入打印日志时使用的标签类型名称（不带 emoji）
const LABEL_TYPE_NAMES = {
  product: '产品标签',
  trace: '追溯码标签', // <-- 加上这一行
  charger: '充电器标签',
  customer: '客户标签',
  company: '公司标签',
  reprint: '补打追溯码',
};

export default function HomePage() {
  // 获取登录名的状态
  const [currentUser, setCurrentUser] = useState('');
  const [isAdmin, setIsAdmin] = useState(false); // 👈 加一个专门存管理员权限的开关

  useEffect(() => {
        const fetchUserInfo = async () => {
          try {
            const res = await fetch('/api/auth/me');
            const result = await res.json();
            console.log('【API /api/auth/me 返回结果】:', result);
            if (result.success && result.data) {
              const name = result.data.username || result.data.admin || '操作员';
              setCurrentUser(name);
              
              // 💡 核心：在这里加上权限开关的赋值！
              if (result.data.role === 'admin') {
                setIsAdmin(true); 
              }
            }
          } catch (e) {
            console.error('获取用户信息失败', e);
          }
        };
        fetchUserInfo();
      }, []);


  //退出登录的方法
  const handleLogout = async () => {
    try {
      // 1. 调用后端接口清理 HttpOnly Cookie
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error('退出登录请求失败', e);
    } finally {
      // 2. 使用 replace 跳转到登录页，替换当前历史记录
      window.location.replace('/login');
    }
  };

  // 增加防止浏览器后退读取缓存的逻辑
  useEffect(() => {
    const handlePageShow = (event) => {
      // 如果页面是从浏览器后退/前进缓存(Bfcache)中恢复的，强制重新获取用户信息
      if (event.persisted) {
        window.location.reload();
      }
    };

    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, []);

  const [activeType, setActiveType] = useState('product');
  const productPanelRef = useRef(null);
  const customerPanelRef = useRef(null);
  const tracePanelRef = useRef(null);

  // 当前面板的数据
  const [currentPrintData, setCurrentPrintData] = useState([]);
  const [currentTemplate, setCurrentTemplate] = useState({ panels: [] });
  const [paperInfo, setPaperInfo] = useState({ width: 100, height: 60, name: '标准' });


  const isProduct = activeType === 'product';
  const isTrace = activeType === 'trace'; // <--- 加上这一行！
  const isCharger = activeType === 'charger';
  const isCustomer = activeType === 'customer';
  const isCompany = activeType === 'company';
  const isReprint = activeType === 'reprint';

  const handleTypeChange = (nextType) => {
    if (nextType === activeType) return;

    // 不同标签页的数据结构不同，切换时必须清掉上一页的模板和打印数据，
    // 避免补打列表尚未选择记录时误打上一页的产品标签。
    setActiveType(nextType);
    setCurrentPrintData([]);
    setCurrentTemplate({ panels: [] });
    setPaperInfo({ width: 0, height: 0, name: '加载中' });
  };

  // 处理子组件数据变化
  const handleDataChange = (data) => {
    setCurrentPrintData(data.printData || []);
    setCurrentTemplate(data.template || { panels: [] });
    setPaperInfo({
      width: data.paperSize?.width || 100,
      height: data.paperSize?.height || 60,
      name: data.templateName || '标准',
    });
  };

  const handleBeforePrint = async (isRealPrint = false) => {

        // 🔑 终极拦截：只要是补打，不管真实打印还是预览，直接返回我们排版好的补打数据！绝不走后端！
    if (activeType === 'reprint') {
      console.log('🔄 补打拦截：直接使用现成的模板和条码，不申请新码，不自增！');
      if (!currentPrintData || currentPrintData.length === 0) {
        alert('请先在列表中点击“打印此码”选择要补打的记录！');
        return null;
      }
      return {
        printData: currentPrintData,
        template: currentTemplate,
      };
    }

    try {
      // 🛑 1. 如果当前是预览模式（isRealPrint 为 false），绝对不调用后端接口，直接返回现有的本地数据！
      if (!isRealPrint) {
        console.log('👁️ 当前为预览模式，跳过后端原子自增，使用本地预览数据');
        return {
          printData: currentPrintData,
          template: currentTemplate,
        };
      }

      // 🚀 2. 追溯码标签打印逻辑
      if (activeType === 'trace') {
        if (!tracePanelRef.current?.allocateBarcodes) {
          console.warn('⚠️ tracePanelRef 未挂载，使用当前默认数据打印');
          return { printData: currentPrintData, template: currentTemplate };
        }

        try {
          const bundle = await tracePanelRef.current.allocateBarcodes();
          if (bundle && bundle.printData) {
            setCurrentPrintData(bundle.printData);
            setCurrentTemplate(bundle.template || { panels: [] });
            return bundle;
          }
        } catch (e) {
          console.warn('⚠️ 追溯码面板自增失败，降级使用当前数据:', e);
        }
        
        // 🟢 绝对保底：如果上面任何地方空了，直接返回当前数据，绝不报错中断！
        return { printData: currentPrintData, template: currentTemplate };
      }

      // 🟢 如果当前是“补打追溯码”类型，直接使用面板传过来的原码打印
      if (activeType === 'reprint') {
        console.log('🔄 执行补打追溯码，直接使用原码打印，不自增');
        if (!currentPrintData || currentPrintData.length === 0) {
          alert('请先在下方列表中点击“打印此码”选择要补打的记录！');
          return null;
        }
        return {
          printData: currentPrintData,
          template: currentTemplate,
        };
      }

      // 3. 原有的产品标签逻辑
      if (activeType === 'product' && productPanelRef.current?.allocateBarcodes) {
        const bundle = await productPanelRef.current.allocateBarcodes();
        console.log('🖨️ 最终传给 hiprint 的 printData:', bundle.printData);
        if (bundle?.printData) {
          setCurrentPrintData(bundle.printData);
          setCurrentTemplate(bundle.template || { panels: [] });
          return bundle;
        }
      }

      // 4. 原有的客户标签逻辑
      if (activeType === 'customer' && customerPanelRef.current?.allocateSequences) {
        const bundle = await customerPanelRef.current.allocateSequences();
        if (bundle?.printData) {
          setCurrentPrintData(bundle.printData);
          setCurrentTemplate(bundle.template || { panels: [] });
          return bundle;
        }
      }
    } catch (err) {
      console.error('❌ 打印前置拦截执行异常:', err);
      alert('生成追溯码异常: ' + err.message);
      return null;
    }

    // 保底：如果以上都没有拦截到，返回当前现有的
    return { printData: currentPrintData, template: currentTemplate };
  };



  return (
    <main className="p-4 sm:p-6 md:p-8 w-full max-w-[900px] min-w-0 mx-auto font-sans">
      <h1 className="text-2xl font-bold mb-6 text-center">
        🏷️ 蓝铭电子标签打印控制台
      </h1>

      {/* 顶部精美用户信息栏 */}
      <div className="flex justify-between items-center mb-6">
        {/* 左侧可留空或放面包屑，这里把用户信息收拢到右侧 */}
        <div className="text-xs text-gray-400 font-medium">
          控制台 &gt; 标签打印
        </div>

        {/* 右侧胶囊卡片 */}
        {/* 右侧胶囊卡片 */}
        <div className="inline-flex items-center gap-3 px-3 py-1.5 bg-white border border-gray-200 rounded-full shadow-sm hover:shadow transition-all">
          <div className="flex items-center gap-2">
            {/* 渐变头像 */}
            <span className="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 text-white flex items-center justify-center text-xs font-bold shadow-inner">
              {(currentUser || '管').slice(0, 1)}
            </span>
            <span className="text-xs text-gray-600 font-medium">
              {currentUser || '加载中...'}
            </span>
          </div>

          {/* 分隔竖线 */}
          <span className="w-px h-3 bg-gray-200"></span>

          {/* 🔒 只要 isAdmin 为 true，就显示系统管理按钮 */}
          {isAdmin && (
            <>
              <a
                href="/admin"
                className="text-xs text-blue-600 hover:text-blue-800 font-bold transition-colors flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded"
                title="管理员控制台"
              >
                ⚙️
              </a>
              <span className="w-px h-3 bg-gray-200"></span>
            </>
          )}
          {/* 退出登录按钮 */}
          <button
            onClick={handleLogout}
            className="text-xs text-gray-400 hover:text-red-500 font-medium transition-colors cursor-pointer flex items-center gap-1"
            title="退出登录"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            退出
          </button>
        </div>
      </div>

      {/* 标签类型选择与核心内容区共用一个大卡片，彻底消除割裂感 */}
      <div className="border border-gray-200 rounded-2xl bg-white shadow-sm overflow-hidden">
        {/* 1. 顶部门票/Tab 栏（已修复垂直居中与蓝条贴合问题） */}
        <div className="flex items-center gap-2 px-6 bg-gray-50/80 border-b border-gray-200 overflow-x-auto no-scrollbar">
          {LABEL_TYPES.map((type) => {
            const isActive = activeType === type.key;
            return (
              <button
                key={type.key}
                onClick={() => handleTypeChange(type.key)}
                className={`relative h-14 px-4 text-[15px] whitespace-nowrap transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 font-medium ${
                  isActive
                    ? 'bg-blue-50 text-blue-600 font-semibold shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <span>{type.label}</span>

                {/* 底部蓝色高亮指示条：精确贴在导航栏的最底边 */}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-blue-600 rounded-t-full shadow-sm" />
                )}
              </button>
            );
          })}
        </div>

        {/* 2. 内部表单面板区域 */}
        <div className="p-6 space-y-5">
          {/* 产品面板 */}
          {isProduct && <ProductPanel ref={productPanelRef} onDataChange={handleDataChange} />}

          {/* 追溯码面板 */}
          {isTrace && <TracePanel ref={tracePanelRef} onDataChange={handleDataChange} />}

          {/* 充电器面板 */}
          {isCharger && <ChargerPanel onDataChange={handleDataChange} />}

          {/* 客户标签 */}
          {isCustomer && (
            <CustomerPanel ref={customerPanelRef} onDataChange={handleDataChange} />
          )}

          {/* 公司标签 */}
          {isCompany && (
            <CompanyPanel onDataChange={handleDataChange} />
          )}

          {/* 🔄 补打追溯码面板  */}
          {isReprint && (
            <ReprintTracePanel
              onReprint={(codes) => {
                console.log('🟢 补打收到 codes =', codes);
                const printDataList = buildPrintDataFromCodes(codes, 1);
                const tpl = buildTraceTemplate(printDataList);
                console.log('🟢 排版后 printDataList =', printDataList, '模板 panels =', tpl.panels?.length);

                setCurrentPrintData(printDataList);
                setCurrentTemplate(tpl);
                setPaperInfo({ ...TRACE_PAPER_CONFIG });
              }}
            />
          )}

          {/* 打印控制 */}
          <div className="flex items-center gap-4 text-sm border-t border-gray-100 pt-4 flex-wrap">
            <span className="font-semibold text-gray-700">🖨️ 打印</span>
            <span className="text-gray-400 text-xs">
              生成 {currentPrintData.length} 个标签
            </span>
            <span className="text-gray-200">|</span>
            <span className="text-gray-500">
              📐 {paperInfo.width}×{paperInfo.height}mm
            </span>
            <span className="text-xs text-gray-400">
              ({paperInfo.name})
            </span>
          </div>

          {/* 打印按钮 */}
          <div className="flex items-center gap-3 border-t border-gray-100 pt-4">
            <span className="font-semibold text-gray-700 text-sm">🖨️</span>
            <HiprintButton
              templateData={currentTemplate}
              printData={currentPrintData}
              buttonText="🖨️ 直接打印"
              silent={true}
              onBeforePrint={handleBeforePrint}
              labelType={LABEL_TYPE_NAMES[activeType] || '标签'}
              defaultPDFMode={!(isTrace || isReprint)}
              disabled={currentPrintData.length === 0 || currentTemplate.panels.length === 0}
            />
          </div>
        </div>

      </div>

      {/* 底部信息 */}
      <div className="mt-4 text-xs text-gray-400 pt-3">
        当前标签类型: <strong>{activeType}</strong> ｜
        模板: <strong>{paperInfo.name}</strong> ｜
        纸张: <strong>{paperInfo.width}×{paperInfo.height}mm</strong> ｜
        打印张数: <strong>{currentPrintData.length}</strong>
      </div>
      <div className="flex items-center justify-between my-4">
        <Link
          href="/desgin"
          className="hidden sm:inline text-sm text-gray-600 hover:text-blue-800 underline"
        >
          🖋️ 设计器
        </Link>

        {/* 手机上显示：指向 /templates */}
        <Link
          href="/templates"
          className="sm:hidden text-sm text-gray-600 hover:text-blue-800 underline"
        >
          📋 模板
        </Link>
        <Link
          href="/dashboard"
          className="text-sm text-gray-600 hover:text-blue-800 underline"
        >
          📊 可视化数据
        </Link>
        <Link
          href="/print-logs"
          className="text-sm text-gray-600 hover:text-blue-800 underline"
        >
          📋 查看打印日志
        </Link>
      </div>

    </main>
  );
}
