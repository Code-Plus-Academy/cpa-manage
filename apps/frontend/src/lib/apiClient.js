const apiUrl = process.env.NEXT_PUBLIC_MANAGE_API_URL || 'https://cpa-manage.onrender.com';

export async function apiFetch(path, options = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('cpa_admin_token') : null;
  const headers = {
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (res.status === 401) {
    try {
      const cloned = res.clone();
      const errBody = await cloned.json();
      if (errBody?.error?.code === 'SESSION_EXPIRED' || errBody?.error?.code === 'UNAUTHENTICATED') {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('cpa_admin_token');
        }
      }
    } catch (parseErr) {
      // Could not parse error body, keep session token
    }
  }

  return res;
}

export { apiUrl };
