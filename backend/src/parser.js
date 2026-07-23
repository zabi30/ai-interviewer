import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

/**
 * Extracts raw text from a PDF resume buffer.
 * @param {Buffer} buffer
 * @returns {Promise<string>}
 */
export async function parsePdfResume(buffer) {
  try {
    const data = await pdfParse(buffer);
    return data.text || '';
  } catch (err) {
    console.error('PDF parsing error:', err);
    throw new Error('Could not parse the PDF resume. Ensure it is a valid PDF document.');
  }
}
