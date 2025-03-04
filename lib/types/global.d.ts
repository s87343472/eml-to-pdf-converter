// 为没有类型定义的第三方库添加声明

declare module 'jschardet' {
  export function detect(buffer: Uint8Array | Buffer | string): { encoding: string; confidence: number };
}

declare module 'mailparser' {
  export interface AddressObject {
    text: string;
    address: string;
    name?: string;
  }

  export interface Attachment {
    filename?: string;
    contentType: string;
    content: Uint8Array;
    contentId?: string;
    contentDisposition?: string;
    size?: number;
  }

  export interface ParsedMail {
    subject?: string;
    from?: AddressObject;
    to?: AddressObject | AddressObject[];
    cc?: AddressObject | AddressObject[];
    date?: Date;
    text?: string;
    html?: string;
    attachments: Attachment[];
    headers: Map<string, string>;
  }

  export function simpleParser(source: string): Promise<ParsedMail>;
} 