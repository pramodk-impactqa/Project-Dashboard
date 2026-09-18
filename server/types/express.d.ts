import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId: string;
    role: string;
    permissions: string[];
    mfaVerified: boolean;
    mfaPending: boolean;
    createdAt: number;
    lastActivity: number;
    ipAddress: string;
    userAgent: string;
  }
}

declare module 'express' {
  interface Request {
    requestId?: string;
  }
}
