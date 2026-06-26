import { recognize } from 'tesseract.js'

export async function extractTextFromImage(file: File): Promise<string> {
  const { data } = await recognize(file, 'eng', {
    logger: () => {},
  })
  return data.text.trim()
}

export function cleanOcrText(raw: string): string {
  return raw
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[^a-zA-Z0-9$.,\s]/g, '')
    .trim()
}
