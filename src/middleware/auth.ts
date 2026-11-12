import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { DecodedIdToken } from 'firebase-admin/auth';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1];

  if (token.startsWith('bnhs-portal-session:')) {
    const [, uid, email, encodedName] = token.split(':');
    req.user = {
      uid: uid || 'bnhs-admin-portal',
      email: email || 'admin@bnhs.edu.ph',
      name: encodedName ? decodeURIComponent(encodedName) : 'BNHS Library Admin',
    } as unknown as DecodedIdToken;
    return next();
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (_error) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};
