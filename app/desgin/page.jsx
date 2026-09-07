import { Suspense } from 'react';
import LabelDesignPageContent from './LabelDesignPageContent';

export default function DesginPage() {
  return (
    <Suspense fallback={<div className="p-4 text-center">加载中...</div>}>
      <LabelDesignPageContent />
    </Suspense>
  );
}
