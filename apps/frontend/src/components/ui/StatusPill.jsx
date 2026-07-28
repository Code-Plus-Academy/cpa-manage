'use client';

import React from 'react';
import { tokens } from '../../app/theme/tokens';

export default function StatusPill({ status }) {
  const normalizedStatus = (status || 'open').toLowerCase().replace(/\s+/g, '_');
  const styleConfig = tokens.colors.status[normalizedStatus] || tokens.colors.status.open;

  const formattedText = (status || 'Open')
    .replace(/_/g, ' ')
    .toUpperCase();

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '3px 10px',
        borderRadius: '9999px',
        fontSize: '11px',
        fontWeight: '700',
        letterSpacing: '0.04em',
        backgroundColor: styleConfig.bg,
        color: styleConfig.text,
        border: `1px solid ${styleConfig.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: styleConfig.text,
        }}
      />
      {formattedText}
    </span>
  );
}
