import { escapeHtml } from '../escapeHtml';

/**
 * Uji fungsi escapeHtml untuk memastikan teks tidak dieksekusi sebagai HTML.
 * Contoh input berbahaya: `<img src=x onerror=alert(1)>`
 */
export function verifyEscapeHtml(): boolean {
  const xssPayload = '<img src=x onerror=alert(1)>';
  const escaped = escapeHtml(xssPayload);
  const isSafe = !escaped.includes('<') && !escaped.includes('>') && escaped.includes('&lt;') && escaped.includes('&gt;');

  const quotePayload = 'Test "Double" and \'Single\' & Ampersand';
  const escapedQuotes = escapeHtml(quotePayload);
  const isQuotesSafe = escapedQuotes.includes('&quot;') && escapedQuotes.includes('&#39;') && escapedQuotes.includes('&amp;');

  const nullSafe = escapeHtml(null) === '' && escapeHtml(undefined) === '';
  const numSafe = escapeHtml(12345) === '12345';

  return isSafe && isQuotesSafe && nullSafe && numSafe;
}
