-- Mangrove Monitoring Center: draft logical schema v1
-- PostgreSQL 15+ and PostGIS; DESIGN ONLY, not executed or deployed.
-- Private operational data. Turn on RLS and create audited policies before frontend access.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE SCHEMA IF NOT EXISTS mmc;

CREATE TABLE IF NOT EXISTS mmc.projects (
 project_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 project_code text NOT NULL UNIQUE,
 project_name text NOT NULL,
 organization text,
 created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mmc.plots (
 plot_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id uuid NOT NULL REFERENCES mmc.projects(project_id),
 plot_code text NOT NULL,
 company text NOT NULL CHECK (company IN ('STC','VSD','EVR','OTHER')),
 province text,
 district text,
 subdistrict text,
 village text,
 program text,
 enrollment_state text NOT NULL DEFAULT 'NEEDS_RECONCILIATION'
  CHECK (enrollment_state IN ('CONFIRMED','NEEDS_RECONCILIATION','CANDIDATE','RETIRED')),
 recorded_pdd_area_rai numeric(15,4),
 recorded_department_area_rai numeric(15,4),
 planted_area_rai numeric(15,4),
 metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (project_id, plot_code)
);

CREATE TABLE IF NOT EXISTS mmc.plot_aliases (
 alias_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 plot_id uuid NOT NULL REFERENCES mmc.plots(plot_id) ON DELETE CASCADE,
 alias_original text NOT NULL,
 alias_normalized text NOT NULL,
 source_label text,
 approved boolean NOT NULL DEFAULT false,
 approval_note text,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (plot_id, alias_normalized, source_label)
);

CREATE TABLE IF NOT EXISTS mmc.data_sources (
 source_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 source_key text NOT NULL UNIQUE,
 source_type text NOT NULL, -- SHEET / SHAPEFILE / KMZ / GEE / DRIVE / FIELD / OTHER
 provider text NOT NULL,
 location_ref text, -- private, never returned in public browse endpoints
 visibility text NOT NULL DEFAULT 'RESTRICTED'
  CHECK (visibility IN ('PUBLIC','RESTRICTED','CONFIDENTIAL')),
 source_version text,
 source_checksum text,
 ingested_at timestamptz,
 metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS mmc.import_runs (
 import_run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 source_id uuid REFERENCES mmc.data_sources(source_id),
 started_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz,
 status text NOT NULL DEFAULT 'PENDING'
  CHECK (status IN ('PENDING','RUNNING','SUCCESS','PARTIAL','FAILED')),
 rows_scanned integer NOT NULL DEFAULT 0,
 rows_matched integer NOT NULL DEFAULT 0,
 rows_rejected integer NOT NULL DEFAULT 0,
 error_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
 pipeline_version text
);

CREATE TABLE IF NOT EXISTS mmc.plot_source_records (
 record_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 plot_id uuid REFERENCES mmc.plots(plot_id),
 source_id uuid NOT NULL REFERENCES mmc.data_sources(source_id),
 import_run_id uuid REFERENCES mmc.import_runs(import_run_id),
 source_row_key text NOT NULL,
 source_plot_code text,
 raw_attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
 review_state text NOT NULL DEFAULT 'UNREVIEWED'
  CHECK (review_state IN ('UNREVIEWED','MATCHED','CONFLICT','REJECTED')),
 UNIQUE (source_id, source_row_key)
);

CREATE TABLE IF NOT EXISTS mmc.plot_boundaries (
 boundary_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 plot_id uuid NOT NULL REFERENCES mmc.plots(plot_id) ON DELETE CASCADE,
 source_id uuid REFERENCES mmc.data_sources(source_id),
 boundary_type text NOT NULL
  CHECK (boundary_type IN ('PDD','DEPARTMENT_CONFIRMED','FIELD_SURVEY','PLANTED','DRAFT','OTHER')),
 boundary_label text,
 geom geometry(MultiPolygon,4326),
 original_srid integer,
 source_version text,
 source_area_rai numeric(15,4),
 calculated_area_rai numeric(15,4),
 effective_from date,
 effective_to date,
 is_current boolean NOT NULL DEFAULT false,
 quality_state text NOT NULL DEFAULT 'UNREVIEWED'
  CHECK (quality_state IN ('UNREVIEWED','VERIFIED','CONFLICT','INVALID','DRAFT')),
 verified_at timestamptz,
 review_note text,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT mmc_boundary_valid CHECK (geom IS NULL OR ST_IsValid(geom))
);
CREATE INDEX IF NOT EXISTS idx_mmc_boundaries_geom ON mmc.plot_boundaries USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_mmc_boundaries_plot ON mmc.plot_boundaries (plot_id, boundary_type, quality_state);
CREATE UNIQUE INDEX IF NOT EXISTS uq_mmc_current_boundary_by_type
 ON mmc.plot_boundaries(plot_id, boundary_type)
 WHERE is_current AND quality_state='VERIFIED';

CREATE TABLE IF NOT EXISTS mmc.satellite_scenes (
 scene_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 sensor text NOT NULL, -- Sentinel-2 / Landsat 8-9 / Sentinel-1 ...
 product_id text NOT NULL,
 acquisition_at timestamptz NOT NULL,
 tile_id text,
 processing_level text,
 cloud_cover_scene_pct numeric(5,2),
 metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
 UNIQUE (sensor, product_id)
);
CREATE INDEX IF NOT EXISTS idx_mmc_scenes_dates ON mmc.satellite_scenes(acquisition_at DESC);

CREATE TABLE IF NOT EXISTS mmc.satellite_assets (
 asset_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 scene_id uuid NOT NULL REFERENCES mmc.satellite_scenes(scene_id),
 plot_id uuid REFERENCES mmc.plots(plot_id),
 source_id uuid REFERENCES mmc.data_sources(source_id),
 band_role text NOT NULL, -- 10m / 20m / QA / truecolor / falsecolor / preview / COG
 provider text NOT NULL,
 provider_file_id text,
 object_key text, -- private storage path
 original_name text,
 crs_epsg integer,
 pixel_size_m numeric(10,3),
 band_manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
 size_bytes bigint,
 checksum_sha256 text,
 asset_status text NOT NULL DEFAULT 'INVENTORIED'
  CHECK (asset_status IN ('INVENTORIED','AVAILABLE','MISSING','DOWNLOAD_FAILED','INVALID')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mmc_asset_scene_plot ON mmc.satellite_assets(scene_id,plot_id);

CREATE TABLE IF NOT EXISTS mmc.analysis_runs (
 analysis_run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 algorithm text NOT NULL,
 algorithm_version text NOT NULL,
 started_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz,
 pipeline_commit text,
 status text NOT NULL DEFAULT 'PENDING',
 parameters jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS mmc.plot_observations (
 observation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 plot_id uuid NOT NULL REFERENCES mmc.plots(plot_id),
 scene_id uuid NOT NULL REFERENCES mmc.satellite_scenes(scene_id),
 boundary_id uuid NOT NULL REFERENCES mmc.plot_boundaries(boundary_id),
 analysis_run_id uuid NOT NULL REFERENCES mmc.analysis_runs(analysis_run_id),
 qa_state text NOT NULL CHECK (qa_state IN ('AUTO_VALID','PARTIAL','NO_DATA','NOT_ANALYZED')),
 qa_valid_pct numeric(5,2) CHECK (qa_valid_pct BETWEEN 0 AND 100),
 valid_pixels integer,
 total_pixels integer,
 computed_at timestamptz NOT NULL DEFAULT now(),
 analysis_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
 UNIQUE (plot_id, scene_id, boundary_id, analysis_run_id)
);
CREATE INDEX IF NOT EXISTS idx_mmc_obs_plot_scene ON mmc.plot_observations(plot_id,scene_id);
CREATE INDEX IF NOT EXISTS idx_mmc_obs_qa ON mmc.plot_observations(qa_state);

CREATE TABLE IF NOT EXISTS mmc.observation_metrics (
 observation_id uuid NOT NULL REFERENCES mmc.plot_observations(observation_id) ON DELETE CASCADE,
 metric_code text NOT NULL, -- NDVI / NDRE / NDMI / MNDWI / WATER_RAI / ...
 metric_value double precision,
 unit text,
 valid_area_rai numeric(15,4),
 method_version text,
 PRIMARY KEY (observation_id, metric_code),
 CHECK (metric_value IS NULL OR isfinite(metric_value))
);

CREATE TABLE IF NOT EXISTS mmc.change_events (
 change_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 plot_id uuid NOT NULL REFERENCES mmc.plots(plot_id),
 previous_observation_id uuid NOT NULL REFERENCES mmc.plot_observations(observation_id),
 current_observation_id uuid NOT NULL REFERENCES mmc.plot_observations(observation_id),
 comparable_clear_area_rai numeric(15,4),
 new_water_rai numeric(15,4),
 lost_water_rai numeric(15,4),
 vegetation_change_rai numeric(15,4),
 soil_change_rai numeric(15,4),
 tide_adjustment_state text NOT NULL DEFAULT 'NOT_EVALUATED',
 interpretation_state text NOT NULL DEFAULT 'UNREVIEWED',
 algorithm_version text NOT NULL,
 UNIQUE (plot_id, previous_observation_id, current_observation_id, algorithm_version)
);

CREATE TABLE IF NOT EXISTS mmc.field_surveys (
 survey_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 plot_id uuid REFERENCES mmc.plots(plot_id),
 source_id uuid REFERENCES mmc.data_sources(source_id),
 survey_at timestamptz NOT NULL,
 survey_type text NOT NULL, -- survival / species / canopy / patrol / validation
 survey_point geometry(Point,4326),
 sample_area_rai numeric(12,4),
 tree_count integer,
 survival_pct numeric(5,2),
 evidence_ref text, -- private
 verified boolean NOT NULL DEFAULT false,
 attributes jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_mmc_field_geom ON mmc.field_surveys USING GIST (survey_point);

CREATE TABLE IF NOT EXISTS mmc.alerts (
 alert_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 plot_id uuid NOT NULL REFERENCES mmc.plots(plot_id),
 observation_id uuid REFERENCES mmc.plot_observations(observation_id),
 alert_type text NOT NULL,
 risk_severity text NOT NULL CHECK (risk_severity IN ('INFO','WATCH','HIGH','CRITICAL')),
 review_state text NOT NULL DEFAULT 'CANDIDATE'
  CHECK (review_state IN ('CANDIDATE','IN_REVIEW','VERIFIED','REJECTED','CLOSED')),
 rule_version text NOT NULL,
 evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 resolved_at timestamptz
);

CREATE TABLE IF NOT EXISTS mmc.boundary_review_queue (
 task_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 plot_id uuid REFERENCES mmc.plots(plot_id),
 boundary_id uuid REFERENCES mmc.plot_boundaries(boundary_id),
 issue_code text NOT NULL,
 details jsonb NOT NULL DEFAULT '{}'::jsonb,
 review_state text NOT NULL DEFAULT 'OPEN',
 created_at timestamptz NOT NULL DEFAULT now(),
 decided_at timestamptz
);

-- Security default: deny frontend access until owner-authenticated RLS policies
-- and service-API endpoints are explicitly written, tested and approved.
ALTER TABLE mmc.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.plots ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.plot_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.import_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.plot_source_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.plot_boundaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.satellite_scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.satellite_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.analysis_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.plot_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.observation_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.change_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.field_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE mmc.boundary_review_queue ENABLE ROW LEVEL SECURITY;

-- NO RLS policies, API credentials, or user grants defined in this blueprint.
-- IMPORTANT: This migration is a design draft. Review user roles, ownership,
-- source privacy, and real data before applying to a production database.
