CREATE TABLE IF NOT EXISTS invites (
  id TEXT PRIMARY KEY,
  sender_name TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  selected_date TEXT,
  selected_time TEXT,
  date_type TEXT,
  place TEXT,
  note TEXT,
  respondent_email TEXT,
  response_text TEXT,
  responded_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_invites_status_created
ON invites (status, created_at);