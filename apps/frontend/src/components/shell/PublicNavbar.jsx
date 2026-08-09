'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Briefcase, ShieldCheck, User, LogIn, LogOut, ExternalLink } from 'lucide-react';

export default function PublicNavbar() {
  const [token, setToken] = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedToken = localStorage.getItem('cpa_admin_token') || localStorage.getItem('cpa_candidate_token');
      setToken(storedToken);
    }
  }, []);

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 50,
      background: 'rgba(9, 13, 22, 0.85)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
    }}>
      <div style={{
        maxWidth: '1280px',
        margin: '0 auto',
        padding: '0 24px',
        height: '68px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        {/* Brand Logo */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 16px rgba(99, 102, 241, 0.4)'
          }}>
            <ShieldCheck size={20} color="#FFFFFF" />
          </div>
          <div>
            <span style={{ fontSize: '15px', fontWeight: '800', color: '#ffffff', letterSpacing: '-0.02em', display: 'block' }}>
              CODE PLUS ACADEMY
            </span>
            <span style={{ fontSize: '11px', color: '#818cf8', fontWeight: '600', letterSpacing: '0.5px' }}>
              CAREERS PORTAL
            </span>
          </div>
        </Link>

        {/* Public Navigation Links */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <Link href="/careers" style={{ fontSize: '14px', fontWeight: '600', color: '#e5e7eb', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Briefcase size={16} style={{ color: '#818cf8' }} /> Open Positions
          </Link>

          <Link href="/careers/my-applications" style={{ fontSize: '14px', fontWeight: '600', color: '#9ca3af', textDecoration: 'none' }}>
            My Applications
          </Link>

          <Link href="/hiring" style={{ fontSize: '14px', fontWeight: '600', color: '#9ca3af', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
            Hiring Admin <ExternalLink size={12} />
          </Link>

          {/* Authentication Badge / Action */}
          {token ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.3)', padding: '6px 14px', borderRadius: '9999px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#34d399', boxShadow: '0 0 8px #34d399' }} />
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#818cf8' }}>Authenticated</span>
              <button
                onClick={() => {
                  localStorage.removeItem('cpa_admin_token');
                  localStorage.removeItem('cpa_candidate_token');
                  setToken(null);
                  window.location.reload();
                }}
                style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', fontSize: '12px', fontWeight: '700', marginLeft: '4px' }}
                title="Log Out"
              >
                <LogOut size={13} />
              </button>
            </div>
          ) : (
            <Link
              href="/root/login"
              style={{
                padding: '8px 18px', borderRadius: '8px',
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                color: '#ffffff', fontSize: '13px', fontWeight: '700', textDecoration: 'none',
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)'
              }}
            >
              <LogIn size={15} /> Platform Sign In
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
