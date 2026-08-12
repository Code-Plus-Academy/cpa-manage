'use client';

import { DotLottiePlayer } from '@dotlottie/react-player';
import '@dotlottie/react-player/dist/index.css';
import { tokens } from '../../app/theme/tokens';

const LOTTIE_MAP = {
  default: '/lottie/loading.lottie',
  profile: '/lottie/loading-profile.lottie',
  article: '/lottie/loading-article.lottie',
  search: '/lottie/loading-search.lottie',
  error404: '/lottie/error-404.lottie',
};

/**
 * LottieLoader Component
 * Uses dotlottie templates from Downloads: loading, loading-profile, loading-search, loading-article, error-404
 * 
 * Props:
 * - type: 'default' | 'profile' | 'article' | 'search' | 'error404'
 * - message: Text message shown under animation (e.g. "Loading Email Templates...")
 * - variant: 'card' (default) | 'fullscreen' | 'inline'
 * - size: width/height in px (default 140px for card/fullscreen, 32px for inline)
 */
export default function LottieLoader({
  type = 'default',
  message = 'Loading...',
  variant = 'card',
  size = variant === 'inline' ? 32 : 140,
}) {
  const src = LOTTIE_MAP[type] || LOTTIE_MAP.default;

  if (variant === 'inline') {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: `${size}px`, height: `${size}px` }}>
          <DotLottiePlayer src={src} autoplay loop style={{ width: '100%', height: '100%' }} />
        </div>
        {message && <span style={{ fontSize: '13px', color: tokens.colors.textMuted }}>{message}</span>}
      </div>
    );
  }

  if (variant === 'fullscreen') {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(9, 13, 22, 0.85)',
          backdropFilter: 'blur(8px)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}
      >
        <div
          style={{
            backgroundColor: tokens.colors.surfaceElevated,
            border: `1px solid ${tokens.colors.borderSubtle}`,
            borderRadius: '16px',
            padding: '32px 48px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            maxWidth: '380px',
            textAlign: 'center',
          }}
        >
          <div style={{ width: `${size}px`, height: `${size}px` }}>
            <DotLottiePlayer src={src} autoplay loop style={{ width: '100%', height: '100%' }} />
          </div>
          {message && (
            <div style={{ fontSize: '14px', fontWeight: '600', color: tokens.colors.textPrimary, letterSpacing: '-0.01em' }}>
              {message}
            </div>
          )}
          <div style={{ fontSize: '11px', color: tokens.colors.textMuted, fontFamily: 'monospace' }}>
            Code+ Academy Platform
          </div>
        </div>
      </div>
    );
  }

  // Card Variant (default for table and section loading)
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        width: '100%',
        minHeight: '220px',
        backgroundColor: 'rgba(15, 23, 42, 0.3)',
        borderRadius: '12px',
      }}
    >
      <div style={{ width: `${size}px`, height: `${size}px` }}>
        <DotLottiePlayer src={src} autoplay loop style={{ width: '100%', height: '100%' }} />
      </div>
      {message && (
        <div style={{ marginTop: '12px', fontSize: '13px', fontWeight: '600', color: tokens.colors.textMuted }}>
          {message}
        </div>
      )}
    </div>
  );
}
