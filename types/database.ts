export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          display_name: string | null
          avatar_url: string | null
          currency: string
          created_at: string
        }
        Insert: {
          id: string
          display_name?: string | null
          avatar_url?: string | null
          currency?: string
          created_at?: string
        }
        Update: {
          display_name?: string | null
          avatar_url?: string | null
          currency?: string
        }
      }
      workspaces: {
        Row: {
          id: string
          name: string
          owner_id: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          owner_id: string
          created_at?: string
        }
        Update: {
          name?: string
        }
      }
      workspace_members: {
        Row: {
          workspace_id: string
          user_id: string
          role: 'owner' | 'editor' | 'viewer'
        }
        Insert: {
          workspace_id: string
          user_id: string
          role: 'owner' | 'editor' | 'viewer'
        }
        Update: {
          role?: 'owner' | 'editor' | 'viewer'
        }
      }
      months: {
        Row: {
          id: string
          workspace_id: string
          month_key: string
          label: string
          income: number
          courses_budget: number
          courses_weekly_budget: number
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          month_key: string
          label: string
          income?: number
          courses_budget?: number
          courses_weekly_budget?: number
          created_at?: string
        }
        Update: {
          label?: string
          income?: number
          courses_budget?: number
          courses_weekly_budget?: number
        }
      }
      envelopes: {
        Row: {
          id: string
          month_id: string
          slug: string
          name: string
          budget: number
          icon: string
          color: string | null
          is_system: boolean
          position: number
          due_day: number | null
          is_paid: boolean
        }
        Insert: {
          id?: string
          month_id: string
          slug: string
          name: string
          budget?: number
          icon?: string
          color?: string | null
          is_system?: boolean
          position?: number
          due_day?: number | null
          is_paid?: boolean
        }
        Update: {
          name?: string
          budget?: number
          icon?: string
          color?: string | null
          position?: number
          due_day?: number | null
          is_paid?: boolean
        }
      }
      categories: {
        Row: {
          id: string
          workspace_id: string
          name: string
          icon: string | null
          color: string | null
        }
        Insert: {
          id?: string
          workspace_id: string
          name: string
          icon?: string | null
          color?: string | null
        }
        Update: {
          name?: string
          icon?: string | null
          color?: string | null
        }
      }
      transactions: {
        Row: {
          id: string
          month_id: string
          workspace_id: string
          envelope_slug: string
          category_id: string | null
          label: string
          amount: number
          date: string
          notes: string | null
          is_private: boolean
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          month_id: string
          workspace_id: string
          envelope_slug: string
          category_id?: string | null
          label: string
          amount: number
          date?: string
          notes?: string | null
          is_private?: boolean
          created_by: string
          created_at?: string
        }
        Update: {
          label?: string
          amount?: number
          date?: string
          category_id?: string | null
          notes?: string | null
          envelope_slug?: string
        }
      }
      planned_expenses: {
        Row: {
          id: string
          month_id: string
          label: string
          amount: number
          category_id: string | null
          is_recurring: boolean
          recurrence_rule: string | null
          position: number
        }
        Insert: {
          id?: string
          month_id: string
          label: string
          amount: number
          category_id?: string | null
          is_recurring?: boolean
          recurrence_rule?: string | null
          position?: number
        }
        Update: {
          label?: string
          amount?: number
          category_id?: string | null
          is_recurring?: boolean
          position?: number
        }
      }
      goals: {
        Row: {
          id: string
          workspace_id: string
          name: string
          target_amount: number
          current_amount: number
          target_date: string | null
          icon: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          name: string
          target_amount: number
          current_amount?: number
          target_date?: string | null
          icon?: string
          is_active?: boolean
          created_at?: string
        }
        Update: {
          name?: string
          target_amount?: number
          current_amount?: number
          target_date?: string | null
          icon?: string
          is_active?: boolean
        }
      }
    }
  }
}

// Helpers pratiques
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type Profile = Tables<'profiles'>
export type Workspace = Tables<'workspaces'>
export type Month = Tables<'months'>
export type Envelope = Tables<'envelopes'>
export type Category = Tables<'categories'>
export type Transaction = Tables<'transactions'>
export type PlannedExpense = Tables<'planned_expenses'>
export type Goal = Tables<'goals'>

export type WorkspaceRole = 'owner' | 'editor' | 'viewer'
