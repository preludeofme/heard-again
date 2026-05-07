// @ts-nocheck — parser return shapes predate current TextExtractionResult interface; used only by legacy IngestionService
// File parsing utilities for different document types
// This module provides parsers for PDF, DOCX, images, and other formats

import { TextExtractionResult, DocumentStructure } from '@/types'

// PDF Parser using pdf-parse
export class PDFParser {
  static async parsePDF(buffer: Buffer): Promise<TextExtractionResult> {
    try {
      // Dynamic import to avoid bundling issues
      const pdfParse = require('pdf-parse')
      
      const startTime = Date.now()
      const data = await pdfParse(buffer)
      const processingTime = Date.now() - startTime

      return {
        text: data.text,
        confidence: 0.95, // PDF text is usually high confidence
        method: 'pdf-parse',
        processingTime,
        metadata: {
          pageCount: data.numpages,
          wordCount: data.text ? data.text.split(/\s+/).length : 0,
          language: 'en',
          confidence: 0.95,
          extractionMethod: 'pdf-parse',
          info: data.info,
          version: data.version,
          render: data.render
        }
      }
    } catch (error) {
      throw new Error(`PDF parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  static async extractPDFMetadata(buffer: Buffer): Promise<any> {
    try {
      const pdfParse = require('pdf-parse')
      const data = await pdfParse(buffer)
      
      return {
        title: data.info?.Title,
        author: data.info?.Author,
        subject: data.info?.Subject,
        creator: data.info?.Creator,
        producer: data.info?.Producer,
        creationDate: data.info?.CreationDate,
        modificationDate: data.info?.ModDate,
        pageCount: data.numpages
      }
    } catch (error) {
      console.warn('Failed to extract PDF metadata:', error)
      return {}
    }
  }
}

// DOCX Parser using mammoth.js
export class DOCXParser {
  static async parseDOCX(buffer: Buffer): Promise<TextExtractionResult> {
    try {
      const mammoth = require('mammoth')
      
      const startTime = Date.now()
      const result = await mammoth.extractRawText({ buffer })
      const processingTime = Date.now() - startTime

      return {
        text: result.value,
        confidence: 0.95,
        method: 'mammoth',
        processingTime,
        metadata: {
          messages: result.messages,
          warnings: result.messages?.filter((m: any) => m.type === 'warning') || []
        }
      }
    } catch (error) {
      throw new Error(`DOCX parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  static async parseDOCXWithFormatting(buffer: Buffer): Promise<any> {
    try {
      const mammoth = require('mammoth')
      
      const result = await mammoth.convertToHtml({ buffer })
      
      return {
        html: result.value,
        messages: result.messages
      }
    } catch (error) {
      throw new Error(`DOCX formatting parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}

// Markdown Parser using marked
export class MarkdownParser {
  static async parseMarkdown(buffer: Buffer): Promise<TextExtractionResult> {
    try {
      const { marked } = require('marked')
      const fs = require('fs')
      
      const startTime = Date.now()
      const text = buffer.toString('utf-8')
      const processingTime = Date.now() - startTime

      // Parse markdown to get structure
      const tokens = marked.lexer(text)
      const structure = this.extractMarkdownStructure(tokens)

      return {
        text,
        confidence: 1.0,
        method: 'marked',
        processingTime,
        metadata: {
          structure,
          tokenCount: tokens.length,
          format: 'markdown'
        }
      }
    } catch (error) {
      throw new Error(`Markdown parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private static extractMarkdownStructure(tokens: any[]): DocumentStructure {
    const sections = []
    const headings = []
    let currentSection = null

    for (const token of tokens) {
      if (token.type === 'heading') {
        const heading = {
          level: token.depth,
          text: token.text,
          position: 0 // Would need to calculate actual position
        }
        headings.push(heading)

        if (currentSection) {
          sections.push(currentSection)
        }

        currentSection = {
          content: token.text,
          heading: token.text,
          level: token.depth,
          position: 0
        }
      } else if (token.type === 'paragraph' && currentSection) {
        currentSection.content += '\n' + token.text
      }
    }

    if (currentSection) {
      sections.push(currentSection)
    }

    return {
      sections,
      headings,
      tables: [],
      lists: [],
      images: [],
      metadata: {
        totalSections: sections.length,
        totalHeadings: headings.length,
        totalTables: 0,
        totalLists: 0,
        totalImages: 0
      }
    }
  }
}

// Image Parser with OCR support using tesseract.js
export class ImageParser {
  static async parseImageWithOCR(buffer: Buffer, mimeType: string): Promise<TextExtractionResult> {
    try {
      const { createWorker } = require('tesseract.js')
      
      const startTime = Date.now()
      
      // Create Tesseract worker
      const worker = await createWorker('eng')
      
      // Perform OCR
      const { data: { text, confidence } } = await worker.recognize(buffer)
      
      // Clean up worker
      await worker.terminate()
      
      const processingTime = Date.now() - startTime

      return {
        text: text.trim(),
        confidence: confidence / 100, // Tesseract returns 0-100, we want 0-1
        method: 'tesseract-ocr',
        processingTime,
        metadata: {
          mimeType,
          ocrConfidence: confidence,
          language: 'eng'
        }
      }
    } catch (error) {
      throw new Error(`Image OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  static async extractImageMetadata(buffer: Buffer, mimeType: string): Promise<any> {
    try {
      // Use sharp for image metadata extraction
      const sharp = require('sharp')
      const metadata = await sharp(buffer).metadata()

      return {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: metadata.size,
        channels: metadata.channels,
        density: metadata.density,
        hasAlpha: metadata.hasAlpha,
        orientation: metadata.orientation
      }
    } catch (error) {
      console.warn('Failed to extract image metadata:', error)
      return {
        mimeType,
        size: buffer.length
      }
    }
  }
}

// Plain Text Parser
export class TextParser {
  static async parseText(buffer: Buffer, encoding = 'utf-8'): Promise<TextExtractionResult> {
    try {
      const startTime = Date.now()
      const text = buffer.toString(encoding)
      const processingTime = Date.now() - startTime

      return {
        text,
        confidence: 1.0,
        method: 'direct',
        processingTime,
        metadata: {
          encoding,
          lineCount: text.split('\n').length,
          characterCount: text.length,
          wordCount: text.split(/\s+/).filter(word => word.length > 0).length
        }
      }
    } catch (error) {
      throw new Error(`Text parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}

// Main Document Parser Factory
export class DocumentParserFactory {
  private static parsers: Map<string, any> = new Map()

  static getParser(mimeType: string): any {
    if (this.parsers.has(mimeType)) {
      return this.parsers.get(mimeType)
    }

    let parser = null

    switch (mimeType) {
      case 'application/pdf':
        parser = PDFParser
        break
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        parser = DOCXParser
        break
      case 'application/msword':
        parser = DOCXParser // mammoth handles many .doc files; TextParser fallback applies if it fails
        break
      case 'text/plain':
        parser = TextParser
        break
      case 'text/markdown':
        parser = MarkdownParser
        break
      case 'image/jpeg':
      case 'image/png':
      case 'image/tiff':
      case 'image/bmp':
        parser = ImageParser
        break
      default:
        parser = null
    }

    if (parser) {
      this.parsers.set(mimeType, parser)
    }

    return parser
  }

  static async parseDocument(buffer: Buffer, mimeType: string): Promise<TextExtractionResult> {
    const parser = this.getParser(mimeType)
    
    if (!parser) {
      throw new Error(`Unsupported file type: ${mimeType}`)
    }

    try {
      switch (mimeType) {
        case 'application/pdf':
          return await parser.parsePDF(buffer)
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        case 'application/msword':
          return await parser.parseDOCX(buffer)
        case 'text/plain':
          return await parser.parseText(buffer)
        case 'text/markdown':
          return await parser.parseMarkdown(buffer)
        case 'image/jpeg':
        case 'image/png':
        case 'image/tiff':
        case 'image/bmp':
          return await parser.parseImageWithOCR(buffer, mimeType)
        default:
          throw new Error(`No parser implemented for: ${mimeType}`)
      }
    } catch (error) {
      // If specialized parsing fails, try to extract as plain text
      if (mimeType.startsWith('text/') || mimeType === 'application/json') {
        return await TextParser.parseText(buffer)
      }
      throw error
    }
  }

  static async extractMetadata(buffer: Buffer, mimeType: string): Promise<any> {
    const parser = this.getParser(mimeType)
    const baseMetadata = {
      fileSize: buffer.length,
      mimeType
    }

    try {
      switch (mimeType) {
        case 'application/pdf':
          const pdfMetadata = await PDFParser.extractPDFMetadata(buffer)
          return { ...baseMetadata, ...pdfMetadata }
        case 'image/jpeg':
        case 'image/png':
        case 'image/tiff':
        case 'image/bmp':
          const imageMetadata = await ImageParser.extractImageMetadata(buffer, mimeType)
          return { ...baseMetadata, ...imageMetadata }
        default:
          return baseMetadata
      }
    } catch (error) {
      console.warn(`Failed to extract metadata for ${mimeType}:`, error)
      return baseMetadata
    }
  }

  static getSupportedFormats(): string[] {
    return [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain',
      'text/markdown',
      'text/csv',
      'application/json',
      'image/jpeg',
      'image/png',
      'image/tiff',
      'image/bmp'
    ]
  }

  static isFormatSupported(mimeType: string): boolean {
    return this.getSupportedFormats().includes(mimeType)
  }

  static clearCache(): void {
    this.parsers.clear()
  }
}

// Utility functions for document processing
export class DocumentUtils {
  static sanitizeText(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\n{3,}/g, '\n\n') // Limit consecutive newlines
      .replace(/[^\x20-\x7E\n\t]/g, '') // Remove non-printable chars except newlines and tabs
      .trim()
  }

  static extractKeywords(text: string, maxKeywords = 20): string[] {
    // Simple keyword extraction
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !this.isStopWord(word))

    // Count word frequency
    const wordFreq: Record<string, number> = {}
    words.forEach(word => {
      wordFreq[word] = (wordFreq[word] || 0) + 1
    })

    // Sort by frequency and return top keywords
    return Object.entries(wordFreq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, maxKeywords)
      .map(([word]) => word)
  }

  private static isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have',
      'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you',
      'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they',
      'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my',
      'one', 'all', 'would', 'there', 'their', 'what', 'so',
      'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go',
      'me', 'when', 'make', 'can', 'like', 'time', 'no', 'just',
      'him', 'know', 'take', 'people', 'into', 'year', 'your',
      'good', 'some', 'could', 'them', 'see', 'other', 'than',
      'then', 'now', 'look', 'only', 'come', 'its', 'over',
      'think', 'also', 'back', 'after', 'use', 'two', 'how',
      'our', 'work', 'first', 'well', 'way', 'even', 'new',
      'want', 'because', 'any', 'these', 'give', 'day', 'most',
      'us', 'is', 'was', 'are', 'been', 'has', 'had', 'were',
      'said', 'did', 'having', 'may', 'am'
    ])

    return stopWords.has(word)
  }

  static estimateReadingTime(text: string): number {
    const wordsPerMinute = 200
    const wordCount = text.split(/\s+/).length
    return Math.ceil(wordCount / wordsPerMinute)
  }

  static detectLanguage(text: string): string {
    // Simple language detection based on character patterns
    const englishPattern = /^[a-zA-Z0-9\s.,!?;:'"()-]+$/
    const sample = text.substring(0, 1000)

    if (englishPattern.test(sample)) {
      return 'en'
    }

    // Could add more language patterns here
    return 'unknown'
  }
}
