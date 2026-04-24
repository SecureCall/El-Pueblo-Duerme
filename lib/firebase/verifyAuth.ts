/**
 * verifyAuth.ts
 * Utility para verificar Firebase ID tokens en API routes de Next.js.
 * Usa el Admin SDK para garantizar que el token es válido y no modificado.
 */
import { getAuth } from 'firebase-admin/auth';
import { initAdminApp } from './admin';
import { NextRequest } from 'next/server';

/**
 * Extrae y verifica el Firebase ID token del header Authorization.
 * Devuelve el uid del usuario autenticado, o null si el token es inválido o ausente.
 */
export async function verifyAuthToken(req: NextRequest): Promise<string | null> {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;
    const token = authHeader.substring(7);
    if (!token) return null;
    initAdminApp();
    const decoded = await getAuth().verifyIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}
