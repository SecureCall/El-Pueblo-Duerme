

'use client';

// This file should only export NON-HOOK utilities or constants
// to avoid build issues with Next.js App Router.
// Hooks should be imported directly from their source files.

export * from './errors';
export * from './error-emitter';
export * from './non-blocking-login';
export * from './non-blocking-updates';
// The provider and its hooks are NOT exported from here.
// They must be imported from 'app/firebase/provider.tsx'.
