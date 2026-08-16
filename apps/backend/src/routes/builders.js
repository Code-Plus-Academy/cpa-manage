/**
 * Admin Builders / Team Management Router — cpa-manage-backend.
 * Full CRUD, JSON export/import, and user auto-fill for Team & Builders.
 */
const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { writeAuditLog } = require('../middleware/auditLog');

const DEFAULT_BUILDERS = [
  {
    id: 'sayaji-kapse',
    name: 'Sayaji Kapse',
    role: 'Founder & Lead Systems Architect',
    team_category: 'founders',
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
    },
    display_order: 1
  },
  {
    id: 'atharva-kapse',
    name: 'Atharva Kapse',
    role: 'Founding Engineer & Full Stack Lead',
    team_category: 'engineering',
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
    },
    display_order: 2
  },
  {
    id: 'priya-sharma',
    name: 'Priya Sharma',
    role: 'Product Designer & UI/UX Architect',
    team_category: 'design',
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
    },
    display_order: 3
  },
  {
    id: 'rahul-verma',
    name: 'Rahul Verma',
    role: 'Backend & Cloud Infrastructure Engineer',
    team_category: 'engineering',
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
    },
    display_order: 4
  },
  {
    id: 'amit-patel',
    name: 'Amit Patel',
    role: 'Campus Tech Lead & Community Architect',
    team_category: 'founders',
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
    },
    display_order: 5
  }
];

async function ensureTable() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS team_builders (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        team_category TEXT NOT NULL DEFAULT 'engineering',
        status TEXT NOT NULL DEFAULT 'Core Team',
        avatar TEXT,
        bio TEXT,
        contributions JSONB DEFAULT '[]'::jsonb,
        skills JSONB DEFAULT '[]'::jsonb,
        socials JSONB DEFAULT '{}'::jsonb,
        display_order INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Check if table is empty, if so seed defaults
    const countRes = await query(`SELECT COUNT(*) AS count FROM team_builders`);
    const count = parseInt(countRes.rows[0]?.count || '0', 10);
    if (count === 0) {
      for (const b of DEFAULT_BUILDERS) {
        await query(`
          INSERT INTO team_builders (id, name, role, team_category, status, avatar, bio, contributions, skills, socials, display_order)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (id) DO NOTHING
        `, [
          b.id,
          b.name,
          b.role,
          b.team_category,
          b.status,
          b.avatar || '',
          b.bio || '',
          JSON.stringify(b.contributions || []),
          JSON.stringify(b.skills || []),
          JSON.stringify(b.socials || {}),
          b.display_order || 0
        ]);
      }
    }
  } catch (err) {
    console.warn('[team_builders init warning]', err.message);
  }
}

// ── GET /admin/builders — List all builders ───────────────────────────────────
router.get('/', async (req, res) => {
  try {
    await ensureTable();
    const { rows } = await query(`
      SELECT 
        id, name, role, 
        team_category AS "teamCategory", 
        status, avatar, bio, 
        contributions, skills, socials, 
        display_order, created_at, updated_at
      FROM team_builders
      ORDER BY display_order ASC, created_at ASC
    `);

    res.json({ builders: rows });
  } catch (err) {
    console.error('[GET /admin/builders]', err);
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', builders: [] });
  }
});

// ── POST /admin/builders — Add new builder ────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    await ensureTable();
    const {
      id, name, role, teamCategory, status, avatar, bio, contributions, skills, socials, display_order
    } = req.body;

    if (!name || !role) {
      return res.status(400).json({ error: 'Name and Role are required' });
    }

    const generatedId = id || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `builder-${Date.now()}`;

    const { rows } = await query(`
      INSERT INTO team_builders (
        id, name, role, team_category, status, avatar, bio, contributions, skills, socials, display_order, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        role = EXCLUDED.role,
        team_category = EXCLUDED.team_category,
        status = EXCLUDED.status,
        avatar = EXCLUDED.avatar,
        bio = EXCLUDED.bio,
        contributions = EXCLUDED.contributions,
        skills = EXCLUDED.skills,
        socials = EXCLUDED.socials,
        display_order = EXCLUDED.display_order,
        updated_at = NOW()
      RETURNING *
    `, [
      generatedId,
      name.trim(),
      role.trim(),
      teamCategory || 'engineering',
      status || 'Core Team',
      avatar || '',
      bio || '',
      JSON.stringify(Array.isArray(contributions) ? contributions : []),
      JSON.stringify(Array.isArray(skills) ? skills : []),
      JSON.stringify(socials || {}),
      parseInt(display_order || 0, 10)
    ]);

    writeAuditLog({
      admin_id: req.admin?.id,
      action: 'BUILDER_CREATED',
      target_type: 'builder',
      target_id: generatedId,
      details: { name, role, teamCategory }
    });

    res.json({ success: true, builder: rows[0] });
  } catch (err) {
    console.error('[POST /admin/builders]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /admin/builders/:id — Update existing builder ─────────────────────────
router.put('/:id', async (req, res) => {
  try {
    await ensureTable();
    const { id } = req.params;
    const {
      name, role, teamCategory, status, avatar, bio, contributions, skills, socials, display_order
    } = req.body;

    const { rows } = await query(`
      UPDATE team_builders SET
        name = COALESCE($2, name),
        role = COALESCE($3, role),
        team_category = COALESCE($4, team_category),
        status = COALESCE($5, status),
        avatar = COALESCE($6, avatar),
        bio = COALESCE($7, bio),
        contributions = COALESCE($8, contributions),
        skills = COALESCE($9, skills),
        socials = COALESCE($10, socials),
        display_order = COALESCE($11, display_order),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [
      id,
      name,
      role,
      teamCategory,
      status,
      avatar,
      bio,
      contributions ? JSON.stringify(contributions) : null,
      skills ? JSON.stringify(skills) : null,
      socials ? JSON.stringify(socials) : null,
      display_order !== undefined ? parseInt(display_order, 10) : null
    ]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Builder not found' });
    }

    writeAuditLog({
      admin_id: req.admin?.id,
      action: 'BUILDER_UPDATED',
      target_type: 'builder',
      target_id: id,
      details: { name, role }
    });

    res.json({ success: true, builder: rows[0] });
  } catch (err) {
    console.error('[PUT /admin/builders/:id]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /admin/builders/:id — Remove builder ───────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    await ensureTable();
    const { id } = req.params;
    await query(`DELETE FROM team_builders WHERE id = $1`, [id]);

    writeAuditLog({
      admin_id: req.admin?.id,
      action: 'BUILDER_DELETED',
      target_type: 'builder',
      target_id: id,
    });

    res.json({ success: true, message: 'Builder removed' });
  } catch (err) {
    console.error('[DELETE /admin/builders/:id]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /admin/builders/import-json — Import/Replace full JSON list ───────────
router.post('/import-json', async (req, res) => {
  try {
    await ensureTable();
    const { builders } = req.body;
    if (!Array.isArray(builders)) {
      return res.status(400).json({ error: 'Expected an array of builders' });
    }

    // Replace table contents safely in transaction
    await query(`DELETE FROM team_builders`);

    for (let idx = 0; idx < builders.length; idx++) {
      const b = builders[idx];
      const id = b.id || b.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || `builder-${idx + 1}`;
      await query(`
        INSERT INTO team_builders (id, name, role, team_category, status, avatar, bio, contributions, skills, socials, display_order)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        id,
        b.name || 'Team Member',
        b.role || 'Contributor',
        b.teamCategory || b.team_category || 'engineering',
        b.status || 'Core Team',
        b.avatar || '',
        b.bio || '',
        JSON.stringify(Array.isArray(b.contributions) ? b.contributions : []),
        JSON.stringify(Array.isArray(b.skills) ? b.skills : []),
        JSON.stringify(b.socials || {}),
        idx + 1
      ]);
    }

    writeAuditLog({
      admin_id: req.admin?.id,
      action: 'BUILDERS_JSON_IMPORTED',
      target_type: 'builders',
      details: { count: builders.length }
    });

    res.json({ success: true, count: builders.length });
  } catch (err) {
    console.error('[POST /admin/builders/import-json]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
