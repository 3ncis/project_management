import { getSessionViewer, type AppViewer } from './auth';

export type { AppViewer } from './auth';

const DEMO_VIEWERS: Record<string, AppViewer> = {
  admin: { id: 1, slug: 'admin', name: 'Administrator', role: 'admin', email: 'admin@padmashri.tech' },
  padma: { id: 2, slug: 'padma', name: 'Padma', role: 'user', email: 'padma@padmashri.tech' },
  ortyd: { id: 3, slug: 'ortyd', name: 'Ortyd', role: 'user', email: 'ortyd@padmashri.tech' },
};

export async function resolveViewer(requestedView?: string): Promise<AppViewer | null> {
  if (process.env.NODE_ENV !== 'production' && requestedView && DEMO_VIEWERS[requestedView]) return DEMO_VIEWERS[requestedView];
  return getSessionViewer();
}
