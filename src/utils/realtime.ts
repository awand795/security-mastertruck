// BroadcastChannel cross-tab dispatch to Bengkel KIM 3 Web Fleet
export const broadcastRealtimeEvent = (payload: {
  type: string;
  title: string;
  message: string;
  linkTab?: string;
  urgency?: 'urgent' | 'warning' | 'info' | 'success';
  targetRoles?: string[];
  meta?: Record<string, any>;
}) => {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
  try {
    const channel = new BroadcastChannel('bengkel_kim3_realtime_hub');
    const evt = {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: payload.type,
      targetRoles: payload.targetRoles || ['ALL'],
      title: payload.title,
      message: payload.message,
      linkTab: payload.linkTab || 'fleet-service',
      urgency: payload.urgency || 'info',
      timestamp: new Date().toISOString(),
      meta: payload.meta || {},
    };
    channel.postMessage(evt);
    channel.close();
  } catch (err) {
    console.warn('[RealtimeBroadcast] Failed to post message:', err);
  }
};
