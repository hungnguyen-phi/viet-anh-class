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
      assessment_terms: {
        Row: {
          campus_id: string
          created_at: string
          created_by: string | null
          end_date: string | null
          id: string
          is_locked: boolean
          kind: Database["public"]["Enums"]["assessment_term_kind"]
          name: string
          school_year: string
          start_date: string | null
          updated_at: string
        }
        Insert: {
          campus_id: string
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          is_locked?: boolean
          kind: Database["public"]["Enums"]["assessment_term_kind"]
          name: string
          school_year?: string
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          campus_id?: string
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          is_locked?: boolean
          kind?: Database["public"]["Enums"]["assessment_term_kind"]
          name?: string
          school_year?: string
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_terms_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_terms_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      buddy_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          meeting_id: string
          role: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          meeting_id: string
          role: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          meeting_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "buddy_messages_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "wig_meetings"
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
          levels: Database["public"]["Enums"]["school_level"][]
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          levels?: Database["public"]["Enums"]["school_level"][]
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          levels?: Database["public"]["Enums"]["school_level"][]
          name?: string
        }
        Relationships: []
      }
      class_albums: {
        Row: {
          class_id: string
          created_at: string
          created_by: string | null
          description: string | null
          event_date: string
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_date?: string
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_date?: string
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_albums_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_albums_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      class_photos: {
        Row: {
          album_id: string
          caption: string | null
          created_at: string
          id: string
          sort_order: number
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          album_id: string
          caption?: string | null
          created_at?: string
          id?: string
          sort_order?: number
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          album_id?: string
          caption?: string | null
          created_at?: string
          id?: string
          sort_order?: number
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_photos_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "class_albums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_photos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      class_subjects: {
        Row: {
          class_id: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          subject_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          subject_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_subjects_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_subjects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      class_transfer_requests: {
        Row: {
          created_at: string
          decide_note: string | null
          decided_at: string | null
          decided_by: string | null
          from_class_id: string
          id: string
          note: string | null
          requested_by: string
          status: string
          student_id: string
          to_class_id: string
        }
        Insert: {
          created_at?: string
          decide_note?: string | null
          decided_at?: string | null
          decided_by?: string | null
          from_class_id: string
          id?: string
          note?: string | null
          requested_by: string
          status?: string
          student_id: string
          to_class_id: string
        }
        Update: {
          created_at?: string
          decide_note?: string | null
          decided_at?: string | null
          decided_by?: string | null
          from_class_id?: string
          id?: string
          note?: string | null
          requested_by?: string
          status?: string
          student_id?: string
          to_class_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_transfer_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_transfer_requests_from_class_id_fkey"
            columns: ["from_class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_transfer_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_transfer_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_transfer_requests_to_class_id_fkey"
            columns: ["to_class_id"]
            isOneToOne: false
            referencedRelation: "classes"
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
          tick_lock_dow: number
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
          tick_lock_dow?: number
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
          tick_lock_dow?: number
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
            foreignKeyName: "edit_requests_resolved_by_fkey"
            columns: ["resolved_by"]
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
      homework_done: {
        Row: {
          done_at: string
          post_id: string
          student_id: string
        }
        Insert: {
          done_at?: string
          post_id: string
          student_id: string
        }
        Update: {
          done_at?: string
          post_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "homework_done_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "homework_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_done_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      homework_posts: {
        Row: {
          class_id: string
          content: string
          created_at: string
          created_by: string | null
          date: string
          due_date: string | null
          id: string
          kind: Database["public"]["Enums"]["homework_kind"]
          subject: string | null
          subject_id: string | null
          updated_at: string
        }
        Insert: {
          class_id: string
          content: string
          created_at?: string
          created_by?: string | null
          date?: string
          due_date?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["homework_kind"]
          subject?: string | null
          subject_id?: string | null
          updated_at?: string
        }
        Update: {
          class_id?: string
          content?: string
          created_at?: string
          created_by?: string | null
          date?: string
          due_date?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["homework_kind"]
          subject?: string | null
          subject_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "homework_posts_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_posts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_posts_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_measures: {
        Row: {
          active_weekdays: number[]
          created_at: string
          id: string
          sub_category: string | null
          target_value: number
          title: string
          unit: string | null
          unit_per_tick: number
          wig_id: string
        }
        Insert: {
          active_weekdays?: number[]
          created_at?: string
          id?: string
          sub_category?: string | null
          target_value: number
          title: string
          unit?: string | null
          unit_per_tick?: number
          wig_id: string
        }
        Update: {
          active_weekdays?: number[]
          created_at?: string
          id?: string
          sub_category?: string | null
          target_value?: number
          title?: string
          unit?: string | null
          unit_per_tick?: number
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
      meal_menus: {
        Row: {
          campus_id: string
          created_at: string
          date: string
          items: string
          meal: Database["public"]["Enums"]["meal_slot"]
          note: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          campus_id: string
          created_at?: string
          date: string
          items: string
          meal: Database["public"]["Enums"]["meal_slot"]
          note?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          campus_id?: string
          created_at?: string
          date?: string
          items?: string
          meal?: Database["public"]["Enums"]["meal_slot"]
          note?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meal_menus_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_menus_updated_by_fkey"
            columns: ["updated_by"]
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
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
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
      parent_teacher_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          sender_id: string | null
          sender_role: Database["public"]["Enums"]["user_role"]
          sender_side: string
          thread_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          sender_id?: string | null
          sender_role: Database["public"]["Enums"]["user_role"]
          sender_side: string
          thread_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          sender_id?: string | null
          sender_role?: Database["public"]["Enums"]["user_role"]
          sender_side?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_teacher_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_teacher_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "parent_teacher_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_teacher_reads: {
        Row: {
          last_read_at: string
          thread_id: string
          user_id: string
        }
        Insert: {
          last_read_at?: string
          thread_id: string
          user_id: string
        }
        Update: {
          last_read_at?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_teacher_reads_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "parent_teacher_threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_teacher_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_teacher_threads: {
        Row: {
          class_id: string
          created_at: string
          id: string
          last_message_at: string | null
          last_sender_side: string | null
          opened_by: string | null
          student_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_sender_side?: string | null
          opened_by?: string | null
          student_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_sender_side?: string | null
          opened_by?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_teacher_threads_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_teacher_threads_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_teacher_threads_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_user_grants: {
        Row: {
          campus_id: string | null
          class_id: string | null
          created_at: string
          email: string
          invited_by: string | null
          role: Database["public"]["Enums"]["user_role"]
          student_id: string | null
        }
        Insert: {
          campus_id?: string | null
          class_id?: string | null
          created_at?: string
          email: string
          invited_by?: string | null
          role: Database["public"]["Enums"]["user_role"]
          student_id?: string | null
        }
        Update: {
          campus_id?: string | null
          class_id?: string | null
          created_at?: string
          email?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pending_user_grants_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
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
      school_networks: {
        Row: {
          campus_id: string | null
          cidr: unknown
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
          cidr: unknown
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
          cidr?: unknown
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
      student_details: {
        Row: {
          created_at: string
          created_by: string | null
          date_of_birth: string | null
          email: string
          full_name: string | null
          note: string | null
          parent_phone: string | null
          student_code: string | null
          student_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          email: string
          full_name?: string | null
          note?: string | null
          parent_phone?: string | null
          student_code?: string | null
          student_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          email?: string
          full_name?: string | null
          note?: string | null
          parent_phone?: string | null
          student_code?: string | null
          student_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_details_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_details_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_term_reviews: {
        Row: {
          class_id: string
          comment: string | null
          conduct: Database["public"]["Enums"]["conduct_rating"] | null
          conduct_score: number | null
          created_at: string
          created_by: string | null
          id: string
          published_at: string | null
          student_id: string
          term_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          class_id: string
          comment?: string | null
          conduct?: Database["public"]["Enums"]["conduct_rating"] | null
          conduct_score?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          published_at?: string | null
          student_id: string
          term_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          class_id?: string
          comment?: string | null
          conduct?: Database["public"]["Enums"]["conduct_rating"] | null
          conduct_score?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          published_at?: string | null
          student_id?: string
          term_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_term_reviews_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_term_reviews_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_term_reviews_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_term_reviews_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "assessment_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_term_reviews_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subject_grades: {
        Row: {
          grade_no: number
          subject_id: string
        }
        Insert: {
          grade_no: number
          subject_id: string
        }
        Update: {
          grade_no?: number
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subject_grades_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      subject_scores: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          kind: Database["public"]["Enums"]["score_kind"]
          note: string | null
          ordinal: number
          review_id: string
          score: number
          subject: string | null
          subject_id: string | null
          taken_on: string | null
          updated_at: string
          weight: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind: Database["public"]["Enums"]["score_kind"]
          note?: string | null
          ordinal?: number
          review_id: string
          score: number
          subject?: string | null
          subject_id?: string | null
          taken_on?: string | null
          updated_at?: string
          weight: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["score_kind"]
          note?: string | null
          ordinal?: number
          review_id?: string
          score?: number
          subject?: string | null
          subject_id?: string | null
          taken_on?: string | null
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "subject_scores_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_scores_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "student_term_reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_scores_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          campus_id: string | null
          code: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          is_scored: boolean
          name: string
          short_name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          campus_id?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          is_scored?: boolean
          name: string
          short_name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          campus_id?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          is_scored?: boolean
          name?: string
          short_name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subjects_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subjects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teaching_assignments: {
        Row: {
          class_id: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          note: string | null
          subject_id: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          note?: string | null
          subject_id: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          note?: string | null
          subject_id?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teaching_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teaching_assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teaching_assignments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teaching_assignments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      timetable_overrides: {
        Row: {
          created_at: string
          date: string
          id: string
          new_date: string | null
          new_period_no: number | null
          note: string | null
          slot_id: string
          status: string
          substitute_name: string | null
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          new_date?: string | null
          new_period_no?: number | null
          note?: string | null
          slot_id: string
          status: string
          substitute_name?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          new_date?: string | null
          new_period_no?: number | null
          note?: string | null
          slot_id?: string
          status?: string
          substitute_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "timetable_overrides_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "timetable_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      timetable_slots: {
        Row: {
          class_id: string
          created_at: string
          day_of_week: number
          id: string
          kind: string
          period_no: number
          room: string | null
          subject: string | null
          subject_id: string | null
          teacher_name: string | null
        }
        Insert: {
          class_id: string
          created_at?: string
          day_of_week: number
          id?: string
          kind?: string
          period_no: number
          room?: string | null
          subject?: string | null
          subject_id?: string | null
          teacher_name?: string | null
        }
        Update: {
          class_id?: string
          created_at?: string
          day_of_week?: number
          id?: string
          kind?: string
          period_no?: number
          room?: string | null
          subject?: string | null
          subject_id?: string | null
          teacher_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "timetable_slots_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_slots_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      wig_meeting_notes: {
        Row: {
          class_id: string
          id: string
          lead_measure_id: string
          note: string | null
          updated_at: string
          updated_by: string | null
          verdict: string | null
          week_start: string
        }
        Insert: {
          class_id: string
          id?: string
          lead_measure_id: string
          note?: string | null
          updated_at?: string
          updated_by?: string | null
          verdict?: string | null
          week_start: string
        }
        Update: {
          class_id?: string
          id?: string
          lead_measure_id?: string
          note?: string | null
          updated_at?: string
          updated_by?: string | null
          verdict?: string | null
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "wig_meeting_notes_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wig_meeting_notes_lead_measure_id_fkey"
            columns: ["lead_measure_id"]
            isOneToOne: false
            referencedRelation: "lead_measures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wig_meeting_notes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wig_meetings: {
        Row: {
          buddy_action: string | null
          buddy_chat_open: boolean
          buddy_focus_lead_id: string | null
          buddy_id: string | null
          buddy_note: string | null
          buddy_note_at: string | null
          buddy_note_model: string | null
          buddy_tokens: number | null
          class_id: string
          coach_id: string | null
          commitments: string | null
          created_at: string
          id: string
          next_actions: string | null
          results: string | null
          student_id: string | null
          week_label: string
          week_start: string | null
        }
        Insert: {
          buddy_action?: string | null
          buddy_chat_open?: boolean
          buddy_focus_lead_id?: string | null
          buddy_id?: string | null
          buddy_note?: string | null
          buddy_note_at?: string | null
          buddy_note_model?: string | null
          buddy_tokens?: number | null
          class_id: string
          coach_id?: string | null
          commitments?: string | null
          created_at?: string
          id?: string
          next_actions?: string | null
          results?: string | null
          student_id?: string | null
          week_label: string
          week_start?: string | null
        }
        Update: {
          buddy_action?: string | null
          buddy_chat_open?: boolean
          buddy_focus_lead_id?: string | null
          buddy_id?: string | null
          buddy_note?: string | null
          buddy_note_at?: string | null
          buddy_note_model?: string | null
          buddy_tokens?: number | null
          class_id?: string
          coach_id?: string | null
          commitments?: string | null
          created_at?: string
          id?: string
          next_actions?: string | null
          results?: string | null
          student_id?: string | null
          week_label?: string
          week_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wig_meetings_buddy_focus_lead_id_fkey"
            columns: ["buddy_focus_lead_id"]
            isOneToOne: false
            referencedRelation: "lead_measures"
            referencedColumns: ["id"]
          },
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
          baseline: number | null
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
          title: string
          unit: string
        }
        Insert: {
          area: Database["public"]["Enums"]["wig_area"]
          baseline?: number | null
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
          title: string
          unit: string
        }
        Update: {
          area?: Database["public"]["Enums"]["wig_area"]
          baseline?: number | null
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
          title?: string
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
      subject_term_summary_v: {
        Row: {
          diem_trung_binh: number | null
          review_id: string | null
          short_name: string | null
          so_con_diem: number | null
          sort_order: number | null
          subject: string | null
          subject_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subject_scores_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "student_term_reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_scores_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
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
      admin_user_counts: {
        Args: { p_q?: string }
        Returns: {
          n: number
          role: Database["public"]["Enums"]["user_role"]
        }[]
      }
      album_class: { Args: { a: string }; Returns: string }
      app_today: { Args: never; Returns: string }
      apply_class_transfer: {
        Args: { p_student: string; p_to_class: string }
        Returns: undefined
      }
      auth_campus: { Args: never; Returns: string }
      auth_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      campus_ranks: {
        Args: never
        Returns: {
          att_today: number
          class_id: string
          name: string
          school_year: string
          score: number
        }[]
      }
      campus_rollup: {
        Args: never
        Returns: {
          att_today: number
          class_id: string
          class_name: string
          grade_id: string
          grade_name: string
          grade_sort: number
          school_year: string
          score: number
          student_count: number
          wig_count: number
        }[]
      }
      can_manage_class_cover: { Args: { p_name: string }; Returns: boolean }
      can_manage_class_photo: { Args: { p_name: string }; Returns: boolean }
      can_manage_student_email: { Args: { p_email: string }; Returns: boolean }
      can_read_class_photo: { Args: { p_name: string }; Returns: boolean }
      can_read_subject_score: {
        Args: { p_review: string; p_subject: string }
        Returns: boolean
      }
      can_view_student: { Args: { s: string }; Returns: boolean }
      can_write_subject_score: {
        Args: { p_review: string; p_subject: string }
        Returns: boolean
      }
      cancel_class_transfer: { Args: { p_request: string }; Returns: undefined }
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
          week_end: string
          week_label: string
          week_start: string
        }[]
      }
      class_campus: { Args: { c: string }; Returns: string }
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
      class_lead_board: {
        Args: { p_class: string; p_student?: string; p_week_start?: string }
        Returns: {
          active_weekdays: number[]
          area: string
          class_size: number
          class_total: number
          contributors: number
          lead_measure_id: string
          my_dates: string[]
          target_value: number
          title: string
          unit: string
          unit_per_tick: number
          wig_id: string
          wig_title: string
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
      class_scoreboard: {
        Args: { p_class: string }
        Returns: {
          category: string
          lead_count: number
          points: number
          sub_category: string
        }[]
      }
      class_tick_matrix: {
        Args: { p_class: string; p_week_start?: string }
        Returns: {
          active_weekdays: number[]
          area: string
          lead_measure_id: string
          lead_title: string
          student_id: string
          student_name: string
          ticked_dates: string[]
          wig_id: string
          wig_title: string
        }[]
      }
      current_school_year: { Args: never; Returns: string }
      decide_class_transfer: {
        Args: { p_approve: boolean; p_note?: string; p_request: string }
        Returns: string
      }
      default_score_weight: {
        Args: { k: Database["public"]["Enums"]["score_kind"] }
        Returns: number
      }
      enroll_student_by_email: {
        Args: { p_class: string; p_email: string }
        Returns: string
      }
      homework_class: { Args: { p: string }; Returns: string }
      invite_student_to_class: {
        Args: { p_class: string; p_email: string }
        Returns: string
      }
      ip_allowed: { Args: { p_ip: string }; Returns: boolean }
      is_attendance_leader: { Args: { c: string }; Returns: boolean }
      is_campus_class: { Args: { c: string }; Returns: boolean }
      is_class_student: { Args: { c: string }; Returns: boolean }
      is_class_teacher: { Args: { c: string }; Returns: boolean }
      is_classmate_via_leader: { Args: { s: string }; Returns: boolean }
      is_enrolled: { Args: { c: string; s: string }; Returns: boolean }
      is_my_campus: { Args: { c: string }; Returns: boolean }
      is_my_child: { Args: { s: string }; Returns: boolean }
      is_my_student: { Args: { s: string }; Returns: boolean }
      is_my_subject_student: { Args: { s: string }; Returns: boolean }
      is_parent_of_class: { Args: { c: string }; Returns: boolean }
      is_subject_teacher_of_class: { Args: { c: string }; Returns: boolean }
      lead_class: { Args: { lm: string }; Returns: string }
      lead_day_ok: { Args: { d: string; lm: string }; Returns: boolean }
      lead_measure_canh_bao: {
        Args: { p_wig: string }
        Returns: {
          lead_measure_id: string
          lech_don_vi: boolean
          qua_nhieu: boolean
          so_ngay_tick_duoc: number
          so_nguoi_tick: number
          so_tick_can: number
          tran_luot_tick: number
        }[]
      }
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
      mark_attendance_on: {
        Args: {
          p_class: string
          p_date: string
          p_status: Database["public"]["Enums"]["attendance_status"]
          p_student: string
        }
        Returns: undefined
      }
      open_term_for_class: {
        Args: { p_class: string; p_term: string }
        Returns: number
      }
      pt_can_read_thread: { Args: { t: string }; Returns: boolean }
      pt_can_write_thread: { Args: { t: string }; Returns: boolean }
      pt_class_message_health: {
        Args: never
        Returns: {
          class_id: string
          class_name: string
          oldest_waiting_hours: number
          thread_count: number
          waiting_count: number
        }[]
      }
      pt_disclose_thread: {
        Args: { p_actor: string; p_reason: string; p_thread: string }
        Returns: {
          body: string
          created_at: string
          sender_name: string
          sender_side: string
        }[]
      }
      pt_mark_read: { Args: { p_thread: string }; Returns: undefined }
      pt_my_threads: {
        Args: never
        Returns: {
          class_id: string
          class_name: string
          last_message_at: string
          last_sender_side: string
          student_id: string
          student_name: string
          thread_id: string
          unread_count: number
          waiting_for_school: boolean
        }[]
      }
      pt_open_thread: { Args: { p_student: string }; Returns: string }
      pt_student_in_class: { Args: { c: string; s: string }; Returns: boolean }
      pt_unread_total: { Args: never; Returns: number }
      request_class_transfer: {
        Args: { p_note?: string; p_student: string; p_to_class: string }
        Returns: string
      }
      restrict_signup_by_email_domain: { Args: { event: Json }; Returns: Json }
      review_class: { Args: { r: string }; Returns: string }
      review_is_editable: { Args: { r: string }; Returns: boolean }
      review_visible_to_family: { Args: { r: string }; Returns: boolean }
      school_wig_rollup: {
        Args: { p_week_start?: string }
        Returns: {
          avg_pct: number
          class_id: string
          class_name: string
          grade_name: string
          grade_sort: number
          student_count: number
          teacher_name: string
          tick_count: number
          tick_students: number
          wigs_total: number
          wigs_won: number
        }[]
      }
      seed_class_subjects: { Args: { p_class: string }; Returns: number }
      seed_grades_for_campus: { Args: { p_campus: string }; Returns: number }
      set_my_campus_levels: {
        Args: { p_levels: Database["public"]["Enums"]["school_level"][] }
        Returns: number
      }
      set_my_mood: {
        Args: { p_mood: Database["public"]["Enums"]["mood_level"] }
        Returns: undefined
      }
      staff_can_manage_class: { Args: { c: string }; Returns: boolean }
      staff_can_read_class: { Args: { c: string }; Returns: boolean }
      standard_grade_numbers: {
        Args: { p_level: Database["public"]["Enums"]["school_level"] }
        Returns: number[]
      }
      standard_grade_numbers_multi: {
        Args: { p_levels: Database["public"]["Enums"]["school_level"][] }
        Returns: number[]
      }
      student_checkin: {
        Args: {
          p_ip: string
          p_mood: Database["public"]["Enums"]["mood_level"]
          p_student: string
        }
        Returns: string
      }
      subject_fits_class: {
        Args: { p_class: string; p_subject: string }
        Returns: boolean
      }
      subject_fits_grade: {
        Args: { p_class: string; p_subject: string }
        Returns: boolean
      }
      subject_roster: {
        Args: { p_class: string; p_term: string }
        Returns: {
          con_hoc: boolean
          full_name: string
          review_id: string
          student_id: string
        }[]
      }
      term_is_locked: { Args: { t: string }; Returns: boolean }
      thu_hai_tu_nhan: { Args: { nhan: string }; Returns: string }
      tick_open: { Args: { p_class: string }; Returns: boolean }
      transfer_target_classes: {
        Args: never
        Returns: {
          campus_name: string
          gvcn: string
          id: string
          name: string
          school_year: string
        }[]
      }
      truong_da_khai_mang: { Args: never; Returns: boolean }
      tuan_da_hop: { Args: { d: string; p_class: string }; Returns: boolean }
      unenroll_student: {
        Args: { p_class: string; p_student: string }
        Returns: undefined
      }
      vn_today: { Args: never; Returns: string }
      vn_week_start: { Args: { d?: string }; Returns: string }
      wig_class: { Args: { w: string }; Returns: string }
    }
    Enums: {
      assessment_term_kind:
        | "giua_ky_1"
        | "hoc_ky_1"
        | "giua_ky_2"
        | "hoc_ky_2"
        | "ca_nam"
      attendance_status: "present" | "absent" | "late" | "excused"
      conduct_rating: "tot" | "kha" | "trung_binh" | "yeu"
      homework_kind: "assignment" | "reminder" | "exam"
      meal_slot: "breakfast" | "lunch" | "snack" | "dinner"
      mood_level: "great" | "good" | "ok" | "low" | "bad"
      school_level: "mam_non" | "tieu_hoc" | "thcs" | "thpt"
      score_category: "knowledge" | "skills" | "english" | "physical"
      score_kind: "mieng" | "15p" | "1tiet" | "giua_ky" | "cuoi_ky"
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
      assessment_term_kind: [
        "giua_ky_1",
        "hoc_ky_1",
        "giua_ky_2",
        "hoc_ky_2",
        "ca_nam",
      ],
      attendance_status: ["present", "absent", "late", "excused"],
      conduct_rating: ["tot", "kha", "trung_binh", "yeu"],
      homework_kind: ["assignment", "reminder", "exam"],
      meal_slot: ["breakfast", "lunch", "snack", "dinner"],
      mood_level: ["great", "good", "ok", "low", "bad"],
      school_level: ["mam_non", "tieu_hoc", "thcs", "thpt"],
      score_category: ["knowledge", "skills", "english", "physical"],
      score_kind: ["mieng", "15p", "1tiet", "giua_ky", "cuoi_ky"],
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
