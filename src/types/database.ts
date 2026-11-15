export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          archived: boolean
          color: string | null
          created_at: string
          icon: string | null
          id: string
          include_in_total: boolean
          initial_balance: number
          name: string
          sort_order: number
          type: Database["public"]["Enums"]["account_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          include_in_total?: boolean
          initial_balance?: number
          name: string
          sort_order?: number
          type?: Database["public"]["Enums"]["account_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          archived?: boolean
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          include_in_total?: boolean
          initial_balance?: number
          name?: string
          sort_order?: number
          type?: Database["public"]["Enums"]["account_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      budgets: {
        Row: {
          amount: number
          category_id: string
          created_at: string
          id: string
          month: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category_id: string
          created_at?: string
          id?: string
          month: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category_id?: string
          created_at?: string
          id?: string
          month?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "category_usage"
            referencedColumns: ["category_id"]
          },
        ]
      }
      categories: {
        Row: {
          archived: boolean
          color: string | null
          created_at: string
          icon: string | null
          id: string
          kind: Database["public"]["Enums"]["category_kind"]
          name: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          kind: Database["public"]["Enums"]["category_kind"]
          name: string
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          archived?: boolean
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["category_kind"]
          name?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          currency_code: string
          currency_symbol: string
          decimal_places: number
          display_name: string | null
          first_record_seen: boolean
          haptics: boolean
          id: string
          last_recurring_check: string | null
          password_attempt_window: string | null
          password_attempts: number
          recap_seen_for: string | null
          show_paise: boolean
          theme: string
          timezone: string
          updated_at: string
          week_start: number
        }
        Insert: {
          created_at?: string
          currency_code?: string
          currency_symbol?: string
          decimal_places?: number
          display_name?: string | null
          first_record_seen?: boolean
          haptics?: boolean
          id: string
          last_recurring_check?: string | null
          password_attempt_window?: string | null
          password_attempts?: number
          recap_seen_for?: string | null
          show_paise?: boolean
          theme?: string
          timezone?: string
          updated_at?: string
          week_start?: number
        }
        Update: {
          created_at?: string
          currency_code?: string
          currency_symbol?: string
          decimal_places?: number
          display_name?: string | null
          first_record_seen?: boolean
          haptics?: boolean
          id?: string
          last_recurring_check?: string | null
          password_attempt_window?: string | null
          password_attempts?: number
          recap_seen_for?: string | null
          show_paise?: boolean
          theme?: string
          timezone?: string
          updated_at?: string
          week_start?: number
        }
        Relationships: []
      }
      recurring_rules: {
        Row: {
          account_id: string
          active: boolean
          amount: number
          anchor_day: number | null
          category_id: string | null
          created_at: string
          end_date: string | null
          frequency: Database["public"]["Enums"]["recurrence_frequency"]
          id: string
          interval_count: number
          last_run_on: string | null
          next_run_on: string
          note: string | null
          skipped_dates: string[]
          start_date: string
          to_account_id: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          active?: boolean
          amount: number
          anchor_day?: number | null
          category_id?: string | null
          created_at?: string
          end_date?: string | null
          frequency: Database["public"]["Enums"]["recurrence_frequency"]
          id?: string
          interval_count?: number
          last_run_on?: string | null
          next_run_on: string
          note?: string | null
          skipped_dates?: string[]
          start_date?: string
          to_account_id?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          active?: boolean
          amount?: number
          anchor_day?: number | null
          category_id?: string | null
          created_at?: string
          end_date?: string | null
          frequency?: Database["public"]["Enums"]["recurrence_frequency"]
          id?: string
          interval_count?: number
          last_run_on?: string | null
          next_run_on?: string
          note?: string | null
          skipped_dates?: string[]
          start_date?: string
          to_account_id?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_rules_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "recurring_rules_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_usage"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "recurring_rules_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "category_usage"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "recurring_rules_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "recurring_rules_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "account_usage"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "recurring_rules_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string
          amount: number
          category_id: string | null
          created_at: string
          id: string
          note: string | null
          occurred_at: string
          recurring_rule_id: string | null
          to_account_id: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          category_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          occurred_at?: string
          recurring_rule_id?: string | null
          to_account_id?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          category_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          occurred_at?: string
          recurring_rule_id?: string | null
          to_account_id?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_usage"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "category_usage"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "transactions_recurring_rule_id_fkey"
            columns: ["recurring_rule_id"]
            isOneToOne: false
            referencedRelation: "recurring_rule_usage"
            referencedColumns: ["rule_id"]
          },
          {
            foreignKeyName: "transactions_recurring_rule_id_fkey"
            columns: ["recurring_rule_id"]
            isOneToOne: false
            referencedRelation: "recurring_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "transactions_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "account_usage"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "transactions_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      account_balances: {
        Row: {
          account_id: string | null
          archived: boolean | null
          balance: number | null
          color: string | null
          icon: string | null
          include_in_total: boolean | null
          initial_balance: number | null
          movement_count: number | null
          name: string | null
          sort_order: number | null
          type: Database["public"]["Enums"]["account_type"] | null
          user_id: string | null
        }
        Relationships: []
      }
      account_usage: {
        Row: {
          account_id: string | null
          recurring_rule_count: number | null
          transaction_count: number | null
          user_id: string | null
        }
        Insert: {
          account_id?: string | null
          recurring_rule_count?: never
          transaction_count?: never
          user_id?: string | null
        }
        Update: {
          account_id?: string | null
          recurring_rule_count?: never
          transaction_count?: never
          user_id?: string | null
        }
        Relationships: []
      }
      category_usage: {
        Row: {
          budget_count: number | null
          category_id: string | null
          recurring_rule_count: number | null
          transaction_count: number | null
          user_id: string | null
        }
        Insert: {
          budget_count?: never
          category_id?: string | null
          recurring_rule_count?: never
          transaction_count?: never
          user_id?: string | null
        }
        Update: {
          budget_count?: never
          category_id?: string | null
          recurring_rule_count?: never
          transaction_count?: never
          user_id?: string | null
        }
        Relationships: []
      }
      recurring_rule_usage: {
        Row: {
          rule_id: string | null
          transaction_count: number | null
          user_id: string | null
        }
        Insert: {
          rule_id?: string | null
          transaction_count?: never
          user_id?: string | null
        }
        Update: {
          rule_id?: string | null
          transaction_count?: never
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      account_month_flow: {
        Args: { p_month: string; p_account_id: string }
        Returns: {
          money_out: number
          money_in: number
        }[]
      }
      assert_bucket: {
        Args: { p_bucket: string; p_from: string; p_to: string }
        Returns: undefined
      }
      assert_range: {
        Args: { p_to: string; p_from: string }
        Returns: undefined
      }
      balance_series: {
        Args: {
          p_to: string
          p_from: string
          p_bucket: string
          p_account_id?: string
        }
        Returns: {
          bucket_start: string
          balance: number
        }[]
      }
      bucket_starts: {
        Args: { p_to: string; p_bucket: string; p_from: string }
        Returns: string[]
      }
      budget_hints: {
        Args: { p_month: string }
        Returns: {
          category_id: string
          last_month: number
          three_month_average: number
        }[]
      }
      category_totals: {
        Args: {
          p_kind: Database["public"]["Enums"]["category_kind"]
          p_to: string
          p_from: string
        }
        Returns: {
          icon: string
          color: string
          total: number
          category_id: string
          name: string
        }[]
      }
      change_currency: {
        Args: { p_decimals: number; p_symbol: string; p_code: string }
        Returns: number
      }
      check_account_owner: {
        Args: { p_account_id: string; p_user_id: string }
        Returns: undefined
      }
      check_category_owner: {
        Args: {
          p_user_id: string
          p_category_id: string
          p_expected_kind?: Database["public"]["Enums"]["category_kind"]
        }
        Returns: undefined
      }
      claim_password_attempt: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      copy_budgets_from_previous_month: {
        Args: { p_month: string }
        Returns: number
      }
      default_categories: {
        Args: Record<PropertyKey, never>
        Returns: {
          sort_order: number
          name: string
          kind: Database["public"]["Enums"]["category_kind"]
          icon: string
          color: string
        }[]
      }
      delete_own_account: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      delete_recurring_rule: {
        Args: { p_delete_transactions?: boolean; p_rule_id: string }
        Returns: number
      }
      entry_defaults: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      local_day_range: {
        Args: { p_from: string; p_to: string }
        Returns: Record<string, unknown>
      }
      materialise_recurring: {
        Args: { p_rule_id: string; p_on: string }
        Returns: string
      }
      month_summary: {
        Args: { p_month: string }
        Returns: {
          categories: Json
          net: number
          total_expense: number
          total_income: number
          month_start: string
        }[]
      }
      note_suggestions: {
        Args: { p_limit?: number }
        Returns: {
          note: string
          used: number
        }[]
      }
      period_series: {
        Args: { p_from: string; p_to: string; p_bucket: string }
        Returns: {
          expense: number
          bucket_start: string
          income: number
        }[]
      }
      process_due_recurring: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      quick_adds: {
        Args: Record<PropertyKey, never>
        Returns: {
          color: string
          category_id: string
          name: string
          icon: string
          amount: number
          account_id: string
          account_name: string
          used: number
        }[]
      }
      recurrence_after: {
        Args: {
          p_start: string
          p_frequency: Database["public"]["Enums"]["recurrence_frequency"]
          p_interval: number
          p_anchor_day: number
          p_from: string
        }
        Returns: string
      }
      recurrence_occurrence: {
        Args:
          | {
              p_frequency: Database["public"]["Enums"]["recurrence_frequency"]
              p_start: string
              p_interval: number
              p_n: number
              p_anchor_day: number
            }
          | {
              p_start: string
              p_n: number
              p_interval: number
              p_frequency: Database["public"]["Enums"]["recurrence_frequency"]
            }
        Returns: string
      }
      reorder_accounts: {
        Args: { p_ids: string[] }
        Returns: number
      }
      reorder_categories: {
        Args: { p_ids: string[] }
        Returns: number
      }
      set_budget: {
        Args: {
          p_horizon?: number
          p_category_id: string
          p_month: string
          p_amount: number
          p_apply_forward?: boolean
        }
        Returns: number
      }
      skip_recurring_occurrence: {
        Args: { p_rule_id: string; p_on: string }
        Returns: string
      }
      update_settings: {
        Args: {
          p_theme: string
          p_code: string
          p_display_name: string
          p_week_start: number
          p_symbol: string
          p_decimals: number
        }
        Returns: number
      }
      user_timezone: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
    }
    Enums: {
      account_type: "cash" | "bank" | "card" | "savings" | "wallet" | "other"
      category_kind: "income" | "expense"
      recurrence_frequency: "daily" | "weekly" | "monthly" | "yearly"
      transaction_type: "income" | "expense" | "transfer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      account_type: ["cash", "bank", "card", "savings", "wallet", "other"],
      category_kind: ["income", "expense"],
      recurrence_frequency: ["daily", "weekly", "monthly", "yearly"],
      transaction_type: ["income", "expense", "transfer"],
    },
  },
} as const

