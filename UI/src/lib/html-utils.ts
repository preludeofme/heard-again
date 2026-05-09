/**
 * Utility functions for handling HTML content, especially for rich text stories.
 */

/**
 * Extracts the first <img> src from an HTML string.
 * Supports both standard URLs and base64 data URLs.
 */
export function extractFirstImage(html: string | null | undefined): string | null {
  if (!html) return null
  
  // Standard regex to find the first <img> tag and its src attribute
  const match = html.match(/<img[^>]+src="([^">]+)"/)
  return match ? match[1] : null
}

/**
 * Strips HTML tags and returns plain text.
 * Useful for generating excerpts or previews from rich text content.
 */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return ''
  
  // Remove script and style elements first
  let text = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
  
  // Strip all other HTML tags
  text = text.replace(/<[^>]*>?/gm, ' ')
  
  // Normalize whitespace
  return text.replace(/\s+/g, ' ').trim()
}

/**
 * Truncates text and adds ellipsis if needed.
 */
export function truncate(text: string, length: number): string {
  if (!text) return ''
  if (text.length <= length) return text
  return text.substring(0, length).trim() + '...'
}

/**
 * Safely generates an excerpt from HTML content.
 */
export function generateExcerpt(html: string | null | undefined, length: number = 160): string {
  return truncate(stripHtml(html), length)
}
