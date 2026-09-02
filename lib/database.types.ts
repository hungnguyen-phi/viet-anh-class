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
          area: Database["public"]["Enums"]["wig_domain"]
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
          area: Database["public"]["Enums"]["wig_domain"]
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
          area?: Database["public"]["Enums"]["wig_domain"]
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
      buddy_pairs: {
        Row: {
          buddy_id: string
          class_id: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          student_id: string
        }
        Insert: {
          buddy_id: string
          class_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          student_id: string
        }
        Update: {
          buddy_id?: string
          class_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "buddy_pairs_buddy_id_fkey"
            columns: ["buddy_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buddy_pairs_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buddy_pairs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buddy_pairs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cam_ket: {
        Row: {
          cham_at: string | null
          cham_boi: string | null
          chu_the: string
          class_id: string
          created_at: string
          created_by: string | null
          don_vi_id: string | null
          goi_y: string | null
          id: string
          ket_qua: string | null
          lac_muc_tieu: boolean | null
          muc_tieu_id: string | null
          nguoi_nhap_ho: string | null
          nhom_id: string | null
          noi_dung: string
          pdr_meeting_id: string | null
          so_dat: number | null
          so_hua: number | null
          so_tuan: number
          student_id: string | null
          thuoc_id: string | null
          trang_thai: string
          tuan_bat_dau: string
          tuan_ket_thuc: string | null
          updated_at: string
          xong_at: string | null
        }
        Insert: {
          cham_at?: string | null
          cham_boi?: string | null
          chu_the: string
          class_id: string
          created_at?: string
          created_by?: string | null
          don_vi_id?: string | null
          goi_y?: string | null
          id?: string
          ket_qua?: string | null
          lac_muc_tieu?: never
          muc_tieu_id?: string | null
          nguoi_nhap_ho?: string | null
          nhom_id?: string | null
          noi_dung: string
          pdr_meeting_id?: string | null
          so_dat?: number | null
          so_hua?: number | null
          so_tuan?: number
          student_id?: string | null
          thuoc_id?: string | null
          trang_thai?: string
          tuan_bat_dau: string
          tuan_ket_thuc?: never
          updated_at?: string
          xong_at?: string | null
        }
        Update: {
          cham_at?: string | null
          cham_boi?: string | null
          chu_the?: string
          class_id?: string
          created_at?: string
          created_by?: string | null
          don_vi_id?: string | null
          goi_y?: string | null
          id?: string
          ket_qua?: string | null
          lac_muc_tieu?: never
          muc_tieu_id?: string | null
          nguoi_nhap_ho?: string | null
          nhom_id?: string | null
          noi_dung?: string
          pdr_meeting_id?: string | null
          so_dat?: number | null
          so_hua?: number | null
          so_tuan?: number
          student_id?: string | null
          thuoc_id?: string | null
          trang_thai?: string
          tuan_bat_dau?: string
          tuan_ket_thuc?: never
          updated_at?: string
          xong_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cam_ket_cham_boi_fkey"
            columns: ["cham_boi"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cam_ket_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cam_ket_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cam_ket_don_vi_id_fkey"
            columns: ["don_vi_id"]
            isOneToOne: false
            referencedRelation: "don_vi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cam_ket_muc_tieu_id_fkey"
            columns: ["muc_tieu_id"]
            isOneToOne: false
            referencedRelation: "muc_tieu"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cam_ket_nguoi_nhap_ho_fkey"
            columns: ["nguoi_nhap_ho"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cam_ket_nhom_id_fkey"
            columns: ["nhom_id"]
            isOneToOne: false
            referencedRelation: "nhom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cam_ket_pdr_meeting_id_fkey"
            columns: ["pdr_meeting_id"]
            isOneToOne: false
            referencedRelation: "pdr_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cam_ket_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cam_ket_thuoc_id_fkey"
            columns: ["thuoc_id"]
            isOneToOne: false
            referencedRelation: "thuoc"
            referencedColumns: ["id"]
          },
        ]
      }
      cam_ket_xac_nhan: {
        Row: {
          cam_ket_id: string
          created_at: string
          dong_y: boolean
          id: string
          nguoi_id: string
          vai: string
          y_kien: string | null
        }
        Insert: {
          cam_ket_id: string
          created_at?: string
          dong_y?: boolean
          id?: string
          nguoi_id?: string
          vai: string
          y_kien?: string | null
        }
        Update: {
          cam_ket_id?: string
          created_at?: string
          dong_y?: boolean
          id?: string
          nguoi_id?: string
          vai?: string
          y_kien?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cam_ket_xac_nhan_cam_ket_id_fkey"
            columns: ["cam_ket_id"]
            isOneToOne: false
            referencedRelation: "cam_ket"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cam_ket_xac_nhan_nguoi_id_fkey"
            columns: ["nguoi_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campus_clubs: {
        Row: {
          campus_id: string
          created_at: string
          created_by: string | null
          end_time: string
          id: string
          name: string
          note: string | null
          room: string | null
          start_time: string
          updated_at: string
          weekday: number
        }
        Insert: {
          campus_id: string
          created_at?: string
          created_by?: string | null
          end_time: string
          id?: string
          name: string
          note?: string | null
          room?: string | null
          start_time: string
          updated_at?: string
          weekday: number
        }
        Update: {
          campus_id?: string
          created_at?: string
          created_by?: string | null
          end_time?: string
          id?: string
          name?: string
          note?: string | null
          room?: string | null
          start_time?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "campus_clubs_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campus_clubs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campuses: {
        Row: {
          an_han_phut: number
          code: string
          created_at: string
          cua_so_chieu_phut: number
          gio_checkin_chieu: string
          gio_vao_lop: string
          han_muon_phut: number
          id: string
          is_active: boolean
          levels: Database["public"]["Enums"]["school_level"][]
          mo_truoc_phut: number
          name: string
        }
        Insert: {
          an_han_phut?: number
          code: string
          created_at?: string
          cua_so_chieu_phut?: number
          gio_checkin_chieu?: string
          gio_vao_lop?: string
          han_muon_phut?: number
          id?: string
          is_active?: boolean
          levels?: Database["public"]["Enums"]["school_level"][]
          mo_truoc_phut?: number
          name: string
        }
        Update: {
          an_han_phut?: number
          code?: string
          created_at?: string
          cua_so_chieu_phut?: number
          gio_checkin_chieu?: string
          gio_vao_lop?: string
          han_muon_phut?: number
          id?: string
          is_active?: boolean
          levels?: Database["public"]["Enums"]["school_level"][]
          mo_truoc_phut?: number
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
      class_period_times: {
        Row: {
          class_id: string
          end_time: string
          id: string
          period_no: number
          start_time: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          class_id: string
          end_time: string
          id?: string
          period_no: number
          start_time: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          class_id?: string
          end_time?: string
          id?: string
          period_no?: number
          start_time?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_period_times_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_period_times_updated_by_fkey"
            columns: ["updated_by"]
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
          nhap_ho: boolean
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
          nhap_ho?: boolean
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
          nhap_ho?: boolean
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
      don_vi: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          ma: string
          nhan_en: string
          nhan_vi: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          ma: string
          nhan_en: string
          nhan_vi: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          ma?: string
          nhan_en?: string
          nhan_vi?: string
        }
        Relationships: [
          {
            foreignKeyName: "don_vi_created_by_fkey"
            columns: ["created_by"]
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
          tuan: string | null
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
          tuan?: string | null
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
          tuan?: string | null
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
      hub_event_outbox: {
        Row: {
          attempts: number
          created_at: string
          event_type: string
          id: string
          last_error: string | null
          payload: Json
          sent_at: string | null
          source_id: string
          source_table: string
          status: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          event_type: string
          id?: string
          last_error?: string | null
          payload: Json
          sent_at?: string | null
          source_id: string
          source_table: string
          status?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          event_type?: string
          id?: string
          last_error?: string | null
          payload?: Json
          sent_at?: string | null
          source_id?: string
          source_table?: string
          status?: string
        }
        Relationships: []
      }
      hub_identities: {
        Row: {
          created_at: string
          email_at_link: string
          id: string
          issuer: string
          profile_id: string
          sub: string
        }
        Insert: {
          created_at?: string
          email_at_link: string
          id?: string
          issuer: string
          profile_id: string
          sub: string
        }
        Update: {
          created_at?: string
          email_at_link?: string
          id?: string
          issuer?: string
          profile_id?: string
          sub?: string
        }
        Relationships: [
          {
            foreignKeyName: "hub_identities_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_revoked_sessions: {
        Row: {
          id: string
          profile_id: string
          reason: string
          revoked_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          reason?: string
          revoked_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          reason?: string
          revoked_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hub_revoked_sessions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lich_su_dich: {
        Row: {
          ai: string | null
          id: string
          ket_thuc_cu: string | null
          ket_thuc_moi: string | null
          luc: string
          muc_tieu_id: string
          x_cu: number | null
          x_moi: number | null
          y_cu: number | null
          y_moi: number | null
        }
        Insert: {
          ai?: string | null
          id?: string
          ket_thuc_cu?: string | null
          ket_thuc_moi?: string | null
          luc?: string
          muc_tieu_id: string
          x_cu?: number | null
          x_moi?: number | null
          y_cu?: number | null
          y_moi?: number | null
        }
        Update: {
          ai?: string | null
          id?: string
          ket_thuc_cu?: string | null
          ket_thuc_moi?: string | null
          luc?: string
          muc_tieu_id?: string
          x_cu?: number | null
          x_moi?: number | null
          y_cu?: number | null
          y_moi?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lich_su_dich_ai_fkey"
            columns: ["ai"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lich_su_dich_muc_tieu_id_fkey"
            columns: ["muc_tieu_id"]
            isOneToOne: false
            referencedRelation: "muc_tieu"
            referencedColumns: ["id"]
          },
        ]
      }
      luot: {
        Row: {
          chu_the_key: string | null
          created_at: string
          gia_tri: number
          id: string
          ngay: string
          nguoi_ghi: string | null
          nguoi_sua: string | null
          nguon: string
          nguon_ref: string | null
          stt: number
          student_id: string | null
          sua_at: string | null
          thuoc_id: string
        }
        Insert: {
          chu_the_key?: never
          created_at?: string
          gia_tri: number
          id?: string
          ngay: string
          nguoi_ghi?: string | null
          nguoi_sua?: string | null
          nguon?: string
          nguon_ref?: string | null
          stt?: number
          student_id?: string | null
          sua_at?: string | null
          thuoc_id: string
        }
        Update: {
          chu_the_key?: never
          created_at?: string
          gia_tri?: number
          id?: string
          ngay?: string
          nguoi_ghi?: string | null
          nguoi_sua?: string | null
          nguon?: string
          nguon_ref?: string | null
          stt?: number
          student_id?: string | null
          sua_at?: string | null
          thuoc_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "luot_nguoi_ghi_fkey"
            columns: ["nguoi_ghi"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "luot_nguoi_sua_fkey"
            columns: ["nguoi_sua"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "luot_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "luot_thuoc_id_fkey"
            columns: ["thuoc_id"]
            isOneToOne: false
            referencedRelation: "thuoc"
            referencedColumns: ["id"]
          },
        ]
      }
      luot_mo_khoa: {
        Row: {
          class_id: string
          edit_request_id: string | null
          het_han: string
          id: string
          mo_at: string
          mo_boi: string | null
          student_id: string
          week_start: string
        }
        Insert: {
          class_id: string
          edit_request_id?: string | null
          het_han: string
          id?: string
          mo_at?: string
          mo_boi?: string | null
          student_id: string
          week_start: string
        }
        Update: {
          class_id?: string
          edit_request_id?: string | null
          het_han?: string
          id?: string
          mo_at?: string
          mo_boi?: string | null
          student_id?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "luot_mo_khoa_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "luot_mo_khoa_edit_request_id_fkey"
            columns: ["edit_request_id"]
            isOneToOne: false
            referencedRelation: "edit_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "luot_mo_khoa_mo_boi_fkey"
            columns: ["mo_boi"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "luot_mo_khoa_student_id_fkey"
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
      buoc: {
        Row: { id: string; muc_tieu_id: string; thu_tu: number; tieu_de: string; phan_tram: number; bat_dau: string | null; ket_thuc: string | null; mo_ta: string | null; xong_at: string | null; xong_boi: string | null; created_by: string | null; created_at: string }
        Insert: { id?: string; muc_tieu_id: string; thu_tu?: number; tieu_de: string; phan_tram?: number; bat_dau?: string | null; ket_thuc?: string | null; mo_ta?: string | null; xong_at?: string | null; xong_boi?: string | null; created_by?: string | null; created_at?: string }
        Update: { id?: string; muc_tieu_id?: string; thu_tu?: number; tieu_de?: string; phan_tram?: number; bat_dau?: string | null; ket_thuc?: string | null; mo_ta?: string | null; xong_at?: string | null; xong_boi?: string | null; created_by?: string | null; created_at?: string }
        Relationships: []
      }
      moc_muc_tieu: {
        Row: {
          created_at: string
          created_by: string | null
          gia_tri: number
          id: string
          muc_tieu_id: string
          ngay: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          gia_tri: number
          id?: string
          muc_tieu_id: string
          ngay: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          gia_tri?: number
          id?: string
          muc_tieu_id?: string
          ngay?: string
        }
        Relationships: [
          {
            foreignKeyName: "moc_muc_tieu_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moc_muc_tieu_muc_tieu_id_fkey"
            columns: ["muc_tieu_id"]
            isOneToOne: false
            referencedRelation: "muc_tieu"
            referencedColumns: ["id"]
          },
        ]
      }
      mood_checkins: {
        Row: {
          buoi: string
          class_id: string | null
          created_at: string
          date: string
          id: string
          mood: Database["public"]["Enums"]["mood_level"]
          student_id: string
          updated_at: string
        }
        Insert: {
          buoi?: string
          class_id?: string | null
          created_at?: string
          date?: string
          id?: string
          mood: Database["public"]["Enums"]["mood_level"]
          student_id: string
          updated_at?: string
        }
        Update: {
          buoi?: string
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
      muc_tieu: {
        Row: {
          bat_dau: string
          campus_id: string
          cap: string
          chieu: string
          chu_the_key: string | null
          chua_do_x: boolean
          class_id: string | null
          created_at: string
          created_by: string | null
          dang_tap_trung: boolean
          don_vi_id: string | null
          dong_at: string | null
          dong_boi: string | null
          duyet_at: string | null
          duyet_boi: string | null
          gop_con: string | null
          gop_thanh_phan: string | null
          id: string
          ket_thuc: string
          kieu_dich: string
          ky: string | null
          lay_tu: string | null
          linh_vuc: Database["public"]["Enums"]["wig_domain"]
          ly_do_dong: string | null
          ly_do_tra_lai: string | null
          mau_id: string | null
          mo_ta: string | null
          loai_moc: string
          nam_hoc: string
          nguoi_nhap_ho: string | null
          nguon_he_thong: string | null
          nguon_so: string
          nguong_con: number | null
          nhom_id: string | null
          student_id: string | null
          subject_id: string | null
          ten: string
          trang_thai: string
          updated_at: string
          x_chu: string | null
          x_so: number | null
          y_chu: string | null
          y_so: number | null
        }
        Insert: {
          bat_dau?: string
          campus_id: string
          cap: string
          chieu?: string
          chu_the_key?: never
          chua_do_x?: boolean
          class_id?: string | null
          created_at?: string
          created_by?: string | null
          dang_tap_trung?: boolean
          don_vi_id?: string | null
          dong_at?: string | null
          dong_boi?: string | null
          duyet_at?: string | null
          duyet_boi?: string | null
          gop_con?: string | null
          gop_thanh_phan?: string | null
          id?: string
          ket_thuc: string
          kieu_dich?: string
          ky?: string | null
          lay_tu?: string | null
          linh_vuc?: Database["public"]["Enums"]["wig_domain"]
          ly_do_dong?: string | null
          ly_do_tra_lai?: string | null
          mau_id?: string | null
          mo_ta?: string | null
          loai_moc?: string
          nam_hoc?: string
          nguoi_nhap_ho?: string | null
          nguon_he_thong?: string | null
          nguon_so?: string
          nguong_con?: number | null
          nhom_id?: string | null
          student_id?: string | null
          subject_id?: string | null
          ten: string
          trang_thai?: string
          updated_at?: string
          x_chu?: string | null
          x_so?: number | null
          y_chu?: string | null
          y_so?: number | null
        }
        Update: {
          bat_dau?: string
          campus_id?: string
          cap?: string
          chieu?: string
          chu_the_key?: never
          chua_do_x?: boolean
          class_id?: string | null
          created_at?: string
          created_by?: string | null
          dang_tap_trung?: boolean
          don_vi_id?: string | null
          dong_at?: string | null
          dong_boi?: string | null
          duyet_at?: string | null
          duyet_boi?: string | null
          gop_con?: string | null
          gop_thanh_phan?: string | null
          id?: string
          ket_thuc?: string
          kieu_dich?: string
          ky?: string | null
          lay_tu?: string | null
          linh_vuc?: Database["public"]["Enums"]["wig_domain"]
          ly_do_dong?: string | null
          ly_do_tra_lai?: string | null
          mau_id?: string | null
          mo_ta?: string | null
          loai_moc?: string
          nam_hoc?: string
          nguoi_nhap_ho?: string | null
          nguon_he_thong?: string | null
          nguon_so?: string
          nguong_con?: number | null
          nhom_id?: string | null
          student_id?: string | null
          subject_id?: string | null
          ten?: string
          trang_thai?: string
          updated_at?: string
          x_chu?: string | null
          x_so?: number | null
          y_chu?: string | null
          y_so?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "muc_tieu_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "muc_tieu_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "muc_tieu_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "muc_tieu_don_vi_id_fkey"
            columns: ["don_vi_id"]
            isOneToOne: false
            referencedRelation: "don_vi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "muc_tieu_dong_boi_fkey"
            columns: ["dong_boi"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "muc_tieu_duyet_boi_fkey"
            columns: ["duyet_boi"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "muc_tieu_mau_id_fkey"
            columns: ["mau_id"]
            isOneToOne: false
            referencedRelation: "muc_tieu_mau"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "muc_tieu_nguoi_nhap_ho_fkey"
            columns: ["nguoi_nhap_ho"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "muc_tieu_nhom_id_fkey"
            columns: ["nhom_id"]
            isOneToOne: false
            referencedRelation: "nhom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "muc_tieu_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "muc_tieu_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      muc_tieu_mau: {
        Row: {
          chieu: string
          class_id: string
          created_at: string
          created_by: string | null
          don_vi_id: string | null
          id: string
          is_active: boolean
          kieu_dich: string
          linh_vuc: Database["public"]["Enums"]["wig_domain"]
          subject_id: string | null
          ten: string
          x_goi_y: number | null
          y_goi_y: number | null
        }
        Insert: {
          chieu?: string
          class_id: string
          created_at?: string
          created_by?: string | null
          don_vi_id?: string | null
          id?: string
          is_active?: boolean
          kieu_dich?: string
          linh_vuc: Database["public"]["Enums"]["wig_domain"]
          subject_id?: string | null
          ten: string
          x_goi_y?: number | null
          y_goi_y?: number | null
        }
        Update: {
          chieu?: string
          class_id?: string
          created_at?: string
          created_by?: string | null
          don_vi_id?: string | null
          id?: string
          is_active?: boolean
          kieu_dich?: string
          linh_vuc?: Database["public"]["Enums"]["wig_domain"]
          subject_id?: string | null
          ten?: string
          x_goi_y?: number | null
          y_goi_y?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "muc_tieu_mau_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "muc_tieu_mau_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "muc_tieu_mau_don_vi_id_fkey"
            columns: ["don_vi_id"]
            isOneToOne: false
            referencedRelation: "don_vi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "muc_tieu_mau_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      nhom: {
        Row: {
          class_id: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          loai: string
          ten: string
        }
        Insert: {
          class_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          loai?: string
          ten: string
        }
        Update: {
          class_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          loai?: string
          ten?: string
        }
        Relationships: [
          {
            foreignKeyName: "nhom_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nhom_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      nhom_thanh_vien: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          nhom_id: string
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          nhom_id: string
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          nhom_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nhom_thanh_vien_nhom_id_fkey"
            columns: ["nhom_id"]
            isOneToOne: false
            referencedRelation: "nhom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nhom_thanh_vien_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      noi: {
        Row: {
          cha_id: string
          con_id: string | null
          con_loai: string | null
          con_muc_tieu_id: string | null
          con_thuoc_id: string | null
          created_at: string
          created_by: string | null
          ghi_chu: string | null
          he_so: number
          id: string
          noi_tu_dong: boolean
          vai: string
        }
        Insert: {
          cha_id: string
          con_id?: never
          con_loai?: never
          con_muc_tieu_id?: string | null
          con_thuoc_id?: string | null
          created_at?: string
          created_by?: string | null
          ghi_chu?: string | null
          he_so?: number
          id?: string
          noi_tu_dong?: boolean
          vai: string
        }
        Update: {
          cha_id?: string
          con_id?: never
          con_loai?: never
          con_muc_tieu_id?: string | null
          con_thuoc_id?: string | null
          created_at?: string
          created_by?: string | null
          ghi_chu?: string | null
          he_so?: number
          id?: string
          noi_tu_dong?: boolean
          vai?: string
        }
        Relationships: [
          {
            foreignKeyName: "noi_cha_id_fkey"
            columns: ["cha_id"]
            isOneToOne: false
            referencedRelation: "muc_tieu"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "noi_con_muc_tieu_id_fkey"
            columns: ["con_muc_tieu_id"]
            isOneToOne: false
            referencedRelation: "muc_tieu"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "noi_con_thuoc_id_fkey"
            columns: ["con_thuoc_id"]
            isOneToOne: false
            referencedRelation: "thuoc"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "noi_created_by_fkey"
            columns: ["created_by"]
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
            isOneToOne: true
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
      pdr_ke_lai: {
        Row: {
          cam_ket_id: string
          created_at: string
          ghi_chu: string | null
          id: string
          ket_qua: string | null
          pdr_meeting_id: string
          so_dat: number | null
        }
        Insert: {
          cam_ket_id: string
          created_at?: string
          ghi_chu?: string | null
          id?: string
          ket_qua?: string | null
          pdr_meeting_id: string
          so_dat?: number | null
        }
        Update: {
          cam_ket_id?: string
          created_at?: string
          ghi_chu?: string | null
          id?: string
          ket_qua?: string | null
          pdr_meeting_id?: string
          so_dat?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pdr_ke_lai_cam_ket_id_fkey"
            columns: ["cam_ket_id"]
            isOneToOne: false
            referencedRelation: "cam_ket"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdr_ke_lai_pdr_meeting_id_fkey"
            columns: ["pdr_meeting_id"]
            isOneToOne: false
            referencedRelation: "pdr_meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      pdr_meetings: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          class_id: string
          counterpart_id: string | null
          created_at: string
          id: string
          nguoi_nhap_ho: string | null
          q1_plan: string | null
          q2_result: string | null
          q3_obstacle: string | null
          q4_overcome: string | null
          q5_better_way: string | null
          q6_commitment: string | null
          second_buddy_id: string | null
          student_id: string
          type: string
          week_label: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          class_id: string
          counterpart_id?: string | null
          created_at?: string
          id?: string
          nguoi_nhap_ho?: string | null
          q1_plan?: string | null
          q2_result?: string | null
          q3_obstacle?: string | null
          q4_overcome?: string | null
          q5_better_way?: string | null
          q6_commitment?: string | null
          second_buddy_id?: string | null
          student_id: string
          type: string
          week_label: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          class_id?: string
          counterpart_id?: string | null
          created_at?: string
          id?: string
          nguoi_nhap_ho?: string | null
          q1_plan?: string | null
          q2_result?: string | null
          q3_obstacle?: string | null
          q4_overcome?: string | null
          q5_better_way?: string | null
          q6_commitment?: string | null
          second_buddy_id?: string | null
          student_id?: string
          type?: string
          week_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "pdr_meetings_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdr_meetings_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdr_meetings_counterpart_id_fkey"
            columns: ["counterpart_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdr_meetings_nguoi_nhap_ho_fkey"
            columns: ["nguoi_nhap_ho"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdr_meetings_second_buddy_id_fkey"
            columns: ["second_buddy_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdr_meetings_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pdr_nhac_da_gui: {
        Row: {
          gui_luc: string
          loai: string
          ngay: string
          user_id: string
        }
        Insert: {
          gui_luc?: string
          loai: string
          ngay: string
          user_id: string
        }
        Update: {
          gui_luc?: string
          loai?: string
          ngay?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pdr_nhac_da_gui_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pdr_nhac_lan_chay: {
        Row: {
          chay_luc: string
          mot_dong: boolean
        }
        Insert: {
          chay_luc?: string
          mot_dong?: boolean
        }
        Update: {
          chay_luc?: string
          mot_dong?: boolean
        }
        Relationships: []
      }
      pdr_schedules: {
        Row: {
          buddy_pair_id: string | null
          class_id: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          monthly_day: number | null
          nhac_khi: string
          student_id: string | null
          time_slot: string | null
          type: string
          weekday: number | null
        }
        Insert: {
          buddy_pair_id?: string | null
          class_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          monthly_day?: number | null
          nhac_khi?: string
          student_id?: string | null
          time_slot?: string | null
          type: string
          weekday?: number | null
        }
        Update: {
          buddy_pair_id?: string | null
          class_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          monthly_day?: number | null
          nhac_khi?: string
          student_id?: string | null
          time_slot?: string | null
          type?: string
          weekday?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pdr_schedules_buddy_pair_id_fkey"
            columns: ["buddy_pair_id"]
            isOneToOne: false
            referencedRelation: "buddy_pairs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdr_schedules_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdr_schedules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdr_schedules_student_id_fkey"
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
      so_do: {
        Row: {
          created_at: string
          gia_tri: number
          id: string
          muc_tieu_id: string
          ngay: string
          nguoi_ghi: string | null
          nguoi_sua: string | null
          nguon: string
          nguon_ref: string | null
          student_id: string | null
          sua_at: string | null
          thanh_phan_id: string | null
        }
        Insert: {
          created_at?: string
          gia_tri: number
          id?: string
          muc_tieu_id: string
          ngay: string
          nguoi_ghi?: string | null
          nguoi_sua?: string | null
          nguon?: string
          nguon_ref?: string | null
          student_id?: string | null
          sua_at?: string | null
          thanh_phan_id?: string | null
        }
        Update: {
          created_at?: string
          gia_tri?: number
          id?: string
          muc_tieu_id?: string
          ngay?: string
          nguoi_ghi?: string | null
          nguoi_sua?: string | null
          nguon?: string
          nguon_ref?: string | null
          student_id?: string | null
          sua_at?: string | null
          thanh_phan_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "so_do_muc_tieu_id_fkey"
            columns: ["muc_tieu_id"]
            isOneToOne: false
            referencedRelation: "muc_tieu"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "so_do_nguoi_ghi_fkey"
            columns: ["nguoi_ghi"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "so_do_nguoi_sua_fkey"
            columns: ["nguoi_sua"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "so_do_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "so_do_thanh_phan_id_fkey"
            columns: ["thanh_phan_id"]
            isOneToOne: false
            referencedRelation: "thanh_phan"
            referencedColumns: ["id"]
          },
        ]
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
      thanh_phan: {
        Row: {
          created_at: string
          id: string
          muc_tieu_id: string
          nguong: number | null
          ten: string
          thu_tu: number
        }
        Insert: {
          created_at?: string
          id?: string
          muc_tieu_id: string
          nguong?: number | null
          ten: string
          thu_tu?: number
        }
        Update: {
          created_at?: string
          id?: string
          muc_tieu_id?: string
          nguong?: number | null
          ten?: string
          thu_tu?: number
        }
        Relationships: [
          {
            foreignKeyName: "thanh_phan_muc_tieu_id_fkey"
            columns: ["muc_tieu_id"]
            isOneToOne: false
            referencedRelation: "muc_tieu"
            referencedColumns: ["id"]
          },
        ]
      }
      thuoc: {
        Row: {
          cach_ghi: string
          chi_tieu_ky: number
          chieu_dich: string
          cho_bu: boolean
          chu_the: string
          chu_the_key: string | null
          class_id: string
          created_at: string
          created_by: string | null
          da_tung_duyet: boolean
          den_tuan: string | null
          don_vi_id: string
          duyet: string
          duyet_at: string | null
          duyet_boi: string | null
          gop: string
          id: string
          ky_tuan: number
          ly_do_tra_lai: string | null
          moi_lan: number | null
          ngay_ap_dung: number[]
          nguoi_nhap_ho: string | null
          nguon_he_thong: string | null
          nguong_moi_lan: number | null
          nhom_id: string | null
          pham_vi: string
          student_id: string | null
          subject_id: string | null
          ten: string
          toi_da_ngay: number | null
          trang_thai: string
          tu_tuan: string
          updated_at: string
        }
        Insert: {
          cach_ghi?: string
          chi_tieu_ky: number
          chieu_dich?: string
          cho_bu?: boolean
          chu_the: string
          chu_the_key?: never
          class_id: string
          created_at?: string
          created_by?: string | null
          da_tung_duyet?: boolean
          den_tuan?: string | null
          don_vi_id: string
          duyet?: string
          duyet_at?: string | null
          duyet_boi?: string | null
          gop?: string
          id?: string
          ky_tuan?: number
          ly_do_tra_lai?: string | null
          moi_lan?: number | null
          ngay_ap_dung?: number[]
          nguoi_nhap_ho?: string | null
          nguon_he_thong?: string | null
          nguong_moi_lan?: number | null
          nhom_id?: string | null
          pham_vi?: string
          student_id?: string | null
          subject_id?: string | null
          ten: string
          toi_da_ngay?: number | null
          trang_thai?: string
          tu_tuan: string
          updated_at?: string
        }
        Update: {
          cach_ghi?: string
          chi_tieu_ky?: number
          chieu_dich?: string
          cho_bu?: boolean
          chu_the?: string
          chu_the_key?: never
          class_id?: string
          created_at?: string
          created_by?: string | null
          da_tung_duyet?: boolean
          den_tuan?: string | null
          don_vi_id?: string
          duyet?: string
          duyet_at?: string | null
          duyet_boi?: string | null
          gop?: string
          id?: string
          ky_tuan?: number
          ly_do_tra_lai?: string | null
          moi_lan?: number | null
          ngay_ap_dung?: number[]
          nguoi_nhap_ho?: string | null
          nguon_he_thong?: string | null
          nguong_moi_lan?: number | null
          nhom_id?: string | null
          pham_vi?: string
          student_id?: string | null
          subject_id?: string | null
          ten?: string
          toi_da_ngay?: number | null
          trang_thai?: string
          tu_tuan?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "thuoc_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thuoc_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thuoc_don_vi_id_fkey"
            columns: ["don_vi_id"]
            isOneToOne: false
            referencedRelation: "don_vi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thuoc_duyet_boi_fkey"
            columns: ["duyet_boi"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thuoc_nguoi_nhap_ho_fkey"
            columns: ["nguoi_nhap_ho"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thuoc_nhom_id_fkey"
            columns: ["nhom_id"]
            isOneToOne: false
            referencedRelation: "nhom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thuoc_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thuoc_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      thuoc_lich_su: {
        Row: {
          chi_tieu_ky: number | null
          created_at: string
          duyet_at: string | null
          duyet_boi: string | null
          id: string
          la_ha: boolean
          ly_do: string | null
          moi_lan: number | null
          ngay_ap_dung: number[] | null
          nguoi_doi: string | null
          thuoc_id: string
          trang_thai: string
          tu_tuan: string
        }
        Insert: {
          chi_tieu_ky?: number | null
          created_at?: string
          duyet_at?: string | null
          duyet_boi?: string | null
          id?: string
          la_ha?: boolean
          ly_do?: string | null
          moi_lan?: number | null
          ngay_ap_dung?: number[] | null
          nguoi_doi?: string | null
          thuoc_id: string
          trang_thai?: string
          tu_tuan: string
        }
        Update: {
          chi_tieu_ky?: number | null
          created_at?: string
          duyet_at?: string | null
          duyet_boi?: string | null
          id?: string
          la_ha?: boolean
          ly_do?: string | null
          moi_lan?: number | null
          ngay_ap_dung?: number[] | null
          nguoi_doi?: string | null
          thuoc_id?: string
          trang_thai?: string
          tu_tuan?: string
        }
        Relationships: [
          {
            foreignKeyName: "thuoc_lich_su_duyet_boi_fkey"
            columns: ["duyet_boi"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thuoc_lich_su_nguoi_doi_fkey"
            columns: ["nguoi_doi"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thuoc_lich_su_thuoc_id_fkey"
            columns: ["thuoc_id"]
            isOneToOne: false
            referencedRelation: "thuoc"
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
          end_time: string | null
          id: string
          kind: string
          period_no: number
          room: string | null
          start_time: string | null
          subject: string | null
          subject_id: string | null
          teacher_name: string | null
        }
        Insert: {
          class_id: string
          created_at?: string
          day_of_week: number
          end_time?: string | null
          id?: string
          kind?: string
          period_no: number
          room?: string | null
          start_time?: string | null
          subject?: string | null
          subject_id?: string | null
          teacher_name?: string | null
        }
        Update: {
          class_id?: string
          created_at?: string
          day_of_week?: number
          end_time?: string | null
          id?: string
          kind?: string
          period_no?: number
          room?: string | null
          start_time?: string | null
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
      tuan_hoc: {
        Row: {
          campus_id: string
          created_at: string
          created_by: string | null
          loai: string
          week_start: string
        }
        Insert: {
          campus_id: string
          created_at?: string
          created_by?: string | null
          loai?: string
          week_start: string
        }
        Update: {
          campus_id?: string
          created_at?: string
          created_by?: string | null
          loai?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "tuan_hoc_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tuan_hoc_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      cam_ket_v: {
        Row: {
          cham_at: string | null
          cham_boi: string | null
          chu_the: string | null
          class_id: string | null
          created_at: string | null
          created_by: string | null
          don_vi_id: string | null
          goi_y: string | null
          goi_y_may: string | null
          id: string | null
          ket_qua: string | null
          lac_muc_tieu: boolean | null
          muc_tieu_id: string | null
          nguoi_nhap_ho: string | null
          nhom_id: string | null
          noi_dung: string | null
          pdr_meeting_id: string | null
          so_dat: number | null
          so_dat_goi_y: number | null
          so_hua: number | null
          so_tuan: number | null
          student_id: string | null
          ten_don_vi: string | null
          thuoc_id: string | null
          trang_thai: string | null
          tuan_bat_dau: string | null
          tuan_ket_thuc: string | null
          updated_at: string | null
          xong_at: string | null
        }
        Relationships: []
      }
      muc_tieu_v: {
        Row: {
          bat_dau: string | null
          campus_id: string | null
          cap: string | null
          chieu: string | null
          chu_the_key: string | null
          chua_do_x: boolean | null
          class_id: string | null
          created_at: string | null
          created_by: string | null
          dang_tap_trung: boolean | null
          dat: boolean | null
          don_vi_id: string | null
          dong_at: string | null
          dong_boi: string | null
          duyet_at: string | null
          duyet_boi: string | null
          gop_con: string | null
          gop_thanh_phan: string | null
          id: string | null
          ket_thuc: string | null
          kieu_dich: string | null
          ky: string | null
          ky_den: string | null
          ky_tu: string | null
          lay_tu: string | null
          le_ra: number | null
          linh_vuc: Database["public"]["Enums"]["wig_domain"] | null
          ly_do_dong: string | null
          ly_do_tra_lai: string | null
          mau_id: string | null
          mo_ta: string | null
          loai_moc: string
          mau_so: number | null
          nam_hoc: string | null
          ngay_nguon: string | null
          nguoi_nhap_ho: string | null
          nguon: string | null
          nguon_he_thong: string | null
          nguon_so: string | null
          nguong_con: number | null
          nhom_id: string | null
          pct: number | null
          so: number | null
          so_ky_giu: number | null
          so_ky_xet: number | null
          so_nguon: number | null
          student_id: string | null
          subject_id: string | null
          ten: string | null
          ten_don_vi: string | null
          trang_thai: string | null
          trang_thai_do: string | null
          tu_so: number | null
          updated_at: string | null
          x: number | null
          x_chu: string | null
          x_so: number | null
          y: number | null
          y_chu: string | null
          y_so: number | null
        }
        Relationships: []
      }
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
      apply_class_transfer: { Args: { p_student: string; p_to_class: string }; Returns: undefined }
      auth_campus: { Args: never; Returns: string }
      auth_role: { Args: never; Returns: Database["public"]["Enums"]["user_role"] }
      bang_lop_em: {
        Args: { p_class: string; p_tuan?: string }
        Returns: {
          ck_thang: number
          ck_tong: number
          ho_ten: string
          mt_tong: number
          pdr_da_ky: boolean
          student_id: string
          thuoc_dat: number
          thuoc_tong: number
        }[]
      }
      bang_lop_thuoc: {
        Args: { p_class: string; p_tuan?: string }
        Returns: {
          chu_the: string
          gia_lop: number
          le_ra: number
          mien: boolean
          si_so: number
          so_em_dat: number
          so_em_ghi: number
          ten: string
          thuoc_id: string
          trang_thai: string
        }[]
      }
      bang_ron: {
        Args: { p_student?: string }
        Returns: {
          ck_giu: number
          ck_tong: number
          ti_le: number
          trang_thai: string
          viec_dung_nhip: number
          viec_tong: number
        }[]
      }
      muc_tieu_lich_su_tuan: {
        Args: { p_muc_tieu: string; p_so_tuan?: number }
        Returns: { tuan_ket: string; so: number }[]
      }
      cam_ket_da_ke_lai: { Args: { k: string }; Returns: boolean }
      cam_ket_student: { Args: { k: string }; Returns: string }
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
      can_read_subject_score: { Args: { p_review: string; p_subject: string }; Returns: boolean }
      can_view_student: { Args: { s: string }; Returns: boolean }
      can_write_subject_score: { Args: { p_review: string; p_subject: string }; Returns: boolean }
      cancel_class_transfer: { Args: { p_request: string }; Returns: undefined }
      checkin_windows: {
        Args: { p_campus: string }
        Returns: {
          chieu_dong: string
          chieu_mo: string
          het_dung_gio: string
          het_muon: string
          mo_luc: string
        }[]
      }
      chua_check_in: {
        Args: { p_class: string; p_date?: string }
        Returns: {
          student_id: string
          student_name: string
        }[]
      }
      class_attendance_day: {
        Args: { p_class: string; p_date?: string }
        Returns: {
          gio_bam: string
          ho_ten: string
          nguoi_danh: string
          student_id: string
          trang_thai: string
          tu_dong: boolean
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
      co_so_tong_hop: {
        Args: { p_tuan?: string }
        Returns: {
          cho_duyet: number
          ck_giu_pct: number
          class_id: string
          class_name: string
          grade_name: string
          grade_sort: number
          gvcn_ten: string
          mt_lop_can_co: number
          mt_lop_dang_thang: number
          mt_lop_duyet: number
          mt_pct: number
          pdr_ky_pct: number
          si_so: number
          thuoc_dat_pct: number
        }[]
      }
      current_school_year: { Args: never; Returns: string }
      decide_class_transfer: { Args: { p_approve: boolean; p_note?: string; p_request: string }; Returns: string }
      default_score_weight: { Args: { k: Database["public"]["Enums"]["score_kind"] }; Returns: number }
      doc_duoc_cam_ket: { Args: { k: string }; Returns: boolean }
      doc_duoc_chu_the: { Args: { p_campus: string; p_cap: string; p_class: string; p_nhom: string; p_student: string }; Returns: boolean }
      doc_duoc_con: { Args: { p_id: string; p_loai: string }; Returns: boolean }
      doc_duoc_muc_tieu: { Args: { m: string }; Returns: boolean }
      doc_duoc_thuoc: { Args: { t: string }; Returns: boolean }
      duyet_duoc_chu_the: { Args: { p_campus: string; p_cap: string; p_class: string; p_nhom: string; p_student: string }; Returns: boolean }
      duyet_duoc_muc_tieu: { Args: { m: string }; Returns: boolean }
      duyet_duoc_thuoc: { Args: { t: string }; Returns: boolean }
      em_trong_nhom: { Args: { n: string; s: string }; Returns: boolean }
      enroll_student_by_email: { Args: { p_class: string; p_email: string }; Returns: string }
      ghi_duoc_cam_ket: { Args: { k: string }; Returns: boolean }
      ghi_duoc_chu_the: { Args: { p_campus: string; p_cap: string; p_class: string; p_nhom: string; p_student: string }; Returns: boolean }
      ghi_duoc_con: { Args: { p_id: string; p_loai: string }; Returns: boolean }
      ghi_duoc_muc_tieu: { Args: { m: string }; Returns: boolean }
      ghi_duoc_pdr_ke_lai: { Args: { m: string }; Returns: boolean }
      ghi_duoc_thuoc: { Args: { t: string }; Returns: boolean }
      ghi_ho_duoc_luot: { Args: { t: string }; Returns: boolean }
      goi_y_cam_ket: {
        Args: { p_cam_ket: string }
        Returns: {
          goi_y: string
          so_dat_goi_y: number
          thuoc_trang_thai: string
        }[]
      }
      ham_lay_ngay_may_chu: {
        Args: never
        Returns: {
          ten: string
        }[]
      }
      homework_class: { Args: { p: string }; Returns: string }
      invite_student_to_class: { Args: { p_class: string; p_email: string }; Returns: string }
      ip_allowed: { Args: { p_ip: string }; Returns: boolean }
      is_attendance_leader: { Args: { c: string }; Returns: boolean }
      is_campus_class: { Args: { c: string }; Returns: boolean }
      is_class_student: { Args: { c: string }; Returns: boolean }
      is_class_teacher: { Args: { c: string }; Returns: boolean }
      is_classmate_via_leader: { Args: { s: string }; Returns: boolean }
      is_enrolled: { Args: { c: string; s: string }; Returns: boolean }
      is_my_buddy: { Args: { s: string }; Returns: boolean }
      is_my_campus: { Args: { c: string }; Returns: boolean }
      is_my_child: { Args: { s: string }; Returns: boolean }
      is_my_student: { Args: { s: string }; Returns: boolean }
      is_my_subject_student: { Args: { s: string }; Returns: boolean }
      is_parent_of_class: { Args: { c: string }; Returns: boolean }
      is_pdr_participant: { Args: { m: string }; Returns: boolean }
      is_subject_teacher_of_class: { Args: { c: string }; Returns: boolean }
      la_gvbm_mon: { Args: { c: string; s: string }; Returns: boolean }
      la_thanh_vien_nhom: { Args: { n: string }; Returns: boolean }
      la_to_truong_diem_danh: { Args: { c: string }; Returns: boolean }
      log_audit: { Args: { p_action: string; p_detail?: Json }; Returns: undefined }
      lop_nhap_ho: { Args: { c: string }; Returns: boolean }
      luot_bi_khoa: { Args: { p_ngay: string; p_student: string }; Returns: boolean }
      mark_attendance: { Args: { p_class: string; p_status: Database["public"]["Enums"]["attendance_status"]; p_student: string }; Returns: undefined }
      mark_attendance_on: { Args: { p_class: string; p_date: string; p_status: Database["public"]["Enums"]["attendance_status"]; p_student: string }; Returns: undefined }
      metrics_tuan: {
        Args: { p_class: string; p_den?: string; p_student?: string; p_tu: string }
        Returns: {
          ck_chua_cham: number
          ck_thang: number
          ck_thua: number
          ck_tong: number
          pdr_da_ky: boolean
          student_id: string
          thuoc_dat: number
          thuoc_mien: number
          thuoc_tong: number
          week_start: string
        }[]
      }
      muc_tieu_class: { Args: { m: string }; Returns: string }
      muc_tieu_lop_dem: {
        Args: { p_muc_tieu: string }
        Returns: {
          si_so: number
          so_dat: number
          so_huong_vao: number
        }[]
      }
      muc_tieu_student: { Args: { m: string }; Returns: string }
      nguoi_duyet: {
        Args: never
        Returns: {
          email: string
          full_name: string
        }[]
      }
      nhom_class: { Args: { n: string }; Returns: string }
      open_term_for_class: { Args: { p_class: string; p_term: string }; Returns: number }
      pdr_chu_ky_hop_le: { Args: { p_by: string; p_class: string; p_counterpart: string; p_second: string; p_student: string; p_type: string }; Returns: boolean }
      pdr_class: { Args: { m: string }; Returns: string }
      pdr_da_ky: { Args: { d: string; p_student: string }; Returns: boolean }
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
      request_class_transfer: { Args: { p_note?: string; p_student: string; p_to_class: string }; Returns: string }
      restrict_signup_by_email_domain: { Args: { event: Json }; Returns: Json }
      review_class: { Args: { r: string }; Returns: string }
      review_is_editable: { Args: { r: string }; Returns: boolean }
      review_visible_to_family: { Args: { r: string }; Returns: boolean }
      seed_class_subjects: { Args: { p_class: string }; Returns: number }
      seed_grades_for_campus: { Args: { p_campus: string }; Returns: number }
      set_my_campus_levels: { Args: { p_levels: Database["public"]["Enums"]["school_level"][] }; Returns: number }
      set_my_mood: { Args: { p_mood: Database["public"]["Enums"]["mood_level"] }; Returns: undefined }
      sinh_nhac_pdr: { Args: never; Returns: number }
      sinh_nhac_pdr_luc: { Args: { p_luc: string }; Returns: number }
      staff_can_manage_class: { Args: { c: string }; Returns: boolean }
      staff_can_read_class: { Args: { c: string }; Returns: boolean }
      standard_grade_numbers: { Args: { p_level: Database["public"]["Enums"]["school_level"] }; Returns: number[] }
      standard_grade_numbers_multi: { Args: { p_levels: Database["public"]["Enums"]["school_level"][] }; Returns: number[] }
      student_checkin: { Args: { p_buoi?: string; p_ip: string; p_mood: Database["public"]["Enums"]["mood_level"]; p_student: string }; Returns: string }
      subject_fits_class: { Args: { p_class: string; p_subject: string }; Returns: boolean }
      subject_fits_grade: { Args: { p_class: string; p_subject: string }; Returns: boolean }
      subject_roster: {
        Args: { p_class: string; p_term: string }
        Returns: {
          con_hoc: boolean
          full_name: string
          review_id: string
          student_id: string
        }[]
      }
      tao_buddy_nhom: { Args: { p_class: string; p_members: string[] }; Returns: undefined }
      ten_hien_thi: { Args: { p_email: string; p_full_name: string }; Returns: string }
      term_is_locked: { Args: { t: string }; Returns: boolean }
      thi_dua_lop: {
        Args: { p_class: string }
        Returns: {
          diem_cam_ket: number
          diem_muc_tieu: number
          diem_thuoc: number
        }[]
      }
      thu_hai_tu_nhan: { Args: { nhan: string }; Returns: string }
      thuoc_12_tuan: {
        Args: { p_chu_the?: string; p_thuoc: string; p_tuan_cuoi?: string }
        Returns: {
          chi_tieu: number
          dat: boolean
          gia: number
          ky_den: string
          ky_tu: string
          la_tuan_hoc: boolean
          le_ra: number
          trang_thai: string
          tuan: string
        }[]
      }
      thuoc_class: { Args: { t: string }; Returns: string }
      thuoc_co_so: { Args: { p_campus: string }; Returns: boolean }
      thuoc_lop_dem: {
        Args: { p_thuoc: string; p_tuan?: string }
        Returns: {
          chi_tieu: number
          gia_lop: number
          le_ra: number
          mien: boolean
          si_so: number
          so_em_dat: number
          so_em_ghi: number
        }[]
      }
      thuoc_nhan_luot: { Args: { p_student: string; t: string }; Returns: boolean }
      toi_dich: { Args: { p_dich: number; p_so: number; p_xuat_phat: number }; Returns: boolean }
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
      trong_cua_so_ghi: { Args: { p_ngay: string }; Returns: boolean }
      truong_da_khai_mang: { Args: never; Returns: boolean }
      ty_le_em_tu_dat: {
        Args: { p_class: string }
        Returns: {
          so_muc_tieu: number
          so_nhap_ho: number
          so_tu_dat: number
          ty_le: number
        }[]
      }
      unenroll_student: { Args: { p_class: string; p_student: string }; Returns: undefined }
      viec_bang: {
        Args: { p_student?: string }
        Returns: {
          cach_ghi: string
          chi_tieu: number
          chi_xem: boolean
          chieu_dich: string
          cho_bu: boolean
          chu_the: string
          dat: boolean
          gia: number
          ky_den: string
          ky_tu: string
          ky_tuan: number
          le_ra: number
          ngay_ap_dung: number[]
          ten: string
          ten_don_vi: string
          thuoc_id: string
          trang_thai: string
        }[]
      }
      vn_today: { Args: never; Returns: string }
      vn_week_start: { Args: { d?: string }; Returns: string }
      xac_nhan_duoc_cam_ket: { Args: { k: string }; Returns: boolean }
    }
    Enums: {
      assessment_term_kind: "giua_ky_1" | "hoc_ky_1" | "giua_ky_2" | "hoc_ky_2" | "ca_nam"
      attendance_status: "present" | "absent" | "late" | "excused"
      conduct_rating: "tot" | "kha" | "trung_binh" | "yeu"
      homework_kind: "assignment" | "reminder" | "exam"
      meal_slot: "breakfast" | "lunch" | "snack" | "dinner"
      mood_level: "great" | "good" | "ok" | "low" | "bad" | "happy" | "okay" | "sad" | "tired" | "worried" | "angry"
      school_level: "mam_non" | "tieu_hoc" | "thcs" | "thpt"
      score_category: "knowledge" | "leadership_skills" | "character" | "physical_wellbeing"
      score_kind: "mieng" | "15p" | "1tiet" | "giua_ky" | "cuoi_ky"
      user_role: "admin" | "principal" | "teacher" | "student" | "parent" | "pending"
      wig_domain: "knowledge" | "leadership_skills" | "character" | "physical_wellbeing" | "khac"
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
      assessment_term_kind: ["giua_ky_1", "hoc_ky_1", "giua_ky_2", "hoc_ky_2", "ca_nam"],
      attendance_status: ["present", "absent", "late", "excused"],
      conduct_rating: ["tot", "kha", "trung_binh", "yeu"],
      homework_kind: ["assignment", "reminder", "exam"],
      meal_slot: ["breakfast", "lunch", "snack", "dinner"],
      mood_level: ["great", "good", "ok", "low", "bad", "happy", "okay", "sad", "tired", "worried", "angry"],
      school_level: ["mam_non", "tieu_hoc", "thcs", "thpt"],
      score_category: ["knowledge", "leadership_skills", "character", "physical_wellbeing"],
      score_kind: ["mieng", "15p", "1tiet", "giua_ky", "cuoi_ky"],
      user_role: ["admin", "principal", "teacher", "student", "parent", "pending"],
      wig_domain: ["knowledge", "leadership_skills", "character", "physical_wellbeing", "khac"],
    },
  },
} as const
