import { readFileSync } from 'fs';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const firebaseConfig = JSON.parse(
  readFileSync(
    new URL('../../firebase-applet-config.json', import.meta.url),
    'utf8'
  )
) as { projectId?: string };

if (!getApps().length) {
  initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

export const adminAuth = getAuth();
