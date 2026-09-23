export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          role: "admin" | "operator";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          role?: "admin" | "operator";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          full_name?: string | null;
          role?: "admin" | "operator";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      companies: {
        Row: {
          id: string;
          name: string;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      company_members: {
        Row: {
          company_id: string;
          user_id: string;
          role: "owner" | "admin" | "operator";
          created_at: string;
        };
        Insert: {
          company_id: string;
          user_id: string;
          role?: "owner" | "admin" | "operator";
          created_at?: string;
        };
        Update: {
          company_id?: string;
          user_id?: string;
          role?: "owner" | "admin" | "operator";
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      profile_role: "admin" | "operator";
      company_member_role: "owner" | "admin" | "operator";
    };
    CompositeTypes: Record<string, never>;
  };
};
