/**
 * Centralized error handling utilities
 */

import { logger, getErrorMessage, getErrorDetails } from './logger'

export type ErrorResult<T> = 
  | { success: true; data: T }
  | { success: false; error: string; details?: unknown }

/**
 * Safely execute an async function and return a result object
 * Instead of throwing, returns { success: false, error: string }
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
  errorMessage?: string
): Promise<ErrorResult<T>> {
  try {
    const data = await fn()
    return { success: true, data }
  } catch (error) {
    const message = errorMessage || getErrorMessage(error)
    logger.error(message, error)
    return {
      success: false,
      error: message,
      details: getErrorDetails(error),
    }
  }
}

/**
 * Safely execute a sync function and return a result object
 */
export function safeSync<T>(
  fn: () => T,
  errorMessage?: string
): ErrorResult<T> {
  try {
    const data = fn()
    return { success: true, data }
  } catch (error) {
    const message = errorMessage || getErrorMessage(error)
    logger.error(message, error)
    return {
      success: false,
      error: message,
      details: getErrorDetails(error),
    }
  }
}

/**
 * Type guard to check if error is a Supabase error
 */
export function isSupabaseError(error: unknown): error is {
  message: string
  code?: string
  details?: string
  hint?: string
} {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  )
}

/**
 * Extract user-friendly error message from Supabase error
 */
export function getSupabaseErrorMessage(error: unknown): string {
  if (isSupabaseError(error)) {
    // Map common Supabase error codes to user-friendly messages
    const codeMessages: Record<string, string> = {
      '23505': 'This record already exists',
      '23503': 'Cannot delete: this record is referenced by other records',
      '42501': 'Permission denied',
      'PGRST116': 'No rows found',
    }

    if (error.code && codeMessages[error.code]) {
      return codeMessages[error.code]
    }

    return error.message || 'Database error occurred'
  }

  return getErrorMessage(error)
}

/**
 * Handle async operation with toast notification
 * Useful for form submissions and API calls
 */
export async function handleAsyncWithToast<T>(
  fn: () => Promise<T>,
  options: {
    successMessage?: string
    errorMessage?: string
    onSuccess?: (data: T) => void
    onError?: (error: string) => void
  } = {}
): Promise<T | null> {
  const result = await safeAsync(fn, options.errorMessage)

  if (result.success) {
    if (options.successMessage) {
      // Note: toast should be imported where this is used
      // This is a placeholder - actual implementation depends on toast library
      logger.info(options.successMessage)
    }
    options.onSuccess?.(result.data)
    return result.data
  } else {
    const errorMsg = result.error
    logger.error(errorMsg, result.details)
    options.onError?.(errorMsg)
    return null
  }
}

