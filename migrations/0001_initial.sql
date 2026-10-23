-- DaDaDa initial schema

CREATE TABLE providers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    homepage_url TEXT NOT NULL,
    status_url TEXT,
    icon_url TEXT,
    supports_status INTEGER NOT NULL DEFAULT 0,
    supports_security INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE provider_statuses (
    provider_id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    message TEXT,
    checked_at TEXT NOT NULL,
    raw_json TEXT,

    FOREIGN KEY(provider_id)
      REFERENCES providers(id)
);

CREATE TABLE incidents (
    id TEXT PRIMARY KEY,
    provider_id TEXT,
    kind TEXT NOT NULL,
    source TEXT NOT NULL,
    external_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    url TEXT NOT NULL,
    status TEXT,
    severity TEXT,
    product TEXT,
    ecosystem TEXT,
    cves_json TEXT,
    started_at TEXT,
    published_at TEXT NOT NULL,
    updated_at TEXT,
    resolved_at TEXT,
    collected_at TEXT NOT NULL,
    raw_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_record_at TEXT NOT NULL,

    FOREIGN KEY(provider_id)
      REFERENCES providers(id)
);

CREATE UNIQUE INDEX idx_incident_source_external
ON incidents(source, external_id)
WHERE external_id IS NOT NULL;

CREATE INDEX idx_incident_published
ON incidents(published_at DESC);

CREATE INDEX idx_incident_kind_published
ON incidents(kind, published_at DESC);

CREATE INDEX idx_incident_provider_published
ON incidents(provider_id, published_at DESC);
