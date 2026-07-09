export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admins: {
        Row: {
          created_at: string
          email: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          user_id?: string
        }
        Relationships: []
      }
      contact: {
        Row: {
          email: string | null
          i18n: Json
          id: number
          map_url: string | null
          phone: string | null
          whatsapp: string | null
        }
        Insert: {
          email?: string | null
          i18n?: Json
          id?: number
          map_url?: string | null
          phone?: string | null
          whatsapp?: string | null
        }
        Update: {
          email?: string | null
          i18n?: Json
          id?: number
          map_url?: string | null
          phone?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      leads: {
        Row: {
          created_at: string
          email: string | null
          id: string
          locale: string | null
          message: string | null
          name: string | null
          phone: string | null
          project_code: string | null
          source: string
          status: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          locale?: string | null
          message?: string | null
          name?: string | null
          phone?: string | null
          project_code?: string | null
          source?: string
          status?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          locale?: string | null
          message?: string | null
          name?: string | null
          phone?: string | null
          project_code?: string | null
          source?: string
          status?: string
        }
        Relationships: []
      }
      locales: {
        Row: {
          code: string
          dir: string
          enabled: boolean
          name: string
          sort_order: number
        }
        Insert: {
          code: string
          dir: string
          enabled?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          code?: string
          dir?: string
          enabled?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      news: {
        Row: {
          created_at: string
          i18n: Json
          id: string
          image_url: string | null
          published_at: string | null
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          i18n?: Json
          id?: string
          image_url?: string | null
          published_at?: string | null
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          i18n?: Json
          id?: string
          image_url?: string | null
          published_at?: string | null
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      pages: {
        Row: {
          i18n: Json
          key: string
        }
        Insert: {
          i18n?: Json
          key: string
        }
        Update: {
          i18n?: Json
          key?: string
        }
        Relationships: []
      }
      partners: {
        Row: {
          i18n: Json
          id: string
          logo_url: string | null
          sort_order: number
        }
        Insert: {
          i18n?: Json
          id?: string
          logo_url?: string | null
          sort_order?: number
        }
        Update: {
          i18n?: Json
          id?: string
          logo_url?: string | null
          sort_order?: number
        }
        Relationships: []
      }
      projects: {
        Row: {
          area: string | null
          beds_max: number | null
          beds_min: number | null
          city_key: string
          code: string
          created_at: string
          featured: boolean
          i18n: Json
          id: string
          image_url: string | null
          price_max: number | null
          price_min: number | null
          sold: number
          sort_order: number
          status: string
          type_key: string
          updated_at: string
        }
        Insert: {
          area?: string | null
          beds_max?: number | null
          beds_min?: number | null
          city_key: string
          code: string
          created_at?: string
          featured?: boolean
          i18n?: Json
          id?: string
          image_url?: string | null
          price_max?: number | null
          price_min?: number | null
          sold?: number
          sort_order?: number
          status?: string
          type_key: string
          updated_at?: string
        }
        Update: {
          area?: string | null
          beds_max?: number | null
          beds_min?: number | null
          city_key?: string
          code?: string
          created_at?: string
          featured?: boolean
          i18n?: Json
          id?: string
          image_url?: string | null
          price_max?: number | null
          price_min?: number | null
          sold?: number
          sort_order?: number
          status?: string
          type_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      social_links: {
        Row: {
          enabled: boolean
          id: string
          platform: string
          sort_order: number
          url: string
        }
        Insert: {
          enabled?: boolean
          id?: string
          platform: string
          sort_order?: number
          url: string
        }
        Update: {
          enabled?: boolean
          id?: string
          platform?: string
          sort_order?: number
          url?: string
        }
        Relationships: []
      }
      stats: {
        Row: {
          i18n: Json
          id: string
          sort_order: number
          suffix: string | null
          value: number
        }
        Insert: {
          i18n?: Json
          id?: string
          sort_order?: number
          suffix?: string | null
          value?: number
        }
        Update: {
          i18n?: Json
          id?: string
          sort_order?: number
          suffix?: string | null
          value?: number
        }
        Relationships: []
      }
      taxonomies: {
        Row: {
          i18n: Json
          id: string
          key: string
          kind: string
          sort_order: number
        }
        Insert: {
          i18n?: Json
          id?: string
          key: string
          kind: string
          sort_order?: number
        }
        Update: {
          i18n?: Json
          id?: string
          key?: string
          kind?: string
          sort_order?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
