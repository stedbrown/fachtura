/**
 * Centralized logging utility
 * Replaces console.log/error/warn with environment-aware logging
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: unknown
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development'
  private isProduction = process.env.NODE_ENV === 'production'

  /**
   * Log debug messages (only in development)
   */
  debug(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      console.debug(`[DEBUG] ${message}`, context || '')
    }
  }

  /**
   * Log info messages (only in development)
   */
  info(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      console.info(`[INFO] ${message}`, context || '')
    }
  }

  /**
   * Log warnings (always logged)
   */
  warn(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      console.warn(`[WARN] ${message}`, context || '')
    }
    // In production, could send to monitoring service
  }

  /**
   * Log errors (always logged)
   * In production, should send to error tracking service (Sentry, etc.)
   */
  error(message: string, error?: unknown, context?: LogContext): void {
    const errorDetails = error instanceof Error 
      ? { message: error.message, stack: error.stack, name: error.name }
      : error

    if (this.isDevelopment) {
      console.error(`[ERROR] ${message}`, {
        error: errorDetails,
        ...context,
      })
    } else {
      // In production: send to error tracking service
      // Example: Sentry.captureException(error, { extra: { message, ...context } })
      console.error(`[ERROR] ${message}`, errorDetails)
    }
  }

  /**
   * Log API requests/responses (only in development)
   */
  api(method: string, url: string, status?: number, duration?: number): void {
    if (this.isDevelopment) {
      console.log(`[API] ${method} ${url}`, {
        status,
        duration: duration ? `${duration}ms` : undefined,
      })
    }
  }
}

export const logger = new Logger()

/**
 * Helper to safely extract error message
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message)
  }
  return 'Unknown error occurred'
}

/**
 * Helper to safely extract error details for logging
 */
export function getErrorDetails(error: unknown): {
  message: string
  stack?: string
  name?: string
  code?: string
} {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      name: error.name,
    }
  }
  if (error && typeof error === 'object') {
    return {
      message: 'message' in error ? String(error.message) : 'Unknown error',
      code: 'code' in error ? String(error.code) : undefined,
    }
  }
  return {
    message: String(error),
  }
}

