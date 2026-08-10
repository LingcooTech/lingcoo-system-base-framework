CREATE TABLE IF NOT EXISTS app_example_items (
  id bigserial PRIMARY KEY,
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
