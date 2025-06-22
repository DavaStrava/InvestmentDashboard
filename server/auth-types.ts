/**
 * AUTHENTICATION TYPE DEFINITIONS
 * ===============================
 * 
 * This module defines the complete type system for authentication,
 * extending Express.js types to include Replit OpenID Connect claims
 * and session management structures.
 */

import { Request } from "express";

// OpenID Connect claims structure from Replit
export interface ReplitClaims {
  sub: string;                    // Stable and unique user ID integer
  email?: string | null;          // User email (may be null for some auth methods)
  first_name?: string | null;     // Optional first name from profile
  last_name?: string | null;      // Optional last name from profile
  profile_image_url?: string;     // URL to user's profile picture
  iat: number;                    // Issued at timestamp
  exp: number;                    // Expiration timestamp
}

// Complete authenticated user session structure
export interface AuthenticatedUser {
  claims: ReplitClaims;           // User claims from ID token
  access_token: string;           // OAuth access token
  refresh_token?: string;         // OAuth refresh token for renewal
  expires_at: number;             // Token expiration timestamp
}

// Extend Express Request to include typed user authentication
declare global {
  namespace Express {
    interface User extends AuthenticatedUser {}
  }
}

// Type guard to check if user is properly authenticated
export function isAuthenticatedUser(user: any): user is AuthenticatedUser {
  return user && 
         typeof user === 'object' &&
         user.claims && 
         typeof user.claims.sub === 'string' &&
         typeof user.expires_at === 'number';
}

// Helper to safely extract user ID from authenticated request
export function getUserId(req: Request): string {
  if (!req.user || !isAuthenticatedUser(req.user)) {
    throw new Error("User not authenticated");
  }
  return req.user.claims.sub;
}

// Safe version that returns null for optional cases
export function getUserIdSafe(req: Request): string | null {
  if (!req.user || !isAuthenticatedUser(req.user)) {
    return null;
  }
  return req.user.claims.sub;
}

// Type-safe request interface for authenticated routes
export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}