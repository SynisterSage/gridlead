import { supabase } from './supabaseClient';

export type PushStatus = 'idle' | 'granted' | 'denied' | 'error';

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
};

export const subscribePush = async (vapidPublicKey: string | undefined) => {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !vapidPublicKey) {
    throw new Error('Push not supported or VAPID key missing');
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Permission denied');

  const reg = await navigator.serviceWorker.register(new URL('/push-sw.js', window.location.origin), { scope: '/' });
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });
  return sub;
};

export const saveSubscription = async (sub: PushSubscription) => {
  const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (sessionErr || !uid) throw new Error('No session');
  const json = sub.toJSON();
  const endpoint = json.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!endpoint || !p256dh || !auth) throw new Error('Invalid subscription');

  const { error } = await supabase.from('web_push_subscriptions').upsert({
    user_id: uid,
    endpoint,
    p256dh,
    auth,
  });
  if (error) throw error;
};

export const deleteSubscription = async () => {
  const reg = await navigator.serviceWorker.getRegistration();
  if (reg) {
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user?.id;
      if (uid && endpoint) {
        await supabase.from('web_push_subscriptions').delete().eq('user_id', uid).eq('endpoint', endpoint);
      }
    }
  }
};
