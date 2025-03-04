import { create } from "zustand";

interface ConverterState {
  files: File[];
  logs: string[];
  setFiles: (files: File[]) => void;
  addLog: (message: string) => void;
  clearLogs: () => void;
  removeFile: (file: File) => void;
}

export const useConverterStore = create<ConverterState>((set) => ({
  files: [],
  logs: [],
  setFiles: (files) => set({ files }),
  addLog: (message) =>
    set((state) => ({
      logs: [...state.logs, `${new Date().toLocaleTimeString()} - ${message}`],
    })),
  clearLogs: () => set({ logs: [] }),
  removeFile: (file) =>
    set((state) => ({
      files: state.files.filter(
        (f) =>
          `${f.name}-${f.size}-${f.lastModified}` !==
          `${file.name}-${file.size}-${file.lastModified}`
      ),
    })),
})); 