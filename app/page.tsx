import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-24">
      <div className="max-w-3xl w-full text-center">
        <h1 className="text-4xl font-bold mb-6">EML到PDF批量转换工具</h1>
        <h2 className="text-2xl mb-8">EML to PDF Batch Converter</h2>
        
        <p className="mb-8 text-lg">
          一个简单的网页工具，帮助你将EML邮件文件批量转换为PDF格式，所有处理都在浏览器本地完成，保护你的隐私。
        </p>
        
        <p className="mb-12 text-lg">
          A simple web-based tool that helps you convert EML email files to PDF format in batch, with all processing done locally in the browser to protect your privacy.
        </p>
        
        <Link 
          href="/converter" 
          className="px-6 py-3 bg-primary text-primary-foreground rounded-md text-lg font-medium hover:bg-primary/90 transition-colors"
        >
          开始使用 / Get Started
        </Link>
        
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 border rounded-lg">
            <h3 className="text-xl font-semibold mb-2">批量处理</h3>
            <p>支持一次上传多个EML文件或包含EML文件的文件夹</p>
          </div>
          <div className="p-4 border rounded-lg">
            <h3 className="text-xl font-semibold mb-2">本地处理</h3>
            <p>所有处理都在浏览器中完成，不上传任何数据到服务器</p>
          </div>
          <div className="p-4 border rounded-lg">
            <h3 className="text-xl font-semibold mb-2">高度可配置</h3>
            <p>可自定义批量大小、合并选项等，满足不同需求</p>
          </div>
        </div>
      </div>
    </main>
  );
}
