import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { FileItem } from '@/components/file-upload/FileList';

// 日志类型
export type LogType = 'info' | 'warning' | 'error' | 'success';

// 日志条目
export interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
}

// 处理状态
export type ProcessingStatus = 'idle' | 'processing' | 'paused' | 'completed' | 'error';

// 文件类型
export interface FileWithId extends File {
  id: string;
}

// 应用状态
export interface AppState {
  // 文件状态
  files: FileItem[];
  addFiles: (newFiles: File[]) => void;
  updateFileStatus: (id: string, status: FileItem['status'], progress?: number, error?: string) => void;
  removeFile: (id: string) => void;
  clearFiles: () => void;
  
  // 转换状态
  isProcessing: boolean;
  processedCount: number;
  totalCount: number;
  startProcessing: () => void;
  pauseProcessing: () => void;
  stopProcessing: () => void;
  incrementProcessed: () => void;
  resetProcessingStats: () => void;
  
  // 配置选项
  options: ConversionOptions;
  updateOptions: (options: Partial<ConversionOptions>) => void;
  
  // 日志
  logs: LogEntry[];
  addLog: (level: LogEntry['level'], message: string) => void;
  clearLogs: () => void;
}

interface ConversionOptions {
  batchSize: number;
  mergePdf: boolean;
  autoPrint: boolean;
}

// 创建状态存储
export const useAppStore = create<AppState>((set) => ({
  // 文件状态
  files: [],
  addFiles: (newFiles) => set((state) => {
    const fileItems: FileItem[] = newFiles.map(file => ({
      id: uuidv4(),
      file,
      status: 'pending',
    }));
    
    return { 
      files: [...state.files, ...fileItems],
      totalCount: state.totalCount + fileItems.length
    };
  }),
  updateFileStatus: (id, status, progress, error) => set((state) => ({
    files: state.files.map(file => 
      file.id === id 
        ? { ...file, status, progress, error } 
        : file
    )
  })),
  removeFile: (id) => set((state) => ({
    files: state.files.filter(file => file.id !== id),
    totalCount: state.totalCount - (state.files.find(f => f.id === id) ? 1 : 0)
  })),
  clearFiles: () => set({ 
    files: [],
    totalCount: 0,
    processedCount: 0
  }),
  
  // 转换状态
  isProcessing: false,
  processedCount: 0,
  totalCount: 0,
  startProcessing: () => set({ isProcessing: true }),
  pauseProcessing: () => set({ isProcessing: false }),
  stopProcessing: () => set({ 
    isProcessing: false,
    processedCount: 0
  }),
  incrementProcessed: () => set((state) => ({ 
    processedCount: state.processedCount + 1 
  })),
  resetProcessingStats: () => set({ 
    processedCount: 0,
    totalCount: 0
  }),
  
  // 配置选项
  options: {
    batchSize: 50,
    mergePdf: false,
    autoPrint: false
  },
  updateOptions: (newOptions) => set((state) => ({
    options: { ...state.options, ...newOptions }
  })),
  
  // 日志
  logs: [],
  addLog: (level, message) => set((state) => ({
    logs: [
      {
        id: uuidv4(),
        timestamp: new Date(),
        level,
        message
      },
      ...state.logs
    ].slice(0, 100) // 只保留最近的100条日志
  })),
  clearLogs: () => set({ logs: [] })
})); 