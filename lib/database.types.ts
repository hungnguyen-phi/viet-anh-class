export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      notifications: {
        Row: { id: string; user_id: string; title: string; body: string | null; link: string | null; read: boolean; created_at: string }
        Insert: { id?: string; user_id: string; title: string; body?: string | null; link?: string | null; read?: boolean; created_at?: string }
        Update: { id?: string; user_id?: string; title?: string; body?: string | null; link?: string | null; read?: boolean; created_at?: string }
        Relationships: []
      }
      timetable_slots: {
        Row: { id: string; class_id: string; day_of_week: number; period_no: number; subject: string; room: string | null; created_at: string }
        Insert: { id?: string; class_id: string; day_of_week: number; period_no: number; subject: string; room?: string | null; created_at?: string }
        Update: { id?: string; class_id?: string; day_of_week?: number; period_no?: number; subject?: string; room?: string | null; created_at?: string }
        Relationships: []
      }
      attendance_records: {
        Row: {
          class_id: string
          created_at: string
          date: string
          id: string
          marked_by: string | null
          note: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          date: string
          id?: string
          marked_by?: string | null
          note?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          date?: string
          id?: string
          marked_by?: string | null
          note?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          detail: Json | null
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          detail?: Json | null
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          detail?: Json | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campuses: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      area_config: {
        Row: {
          area: Database["public"]["Enums"]["wig_area"]
          color_hex: string
          default_unit: string | null
          icon_name: string
          label_en: string
          label_vi: string
          soft_rgba: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          area: Database["public"]["Enums"]["wig_area"]
          color_hex: string
          default_unit?: string | null
          icon_name: string
          label_en: string
          label_vi: string
          soft_rgba: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          area?: Database["public"]["Enums"]["wig_area"]
          color_hex?: string
          default_unit?: string | null
          icon_name?: string
          label_en?: string
          label_vi?: string
          soft_rgba?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      grades: {
        Row: {
          campus_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          campus_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          campus_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "grades_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          campus_id: string
          cover_image_url: string | null
          created_at: string
          grade: string | null
          grade_id: string | null
          homeroom_teacher_id: string | null
          id: string
          is_active: boolean
          name: string
          school_year: string
        }
        Insert: {
          campus_id: string
          cover_image_url?: string | null
          created_at?: string
          grade?: string | null
          grade_id?: string | null
          homeroom_teacher_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          school_year: string
        }
        Update: {
          campus_id?: string
          cover_image_url?: string | null
          created_at?: string
          grade?: string | null
          grade_id?: string | null
          homeroom_teacher_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          school_year?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_grade_id_fkey"
            columns: ["grade_id"]
            isOneToOne: false
            referencedRelation: "grades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_homeroom_teacher_id_fkey"
            columns: ["homeroom_teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      edit_requests: {
        Row: {
          class_id: string
          created_at: string
          id: string
          kind: string
          message: string | null
          ref_id: string | null
          requester_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          student_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          kind: string
          message?: string | null
          ref_id?: string | null
          requester_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          student_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          kind?: string
          message?: string | null
          ref_id?: string | null
          requester_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "edit_requests_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edit_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edit_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          class_id: string
          id: string
          is_active: boolean
          is_attendance_leader: boolean
          student_id: string
        }
        Insert: {
          class_id: string
          id?: string
          is_active?: boolean
          is_attendance_leader?: boolean
          student_id: string
        }
        Update: {
          class_id?: string
          id?: string
          is_active?: boolean
          is_attendance_leader?: boolean
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_measures: {
        Row: {
          created_at: string
          id: string
          sub_category: string | null
          target_value: number
          title: string
          unit: string | null
          wig_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          sub_category?: string | null
          target_value: number
          title: string
          unit?: string | null
          wig_id: string
        }
        Update: {
          created_at?: string
          id?: string
          sub_category?: string | null
          target_value?: number
          title?: string
          unit?: string | null
          wig_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_measures_wig_id_fkey"
            columns: ["wig_id"]
            isOneToOne: false
            referencedRelation: "wig_progress_v"
            referencedColumns: ["wig_id"]
          },
          {
            foreignKeyName: "lead_measures_wig_id_fkey"
            columns: ["wig_id"]
            isOneToOne: false
            referencedRelation: "wigs"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_progress: {
        Row: {
          created_at: string
          id: string
          lead_measure_id: string
          logged_by: string | null
          logged_date: string
          note: string | null
          student_id: string | null
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          lead_measure_id: string
          logged_by?: string | null
          logged_date?: string
          note?: string | null
          student_id?: string | null
          value?: number
        }
        Update: {
          created_at?: string
          id?: string
          lead_measure_id?: string
          logged_by?: string | null
          logged_date?: string
          note?: string | null
          student_id?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "lead_progress_lead_measure_id_fkey"
            columns: ["lead_measure_id"]
            isOneToOne: false
            referencedRelation: "lead_measures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_progress_logged_by_fkey"
            columns: ["logged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_progress_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mood_checkins: {
        Row: {
          class_id: string | null
          created_at: string
          date: string
          id: string
          mood: Database["public"]["Enums"]["mood_level"]
          student_id: string
          updated_at: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          date?: string
          id?: string
          mood: Database["public"]["Enums"]["mood_level"]
          student_id: string
          updated_at?: string
        }
        Update: {
          class_id?: string | null
          created_at?: string
          date?: string
          id?: string
          mood?: Database["public"]["Enums"]["mood_level"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mood_checkins_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mood_checkins_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_invitations: {
        Row: {
          created_at: string
          email: string
          id: string
          invited_by: string | null
          status: string
          student_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          invited_by?: string | null
          status?: string
          student_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_invitations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_links: {
        Row: {
          parent_id: string
          relationship: string | null
          student_id: string
        }
        Insert: {
          parent_id: string
          relationship?: string | null
          student_id: string
        }
        Update: {
          parent_id?: string
          relationship?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_links_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_links_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_user_grants: {
        Row: {
          class_id: string | null
          created_at: string
          email: string
          invited_by: string | null
          role: Database["public"]["Enums"]["user_role"]
          student_id: string | null
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          email: string
          invited_by?: string | null
          role: Database["public"]["Enums"]["user_role"]
          student_id?: string | null
        }
        Update: {
          class_id?: string | null
          created_at?: string
          email?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pending_user_grants_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_user_grants_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_user_grants_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          campus_id: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          intro_seen: boolean
          locale: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          avatar_url?: string | null
          campus_id?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          intro_seen?: boolean
          locale?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          avatar_url?: string | null
          campus_id?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          intro_seen?: boolean
          locale?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: [
          {
            foreignKeyName: "profiles_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
        ]
      }
      scoreboard_entries: {
        Row: {
          campus_id: string
          category: Database["public"]["Enums"]["score_category"]
          class_id: string | null
          created_at: string
          id: string
          period_label: string
          points: number
          source_ref: string | null
          student_id: string | null
          sub_category: string | null
        }
        Insert: {
          campus_id: string
          category: Database["public"]["Enums"]["score_category"]
          class_id?: string | null
          created_at?: string
          id?: string
          period_label: string
          points?: number
          source_ref?: string | null
          student_id?: string | null
          sub_category?: string | null
        }
        Update: {
          campus_id?: string
          category?: Database["public"]["Enums"]["score_category"]
          class_id?: string | null
          created_at?: string
          id?: string
          period_label?: string
          points?: number
          source_ref?: string | null
          student_id?: string | null
          sub_category?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scoreboard_entries_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scoreboard_entries_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scoreboard_entries_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      school_networks: {
        Row: {
          campus_id: string | null
          cidr: string
          created_at: string
          geo_lat: number | null
          geo_lng: number | null
          geo_radius_m: number | null
          id: string
          is_active: boolean
          label: string
        }
        Insert: {
          campus_id?: string | null
          cidr: string
          created_at?: string
          geo_lat?: number | null
          geo_lng?: number | null
          geo_radius_m?: number | null
          id?: string
          is_active?: boolean
          label: string
        }
        Update: {
          campus_id?: string | null
          cidr?: string
          created_at?: string
          geo_lat?: number | null
          geo_lng?: number | null
          geo_radius_m?: number | null
          id?: string
          is_active?: boolean
          label?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_networks_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
        ]
      }
      signup_email_domains: {
        Row: {
          created_at: string
          default_role: Database["public"]["Enums"]["user_role"]
          domain: string
        }
        Insert: {
          created_at?: string
          default_role: Database["public"]["Enums"]["user_role"]
          domain: string
        }
        Update: {
          created_at?: string
          default_role?: Database["public"]["Enums"]["user_role"]
          domain?: string
        }
        Relationships: []
      }
      wig_meetings: {
        Row: {
          buddy_id: string | null
          // Ghi chú Buddy do LLM sinh (0042) — server action askBuddyNote ghi bằng service_role.
          buddy_note: string | null
          buddy_note_at: string | null
          buddy_note_model: string | null
          class_id: string
          coach_id: string | null
          commitments: string | null
          created_at: string
          id: string
          next_actions: string | null
          results: string | null
          student_id: string | null
          week_label: string
        }
        Insert: {
          buddy_id?: string | null
          buddy_note?: string | null
          buddy_note_at?: string | null
          buddy_note_model?: string | null
          class_id: string
          coach_id?: string | null
          commitments?: string | null
          created_at?: string
          id?: string
          next_actions?: string | null
          results?: string | null
          student_id?: string | null
          week_label: string
        }
        Update: {
          buddy_id?: string | null
          buddy_note?: string | null
          buddy_note_at?: string | null
          buddy_note_model?: string | null
          class_id?: string
          coach_id?: string | null
          commitments?: string | null
          created_at?: string
          id?: string
          next_actions?: string | null
          results?: string | null
          student_id?: string | null
          week_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "wig_meetings_buddy_id_fkey"
            columns: ["buddy_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wig_meetings_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wig_meetings_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wig_meetings_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wigs: {
        Row: {
          area: Database["public"]["Enums"]["wig_area"]
          class_id: string
          created_at: string
          end_date: string
          id: string
          note: string | null
          parent_wig_id: string | null
          period: Database["public"]["Enums"]["wig_period"]
          period_label: string | null
          scope: Database["public"]["Enums"]["wig_scope"]
          start_date: string
          student_id: string | null
          target_value: number
          unit: string
        }
        Insert: {
          area: Database["public"]["Enums"]["wig_area"]
          class_id: string
          created_at?: string
          end_date: string
          id?: string
          note?: string | null
          parent_wig_id?: string | null
          period: Database["public"]["Enums"]["wig_period"]
          period_label?: string | null
          scope: Database["public"]["Enums"]["wig_scope"]
          start_date: string
          student_id?: string | null
          target_value: number
          unit: string
        }
        Update: {
          area?: Database["public"]["Enums"]["wig_area"]
          class_id?: string
          created_at?: string
          end_date?: string
          id?: string
          note?: string | null
          parent_wig_id?: string | null
          period?: Database["public"]["Enums"]["wig_period"]
          period_label?: string | null
          scope?: Database["public"]["Enums"]["wig_scope"]
          start_date?: string
          student_id?: string | null
          target_value?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "wigs_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wigs_parent_wig_id_fkey"
            columns: ["parent_wig_id"]
            isOneToOne: false
            referencedRelation: "wig_progress_v"
            referencedColumns: ["wig_id"]
          },
          {
            foreignKeyName: "wigs_parent_wig_id_fkey"
            columns: ["parent_wig_id"]
            isOneToOne: false
            referencedRelation: "wigs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wigs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      wig_progress_v: {
        Row: {
          actual: number | null
          area: Database["public"]["Enums"]["wig_area"] | null
          class_id: string | null
          end_date: string | null
          expected_pct: number | null
          pct: number | null
          period: Database["public"]["Enums"]["wig_period"] | null
          period_label: string | null
          scope: Database["public"]["Enums"]["wig_scope"] | null
          start_date: string | null
          status: string | null
          student_id: string | null
          target_value: number | null
          unit: string | null
          wig_id: string | null
        }
        Insert: {
          actual?: never
          area?: Database["public"]["Enums"]["wig_area"] | null
          class_id?: string | null
          end_date?: string | null
          expected_pct?: never
          pct?: never
          period?: Database["public"]["Enums"]["wig_period"] | null
          period_label?: string | null
          scope?: Database["public"]["Enums"]["wig_scope"] | null
          start_date?: string | null
          status?: never
          student_id?: string | null
          target_value?: number | null
          unit?: string | null
          wig_id?: string | null
        }
        Update: {
          actual?: never
          area?: Database["public"]["Enums"]["wig_area"] | null
          class_id?: string | null
          end_date?: string | null
          expected_pct?: never
          pct?: never
          period?: Database["public"]["Enums"]["wig_period"] | null
          period_label?: string | null
          scope?: Database["public"]["Enums"]["wig_scope"] | null
          start_date?: string | null
          status?: never
          student_id?: string | null
          target_value?: number | null
          unit?: string | null
          wig_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wigs_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wigs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_delete_user: { Args: { p_user: string }; Returns: undefined }
      mark_attendance_on: {
        Args: {
          p_class: string
          p_student: string
          p_status: Database["public"]["Enums"]["attendance_status"]
          p_date: string
        }
        Returns: undefined
      }
      current_school_year: { Args: never; Returns: string }
      class_scoreboard: {
        Args: { p_class: string }
        Returns: { category: string; sub_category: string | null; points: number; lead_count: number }[]
      }
      campus_ranks: {
        Args: never
        Returns: { class_id: string; name: string; school_year: string; score: number; att_today: number }[]
      }
      enroll_student_by_email: { Args: { p_class: string; p_email: string }; Returns: string }
      unenroll_student: { Args: { p_class: string; p_student: string }; Returns: undefined }
      app_today: { Args: never; Returns: string }
      auth_campus: { Args: never; Returns: string }
      auth_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      child_class_progress: {
        Args: { s: string }
        Returns: {
          area: Database["public"]["Enums"]["wig_area"]
          pct: number
          status: string
        }[]
      }
      child_week_report: {
        Args: { s: string; wk: string }
        Returns: {
          area: Database["public"]["Enums"]["wig_area"]
          leads_done: number
          leads_total: number
          wig_actual: number
          wig_target: number
          wig_won: boolean
        }[]
      }
      child_weeks: {
        Args: { s: string }
        Returns: {
          week_label: string
        }[]
      }
      class_competition_scores: {
        Args: never
        Returns: {
          campus_id: string
          class_id: string
          grade: string
          level: string
          score: number
        }[]
      }
      class_ranks: {
        Args: { c: string }
        Returns: {
          campus_rank: number
          campus_total: number
          global_rank: number
          global_total: number
          grade_rank: number
          grade_total: number
          level_rank: number
          level_total: number
          score: number
        }[]
      }
      is_attendance_leader: { Args: { c: string }; Returns: boolean }
      is_campus_class: { Args: { c: string }; Returns: boolean }
      is_class_student: { Args: { c: string }; Returns: boolean }
      is_class_teacher: { Args: { c: string }; Returns: boolean }
      is_classmate_via_leader: { Args: { s: string }; Returns: boolean }
      is_my_child: { Args: { s: string }; Returns: boolean }
      is_my_student: { Args: { s: string }; Returns: boolean }
      is_parent_of_class: { Args: { c: string }; Returns: boolean }
      lead_class: { Args: { lm: string }; Returns: string }
      log_audit: {
        Args: { p_action: string; p_detail?: Json }
        Returns: undefined
      }
      mark_attendance: {
        Args: {
          p_class: string
          p_status: Database["public"]["Enums"]["attendance_status"]
          p_student: string
        }
        Returns: undefined
      }
      restrict_signup_by_email_domain: { Args: { event: Json }; Returns: Json }
      set_my_mood: {
        Args: { p_mood: Database["public"]["Enums"]["mood_level"] }
        Returns: undefined
      }
      ip_allowed: { Args: { p_ip: string }; Returns: boolean }
      student_checkin: {
        Args: {
          p_student: string
          p_mood: Database["public"]["Enums"]["mood_level"]
          p_ip: string
        }
        Returns: string
      }
      staff_can_manage_class: { Args: { c: string }; Returns: boolean }
      staff_can_read_class: { Args: { c: string }; Returns: boolean }
      // wig_actual đã chuyển sang schema `private` (migration 0038) → không còn RPC.
      wig_class: { Args: { w: string }; Returns: string }
    }
    Enums: {
      attendance_status: "present" | "absent" | "late" | "excused"
      mood_level: "great" | "good" | "ok" | "low" | "bad"
      score_category: "knowledge" | "skills" | "english" | "physical"
      user_role:
        | "admin"
        | "principal"
        | "teacher"
        | "student"
        | "parent"
        | "pending"
      wig_area: "knowledge" | "skills" | "english" | "physical"
      wig_period: "year" | "month" | "week"
      wig_scope: "class" | "student"
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
    Enums: {
      attendance_status: ["present", "absent", "late", "excused"],
      mood_level: ["great", "good", "ok", "low", "bad"],
      score_category: ["knowledge", "skills", "english", "physical"],
      user_role: [
        "admin",
        "principal",
        "teacher",
        "student",
        "parent",
        "pending",
      ],
      wig_area: ["knowledge", "skills", "english", "physical"],
      wig_period: ["year", "month", "week"],
      wig_scope: ["class", "student"],
    },
  },
} as const

