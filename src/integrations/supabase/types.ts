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
    PostgrestVersion: "13.0.5"
  }
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
      admin_link_managers: {
        Row: {
          created_at: string
          created_by: string | null
          is_active: boolean
          notes: string | null
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          is_active?: boolean
          notes?: string | null
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          is_active?: boolean
          notes?: string | null
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_manager_city_scopes: {
        Row: {
          city_id: string
          created_at: string
          created_by: string | null
          user_id: string
        }
        Insert: {
          city_id: string
          created_at?: string
          created_by?: string | null
          user_id: string
        }
        Update: {
          city_id?: string
          created_at?: string
          created_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_manager_city_scopes_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_manager_city_scopes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_link_managers"
            referencedColumns: ["user_id"]
          },
        ]
      }
      admin_settings_audit: {
        Row: {
          action: string
          actor_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          id: string
          reason: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          id?: string
          reason?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          id?: string
          reason?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      admin_super_users: {
        Row: {
          created_at: string
          created_by: string | null
          is_active: boolean
          notes: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          is_active?: boolean
          notes?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          is_active?: boolean
          notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      backend_closure_records: {
        Row: {
          closure_key: string
          created_at: string
          id: number
          payload: Json
        }
        Insert: {
          closure_key: string
          created_at?: string
          id?: number
          payload: Json
        }
        Update: {
          closure_key?: string
          created_at?: string
          id?: number
          payload?: Json
        }
        Relationships: []
      }
      calendar_occurrence_quarantine: {
        Row: {
          created_at: string | null
          event_id: string | null
          id: string
          occurrence_id: string | null
          payload: Json | null
          reason: string
        }
        Insert: {
          created_at?: string | null
          event_id?: string | null
          id?: string
          occurrence_id?: string | null
          payload?: Json | null
          reason: string
        }
        Update: {
          created_at?: string | null
          event_id?: string | null
          id?: string
          occurrence_id?: string | null
          payload?: Json | null
          reason?: string
        }
        Relationships: []
      }
      calendar_occurrences: {
        Row: {
          city_id: string | null
          city_slug: string | null
          created_at: string
          event_id: string
          id: string
          instance_end: string | null
          instance_start: string
          is_override: boolean
          lifecycle_status: string | null
          override_payload: Json | null
          source: string
          updated_at: string
          venue_id: string | null
        }
        Insert: {
          city_id?: string | null
          city_slug?: string | null
          created_at?: string
          event_id: string
          id?: string
          instance_end?: string | null
          instance_start: string
          is_override?: boolean
          lifecycle_status?: string | null
          override_payload?: Json | null
          source?: string
          updated_at?: string
          venue_id?: string | null
        }
        Update: {
          city_id?: string | null
          city_slug?: string | null
          created_at?: string
          event_id?: string
          id?: string
          instance_end?: string | null
          instance_start?: string
          is_override?: boolean
          lifecycle_status?: string | null
          override_payload?: Json | null
          source?: string
          updated_at?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_occurrences_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_occurrences_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_instances"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "calendar_occurrences_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_occurrences_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_event_page_snapshot"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "fk_calendar_occurrences_venue_id"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "admin_venues_read"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_calendar_occurrences_venue_id"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "admin_venues_read"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "fk_calendar_occurrences_venue_id"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_city_audit_view"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "fk_calendar_occurrences_venue_id"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      cities: {
        Row: {
          country_code: string
          country_name: string | null
          created_at: string | null
          header_image_url: string | null
          id: string
          is_active: boolean | null
          name: string
          population: number | null
          slug: string
          timezone: string
        }
        Insert: {
          country_code: string
          country_name?: string | null
          created_at?: string | null
          header_image_url?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          population?: number | null
          slug: string
          timezone?: string
        }
        Update: {
          country_code?: string
          country_name?: string | null
          created_at?: string | null
          header_image_url?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          population?: number | null
          slug?: string
          timezone?: string
        }
        Relationships: [
          {
            foreignKeyName: "cities_id_fkey_entities"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cities_id_fkey_entities"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "organiser_admin_dashboard_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cities_id_fkey_entities"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "organiser_admin_dashboard_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cities_id_fkey_entities"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "organisers"
            referencedColumns: ["id"]
          },
        ]
      }
      city_aliases: {
        Row: {
          alias: string
          city_id: string
          created_at: string
          id: string
          normalized_alias: string | null
        }
        Insert: {
          alias: string
          city_id: string
          created_at?: string
          id?: string
          normalized_alias?: string | null
        }
        Update: {
          alias?: string
          city_id?: string
          created_at?: string
          id?: string
          normalized_alias?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "city_aliases_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      city_deprecation_usage_audit: {
        Row: {
          actor_user_id: string | null
          created_at: string
          endpoint: string | null
          id: string
          legacy_city: string | null
          legacy_city_slug: string | null
          payload: Json | null
          processed: boolean | null
          processed_at: string | null
          processing_notes: string | null
          provided_city_id: string | null
          resolution_metadata: Json | null
          resolution_status: string | null
          resolved_city_id: string | null
          source: string | null
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          endpoint?: string | null
          id?: string
          legacy_city?: string | null
          legacy_city_slug?: string | null
          payload?: Json | null
          processed?: boolean | null
          processed_at?: string | null
          processing_notes?: string | null
          provided_city_id?: string | null
          resolution_metadata?: Json | null
          resolution_status?: string | null
          resolved_city_id?: string | null
          source?: string | null
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          endpoint?: string | null
          id?: string
          legacy_city?: string | null
          legacy_city_slug?: string | null
          payload?: Json | null
          processed?: boolean | null
          processed_at?: string | null
          processing_notes?: string | null
          provided_city_id?: string | null
          resolution_metadata?: Json | null
          resolution_status?: string | null
          resolved_city_id?: string | null
          source?: string | null
        }
        Relationships: []
      }
      city_requests: {
        Row: {
          context: string | null
          created_at: string
          id: string
          notes: string | null
          requested_by: string | null
          requested_name: string
          requested_slug: string | null
          status: string
        }
        Insert: {
          context?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          requested_by?: string | null
          requested_name: string
          requested_slug?: string | null
          status?: string
        }
        Update: {
          context?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          requested_by?: string | null
          requested_name?: string
          requested_slug?: string | null
          status?: string
        }
        Relationships: []
      }
      countries: {
        Row: {
          code: string
          created_at: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          name?: string
        }
        Relationships: []
      }
      dancer_profiles: {
        Row: {
          achievements: string[]
          avatar_url: string | null
          based_city_id: string | null
          created_at: string
          created_by: string | null
          dance_role: string | null
          dance_started_year: number | null
          facebook: string | null
          favorite_songs: string[]
          favorite_styles: string[]
          first_name: string | null
          gallery_urls: string[]
          id: string
          instagram: string | null
          is_active: boolean | null
          looking_for_partner: boolean
          meta_data: Json
          nationality: string | null
          partner_details: string | null
          partner_practice_goals: string[]
          partner_search_level: string[]
          partner_search_role: string | null
          person_entity_id: string | null
          profile_source: string | null
          surname: string | null
          updated_at: string
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          achievements?: string[]
          avatar_url?: string | null
          based_city_id?: string | null
          created_at?: string
          created_by?: string | null
          dance_role?: string | null
          dance_started_year?: number | null
          facebook?: string | null
          favorite_songs?: string[]
          favorite_styles?: string[]
          first_name?: string | null
          gallery_urls?: string[]
          id: string
          instagram?: string | null
          is_active?: boolean | null
          looking_for_partner?: boolean
          meta_data?: Json
          nationality?: string | null
          partner_details?: string | null
          partner_practice_goals?: string[]
          partner_search_level?: string[]
          partner_search_role?: string | null
          person_entity_id?: string | null
          profile_source?: string | null
          surname?: string | null
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          achievements?: string[]
          avatar_url?: string | null
          based_city_id?: string | null
          created_at?: string
          created_by?: string | null
          dance_role?: string | null
          dance_started_year?: number | null
          facebook?: string | null
          favorite_songs?: string[]
          favorite_styles?: string[]
          first_name?: string | null
          gallery_urls?: string[]
          id?: string
          instagram?: string | null
          is_active?: boolean | null
          looking_for_partner?: boolean
          meta_data?: Json
          nationality?: string | null
          partner_details?: string | null
          partner_practice_goals?: string[]
          partner_search_level?: string[]
          partner_search_role?: string | null
          person_entity_id?: string | null
          profile_source?: string | null
          surname?: string | null
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dancer_profiles_based_city_id_fkey"
            columns: ["based_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dancer_profiles_person_entity_id_fkey"
            columns: ["person_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dancer_profiles_person_entity_id_fkey"
            columns: ["person_entity_id"]
            isOneToOne: false
            referencedRelation: "organiser_admin_dashboard_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dancer_profiles_person_entity_id_fkey"
            columns: ["person_entity_id"]
            isOneToOne: false
            referencedRelation: "organiser_admin_dashboard_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dancer_profiles_person_entity_id_fkey"
            columns: ["person_entity_id"]
            isOneToOne: false
            referencedRelation: "organisers"
            referencedColumns: ["id"]
          },
        ]
      }
      dancer_profiles_legacy_backup: {
        Row: {
          avatar_url: string
          created_at: string | null
          dance_role: string
          dance_started_month: number | null
          dance_started_year: number | null
          is_public: boolean
          nationality_code: string | null
          user_id: string
        }
        Insert: {
          avatar_url: string
          created_at?: string | null
          dance_role: string
          dance_started_month?: number | null
          dance_started_year?: number | null
          is_public?: boolean
          nationality_code?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string
          created_at?: string | null
          dance_role?: string
          dance_started_month?: number | null
          dance_started_year?: number | null
          is_public?: boolean
          nationality_code?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dancer_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "member_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dancer_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "member_profiles_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_dancer_profiles_nationality_code_countries_code"
            columns: ["nationality_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
        ]
      }
      dancers_archive_april2026: {
        Row: {
          achievements: string[] | null
          city_id: string | null
          country_code: string | null
          created_at: string | null
          dancing_start_date: string | null
          facebook: string | null
          favorite_songs: string[] | null
          favorite_styles: string[] | null
          first_name: string | null
          id: string
          instagram: string | null
          looking_for_partner: boolean | null
          nationality: string | null
          partner_details: Json | null
          partner_practice_goals: string[] | null
          partner_role: string | null
          partner_search_level: string[] | null
          partner_search_role: string | null
          photo_url: string | null
          surname: string | null
          user_id: string
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          achievements?: string[] | null
          city_id?: string | null
          country_code?: string | null
          created_at?: string | null
          dancing_start_date?: string | null
          facebook?: string | null
          favorite_songs?: string[] | null
          favorite_styles?: string[] | null
          first_name?: string | null
          id?: string
          instagram?: string | null
          looking_for_partner?: boolean | null
          nationality?: string | null
          partner_details?: Json | null
          partner_practice_goals?: string[] | null
          partner_role?: string | null
          partner_search_level?: string[] | null
          partner_search_role?: string | null
          photo_url?: string | null
          surname?: string | null
          user_id: string
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          achievements?: string[] | null
          city_id?: string | null
          country_code?: string | null
          created_at?: string | null
          dancing_start_date?: string | null
          facebook?: string | null
          favorite_songs?: string[] | null
          favorite_styles?: string[] | null
          first_name?: string | null
          id?: string
          instagram?: string | null
          looking_for_partner?: boolean | null
          nationality?: string | null
          partner_details?: Json | null
          partner_practice_goals?: string[] | null
          partner_role?: string | null
          partner_search_level?: string[] | null
          partner_search_role?: string | null
          photo_url?: string | null
          surname?: string | null
          user_id?: string
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dancers_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dancers_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
        ]
      }
      dj_profiles: {
        Row: {
          bio: string | null
          booking_email: string | null
          city: string | null
          city_id: string | null
          country: string | null
          country_code: string | null
          created_at: string | null
          created_by: string | null
          dj_name: string
          email: string | null
          facebook: string | null
          faq: string | null
          first_name: string | null
          gallery_urls: string[] | null
          genres: string[] | null
          hide_real_name: boolean | null
          id: string
          instagram: string | null
          is_active: boolean | null
          meta_data: Json | null
          mixcloud: string | null
          music_styles: string[] | null
          name: string | null
          nationality: string | null
          person_entity_id: string | null
          phone: string | null
          photo_url: string | null
          pricing: string | null
          profile_source: string | null
          public_email: string | null
          real_name: string | null
          sample_mix_urls: string[] | null
          soundcloud: string | null
          surname: string | null
          upcoming_events: string[] | null
          updated_at: string | null
          user_id: string | null
          verified: boolean | null
          website: string | null
          whatsapp: string | null
          youtube: string | null
          youtube_url: string | null
        }
        Insert: {
          bio?: string | null
          booking_email?: string | null
          city?: string | null
          city_id?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string | null
          created_by?: string | null
          dj_name: string
          email?: string | null
          facebook?: string | null
          faq?: string | null
          first_name?: string | null
          gallery_urls?: string[] | null
          genres?: string[] | null
          hide_real_name?: boolean | null
          id?: string
          instagram?: string | null
          is_active?: boolean | null
          meta_data?: Json | null
          mixcloud?: string | null
          music_styles?: string[] | null
          name?: string | null
          nationality?: string | null
          person_entity_id?: string | null
          phone?: string | null
          photo_url?: string | null
          pricing?: string | null
          profile_source?: string | null
          public_email?: string | null
          real_name?: string | null
          sample_mix_urls?: string[] | null
          soundcloud?: string | null
          surname?: string | null
          upcoming_events?: string[] | null
          updated_at?: string | null
          user_id?: string | null
          verified?: boolean | null
          website?: string | null
          whatsapp?: string | null
          youtube?: string | null
          youtube_url?: string | null
        }
        Update: {
          bio?: string | null
          booking_email?: string | null
          city?: string | null
          city_id?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string | null
          created_by?: string | null
          dj_name?: string
          email?: string | null
          facebook?: string | null
          faq?: string | null
          first_name?: string | null
          gallery_urls?: string[] | null
          genres?: string[] | null
          hide_real_name?: boolean | null
          id?: string
          instagram?: string | null
          is_active?: boolean | null
          meta_data?: Json | null
          mixcloud?: string | null
          music_styles?: string[] | null
          name?: string | null
          nationality?: string | null
          person_entity_id?: string | null
          phone?: string | null
          photo_url?: string | null
          pricing?: string | null
          profile_source?: string | null
          public_email?: string | null
          real_name?: string | null
          sample_mix_urls?: string[] | null
          soundcloud?: string | null
          surname?: string | null
          upcoming_events?: string[] | null
          updated_at?: string | null
          user_id?: string | null
          verified?: boolean | null
          website?: string | null
          whatsapp?: string | null
          youtube?: string | null
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dj_profiles_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dj_profiles_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "dj_profiles_person_entity_id_fkey"
            columns: ["person_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dj_profiles_person_entity_id_fkey"
            columns: ["person_entity_id"]
            isOneToOne: false
            referencedRelation: "organiser_admin_dashboard_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dj_profiles_person_entity_id_fkey"
            columns: ["person_entity_id"]
            isOneToOne: false
            referencedRelation: "organiser_admin_dashboard_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dj_profiles_person_entity_id_fkey"
            columns: ["person_entity_id"]
            isOneToOne: false
            referencedRelation: "organisers"
            referencedColumns: ["id"]
          },
        ]
      }
      djs: {
        Row: {
          bio: string | null
          city: string | null
          created_at: string | null
          genres: string[] | null
          id: string
          instagram: string | null
          is_verified: boolean | null
          mixcloud: string | null
          name: string
          photo_url: string | null
          soundcloud: string | null
          user_id: string | null
          website: string | null
        }
        Insert: {
          bio?: string | null
          city?: string | null
          created_at?: string | null
          genres?: string[] | null
          id?: string
          instagram?: string | null
          is_verified?: boolean | null
          mixcloud?: string | null
          name: string
          photo_url?: string | null
          soundcloud?: string | null
          user_id?: string | null
          website?: string | null
        }
        Update: {
          bio?: string | null
          city?: string | null
          created_at?: string | null
          genres?: string[] | null
          id?: string
          instagram?: string | null
          is_verified?: boolean | null
          mixcloud?: string | null
          name?: string
          photo_url?: string | null
          soundcloud?: string | null
          user_id?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "djs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      edge_auth_bootstrap_manifest: {
        Row: {
          canonical_role: string
          env_requirements: Json
          function_name: string
          id: number
          recorded_at: string
          require_jwt: boolean
        }
        Insert: {
          canonical_role: string
          env_requirements: Json
          function_name: string
          id?: number
          recorded_at?: string
          require_jwt: boolean
        }
        Update: {
          canonical_role?: string
          env_requirements?: Json
          function_name?: string
          id?: number
          recorded_at?: string
          require_jwt?: boolean
        }
        Relationships: []
      }
      entities: {
        Row: {
          address: string | null
          avatar_url: string | null
          bio: string | null
          capacity: number | null
          city: string | null
          city_id: string | null
          claimed_by: string | null
          closest_transport: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          facilities: Json | null
          floor_type: Json | null
          gallery_urls: Json | null
          google_maps_url: string | null
          id: string
          instagram: string | null
          is_active: boolean | null
          meta_data: Json | null
          name: string
          opening_hours: Json | null
          organisation_category: string | null
          parking: string | null
          profile_source: string | null
          socials: Json | null
          type: string
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          bio?: string | null
          capacity?: number | null
          city?: string | null
          city_id?: string | null
          claimed_by?: string | null
          closest_transport?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          facilities?: Json | null
          floor_type?: Json | null
          gallery_urls?: Json | null
          google_maps_url?: string | null
          id?: string
          instagram?: string | null
          is_active?: boolean | null
          meta_data?: Json | null
          name: string
          opening_hours?: Json | null
          organisation_category?: string | null
          parking?: string | null
          profile_source?: string | null
          socials?: Json | null
          type: string
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          bio?: string | null
          capacity?: number | null
          city?: string | null
          city_id?: string | null
          claimed_by?: string | null
          closest_transport?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          facilities?: Json | null
          floor_type?: Json | null
          gallery_urls?: Json | null
          google_maps_url?: string | null
          id?: string
          instagram?: string | null
          is_active?: boolean | null
          meta_data?: Json | null
          name?: string
          opening_hours?: Json | null
          organisation_category?: string | null
          parking?: string | null
          profile_source?: string | null
          socials?: Json | null
          type?: string
          updated_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entities_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      event_attendance: {
        Row: {
          created_at: string | null
          id: string
          occurrence_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          occurrence_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          occurrence_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_attendance_occurrence_id_fkey"
            columns: ["occurrence_id"]
            isOneToOne: false
            referencedRelation: "calendar_feed"
            referencedColumns: ["row_id"]
          },
          {
            foreignKeyName: "event_attendance_occurrence_id_fkey"
            columns: ["occurrence_id"]
            isOneToOne: false
            referencedRelation: "calendar_occurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendance_occurrence_id_fkey"
            columns: ["occurrence_id"]
            isOneToOne: false
            referencedRelation: "event_instances"
            referencedColumns: ["occurrence_id"]
          },
        ]
      }
      event_attendees: {
        Row: {
          created_at: string | null
          dancer_id: string
          event_id: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          dancer_id: string
          event_id: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          dancer_id?: string
          event_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_attendees_dancer_id_fkey"
            columns: ["dancer_id"]
            isOneToOne: false
            referencedRelation: "dancers_archive_april2026"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_instances"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_attendees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_event_page_snapshot"
            referencedColumns: ["event_id"]
          },
        ]
      }
      event_audit: {
        Row: {
          action: string
          actor_user_id: string | null
          after: Json | null
          before: Json | null
          changed_fields: Json | null
          created_at: string
          event_id: string
          id: string
          operation_source: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          after?: Json | null
          before?: Json | null
          changed_fields?: Json | null
          created_at?: string
          event_id: string
          id?: string
          operation_source?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          after?: Json | null
          before?: Json | null
          changed_fields?: Json | null
          created_at?: string
          event_id?: string
          id?: string
          operation_source?: string | null
        }
        Relationships: []
      }
      event_entities: {
        Row: {
          created_at: string
          entity_id: string
          event_id: string
          role: Database["public"]["Enums"]["event_entity_role"]
        }
        Insert: {
          created_at?: string
          entity_id: string
          event_id: string
          role: Database["public"]["Enums"]["event_entity_role"]
        }
        Update: {
          created_at?: string
          entity_id?: string
          event_id?: string
          role?: Database["public"]["Enums"]["event_entity_role"]
        }
        Relationships: [
          {
            foreignKeyName: "event_entities_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_entities_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "organiser_admin_dashboard_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_entities_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "organiser_admin_dashboard_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_entities_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "organisers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_entities_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_instances"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_entities_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_entities_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_event_page_snapshot"
            referencedColumns: ["event_id"]
          },
        ]
      }
      event_jobs: {
        Row: {
          attempt_count: number
          created_at: string
          event_id: string
          id: string
          job_type: string
          last_attempt_at: string | null
          payload: Json | null
          status: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          event_id: string
          id?: string
          job_type: string
          last_attempt_at?: string | null
          payload?: Json | null
          status?: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          event_id?: string
          id?: string
          job_type?: string
          last_attempt_at?: string | null
          payload?: Json | null
          status?: string
        }
        Relationships: []
      }
      event_passes: {
        Row: {
          created_at: string | null
          currency: string | null
          event_id: string | null
          id: string
          name: string
          price: number | null
          quantity: number | null
          tier: string | null
          type: string | null
        }
        Insert: {
          created_at?: string | null
          currency?: string | null
          event_id?: string | null
          id?: string
          name: string
          price?: number | null
          quantity?: number | null
          tier?: string | null
          type?: string | null
        }
        Update: {
          created_at?: string | null
          currency?: string | null
          event_id?: string | null
          id?: string
          name?: string
          price?: number | null
          quantity?: number | null
          tier?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_passes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_instances"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_passes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_passes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_event_page_snapshot"
            referencedColumns: ["event_id"]
          },
        ]
      }
      event_permissions: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_permissions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_instances"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_permissions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_permissions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_event_page_snapshot"
            referencedColumns: ["event_id"]
          },
        ]
      }
      event_posts: {
        Row: {
          content: string
          created_at: string | null
          event_id: string
          id: number
          kind: string
          thread: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          event_id: string
          id?: never
          kind: string
          thread: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          event_id?: string
          id?: never
          kind?: string
          thread?: string
          user_id?: string
        }
        Relationships: []
      }
      event_profile_connections: {
        Row: {
          connection_label: string
          created_at: string
          created_by: string | null
          event_id: string
          id: string
          is_primary: boolean
          notes: string | null
          person_id: string
          person_type: string
          sort_order: number
        }
        Insert: {
          connection_label: string
          created_at?: string
          created_by?: string | null
          event_id: string
          id?: string
          is_primary?: boolean
          notes?: string | null
          person_id: string
          person_type: string
          sort_order?: number
        }
        Update: {
          connection_label?: string
          created_at?: string
          created_by?: string | null
          event_id?: string
          id?: string
          is_primary?: boolean
          notes?: string | null
          person_id?: string
          person_type?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_profile_connections_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_instances"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_profile_connections_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_profile_connections_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_event_page_snapshot"
            referencedColumns: ["event_id"]
          },
        ]
      }
      event_profile_link_audit: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          event_id: string
          id: string
          link_id: string | null
          payload: Json
          profile_id: string | null
          profile_type: string | null
          reason: string | null
          role: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          event_id: string
          id?: string
          link_id?: string | null
          payload?: Json
          profile_id?: string | null
          profile_type?: string | null
          reason?: string | null
          role?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          event_id?: string
          id?: string
          link_id?: string | null
          payload?: Json
          profile_id?: string | null
          profile_type?: string | null
          reason?: string | null
          role?: string | null
        }
        Relationships: []
      }
      event_profile_link_suggestions: {
        Row: {
          confidence: number
          created_at: string
          event_id: string
          id: string
          profile_id: string
          profile_type: string
          reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          role: string
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          event_id: string
          id?: string
          profile_id: string
          profile_type: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          role: string
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          confidence?: number
          created_at?: string
          event_id?: string
          id?: string
          profile_id?: string
          profile_type?: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          role?: string
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_profile_link_suggestions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_instances"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_profile_link_suggestions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_profile_link_suggestions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_event_page_snapshot"
            referencedColumns: ["event_id"]
          },
        ]
      }
      event_profile_links: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          created_at: string
          created_by: string | null
          event_id: string
          id: string
          is_primary: boolean
          occurrence_id: string | null
          person_entity_id: string | null
          profile_id: string
          profile_type: string
          reason: string | null
          role: string
          source: string
          status: string
          updated_at: string
          updated_by: string | null
          verified: boolean
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          created_by?: string | null
          event_id: string
          id?: string
          is_primary?: boolean
          occurrence_id?: string | null
          person_entity_id?: string | null
          profile_id: string
          profile_type: string
          reason?: string | null
          role: string
          source?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          verified?: boolean
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          created_by?: string | null
          event_id?: string
          id?: string
          is_primary?: boolean
          occurrence_id?: string | null
          person_entity_id?: string | null
          profile_id?: string
          profile_type?: string
          reason?: string | null
          role?: string
          source?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "event_profile_links_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_instances"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_profile_links_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_profile_links_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_event_page_snapshot"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_profile_links_person_entity_id_fkey"
            columns: ["person_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_profile_links_person_entity_id_fkey"
            columns: ["person_entity_id"]
            isOneToOne: false
            referencedRelation: "organiser_admin_dashboard_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_profile_links_person_entity_id_fkey"
            columns: ["person_entity_id"]
            isOneToOne: false
            referencedRelation: "organiser_admin_dashboard_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_profile_links_person_entity_id_fkey"
            columns: ["person_entity_id"]
            isOneToOne: false
            referencedRelation: "organisers"
            referencedColumns: ["id"]
          },
        ]
      }
      event_program_djs: {
        Row: {
          id: string
          profile_id: string | null
          program_item_id: string | null
        }
        Insert: {
          id?: string
          profile_id?: string | null
          program_item_id?: string | null
        }
        Update: {
          id?: string
          profile_id?: string | null
          program_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_program_djs_program_item_id_fkey"
            columns: ["program_item_id"]
            isOneToOne: false
            referencedRelation: "event_program_items"
            referencedColumns: ["id"]
          },
        ]
      }
      event_program_instructors: {
        Row: {
          id: string
          profile_id: string | null
          program_item_id: string | null
        }
        Insert: {
          id?: string
          profile_id?: string | null
          program_item_id?: string | null
        }
        Update: {
          id?: string
          profile_id?: string | null
          program_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_program_instructors_program_item_id_fkey"
            columns: ["program_item_id"]
            isOneToOne: false
            referencedRelation: "event_program_items"
            referencedColumns: ["id"]
          },
        ]
      }
      event_program_items: {
        Row: {
          created_at: string | null
          day: string | null
          description: string | null
          end_time: string | null
          event_id: string | null
          id: string
          legacy_id: string | null
          room: string | null
          sort_order: number
          start_time: string | null
          title: string
          track_id: string | null
          type: string
        }
        Insert: {
          created_at?: string | null
          day?: string | null
          description?: string | null
          end_time?: string | null
          event_id?: string | null
          id?: string
          legacy_id?: string | null
          room?: string | null
          sort_order?: number
          start_time?: string | null
          title: string
          track_id?: string | null
          type: string
        }
        Update: {
          created_at?: string | null
          day?: string | null
          description?: string | null
          end_time?: string | null
          event_id?: string | null
          id?: string
          legacy_id?: string | null
          room?: string | null
          sort_order?: number
          start_time?: string | null
          title?: string
          track_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_program_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_instances"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_program_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_program_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_event_page_snapshot"
            referencedColumns: ["event_id"]
          },
        ]
      }
      event_registrations: {
        Row: {
          amount_paid: number | null
          created_at: string | null
          email: string | null
          event_id: string | null
          first_name: string | null
          id: string
          last_name: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          amount_paid?: number | null
          created_at?: string | null
          email?: string | null
          event_id?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          amount_paid?: number | null
          created_at?: string | null
          email?: string | null
          event_id?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_instances"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_event_page_snapshot"
            referencedColumns: ["event_id"]
          },
        ]
      }
      event_tracks: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          event_id: string | null
          id: string
          legacy_id: string | null
          name: string
          sort_order: number
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          event_id?: string | null
          id?: string
          legacy_id?: string | null
          name: string
          sort_order?: number
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          event_id?: string | null
          id?: string
          legacy_id?: string | null
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_tracks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_instances"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_tracks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_tracks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_event_page_snapshot"
            referencedColumns: ["event_id"]
          },
        ]
      }
      event_views: {
        Row: {
          event_id: string
          id: string
          source: string | null
          viewed_at: string
        }
        Insert: {
          event_id: string
          id?: string
          source?: string | null
          viewed_at?: string
        }
        Update: {
          event_id?: string
          id?: string
          source?: string | null
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_views_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_instances"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_views_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_views_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_event_page_snapshot"
            referencedColumns: ["event_id"]
          },
        ]
      }
      events: {
        Row: {
          attendance_count: number | null
          city: string | null
          city_id: string | null
          city_slug: string | null
          country: string | null
          created_at: string | null
          created_by: string | null
          dancer_ids: string[] | null
          date: string | null
          description: string | null
          end_time: string | null
          facebook_url: string | null
          faq: string | null
          festival_config: Json | null
          guestlist_config: string | null
          has_guestlist: boolean | null
          has_raffle: boolean | null
          id: string
          instagram_url: string | null
          is_active: boolean | null
          is_published: boolean | null
          key_times: Json | null
          lifecycle_status: string
          location: string | null
          meta_data: Json | null
          name: string
          parent_event_id: string | null
          payment_methods: string | null
          photographer_ids: string[] | null
          poster_url: string | null
          pricing: Json | null
          promo_codes: string | null
          raffle_config: string | null
          recurrence: Json | null
          schedule_type: string | null
          source_occurrence_id: string | null
          start_time: string | null
          ticket_url: string | null
          tickets: string | null
          timezone: string | null
          type: string | null
          updated_at: string
          user_id: string | null
          venue_id: string
          website: string | null
        }
        Insert: {
          attendance_count?: number | null
          city?: string | null
          city_id?: string | null
          city_slug?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          dancer_ids?: string[] | null
          date?: string | null
          description?: string | null
          end_time?: string | null
          facebook_url?: string | null
          faq?: string | null
          festival_config?: Json | null
          guestlist_config?: string | null
          has_guestlist?: boolean | null
          has_raffle?: boolean | null
          id?: string
          instagram_url?: string | null
          is_active?: boolean | null
          is_published?: boolean | null
          key_times?: Json | null
          lifecycle_status?: string
          location?: string | null
          meta_data?: Json | null
          name: string
          parent_event_id?: string | null
          payment_methods?: string | null
          photographer_ids?: string[] | null
          poster_url?: string | null
          pricing?: Json | null
          promo_codes?: string | null
          raffle_config?: string | null
          recurrence?: Json | null
          schedule_type?: string | null
          source_occurrence_id?: string | null
          start_time?: string | null
          ticket_url?: string | null
          tickets?: string | null
          timezone?: string | null
          type?: string | null
          updated_at?: string
          user_id?: string | null
          venue_id: string
          website?: string | null
        }
        Update: {
          attendance_count?: number | null
          city?: string | null
          city_id?: string | null
          city_slug?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          dancer_ids?: string[] | null
          date?: string | null
          description?: string | null
          end_time?: string | null
          facebook_url?: string | null
          faq?: string | null
          festival_config?: Json | null
          guestlist_config?: string | null
          has_guestlist?: boolean | null
          has_raffle?: boolean | null
          id?: string
          instagram_url?: string | null
          is_active?: boolean | null
          is_published?: boolean | null
          key_times?: Json | null
          lifecycle_status?: string
          location?: string | null
          meta_data?: Json | null
          name?: string
          parent_event_id?: string | null
          payment_methods?: string | null
          photographer_ids?: string[] | null
          poster_url?: string | null
          pricing?: Json | null
          promo_codes?: string | null
          raffle_config?: string | null
          recurrence?: Json | null
          schedule_type?: string | null
          source_occurrence_id?: string | null
          start_time?: string | null
          ticket_url?: string | null
          tickets?: string | null
          timezone?: string | null
          type?: string | null
          updated_at?: string
          user_id?: string | null
          venue_id?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_city_slug_fkey"
            columns: ["city_slug"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "events_parent_event_id_fkey"
            columns: ["parent_event_id"]
            isOneToOne: false
            referencedRelation: "event_instances"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "events_parent_event_id_fkey"
            columns: ["parent_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_parent_event_id_fkey"
            columns: ["parent_event_id"]
            isOneToOne: false
            referencedRelation: "v_event_page_snapshot"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "events_source_occurrence_id_fkey"
            columns: ["source_occurrence_id"]
            isOneToOne: false
            referencedRelation: "calendar_feed"
            referencedColumns: ["row_id"]
          },
          {
            foreignKeyName: "events_source_occurrence_id_fkey"
            columns: ["source_occurrence_id"]
            isOneToOne: false
            referencedRelation: "calendar_occurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_source_occurrence_id_fkey"
            columns: ["source_occurrence_id"]
            isOneToOne: false
            referencedRelation: "event_instances"
            referencedColumns: ["occurrence_id"]
          },
          {
            foreignKeyName: "events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "admin_venues_read"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "admin_venues_read"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_city_audit_view"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          description: string | null
          enabled: boolean
          flag_name: string
          updated_at: string | null
        }
        Insert: {
          description?: string | null
          enabled?: boolean
          flag_name: string
          updated_at?: string | null
        }
        Update: {
          description?: string | null
          enabled?: boolean
          flag_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      guest_dancer_profiles: {
        Row: {
          avatar_url: string | null
          city_id: string | null
          created_at: string
          created_by: string | null
          dance_role: string | null
          first_name: string
          id: string
          instagram: string | null
          surname: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          city_id?: string | null
          created_at?: string
          created_by?: string | null
          dance_role?: string | null
          first_name: string
          id?: string
          instagram?: string | null
          surname?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          city_id?: string | null
          created_at?: string
          created_by?: string | null
          dance_role?: string | null
          first_name?: string
          id?: string
          instagram?: string | null
          surname?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_dancer_profiles_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      hardening_preserve_baseline: {
        Row: {
          admin_link_managers_count: number
          admin_manager_city_scopes_count: number
          admin_super_users_count: number
          admin_users_count: number
          captured_at: string
          cities_count: number
          city_aliases_count: number
          countries_count: number
          run_id: string
        }
        Insert: {
          admin_link_managers_count: number
          admin_manager_city_scopes_count: number
          admin_super_users_count: number
          admin_users_count: number
          captured_at?: string
          cities_count: number
          city_aliases_count: number
          countries_count: number
          run_id: string
        }
        Update: {
          admin_link_managers_count?: number
          admin_manager_city_scopes_count?: number
          admin_super_users_count?: number
          admin_users_count?: number
          captured_at?: string
          cities_count?: number
          city_aliases_count?: number
          countries_count?: number
          run_id?: string
        }
        Relationships: []
      }
      hardening_seed_contract_snapshot: {
        Row: {
          captured_at: string
          id: number
          override_payload: Json
          recurrence_payload: Json
        }
        Insert: {
          captured_at?: string
          id?: number
          override_payload: Json
          recurrence_payload: Json
        }
        Update: {
          captured_at?: string
          id?: number
          override_payload?: Json
          recurrence_payload?: Json
        }
        Relationships: []
      }
      idempotency: {
        Row: {
          created_at: string | null
          key: string
          request_hash: string
          response: Json | null
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          key: string
          request_hash: string
          response?: Json | null
          status: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          key?: string
          request_hash?: string
          response?: Json | null
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      member_profiles: {
        Row: {
          auth_user_id: string | null
          avatar_url: string | null
          based_city_id: string | null
          created_at: string
          first_name: string | null
          full_name: string | null
          id: string
          last_name: string | null
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          avatar_url?: string | null
          based_city_id?: string | null
          created_at?: string
          first_name?: string | null
          full_name?: string | null
          id: string
          last_name?: string | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          avatar_url?: string | null
          based_city_id?: string | null
          created_at?: string
          first_name?: string | null
          full_name?: string | null
          id?: string
          last_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_profiles_based_city_id_fkey"
            columns: ["based_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_targets: {
        Row: {
          category: string
          city_id: string
          created_at: string
          id: string
          target_count: number
          updated_at: string
        }
        Insert: {
          category: string
          city_id: string
          created_at?: string
          id?: string
          target_count?: number
          updated_at?: string
        }
        Update: {
          category?: string
          city_id?: string
          created_at?: string
          id?: string
          target_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_targets_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      organiser_team_members: {
        Row: {
          capacity: number | null
          created_at: string
          id: string
          is_active: boolean
          is_head: boolean | null
          is_leader: boolean
          member_profile_id: string
          organiser_entity_id: string
          person_entity_id: string | null
          role: string | null
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_head?: boolean | null
          is_leader?: boolean
          member_profile_id: string
          organiser_entity_id: string
          person_entity_id?: string | null
          role?: string | null
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_head?: boolean | null
          is_leader?: boolean
          member_profile_id?: string
          organiser_entity_id?: string
          person_entity_id?: string | null
          role?: string | null
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organiser_team_members_member_profile_id_fkey"
            columns: ["member_profile_id"]
            isOneToOne: false
            referencedRelation: "member_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organiser_team_members_member_profile_id_fkey"
            columns: ["member_profile_id"]
            isOneToOne: false
            referencedRelation: "member_profiles_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organiser_team_members_organiser_entity_id_fkey"
            columns: ["organiser_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organiser_team_members_organiser_entity_id_fkey"
            columns: ["organiser_entity_id"]
            isOneToOne: false
            referencedRelation: "organiser_admin_dashboard_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organiser_team_members_organiser_entity_id_fkey"
            columns: ["organiser_entity_id"]
            isOneToOne: false
            referencedRelation: "organiser_admin_dashboard_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organiser_team_members_organiser_entity_id_fkey"
            columns: ["organiser_entity_id"]
            isOneToOne: false
            referencedRelation: "organisers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organiser_team_members_person_entity_id_fkey"
            columns: ["person_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organiser_team_members_person_entity_id_fkey"
            columns: ["person_entity_id"]
            isOneToOne: false
            referencedRelation: "organiser_admin_dashboard_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organiser_team_members_person_entity_id_fkey"
            columns: ["person_entity_id"]
            isOneToOne: false
            referencedRelation: "organiser_admin_dashboard_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organiser_team_members_person_entity_id_fkey"
            columns: ["person_entity_id"]
            isOneToOne: false
            referencedRelation: "organisers"
            referencedColumns: ["id"]
          },
        ]
      }
      person_account_links: {
        Row: {
          created_at: string
          created_by: string | null
          is_primary: boolean
          person_id: string
          user_id: string
          verification_status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          is_primary?: boolean
          person_id: string
          user_id: string
          verification_status?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          is_primary?: boolean
          person_id?: string
          user_id?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "person_account_links_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person_identities"
            referencedColumns: ["id"]
          },
        ]
      }
      person_identities: {
        Row: {
          created_at: string
          created_by: string | null
          display_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          id?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          id?: string
        }
        Relationships: []
      }
      person_merge_log: {
        Row: {
          id: string
          merged_at: string
          merged_by: string | null
          merged_from_id: string
          merged_into_id: string
          payload: Json
        }
        Insert: {
          id?: string
          merged_at?: string
          merged_by?: string | null
          merged_from_id: string
          merged_into_id: string
          payload?: Json
        }
        Update: {
          id?: string
          merged_at?: string
          merged_by?: string | null
          merged_from_id?: string
          merged_into_id?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "person_merge_log_merged_from_id_fkey"
            columns: ["merged_from_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_merge_log_merged_from_id_fkey"
            columns: ["merged_from_id"]
            isOneToOne: false
            referencedRelation: "organiser_admin_dashboard_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_merge_log_merged_from_id_fkey"
            columns: ["merged_from_id"]
            isOneToOne: false
            referencedRelation: "organiser_admin_dashboard_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_merge_log_merged_from_id_fkey"
            columns: ["merged_from_id"]
            isOneToOne: false
            referencedRelation: "organisers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_merge_log_merged_into_id_fkey"
            columns: ["merged_into_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_merge_log_merged_into_id_fkey"
            columns: ["merged_into_id"]
            isOneToOne: false
            referencedRelation: "organiser_admin_dashboard_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_merge_log_merged_into_id_fkey"
            columns: ["merged_into_id"]
            isOneToOne: false
            referencedRelation: "organiser_admin_dashboard_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_merge_log_merged_into_id_fkey"
            columns: ["merged_into_id"]
            isOneToOne: false
            referencedRelation: "organisers"
            referencedColumns: ["id"]
          },
        ]
      }
      person_profiles: {
        Row: {
          created_at: string
          created_by: string | null
          person_id: string
          profile_id: string
          profile_type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          person_id: string
          profile_id: string
          profile_type: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          person_id?: string
          profile_id?: string
          profile_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "person_profiles_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person_identities"
            referencedColumns: ["id"]
          },
        ]
      }
      phase4_tmp_occurrence_write_city_compat_audit: {
        Row: {
          auth_uid: string | null
          db_user: string
          event_id: string | null
          function_name: string
          has_city_id: boolean
          has_city_slug: boolean
          id: number
          jwt_role: string | null
          jwt_sub: string | null
          logged_at: string
          occurrence_count: number | null
          replace_mode: boolean | null
          session_user_name: string
        }
        Insert: {
          auth_uid?: string | null
          db_user?: string
          event_id?: string | null
          function_name: string
          has_city_id: boolean
          has_city_slug: boolean
          id?: never
          jwt_role?: string | null
          jwt_sub?: string | null
          logged_at?: string
          occurrence_count?: number | null
          replace_mode?: boolean | null
          session_user_name?: string
        }
        Update: {
          auth_uid?: string | null
          db_user?: string
          event_id?: string | null
          function_name?: string
          has_city_id?: boolean
          has_city_slug?: boolean
          id?: never
          jwt_role?: string | null
          jwt_sub?: string | null
          logged_at?: string
          occurrence_count?: number | null
          replace_mode?: boolean | null
          session_user_name?: string
        }
        Relationships: []
      }
      profile_claims: {
        Row: {
          admin_notes: string | null
          claim_email: string
          claim_name: string
          claim_phone: string
          created_at: string | null
          id: string
          profile_id: string
          profile_type: string
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          claim_email: string
          claim_name: string
          claim_phone: string
          created_at?: string | null
          id?: string
          profile_id: string
          profile_type: string
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          claim_email?: string
          claim_name?: string
          claim_phone?: string
          created_at?: string | null
          id?: string
          profile_id?: string
          profile_type?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          based_city_id: string | null
          country_code: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          is_admin: boolean | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          based_city_id?: string | null
          country_code?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          is_admin?: boolean | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          based_city_id?: string | null
          country_code?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_admin?: boolean | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_based_city_id_fkey"
            columns: ["based_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_codes: {
        Row: {
          city_id: string | null
          code: string
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          discount_type: string
          discount_value: number | null
          event_id: string | null
          external_url: string | null
          id: string
          is_featured: boolean
          owner_display_name: string | null
          owner_id: string | null
          owner_type: string | null
          status: string
          terms: string | null
          title: string
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          city_id?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          discount_type?: string
          discount_value?: number | null
          event_id?: string | null
          external_url?: string | null
          id?: string
          is_featured?: boolean
          owner_display_name?: string | null
          owner_id?: string | null
          owner_type?: string | null
          status?: string
          terms?: string | null
          title: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          city_id?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          discount_type?: string
          discount_value?: number | null
          event_id?: string | null
          external_url?: string | null
          id?: string
          is_featured?: boolean
          owner_display_name?: string | null
          owner_id?: string | null
          owner_type?: string | null
          status?: string
          terms?: string | null
          title?: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promo_codes_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_codes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_instances"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "promo_codes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_codes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_event_page_snapshot"
            referencedColumns: ["event_id"]
          },
        ]
      }
      rpc_city_compat_audit: {
        Row: {
          auth_uid: string | null
          captured_at: string
          has_city: boolean
          has_city_id: boolean
          has_city_slug: boolean
          id: number
          request_iss: string | null
          request_role: string | null
          request_sub: string | null
          rpc_name: string
        }
        Insert: {
          auth_uid?: string | null
          captured_at?: string
          has_city: boolean
          has_city_id: boolean
          has_city_slug: boolean
          id?: number
          request_iss?: string | null
          request_role?: string | null
          request_sub?: string | null
          rpc_name: string
        }
        Update: {
          auth_uid?: string | null
          captured_at?: string
          has_city?: boolean
          has_city_id?: boolean
          has_city_slug?: boolean
          id?: number
          request_iss?: string | null
          request_role?: string | null
          request_sub?: string | null
          rpc_name?: string
        }
        Relationships: []
      }
      rpc_deprecation_log: {
        Row: {
          auth_uid: string | null
          called_at: string
          client_ip: unknown
          function_name: string
          id: number
          params: Json | null
        }
        Insert: {
          auth_uid?: string | null
          called_at?: string
          client_ip?: unknown
          function_name: string
          id?: number
          params?: Json | null
        }
        Update: {
          auth_uid?: string | null
          called_at?: string
          client_ip?: unknown
          function_name?: string
          id?: number
          params?: Json | null
        }
        Relationships: []
      }
      songs: {
        Row: {
          artist: string
          created_at: string
          genre: string
          id: string
          title: string
        }
        Insert: {
          artist: string
          created_at?: string
          genre: string
          id?: string
          title: string
        }
        Update: {
          artist?: string
          created_at?: string
          genre?: string
          id?: string
          title?: string
        }
        Relationships: []
      }
      staging_cities: {
        Row: {
          country_code: string | null
          country_name: string | null
          name: string | null
          population: number | null
          timezone: string | null
        }
        Insert: {
          country_code?: string | null
          country_name?: string | null
          name?: string | null
          population?: number | null
          timezone?: string | null
        }
        Update: {
          country_code?: string | null
          country_name?: string | null
          name?: string | null
          population?: number | null
          timezone?: string | null
        }
        Relationships: []
      }
      teacher_profiles: {
        Row: {
          achievements: string[] | null
          availability: string | null
          city_id: string | null
          country: string | null
          country_code: string | null
          created_at: string | null
          created_by: string | null
          email: string | null
          facebook: string | null
          faq: string | null
          first_name: string | null
          gallery_urls: string[] | null
          hide_surname: boolean | null
          id: string
          instagram: string | null
          is_active: boolean | null
          journey: string | null
          languages: string[] | null
          meta_data: Json | null
          nationality: string | null
          offers_group: boolean | null
          offers_private: boolean | null
          person_entity_id: string | null
          phone: string | null
          photo_url: string | null
          private_lesson_locations: string[] | null
          private_lesson_types: string[] | null
          private_travel_distance: number | null
          profile_source: string | null
          public_email: string | null
          socials: Json | null
          surname: string | null
          teaching_styles: string[] | null
          travel_willingness: string | null
          upcoming_events: string | null
          updated_at: string | null
          user_id: string | null
          website: string | null
          years_teaching: number | null
        }
        Insert: {
          achievements?: string[] | null
          availability?: string | null
          city_id?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          facebook?: string | null
          faq?: string | null
          first_name?: string | null
          gallery_urls?: string[] | null
          hide_surname?: boolean | null
          id?: string
          instagram?: string | null
          is_active?: boolean | null
          journey?: string | null
          languages?: string[] | null
          meta_data?: Json | null
          nationality?: string | null
          offers_group?: boolean | null
          offers_private?: boolean | null
          person_entity_id?: string | null
          phone?: string | null
          photo_url?: string | null
          private_lesson_locations?: string[] | null
          private_lesson_types?: string[] | null
          private_travel_distance?: number | null
          profile_source?: string | null
          public_email?: string | null
          socials?: Json | null
          surname?: string | null
          teaching_styles?: string[] | null
          travel_willingness?: string | null
          upcoming_events?: string | null
          updated_at?: string | null
          user_id?: string | null
          website?: string | null
          years_teaching?: number | null
        }
        Update: {
          achievements?: string[] | null
          availability?: string | null
          city_id?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          facebook?: string | null
          faq?: string | null
          first_name?: string | null
          gallery_urls?: string[] | null
          hide_surname?: boolean | null
          id?: string
          instagram?: string | null
          is_active?: boolean | null
          journey?: string | null
          languages?: string[] | null
          meta_data?: Json | null
          nationality?: string | null
          offers_group?: boolean | null
          offers_private?: boolean | null
          person_entity_id?: string | null
          phone?: string | null
          photo_url?: string | null
          private_lesson_locations?: string[] | null
          private_lesson_types?: string[] | null
          private_travel_distance?: number | null
          profile_source?: string | null
          public_email?: string | null
          socials?: Json | null
          surname?: string | null
          teaching_styles?: string[] | null
          travel_willingness?: string | null
          upcoming_events?: string | null
          updated_at?: string | null
          user_id?: string | null
          website?: string | null
          years_teaching?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "teacher_profiles_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_profiles_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "teacher_profiles_person_entity_id_fkey"
            columns: ["person_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_profiles_person_entity_id_fkey"
            columns: ["person_entity_id"]
            isOneToOne: false
            referencedRelation: "organiser_admin_dashboard_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_profiles_person_entity_id_fkey"
            columns: ["person_entity_id"]
            isOneToOne: false
            referencedRelation: "organiser_admin_dashboard_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_profiles_person_entity_id_fkey"
            columns: ["person_entity_id"]
            isOneToOne: false
            referencedRelation: "organisers"
            referencedColumns: ["id"]
          },
        ]
      }
      trigger_layer_manifest: {
        Row: {
          function_def: string | null
          function_name: string
          id: number
          recorded_at: string
          table_name: string
          trigger_def: string
          trigger_name: string
        }
        Insert: {
          function_def?: string | null
          function_name: string
          id?: number
          recorded_at?: string
          table_name: string
          trigger_def: string
          trigger_name: string
        }
        Update: {
          function_def?: string | null
          function_name?: string
          id?: number
          recorded_at?: string
          table_name?: string
          trigger_def?: string
          trigger_name?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      v_is_admin: {
        Row: {
          coalesce: boolean | null
        }
        Insert: {
          coalesce?: boolean | null
        }
        Update: {
          coalesce?: boolean | null
        }
        Relationships: []
      }
      vendors: {
        Row: {
          address: string | null
          business_name: string | null
          city: string | null
          city_id: string | null
          country: string | null
          country_code: string | null
          created_at: string
          created_by: string | null
          description: string | null
          email: string | null
          facebook: string | null
          faq: string | null
          first_name: string | null
          gallery_urls: string[] | null
          id: string
          instagram: string | null
          is_active: boolean | null
          meta_data: Json | null
          person_entity_id: string | null
          phone: string | null
          photo_url: string | null
          product_categories: string[] | null
          product_photos: string[] | null
          products: Json | null
          profile_source: string | null
          promo_code: string | null
          promo_discount_type: string | null
          promo_discount_value: number | null
          public_email: string | null
          representative_name: string | null
          ships_international: boolean | null
          short_description: string | null
          surname: string | null
          team: Json | null
          upcoming_events: string[] | null
          updated_at: string
          user_id: string | null
          verified: boolean | null
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          business_name?: string | null
          city?: string | null
          city_id?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          email?: string | null
          facebook?: string | null
          faq?: string | null
          first_name?: string | null
          gallery_urls?: string[] | null
          id?: string
          instagram?: string | null
          is_active?: boolean | null
          meta_data?: Json | null
          person_entity_id?: string | null
          phone?: string | null
          photo_url?: string | null
          product_categories?: string[] | null
          product_photos?: string[] | null
          products?: Json | null
          profile_source?: string | null
          promo_code?: string | null
          promo_discount_type?: string | null
          promo_discount_value?: number | null
          public_email?: string | null
          representative_name?: string | null
          ships_international?: boolean | null
          short_description?: string | null
          surname?: string | null
          team?: Json | null
          upcoming_events?: string[] | null
          updated_at?: string
          user_id?: string | null
          verified?: boolean | null
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          business_name?: string | null
          city?: string | null
          city_id?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          email?: string | null
          facebook?: string | null
          faq?: string | null
          first_name?: string | null
          gallery_urls?: string[] | null
          id?: string
          instagram?: string | null
          is_active?: boolean | null
          meta_data?: Json | null
          person_entity_id?: string | null
          phone?: string | null
          photo_url?: string | null
          product_categories?: string[] | null
          product_photos?: string[] | null
          products?: Json | null
          profile_source?: string | null
          promo_code?: string | null
          promo_discount_type?: string | null
          promo_discount_value?: number | null
          public_email?: string | null
          representative_name?: string | null
          ships_international?: boolean | null
          short_description?: string | null
          surname?: string | null
          team?: Json | null
          upcoming_events?: string[] | null
          updated_at?: string
          user_id?: string | null
          verified?: boolean | null
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendors_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendors_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "vendors_person_entity_id_fkey"
            columns: ["person_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendors_person_entity_id_fkey"
            columns: ["person_entity_id"]
            isOneToOne: false
            referencedRelation: "organiser_admin_dashboard_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendors_person_entity_id_fkey"
            columns: ["person_entity_id"]
            isOneToOne: false
            referencedRelation: "organiser_admin_dashboard_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendors_person_entity_id_fkey"
            columns: ["person_entity_id"]
            isOneToOne: false
            referencedRelation: "organisers"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          accessibility: string | null
          address: string | null
          admin_notes: string | null
          bar_available: boolean | null
          capacity: number | null
          cloakroom_available: boolean | null
          country: string | null
          created_at: string | null
          description: string | null
          email: string | null
          entity_id: string
          facebook: string | null
          facilities: Json | null
          facilities_new: string[] | null
          faq: string | null
          faq_json: Json | null
          floor_type: string | null
          gallery_urls: string[] | null
          google_maps_link: string | null
          google_maps_url: string | null
          hide_paid_parking: boolean | null
          id: string
          id_required: boolean | null
          instagram: string | null
          last_entry_time: string | null
          meta_data: Json | null
          name: string
          opening_hours: Json | null
          parking: string | null
          parking_json: Json | null
          phone: string | null
          photo_url: string[] | null
          postcode: string | null
          rules: string[] | null
          timezone: string | null
          transport: string | null
          transport_json: Json | null
          user_id: string
          venue_rating: number | null
          video_urls: string[] | null
          website: string | null
        }
        Insert: {
          accessibility?: string | null
          address?: string | null
          admin_notes?: string | null
          bar_available?: boolean | null
          capacity?: number | null
          cloakroom_available?: boolean | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          email?: string | null
          entity_id: string
          facebook?: string | null
          facilities?: Json | null
          facilities_new?: string[] | null
          faq?: string | null
          faq_json?: Json | null
          floor_type?: string | null
          gallery_urls?: string[] | null
          google_maps_link?: string | null
          google_maps_url?: string | null
          hide_paid_parking?: boolean | null
          id?: string
          id_required?: boolean | null
          instagram?: string | null
          last_entry_time?: string | null
          meta_data?: Json | null
          name: string
          opening_hours?: Json | null
          parking?: string | null
          parking_json?: Json | null
          phone?: string | null
          photo_url?: string[] | null
          postcode?: string | null
          rules?: string[] | null
          timezone?: string | null
          transport?: string | null
          transport_json?: Json | null
          user_id: string
          venue_rating?: number | null
          video_urls?: string[] | null
          website?: string | null
        }
        Update: {
          accessibility?: string | null
          address?: string | null
          admin_notes?: string | null
          bar_available?: boolean | null
          capacity?: number | null
          cloakroom_available?: boolean | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          email?: string | null
          entity_id?: string
          facebook?: string | null
          facilities?: Json | null
          facilities_new?: string[] | null
          faq?: string | null
          faq_json?: Json | null
          floor_type?: string | null
          gallery_urls?: string[] | null
          google_maps_link?: string | null
          google_maps_url?: string | null
          hide_paid_parking?: boolean | null
          id?: string
          id_required?: boolean | null
          instagram?: string | null
          last_entry_time?: string | null
          meta_data?: Json | null
          name?: string
          opening_hours?: Json | null
          parking?: string | null
          parking_json?: Json | null
          phone?: string | null
          photo_url?: string[] | null
          postcode?: string | null
          rules?: string[] | null
          timezone?: string | null
          transport?: string | null
          transport_json?: Json | null
          user_id?: string
          venue_rating?: number | null
          video_urls?: string[] | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_venues_entity_id"
            columns: ["entity_id"]
            isOneToOne: true
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_venues_entity_id"
            columns: ["entity_id"]
            isOneToOne: true
            referencedRelation: "organiser_admin_dashboard_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_venues_entity_id"
            columns: ["entity_id"]
            isOneToOne: true
            referencedRelation: "organiser_admin_dashboard_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_venues_entity_id"
            columns: ["entity_id"]
            isOneToOne: true
            referencedRelation: "organisers"
            referencedColumns: ["id"]
          },
        ]
      }
      videographers: {
        Row: {
          address: string | null
          bio: string | null
          business_name: string | null
          city: string | null
          city_id: string | null
          country: string | null
          country_code: string | null
          created_at: string
          created_by: string | null
          description: string | null
          email: string | null
          equipment: string | null
          facebook: string | null
          faq: string | null
          first_name: string | null
          gallery_urls: string[] | null
          id: string
          instagram: string | null
          is_active: boolean | null
          meta_data: Json | null
          nationality: string | null
          person_entity_id: string | null
          phone: string | null
          photo_url: string | null
          profile_source: string | null
          public_email: string | null
          short_description: string | null
          surname: string | null
          team: Json | null
          travel_options: string | null
          upcoming_events: string[] | null
          updated_at: string | null
          user_id: string | null
          verified: boolean | null
          videography_styles: string[] | null
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          bio?: string | null
          business_name?: string | null
          city?: string | null
          city_id?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          email?: string | null
          equipment?: string | null
          facebook?: string | null
          faq?: string | null
          first_name?: string | null
          gallery_urls?: string[] | null
          id?: string
          instagram?: string | null
          is_active?: boolean | null
          meta_data?: Json | null
          nationality?: string | null
          person_entity_id?: string | null
          phone?: string | null
          photo_url?: string | null
          profile_source?: string | null
          public_email?: string | null
          short_description?: string | null
          surname?: string | null
          team?: Json | null
          travel_options?: string | null
          upcoming_events?: string[] | null
          updated_at?: string | null
          user_id?: string | null
          verified?: boolean | null
          videography_styles?: string[] | null
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          bio?: string | null
          business_name?: string | null
          city?: string | null
          city_id?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          email?: string | null
          equipment?: string | null
          facebook?: string | null
          faq?: string | null
          first_name?: string | null
          gallery_urls?: string[] | null
          id?: string
          instagram?: string | null
          is_active?: boolean | null
          meta_data?: Json | null
          nationality?: string | null
          person_entity_id?: string | null
          phone?: string | null
          photo_url?: string | null
          profile_source?: string | null
          public_email?: string | null
          short_description?: string | null
          surname?: string | null
          team?: Json | null
          travel_options?: string | null
          upcoming_events?: string[] | null
          updated_at?: string | null
          user_id?: string | null
          verified?: boolean | null
          videography_styles?: string[] | null
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "videographers_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videographers_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "videographers_person_entity_id_fkey"
            columns: ["person_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videographers_person_entity_id_fkey"
            columns: ["person_entity_id"]
            isOneToOne: false
            referencedRelation: "organiser_admin_dashboard_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videographers_person_entity_id_fkey"
            columns: ["person_entity_id"]
            isOneToOne: false
            referencedRelation: "organiser_admin_dashboard_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videographers_person_entity_id_fkey"
            columns: ["person_entity_id"]
            isOneToOne: false
            referencedRelation: "organisers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      admin_people_view: {
        Row: {
          has_auth: boolean | null
          has_identity: boolean | null
          role: string | null
          role_row_id: string | null
          user_id: string | null
        }
        Relationships: []
      }
      admin_venues_read: {
        Row: {
          address: string | null
          admin_notes: string | null
          bar_available: boolean | null
          capacity: number | null
          cloakroom_available: boolean | null
          country: string | null
          created_at: string | null
          description: string | null
          email: string | null
          entity_city_id: string | null
          entity_id: string | null
          facebook: string | null
          facilities_new: string[] | null
          faq_json: Json | null
          floor_type: string | null
          gallery_urls: string[] | null
          google_maps_link: string | null
          hide_paid_parking: boolean | null
          id: string | null
          id_required: boolean | null
          instagram: string | null
          last_entry_time: string | null
          meta_data: Json | null
          name: string | null
          opening_hours: Json | null
          parking_json: Json | null
          phone: string | null
          photo_url: string[] | null
          postcode: string | null
          rules: string[] | null
          timezone: string | null
          transport_json: Json | null
          user_id: string | null
          venue_entity_id: string | null
          venue_id: string | null
          venue_name: string | null
          venue_rating: number | null
          video_urls: string[] | null
          website: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entities_city_id_fkey"
            columns: ["entity_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_venues_entity_id"
            columns: ["venue_entity_id"]
            isOneToOne: true
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_venues_entity_id"
            columns: ["entity_id"]
            isOneToOne: true
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_venues_entity_id"
            columns: ["venue_entity_id"]
            isOneToOne: true
            referencedRelation: "organiser_admin_dashboard_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_venues_entity_id"
            columns: ["entity_id"]
            isOneToOne: true
            referencedRelation: "organiser_admin_dashboard_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_venues_entity_id"
            columns: ["venue_entity_id"]
            isOneToOne: true
            referencedRelation: "organiser_admin_dashboard_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_venues_entity_id"
            columns: ["entity_id"]
            isOneToOne: true
            referencedRelation: "organiser_admin_dashboard_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_venues_entity_id"
            columns: ["venue_entity_id"]
            isOneToOne: true
            referencedRelation: "organisers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_venues_entity_id"
            columns: ["entity_id"]
            isOneToOne: true
            referencedRelation: "organisers"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_feed: {
        Row: {
          city_display: string | null
          city_id: string | null
          city_slug: string | null
          created_at: string | null
          event_id: string | null
          event_type: string | null
          instance_end: string | null
          instance_start: string | null
          is_active: boolean | null
          lifecycle_status: string | null
          name: string | null
          poster_url: string | null
          price_display: string | null
          row_id: string | null
          ticket_url: string | null
          updated_at: string | null
          venue_id: string | null
          venue_name: string | null
          website: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_occurrences_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_instances"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "calendar_occurrences_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_occurrences_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_event_page_snapshot"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "admin_venues_read"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "admin_venues_read"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_city_audit_view"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      event_instances: {
        Row: {
          city_slug: string | null
          event_id: string | null
          event_name: string | null
          instance_end: string | null
          instance_start: string | null
          occurrence_id: string | null
          venue_id: string | null
          venue_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "admin_venues_read"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "admin_venues_read"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_city_audit_view"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      member_profiles_directory: {
        Row: {
          avatar_url: string | null
          based_city_id: string | null
          city_name: string | null
          email: string | null
          entity_name: string | null
          first_name: string | null
          full_name: string | null
          id: string | null
          last_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_profiles_based_city_id_fkey"
            columns: ["based_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      organiser_admin_dashboard_v1: {
        Row: {
          avatar_url: string | null
          city_id: string | null
          city_name: string | null
          claimed_by: string | null
          contact_phone: string | null
          id: string | null
          instagram: string | null
          name: string | null
          organisation_category: string | null
          socials: Json | null
          type: string | null
          website: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entities_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      organiser_admin_dashboard_v2: {
        Row: {
          avatar_url: string | null
          city_id: string | null
          city_name: string | null
          claimed_by: string | null
          contact_phone: string | null
          created_at: string | null
          created_by: string | null
          has_leader: boolean | null
          id: string | null
          instagram: string | null
          is_active: boolean | null
          leader_corruption: boolean | null
          leader_name: string | null
          linked_event_count: number | null
          name: string | null
          organisation_category: string | null
          profile_source: string | null
          socials: Json | null
          team_member_count: number | null
          type: string | null
          updated_at: string | null
          website: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entities_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      organisers: {
        Row: {
          city: string | null
          city_id: string | null
          city_slug: string | null
          created_at: string | null
          description: string | null
          email: string | null
          facebook: string | null
          faq: string | null
          first_name: string | null
          id: string | null
          instagram: string | null
          is_active: boolean | null
          linked_events: string[] | null
          meta_data: Json | null
          organisation_name: string | null
          phone: string | null
          photo_url: string | null
          surname: string | null
          team: Json | null
          team_members: string | null
          updated_at: string | null
          user_id: string | null
          verified: boolean | null
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          city?: string | null
          city_id?: string | null
          city_slug?: never
          created_at?: string | null
          description?: string | null
          email?: never
          facebook?: never
          faq?: never
          first_name?: never
          id?: string | null
          instagram?: never
          is_active?: boolean | null
          linked_events?: never
          meta_data?: Json | null
          organisation_name?: string | null
          phone?: never
          photo_url?: string | null
          surname?: never
          team?: never
          team_members?: never
          updated_at?: never
          user_id?: string | null
          verified?: never
          website?: never
          whatsapp?: never
        }
        Update: {
          city?: string | null
          city_id?: string | null
          city_slug?: never
          created_at?: string | null
          description?: string | null
          email?: never
          facebook?: never
          faq?: never
          first_name?: never
          id?: string | null
          instagram?: never
          is_active?: boolean | null
          linked_events?: never
          meta_data?: Json | null
          organisation_name?: string | null
          phone?: never
          photo_url?: string | null
          surname?: never
          team?: never
          team_members?: never
          updated_at?: never
          user_id?: string | null
          verified?: never
          website?: never
          whatsapp?: never
        }
        Relationships: [
          {
            foreignKeyName: "entities_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      public_visible_dancers: {
        Row: {
          avatar_url: string | null
          based_city_id: string | null
          dance_role: string | null
          dance_started_year: number | null
          first_name: string | null
          id: string | null
          nationality: string | null
        }
        Insert: {
          avatar_url?: string | null
          based_city_id?: string | null
          dance_role?: string | null
          dance_started_year?: number | null
          first_name?: string | null
          id?: string | null
          nationality?: string | null
        }
        Update: {
          avatar_url?: string | null
          based_city_id?: string | null
          dance_role?: string | null
          dance_started_year?: number | null
          first_name?: string | null
          id?: string | null
          nationality?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dancer_profiles_based_city_id_fkey"
            columns: ["based_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      v_event_page_snapshot: {
        Row: {
          city_display: Json | null
          city_id: string | null
          created_by: string | null
          default_city_id: string | null
          default_venue_id: string | null
          description: string | null
          event_id: string | null
          event_timezone: string | null
          facebook_url: string | null
          instagram_url: string | null
          is_published: boolean | null
          name: string | null
          poster_url: string | null
          pricing: Json | null
          status: string | null
          ticket_url: string | null
          website: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_city_id_fkey"
            columns: ["default_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_venue_id_fkey"
            columns: ["default_venue_id"]
            isOneToOne: false
            referencedRelation: "admin_venues_read"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_venue_id_fkey"
            columns: ["default_venue_id"]
            isOneToOne: false
            referencedRelation: "admin_venues_read"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "events_venue_id_fkey"
            columns: ["default_venue_id"]
            isOneToOne: false
            referencedRelation: "venue_city_audit_view"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "events_venue_id_fkey"
            columns: ["default_venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_city_audit_view: {
        Row: {
          drift_flag: boolean | null
          entity_city_id: string | null
          needs_backfill: boolean | null
          venue_city_id: string | null
          venue_entity_id: string | null
          venue_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entities_city_id_fkey"
            columns: ["entity_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entities_city_id_fkey"
            columns: ["venue_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_venues_entity_id"
            columns: ["venue_entity_id"]
            isOneToOne: true
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_venues_entity_id"
            columns: ["venue_entity_id"]
            isOneToOne: true
            referencedRelation: "organiser_admin_dashboard_v1"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_venues_entity_id"
            columns: ["venue_entity_id"]
            isOneToOne: true
            referencedRelation: "organiser_admin_dashboard_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_venues_entity_id"
            columns: ["venue_entity_id"]
            isOneToOne: true
            referencedRelation: "organisers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _archive_link_for_occurrence: {
        Args: {
          p_event_id: string
          p_occurrence_id: string
          p_profile_id: string
          p_role: string
        }
        Returns: undefined
      }
      _derive_event_organiser_ids: {
        Args: { p_event_id: string }
        Returns: string[]
      }
      _floor_test_probe: { Args: never; Returns: string }
      _log_legacy_read: { Args: { _surface: string }; Returns: undefined }
      _map_role_to_profile_type: { Args: { p_role: string }; Returns: string }
      _member_profile_user_id: {
        Args: { p_member_profile_id: string }
        Returns: string
      }
      _secdef_probe: { Args: never; Returns: string }
      _upsert_link: {
        Args: {
          p_event_id: string
          p_is_primary: boolean
          p_occurrence_id: string
          p_profile_id: string
          p_role: string
          p_source: string
        }
        Returns: undefined
      }
      account_exists_by_email: { Args: { p_email: string }; Returns: boolean }
      admin_archive_event_profile_link: {
        Args: {
          p_event_id: string
          p_profile_id: string
          p_reason?: string
          p_role: string
        }
        Returns: Json
      }
      admin_create_dancer: {
        Args: {
          p_avatar_url?: string
          p_based_city_id?: string
          p_dancer_patch?: Json
          p_first_name?: string
          p_full_name?: string
          p_last_name?: string
          p_target_user_id: string
        }
        Returns: {
          achievements: string[] | null
          city_id: string | null
          country_code: string | null
          created_at: string | null
          dancing_start_date: string | null
          facebook: string | null
          favorite_songs: string[] | null
          favorite_styles: string[] | null
          first_name: string | null
          id: string
          instagram: string | null
          looking_for_partner: boolean | null
          nationality: string | null
          partner_details: Json | null
          partner_practice_goals: string[] | null
          partner_role: string | null
          partner_search_level: string[] | null
          partner_search_role: string | null
          photo_url: string | null
          surname: string | null
          user_id: string
          website: string | null
          whatsapp: string | null
        }
        SetofOptions: {
          from: "*"
          to: "dancers_archive_april2026"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_create_event_profile_link: {
        Args: {
          p_event_id: string
          p_is_primary?: boolean
          p_profile_id: string
          p_profile_type?: string
          p_reason?: string
          p_role: string
          p_verified?: boolean
        }
        Returns: Json
      }
      admin_create_organisation_signup: {
        Args: {
          p_category: string
          p_facebook?: string
          p_instagram?: string
          p_leader_avatar_url: string
          p_leader_first_name: string
          p_leader_last_name: string
          p_leader_user_id: string
          p_logo_url: string
          p_organisation_name: string
          p_phone?: string
          p_primary_city_id: string
          p_team_member_user_ids?: string[]
          p_website?: string
        }
        Returns: Json
      }
      admin_create_person_entity_v1: { Args: { p_name: string }; Returns: Json }
      admin_create_vendor: {
        Args: { p_target_user_id: string; p_vendor_payload: Json }
        Returns: {
          completeness: Json
          created: boolean
          dancer_id: string
          vendor_id: string
          vendor_row: Json
        }[]
      }
      admin_dashboard_events_list_v1: {
        Args: {
          p_city_id?: string
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_status?: string
        }
        Returns: Json
      }
      admin_dashboard_summary: {
        Args: never
        Returns: {
          draft_events_count: number
          events_missing_key_data_count: number
          incomplete_profiles_count: number
          last_event_audit_at: string
          upcoming_events_count: number
        }[]
      }
      admin_delete_organiser: {
        Args: { p_organiser_entity_id: string }
        Returns: Json
      }
      admin_delete_promo_code: { Args: { p_id: string }; Returns: undefined }
      admin_entity_lifecycle: {
        Args: {
          p_action: string
          p_entity_id: string
          p_entity_type: string
          p_reason: string
        }
        Returns: undefined
      }
      admin_event_create_draft:
        | {
            Args: {
              p_city_id?: string
              p_city_slug?: string
              p_created_by?: string
              p_name: string
              p_timezone?: string
            }
            Returns: string
          }
        | {
            Args: {
              p_city: string
              p_city_id: string
              p_city_slug: string
              p_country: string
              p_name: string
              p_timezone?: string
            }
            Returns: string
          }
      admin_event_publish: { Args: { p_event_id: string }; Returns: boolean }
      admin_event_update:
        | { Args: { p_event_id: string; p_patch: Json }; Returns: string }
        | {
            Args: {
              p_actor_user_id?: string
              p_event_id: string
              p_patch: Json
            }
            Returns: undefined
          }
      admin_generate_event_link_suggestions: {
        Args: { p_event_id: string; p_limit?: number; p_role?: string }
        Returns: {
          confidence: number
          event_id: string
          profile_id: string
          profile_type: string
          reason: string
          role: string
          status: string
          suggestion_id: string
        }[]
      }
      admin_get_broken_reference_queue: {
        Args: { p_limit?: number }
        Returns: {
          broken_profile_id: string
          detail: string
          event_id: string
          role: string
          source: string
        }[]
      }
      admin_get_connectivity_health_metrics: {
        Args: { p_city?: string; p_city_id?: string; p_city_slug?: string }
        Returns: {
          profiles_linked_to_at_least_one_event_pct: number
          published_events_with_organiser_pct: number
          published_events_with_venue_pct: number
          unlinked_events_count: number
          unlinked_profiles_count: number
          unresolved_city_mappings_count: number
        }[]
      }
      admin_get_dancer_v1: {
        Args: { p_user_id: string }
        Returns: {
          achievements: string[]
          avatar_url: string
          based_city_id: string
          city: string
          created_at: string
          dance_role: string
          dance_started_year: number
          facebook: string
          favorite_songs: string[]
          favorite_styles: string[]
          first_name: string
          gallery_urls: string[]
          id: string
          instagram: string
          is_active: boolean
          looking_for_partner: boolean
          meta_data: Json
          nationality: string
          partner_details: string
          partner_practice_goals: string[]
          partner_search_level: string[]
          partner_search_role: string
          profile_source: string
          surname: string
          updated_at: string
          website: string
          whatsapp: string
        }[]
      }
      admin_get_dj_v1: {
        Args: { p_entity_id: string }
        Returns: {
          city: string
          city_id: string
          created_at: string
          dj_name: string
          email: string
          entity_id: string
          facebook: string
          faq: string
          first_name: string
          gallery_urls: string[]
          genres: string[]
          id: string
          instagram: string
          is_active: boolean
          meta_data: Json
          mixcloud: string
          nationality: string
          phone: string
          photo_url: string
          pricing: string
          profile_source: string
          soundcloud: string
          surname: string
          upcoming_events: string[]
          updated_at: string
          website: string
          whatsapp: string
          youtube_url: string
        }[]
      }
      admin_get_djs_by_ids_v1: {
        Args: { p_ids: string[] }
        Returns: {
          city: string
          city_id: string
          country: string
          dj_name: string
          email: string
          entity_id: string
          facebook: string
          faq: string
          first_name: string
          gallery_urls: string[]
          genres: string[]
          id: string
          instagram: string
          meta_data: Json
          mixcloud: string
          nationality: string
          phone: string
          photo_url: string[]
          pricing: string
          soundcloud: string
          surname: string
          upcoming_events: string[]
          website: string
          whatsapp: string
          youtube_url: string
        }[]
      }
      admin_get_event_organiser_ids_v1: {
        Args: { p_event_id: string }
        Returns: {
          entity_id: string
        }[]
      }
      admin_get_event_organiser_links_batch_v1: {
        Args: { p_event_ids: string[] }
        Returns: {
          entity_id: string
          event_id: string
        }[]
      }
      admin_get_event_snapshot_v2: {
        Args: { p_event_id: string }
        Returns: Json
      }
      admin_get_merge_history_v1: {
        Args: { p_person_entity_id: string }
        Returns: {
          direction: string
          id: string
          merged_at: string
          merged_from_id: string
          merged_into_id: string
          other_name: string
        }[]
      }
      admin_get_my_city_scopes: {
        Args: never
        Returns: {
          city_id: string
          city_name: string
          city_slug: string
        }[]
      }
      admin_get_my_settings: {
        Args: never
        Returns: {
          city_ids: string[]
          is_active: boolean
          is_super_admin: boolean
          notes: string
          role: string
          user_id: string
        }[]
      }
      admin_get_organiser_display_rows_v1: {
        Args: { p_ids: string[] }
        Returns: {
          id: string
          name: string
        }[]
      }
      admin_get_person_event_history_v1: {
        Args: { p_limit?: number; p_person_entity_id: string }
        Returns: {
          event_id: string
          event_name: string
          role: string
          start_time: string
        }[]
      }
      admin_get_person_roles_v1: {
        Args: { p_person_entity_id: string }
        Returns: {
          avatar_url: string
          label: string
          role_id: string
          role_type: string
        }[]
      }
      admin_get_person_roles_v2: {
        Args: { p_person_entity_id: string }
        Returns: {
          avatar_url: string
          event_count: number
          label: string
          role_id: string
          role_type: string
        }[]
      }
      admin_get_suspected_duplicate_profiles: {
        Args: {
          p_city?: string
          p_city_id?: string
          p_city_slug?: string
          p_limit?: number
        }
        Returns: {
          candidate_count: number
          city_key: string
          normalized_name: string
          profile_ids: string[]
          profile_type: string
        }[]
      }
      admin_get_teacher_v1: {
        Args: { p_entity_id: string }
        Returns: {
          achievements: string[]
          availability: string
          city: string
          city_id: string
          created_at: string
          email: string
          entity_id: string
          facebook: string
          faq: string
          first_name: string
          gallery_urls: string[]
          hide_surname: boolean
          id: string
          instagram: string
          is_active: boolean
          journey: string
          languages: string[]
          meta_data: Json
          nationality: string
          offers_private: boolean
          phone: string
          photo_url: string
          private_lesson_locations: string[]
          private_lesson_types: string[]
          private_travel_distance: number
          profile_source: string
          surname: string
          teaching_styles: string[]
          updated_at: string
          website: string
          years_teaching: number
        }[]
      }
      admin_get_unlinked_events_queue: {
        Args: {
          p_city?: string
          p_city_id?: string
          p_city_slug?: string
          p_limit?: number
        }
        Returns: {
          city: string
          city_id_text: string
          city_slug: string
          event_id: string
          event_name: string
          missing_organiser: boolean
          missing_venue: boolean
          reason: string
          start_time: string
        }[]
      }
      admin_get_unlinked_profiles_queue: {
        Args: {
          p_city?: string
          p_city_id?: string
          p_city_slug?: string
          p_limit?: number
        }
        Returns: {
          city: string
          city_id_text: string
          city_slug: string
          display_name: string
          profile_id: string
          profile_type: string
        }[]
      }
      admin_get_vendor_v1: {
        Args: { p_id: string }
        Returns: {
          address: string
          business_name: string
          city: string
          city_id: string
          country: string
          description: string
          email: string
          facebook: string
          faq: string
          first_name: string
          gallery_urls: string[]
          id: string
          instagram: string
          is_active: boolean
          meta_data: Json
          phone: string
          photo_url: string
          product_categories: string[]
          product_photos: string[]
          products: Json
          promo_code: string
          promo_discount_type: string
          promo_discount_value: number
          public_email: string
          representative_name: string
          ships_international: boolean
          short_description: string
          surname: string
          team: Json
          upcoming_events: string[]
          verified: boolean
          website: string
          whatsapp: string
        }[]
      }
      admin_get_venue_v1: {
        Args: { p_entity_id: string }
        Returns: {
          address: string
          admin_notes: string
          bar_available: boolean
          capacity: number
          city: string
          city_id: string
          cloakroom_available: boolean
          country: string
          created_at: string
          description: string
          entity_id: string
          facilities_new: string[]
          faq_json: Json
          floor_type: string
          gallery_urls: string[]
          google_maps_link: string
          id: string
          id_required: boolean
          last_entry_time: string
          meta_data: Json
          name: string
          opening_hours: Json
          parking_json: Json
          photo_url: string[]
          postcode: string
          timezone: string
          transport_json: Json
          user_id: string
          venue_rating: number
          video_urls: string[]
        }[]
      }
      admin_get_videographer_v1: {
        Args: { p_entity_id: string }
        Returns: {
          address: string
          business_name: string
          city: string
          city_id: string
          country: string
          created_at: string
          description: string
          email: string
          entity_id: string
          equipment: string
          facebook: string
          faq: string
          first_name: string
          gallery_urls: string[]
          id: string
          instagram: string
          is_active: boolean
          meta_data: Json
          nationality: string
          phone: string
          photo_url: string
          profile_source: string
          public_email: string
          short_description: string
          surname: string
          team: Json
          travel_options: string
          upcoming_events: string[]
          updated_at: string
          verified: boolean
          videography_styles: string[]
          website: string
          whatsapp: string
        }[]
      }
      admin_is_admin: { Args: never; Returns: boolean }
      admin_link_role_to_person_v1: {
        Args: {
          p_person_entity_id: string
          p_profile_id: string
          p_role_type: string
        }
        Returns: Json
      }
      admin_list_dancers_v1: {
        Args: { p_limit?: number; p_offset?: number; p_query?: string }
        Returns: {
          avatar_url: string
          based_city_id: string
          city: string
          created_at: string
          dance_role: string
          dance_started_year: number
          display_name: string
          first_name: string
          id: string
          is_active: boolean
          looking_for_partner: boolean
          nationality: string
          surname: string
          updated_at: string
        }[]
      }
      admin_list_djs_v1: {
        Args: { p_limit?: number; p_offset?: number; p_query?: string }
        Returns: {
          city: string
          city_id: string
          display_name: string
          dj_name: string
          entity_id: string
          first_name: string
          id: string
          is_active: boolean
          photo_url: string
          surname: string
          updated_at: string
        }[]
      }
      admin_list_organiser_options_v1: {
        Args: {
          p_controlled_ids?: string[]
          p_limit?: number
          p_query?: string
        }
        Returns: {
          id: string
          name: string
        }[]
      }
      admin_list_promo_codes_v1: {
        Args: never
        Returns: {
          city_id: string
          city_name: string
          code: string
          created_at: string
          currency: string
          description: string
          discount_type: string
          discount_value: number
          event_id: string
          event_name: string
          external_url: string
          id: string
          is_featured: boolean
          owner_display_name: string
          owner_id: string
          owner_type: string
          status: string
          terms: string
          title: string
          updated_at: string
          valid_from: string
          valid_until: string
        }[]
      }
      admin_list_teachers_v1: {
        Args: { p_limit?: number; p_offset?: number; p_query?: string }
        Returns: {
          city: string
          city_id: string
          display_name: string
          entity_id: string
          first_name: string
          id: string
          is_active: boolean
          photo_url: string
          surname: string
        }[]
      }
      admin_list_vendors_v1: {
        Args: { p_limit?: number; p_offset?: number; p_query?: string }
        Returns: {
          business_name: string
          city: string
          city_id: string
          country: string
          display_name: string
          id: string
          is_active: boolean
          photo_url: string
          verified: boolean
        }[]
      }
      admin_list_venues_v1: {
        Args: { p_limit?: number; p_offset?: number; p_query?: string }
        Returns: {
          address: string
          capacity: number
          city: string
          city_id: string
          country: string
          display_name: string
          entity_id: string
          id: string
          name: string
          photo_url: string
        }[]
      }
      admin_list_videographers_v1: {
        Args: { p_limit?: number; p_offset?: number; p_query?: string }
        Returns: {
          business_name: string
          city: string
          city_id: string
          display_name: string
          entity_id: string
          first_name: string
          id: string
          is_active: boolean
          photo_url: string
          surname: string
          updated_at: string
        }[]
      }
      admin_log_link_action: {
        Args: {
          p_action: string
          p_event_id: string
          p_link_id: string
          p_payload?: Json
          p_profile_id: string
          p_profile_type: string
          p_reason: string
          p_role: string
        }
        Returns: undefined
      }
      admin_merge_person_entities_v1: {
        Args: { p_from_id: string; p_into_id: string }
        Returns: Json
      }
      admin_normalize_name: { Args: { p_name: string }; Returns: string }
      admin_people_audit: {
        Args: never
        Returns: {
          linked: number
          orphan: number
          role: string
          role_only: number
        }[]
      }
      admin_people_list: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_q?: string
          p_role: string
        }
        Returns: {
          has_auth: boolean
          has_identity: boolean
          role: string
          role_row_id: string
          user_id: string
        }[]
      }
      admin_people_search_v2:
        | {
            Args: { p_limit?: number; p_offset?: number; p_query?: string }
            Returns: {
              avatar_url: string
              display_name: string
              entity_id: string
              id: string
              person_key: string
              role_types: string[]
              user_id: string
            }[]
          }
        | { Args: { p_request: Json }; Returns: Json }
      admin_people_search_v3:
        | {
            Args: { p_limit?: number; p_offset?: number; p_query?: string }
            Returns: {
              avatar_url: string
              display_name: string
              id: string
              person_entity_id: string
              role_types: string[]
              user_id: string
            }[]
          }
        | {
            Args: { search_term: string }
            Returns: {
              city_name: string
              full_name: string
              id: string
              roles: string[]
            }[]
          }
      admin_profile_exists: {
        Args: { p_profile_id: string; p_profile_type: string }
        Returns: boolean
      }
      admin_profile_lifecycle: {
        Args: {
          p_action: string
          p_profile_id: string
          p_profile_type: string
          p_reason: string
        }
        Returns: undefined
      }
      admin_rename_person_v1: {
        Args: { p_name: string; p_person_entity_id: string }
        Returns: Json
      }
      admin_resolve_city: {
        Args: { in_city_slug: string; in_city_text: string }
        Returns: {
          candidate_list: Json
          city_id: string
          name: string
          resolution_status: string
          slug: string
        }[]
      }
      admin_resolve_user_by_email: {
        Args: { p_email: string }
        Returns: string
      }
      admin_review_event_link_suggestion: {
        Args: {
          p_action: string
          p_is_primary?: boolean
          p_reason?: string
          p_suggestion_id: string
          p_verified?: boolean
        }
        Returns: Json
      }
      admin_role_to_profile_type: { Args: { p_role: string }; Returns: string }
      admin_row_city_matches: {
        Args: {
          p_city?: string
          p_city_id?: string
          p_city_slug?: string
          p_row: Json
        }
        Returns: boolean
      }
      admin_save_dancer_v1: {
        Args: { p_payload: Json; p_user_id: string }
        Returns: {
          achievements: string[]
          avatar_url: string
          based_city_id: string
          city: string
          created_at: string
          dance_role: string
          dance_started_year: number
          facebook: string
          favorite_songs: string[]
          favorite_styles: string[]
          first_name: string
          gallery_urls: string[]
          id: string
          instagram: string
          is_active: boolean
          looking_for_partner: boolean
          meta_data: Json
          nationality: string
          partner_details: string
          partner_practice_goals: string[]
          partner_search_level: string[]
          partner_search_role: string
          person_entity_id: string
          profile_source: string
          surname: string
          updated_at: string
          website: string
          whatsapp: string
        }[]
      }
      admin_save_dj_v1: {
        Args: { p_entity_id: string; p_payload: Json }
        Returns: {
          city: string
          city_id: string
          created_at: string
          dj_name: string
          email: string
          facebook: string
          faq: string
          first_name: string
          gallery_urls: string[]
          genres: string[]
          id: string
          instagram: string
          is_active: boolean
          meta_data: Json
          mixcloud: string
          nationality: string
          person_entity_id: string
          phone: string
          photo_url: string
          pricing: string
          profile_source: string
          soundcloud: string
          surname: string
          upcoming_events: string[]
          updated_at: string
          website: string
          whatsapp: string
          youtube_url: string
        }[]
      }
      admin_save_event_v2: { Args: { p_payload: Json }; Returns: Json }
      admin_save_event_v2_impl: { Args: { p_payload: Json }; Returns: Json }
      admin_save_teacher_v1: {
        Args: { p_entity_id: string; p_payload: Json }
        Returns: {
          achievements: string[]
          availability: string
          city: string
          city_id: string
          created_at: string
          email: string
          facebook: string
          faq: string
          first_name: string
          gallery_urls: string[]
          hide_surname: boolean
          id: string
          instagram: string
          is_active: boolean
          journey: string
          languages: string[]
          meta_data: Json
          nationality: string
          offers_private: boolean
          person_entity_id: string
          phone: string
          photo_url: string
          private_lesson_locations: string[]
          private_lesson_types: string[]
          private_travel_distance: number
          profile_source: string
          surname: string
          teaching_styles: string[]
          updated_at: string
          website: string
          years_teaching: number
        }[]
      }
      admin_save_vendor_v1: {
        Args: { p_entity_id: string; p_payload: Json }
        Returns: {
          address: string
          business_name: string
          city: string
          city_id: string
          country: string
          description: string
          email: string
          facebook: string
          faq: string
          first_name: string
          gallery_urls: string[]
          id: string
          instagram: string
          is_active: boolean
          meta_data: Json
          person_entity_id: string
          phone: string
          photo_url: string
          product_categories: string[]
          product_photos: string[]
          products: Json
          profile_source: string
          promo_code: string
          promo_discount_type: string
          promo_discount_value: number
          public_email: string
          representative_name: string
          ships_international: boolean
          short_description: string
          surname: string
          team: Json
          upcoming_events: string[]
          updated_at: string
          verified: boolean
          website: string
          whatsapp: string
        }[]
      }
      admin_save_venue: {
        Args: {
          p_address?: string
          p_capacity?: number
          p_city_id: string
          p_metadata?: Json
          p_name?: string
          p_venue_id: string
        }
        Returns: {
          entity_city_id: string
          venue_entity_id: string
          venue_id: string
          venue_name: string
        }[]
      }
      admin_save_venue_v2: { Args: { p_payload: Json }; Returns: Json }
      admin_save_videographer_v1: {
        Args: { p_entity_id: string; p_payload: Json }
        Returns: {
          address: string
          business_name: string
          city: string
          city_id: string
          country: string
          created_at: string
          description: string
          email: string
          equipment: string
          facebook: string
          faq: string
          first_name: string
          gallery_urls: string[]
          id: string
          instagram: string
          is_active: boolean
          meta_data: Json
          nationality: string
          person_entity_id: string
          phone: string
          photo_url: string
          profile_source: string
          public_email: string
          short_description: string
          surname: string
          team: Json
          travel_options: string
          upcoming_events: string[]
          updated_at: string
          verified: boolean
          videography_styles: string[]
          website: string
          whatsapp: string
        }[]
      }
      admin_search_existing_persons_v1: {
        Args: { p_limit?: number; p_offset?: number; p_query?: string }
        Returns: {
          avatar_url: string
          display_name: string
          person_key: string
          role_types: string[]
          user_id: string
        }[]
      }
      admin_settings_audit_insert: {
        Args: {
          p_action: string
          p_after_data: Json
          p_before_data: Json
          p_reason: string
          p_target_user_id: string
        }
        Returns: undefined
      }
      admin_sync_event_links_to_event_row: {
        Args: { p_event_id: string }
        Returns: Json
      }
      admin_unlink_role_from_person_v1: {
        Args: {
          p_person_entity_id: string
          p_profile_id: string
          p_role: string
        }
        Returns: Json
      }
      admin_update_my_notes: { Args: { p_notes: string }; Returns: Json }
      admin_update_sensitive_settings: {
        Args: {
          p_new_city_ids?: string[]
          p_new_is_active?: boolean
          p_new_role?: string
          p_reason?: string
          p_reauth_window_minutes?: number
          p_target_user_id: string
        }
        Returns: Json
      }
      admin_upsert_organiser: {
        Args: {
          p_avatar_url?: string
          p_city_id?: string
          p_claimed_by?: string
          p_contact_phone?: string
          p_id?: string
          p_instagram?: string
          p_is_active?: boolean
          p_name?: string
          p_organisation_category?: string
          p_profile_source?: string
          p_socials?: Json
          p_team_members?: Json
          p_website?: string
        }
        Returns: Json
      }
      admin_upsert_promo_code: {
        Args: { p_id?: string; p_payload?: Json }
        Returns: {
          city_id: string
          code: string
          created_at: string
          created_by: string
          currency: string
          description: string
          discount_type: string
          discount_value: number
          event_id: string
          external_url: string
          id: string
          is_featured: boolean
          owner_display_name: string
          owner_id: string
          owner_type: string
          status: string
          terms: string
          title: string
          updated_at: string
          valid_from: string
          valid_until: string
        }[]
      }
      approve_city_request: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      auth_is_event_organiser: {
        Args: { p_event_id: string }
        Returns: boolean
      }
      auth_reauth_within_minutes: {
        Args: { p_minutes?: number }
        Returns: boolean
      }
      calendar_events_dto: {
        Args: {
          p_city_id?: string
          p_from: string
          p_to: string
          p_venue_id?: string
        }
        Returns: Json[]
      }
      calendar_occurrences_prune: { Args: never; Returns: number }
      calendar_occurrences_upsert_protected: {
        Args: {
          p_city_id: string
          p_city_slug: string
          p_event_id: string
          p_instance_end: string
          p_instance_start: string
          p_is_override: boolean
          p_lifecycle_status: string
          p_override_payload: Json
          p_source: string
        }
        Returns: undefined
      }
      can_current_user_manage_event_graph: {
        Args: { p_event_id: string }
        Returns: boolean
      }
      can_current_user_manage_profile: {
        Args: { p_profile_id: string; p_profile_type: string }
        Returns: boolean
      }
      can_manage_connectivity: { Args: never; Returns: boolean }
      can_user_edit_event: {
        Args: { p_event_id: string; p_user_id: string }
        Returns: boolean
      }
      claim_dancer_profile: { Args: { p_dancer_id: string }; Returns: string }
      claim_dj_profile: { Args: { p_dj_id: string }; Returns: string }
      claim_organiser_profile: {
        Args: { p_organiser_id: string }
        Returns: string
      }
      claim_teacher_profile: { Args: { p_teacher_id: string }; Returns: string }
      claim_vendor_profile_for_current_user: {
        Args: { p_vendor_id: string }
        Returns: string
      }
      dancer_completeness: { Args: { p_user_id: string }; Returns: Json }
      dashboard_events_summary_dto: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: Json[]
      }
      delete_venue_admin: {
        Args: { actor_user_id: string; p_entity_id: string }
        Returns: Json
      }
      enforce_manager_city_scope_for_user: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      enqueue_event_job: {
        Args: { p_event_id: string; p_job_type: string; p_payload: Json }
        Returns: string
      }
      ensure_dancer_profile: {
        Args: {
          p_city?: string
          p_email?: string
          p_first_name?: string
          p_surname?: string
          p_user_id: string
        }
        Returns: string
      }
      generate_occurrences_for_event: {
        Args: { p_event_id: string }
        Returns: undefined
      }
      generate_occurrences_for_event_backup: {
        Args: { p_event_id: string }
        Returns: undefined
      }
      get_active_cities: {
        Args: never
        Returns: {
          country_code: string
          event_count: number
          name: string
          slug: string
        }[]
      }
      get_based_city_prefill: {
        Args: never
        Returns: {
          city_id: string
          city_name: string
        }[]
      }
      get_calendar_events: {
          Args: {
            range_start: string
            range_end: string
            city_slug_param?: string
          }
          Returns: {
            city_slug: string
            class_end: string
            class_start: string
            cover_image_url: string
            end_time: string
            event_id: string
            has_class: boolean
            has_party: boolean
            instance_date: string
            is_recurring: boolean
            key_times: Json
            location: string
            meta_data: Json
            name: string
            party_end: string
            party_start: string
            photo_url: string[]
            start_time: string
            type: string
          }[]
        }
      get_current_user_organiser_entity_ids_v1: {
        Args: never
        Returns: {
          entity_id: string
        }[]
      }
      get_current_user_organiser_ids: { Args: never; Returns: string[] }
      get_discount_partners_with_next_event: {
        Args: { p_city_slug?: string }
        Returns: {
          city: string
          id: string
          instagram: string
          name: string
          next_event_date: string
          next_event_name: string
          organisation_name: string
          photo_url: string[]
        }[]
      }
      get_entity_events: {
        Args: { p_city_slug?: string; p_entity_id: string; p_role: string }
        Returns: {
          cover_image_url: string
          date: string
          id: string
          is_published: boolean
          location: string
          name: string
          photo_url: string[]
        }[]
      }
      get_event_engagement: {
        Args: { p_event_id: string }
        Returns: {
          going_count: number
          interested_count: number
        }[]
      }
      get_event_page_snapshot: {
        Args: { p_event_id: string; p_occurrence_id?: string }
        Returns: Json
      }
      get_event_page_snapshot_v2: {
        Args: { p_event_id: string; p_occurrence_id?: string }
        Returns: Json
      }
      get_event_profile_connections: {
        Args: { p_event_id: string }
        Returns: {
          connection_label: string
          created_at: string
          event_id: string
          id: string
          is_primary: boolean
          notes: string
          person_id: string
          person_type: string
          sort_order: number
        }[]
      }
      get_festival_attendance: { Args: { p_event_id: string }; Returns: Json }
      get_occurrences_by_canonical_venue: {
        Args: {
          _end_at: string
          _limit?: number
          _offset?: number
          _start_at: string
          _venue_id: string
        }
        Returns: {
          canonical_venue_id: string
          canonical_venue_source: string
          event_id: string
          instance_end: string
          instance_start: string
          occurrence_id: string
        }[]
      }
      get_organiser_event_counts: {
        Args: { p_city_slug?: string }
        Returns: {
          entity_id: string
          event_count: number
        }[]
      }
      get_organiser_linked_events: {
        Args: { p_organiser_entity_id: string }
        Returns: {
          city: string
          id: string
          lifecycle_status: string
          name: string
          start_time: string
        }[]
      }
      get_profile_event_timeline: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_person_id: string
          p_person_type: string
        }
        Returns: {
          connection_label: string
          event_id: string
          event_location: string
          event_name: string
          event_start_time: string
          is_primary: boolean
          sort_order: number
        }[]
      }
      get_public_dancer_preview_v1: {
        Args: { p_user_id: string }
        Returns: {
          achievements: string[]
          avatar_url: string
          based_city_id: string
          city: string
          dance_role: string
          facebook: string
          favorite_styles: string[]
          first_name: string
          gallery_urls: string[]
          id: string
          instagram: string
          looking_for_partner: boolean
          nationality: string
          partner_search_level: string[]
          partner_search_role: string
          surname: string
          website: string
        }[]
      }
      get_public_dj_preview_v1: {
        Args: { p_entity_id: string }
        Returns: {
          city: string
          city_id: string
          dj_name: string
          email: string
          entity_id: string
          facebook: string
          first_name: string
          genres: string[]
          instagram: string
          nationality: string
          phone: string
          photo_url: string
          soundcloud: string
          surname: string
          website: string
          youtube_url: string
        }[]
      }
      get_public_event_detail: {
        Args: { p_event_id: string; p_occurrence_id?: string }
        Returns: Json
      }
      get_public_festival_detail: {
        Args: { p_event_id: string }
        Returns: Json
      }
      get_public_organiser_info: {
        Args: { organiser_id: string }
        Returns: {
          bio: string
          category: string
          city: string
          gallery_urls: string[]
          id: string
          instagram: string
          name: string
          photo_url: string
          promo_video_urls: string[]
          teaching_styles: string[]
          verified: boolean
          website: string
        }[]
      }
      get_public_promo_codes: {
        Args: {
          p_city_id?: string
          p_featured_only?: boolean
          p_limit?: number
        }
        Returns: {
          city_id: string
          city_name: string
          code: string
          currency: string
          description: string
          discount_type: string
          discount_value: number
          event_id: string
          event_name: string
          external_url: string
          id: string
          is_featured: boolean
          owner_display_name: string
          owner_type: string
          status: string
          terms: string
          title: string
          valid_from: string
          valid_until: string
        }[]
      }
      get_public_teacher_detail_v1: {
        Args: { p_entity_id: string }
        Returns: {
          achievements: string[]
          availability: string
          city: string
          city_id: string
          email: string
          entity_id: string
          facebook: string
          faq: string
          first_name: string
          gallery_urls: string[]
          instagram: string
          journey: string
          languages: string[]
          nationality: string
          offers_private: boolean
          phone: string
          photo_url: string
          private_lesson_locations: string[]
          private_lesson_types: string[]
          private_travel_distance: number
          surname: string
          teaching_styles: string[]
          website: string
          years_teaching: number
        }[]
      }
      get_public_teacher_preview_v1: {
        Args: { p_entity_id: string }
        Returns: {
          city: string
          city_id: string
          email: string
          entity_id: string
          facebook: string
          first_name: string
          instagram: string
          languages: string[]
          nationality: string
          offers_private: boolean
          phone: string
          photo_url: string
          surname: string
          teaching_styles: string[]
          website: string
          years_teaching: number
        }[]
      }
      get_public_venue_by_venues_id: {
        Args: { p_venue_id: string }
        Returns: Json
      }
      get_public_venue_preview_v1: {
        Args: { p_entity_id: string }
        Returns: {
          address: string
          capacity: number
          city: string
          city_id: string
          country: string
          description: string
          entity_id: string
          facilities_new: string[]
          faq_json: Json
          floor_type: string
          gallery_urls: string[]
          google_maps_link: string
          name: string
          opening_hours: Json
          photo_url: string[]
          postcode: string
        }[]
      }
      get_public_videographer_preview_v1: {
        Args: { p_entity_id: string }
        Returns: {
          business_name: string
          city: string
          city_id: string
          country: string
          description: string
          entity_id: string
          facebook: string
          first_name: string
          instagram: string
          nationality: string
          photo_url: string
          public_email: string
          short_description: string
          surname: string
          videography_styles: string[]
          website: string
        }[]
      }
      get_user_identity_prefill: {
        Args: never
        Returns: {
          based_city_id: string
          based_city_name: string
          full_name: string
        }[]
      }
      get_user_participant_events: {
        Args: { p_city_slug?: string; p_user_email: string }
        Returns: {
          cover_image_url: string
          event_date: string
          event_id: string
          event_name: string
          location: string
          status: string
        }[]
      }
      get_venue_detail: { Args: { p_venue_id: string }; Returns: Json }
      get_venue_events: {
        Args: { p_city_slug?: string; p_venue_id: string }
        Returns: {
          date: string
          id: string
          is_published: boolean
          location: string
          name: string
        }[]
      }
      idempotency_claim: {
        Args: { p_key: string; p_request_hash: string }
        Returns: boolean
      }
      idempotency_get: {
        Args: { p_key: string }
        Returns: {
          created_at: string
          key: string
          request_hash: string
          response: Json
          status: string
          updated_at: string
        }[]
      }
      idempotency_store: {
        Args: {
          p_key: string
          p_request_hash: string
          p_response: Json
          p_status: string
        }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_current_user_admin: { Args: never; Returns: boolean }
      is_super_admin: { Args: { p_user_id?: string }; Returns: boolean }
      is_valid_city_slug: { Args: { p_slug: string }; Returns: boolean }
      list_events_dto: {
        Args: {
          p_city_id?: string
          p_from?: string
          p_limit?: number
          p_offset?: number
          p_to?: string
          p_venue_id?: string
        }
        Returns: Json[]
      }
      normalize_event_instances: {
        Args: { p_event_row?: Json; p_instances: Json }
        Returns: Json
      }
      organiser_get_event_snapshot_v1: {
        Args: { p_event_id: string }
        Returns: Json
      }
      organiser_save_event_v1: {
        Args: { p_event_id: string; p_payload: Json }
        Returns: Json
      }
      pg_advisory_lock_event: {
        Args: { p_event_id: string }
        Returns: undefined
      }
      pg_advisory_unlock_event: {
        Args: { p_event_id: string }
        Returns: boolean
      }
      pg_try_advisory_lock_event: {
        Args: { p_event_id: string }
        Returns: boolean
      }
      propagate_event_venue_to_future_occurrences: {
        Args: {
          _event_id: string
          _from_occurrence_id: string
          _new_venue_id: string
        }
        Returns: number
      }
      reject_city_request: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      replace_event_program: {
        Args: { p_event_id: string; p_meta_data: Json }
        Returns: undefined
      }
      replace_or_patch_guest_dancers: {
        Args: { p_event_id: string; p_guest_dancers: Json; p_replace: boolean }
        Returns: undefined
      }
      replace_or_patch_lineup: {
        Args: { p_event_id: string; p_lineup: Json; p_replace: boolean }
        Returns: undefined
      }
      replace_or_patch_occurrences: {
        Args: { p_event_id: string; p_occurrences: Json; p_replace: boolean }
        Returns: string
      }
      replace_or_patch_organisers: {
        Args: { p_event_id: string; p_organisers: Json; p_replace: boolean }
        Returns: undefined
      }
      resolve_city_id: {
        Args: { p_city?: string; p_city_slug?: string }
        Returns: string
      }
      resolve_guest_assignments: {
        Args: { p_assignments: Json; p_event_id: string; p_timezone: string }
        Returns: {
          guest_profile_id: string
          occurrence_id: string
          role: string
        }[]
      }
      save_event_core: {
        Args: { p_event_core: Json; p_event_id: string }
        Returns: undefined
      }
      search_cities: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          city_id: string
          city_name: string
          city_slug: string
          country_name: string
          display_name: string
        }[]
      }
      set_attendance: {
        Args: { p_event_id: string; p_status?: string }
        Returns: {
          created_at: string | null
          id: string
          occurrence_id: string
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "event_attendance"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_calendar_occurrence_venue: {
        Args: {
          _occurrence_id: string
          _propagate?: boolean
          _venue_id: string
        }
        Returns: undefined
      }
      unaccent: { Args: { "": string }; Returns: string }
      upsert_event_guest_dancer_link:
        | { Args: { _payload: Json }; Returns: undefined }
        | {
            Args: {
              p_actor?: string
              p_event_id: string
              p_occurrence_id?: string
              p_profile_id: string
            }
            Returns: undefined
          }
      upsert_event_profile_connection: {
        Args: {
          p_connection_label: string
          p_event_id: string
          p_is_primary?: boolean
          p_notes?: string
          p_person_id: string
          p_person_type: string
          p_sort_order?: number
        }
        Returns: string
      }
      upsert_full_member_and_dancer: {
        Args: {
          p_achievements?: string[]
          p_avatar_url?: string
          p_based_city_id?: string
          p_city_id?: string
          p_dancing_start_date?: string
          p_facebook?: string
          p_favorite_songs?: string[]
          p_favorite_styles?: string[]
          p_first_name?: string
          p_first_name_dancer?: string
          p_full_name?: string
          p_instagram?: string
          p_is_active?: boolean
          p_last_name?: string
          p_looking_for_partner?: boolean
          p_nationality?: string
          p_partner_details?: string
          p_partner_practice_goals?: string[]
          p_partner_role?: string
          p_partner_search_level?: string[]
          p_partner_search_role?: string
          p_photo_url?: string
          p_profile_source?: string
          p_surname?: string
          p_user_id: string
          p_website?: string
          p_whatsapp?: string
        }
        Returns: Json
      }
      upsert_guest_dancer: {
        Args: {
          p_archived_at?: string
          p_event_id: string
          p_occurrence_id?: string
          p_profile_id: string
        }
        Returns: {
          archived_at: string | null
          archived_by: string | null
          created_at: string
          created_by: string | null
          event_id: string
          id: string
          is_primary: boolean
          occurrence_id: string | null
          person_entity_id: string | null
          profile_id: string
          profile_type: string
          reason: string | null
          role: string
          source: string
          status: string
          updated_at: string
          updated_by: string | null
          verified: boolean
        }
        SetofOptions: {
          from: "*"
          to: "event_profile_links"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_venue_atomic: { Args: { payload: Json }; Returns: Json }
      uuid_to_bigint: { Args: { p_uuid: string }; Returns: number }
    }
    Enums: {
      event_entity_role: "organiser"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      event_entity_role: ["organiser"],
    },
  },
} as const
