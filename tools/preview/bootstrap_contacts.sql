-- PREVIEW ONLY: bootstrap de la D1 aislada solaz-contactos-preview.
-- No ejecutar contra Production ni ubicar dentro de migrations/.

CREATE TABLE contacts (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  form_type TEXT NOT NULL CHECK (form_type IN ('mensaje', 'reunion')),
  nombre TEXT NOT NULL,
  empresa TEXT,
  email TEXT NOT NULL,
  telefono TEXT,
  mensaje TEXT,
  presupuesto TEXT,
  consent_marketing INTEGER NOT NULL DEFAULT 0,
  dias TEXT,
  horario TEXT,
  origen_url TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (sync_status IN ('pending', 'syncing', 'synced', 'failed')),
  notion_page_id TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  synced_at TEXT,
  alerted INTEGER NOT NULL DEFAULT 0,
  service_code TEXT,
  source_page TEXT,
  case_id TEXT,
  cta_id TEXT
);

CREATE INDEX idx_contacts_sync_status ON contacts (sync_status);
CREATE INDEX idx_contacts_created_at ON contacts (created_at);
