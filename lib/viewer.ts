import { getSessionViewer, type AppViewer } from './auth';

export type { AppViewer } from './auth';

export async function resolveViewer(requestedView?: string): Promise<AppViewer | null> {
  // Legacy preview URLs remain valid, but query parameters never grant a role.
  void requestedView;
  return getSessionViewer();
}
