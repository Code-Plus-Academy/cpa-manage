'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Code2, Search, RefreshCw, Sparkles, UserPlus,
  Trash2, Edit3, ShieldCheck, CheckCircle2, ExternalLink, X, Loader2, Plus,
  FileCode, Download, Copy, Upload, ArrowUpRight, Github, Linkedin, Twitter, Instagram,
  Mail, Users, Award, Terminal
} from 'lucide-react';
import AdminShell from '../../components/shell/AdminShell';
import { tokens } from '../theme/tokens';
import { apiFetch } from '../../lib/apiClient';

const CATEGORY_OPTIONS = [
  { id: 'all', label: 'All Builders' },
  { id: 'founders', label: 'Founders & Core' },
  { id: 'engineering', label: 'Engineering' },
  { id: 'design', label: 'Design & Product' },
  { id: 'alumni', label: 'Past Team & Alumni' },
];

const DEFAULT_BUILDERS = [
  {
    id: 'sayaji-kapse',
    name: 'Sayaji Kapse',
    role: 'Founder & Lead Systems Architect',
    teamCategory: 'founders',
    status: 'Core Team',
    avatar: 'https://res.cloudinary.com/dw5aqjqur/image/upload/v1779995620/cpa/avatars/hyonbsm8ojekkds5fk9l.png',
    bio: 'Architected the core Code Plus Academy platform, high-throughput social microservices, Notes Arena indexing pipeline, and real-time developer infrastructure.',
    contributions: [
      'Engineered Notes Arena search & PDF viewer subsystem',
      'Designed PostgreSQL schema architecture & auth engine',
      'Built CPA Creator Studio & HLS transcoding pipeline'
    ],
    skills: ['Node.js', 'React', 'PostgreSQL', 'Next.js', 'System Design', 'Cloud Architecture'],
    socials: {
      github: 'https://github.com/Sayaji-Kapse',
      linkedin: 'https://linkedin.com/in/sayajikapse',
      twitter: 'https://x.com/C_Plus_Academy',
      instagram: 'https://instagram.com/sayaji_kapse',
      cpaUsername: 'sayajikapse',
      email: 'sayaji@codeplusacademy.in'
    }
  },
  {
    id: 'atharva-kapse',
    name: 'Atharva Kapse',
    role: 'Founding Engineer & Full Stack Lead',
    teamCategory: 'engineering',
    status: 'Core Team',
    avatar: '',
    bio: 'Specialized in frontend performance engineering, responsive layout systems, real-time messaging, and multi-university educational resource curation.',
    contributions: [
      'Developed responsive feed UI & navigation rail',
      'Implemented real-time notification engine',
      'Curated SPPU & DU academic syllabus mappings'
    ],
    skills: ['React', 'JavaScript', 'CSS Architecture', 'REST APIs', 'PostgreSQL'],
    socials: {
      github: 'https://github.com',
      linkedin: 'https://linkedin.com',
      twitter: 'https://x.com',
      cpaUsername: 'atharva'
    }
  },
  {
    id: 'priya-sharma',
    name: 'Priya Sharma',
    role: 'Product Designer & UI/UX Architect',
    teamCategory: 'design',
    status: 'Core Team',
    avatar: '',
    bio: 'Crafted the dark glassmorphic design system, typography tokens, interactive student workflows, and mobile experience across Code Plus Academy.',
    contributions: [
      'Designed Notes Arena discovery interface & dark theme',
      'Created component design tokens and UI guidelines',
      'Conducted student UX research across 12 engineering colleges'
    ],
    skills: ['Figma', 'UI/UX Design', 'Design Systems', 'Prototyping', 'Accessibility'],
    socials: {
      github: 'https://github.com',
      linkedin: 'https://linkedin.com',
      twitter: 'https://x.com',
      cpaUsername: 'priyadesign'
    }
  },
  {
    id: 'rahul-verma',
    name: 'Rahul Verma',
    role: 'Backend & Cloud Infrastructure Engineer',
    teamCategory: 'engineering',
    status: 'Past Builder',
    avatar: '',
    bio: 'Contributed to early database migrations, Supabase replication, cloud storage connectors, and CDN edge optimization for document delivery.',
    contributions: [
      'Integrated Cloudinary asset pipeline and PDF proxies',
      'Optimized SQL queries for large note catalogs',
      'Configured Render and Vercel CI/CD automations'
    ],
    skills: ['PostgreSQL', 'Docker', 'Redis', 'Express.js', 'DevOps'],
    socials: {
      github: 'https://github.com',
      linkedin: 'https://linkedin.com',
      cpaUsername: 'rahulv'
    }
  },
  {
    id: 'amit-patel',
    name: 'Amit Patel',
    role: 'Campus Tech Lead & Community Architect',
    teamCategory: 'founders',
    status: 'Past Builder',
    avatar: '',
    bio: 'Built student developer community outreach, organized campus hackathons, and helped onboard initial college departmental repositories.',
    contributions: [
      'Led university campus chapter expansion across Maharashtra',
      'Established student peer-review protocols',
      'Coordinated open source contributor onboarding'
    ],
    skills: ['Community Growth', 'Developer Relations', 'Technical Writing', 'React'],
    socials: {
      github: 'https://github.com',
      linkedin: 'https://linkedin.com',
      twitter: 'https://x.com',
      cpaUsername: 'amitp'
    }
  }
];

export default function BuildersManagementPage() {
  const router = useRouter();
  const [adminUser, setAdminUser] = useState(null);
  const [builders, setBuilders] = useState(DEFAULT_BUILDERS);
  const [platformUsers, setPlatformUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  // Modal states for Add/Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBuilderId, setEditingBuilderId] = useState(null);
  const [formName, setFormName] = useState('');
  const [formRole, setFormRole] = useState('');
  const [formCategory, setFormCategory] = useState('engineering');
  const [formStatus, setFormStatus] = useState('Core Team');
  const [formAvatar, setFormAvatar] = useState('');
  const [formBio, setFormBio] = useState('');
  const [formContributions, setFormContributions] = useState(['']);
  const [formSkills, setFormSkills] = useState([]);
  const [skillInput, setSkillInput] = useState('');
  const [formSocials, setFormSocials] = useState({
    github: '',
    linkedin: '',
    twitter: '',
    instagram: '',
    cpaUsername: '',
    email: '',
  });

  // JSON modal state
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [copied, setCopied] = useState(false);
  const [jsonTab, setJsonTab] = useState('export'); // 'export' | 'import'

  const [saving, setSaving] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    checkAuthStatus();
    loadBuilders();
    loadPlatformUsers();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const res = await apiFetch('/admin/auth/me');
      if (res.ok) {
        const data = await res.json();
        setAdminUser(data.admin_user);
      }
    } catch (err) {
      console.error('Auth check failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadBuilders = async () => {
    setDataLoading(true);
    setActionError('');
    try {
      const res = await apiFetch('/admin/builders');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.builders) && data.builders.length > 0) {
          setBuilders(data.builders);
        }
      }
    } catch (err) {
      console.warn('Failed to load builders from API, using default list:', err);
    } finally {
      setDataLoading(false);
    }
  };

  const loadPlatformUsers = async () => {
    try {
      const res = await apiFetch('/admin/contributors');
      if (res.ok) {
        const data = await res.json();
        setPlatformUsers(data.users || data.contributors || []);
      }
    } catch (_) {}
  };

  const handleOpenAdd = () => {
    setEditingBuilderId(null);
    setFormName('');
    setFormRole('');
    setFormCategory('engineering');
    setFormStatus('Core Team');
    setFormAvatar('');
    setFormBio('');
    setFormContributions(['']);
    setFormSkills([]);
    setSkillInput('');
    setFormSocials({ github: '', linkedin: '', twitter: '', instagram: '', cpaUsername: '', email: '' });
    setActionError('');
    setActionSuccess('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (b) => {
    setEditingBuilderId(b.id);
    setFormName(b.name || '');
    setFormRole(b.role || '');
    setFormCategory(b.teamCategory || b.team_category || 'engineering');
    setFormStatus(b.status || 'Core Team');
    setFormAvatar(b.avatar || '');
    setFormBio(b.bio || '');
    setFormContributions(Array.isArray(b.contributions) && b.contributions.length > 0 ? b.contributions : ['']);
    setFormSkills(Array.isArray(b.skills) ? b.skills : []);
    setSkillInput('');
    setFormSocials(b.socials || { github: '', linkedin: '', twitter: '', instagram: '', cpaUsername: '', email: '' });
    setActionError('');
    setActionSuccess('');
    setIsModalOpen(true);
  };

  const handleAutoFillUser = (u) => {
    if (!u) return;
    setFormName(u.name || u.username || '');
    setFormAvatar(u.avatar_url || '');
    if (u.username) {
      setFormSocials(prev => ({ ...prev, cpaUsername: u.username }));
    }
    if (u.bio && !formBio) {
      setFormBio(u.bio);
    }
  };

  const handleAddContribution = () => {
    setFormContributions(prev => [...prev, '']);
  };

  const handleRemoveContribution = (index) => {
    setFormContributions(prev => prev.filter((_, i) => i !== index));
  };

  const handleContributionChange = (index, val) => {
    setFormContributions(prev => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
  };

  const handleAddSkill = () => {
    const trimmed = skillInput.trim();
    if (trimmed && !formSkills.includes(trimmed)) {
      setFormSkills(prev => [...prev, trimmed]);
      setSkillInput('');
    }
  };

  const handleRemoveSkill = (skill) => {
    setFormSkills(prev => prev.filter(s => s !== skill));
  };

  const handleImageFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      setFormAvatar(uploadEvent.target?.result || '');
    };
    reader.readAsDataURL(file);
  };

  const handleSaveBuilder = async (e) => {
    e.preventDefault();
    if (!formName.trim() || !formRole.trim()) {
      setActionError('Full Name and Role Title are required.');
      return;
    }

    setSaving(true);
    setActionError('');

    const payload = {
      name: formName.trim(),
      role: formRole.trim(),
      teamCategory: formCategory,
      status: formStatus,
      avatar: formAvatar.trim(),
      bio: formBio.trim(),
      contributions: formContributions.filter(c => c.trim().length > 0),
      skills: formSkills,
      socials: formSocials,
    };

    try {
      let res;
      if (editingBuilderId) {
        res = await apiFetch(`/admin/builders/${editingBuilderId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await apiFetch('/admin/builders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (res.ok) {
        setIsModalOpen(false);
        loadBuilders();
      } else {
        const data = await res.json().catch(() => ({}));
        const errMsg = data?.error?.message || (typeof data?.error === 'string' ? data.error : data?.message) || 'Failed to save builder to backend.';
        
        // Optimistic local state update so admin never gets blocked
        const generatedId = editingBuilderId || formName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
        setBuilders(prev => {
          const updated = [...prev];
          const idx = updated.findIndex(b => b.id === generatedId);
          const newEntry = { id: generatedId, ...payload };
          if (idx >= 0) {
            updated[idx] = newEntry;
          } else {
            updated.push(newEntry);
          }
          return updated;
        });

        setIsModalOpen(false);
      }
    } catch (err) {
      console.warn('Network error, updating locally:', err);
      const generatedId = editingBuilderId || formName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
      setBuilders(prev => {
        const updated = [...prev];
        const idx = updated.findIndex(b => b.id === generatedId);
        const newEntry = { id: generatedId, ...payload };
        if (idx >= 0) {
          updated[idx] = newEntry;
        } else {
          updated.push(newEntry);
        }
        return updated;
      });
      setIsModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBuilder = async (id, name) => {
    if (!window.confirm(`Are you sure you want to remove ${name} from the team list?`)) return;
    try {
      await apiFetch(`/admin/builders/${id}`, { method: 'DELETE' });
    } catch (_) {}
    setBuilders(prev => prev.filter(b => b.id !== id));
  };

  const handleOpenJsonModal = () => {
    const formatted = JSON.stringify(builders, null, 2);
    setJsonText(formatted);
    setJsonTab('export');
    setCopied(false);
    setIsJsonModalOpen(true);
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(jsonText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadJson = () => {
    const element = document.createElement('a');
    const file = new Blob([jsonText], { type: 'application/json' });
    element.href = URL.createObjectURL(file);
    element.download = 'builders.json';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleImportJson = async () => {
    try {
      const parsed = JSON.parse(jsonText);
      if (!Array.isArray(parsed)) {
        alert('JSON must be an array of builder objects.');
        return;
      }
      setBuilders(parsed);
      try {
        await apiFetch('/admin/builders/import-json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ builders: parsed })
        });
      } catch (_) {}
      setIsJsonModalOpen(false);
    } catch (err) {
      alert(`Invalid JSON format: ${err.message}`);
    }
  };

  const filteredBuilders = builders.filter((b) => {
    const category = b.teamCategory || b.team_category || 'engineering';
    const matchesCat = 
      activeCategory === 'all' ? true :
      activeCategory === 'alumni' ? (b.status || '').toLowerCase().includes('past') :
      category === activeCategory;

    const matchesSearch =
      (b.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.role || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.bio || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (Array.isArray(b.skills) && b.skills.some(s => s.toLowerCase().includes(searchQuery.toLowerCase())));

    return matchesCat && matchesSearch;
  });

  return (
    <AdminShell
      activeTab="builders"
      breadcrumb={['Community', 'Team & Builders Management']}
      passedAdminUser={adminUser}
    >
      <div style={{ maxWidth: 1280, margin: '0 auto', paddingBottom: 60 }}>

        {/* ── Page Header ── */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          flexWrap: 'wrap', gap: 16, marginBottom: 28
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: 'rgba(0, 219, 233, 0.12)', border: '1px solid rgba(0, 219, 233, 0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00dbe9'
              }}>
                <Code2 size={20} />
              </div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: tokens.colors.textPrimary, margin: 0 }}>
                Team & Builders Studio
              </h1>
            </div>
            <p style={{ fontSize: 13.5, color: tokens.colors.textSecondary, margin: 0, maxWidth: 640 }}>
              Manage Code Plus Academy's core software engineers, founders, designers, and alumni displayed on <code>/builders</code>.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={handleOpenJsonModal}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px',
                borderRadius: 10, background: tokens.colors.surfaceCard,
                border: `1px solid ${tokens.colors.borderLight}`, color: tokens.colors.textPrimary,
                fontSize: 13, fontWeight: 600, cursor: 'pointer'
              }}
            >
              <FileCode size={16} />
              <span>JSON Export / Import</span>
            </button>

            <button
              onClick={loadBuilders}
              disabled={dataLoading}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px',
                borderRadius: 10, background: tokens.colors.surfaceCard,
                border: `1px solid ${tokens.colors.borderLight}`, color: tokens.colors.textPrimary,
                fontSize: 13, fontWeight: 600, cursor: 'pointer'
              }}
            >
              <RefreshCw size={15} className={dataLoading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>

            <button
              onClick={handleOpenAdd}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px',
                borderRadius: 10, background: 'linear-gradient(135deg, #00dbe9, #2563eb)',
                color: '#fff', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(0, 219, 233, 0.3)'
              }}
            >
              <Plus size={16} />
              <span>+ Add Team Member</span>
            </button>
          </div>
        </div>

        {/* ── Search & Filter Tabs ── */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: 16, marginBottom: 24, padding: '16px 20px',
          background: tokens.colors.surfaceCard, border: `1px solid ${tokens.colors.borderLight}`,
          borderRadius: 16
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {CATEGORY_OPTIONS.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                style={{
                  padding: '7px 16px', borderRadius: 99,
                  fontSize: 12.5, fontWeight: 600, border: '1px solid',
                  cursor: 'pointer', transition: 'all 0.2s ease',
                  background: activeCategory === cat.id ? '#00dbe9' : 'transparent',
                  color: activeCategory === cat.id ? '#000' : tokens.colors.textSecondary,
                  borderColor: activeCategory === cat.id ? '#00dbe9' : tokens.colors.borderLight
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div style={{ position: 'relative', minWidth: 260 }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: 11, color: tokens.colors.textTertiary }} />
            <input
              type="text"
              placeholder="Search by name, role, skill..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px 8px 34px', borderRadius: 10,
                background: tokens.colors.surfaceBg, border: `1px solid ${tokens.colors.borderLight}`,
                color: tokens.colors.textPrimary, fontSize: 13, outline: 'none'
              }}
            />
          </div>
        </div>

        {/* ── Builder Cards Grid ── */}
        {dataLoading && builders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: tokens.colors.textSecondary }}>
            <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 12px', color: '#00dbe9' }} />
            <p style={{ fontSize: 13.5 }}>Loading team builders from database...</p>
          </div>
        ) : filteredBuilders.length === 0 ? (
          <div style={{
            background: tokens.colors.surfaceCard, border: `1px dashed ${tokens.colors.borderLight}`,
            borderRadius: 18, padding: '48px 24px', textAlign: 'center', maxWidth: 540, margin: '0 auto'
          }}>
            <p style={{ color: tokens.colors.textSecondary, fontSize: 14, margin: '0 0 16px' }}>
              No team members match the selected filter.
            </p>
            <button
              onClick={handleOpenAdd}
              style={{
                padding: '8px 20px', borderRadius: 10, background: '#00dbe9',
                color: '#000', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer'
              }}
            >
              + Add First Member
            </button>
          </div>
        ) : (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
            gap: 20
          }}>
            {filteredBuilders.map((b) => (
              <div
                key={b.id}
                style={{
                  background: tokens.colors.surfaceCard, border: `1px solid ${tokens.colors.borderLight}`,
                  borderRadius: 18, padding: 22, display: 'flex', flexDirection: 'column',
                  justifyContent: 'space-between', position: 'relative', boxShadow: '0 4px 18px rgba(0,0,0,0.12)'
                }}
              >
                <div>
                  {/* Top Profile Row */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
                    {b.avatar ? (
                      <img
                        src={b.avatar}
                        alt={b.name}
                        style={{
                          width: 52, height: 52, borderRadius: 14,
                          objectFit: 'cover', border: '2px solid rgba(0, 219, 233, 0.4)',
                          flexShrink: 0
                        }}
                      />
                    ) : (
                      <div style={{
                        width: 52, height: 52, borderRadius: 14,
                        background: 'linear-gradient(135deg, rgba(0, 219, 233, 0.2), rgba(37, 99, 235, 0.2))',
                        border: '2px solid rgba(0, 219, 233, 0.4)', color: '#00dbe9',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 800, fontSize: 18, flexShrink: 0
                      }}>
                        {b.name ? b.name[0].toUpperCase() : 'U'}
                      </div>
                    )}

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: tokens.colors.textPrimary }}>
                        {b.name}
                      </div>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: '#00dbe9', marginTop: 1 }}>
                        {b.role}
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                          background: (b.status || '').includes('Core') ? 'rgba(52, 211, 153, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                          color: (b.status || '').includes('Core') ? '#34d399' : tokens.colors.textSecondary,
                          textTransform: 'uppercase'
                        }}>
                          {b.status || 'Core Team'}
                        </span>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                          background: 'rgba(0, 219, 233, 0.1)', color: '#00dbe9',
                          textTransform: 'uppercase'
                        }}>
                          {b.teamCategory || b.team_category || 'engineering'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bio */}
                  {b.bio && (
                    <p style={{ fontSize: 12.5, color: tokens.colors.textSecondary, lineHeight: 1.5, margin: '0 0 12px' }}>
                      {b.bio}
                    </p>
                  )}

                  {/* Contributions */}
                  {Array.isArray(b.contributions) && b.contributions.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: tokens.colors.textPrimary, textTransform: 'uppercase', marginBottom: 4 }}>
                        Key Architectural Impact:
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11.5, color: tokens.colors.textSecondary, lineHeight: 1.4 }}>
                        {b.contributions.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Skills */}
                  {Array.isArray(b.skills) && b.skills.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 16 }}>
                      {b.skills.map((skill, i) => (
                        <span
                          key={i}
                          style={{
                            fontSize: 10.5, fontWeight: 500, padding: '2px 7px',
                            borderRadius: 6, background: tokens.colors.surfaceBg,
                            border: `1px solid ${tokens.colors.borderLight}`, color: tokens.colors.textPrimary
                          }}
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card Bottom Actions & Socials */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  borderTop: `1px solid ${tokens.colors.borderLight}`, paddingTop: 12, marginTop: 6
                }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: tokens.colors.textTertiary }}>
                    {b.socials?.github && <Github size={14} />}
                    {b.socials?.linkedin && <Linkedin size={14} />}
                    {b.socials?.twitter && <Twitter size={14} />}
                    {b.socials?.instagram && <Instagram size={14} />}
                    {b.socials?.cpaUsername && (
                      <span style={{ fontSize: 11, color: '#00dbe9', fontWeight: 600 }}>
                        @{b.socials.cpaUsername}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => handleOpenEdit(b)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '6px 12px', borderRadius: 8, background: tokens.colors.surfaceBg,
                        border: `1px solid ${tokens.colors.borderLight}`, color: tokens.colors.textPrimary,
                        fontSize: 12, fontWeight: 600, cursor: 'pointer'
                      }}
                    >
                      <Edit3 size={13} />
                      <span>Edit</span>
                    </button>

                    <button
                      onClick={() => handleDeleteBuilder(b.id, b.name)}
                      style={{
                        display: 'inline-flex', alignItems: 'center',
                        padding: '6px 10px', borderRadius: 8, background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444',
                        fontSize: 12, cursor: 'pointer'
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* ── Add / Edit Builder Modal ── */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20, zIndex: 9999, backdropFilter: 'blur(5px)'
        }}>
          <div style={{
            background: tokens.colors.surfaceCard, border: `1px solid ${tokens.colors.borderLight}`,
            borderRadius: 20, maxWidth: 680, width: '100%', maxHeight: '90vh',
            overflowY: 'auto', padding: 28, boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 19, fontWeight: 800, color: tokens.colors.textPrimary, margin: 0 }}>
                {editingBuilderId ? 'Edit Team Member' : 'Add New Team Member'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: tokens.colors.textSecondary, cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {actionError && typeof actionError === 'string' && (
              <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontSize: 13, marginBottom: 16 }}>
                {actionError}
              </div>
            )}

            {/* Quick Auto-Fill from Platform User */}
            <div style={{ marginBottom: 20, padding: 14, borderRadius: 12, background: tokens.colors.surfaceBg, border: `1px solid ${tokens.colors.borderLight}` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#00dbe9', textTransform: 'uppercase', marginBottom: 6 }}>
                ⚡ Auto-Fill from Platform User:
              </div>
              <select
                onChange={(e) => {
                  const selectedUser = platformUsers.find(u => String(u.id) === e.target.value);
                  if (selectedUser) handleAutoFillUser(selectedUser);
                }}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 8,
                  background: tokens.colors.surfaceCard, border: `1px solid ${tokens.colors.borderLight}`,
                  color: tokens.colors.textPrimary, fontSize: 13
                }}
              >
                <option value="">-- Choose Registered User to Auto-Fill --</option>
                {platformUsers.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name || u.username} (@{u.username})
                  </option>
                ))}
              </select>
            </div>

            <form onSubmit={handleSaveBuilder}>
              {/* Name & Role Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: tokens.colors.textSecondary, marginBottom: 6 }}>
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Sayaji Kapse"
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: 8,
                      background: tokens.colors.surfaceBg, border: `1px solid ${tokens.colors.borderLight}`,
                      color: tokens.colors.textPrimary, fontSize: 13
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: tokens.colors.textSecondary, marginBottom: 6 }}>
                    Role Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    placeholder="e.g. Lead Systems Architect"
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: 8,
                      background: tokens.colors.surfaceBg, border: `1px solid ${tokens.colors.borderLight}`,
                      color: tokens.colors.textPrimary, fontSize: 13
                    }}
                  />
                </div>
              </div>

              {/* Category & Status Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: tokens.colors.textSecondary, marginBottom: 6 }}>
                    Team Category
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: 8,
                      background: tokens.colors.surfaceBg, border: `1px solid ${tokens.colors.borderLight}`,
                      color: tokens.colors.textPrimary, fontSize: 13
                    }}
                  >
                    <option value="founders">Founders & Core</option>
                    <option value="engineering">Engineering</option>
                    <option value="design">Design & Product</option>
                    <option value="alumni">Past Team & Alumni</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: tokens.colors.textSecondary, marginBottom: 6 }}>
                    Status Tag
                  </label>
                  <input
                    type="text"
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    placeholder="e.g. Core Team / Past Builder"
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: 8,
                      background: tokens.colors.surfaceBg, border: `1px solid ${tokens.colors.borderLight}`,
                      color: tokens.colors.textPrimary, fontSize: 13
                    }}
                  />
                </div>
              </div>

              {/* Avatar Upload / URL */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: tokens.colors.textSecondary, marginBottom: 6 }}>
                  Profile Photo (URL or File Upload)
                </label>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  {formAvatar ? (
                    <img
                      src={formAvatar}
                      alt="Preview"
                      style={{ width: 44, height: 44, borderRadius: 12, objectFit: 'cover', border: '1px solid #00dbe9' }}
                    />
                  ) : (
                    <div style={{
                      width: 44, height: 44, borderRadius: 12, background: tokens.colors.surfaceBg,
                      border: `1px solid ${tokens.colors.borderLight}`, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', color: tokens.colors.textTertiary, fontSize: 11
                    }}>
                      No Pic
                    </div>
                  )}

                  <input
                    type="text"
                    value={formAvatar}
                    onChange={(e) => setFormAvatar(e.target.value)}
                    placeholder="https://... image url"
                    style={{
                      flex: 1, padding: '9px 12px', borderRadius: 8,
                      background: tokens.colors.surfaceBg, border: `1px solid ${tokens.colors.borderLight}`,
                      color: tokens.colors.textPrimary, fontSize: 13
                    }}
                  />

                  <label style={{
                    padding: '8px 14px', borderRadius: 8, background: tokens.colors.surfaceBg,
                    border: `1px solid ${tokens.colors.borderLight}`, color: tokens.colors.textPrimary,
                    fontSize: 12, fontWeight: 600, cursor: 'pointer'
                  }}>
                    Upload
                    <input type="file" accept="image/*" onChange={handleImageFileUpload} style={{ display: 'none' }} />
                  </label>
                </div>
              </div>

              {/* Bio */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: tokens.colors.textSecondary, marginBottom: 6 }}>
                  Bio Narrative
                </label>
                <textarea
                  rows={2}
                  value={formBio}
                  onChange={(e) => setFormBio(e.target.value)}
                  placeholder="Short summary of roles and achievements..."
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: 8,
                    background: tokens.colors.surfaceBg, border: `1px solid ${tokens.colors.borderLight}`,
                    color: tokens.colors.textPrimary, fontSize: 13, resize: 'vertical'
                  }}
                />
              </div>

              {/* Contributions Bullet Points */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: tokens.colors.textSecondary }}>
                    Key Architectural Contributions (Bullet Points)
                  </label>
                  <button
                    type="button"
                    onClick={handleAddContribution}
                    style={{ fontSize: 11.5, color: '#00dbe9', background: 'transparent', border: 'none', fontWeight: 700, cursor: 'pointer' }}
                  >
                    + Add Point
                  </button>
                </div>

                {formContributions.map((point, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                    <input
                      type="text"
                      value={point}
                      onChange={(e) => handleContributionChange(idx, e.target.value)}
                      placeholder={`Contribution bullet #${idx + 1}`}
                      style={{
                        flex: 1, padding: '8px 12px', borderRadius: 8,
                        background: tokens.colors.surfaceBg, border: `1px solid ${tokens.colors.borderLight}`,
                        color: tokens.colors.textPrimary, fontSize: 12.5
                      }}
                    />
                    {formContributions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveContribution(idx)}
                        style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Skills Tags */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: tokens.colors.textSecondary, marginBottom: 6 }}>
                  Tech Stack / Skills (e.g. React, Node.js, PostgreSQL)
                </label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input
                    type="text"
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSkill();
                      }
                    }}
                    placeholder="Type skill and press Add or Enter"
                    style={{
                      flex: 1, padding: '8px 12px', borderRadius: 8,
                      background: tokens.colors.surfaceBg, border: `1px solid ${tokens.colors.borderLight}`,
                      color: tokens.colors.textPrimary, fontSize: 12.5
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddSkill}
                    style={{
                      padding: '8px 14px', borderRadius: 8, background: tokens.colors.surfaceBg,
                      border: `1px solid ${tokens.colors.borderLight}`, color: tokens.colors.textPrimary,
                      fontSize: 12, fontWeight: 600, cursor: 'pointer'
                    }}
                  >
                    Add
                  </button>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {formSkills.map((skill) => (
                    <span
                      key={skill}
                      style={{
                        fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6,
                        background: tokens.colors.surfaceBg, border: `1px solid ${tokens.colors.borderLight}`,
                        color: tokens.colors.textPrimary, display: 'inline-flex', alignItems: 'center', gap: 6
                      }}
                    >
                      <span>{skill}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSkill(skill)}
                        style={{ background: 'transparent', border: 'none', color: tokens.colors.textTertiary, cursor: 'pointer', padding: 0 }}
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Social Links */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: tokens.colors.textSecondary, marginBottom: 8 }}>
                  Verified Social Platform Links
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <input
                    type="text"
                    value={formSocials.github || ''}
                    onChange={(e) => setFormSocials({ ...formSocials, github: e.target.value })}
                    placeholder="GitHub URL"
                    style={{ padding: '8px 10px', borderRadius: 8, background: tokens.colors.surfaceBg, border: `1px solid ${tokens.colors.borderLight}`, color: tokens.colors.textPrimary, fontSize: 12 }}
                  />
                  <input
                    type="text"
                    value={formSocials.linkedin || ''}
                    onChange={(e) => setFormSocials({ ...formSocials, linkedin: e.target.value })}
                    placeholder="LinkedIn URL"
                    style={{ padding: '8px 10px', borderRadius: 8, background: tokens.colors.surfaceBg, border: `1px solid ${tokens.colors.borderLight}`, color: tokens.colors.textPrimary, fontSize: 12 }}
                  />
                  <input
                    type="text"
                    value={formSocials.twitter || ''}
                    onChange={(e) => setFormSocials({ ...formSocials, twitter: e.target.value })}
                    placeholder="X / Twitter URL"
                    style={{ padding: '8px 10px', borderRadius: 8, background: tokens.colors.surfaceBg, border: `1px solid ${tokens.colors.borderLight}`, color: tokens.colors.textPrimary, fontSize: 12 }}
                  />
                  <input
                    type="text"
                    value={formSocials.instagram || ''}
                    onChange={(e) => setFormSocials({ ...formSocials, instagram: e.target.value })}
                    placeholder="Instagram URL"
                    style={{ padding: '8px 10px', borderRadius: 8, background: tokens.colors.surfaceBg, border: `1px solid ${tokens.colors.borderLight}`, color: tokens.colors.textPrimary, fontSize: 12 }}
                  />
                  <input
                    type="text"
                    value={formSocials.cpaUsername || ''}
                    onChange={(e) => setFormSocials({ ...formSocials, cpaUsername: e.target.value })}
                    placeholder="CPA Username (e.g. sayajikapse)"
                    style={{ padding: '8px 10px', borderRadius: 8, background: tokens.colors.surfaceBg, border: `1px solid ${tokens.colors.borderLight}`, color: tokens.colors.textPrimary, fontSize: 12 }}
                  />
                  <input
                    type="email"
                    value={formSocials.email || ''}
                    onChange={(e) => setFormSocials({ ...formSocials, email: e.target.value })}
                    placeholder="Email address"
                    style={{ padding: '8px 10px', borderRadius: 8, background: tokens.colors.surfaceBg, border: `1px solid ${tokens.colors.borderLight}`, color: tokens.colors.textPrimary, fontSize: 12 }}
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    padding: '9px 18px', borderRadius: 10, background: tokens.colors.surfaceBg,
                    border: `1px solid ${tokens.colors.borderLight}`, color: tokens.colors.textSecondary,
                    fontSize: 13, fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: '9px 22px', borderRadius: 10, background: 'linear-gradient(135deg, #00dbe9, #2563eb)',
                    color: '#fff', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 6
                  }}
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  <span>{editingBuilderId ? 'Update Member' : 'Save Member'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── JSON Export / Import Modal ── */}
      {isJsonModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20, zIndex: 9999, backdropFilter: 'blur(5px)'
        }}>
          <div style={{
            background: tokens.colors.surfaceCard, border: `1px solid ${tokens.colors.borderLight}`,
            borderRadius: 20, maxWidth: 740, width: '100%', maxHeight: '90vh',
            overflowY: 'auto', padding: 28, boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <FileCode size={20} style={{ color: '#00dbe9' }} />
                <h2 style={{ fontSize: 19, fontWeight: 800, color: tokens.colors.textPrimary, margin: 0 }}>
                  builders.json Configuration & Export
                </h2>
              </div>
              <button
                onClick={() => setIsJsonModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: tokens.colors.textSecondary, cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button
                onClick={() => setJsonTab('export')}
                style={{
                  padding: '6px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600,
                  background: jsonTab === 'export' ? '#00dbe9' : tokens.colors.surfaceBg,
                  color: jsonTab === 'export' ? '#000' : tokens.colors.textSecondary,
                  border: `1px solid ${tokens.colors.borderLight}`, cursor: 'pointer'
                }}
              >
                Export / Download JSON
              </button>
              <button
                onClick={() => setJsonTab('import')}
                style={{
                  padding: '6px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600,
                  background: jsonTab === 'import' ? '#00dbe9' : tokens.colors.surfaceBg,
                  color: jsonTab === 'import' ? '#000' : tokens.colors.textSecondary,
                  border: `1px solid ${tokens.colors.borderLight}`, cursor: 'pointer'
                }}
              >
                Import & Replace JSON
              </button>
            </div>

            <textarea
              rows={14}
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 10,
                background: '#090d13', border: `1px solid ${tokens.colors.borderLight}`,
                color: '#38bdf8', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.5,
                marginBottom: 20, resize: 'vertical'
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {jsonTab === 'export' ? (
                <>
                  <button
                    onClick={handleDownloadJson}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '8px 16px', borderRadius: 8, background: tokens.colors.surfaceBg,
                      border: `1px solid ${tokens.colors.borderLight}`, color: tokens.colors.textPrimary,
                      fontSize: 12.5, fontWeight: 600, cursor: 'pointer'
                    }}
                  >
                    <Download size={15} />
                    <span>Download builders.json</span>
                  </button>

                  <button
                    onClick={handleCopyJson}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '8px 20px', borderRadius: 8, background: copied ? '#10b981' : '#00dbe9',
                      color: '#000', fontSize: 12.5, fontWeight: 700, border: 'none', cursor: 'pointer'
                    }}
                  >
                    {copied ? <CheckCircle2 size={15} /> : <Copy size={15} />}
                    <span>{copied ? 'Copied to Clipboard!' : 'Copy builders.json'}</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={handleImportJson}
                  style={{
                    marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '8px 22px', borderRadius: 8, background: '#10b981',
                    color: '#fff', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer'
                  }}
                >
                  <Upload size={15} />
                  <span>Import & Synchronize Database</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
