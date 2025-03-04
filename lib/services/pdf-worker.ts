import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { join } from 'path';
import { PdfGenerator } from '../utils/pdf-generator';
import type { ParsedMail } from 'mailparser';

if (!isMainThread) {
  // Worker线程代码
  const generatePdf = async (parsedMail: ParsedMail) => {
    try {
      const generator = new PdfGenerator({
        fontSize: 11,
        margin: 50,
        lineHeight: 1.5,
        maxLineLength: 100,
      });

      const pdfBytes = await generator.generateFromParsedMail(parsedMail);
      parentPort?.postMessage({ success: true, data: pdfBytes });
    } catch (error) {
      parentPort?.postMessage({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  };

  // 接收主线程消息
  parentPort?.on('message', async (parsedMail: ParsedMail) => {
    await generatePdf(parsedMail);
  });
}

export class PdfWorkerService {
  private worker: Worker | null = null;

  async initialize() {
    if (this.worker) {
      this.worker.terminate();
    }

    this.worker = new Worker(__filename);
  }

  async generatePdf(parsedMail: ParsedMail): Promise<Uint8Array> {
    if (!this.worker) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      this.worker?.on('message', (result) => {
        if (result.success) {
          resolve(result.data);
        } else {
          reject(new Error(result.error));
        }
      });

      this.worker?.on('error', reject);
      this.worker?.postMessage(parsedMail);
    });
  }

  async cleanup() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
} 