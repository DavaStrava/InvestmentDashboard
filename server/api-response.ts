import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
    requestId: string;
    duration?: number;
  };
}

// Standardized success response
export function sendSuccess<T>(res: Response, data: T, statusCode: number = 200) {
  const duration = Date.now() - (res.locals.startTime || Date.now());
  
  const response: ApiResponse<T> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || Math.random().toString(36).substring(7),
      duration
    }
  };
  
  logger.apiResponse(res.req.url, statusCode, { duration, dataSize: JSON.stringify(data).length });
  res.status(statusCode).json(response);
}

// Standardized error response
export function sendError(res: Response, error: {
  code: string;
  message: string;
  details?: any;
}, statusCode: number = 500) {
  const duration = Date.now() - (res.locals.startTime || Date.now());
  
  const response: ApiResponse = {
    success: false,
    error,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || Math.random().toString(36).substring(7),
      duration
    }
  };
  
  logger.error('API_ERROR', `${error.code}: ${error.message}`, { 
    url: res.req.url, 
    statusCode, 
    duration,
    details: error.details 
  });
  
  res.status(statusCode).json(response);
}

// Async route wrapper for proper error handling
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    res.locals.startTime = startTime;
    res.locals.requestId = Math.random().toString(36).substring(7);
    
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Error handling middleware
export function handleApiError(error: any, req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) {
    return next(error);
  }

  // Validation errors
  if (error.name === 'ZodError') {
    return sendError(res, {
      code: 'VALIDATION_ERROR',
      message: 'Invalid request data',
      details: error.errors
    }, 400);
  }

  // Database errors
  if (error.code === '23505') {
    return sendError(res, {
      code: 'DUPLICATE_ENTRY',
      message: 'Resource already exists',
      details: error.detail
    }, 409);
  }

  // External API errors
  if (error.isAxiosError) {
    return sendError(res, {
      code: 'EXTERNAL_API_ERROR',
      message: 'External service unavailable',
      details: { status: error.response?.status, url: error.config?.url }
    }, 502);
  }

  // Default internal server error
  sendError(res, {
    code: 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
    details: process.env.NODE_ENV === 'production' ? undefined : error.stack
  }, 500);
}