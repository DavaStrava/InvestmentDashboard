// Comprehensive logging system for debugging data flow issues

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

interface LogConfig {
  level: LogLevel;
  enableApiLogging: boolean;
  enableDataValidation: boolean;
  enablePerformance: boolean;
}

const config: LogConfig = {
  level: process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO,
  enableApiLogging: process.env.ENABLE_API_LOGGING === 'true',
  enableDataValidation: process.env.ENABLE_DATA_VALIDATION === 'true',
  enablePerformance: process.env.ENABLE_PERFORMANCE_LOGGING === 'true',
};

class Logger {
  private getTimestamp(): string {
    return new Date().toISOString();
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= config.level;
  }

  private formatMessage(category: string, message: string, data?: any): string {
    const timestamp = this.getTimestamp();
    const dataStr = data ? ` | Data: ${JSON.stringify(data)}` : '';
    return `[${timestamp}] [${category}] ${message}${dataStr}`;
  }

  error(category: string, message: string, error?: any): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatMessage(category, message, error));
    }
  }

  warn(category: string, message: string, data?: any): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage(category, message, data));
    }
  }

  info(category: string, message: string, data?: any): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(this.formatMessage(category, message, data));
    }
  }

  debug(category: string, message: string, data?: any): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(this.formatMessage(category, message, data));
    }
  }

  // Specialized logging methods
  apiRequest(method: string, url: string, params?: any): void {
    if (config.enableApiLogging) {
      this.debug('API_REQUEST', `${method} ${url}`, params);
    }
  }

  apiResponse(url: string, status: number, data?: any): void {
    if (config.enableApiLogging) {
      this.debug('API_RESPONSE', `${url} - ${status}`, data);
    }
  }

  dataValidation(field: string, value: any, isValid: boolean, expected?: string): void {
    if (config.enableDataValidation) {
      const message = `${field} = ${value} | Valid: ${isValid}${expected ? ` | Expected: ${expected}` : ''}`;
      if (isValid) {
        this.debug('DATA_VALID', message);
      } else {
        this.warn('DATA_INVALID', message);
      }
    }
  }

  performance(operation: string, duration: number, details?: any): void {
    if (config.enablePerformance) {
      this.info('PERFORMANCE', `${operation} took ${duration}ms`, details);
    }
  }

  stockQuote(symbol: string, quote: any): void {
    this.debug('STOCK_QUOTE', `${symbol}`, {
      price: quote?.price,
      change: quote?.change,
      changePercent: quote?.changePercent,
      hasData: !!quote
    });
  }

  watchlistData(items: any[]): void {
    this.debug('WATCHLIST_DATA', `${items.length} items`, 
      items.map(item => ({
        symbol: item.symbol,
        currentPrice: item.currentPrice,
        dailyChangePercent: item.dailyChangePercent,
        hasNaN: isNaN(item.dailyChangePercent)
      }))
    );
  }

  marketStatus(isOpen: boolean, time: string): void {
    this.info('MARKET_STATUS', `Markets ${isOpen ? 'OPEN' : 'CLOSED'} at ${time}`);
  }
}

export const logger = new Logger();

// Helper function to validate numeric data and log issues
export function validateNumeric(value: any, fieldName: string, fallback: number = 0): number {
  const parsed = parseFloat(value);
  const isValid = !isNaN(parsed) && isFinite(parsed);
  
  logger.dataValidation(fieldName, value, isValid, 'number');
  
  return isValid ? parsed : fallback;
}

// Helper function to time operations
export function timeOperation<T>(operation: string, fn: () => T): T {
  const start = Date.now();
  const result = fn();
  const duration = Date.now() - start;
  
  logger.performance(operation, duration);
  return result;
}

// Helper for async operations
export async function timeAsyncOperation<T>(operation: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  const result = await fn();
  const duration = Date.now() - start;
  
  logger.performance(operation, duration);
  return result;
}