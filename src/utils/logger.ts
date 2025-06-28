import winston, { Logform } from 'winston';
import path from 'path';
import config from '../config/config';

// Define an interface for the log info object to ensure type safety
interface TransformableInfo extends Logform.TransformableInfo {
  stack?: string;
}

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Add colors to winston
winston.addColors(colors);

// Create log format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info: TransformableInfo) => `${info.timestamp} ${info.level}: ${info.message}${
      info.stack ? '\n' + info.stack : ''
    }`
  ),
);

// Define which transports to use based on environment
const transports = [
  // Console transport for all environments
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }),
  
  // File transports for production
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'error.log'),
    level: 'error',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  }),
  
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'combined.log'),
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  })
];

// Create the logger
export const logger = winston.createLogger({
  level: config.NODE_ENV === 'development' ? 'debug' : 'info',
  levels,
  format,
  transports,
  // Don't exit on handled exceptions
  exitOnError: false,
});

// Handle uncaught exceptions and unhandled rejections
logger.exceptions.handle(
  new winston.transports.File({ 
    filename: path.join(process.cwd(), 'logs', 'exceptions.log'),
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  })
);

logger.rejections.handle(
  new winston.transports.File({ 
    filename: path.join(process.cwd(), 'logs', 'rejections.log'),
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  })
);

// Create a stream object for Morgan HTTP logging
export const morganStream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

// Helper functions for structured logging
export const logAssetUpload = (data: {
  assetId: string;
  type: string;
  category?: string;
  fileSize: number;
  uploadedBy: string;
  processingTime: number;
}) => {
  logger.info('Asset uploaded successfully', data);
};

export const logAssetError = (error: Error, context: {
  fileName?: string;
  fileSize?: number;
  uploadedBy?: string;
}) => {
  logger.error('Asset operation failed', {
    error: error.message,
    stack: error.stack,
    ...context
  });
};

export const logUserAction = (action: string, userId: string, details?: any) => {
  logger.info(`User action: ${action}`, {
    userId,
    action,
    ...details
  });
};

export const logSecurityEvent = (event: string, ip: string, details?: any) => {
  logger.warn(`Security event: ${event}`, {
    event,
    ip,
    timestamp: new Date().toISOString(),
    ...details
  });
};

// Export default logger
export default logger;