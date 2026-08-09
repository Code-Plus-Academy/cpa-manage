'use client';

import Link from 'next/link';
import { ShieldCheck, Heart, ExternalLink } from 'lucide-react';

export default function PublicFooter() {
  return (
    <footer style={{
      background: '#070a12',
      borderTop: '1px solid rgba(255, 255, 255, 0.08)',
      padding: '48px 24px 24px 24px',
      marginTop: 'auto',
      color: '#9ca3af'
    }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '32px', marginBottom: '40px' }}>
          {/* Brand Info */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldCheck size={18} color="#fff" />
              </div>
              <span style={{ fontSize: '15px', fontWeight: '800', color: '#fff' }}>Code Plus Academy</span>
            </div>
            <p style={{ fontSize: '13px', lineHeight: 1.6, color: '#9ca3af', margin: 0 }}>
              Empowering top tech talent through industry internships, academy programs, and career progression.
            </p>
          </div>

          {/* Careers & Hiring */}
          <div>
            <h4 style={{ fontSize: '12px', fontWeight: '700', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px' }}>
              Careers &amp; Opportunities
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              <li>
                <Link href="/careers" style={{ color: '#818cf8', textDecoration: 'none', fontWeight: '600' }}>
                  💼 Browse All Job Openings
                </Link>
              </li>
              <li>
                <Link href="/careers/my-applications" style={{ color: '#9ca3af', textDecoration: 'none' }}>
                  📥 Candidate Portal &amp; Applications
                </Link>
              </li>
              <li>
                <Link href="/hiring" style={{ color: '#9ca3af', textDecoration: 'none' }}>
                  🛡️ Hiring Admin Workspace
                </Link>
              </li>
            </ul>
          </div>

          {/* Governance & Trust */}
          <div>
            <h4 style={{ fontSize: '12px', fontWeight: '700', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px' }}>
              Trust &amp; Governance
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              <li><Link href="/copyright" style={{ color: '#9ca3af', textDecoration: 'none' }}>Copyright Claims</Link></li>
              <li><Link href="/institutions" style={{ color: '#9ca3af', textDecoration: 'none' }}>Institution Verification</Link></li>
              <li><Link href="/reclaim" style={{ color: '#9ca3af', textDecoration: 'none' }}>Content Reclaim Portal</Link></li>
              <li><Link href="/system-status" style={{ color: '#9ca3af', textDecoration: 'none' }}>System Status</Link></li>
            </ul>
          </div>

          {/* Platform Portal */}
          <div>
            <h4 style={{ fontSize: '12px', fontWeight: '700', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px' }}>
              Main CPA Platform
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              <li><Link href="/root/login" style={{ color: '#9ca3af', textDecoration: 'none' }}>Root Administrator Login</Link></li>
              <li><Link href="/users" style={{ color: '#9ca3af', textDecoration: 'none' }}>User Management</Link></li>
              <li><Link href="/tickets" style={{ color: '#9ca3af', textDecoration: 'none' }}>Support Desk</Link></li>
            </ul>
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', fontSize: '12px' }}>
          <div>© {new Date().getFullYear()} Code Plus Academy. All rights reserved.</div>
          <div style={{ color: '#6b7280' }}>
            PolyCert Studio Document Verification &amp; Hiring Engine
          </div>
        </div>
      </div>
    </footer>
  );
}
