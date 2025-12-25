export async function robustLogout(options?: { redirectTo?: string; forceGlobal?: boolean }) {
  const redirectTo = options?.redirectTo ?? '/';
  const forceGlobal = options?.forceGlobal ?? true;
  try {
    // Attempt global sign out first (best-effort)
    try {
      // Import supabase lazily to avoid circular imports at module load
      const { supabase } = await import('../lib/supabaseClient');
      if (forceGlobal && supabase?.auth?.signOut) {
        await supabase.auth.signOut({ scope: 'global' } as any).catch(() => {});
      } else if (supabase?.auth?.signOut) {
        await supabase.auth.signOut().catch(() => {});
      }
    } catch (e) {
      // ignore supabase errors here — we'll still clear client state
      // console.debug('robustLogout: supabase signOut failed', e);
    }

    // Clear common app storage keys
    try {
      if (typeof window !== 'undefined') {
        // Remove known GridLead keys
        const patterns = ['gridlead_', 'gridlead-', 'sb-', 'supabase', 'sb:'];
        for (const k of Object.keys(localStorage)) {
          if (patterns.some(p => k.startsWith(p))) localStorage.removeItem(k);
        }
        // Clear sessionStorage entirely (safe for logout)
        try { sessionStorage.clear(); } catch (e) {}
      }
    } catch (e) {
      // ignore
    }

    // Unregister service workers to avoid stale push/auth behavior
    try {
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister().catch(() => {})));
      }
    } catch (e) {
      // ignore
    }

    // Force navigation to landing/login and include a cache-bypass param
    try {
      const url = new URL(redirectTo, window.location.origin);
      url.searchParams.set('logged_out', '1');
      url.searchParams.set('_ts', String(Date.now()));
      // Use replace to avoid back-button retention of post-logout page
      window.location.replace(url.toString());
    } catch (e) {
      // As a fallback, try a simple replace
      try { window.location.replace(redirectTo); } catch (e) {}
    }
  } catch (err) {
    // Last resort: still try to redirect
    try { window.location.replace(redirectTo); } catch (e) {}
  }
}

export function logAuthState(event: string, session: any) {
  try {
    // Keep logging minimal and structured
    console.debug('[auth] event=', event, 'sessionExists=', !!session, { session });
  } catch (e) {}
}
