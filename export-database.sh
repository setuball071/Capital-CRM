#!/bin/bash

echo "=== Exportando banco de dados ==="
mkdir -p database_export

# Lista todas as tabelas
TABLES=$(psql $DATABASE_URL -t -c "SELECT tablename FROM pg_tables WHERE schemaname='public';")

for table in $TABLES; do
  table=$(echo $table | xargs)  # trim whitespace
  if [ ! -z "$table" ]; then
    echo "Exportando: $table"
    psql $DATABASE_URL -c "COPY $table TO STDOUT WITH CSV HEADER" > "database_export/${table}.csv" 2>/dev/null || echo "  (tabela vazia ou erro)"
  fi
done

# Exporta schema completo
echo "Exportando schema SQL..."
pg_dump $DATABASE_URL --schema-only > database_export/schema.sql 2>/dev/null

# Exporta dados completos em SQL
echo "Exportando dados em SQL..."
pg_dump $DATABASE_URL --data-only > database_export/data.sql 2>/dev/null

echo ""
echo "=== Arquivos criados em database_export/ ==="
ls -la database_export/

echo ""
echo "Pronto! A pasta database_export/ contém:"
echo "- Arquivos CSV de cada tabela"
echo "- schema.sql (estrutura do banco)"
echo "- data.sql (todos os dados)"
