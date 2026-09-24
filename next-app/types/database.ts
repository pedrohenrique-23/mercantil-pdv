export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Timestamp = string;
type UUID = string;

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<
        {
          id: UUID;
          email: string | null;
          full_name: string | null;
          role: Database["public"]["Enums"]["profile_role"];
          created_at: Timestamp;
          updated_at: Timestamp;
        },
        {
          id: UUID;
          email?: string | null;
          full_name?: string | null;
          role?: Database["public"]["Enums"]["profile_role"];
          created_at?: Timestamp;
          updated_at?: Timestamp;
        }
      >;
      companies: Table<
        {
          id: UUID;
          name: string;
          created_by: UUID;
          created_at: Timestamp;
          updated_at: Timestamp;
        },
        {
          id?: UUID;
          name: string;
          created_by: UUID;
          created_at?: Timestamp;
          updated_at?: Timestamp;
        }
      >;
      company_members: Table<
        {
          company_id: UUID;
          user_id: UUID;
          role: Database["public"]["Enums"]["company_member_role"];
          created_at: Timestamp;
        },
        {
          company_id: UUID;
          user_id: UUID;
          role?: Database["public"]["Enums"]["company_member_role"];
          created_at?: Timestamp;
        }
      >;
      categories: Table<
        {
          id: UUID;
          company_id: UUID;
          name: string;
          is_active: boolean;
          created_by: UUID;
          created_at: Timestamp;
          updated_at: Timestamp;
        },
        {
          id?: UUID;
          company_id: UUID;
          name: string;
          is_active?: boolean;
          created_by: UUID;
          created_at?: Timestamp;
          updated_at?: Timestamp;
        }
      >;
      products: Table<
        {
          id: UUID;
          company_id: UUID;
          category_id: UUID | null;
          name: string;
          barcode: string | null;
          sku: string | null;
          unit: Database["public"]["Enums"]["product_unit"];
          cost_cents: number;
          sale_cents: number;
          stock_quantity: number;
          min_stock_quantity: number;
          is_active: boolean;
          created_by: UUID;
          created_at: Timestamp;
          updated_at: Timestamp;
        },
        {
          id?: UUID;
          company_id: UUID;
          category_id?: UUID | null;
          name: string;
          barcode?: string | null;
          sku?: string | null;
          unit?: Database["public"]["Enums"]["product_unit"];
          cost_cents?: number;
          sale_cents: number;
          stock_quantity?: number;
          min_stock_quantity?: number;
          is_active?: boolean;
          created_by: UUID;
          created_at?: Timestamp;
          updated_at?: Timestamp;
        }
      >;
      customers: Table<
        {
          id: UUID;
          company_id: UUID;
          name: string;
          phone: string | null;
          document: string | null;
          credit_limit_cents: number;
          is_active: boolean;
          created_by: UUID;
          created_at: Timestamp;
          updated_at: Timestamp;
        },
        {
          id?: UUID;
          company_id: UUID;
          name: string;
          phone?: string | null;
          document?: string | null;
          credit_limit_cents?: number;
          is_active?: boolean;
          created_by: UUID;
          created_at?: Timestamp;
          updated_at?: Timestamp;
        }
      >;
      cash_registers: Table<
        {
          id: UUID;
          company_id: UUID;
          opened_by: UUID;
          closed_by: UUID | null;
          status: Database["public"]["Enums"]["cash_register_status"];
          opening_cents: number;
          expected_cents: number | null;
          counted_cents: number | null;
          difference_cents: number | null;
          opened_at: Timestamp;
          closed_at: Timestamp | null;
          notes: string | null;
        },
        {
          id?: UUID;
          company_id: UUID;
          opened_by: UUID;
          closed_by?: UUID | null;
          status?: Database["public"]["Enums"]["cash_register_status"];
          opening_cents?: number;
          expected_cents?: number | null;
          counted_cents?: number | null;
          difference_cents?: number | null;
          opened_at?: Timestamp;
          closed_at?: Timestamp | null;
          notes?: string | null;
        }
      >;
      sales: Table<
        {
          id: UUID;
          company_id: UUID;
          cash_register_id: UUID | null;
          operator_id: UUID;
          customer_id: UUID | null;
          status: Database["public"]["Enums"]["sale_status"];
          subtotal_cents: number;
          discount_cents: number;
          total_cents: number;
          cancelled_at: Timestamp | null;
          cancelled_by: UUID | null;
          created_at: Timestamp;
        },
        {
          id?: UUID;
          company_id: UUID;
          cash_register_id?: UUID | null;
          operator_id: UUID;
          customer_id?: UUID | null;
          status?: Database["public"]["Enums"]["sale_status"];
          subtotal_cents: number;
          discount_cents?: number;
          total_cents: number;
          cancelled_at?: Timestamp | null;
          cancelled_by?: UUID | null;
          created_at?: Timestamp;
        }
      >;
      sale_items: Table<
        {
          id: UUID;
          sale_id: UUID;
          product_id: UUID;
          product_name: string;
          quantity: number;
          unit_price_cents: number;
          discount_cents: number;
          total_cents: number;
        },
        {
          id?: UUID;
          sale_id: UUID;
          product_id: UUID;
          product_name: string;
          quantity: number;
          unit_price_cents: number;
          discount_cents?: number;
          total_cents: number;
        }
      >;
      payments: Table<
        {
          id: UUID;
          company_id: UUID;
          sale_id: UUID;
          method: Database["public"]["Enums"]["payment_method"];
          status: Database["public"]["Enums"]["payment_status"];
          amount_cents: number;
          created_by: UUID;
          created_at: Timestamp;
        },
        {
          id?: UUID;
          company_id: UUID;
          sale_id: UUID;
          method: Database["public"]["Enums"]["payment_method"];
          status?: Database["public"]["Enums"]["payment_status"];
          amount_cents: number;
          created_by: UUID;
          created_at?: Timestamp;
        }
      >;
      credit_accounts: Table<
        {
          id: UUID;
          company_id: UUID;
          customer_id: UUID;
          sale_id: UUID;
          original_cents: number;
          remaining_cents: number;
          status: Database["public"]["Enums"]["credit_account_status"];
          due_date: string | null;
          created_by: UUID;
          created_at: Timestamp;
          updated_at: Timestamp;
        },
        {
          id?: UUID;
          company_id: UUID;
          customer_id: UUID;
          sale_id: UUID;
          original_cents: number;
          remaining_cents: number;
          status?: Database["public"]["Enums"]["credit_account_status"];
          due_date?: string | null;
          created_by: UUID;
          created_at?: Timestamp;
          updated_at?: Timestamp;
        }
      >;
      credit_payments: Table<
        {
          id: UUID;
          company_id: UUID;
          credit_account_id: UUID;
          amount_cents: number;
          received_by: UUID;
          received_at: Timestamp;
          notes: string | null;
        },
        {
          id?: UUID;
          company_id: UUID;
          credit_account_id: UUID;
          amount_cents: number;
          received_by: UUID;
          received_at?: Timestamp;
          notes?: string | null;
        }
      >;
      stock_movements: Table<
        {
          id: UUID;
          company_id: UUID;
          product_id: UUID;
          sale_id: UUID | null;
          movement_type: Database["public"]["Enums"]["stock_movement_type"];
          quantity_delta: number;
          quantity_before: number;
          quantity_after: number;
          reason: string | null;
          created_by: UUID;
          created_at: Timestamp;
        },
        {
          id?: UUID;
          company_id: UUID;
          product_id: UUID;
          sale_id?: UUID | null;
          movement_type: Database["public"]["Enums"]["stock_movement_type"];
          quantity_delta: number;
          quantity_before: number;
          quantity_after: number;
          reason?: string | null;
          created_by: UUID;
          created_at?: Timestamp;
        }
      >;
      cash_movements: Table<
        {
          id: UUID;
          company_id: UUID;
          cash_register_id: UUID;
          sale_id: UUID | null;
          movement_type: Database["public"]["Enums"]["cash_movement_type"];
          amount_cents: number;
          description: string | null;
          created_by: UUID;
          created_at: Timestamp;
        },
        {
          id?: UUID;
          company_id: UUID;
          cash_register_id: UUID;
          sale_id?: UUID | null;
          movement_type: Database["public"]["Enums"]["cash_movement_type"];
          amount_cents: number;
          description?: string | null;
          created_by: UUID;
          created_at?: Timestamp;
        }
      >;
    };
    Views: Record<string, never>;
    Functions: {
      adjust_product_stock: {
        Args: {
          target_product_id: string;
          movement_kind: Database["public"]["Enums"]["stock_movement_type"];
          quantity_delta: number;
          movement_reason?: string | null;
        };
        Returns: Tables<"stock_movements">;
      };
      open_cash_register: {
        Args: { opening_amount_cents: number; opening_notes?: string | null };
        Returns: Tables<"cash_registers">;
      };
      record_cash_movement: {
        Args: {
          target_register_id: string;
          movement_kind: Database["public"]["Enums"]["cash_movement_type"];
          amount_cents: number;
          movement_description?: string | null;
        };
        Returns: Tables<"cash_movements">;
      };
      close_cash_register: {
        Args: {
          target_register_id: string;
          counted_amount_cents: number;
          closing_notes?: string | null;
        };
        Returns: Tables<"cash_registers">;
      };
      categories: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          name?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          company_id: string;
          category_id: string | null;
          name: string;
          barcode: string | null;
          price_in_cents: number;
          cost_in_cents: number | null;
          stock_quantity: number;
          min_stock_quantity: number | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          category_id?: string | null;
          name: string;
          barcode?: string | null;
          price_in_cents: number;
          cost_in_cents?: number | null;
          stock_quantity?: number;
          min_stock_quantity?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          category_id?: string | null;
          name?: string;
          barcode?: string | null;
          price_in_cents?: number;
          cost_in_cents?: number | null;
          stock_quantity?: number;
          min_stock_quantity?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Enums: {
      profile_role: "admin" | "operator";
      company_member_role: "owner" | "admin" | "operator";
      product_unit: "unit" | "kg" | "g" | "l" | "ml" | "box" | "pack";
      cash_register_status: "open" | "closed";
      cash_movement_type:
        | "opening"
        | "sale"
        | "cash_in"
        | "cash_out"
        | "closing_adjustment";
      sale_status: "completed" | "cancelled";
      payment_method: "cash" | "pix" | "debit" | "credit" | "credit_account";
      payment_status: "completed" | "refunded";
      credit_account_status: "open" | "partial" | "paid" | "cancelled";
      stock_movement_type:
        | "opening"
        | "purchase"
        | "sale"
        | "adjustment_in"
        | "adjustment_out"
        | "return"
        | "loss";
    };
    CompositeTypes: Record<string, never>;
  };
};
