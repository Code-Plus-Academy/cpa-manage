/**
 * Deep Slate Professional Design Tokens — manage.codeplusacademy.in
 * Derived from Stitch MCP Asset: assets/ed4bc9e7514b42b39c4196195d5a88f7
 * Screen reference: screens/304d5fc64d2540f8b69c58ae1d539495
 */

export const tokens = {
  colors: {
    // Base Layers
    bgDark: '#090D16',         // Level 0 (Base background)
    surfaceElevated: '#111827', // Level 1 (Card / Data Table surface)
    surfaceOverlay: '#1F2937',  // Level 2 (Modal / Popover surface)
    surfaceBright: '#2C3545',   // Level 3 (Hover state / Highlighted input)
    borderSubtle: '#1E293B',    // Subtle 1px borders
    borderFocus: '#7C3AED',     // Active / Focus border color

    // Brand & Primary Accent
    primary: '#7C3AED',         // Solid Purple Accent
    primaryHover: '#6D28D9',    // Purple Hover
    primaryGlow: 'rgba(124, 58, 237, 0.35)',

    // Typography & Content Colors
    textPrimary: '#F8FAFC',     // Headings & Primary Text
    textSecondary: '#94A3B8',   // Labels & Secondary Text
    textMuted: '#64748B',       // Muted / Section Header Text

    // Semantic Status Colors (Mapping for StatusPill)
    status: {
      open: { bg: 'rgba(59, 130, 246, 0.15)', text: '#60A5FA', border: 'rgba(59, 130, 246, 0.3)' },
      pending: { bg: 'rgba(59, 130, 246, 0.15)', text: '#60A5FA', border: 'rgba(59, 130, 246, 0.3)' },
      
      under_review: { bg: 'rgba(245, 158, 11, 0.15)', text: '#FBBF24', border: 'rgba(245, 158, 11, 0.3)' },
      acknowledged: { bg: 'rgba(245, 158, 11, 0.15)', text: '#FBBF24', border: 'rgba(245, 158, 11, 0.3)' },

      action_taken: { bg: 'rgba(239, 68, 68, 0.15)', text: '#F87171', border: 'rgba(239, 68, 68, 0.3)' },
      approved: { bg: 'rgba(124, 58, 237, 0.15)', text: '#A78BFA', border: 'rgba(124, 58, 237, 0.3)' },
      removed: { bg: 'rgba(239, 68, 68, 0.15)', text: '#F87171', border: 'rgba(239, 68, 68, 0.3)' },

      dismissed: { bg: 'rgba(100, 116, 139, 0.15)', text: '#94A3B8', border: 'rgba(100, 116, 139, 0.3)' },
      rejected: { bg: 'rgba(100, 116, 139, 0.15)', text: '#94A3B8', border: 'rgba(100, 116, 139, 0.3)' },

      closed: { bg: 'rgba(16, 185, 129, 0.15)', text: '#34D399', border: 'rgba(16, 185, 129, 0.3)' },
      restored: { bg: 'rgba(16, 185, 129, 0.15)', text: '#34D399', border: 'rgba(16, 185, 129, 0.3)' },
    }
  },

  // 8px Spacing Scale
  spacing: {
    unit1: '4px',
    unit2: '8px',
    unit3: '12px',
    unit4: '16px',
    unit6: '24px',
    unit8: '32px',
    unit12: '48px',
  },

  // Typography Scale
  typography: {
    title: { fontSize: '20px', fontWeight: '700', lineHeight: '28px' },
    sectionHeader: { fontSize: '11px', fontWeight: '700', lineHeight: '16px', letterSpacing: '0.05em', textTransform: 'uppercase' },
    body: { fontSize: '14px', fontWeight: '400', lineHeight: '20px' },
    small: { fontSize: '13px', fontWeight: '400', lineHeight: '18px' },
    mono: { fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }
  }
};
