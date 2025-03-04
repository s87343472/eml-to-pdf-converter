"use client";

import Link from "next/link";
import { ConverterForm } from "@/components/converter/ConverterForm";
import { LogViewer } from "@/components/logs/LogViewer";

export default function ConverterPage() {
  return (
    <main className="container mx-auto p-4 md:p-8">
      <div className="mb-6">
        <Link 
          href="/" 
          className="text-primary hover:underline flex items-center"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className="mr-2"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          返回首页 / Back to Home
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">EML到PDF转换器</h1>
        <p className="text-muted-foreground">
          上传EML文件，将它们批量转换为PDF格式。所有处理都在浏览器中完成，不会上传到服务器。
        </p>
      </div>

      {/* 转换表单组件 */}
      <ConverterForm />

      {/* 日志查看器组件 */}
      <div className="mt-6">
        <LogViewer />
      </div>
    </main>
  );
} 