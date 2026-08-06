-- hiring_positions: job/intern positions
CREATE TABLE IF NOT EXISTS hiring_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  department VARCHAR(120) NOT NULL,
  type VARCHAR(30) NOT NULL DEFAULT 'intern',  -- intern | full-time | contract
  status VARCHAR(30) NOT NULL DEFAULT 'draft', -- draft | upcoming | open | closed
  description TEXT NOT NULL DEFAULT '',
  openings INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hiring_positions_status ON hiring_positions(status);

-- hiring_candidates: applicant contact info
CREATE TABLE IF NOT EXISTS hiring_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(30),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hiring_candidates_email ON hiring_candidates(email);

-- hiring_applications: links candidate to position
CREATE TABLE IF NOT EXISTS hiring_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES hiring_candidates(id),
  position_id UUID NOT NULL REFERENCES hiring_positions(id),
  status VARCHAR(30) NOT NULL DEFAULT 'applied', -- applied | in_review | interview | approved | rejected
  resume_url TEXT NOT NULL,
  notes TEXT,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hiring_applications_candidate ON hiring_applications(candidate_id);
CREATE INDEX IF NOT EXISTS idx_hiring_applications_position ON hiring_applications(position_id);
CREATE INDEX IF NOT EXISTS idx_hiring_applications_status ON hiring_applications(status);

-- hiring_messages: chat between admin and candidate per application
CREATE TABLE IF NOT EXISTS hiring_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES hiring_applications(id) ON DELETE CASCADE,
  sender_role VARCHAR(20) NOT NULL, -- admin | candidate
  sender_id VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hiring_messages_application ON hiring_messages(application_id);

-- hiring_intern_tasks: tasks assigned to approved interns
CREATE TABLE IF NOT EXISTS hiring_intern_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES hiring_applications(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending', -- pending | in_progress | done
  due_date TIMESTAMPTZ,
  progress INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hiring_intern_tasks_application ON hiring_intern_tasks(application_id);
