import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import * as dotenv from 'dotenv';
import { requireAuth, AuthRequest } from './src/middleware/auth.ts';
import {
  getOrCreateUser,
  getLibraryOverviewData,
  createBookRecord,
  updateBookRecord,
  deleteBookRecord,
  issueBookBorrow,
  returnBorrowedBook,
  markBorrowOverdue,
  createDigitalResourceRecord,
  updateDigitalResourceRecord,
  deleteDigitalResourceRecord,
  incrementDigitalDownload,
  createCategoryRecord,
  updateCategoryRecord,
  deleteCategoryRecord,
  updateUserRoleRecord,
  updateUserRecord,
  deleteUserRecord,
  createLibraryMemberRecord,
  getPortalSyncStateRecord,
  upsertPortalSyncStateRecord,
} from './src/db/queries.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default Portal Banner & Settings State (persisted in Cloud SQL)
const defaultPortalSettings = {
  portalTitle:
    'Barobo National High School (BNHS) Library Portal developed by: Bless T. Tajale',
  welcomeHeading: 'Welcome to the BNHS Library Portal',
  welcomeSubtext:
    'Centralized online library management system where students, teachers, librarians, and administrators search catalog holdings, track book loans, and access DepEd digital learning materials.',
  scheduleBannerText: 'Academic Year 2026–2027 · Open Mon–Fri, 7:30 AM – 5:00 PM',
  heroImageUrl: '/src/assets/images/bnhs_library_hero_1794464935499.jpg',
  logoImageUrl: '/src/assets/images/bnhs_1978_official_logo_animated.gif',
};

// Shared Book Return Notifications & Waitlist Requests (persisted in Cloud SQL)
interface BookWaitlistRequest {
  id: number;
  bookId: number;
  bookTitle: string;
  studentName: string;
  studentIdNumber: string;
  requestedAt: string;
  fulfilled: boolean;
  returnedAt?: string;
}

const defaultWaitlistRequests: BookWaitlistRequest[] = [
  {
    id: 1,
    bookId: 4,
    bookTitle:
      'Practical Research 2: Quantitative Inquiry and Statistical Analysis',
    studentName: 'Althea Mae C. Villaruel',
    studentIdNumber: 'LRN-132604180021',
    requestedAt: '2026-10-25',
    fulfilled: true,
    returnedAt: '2026-10-27',
  },
];

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '15mb' }));

  app.get('/api/library/overview', async (_req, res) => {
    try {
      const [data, portalSettings, waitlistRequests] = await Promise.all([
        getLibraryOverviewData(),
        getPortalSyncStateRecord('portal_settings', defaultPortalSettings),
        getPortalSyncStateRecord('waitlist_requests', defaultWaitlistRequests),
      ]);
      res.json({
        ...data,
        portalSettings,
        waitlistRequests,
        syncedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Unable to load library overview data.',
      });
    }
  });

  // Update Portal Settings (Hero Image, Logo, Schedule Text, Title) — Auto-saved to Cloud SQL
  app.put('/api/portal-settings', requireAuth, async (req: AuthRequest, res) => {
    try {
      const currentSettings = await getPortalSyncStateRecord(
        'portal_settings',
        defaultPortalSettings
      );
      const updatedSettings = {
        ...currentSettings,
        ...req.body,
      };
      await upsertPortalSyncStateRecord('portal_settings', updatedSettings);
      res.json({
        portalSettings: updatedSettings,
        syncedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Failed to update portal settings.',
      });
    }
  });

  // Request notification when a borrowed book is returned — Auto-saved to Cloud SQL
  app.post('/api/waitlist', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { bookId, bookTitle, studentName, studentIdNumber } = req.body;
      const currentWaitlist = await getPortalSyncStateRecord(
        'waitlist_requests',
        defaultWaitlistRequests
      );
      const newReq: BookWaitlistRequest = {
        id: Date.now(),
        bookId: Number(bookId),
        bookTitle,
        studentName: studentName || 'Althea Mae C. Villaruel',
        studentIdNumber: studentIdNumber || 'LRN-132604180021',
        requestedAt: new Date().toISOString().split('T')[0],
        fulfilled: false,
      };
      const updatedWaitlist = [newReq, ...currentWaitlist];
      await upsertPortalSyncStateRecord('waitlist_requests', updatedWaitlist);
      res.status(201).json({
        request: newReq,
        waitlistRequests: updatedWaitlist,
        syncedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Failed to register book return alert.',
      });
    }
  });

  // Explicit Cloud Sync endpoint for manual or background auto-sync verification
  app.post('/api/cloud-sync', async (req, res) => {
    try {
      if (req.body?.portalSettings) {
        const currentSettings = await getPortalSyncStateRecord(
          'portal_settings',
          defaultPortalSettings
        );
        await upsertPortalSyncStateRecord('portal_settings', {
          ...currentSettings,
          ...req.body.portalSettings,
        });
      }
      const [data, portalSettings, waitlistRequests] = await Promise.all([
        getLibraryOverviewData(),
        getPortalSyncStateRecord('portal_settings', defaultPortalSettings),
        getPortalSyncStateRecord('waitlist_requests', defaultWaitlistRequests),
      ]);
      res.json({
        ...data,
        portalSettings,
        waitlistRequests,
        syncedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Cloud sync failed.',
      });
    }
  });

  app.post('/api/auth/sync', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const email = req.user!.email || 'user@bnhs.edu.ph';
      const name = req.user!.name || req.body?.displayName;
      const dbUser = await getOrCreateUser(uid, email, name);
      res.json({ user: dbUser });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to sync user.' });
    }
  });

  app.post('/api/books', requireAuth, async (req: AuthRequest, res) => {
    try {
      const book = await createBookRecord(req.body);
      res.status(201).json({ book });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to add book.' });
    }
  });

  app.put('/api/books/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const bookId = Number(req.params.id);
      const book = await updateBookRecord(bookId, req.body);
      res.json({ book });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to update book.' });
    }
  });

  app.delete('/api/books/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const bookId = Number(req.params.id);
      const deleted = await deleteBookRecord(bookId);
      res.json({ deleted });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to delete book.' });
    }
  });

  app.post('/api/borrows', requireAuth, async (req: AuthRequest, res) => {
    try {
      const record = await issueBookBorrow({
        ...req.body,
        borrowerUid: req.body.borrowerUid || req.user!.uid,
      });
      res.status(201).json({ record });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to issue book.' });
    }
  });

  app.patch('/api/borrows/:id/return', requireAuth, async (req: AuthRequest, res) => {
    try {
      const recordId = Number(req.params.id);
      const returnDate =
        req.body?.returnDate || new Date().toISOString().split('T')[0];
      const record = await returnBorrowedBook(recordId, returnDate);

      // Automatically fulfill any student waitlist notifications for this returned book in Cloud SQL
      const currentWaitlist = await getPortalSyncStateRecord(
        'waitlist_requests',
        defaultWaitlistRequests
      );
      const updatedWaitlist = currentWaitlist.map((w) =>
        w.bookId === record.bookId && !w.fulfilled
          ? { ...w, fulfilled: true, returnedAt: returnDate }
          : w
      );
      await upsertPortalSyncStateRecord('waitlist_requests', updatedWaitlist);

      res.json({ record, waitlistRequests: updatedWaitlist });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to return book.' });
    }
  });

  app.patch('/api/borrows/:id/overdue', requireAuth, async (req: AuthRequest, res) => {
    try {
      const recordId = Number(req.params.id);
      const record = await markBorrowOverdue(recordId);
      res.json({ record });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to update status.' });
    }
  });

  app.post('/api/digital-resources', requireAuth, async (req: AuthRequest, res) => {
    try {
      const resource = await createDigitalResourceRecord(req.body);
      res.status(201).json({ resource });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Failed to upload digital resource.',
      });
    }
  });

  app.put('/api/digital-resources/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const resourceId = Number(req.params.id);
      const resource = await updateDigitalResourceRecord(resourceId, req.body);
      res.json({ resource });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Failed to update digital resource.',
      });
    }
  });

  app.delete('/api/digital-resources/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const resourceId = Number(req.params.id);
      const deleted = await deleteDigitalResourceRecord(resourceId);
      res.json({ deleted });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Failed to delete digital resource.',
      });
    }
  });

  app.post('/api/digital-resources/:id/download', async (req, res) => {
    try {
      const resourceId = Number(req.params.id);
      const resource = await incrementDigitalDownload(resourceId);
      res.json({ resource });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to record access.' });
    }
  });

  app.post('/api/categories', requireAuth, async (req: AuthRequest, res) => {
    try {
      const category = await createCategoryRecord(req.body);
      res.status(201).json({ category });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Failed to create category.',
      });
    }
  });

  app.put('/api/categories/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const categoryId = Number(req.params.id);
      const category = await updateCategoryRecord(categoryId, req.body);
      res.json({ category });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Failed to update category.',
      });
    }
  });

  app.delete('/api/categories/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const categoryId = Number(req.params.id);
      const deleted = await deleteCategoryRecord(categoryId);
      res.json({ deleted });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Failed to delete category.',
      });
    }
  });

  app.patch('/api/users/:id/role', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = Number(req.params.id);
      const { role, gradeOrDepartment } = req.body;
      const updated = await updateUserRoleRecord(userId, role, gradeOrDepartment);
      res.json({ user: updated });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Failed to update user permissions.',
      });
    }
  });

  app.put('/api/users/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = Number(req.params.id);
      const updated = await updateUserRecord(userId, req.body);
      res.json({ user: updated });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Failed to update user account.',
      });
    }
  });

  app.delete('/api/users/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = Number(req.params.id);
      const deleted = await deleteUserRecord(userId);
      res.json({ deleted });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Failed to delete user account.',
      });
    }
  });

  app.post('/api/users', requireAuth, async (req: AuthRequest, res) => {
    try {
      const newUser = await createLibraryMemberRecord(req.body);
      res.status(201).json({ user: newUser });
    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Failed to register library member.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    process.env.DISABLE_HMR = 'true';
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, watch: null },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BNHS Library Portal Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
