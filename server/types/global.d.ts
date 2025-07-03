// Global type definitions for the project

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        clientId?: number;
      };
    }
  }
}

export {};