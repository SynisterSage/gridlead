const clientId = import.meta.env.VITE_GMAIL_OAUTH_CLIENT_ID;
const redirectUri = import.meta.env.VITE_GMAIL_OAUTH_REDIRECT_URI;

const scopes = [
  // Gmail actions
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  // Identity (needed to reliably get email on callback)
  'email',
  'profile',
  'openid'
];

export const buildGmailAuthUrl = (state?: string | null) => {
  if (!clientId || !redirectUri) return null;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    scope: scopes.join(' '),
    include_granted_scopes: 'true'
  });
  if (state) params.append('state', state);
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
};

export const startGmailOAuth = (state?: string | null) => {
  const url = buildGmailAuthUrl(state);
  if (!url) {
    console.error('Gmail OAuth not configured: missing client ID or redirect URI.');
    return;
  }
  window.location.href = url;
};
