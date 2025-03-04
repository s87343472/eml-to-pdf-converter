import { PDFDocument, PDFPage, PDFFont } from 'pdf-lib';

declare module 'pdf-lib' {
  interface PDFPageDrawImageOptions {
    x: number;
    y: number;
    width: number;
    height: number;
    rotate?: number;
    xSkew?: number;
    ySkew?: number;
    opacity?: number;
    blendMode?: string;
  }
} 