// 为没有类型定义的第三方库添加声明

declare module 'emailjs-mime-parser' {
  export function parse(source: string): any;
}

declare module 'jschardet' {
  export function detect(buffer: Uint8Array | Buffer | string): { encoding: string; confidence: number };
} 