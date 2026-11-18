-- Links between company tables must stay inside one company.
-- Every foreign key from a company table to another company table gets a trigger that refuses a row
-- pointing at a different company's record (rows of the "platform" company are shared and allowed).
-- Reads are already limited per company in the app; this closes writes like "consultantId = <another
-- company's consultant>" at the database itself.

CREATE OR REPLACE FUNCTION same_company_check() RETURNS trigger AS $$
DECLARE
  parent_table text := TG_ARGV[0];
  fk_column    text := TG_ARGV[1];
  parent_key   text := TG_ARGV[2];
  ref          text;
  parent_company text;
BEGIN
  EXECUTE format('SELECT ($1).%I::text', fk_column) USING NEW INTO ref;
  IF ref IS NULL THEN
    RETURN NEW;
  END IF;
  EXECUTE format('SELECT "companyId" FROM %I WHERE %I::text = $1', parent_table, parent_key) USING ref INTO parent_company;
  IF parent_company IS NOT NULL AND parent_company <> NEW."companyId" AND parent_company <> 'platform' THEN
    RAISE EXCEPTION 'Cross-company link refused: %.% points at another company''s % row', TG_TABLE_NAME, fk_column, parent_table
      USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- (Re)creates the triggers for every single-column foreign key between two tables that both have
-- "companyId". Run again after a migration adds a new relation: SELECT install_same_company_triggers();
CREATE OR REPLACE FUNCTION install_same_company_triggers() RETURNS integer AS $$
DECLARE
  fk record;
  n integer := 0;
BEGIN
  FOR fk IN
    SELECT c.conname, cl.relname AS child, a.attname AS col, pcl.relname AS parent, pa.attname AS pcol
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    JOIN pg_class pcl ON pcl.oid = c.confrelid
    JOIN pg_namespace ns ON ns.oid = cl.relnamespace AND ns.nspname = 'public'
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    JOIN pg_attribute pa ON pa.attrelid = c.confrelid AND pa.attnum = c.confkey[1]
    WHERE c.contype = 'f' AND array_length(c.conkey, 1) = 1
      AND a.attname <> 'companyId'
      AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = cl.relname AND column_name = 'companyId')
      AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = pcl.relname AND column_name = 'companyId')
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', 'same_company_' || fk.conname, fk.child);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE OF %I, "companyId" ON %I FOR EACH ROW EXECUTE FUNCTION same_company_check(%L, %L, %L)',
      'same_company_' || fk.conname, fk.col, fk.child, fk.parent, fk.col, fk.pcol
    );
    n := n + 1;
  END LOOP;
  RETURN n;
END
$$ LANGUAGE plpgsql;

SELECT install_same_company_triggers();
