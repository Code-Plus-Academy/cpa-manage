'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import PublicNavbar from '../../components/shell/PublicNavbar';
import PublicFooter from '../../components/shell/PublicFooter';
import { Search, Briefcase, MapPin, Clock, DollarSign, ArrowRight, Sparkles, Building2, ChevronRight } from 'lucide-react';

export default function PublicCareersPage() {
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');

  const apiUrl = process.env.NEXT_PUBLIC_MANAGE_API_URL || 'https://cpa-manage.onrender.com';

  useEffect(() => {
    fetchOpenPositions();
  }, []);

  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL');

  const fetchOpenPositions = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${apiUrl}/admin/hiring/positions?status=public`);
      if (res.ok) {
        const data = await res.json();
        // Keep open, upcoming, and closed positions (hide draft)
        const visiblePositions = (data.positions || []).filter(p => p.status !== 'draft');
        setPositions(visiblePositions);
      }
    } catch (err) {
      console.error('Failed to fetch positions:', err);
    } finally {
      setLoading(false);
    }
  };

  const departments = ['ALL', ...Array.from(new Set(positions.map(p => p.department || 'Engineering')))];

  const filteredPositions = positions.filter(p => {
    const matchesSearch = !searchQuery || 
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.department && p.department.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesDept = selectedDept === 'ALL' || p.department === selectedDept;
    const matchesStatus = selectedStatusFilter === 'ALL' || p.status === selectedStatusFilter;
    return matchesSearch && matchesDept && matchesStatus;
  });

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#0a0d16', color: '#f3f4f6' }}>
      <PublicNavbar />

      {/* Hero Banner Section */}
      <section style={{
        padding: '64px 24px',
        textAlign: 'center',
        background: 'radial-gradient(ellipse at top, rgba(99, 102, 241, 0.15) 0%, rgba(10, 13, 22, 0) 70%)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
      }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '6px 16px', borderRadius: '9999px',
            background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)',
            color: '#818cf8', fontSize: '13px', fontWeight: '700', marginBottom: '20px'
          }}>
            <Sparkles size={16} /> Code Plus Academy Careers Portal
          </div>
          <h1 style={{ fontSize: '42px', fontWeight: '900', letterSpacing: '-0.02em', margin: '0 0 16px 0', color: '#ffffff', lineHeight: 1.2 }}>
            Build the Future of EdTech &amp; Software Engineering
          </h1>
          <p style={{ fontSize: '18px', color: '#9ca3af', maxWidth: '720px', margin: '0 auto 32px auto', lineHeight: 1.6 }}>
            Explore open opportunities across engineering, academy mentorship, product, and ops. View full job responsibilities and apply directly.
          </p>

          {/* Search & Department Bar */}
          <div style={{ display: 'flex', gap: '12px', maxWidth: '680px', margin: '0 auto', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '260px', position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
              <input
                type="text"
                placeholder="Search open positions by keyword or department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%', padding: '12px 16px 12px 42px', borderRadius: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.12)', background: 'rgba(18, 20, 29, 0.8)',
                  color: '#ffffff', fontSize: '14px', outline: 'none'
                }}
              />
            </div>
          </div>

          {/* Department & Status Filter Pills */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '20px', flexWrap: 'wrap' }}>
            {departments.map(dept => (
              <button
                key={dept}
                onClick={() => setSelectedDept(dept)}
                style={{
                  padding: '6px 14px', borderRadius: '9999px', border: selectedDept === dept ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.08)',
                  background: selectedDept === dept ? '#6366f1' : 'rgba(18, 20, 29, 0.6)',
                  color: selectedDept === dept ? '#fff' : '#9ca3af', fontSize: '12px', fontWeight: '700', cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {dept === 'ALL' ? 'All Departments' : dept}
              </button>
            ))}
          </div>

          {/* Status Filter Bar */}
          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginTop: '10px', flexWrap: 'wrap' }}>
            {[
              { id: 'ALL', label: 'All Positions' },
              { id: 'open', label: '✨ Active Hiring' },
              { id: 'upcoming', label: '🔮 Upcoming Roles' },
              { id: 'closed', label: '🔒 Closed / Archived' },
            ].map(st => (
              <button
                key={st.id}
                onClick={() => setSelectedStatusFilter(st.id)}
                style={{
                  padding: '4px 12px', borderRadius: '6px',
                  border: selectedStatusFilter === st.id ? '1px solid #818cf8' : '1px solid rgba(255,255,255,0.06)',
                  background: selectedStatusFilter === st.id ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                  color: selectedStatusFilter === st.id ? '#818cf8' : '#6b7280', fontSize: '11px', fontWeight: '600', cursor: 'pointer'
                }}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Main Position Listings Section */}
      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '48px 24px', flex: 1, width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Briefcase style={{ color: '#818cf8' }} size={24} /> Job Listings ({filteredPositions.length})
          </h2>
          <span style={{ fontSize: '13px', color: '#9ca3af' }}>No login required to view position specifications</span>
        </div>

        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#9ca3af', fontSize: '15px' }}>
            Loading career positions...
          </div>
        ) : filteredPositions.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', background: 'rgba(18, 20, 29, 0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px' }}>
            <Building2 size={48} style={{ color: '#4b5563', marginBottom: '16px' }} />
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#ffffff', margin: '0 0 8px 0' }}>No Positions Found</h3>
            <p style={{ fontSize: '14px', color: '#9ca3af', margin: 0 }}>Try clearing your search query or status filter.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
            {filteredPositions.map(p => {
              const isOpen = p.status === 'open';
              const isUpcoming = p.status === 'upcoming';
              const isClosed = p.status === 'closed';

              return (
                <div
                  key={p.id}
                  style={{
                    background: 'rgba(18, 20, 29, 0.7)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '16px',
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    justify: 'space-between',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                    opacity: isClosed ? 0.75 : 1
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', padding: '3px 10px', borderRadius: '9999px', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                        {p.department || 'Engineering'}
                      </span>
                      
                      {isOpen && (
                        <span style={{ fontSize: '12px', color: '#34d399', fontWeight: '700', background: 'rgba(16, 185, 129, 0.15)', padding: '3px 10px', borderRadius: '9999px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                          ✨ Active Hiring
                        </span>
                      )}

                      {isUpcoming && (
                        <span style={{ fontSize: '12px', color: '#c084fc', fontWeight: '700', background: 'rgba(192, 132, 252, 0.15)', padding: '3px 10px', borderRadius: '9999px', border: '1px solid rgba(192, 132, 252, 0.3)' }}>
                          🔮 Opening Soon
                        </span>
                      )}

                      {isClosed && (
                        <span style={{ fontSize: '12px', color: '#f87171', fontWeight: '700', background: 'rgba(239, 68, 68, 0.15)', padding: '3px 10px', borderRadius: '9999px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                          🔒 Position Closed
                        </span>
                      )}
                    </div>

                    <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#ffffff', margin: '0 0 8px 0', lineHeight: 1.3 }}>
                      {p.title}
                    </h3>

                    <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', fontSize: '13px', color: '#9ca3af', marginBottom: '16px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MapPin size={14} style={{ color: '#818cf8' }} /> {p.location || 'Remote'}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={14} style={{ color: '#fbbf24' }} /> {p.type || 'Internship'}
                      </span>
                      {p.salary_range && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#34d399', fontWeight: '600' }}>
                          <DollarSign size={14} /> {p.salary_range}
                        </span>
                      )}
                    </div>

                    <p style={{ fontSize: '14px', color: '#d1d5db', lineHeight: 1.5, margin: '0 0 20px 0', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {p.description || 'Join Code Plus Academy in driving hands-on technology education and professional career advancement.'}
                    </p>
                  </div>

                  <div style={{ paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: '#6b7280' }}>
                      {isOpen ? `${p.openings || 1} Opening(s)` : isUpcoming ? 'Announced' : 'Archived'}
                    </span>

                    <Link
                      href={`/careers/${p.id}`}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        padding: '8px 16px', borderRadius: '8px',
                        background: isOpen ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : isUpcoming ? 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)' : 'rgba(255,255,255,0.08)',
                        color: '#ffffff', fontSize: '13px', fontWeight: '700', textDecoration: 'none',
                        border: isClosed ? '1px solid rgba(255,255,255,0.15)' : 'none',
                        boxShadow: isOpen ? '0 4px 12px rgba(16, 185, 129, 0.35)' : 'none'
                      }}
                    >
                      {isOpen ? 'View Details & Apply' : 'View Specifications'} <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <PublicFooter />
    </div>
  );
}
