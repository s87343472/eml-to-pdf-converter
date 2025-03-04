# EML到PDF批量转换工具 | EML to PDF Batch Converter

[English](#english) | [中文](#中文)

## English

A web-based tool that helps you convert EML email files to PDF format in batch, with all processing done locally in the browser to protect your privacy.

### Features

* 🚀 Drag and drop EML files
* 📁 Support for single file or entire folder selection
* 🔄 Batch processing with customizable batch size
* 📄 PDF merging option
* ⚡ Auto-print mode for faster processing
* ⏸️ Pause/Resume functionality
* 📊 Real-time progress display
* 📝 Detailed logging
* 🔒 Runs entirely in browser, protecting privacy
* 🌓 Light/Dark theme support
* 📱 Responsive design for desktop and tablet

### Tech Stack

* Next.js 14+
* React 18+
* TypeScript
* Tailwind CSS
* Shadcn/ui Components
* Zustand (State Management)
* emailjs-mime-parser (EML Parsing)
* PDF-Lib (PDF Generation)
* html2canvas (HTML to Image Conversion)
* Web Workers (Background Processing)

### Development

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start
```

### Privacy Notice

* All conversion happens locally in your browser
* Email content is never uploaded to any server
* Converted PDFs are saved locally

### License

MIT License

---

## 中文

一个基于Web的工具，帮助你将EML邮件文件批量转换为PDF格式，所有处理都在浏览器本地完成，保护你的隐私。

### 功能特点

* 🚀 支持拖拽上传EML文件
* 📁 支持选择单个文件或整个文件夹
* 🔄 支持批量处理，可自定义批次大小
* 📄 支持PDF合并选项
* ⚡ 支持自动打印模式，提高处理效率
* ⏸️ 支持暂停/继续功能
* 📊 实时显示转换进度
* 📝 详细的日志记录
* 🔒 完全在浏览器中运行，保护隐私
* 🌓 支持浅色/深色主题
* 📱 响应式设计，支持桌面和平板设备

### 技术栈

* Next.js 14+
* React 18+
* TypeScript
* Tailwind CSS
* Shadcn/ui 组件库
* Zustand (状态管理)
* emailjs-mime-parser (EML解析)
* PDF-Lib (PDF生成)
* html2canvas (HTML转图像)
* Web Workers (后台处理)

### 开发

```bash
# 安装依赖
pnpm install

# 运行开发服务器
pnpm dev

# 构建生产版本
pnpm build

# 启动生产服务器
pnpm start
```

### 隐私说明

* 所有转换过程都在本地浏览器中完成
* 邮件内容不会被上传到任何服务器
* 转换后的PDF文件保存在本地

### 许可证

MIT License
