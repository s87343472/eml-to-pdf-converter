"use client";

import { useConverterStore } from "@/store/converter-store";
import { X } from "lucide-react";

export function FileList() {
  const { files, removeFile } = useConverterStore();

  if (files.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 space-y-2">
      <h3 className="text-sm font-medium">已选择的文件：</h3>
      <div className="space-y-2">
        {files.map((file, index) => (
          <div
            key={`${file.name}-${file.size}-${file.lastModified}`}
            className="flex items-center justify-between rounded-md border p-2 text-sm"
          >
            <div className="flex items-center space-x-2">
              <span className="text-muted-foreground">{index + 1}.</span>
              <span className="truncate">{file.name}</span>
              <span className="text-muted-foreground">
                ({(file.size / 1024).toFixed(1)} KB)
              </span>
            </div>
            <button
              onClick={() => removeFile(file)}
              className="text-muted-foreground hover:text-foreground"
              title="移除文件"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
} 