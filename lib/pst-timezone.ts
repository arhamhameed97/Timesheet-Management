/**
 * PST (Pacific Standard Time) timezone utilities
 * All dates and times throughout the application should use PST
 * PST is UTC-8 (or UTC-7 during PDT - Pacific Daylight Time)
 */

/**
 * Get current date/time in PST
 */
export function getPSTDate(): Date {
  const now = new Date();
  // Convert to PST (UTC-8) or PDT (UTC-7) depending on daylight saving
  const pstOffset = -8 * 60; // PST is UTC-8 (in minutes)
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const pstTime = new Date(utc + (pstOffset * 60000));
  return pstTime;
}

/**
 * Get PST date string in YYYY-MM-DD format
 */
export function getPSTDateString(date?: Date): string {
  const pstDate = date ? convertToPST(date) : getPSTDate();
  const year = pstDate.getFullYear();
  const month = String(pstDate.getMonth() + 1).padStart(2, '0');
  const day = String(pstDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Convert a date to PST
 */
export function convertToPST(date: Date): Date {
  const pstOffset = -8 * 60; // PST is UTC-8 (in minutes)
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  const pstTime = new Date(utc + (pstOffset * 60000));
  return pstTime;
}

/**
 * Parse a date string (YYYY-MM-DD) and create a PST date at start of day
 */
export function parsePSTDate(dateString: string): Date {
  const parts = dateString.split('-');
  const year = parseInt(parts[0]);
  const month = parseInt(parts[1]) - 1; // Month is 0-indexed
  const day = parseInt(parts[2]);
  
  // Create date in PST timezone
  // We'll create it as UTC and then adjust
  const date = new Date(Date.UTC(year, month, day, 8, 0, 0, 0)); // 8 AM UTC = midnight PST
  return date;
}

/**
 * Get start of day in PST
 */
export function getPSTStartOfDay(date?: Date): Date {
  const pstDate = date ? convertToPST(date) : getPSTDate();
  const year = pstDate.getFullYear();
  const month = pstDate.getMonth();
  const day = pstDate.getDate();
  
  // Create date at midnight PST
  return new Date(Date.UTC(year, month, day, 8, 0, 0, 0)); // 8 AM UTC = midnight PST
}

/**
 * Get end of day in PST
 */
export function getPSTEndOfDay(date?: Date): Date {
  const pstDate = date ? convertToPST(date) : getPSTDate();
  const year = pstDate.getFullYear();
  const month = pstDate.getMonth();
  const day = pstDate.getDate();
  
  // Create date at 11:59:59.999 PM PST
  return new Date(Date.UTC(year, month, day, 7, 59, 59, 999)); // 7:59:59 AM next day UTC = 11:59:59 PM PST
}

/**
 * Format date in PST timezone
 */
export function formatPSTDate(date: Date, formatStr: string = 'yyyy-MM-dd'): string {
  const pstDate = convertToPST(date);
  // Simple formatting for common cases
  if (formatStr === 'yyyy-MM-dd') {
    const year = pstDate.getFullYear();
    const month = String(pstDate.getMonth() + 1).padStart(2, '0');
    const day = String(pstDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  // For other formats, use the converted PST date
  return pstDate.toISOString();
}

/**
 * Get current PST time as ISO string
 */
export function getPSTNowISO(): string {
  return getPSTDate().toISOString();
}

