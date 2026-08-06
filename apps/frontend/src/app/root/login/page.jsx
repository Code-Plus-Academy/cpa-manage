'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Lock, Mail, Key, AlertCircle } from 'lucide-react';

export default function RootLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_MANAGE_API_URL || 'https://cpa-manage.onrender.com';

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);

    if (!totpCode) {
      setError('2FA TOTP Authenticator code is mandatory for Root Admin login.');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(`${apiUrl}/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          totp_code: totpCode,
        }),
        credentials: 'include',
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error?.message || 'Invalid root admin credentials or TOTP code.');
        return;
      }

      if (!data.admin_user?.is_root) {
        setError('This portal is reserved strictly for Root Administrators.');
        return;
      }

      if (data.token) {
        localStorage.setItem('cpa_admin_token', data.token);
      }

      router.push('/');
    } catch (err) {
      setError('Unable to connect to cpa-manage API.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main style={{ minHeight: '100vh', padding: '2rem 1rem', maxWidth: '420px', margin: '4rem auto 0 auto' }}>
      <div className="glass-panel" style={{ padding: '2rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4)', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'inline-flex', padding: 12, borderRadius: '50%', backgroundColor: 'rgba(99, 102, 241, 0.15)', marginBottom: 12 }}>
            <ShieldCheck size={36} color="#6366f1" />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff' }}>Root Administrator Sign In</h2>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '4px' }}>Mandatory 2FA TOTP authentication required</p>
        </div>

        {error && (
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#f87171',
            padding: '10px 14px',
            borderRadius: '8px',
            fontSize: '0.85rem',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '6px' }}>Root Email Address</label>
            <div style={{ position: 'relative' }}>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="root@codeplusacademy.in"
                className="glass-input"
                style={{ width: '100%', paddingLeft: '38px' }}
              />
              <Mail size={18} color="#94a3b8" style={{ position: 'absolute', left: 12, top: 12 }} />
            </div>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '6px' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="glass-input"
                style={{ width: '100%', paddingLeft: '38px' }}
              />
              <Key size={18} color="#94a3b8" style={{ position: 'absolute', left: 12, top: 12 }} />
            </div>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#6366f1', fontWeight: 600, marginBottom: '6px' }}>2FA TOTP Authenticator Code (6 Digits)</label>
            <input
              type="text"
              required
              maxLength={6}
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              placeholder="123456"
              className="glass-input"
              style={{ width: '100%', letterSpacing: '4px', textAlign: 'center', borderColor: '#6366f1', fontSize: '1.1rem', fontWeight: 700 }}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem', opacity: submitting ? 0.7 : 1 }}
          >
            {submitting ? 'Authenticating Root Access...' : 'Sign In with 2FA'}
          </button>
        </form>
      </div>
    </main>
  );
}
