'use client';

import { useState, useEffect, useRef } from 'react';
import defaultTemplate from '../../data/templates.json';

export default function DesignerPage() {
  const [tpEntity, setTpEntity] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [jsonText, setJsonText] = useState('');

  const designerRef = useRef(null);
  const optionRef = useRef(null);

  useEffect(() => {
    if (!document.querySelector('link[href*="vue-plugin-hiprint.css"]')) {
      const mainCss = document.createElement('link');
      mainCss.rel = 'stylesheet';
      mainCss.href = 'https://unpkg.com/vue-plugin-hiprint/dist/vue-plugin-hiprint.css';
      document.head.appendChild(mainCss);
    }

    if (!document.querySelector('link[media="print"]')) {
      const printCss = document.createElement('link');
      printCss.rel = 'stylesheet';
      printCss.media = 'print';
      printCss.href = 'https://unpkg.com/vue-plugin-hiprint/dist/print-lock.css';
      document.head.appendChild(printCss);
    }

    import('vue-plugin-hiprint')
      .then((module) => {
        const targetHiprint =
          module.hiprint ||
          module.default?.hiprint ||
          window.hiprint ||
          module.default ||
          module;

        if (module.jQuery) {
          window.jQuery = window.$ = module.jQuery;
        }
        window.hiprint = targetHiprint;

        targetHiprint.init();

        if (designerRef.current) designerRef.current.innerHTML = '';
        if (optionRef.current) optionRef.current.innerHTML = '';

        const customTemplate = new targetHiprint.PrintTemplate({
          template: defaultTemplate,
          settingContainer: '#hiprint-option-factory',
        });

        customTemplate.design('#hiprint-designer', {
          settingElement: '#hiprint-option-factory',
        });

        setTpEntity(customTemplate);
        setJsonText(JSON.stringify(customTemplate.getJson(), null, 2));
        setIsReady(true);
      })
      .catch((err) => console.error('hiprint 加载失败:', err));
  }, []);

  const addElementByJson = (elementType) => {
    if (!tpEntity) return;

    const currentJson = tpEntity.getJson() || {};
    if (!currentJson.panels || currentJson.panels.length === 0) {
      currentJson.panels = [{ printElements: [] }];
    }

    let newElement = {
      options: { left: 20, top: 20, width: 120, height: 20, title: '自定义文本', field: 'custom_text' },
      printElementType: { type: 'text' },
    };

    if (elementType === 'barcode') {
      newElement = {
        options: { left: 20, top: 50, width: 150, height: 50, title: '条形码', field: 'sku', textType: 'code128' },
        printElementType: { type: 'text', textType: 'code128' },
      };
    } else if (elementType === 'qrcode') {
      newElement = {
        options: { left: 20, top: 110, width: 80, height: 80, title: '二维码', field: 'qr_code', textType: 'qrcode' },
        printElementType: { type: 'text', textType: 'qrcode' },
      };
    }

    currentJson.panels[0].printElements = currentJson.panels[0].printElements || [];
    currentJson.panels[0].printElements.push(newElement);

    tpEntity.update(currentJson);
    tpEntity.design('#hiprint-designer', {
      settingElement: '#hiprint-option-factory',
    });

    setJsonText(JSON.stringify(currentJson, null, 2));
  };

  const handleExportJSON = () => {
    if (!tpEntity) return;
    setJsonText(JSON.stringify(tpEntity.getJson(), null, 2));
  };

  const handleCopyJSON = () => {
    if (!jsonText) return;
    navigator.clipboard.writeText(jsonText);
    alert('模板 JSON 已成功复制到剪贴板！');
  };

  return (
    <main style={{ padding: '20px', backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      {/* 强行居中画布及优雅阴影样式 */}
      <style>{`
        #hiprint-designer {
          display: flex !important;
          justify-content: center !important;
          align-items: flex-start !important;
        }
        #hiprint-designer .hiprint-printPaper {
          margin: 20px auto !important;
          background-color: #ffffff !important;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08) !important;
          border-radius: 4px !important;
        }
      `}</style>

      {/* 顶部标题栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: '16px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>全功能标签云设计器</h1>
          <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>
            点击左侧按钮向画布插入元素 | 在右侧设置参数与样式
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleExportJSON}
            disabled={!isReady}
            style={{ padding: '8px 16px', backgroundColor: '#059669', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}
          >
            获取最新 JSON
          </button>
          <button
            onClick={handleCopyJSON}
            disabled={!jsonText}
            style={{ padding: '8px 16px', backgroundColor: '#1f2937', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}
          >
            复制 JSON
          </button>
          <a
            href="/"
            style={{ padding: '8px 16px', backgroundColor: '#f1f5f9', color: '#334155', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', display: 'inline-flex', alignItems: 'center' }}
          >
            ← 返回控制台
          </a>
        </div>
      </div>

      {/* 3 栏独立并行布局 */}
      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', width: '100%' }}>

        {/* 左侧工具栏 */}
        <div style={{ width: '240px', flexShrink: 0, backgroundColor: '#ffffff', border: '1px solid #e2e8f0', padding: '16px', borderRadius: '12px', minHeight: '650px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: '600', color: '#334155', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginTop: 0, marginBottom: '12px' }}>
            添加字段元素
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>点击添加元素至画布：</span>

            <button
              onClick={() => addElementByJson('text')}
              style={{ width: '100%', padding: '10px', fontSize: '13px', backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '8px', cursor: 'pointer', textAlign: 'left', fontWeight: '500' }}
            >
              + 单行文本 / 字段
            </button>

            <button
              onClick={() => addElementByJson('barcode')}
              style={{ width: '100%', padding: '10px', fontSize: '13px', backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '8px', cursor: 'pointer', textAlign: 'left', fontWeight: '500' }}
            >
              + 一维条形码
            </button>

            <button
              onClick={() => addElementByJson('qrcode')}
              style={{ width: '100%', padding: '10px', fontSize: '13px', backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '8px', cursor: 'pointer', textAlign: 'left', fontWeight: '500' }}
            >
              + 二维码
            </button>
          </div>
        </div>

        {/* 中间画布容器 */}
        <div style={{ flex: 1, minWidth: 0, backgroundColor: '#ffffff', border: '1px solid #e2e8f0', padding: '16px', borderRadius: '12px', minHeight: '650px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: '600', color: '#334155', margin: 0 }}>设计画布 (WYSIWYG)</h2>
            <span style={{ fontSize: '12px', color: '#059669', fontWeight: '500' }}>
              {isReady ? '● 设计器已就绪' : '加载中...'}
            </span>
          </div>

          <div
            id="hiprint-designer"
            ref={designerRef}
            style={{ flex: 1, backgroundColor: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '20px', overflow: 'auto' }}
          >
            <span style={{ fontSize: '14px', color: '#94a3b8' }}>正在加载画布...</span>
          </div>
        </div>

        {/* 右侧参数面板 */}
        <div style={{ width: '320px', flexShrink: 0, backgroundColor: '#ffffff', border: '1px solid #e2e8f0', padding: '16px', borderRadius: '12px', minHeight: '650px', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '14px', fontWeight: '600', color: '#334155', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginTop: 0, marginBottom: '12px' }}>
            参数设置面板
          </h2>

          <div
            id="hiprint-option-factory"
            ref={optionRef}
            className="hiprint-option-factory"
            style={{ flex: 1, overflow: 'auto', minHeight: '200px' }}
          >
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>点击画布中的元素即可在此处配置属性。</span>
          </div>

          <div style={{ marginTop: '16px', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
            <label style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>
              JSON 实时结构：
            </label>
            <textarea
              value={jsonText}
              readOnly
              rows={6}
              style={{ width: '100%', padding: '8px', fontFamily: 'monospace', fontSize: '10px', border: '1px solid #e2e8f0', borderRadius: '6px', backgroundColor: '#f8fafc', resize: 'none', boxSizing: 'border-box' }}
            />
          </div>
        </div>

      </div>
    </main>
  );
}