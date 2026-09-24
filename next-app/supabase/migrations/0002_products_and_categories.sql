-- 1. Tabela de Categorias
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(trim(name)) >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Tabela de Produtos
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) >= 1),
  barcode TEXT,
  price_in_cents INTEGER NOT NULL CHECK (price_in_cents >= 0),
  cost_in_cents INTEGER DEFAULT 0 CHECK (cost_in_cents >= 0),
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  min_stock_quantity INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para buscas rápidas (por empresa, código de barras e nome)
CREATE INDEX categories_company_id_idx ON public.categories(company_id);
CREATE INDEX products_company_id_idx ON public.products(company_id);
CREATE INDEX products_barcode_idx ON public.products(barcode);

-- Triggers para atualizar o campo updated_at automaticamente
CREATE TRIGGER categories_set_updated_at 
  BEFORE UPDATE ON public.categories 
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER products_set_updated_at 
  BEFORE UPDATE ON public.products 
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Políticas de Segurança (Apenas membros da empresa podem ler/escrever)
CREATE POLICY "Membros podem ver categorias da sua empresa" 
  ON public.categories FOR SELECT TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members 
      WHERE company_members.company_id = categories.company_id 
        AND company_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Membros podem inserir/atualizar categorias na sua empresa" 
  ON public.categories FOR ALL TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members 
      WHERE company_members.company_id = categories.company_id 
        AND company_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Membros podem ver produtos da sua empresa" 
  ON public.products FOR SELECT TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members 
      WHERE company_members.company_id = products.company_id 
        AND company_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Membros podem gerir produtos da sua empresa" 
  ON public.products FOR ALL TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members 
      WHERE company_members.company_id = products.company_id 
        AND company_members.user_id = auth.uid()
    )
  );