# EML到PDF批量转换工具 - API设计

本文档定义了EML到PDF批量转换工具的核心模块API接口设计。由于应用是纯客户端的，这里的API主要指内部模块之间的接口，而非HTTP API。

## 1. 文件上传模块 API

### 1.1 FileUploader 组件

```typescript
// 组件接口
interface FileUploaderProps {
  onFilesSelected: (files: File[]) => void;
  maxFileSize?: number; // 单位：字节，默认10MB
  acceptedFileTypes?: string[]; // 默认['.eml']
  multiple?: boolean; // 默认true
  allowFolders?: boolean; // 默认true
  className?: string;
  disabled?: boolean;
}

// 使用示例
<FileUploader 
  onFilesSelected={handleFilesSelected}
  maxFileSize={10 * 1024 * 1024}
  acceptedFileTypes={['.eml']}
  multiple={true}
  allowFolders={true}
/>
```

### 1.2 FileList 组件

```typescript
// 组件接口
interface FileListProps {
  files: File[];
  onRemoveFile: (index: number) => void;
  onClearFiles: () => void;
  className?: string;
}

// 使用示例
<FileList 
  files={files}
  onRemoveFile={handleRemoveFile}
  onClearFiles={handleClearFiles}
/>
```

## 2. EML解析模块 API

### 2.1 EmlParser Worker API

```typescript
// Worker消息类型
type EmlParserMessage = 
  | { type: 'PARSE_EML'; file: File; options?: EmlParserOptions }
  | { type: 'PARSE_EML_RESULT'; result: ParsedEmail | Error }
  | { type: 'PARSE_EML_PROGRESS'; progress: number };

// 解析选项
interface EmlParserOptions {
  maxDepth?: number; // 最大递归深度，默认10
  maxParts?: number; // 最大MIME部分数量，默认100
  detectEncoding?: boolean; // 是否检测编码，默认true
  extractAttachments?: boolean; // 是否提取附件，默认false
}

// 解析结果
interface ParsedEmail {
  messageId?: string;
  subject: string;
  from: string;
  to: string;
  cc?: string;
  bcc?: string;
  date: string;
  body: {
    html?: string;
    text?: string;
  };
  attachments: Attachment[];
  inlineImages: Map<string, string>; // cid -> data URL
  childEmails?: ParsedEmail[]; // 用于转发/回复链
}

interface Attachment {
  filename: string;
  contentType: string;
  content: ArrayBuffer;
  size: number;
}

// 使用示例
// 主线程
const emlParserWorker = new Worker(new URL('./emlParser.worker.ts', import.meta.url));

emlParserWorker.onmessage = (event) => {
  const message = event.data as EmlParserMessage;
  
  if (message.type === 'PARSE_EML_RESULT') {
    if (message.result instanceof Error) {
      console.error('解析失败:', message.result);
    } else {
      console.log('解析成功:', message.result);
    }
  } else if (message.type === 'PARSE_EML_PROGRESS') {
    console.log('解析进度:', message.progress);
  }
};

// 发送解析请求
emlParserWorker.postMessage({
  type: 'PARSE_EML',
  file: emlFile,
  options: {
    maxDepth: 15,
    detectEncoding: true
  }
});
```

### 2.2 EmlParserService API

```typescript
// 服务接口
interface EmlParserService {
  parseEml(file: File, options?: EmlParserOptions): Promise<ParsedEmail>;
  terminateWorker(): void;
}

// 实现示例
class EmlParserServiceImpl implements EmlParserService {
  private worker: Worker;
  
  constructor() {
    this.worker = new Worker(new URL('./emlParser.worker.ts', import.meta.url));
  }
  
  parseEml(file: File, options?: EmlParserOptions): Promise<ParsedEmail> {
    return new Promise((resolve, reject) => {
      const messageHandler = (event: MessageEvent) => {
        const message = event.data as EmlParserMessage;
        
        if (message.type === 'PARSE_EML_RESULT') {
          this.worker.removeEventListener('message', messageHandler);
          
          if (message.result instanceof Error) {
            reject(message.result);
          } else {
            resolve(message.result);
          }
        }
      };
      
      this.worker.addEventListener('message', messageHandler);
      
      this.worker.postMessage({
        type: 'PARSE_EML',
        file,
        options
      });
    });
  }
  
  terminateWorker(): void {
    this.worker.terminate();
  }
}

// 使用示例
const emlParserService = new EmlParserServiceImpl();

try {
  const parsedEmail = await emlParserService.parseEml(emlFile, {
    maxDepth: 15,
    detectEncoding: true
  });
  console.log('解析成功:', parsedEmail);
} catch (error) {
  console.error('解析失败:', error);
} finally {
  emlParserService.terminateWorker();
}
```

## 3. PDF生成模块 API

### 3.1 PdfGenerator Worker API

```typescript
// Worker消息类型
type PdfGeneratorMessage = 
  | { type: 'GENERATE_PDF'; parsedEmail: ParsedEmail; options?: PdfGeneratorOptions }
  | { type: 'GENERATE_PDF_RESULT'; result: PdfGenerationResult | Error }
  | { type: 'GENERATE_PDF_PROGRESS'; progress: number };

// 生成选项
interface PdfGeneratorOptions {
  pageSize?: 'A4' | 'Letter' | 'Legal'; // 默认'A4'
  margin?: number; // 默认20（单位：像素）
  enableFolding?: boolean; // 默认true
  autoPageBreak?: boolean; // 默认true
  includeAttachments?: boolean; // 默认false
  customStyles?: string; // 自定义CSS样式
}

// 生成结果
interface PdfGenerationResult {
  pdfBlob: Blob;
  fileName: string;
}

// 使用示例
// 主线程
const pdfGeneratorWorker = new Worker(new URL('./pdfGenerator.worker.ts', import.meta.url));

pdfGeneratorWorker.onmessage = (event) => {
  const message = event.data as PdfGeneratorMessage;
  
  if (message.type === 'GENERATE_PDF_RESULT') {
    if (message.result instanceof Error) {
      console.error('生成失败:', message.result);
    } else {
      console.log('生成成功:', message.result);
      // 下载PDF
      const url = URL.createObjectURL(message.result.pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = message.result.fileName;
      a.click();
      URL.revokeObjectURL(url);
    }
  } else if (message.type === 'GENERATE_PDF_PROGRESS') {
    console.log('生成进度:', message.progress);
  }
};

// 发送生成请求
pdfGeneratorWorker.postMessage({
  type: 'GENERATE_PDF',
  parsedEmail,
  options: {
    pageSize: 'A4',
    enableFolding: true
  }
});
```

### 3.2 PdfGeneratorService API

```typescript
// 服务接口
interface PdfGeneratorService {
  generatePdf(parsedEmail: ParsedEmail, options?: PdfGeneratorOptions): Promise<PdfGenerationResult>;
  combinePdfs(pdfBlobs: Blob[], fileName: string): Promise<Blob>;
  terminateWorker(): void;
}

// 实现示例
class PdfGeneratorServiceImpl implements PdfGeneratorService {
  private worker: Worker;
  
  constructor() {
    this.worker = new Worker(new URL('./pdfGenerator.worker.ts', import.meta.url));
  }
  
  generatePdf(parsedEmail: ParsedEmail, options?: PdfGeneratorOptions): Promise<PdfGenerationResult> {
    return new Promise((resolve, reject) => {
      const messageHandler = (event: MessageEvent) => {
        const message = event.data as PdfGeneratorMessage;
        
        if (message.type === 'GENERATE_PDF_RESULT') {
          this.worker.removeEventListener('message', messageHandler);
          
          if (message.result instanceof Error) {
            reject(message.result);
          } else {
            resolve(message.result);
          }
        }
      };
      
      this.worker.addEventListener('message', messageHandler);
      
      this.worker.postMessage({
        type: 'GENERATE_PDF',
        parsedEmail,
        options
      });
    });
  }
  
  async combinePdfs(pdfBlobs: Blob[], fileName: string): Promise<Blob> {
    // 使用PDF-Lib合并PDF
    const { PDFDocument } = await import('pdf-lib');
    
    const mergedPdf = await PDFDocument.create();
    
    for (const pdfBlob of pdfBlobs) {
      const pdfBytes = await pdfBlob.arrayBuffer();
      const pdf = await PDFDocument.load(pdfBytes);
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      copiedPages.forEach(page => mergedPdf.addPage(page));
    }
    
    const mergedPdfBytes = await mergedPdf.save();
    return new Blob([mergedPdfBytes], { type: 'application/pdf' });
  }
  
  terminateWorker(): void {
    this.worker.terminate();
  }
}

// 使用示例
const pdfGeneratorService = new PdfGeneratorServiceImpl();

try {
  const result = await pdfGeneratorService.generatePdf(parsedEmail, {
    pageSize: 'A4',
    enableFolding: true
  });
  console.log('生成成功:', result);
  
  // 下载PDF
  const url = URL.createObjectURL(result.pdfBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = result.fileName;
  a.click();
  URL.revokeObjectURL(url);
} catch (error) {
  console.error('生成失败:', error);
} finally {
  pdfGeneratorService.terminateWorker();
}
```

## 4. 批处理模块 API

### 4.1 BatchProcessor API

```typescript
// 批处理选项
interface BatchProcessorOptions {
  batchSize: number; // 每批处理的文件数量，默认5
  concurrency: number; // 并发处理数量，默认2
  onProgress?: (processed: number, total: number) => void;
  onBatchComplete?: (batchResults: BatchItemResult[]) => void;
  onError?: (error: Error, file: File) => void;
  onComplete?: (results: BatchItemResult[]) => void;
}

// 批处理项结果
interface BatchItemResult {
  file: File;
  result?: any;
  error?: Error;
}

// 批处理器接口
interface BatchProcessor<T> {
  process(items: File[], processor: (item: File) => Promise<T>): Promise<BatchItemResult[]>;
  cancel(): void;
}

// 实现示例
class BatchProcessorImpl<T> implements BatchProcessor<T> {
  private options: BatchProcessorOptions;
  private isCancelled: boolean = false;
  
  constructor(options: BatchProcessorOptions) {
    this.options = {
      batchSize: 5,
      concurrency: 2,
      ...options
    };
  }
  
  async process(items: File[], processor: (item: File) => Promise<T>): Promise<BatchItemResult[]> {
    const { batchSize, concurrency, onProgress, onBatchComplete, onError, onComplete } = this.options;
    const results: BatchItemResult[] = [];
    const total = items.length;
    let processed = 0;
    
    this.isCancelled = false;
    
    // 分批处理
    for (let i = 0; i < items.length; i += batchSize) {
      if (this.isCancelled) {
        break;
      }
      
      const batch = items.slice(i, i + batchSize);
      const batchResults: BatchItemResult[] = [];
      
      // 并发处理每批
      await Promise.all(
        Array(Math.min(concurrency, batch.length))
          .fill(0)
          .map(async () => {
            while (batch.length > 0 && !this.isCancelled) {
              const item = batch.shift()!;
              
              try {
                const result = await processor(item);
                batchResults.push({ file: item, result });
              } catch (error) {
                batchResults.push({ file: item, error: error as Error });
                onError?.(error as Error, item);
              }
              
              processed++;
              onProgress?.(processed, total);
            }
          })
      );
      
      results.push(...batchResults);
      onBatchComplete?.(batchResults);
    }
    
    if (!this.isCancelled) {
      onComplete?.(results);
    }
    
    return results;
  }
  
  cancel(): void {
    this.isCancelled = true;
  }
}

// 使用示例
const batchProcessor = new BatchProcessorImpl<PdfGenerationResult>({
  batchSize: 5,
  concurrency: 2,
  onProgress: (processed, total) => {
    console.log(`处理进度: ${processed}/${total}`);
  },
  onBatchComplete: (batchResults) => {
    console.log('批次完成:', batchResults);
  },
  onError: (error, file) => {
    console.error(`处理文件 ${file.name} 失败:`, error);
  },
  onComplete: (results) => {
    console.log('全部处理完成:', results);
  }
});

// 处理文件
const processFile = async (file: File): Promise<PdfGenerationResult> => {
  // 1. 解析EML
  const parsedEmail = await emlParserService.parseEml(file);
  
  // 2. 生成PDF
  return await pdfGeneratorService.generatePdf(parsedEmail);
};

// 开始批处理
const results = await batchProcessor.process(files, processFile);

// 取消处理
// batchProcessor.cancel();
```

## 5. 状态管理 API

### 5.1 AppStore API

```typescript
// 应用状态
interface AppState {
  // 文件状态
  files: File[];
  processedFiles: number;
  totalFiles: number;
  
  // 处理状态
  isProcessing: boolean;
  processingProgress: number;
  
  // 结果状态
  results: {
    file: File;
    pdfBlob?: Blob;
    error?: Error;
  }[];
  
  // 配置选项
  config: {
    batchSize: number;
    concurrency: number;
    enableMerge: boolean;
    autoPrint: boolean;
    pageSize: 'A4' | 'Letter' | 'Legal';
    enableFolding: boolean;
  };
  
  // 日志
  logs: {
    level: 'info' | 'warning' | 'error';
    message: string;
    timestamp: number;
  }[];
  
  // 操作方法
  addFiles: (files: File[]) => void;
  removeFile: (index: number) => void;
  clearFiles: () => void;
  
  startProcessing: () => Promise<void>;
  cancelProcessing: () => void;
  
  updateConfig: (config: Partial<AppState['config']>) => void;
  
  addLog: (level: 'info' | 'warning' | 'error', message: string) => void;
  clearLogs: () => void;
  
  downloadPdf: (index: number) => void;
  downloadAllPdfs: () => void;
  mergePdfs: () => Promise<void>;
}

// 使用示例
import { create } from 'zustand';

const useAppStore = create<AppState>((set, get) => ({
  // 初始状态
  files: [],
  processedFiles: 0,
  totalFiles: 0,
  
  isProcessing: false,
  processingProgress: 0,
  
  results: [],
  
  config: {
    batchSize: 5,
    concurrency: 2,
    enableMerge: false,
    autoPrint: false,
    pageSize: 'A4',
    enableFolding: true
  },
  
  logs: [],
  
  // 操作方法
  addFiles: (files) => {
    set((state) => ({
      files: [...state.files, ...files]
    }));
  },
  
  removeFile: (index) => {
    set((state) => ({
      files: state.files.filter((_, i) => i !== index)
    }));
  },
  
  clearFiles: () => {
    set({
      files: [],
      results: []
    });
  },
  
  startProcessing: async () => {
    const { files, config } = get();
    
    if (files.length === 0 || get().isProcessing) {
      return;
    }
    
    set({
      isProcessing: true,
      processedFiles: 0,
      totalFiles: files.length,
      processingProgress: 0,
      results: []
    });
    
    const batchProcessor = new BatchProcessorImpl<PdfGenerationResult>({
      batchSize: config.batchSize,
      concurrency: config.concurrency,
      onProgress: (processed, total) => {
        set({
          processedFiles: processed,
          processingProgress: (processed / total) * 100
        });
      },
      onError: (error, file) => {
        get().addLog('error', `处理文件 ${file.name} 失败: ${error.message}`);
      }
    });
    
    try {
      const results = await batchProcessor.process(files, async (file) => {
        get().addLog('info', `开始处理文件: ${file.name}`);
        
        // 1. 解析EML
        const parsedEmail = await emlParserService.parseEml(file);
        
        // 2. 生成PDF
        const result = await pdfGeneratorService.generatePdf(parsedEmail, {
          pageSize: config.pageSize,
          enableFolding: config.enableFolding
        });
        
        get().addLog('info', `文件处理完成: ${file.name}`);
        
        return result;
      });
      
      set({
        results: results.map(r => ({
          file: r.file,
          pdfBlob: r.result?.pdfBlob,
          error: r.error
        }))
      });
      
      if (config.enableMerge && results.some(r => r.result)) {
        await get().mergePdfs();
      }
      
      get().addLog('info', '所有文件处理完成');
    } catch (error) {
      get().addLog('error', `处理过程中发生错误: ${(error as Error).message}`);
    } finally {
      set({ isProcessing: false });
    }
  },
  
  cancelProcessing: () => {
    // 实现取消逻辑
  },
  
  updateConfig: (config) => {
    set((state) => ({
      config: { ...state.config, ...config }
    }));
  },
  
  addLog: (level, message) => {
    set((state) => ({
      logs: [
        ...state.logs,
        {
          level,
          message,
          timestamp: Date.now()
        }
      ]
    }));
  },
  
  clearLogs: () => {
    set({ logs: [] });
  },
  
  downloadPdf: (index) => {
    const { results } = get();
    const result = results[index];
    
    if (result?.pdfBlob) {
      const url = URL.createObjectURL(result.pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.file.name.replace(/\.eml$/i, '.pdf');
      a.click();
      URL.revokeObjectURL(url);
    }
  },
  
  downloadAllPdfs: () => {
    const { results } = get();
    
    results.forEach((result, index) => {
      if (result.pdfBlob) {
        setTimeout(() => {
          get().downloadPdf(index);
        }, index * 100);
      }
    });
  },
  
  mergePdfs: async () => {
    const { results } = get();
    const pdfBlobs = results
      .filter(r => r.pdfBlob)
      .map(r => r.pdfBlob!);
    
    if (pdfBlobs.length === 0) {
      return;
    }
    
    try {
      get().addLog('info', '开始合并PDF文件');
      
      const fileName = `merged_${new Date().toISOString().replace(/[:.]/g, '-')}.pdf`;
      const mergedPdfBlob = await pdfGeneratorService.combinePdfs(pdfBlobs, fileName);
      
      const url = URL.createObjectURL(mergedPdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      
      get().addLog('info', 'PDF文件合并完成');
    } catch (error) {
      get().addLog('error', `合并PDF文件失败: ${(error as Error).message}`);
    }
  }
}));
```

## 6. Web Worker 通信 API

### 6.1 使用 Comlink 简化 Worker 通信

```typescript
// worker.ts
import * as Comlink from 'comlink';

class EmlParserWorker {
  async parseEml(file: File, options?: EmlParserOptions): Promise<ParsedEmail> {
    // 实现解析逻辑
    return parsedEmail;
  }
}

Comlink.expose(new EmlParserWorker());

// main.ts
import * as Comlink from 'comlink';

interface EmlParserWorker {
  parseEml(file: File, options?: EmlParserOptions): Promise<ParsedEmail>;
}

const worker = new Worker(new URL('./worker.ts', import.meta.url));
const emlParserWorker = Comlink.wrap<EmlParserWorker>(worker);

// 使用Worker
const parsedEmail = await emlParserWorker.parseEml(file, options);
```

## 7. 错误处理 API

### 7.1 自定义错误类型

```typescript
// 基础错误类
class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppError';
  }
}

// EML解析错误
class EmlParseError extends AppError {
  constructor(message: string, public file?: File, public cause?: Error) {
    super(message);
    this.name = 'EmlParseError';
  }
}

// PDF生成错误
class PdfGenerationError extends AppError {
  constructor(message: string, public parsedEmail?: ParsedEmail, public cause?: Error) {
    super(message);
    this.name = 'PdfGenerationError';
  }
}

// 批处理错误
class BatchProcessingError extends AppError {
  constructor(message: string, public results?: BatchItemResult[]) {
    super(message);
    this.name = 'BatchProcessingError';
  }
}
```

### 7.2 错误处理工具函数

```typescript
// 尝试执行函数，捕获并处理错误
async function tryCatch<T>(
  fn: () => Promise<T>,
  errorHandler: (error: Error) => void
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    errorHandler(error instanceof Error ? error : new Error(String(error)));
    return undefined;
  }
}

// 带重试的异步函数执行
async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    retries: number;
    delay: number;
    onRetry?: (attempt: number, error: Error) => void;
  }
): Promise<T> {
  const { retries, delay, onRetry } = options;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }
      
      onRetry?.(attempt, error instanceof Error ? error : new Error(String(error)));
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error('Unexpected: all retries failed but no error was thrown');
}
``` 