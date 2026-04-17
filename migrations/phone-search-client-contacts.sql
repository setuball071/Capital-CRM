-- Task #65: Incluir client_contacts (type='phone'/'telefone') na busca por telefone.
-- Idempotente. Pode rodar múltiplas vezes sem efeito colateral.

-- =============================================================
-- 1. Índice funcional sobre value normalizado p/ fallback rápido
-- =============================================================
CREATE INDEX IF NOT EXISTS idx_client_contacts_value_digits
  ON client_contacts ((regexp_replace(coalesce(value,''), '\D', '', 'g')))
  WHERE type IN ('phone', 'telefone');

-- =============================================================
-- 2. Trigger: toda inserção/atualização em client_contacts cujo
--    type seja 'phone' ou 'telefone' replica o número normalizado
--    em clientes_telefones (idempotente via ON CONFLICT).
-- =============================================================
CREATE OR REPLACE FUNCTION sync_client_contact_to_telefones()
RETURNS TRIGGER AS $$
DECLARE
  v_tel TEXT;
BEGIN
  IF NEW.type IN ('phone', 'telefone') AND NEW.value IS NOT NULL THEN
    v_tel := regexp_replace(NEW.value, '\D', '', 'g');
    IF length(v_tel) BETWEEN 10 AND 11 THEN
      INSERT INTO clientes_telefones (pessoa_id, telefone, tipo, base_tag, principal)
      VALUES (NEW.client_id, v_tel, COALESCE(NEW.label, 'telefone'), NEW.base_tag, COALESCE(NEW.is_primary, false))
      ON CONFLICT (pessoa_id, telefone) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_client_contacts_sync_telefones ON client_contacts;
CREATE TRIGGER trg_client_contacts_sync_telefones
AFTER INSERT OR UPDATE OF value, type ON client_contacts
FOR EACH ROW EXECUTE FUNCTION sync_client_contact_to_telefones();

-- =============================================================
-- 3. Backfill único: replicar client_contacts existentes p/
--    clientes_telefones (apenas type telefone/phone, 10-11 dígitos).
-- =============================================================
INSERT INTO clientes_telefones (pessoa_id, telefone, tipo, base_tag, principal)
SELECT DISTINCT
  cc.client_id,
  regexp_replace(cc.value, '\D', '', 'g') AS tel,
  COALESCE(cc.label, 'telefone'),
  COALESCE(cc.base_tag, 'backfill_client_contacts'),
  COALESCE(cc.is_primary, false)
FROM client_contacts cc
WHERE cc.type IN ('phone', 'telefone')
  AND cc.value IS NOT NULL
  AND length(regexp_replace(cc.value, '\D', '', 'g')) BETWEEN 10 AND 11
ON CONFLICT (pessoa_id, telefone) DO NOTHING;

-- Estatística final
SELECT 'client_contacts telefones' AS info,
       COUNT(*) AS valor
FROM client_contacts
WHERE type IN ('phone', 'telefone');
