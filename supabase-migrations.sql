-- =============================================
-- RepGo — SQL Migrations
-- Execute no Supabase SQL Editor
-- =============================================

-- =============================================
-- 1. TABELAS (se não existirem)
-- =============================================

-- Perfil do rep
CREATE TABLE IF NOT EXISTS perfil_rep (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  nome text,
  telefone text,
  created_at timestamptz DEFAULT now()
);

-- Planos
CREATE TABLE IF NOT EXISTS rep_planos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  status text DEFAULT 'trial' CHECK (status IN ('trial','ativo','inadimplente','cancelado')),
  vencimento date,
  observacoes_admin text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Clientes
CREATE TABLE IF NOT EXISTS clientes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nome text NOT NULL,
  cidade text,
  uf text,
  telefone text,
  email text,
  cnpj text,
  created_at timestamptz DEFAULT now()
);

-- Marcas por rep
CREATE TABLE IF NOT EXISTS marcas_rep (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nome text NOT NULL,
  comissao_padrao numeric(5,2),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, nome)
);

-- Pedidos
CREATE TABLE IF NOT EXISTS pedidos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  marca text,
  cliente_id uuid REFERENCES clientes(id) ON DELETE SET NULL,
  cliente_nome text,
  numero_pedido text,
  pares integer,
  valor_total numeric(12,2),
  comissao_percentual numeric(5,2),
  comissao_valor numeric(12,2),
  condicao_pagamento text,
  previsao_faturamento date,
  observacoes text,
  created_at timestamptz DEFAULT now()
);

-- Gastos
CREATE TABLE IF NOT EXISTS gastos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  categoria text,
  descricao text,
  valor numeric(12,2) NOT NULL,
  data date NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- =============================================
-- 2. RLS (Row Level Security)
-- =============================================

ALTER TABLE perfil_rep ENABLE ROW LEVEL SECURITY;
ALTER TABLE rep_planos ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE marcas_rep ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;

-- Policies: cada rep vê apenas seus dados
CREATE POLICY IF NOT EXISTS "perfil_rep_proprio" ON perfil_rep
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "rep_planos_proprio" ON rep_planos
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "clientes_proprio" ON clientes
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "marcas_rep_proprio" ON marcas_rep
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "pedidos_proprio" ON pedidos
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "gastos_proprio" ON gastos
  FOR ALL USING (auth.uid() = user_id);

-- =============================================
-- 3. RPCs SUPORTE (SECURITY DEFINER — bypassa RLS)
-- =============================================

-- Suporte: listar clientes de um rep
CREATE OR REPLACE FUNCTION suporte_clientes(p_user_id uuid)
RETURNS TABLE (
  id uuid, user_id uuid, nome text, cidade text, uf text,
  telefone text, email text, cnpj text, created_at timestamptz
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT c.id, c.user_id, c.nome, c.cidade, c.uf, c.telefone, c.email, c.cnpj, c.created_at
  FROM clientes c
  WHERE c.user_id = p_user_id
  ORDER BY c.nome;
$$;

GRANT EXECUTE ON FUNCTION suporte_clientes(uuid) TO authenticated;

-- Suporte: listar pedidos de um rep
CREATE OR REPLACE FUNCTION suporte_pedidos(p_user_id uuid)
RETURNS TABLE (
  id uuid, user_id uuid, marca text, cliente_id uuid, cliente_nome text,
  numero_pedido text, pares integer, valor_total numeric, comissao_percentual numeric,
  comissao_valor numeric, condicao_pagamento text, previsao_faturamento date,
  observacoes text, created_at timestamptz
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT p.id, p.user_id, p.marca, p.cliente_id, p.cliente_nome, p.numero_pedido,
         p.pares, p.valor_total, p.comissao_percentual, p.comissao_valor,
         p.condicao_pagamento, p.previsao_faturamento, p.observacoes, p.created_at
  FROM pedidos p
  WHERE p.user_id = p_user_id
  ORDER BY p.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION suporte_pedidos(uuid) TO authenticated;

-- Suporte: listar gastos de um rep
CREATE OR REPLACE FUNCTION suporte_gastos(p_user_id uuid)
RETURNS TABLE (
  id uuid, user_id uuid, categoria text, descricao text,
  valor numeric, data date, created_at timestamptz
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT g.id, g.user_id, g.categoria, g.descricao, g.valor, g.data, g.created_at
  FROM gastos g
  WHERE g.user_id = p_user_id
  ORDER BY g.data DESC;
$$;

GRANT EXECUTE ON FUNCTION suporte_gastos(uuid) TO authenticated;

-- =============================================
-- 4. RPCs ADMIN
-- =============================================

-- Admin: listar todos os reps com email
CREATE OR REPLACE FUNCTION admin_listar_reps()
RETURNS TABLE (
  user_id uuid, nome text, telefone text, email text, created_at timestamptz
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT p.user_id, p.nome, p.telefone, u.email, p.created_at
  FROM perfil_rep p
  JOIN auth.users u ON u.id = p.user_id
  ORDER BY p.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION admin_listar_reps() TO authenticated;

-- Admin: listar todos os planos
CREATE OR REPLACE FUNCTION admin_listar_planos()
RETURNS TABLE (
  user_id uuid, status text, vencimento date, observacoes_admin text
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT user_id, status, vencimento, observacoes_admin
  FROM rep_planos;
$$;

GRANT EXECUTE ON FUNCTION admin_listar_planos() TO authenticated;

-- =============================================
-- 5. Índices de performance
-- =============================================

CREATE INDEX IF NOT EXISTS idx_clientes_user ON clientes(user_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_user ON pedidos(user_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_created ON pedidos(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gastos_user ON gastos(user_id);
CREATE INDEX IF NOT EXISTS idx_gastos_data ON gastos(user_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_marcas_user ON marcas_rep(user_id);

-- =============================================
-- FIM
-- =============================================
