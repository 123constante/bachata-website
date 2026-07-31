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
  public: {
    Tables: {
      admin_action_log: {
        Row: {
          action_category: string
          actor_email: string | null
          actor_role: string | null
          actor_user_id: string | null
          created_at: string
          duration_ms: number | null
          entity_display_name: string | null
          entity_id: string | null
          entity_type: string
          error_code: string | null
          error_message: string | null
          id: string
          ip_address: unknown
          params: Json
          request_id: string | null
          rpc_name: string
          snapshot_before: Json | null
          success: boolean
          user_agent: string | null
        }
        Insert: {
          action_category: string
          actor_email?: string | null
          actor_role?: string | null
          actor_user_id?: string | null
          created_at?: string
          duration_ms?: number | null
          entity_display_name?: string | null
          entity_id?: string | null
          entity_type: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          ip_address?: unknown
          params?: Json
          request_id?: string | null
          rpc_name: string
          snapshot_before?: Json | null
          success: boolean
          user_agent?: string | null
        }
        Update: {
          action_category?: string
          actor_email?: string | null
          actor_role?: string | null
          actor_user_id?: string | null
          created_at?: string
          duration_ms?: number | null
          entity_display_name?: string | null
          entity_id?: string | null
          entity_type?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          ip_address?: unknown
          params?: Json
          request_id?: string | null
          rpc_name?: string
          snapshot_before?: Json | null
          success?: boolean
          user_agent?: string | null
        }
        Relationships: []
      }
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
      admin_telemetry_event: {
        Row: {
          action_kind: string
          actor_uid: string | null
          event_id: string | null
          id: string
          meta_data: Json | null
          occurred_at: string
          occurrence_id: string | null
        }
        Insert: {
          action_kind: string
          actor_uid?: string | null
          event_id?: string | null
          id?: string
          meta_data?: Json | null
          occurred_at?: string
          occurrence_id?: string | null
        }
        Update: {
          action_kind?: string
          actor_uid?: string | null
          event_id?: string | null
          id?: string
          meta_data?: Json | null
          occurred_at?: string
          occurrence_id?: string | null
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
      api_consumers: {
        Row: {
          allowed_origins: string[] | null
          api_key_hash: string
          api_key_prefix: string
          contact_email: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          last_used_at: string | null
          lifecycle_status: string
          name: string
          notes: string | null
          rate_limit_per_minute: number | null
          revoked_at: string | null
        }
        Insert: {
          allowed_origins?: string[] | null
          api_key_hash: string
          api_key_prefix: string
          contact_email: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          lifecycle_status?: string
          name: string
          notes?: string | null
          rate_limit_per_minute?: number | null
          revoked_at?: string | null
        }
        Update: {
          allowed_origins?: string[] | null
          api_key_hash?: string
          api_key_prefix?: string
          contact_email?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          lifecycle_status?: string
          name?: string
          notes?: string | null
          rate_limit_per_minute?: number | null
          revoked_at?: string | null
        }
        Relationships: []
      }
      api_request_log: {
        Row: {
          consumer_id: string
          created_at: string
          endpoint: string
          error_code: string | null
          id: number
          ip: unknown
          response_ms: number
          status_code: number
          user_agent: string | null
        }
        Insert: {
          consumer_id: string
          created_at?: string
          endpoint: string
          error_code?: string | null
          id?: number
          ip?: unknown
          response_ms: number
          status_code: number
          user_agent?: string | null
        }
        Update: {
          consumer_id?: string
          created_at?: string
          endpoint?: string
          error_code?: string | null
          id?: number
          ip?: unknown
          response_ms?: number
          status_code?: number
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_request_log_consumer_id_fkey"
            columns: ["consumer_id"]
            isOneToOne: false
            referencedRelation: "api_consumers"
            referencedColumns: ["id"]
          },
        ]
      }
      app_feature_flags: {
        Row: {
          description: string | null
          enabled: boolean
          flag_key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          description?: string | null
          enabled?: boolean
          flag_key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          description?: string | null
          enabled?: boolean
          flag_key?: string
          updated_at?: string
          updated_by?: string | null
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
      calendar_occurrence_added_session_people: {
        Row: {
          added_session_id: string
          avatar_url: string | null
          created_at: string
          display_name_override: string | null
          id: string
          idempotency_key: string | null
          profile_id: string
          profile_type: string
          role: string | null
          sort_order: number | null
        }
        Insert: {
          added_session_id: string
          avatar_url?: string | null
          created_at?: string
          display_name_override?: string | null
          id?: string
          idempotency_key?: string | null
          profile_id: string
          profile_type: string
          role?: string | null
          sort_order?: number | null
        }
        Update: {
          added_session_id?: string
          avatar_url?: string | null
          created_at?: string
          display_name_override?: string | null
          id?: string
          idempotency_key?: string | null
          profile_id?: string
          profile_type?: string
          role?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_occurrence_added_session_people_added_session_id_fkey"
            columns: ["added_session_id"]
            isOneToOne: false
            referencedRelation: "calendar_occurrence_added_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_occurrence_added_sessions: {
        Row: {
          created_at: string
          end_time_local: string | null
          id: string
          idempotency_key: string | null
          levels: string[] | null
          occurrence_id: string
          room: string | null
          section_kind: string | null
          sort_order: number
          start_time_local: string | null
          style: string | null
          theme: string | null
          title: string | null
          track_id: string | null
          type: string
          updated_at: string
          venue_room_id: string | null
        }
        Insert: {
          created_at?: string
          end_time_local?: string | null
          id?: string
          idempotency_key?: string | null
          levels?: string[] | null
          occurrence_id: string
          room?: string | null
          section_kind?: string | null
          sort_order?: number
          start_time_local?: string | null
          style?: string | null
          theme?: string | null
          title?: string | null
          track_id?: string | null
          type?: string
          updated_at?: string
          venue_room_id?: string | null
        }
        Update: {
          created_at?: string
          end_time_local?: string | null
          id?: string
          idempotency_key?: string | null
          levels?: string[] | null
          occurrence_id?: string
          room?: string | null
          section_kind?: string | null
          sort_order?: number
          start_time_local?: string | null
          style?: string | null
          theme?: string | null
          title?: string | null
          track_id?: string | null
          type?: string
          updated_at?: string
          venue_room_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_occurrence_added_sessions_occurrence_id_fkey"
            columns: ["occurrence_id"]
            isOneToOne: false
            referencedRelation: "calendar_feed"
            referencedColumns: ["row_id"]
          },
          {
            foreignKeyName: "calendar_occurrence_added_sessions_occurrence_id_fkey"
            columns: ["occurrence_id"]
            isOneToOne: false
            referencedRelation: "calendar_occurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_occurrence_added_sessions_venue_room_id_fkey"
            columns: ["venue_room_id"]
            isOneToOne: false
            referencedRelation: "venue_rooms"
            referencedColumns: ["id"]
          },
        ]
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
      calendar_occurrence_session_overrides: {
        Row: {
          cancellation_reason_label: string | null
          cancelled: boolean
          created_at: string
          end_time_override: string | null
          idempotency_key: string | null
          levels_override: string[] | null
          occurrence_id: string
          program_item_id: string
          room_override: string | null
          start_time_override: string | null
          style_override: string | null
          theme_override: string | null
          title_override: string | null
          track_id_override: string | null
          type_override: string | null
          updated_at: string
          venue_room_id_override: string | null
        }
        Insert: {
          cancellation_reason_label?: string | null
          cancelled?: boolean
          created_at?: string
          end_time_override?: string | null
          idempotency_key?: string | null
          levels_override?: string[] | null
          occurrence_id: string
          program_item_id: string
          room_override?: string | null
          start_time_override?: string | null
          style_override?: string | null
          theme_override?: string | null
          title_override?: string | null
          track_id_override?: string | null
          type_override?: string | null
          updated_at?: string
          venue_room_id_override?: string | null
        }
        Update: {
          cancellation_reason_label?: string | null
          cancelled?: boolean
          created_at?: string
          end_time_override?: string | null
          idempotency_key?: string | null
          levels_override?: string[] | null
          occurrence_id?: string
          program_item_id?: string
          room_override?: string | null
          start_time_override?: string | null
          style_override?: string | null
          theme_override?: string | null
          title_override?: string | null
          track_id_override?: string | null
          type_override?: string | null
          updated_at?: string
          venue_room_id_override?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_occurrence_session_overrides_occurrence_id_fkey"
            columns: ["occurrence_id"]
            isOneToOne: false
            referencedRelation: "calendar_feed"
            referencedColumns: ["row_id"]
          },
          {
            foreignKeyName: "calendar_occurrence_session_overrides_occurrence_id_fkey"
            columns: ["occurrence_id"]
            isOneToOne: false
            referencedRelation: "calendar_occurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_occurrence_session_overrides_program_item_id_fkey"
            columns: ["program_item_id"]
            isOneToOne: false
            referencedRelation: "event_program_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_occurrence_session_overrides_venue_room_id_override_fk"
            columns: ["venue_room_id_override"]
            isOneToOne: false
            referencedRelation: "venue_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_occurrence_session_people_overrides: {
        Row: {
          add_avatar_url: string | null
          add_display_name_override: string | null
          add_profile_id: string | null
          add_profile_type: string | null
          add_role: string | null
          add_sort_order: number | null
          created_at: string
          id: string
          idempotency_key: string | null
          occurrence_id: string
          op: string
          program_item_id: string
          remove_program_people_id: string | null
        }
        Insert: {
          add_avatar_url?: string | null
          add_display_name_override?: string | null
          add_profile_id?: string | null
          add_profile_type?: string | null
          add_role?: string | null
          add_sort_order?: number | null
          created_at?: string
          id?: string
          idempotency_key?: string | null
          occurrence_id: string
          op: string
          program_item_id: string
          remove_program_people_id?: string | null
        }
        Update: {
          add_avatar_url?: string | null
          add_display_name_override?: string | null
          add_profile_id?: string | null
          add_profile_type?: string | null
          add_role?: string | null
          add_sort_order?: number | null
          created_at?: string
          id?: string
          idempotency_key?: string | null
          occurrence_id?: string
          op?: string
          program_item_id?: string
          remove_program_people_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_occurrence_session_peopl_remove_program_people_id_fkey"
            columns: ["remove_program_people_id"]
            isOneToOne: false
            referencedRelation: "event_program_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_occurrence_session_people_overrid_program_item_id_fkey"
            columns: ["program_item_id"]
            isOneToOne: false
            referencedRelation: "event_program_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_occurrence_session_people_overrides_occurrence_id_fkey"
            columns: ["occurrence_id"]
            isOneToOne: false
            referencedRelation: "calendar_feed"
            referencedColumns: ["row_id"]
          },
          {
            foreignKeyName: "calendar_occurrence_session_people_overrides_occurrence_id_fkey"
            columns: ["occurrence_id"]
            isOneToOne: false
            referencedRelation: "calendar_occurrences"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_occurrences: {
        Row: {
          cancellation_reason_label: string | null
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
          cancellation_reason_label?: string | null
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
          cancellation_reason_label?: string | null
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
            foreignKeyName: "calendar_occurrences_cancellation_label_fk"
            columns: ["cancellation_reason_label"]
            isOneToOne: false
            referencedRelation: "cancellation_reasons"
            referencedColumns: ["label"]
          },
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
            referencedRelation: "events"
            referencedColumns: ["id"]
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
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      cancellation_reasons: {
        Row: {
          archived_at: string | null
          created_at: string
          key: string
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          key: string
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          key?: string
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      cities: {
        Row: {
          country_code: string
          country_name: string | null
          created_at: string | null
          description: string | null
          header_image_url: string | null
          hero_image_url: string | null
          id: string
          is_active: boolean | null
          name: string
          population: number | null
          slug: string
          timezone: string
          updated_at: string | null
        }
        Insert: {
          country_code: string
          country_name?: string | null
          created_at?: string | null
          description?: string | null
          header_image_url?: string | null
          hero_image_url?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          population?: number | null
          slug: string
          timezone?: string
          updated_at?: string | null
        }
        Update: {
          country_code?: string
          country_name?: string | null
          created_at?: string | null
          description?: string | null
          header_image_url?: string | null
          hero_image_url?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          population?: number | null
          slug?: string
          timezone?: string
          updated_at?: string | null
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
            foreignKeyName: "fk_cities_country"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
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
          approved_at: string | null
          approved_by: string | null
          context: string | null
          created_at: string
          id: string
          notes: string | null
          reject_reason: string | null
          rejected_at: string | null
          rejected_by: string | null
          requested_by: string | null
          requested_name: string
          requested_slug: string | null
          status: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          context?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          reject_reason?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          requested_by?: string | null
          requested_name: string
          requested_slug?: string | null
          status?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          context?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          reject_reason?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          requested_by?: string | null
          requested_name?: string
          requested_slug?: string | null
          status?: string
        }
        Relationships: []
      }
      client_error_log: {
        Row: {
          context: Json | null
          error_code: string | null
          error_message: string | null
          id: string
          occurred_at: string
          release: string | null
          source: string
          user_agent: string | null
          viewer_session_id: string | null
        }
        Insert: {
          context?: Json | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          occurred_at?: string
          release?: string | null
          source: string
          user_agent?: string | null
          viewer_session_id?: string | null
        }
        Update: {
          context?: Json | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          occurred_at?: string
          release?: string | null
          source?: string
          user_agent?: string | null
          viewer_session_id?: string | null
        }
        Relationships: []
      }
      command_dispatch_p5: {
        Row: {
          created_at: string
          enabled: boolean
          handler_fn: string
          kind: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          handler_fn: string
          kind: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          handler_fn?: string
          kind?: string
        }
        Relationships: []
      }
      command_idempotency_p5: {
        Row: {
          actor_id: string
          audit_id: string
          created_at: string
          idempotency_key: string
          response_payload: Json
        }
        Insert: {
          actor_id: string
          audit_id: string
          created_at?: string
          idempotency_key: string
          response_payload: Json
        }
        Update: {
          actor_id?: string
          audit_id?: string
          created_at?: string
          idempotency_key?: string
          response_payload?: Json
        }
        Relationships: []
      }
      countries: {
        Row: {
          alpha3: string | null
          code: string
          created_at: string
          flag: string | null
          is_active: boolean
          name: string
          native_name: string | null
        }
        Insert: {
          alpha3?: string | null
          code: string
          created_at?: string
          flag?: string | null
          is_active?: boolean
          name: string
          native_name?: string | null
        }
        Update: {
          alpha3?: string | null
          code?: string
          created_at?: string
          flag?: string | null
          is_active?: boolean
          name?: string
          native_name?: string | null
        }
        Relationships: []
      }
      daily_health_metrics: {
        Row: {
          breach_threshold: number | null
          computed_at: string
          denominator: number | null
          details: Json
          id: string
          is_breach: boolean
          metric_date: string
          metric_name: string
          numerator: number | null
          value_pct: number | null
        }
        Insert: {
          breach_threshold?: number | null
          computed_at?: string
          denominator?: number | null
          details?: Json
          id?: string
          is_breach?: boolean
          metric_date: string
          metric_name: string
          numerator?: number | null
          value_pct?: number | null
        }
        Update: {
          breach_threshold?: number | null
          computed_at?: string
          denominator?: number | null
          details?: Json
          id?: string
          is_breach?: boolean
          metric_date?: string
          metric_name?: string
          numerator?: number | null
          value_pct?: number | null
        }
        Relationships: []
      }
      dancer_profiles: {
        Row: {
          achievements: string[]
          archived_at: string | null
          avatar_url: string | null
          based_city_id: string | null
          claimed_by: string | null
          cover_url: string | null
          created_at: string
          created_by: string | null
          dance_role: string | null
          dance_started_year: number | null
          description: string | null
          display_name: string | null
          email: string | null
          facebook: string | null
          favorite_songs: string[]
          favorite_styles: string[]
          first_name: string | null
          gallery_urls: string[]
          id: string
          instagram: string | null
          instagram_normalized: string | null
          is_active: boolean | null
          languages: string[] | null
          looking_for_partner: boolean
          meta_data: Json
          nationality: string | null
          partner_details: string | null
          partner_practice_goals: string[]
          partner_search_level: string[]
          partner_search_role: string | null
          person_entity_id: string | null
          person_id: string | null
          phone: string | null
          photo_url: string | null
          profile_source: string | null
          slug: string
          surname: string | null
          updated_at: string
          website: string | null
          website_url: string | null
          whatsapp: string | null
        }
        Insert: {
          achievements?: string[]
          archived_at?: string | null
          avatar_url?: string | null
          based_city_id?: string | null
          claimed_by?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          dance_role?: string | null
          dance_started_year?: number | null
          description?: string | null
          display_name?: string | null
          email?: string | null
          facebook?: string | null
          favorite_songs?: string[]
          favorite_styles?: string[]
          first_name?: string | null
          gallery_urls?: string[]
          id: string
          instagram?: string | null
          instagram_normalized?: string | null
          is_active?: boolean | null
          languages?: string[] | null
          looking_for_partner?: boolean
          meta_data?: Json
          nationality?: string | null
          partner_details?: string | null
          partner_practice_goals?: string[]
          partner_search_level?: string[]
          partner_search_role?: string | null
          person_entity_id?: string | null
          person_id?: string | null
          phone?: string | null
          photo_url?: string | null
          profile_source?: string | null
          slug: string
          surname?: string | null
          updated_at?: string
          website?: string | null
          website_url?: string | null
          whatsapp?: string | null
        }
        Update: {
          achievements?: string[]
          archived_at?: string | null
          avatar_url?: string | null
          based_city_id?: string | null
          claimed_by?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          dance_role?: string | null
          dance_started_year?: number | null
          description?: string | null
          display_name?: string | null
          email?: string | null
          facebook?: string | null
          favorite_songs?: string[]
          favorite_styles?: string[]
          first_name?: string | null
          gallery_urls?: string[]
          id?: string
          instagram?: string | null
          instagram_normalized?: string | null
          is_active?: boolean | null
          languages?: string[] | null
          looking_for_partner?: boolean
          meta_data?: Json
          nationality?: string | null
          partner_details?: string | null
          partner_practice_goals?: string[]
          partner_search_level?: string[]
          partner_search_role?: string | null
          person_entity_id?: string | null
          person_id?: string | null
          phone?: string | null
          photo_url?: string | null
          profile_source?: string | null
          slug?: string
          surname?: string | null
          updated_at?: string
          website?: string | null
          website_url?: string | null
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
            foreignKeyName: "dancer_profiles_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
        ]
      }
      dancer_profiles_archive_20260720050000: {
        Row: {
          achievements: string[] | null
          archived_at: string | null
          avatar_url: string | null
          based_city_id: string | null
          claimed_by: string | null
          cover_url: string | null
          created_at: string | null
          created_by: string | null
          dance_role: string | null
          dance_started_year: number | null
          description: string | null
          display_name: string | null
          email: string | null
          facebook: string | null
          favorite_songs: string[] | null
          favorite_styles: string[] | null
          first_name: string | null
          gallery_urls: string[] | null
          id: string | null
          instagram: string | null
          instagram_normalized: string | null
          is_active: boolean | null
          languages: string[] | null
          looking_for_partner: boolean | null
          meta_data: Json | null
          nationality: string | null
          partner_details: string | null
          partner_practice_goals: string[] | null
          partner_search_level: string[] | null
          partner_search_role: string | null
          person_entity_id: string | null
          person_id: string | null
          phone: string | null
          photo_url: string | null
          profile_source: string | null
          slug: string | null
          surname: string | null
          updated_at: string | null
          website: string | null
          website_url: string | null
          whatsapp: string | null
        }
        Insert: {
          achievements?: string[] | null
          archived_at?: string | null
          avatar_url?: string | null
          based_city_id?: string | null
          claimed_by?: string | null
          cover_url?: string | null
          created_at?: string | null
          created_by?: string | null
          dance_role?: string | null
          dance_started_year?: number | null
          description?: string | null
          display_name?: string | null
          email?: string | null
          facebook?: string | null
          favorite_songs?: string[] | null
          favorite_styles?: string[] | null
          first_name?: string | null
          gallery_urls?: string[] | null
          id?: string | null
          instagram?: string | null
          instagram_normalized?: string | null
          is_active?: boolean | null
          languages?: string[] | null
          looking_for_partner?: boolean | null
          meta_data?: Json | null
          nationality?: string | null
          partner_details?: string | null
          partner_practice_goals?: string[] | null
          partner_search_level?: string[] | null
          partner_search_role?: string | null
          person_entity_id?: string | null
          person_id?: string | null
          phone?: string | null
          photo_url?: string | null
          profile_source?: string | null
          slug?: string | null
          surname?: string | null
          updated_at?: string | null
          website?: string | null
          website_url?: string | null
          whatsapp?: string | null
        }
        Update: {
          achievements?: string[] | null
          archived_at?: string | null
          avatar_url?: string | null
          based_city_id?: string | null
          claimed_by?: string | null
          cover_url?: string | null
          created_at?: string | null
          created_by?: string | null
          dance_role?: string | null
          dance_started_year?: number | null
          description?: string | null
          display_name?: string | null
          email?: string | null
          facebook?: string | null
          favorite_songs?: string[] | null
          favorite_styles?: string[] | null
          first_name?: string | null
          gallery_urls?: string[] | null
          id?: string | null
          instagram?: string | null
          instagram_normalized?: string | null
          is_active?: boolean | null
          languages?: string[] | null
          looking_for_partner?: boolean | null
          meta_data?: Json | null
          nationality?: string | null
          partner_details?: string | null
          partner_practice_goals?: string[] | null
          partner_search_level?: string[] | null
          partner_search_role?: string | null
          person_entity_id?: string | null
          person_id?: string | null
          phone?: string | null
          photo_url?: string | null
          profile_source?: string | null
          slug?: string | null
          surname?: string | null
          updated_at?: string | null
          website?: string | null
          website_url?: string | null
          whatsapp?: string | null
        }
        Relationships: []
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
      dancing_role_details: {
        Row: {
          achievements: string[] | null
          created_at: string | null
          dance_started_year: number | null
          favorite_songs: string[] | null
          favorite_styles: string[] | null
          id: string
          looking_for_partner: boolean | null
          partner_details: string | null
          partner_practice_goals: string[] | null
          partner_search_level: string[] | null
          partner_search_role: string | null
          person_id: string
          updated_at: string | null
        }
        Insert: {
          achievements?: string[] | null
          created_at?: string | null
          dance_started_year?: number | null
          favorite_songs?: string[] | null
          favorite_styles?: string[] | null
          id?: string
          looking_for_partner?: boolean | null
          partner_details?: string | null
          partner_practice_goals?: string[] | null
          partner_search_level?: string[] | null
          partner_search_role?: string | null
          person_id: string
          updated_at?: string | null
        }
        Update: {
          achievements?: string[] | null
          created_at?: string | null
          dance_started_year?: number | null
          favorite_songs?: string[] | null
          favorite_styles?: string[] | null
          id?: string
          looking_for_partner?: boolean | null
          partner_details?: string | null
          partner_practice_goals?: string[] | null
          partner_search_level?: string[] | null
          partner_search_role?: string | null
          person_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dancing_role_details_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: true
            referencedRelation: "dancer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dancing_role_details_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: true
            referencedRelation: "public_visible_dancers"
            referencedColumns: ["id"]
          },
        ]
      }
      dancing_role_details_archive_20260720050000: {
        Row: {
          achievements: string[] | null
          created_at: string | null
          dance_started_year: number | null
          favorite_songs: string[] | null
          favorite_styles: string[] | null
          id: string | null
          looking_for_partner: boolean | null
          partner_details: string | null
          partner_practice_goals: string[] | null
          partner_search_level: string[] | null
          partner_search_role: string | null
          person_id: string | null
          updated_at: string | null
        }
        Insert: {
          achievements?: string[] | null
          created_at?: string | null
          dance_started_year?: number | null
          favorite_songs?: string[] | null
          favorite_styles?: string[] | null
          id?: string | null
          looking_for_partner?: boolean | null
          partner_details?: string | null
          partner_practice_goals?: string[] | null
          partner_search_level?: string[] | null
          partner_search_role?: string | null
          person_id?: string | null
          updated_at?: string | null
        }
        Update: {
          achievements?: string[] | null
          created_at?: string | null
          dance_started_year?: number | null
          favorite_songs?: string[] | null
          favorite_styles?: string[] | null
          id?: string | null
          looking_for_partner?: boolean | null
          partner_details?: string | null
          partner_practice_goals?: string[] | null
          partner_search_level?: string[] | null
          partner_search_role?: string | null
          person_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ddl_audit_log: {
        Row: {
          actor_uid: string | null
          command_tag: string
          event_time: string
          id: string
          in_extension: boolean | null
          object_identity: string | null
          object_type: string | null
          schema_name: string | null
          session_user_name: string | null
        }
        Insert: {
          actor_uid?: string | null
          command_tag: string
          event_time?: string
          id?: string
          in_extension?: boolean | null
          object_identity?: string | null
          object_type?: string | null
          schema_name?: string | null
          session_user_name?: string | null
        }
        Update: {
          actor_uid?: string | null
          command_tag?: string
          event_time?: string
          id?: string
          in_extension?: boolean | null
          object_identity?: string | null
          object_type?: string | null
          schema_name?: string | null
          session_user_name?: string | null
        }
        Relationships: []
      }
      dj_role_details: {
        Row: {
          created_at: string | null
          dj_name: string | null
          faq: Json | null
          genres: string[] | null
          id: string
          legacy_dj_id: string | null
          mixcloud: string | null
          person_id: string
          pricing: string | null
          soundcloud: string | null
          upcoming_events: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          dj_name?: string | null
          faq?: Json | null
          genres?: string[] | null
          id?: string
          legacy_dj_id?: string | null
          mixcloud?: string | null
          person_id: string
          pricing?: string | null
          soundcloud?: string | null
          upcoming_events?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          dj_name?: string | null
          faq?: Json | null
          genres?: string[] | null
          id?: string
          legacy_dj_id?: string | null
          mixcloud?: string | null
          person_id?: string
          pricing?: string | null
          soundcloud?: string | null
          upcoming_events?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dj_role_details_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: true
            referencedRelation: "dancer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dj_role_details_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: true
            referencedRelation: "public_visible_dancers"
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
          {
            foreignKeyName: "fk_entities_city"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_decision_audit: {
        Row: {
          action: string
          actor_id: string
          after_state: Json | null
          before_state: Json | null
          created_at: string
          from_state: string | null
          id: string
          reason: string | null
          target_id: string
          target_type: string
          to_state: string | null
        }
        Insert: {
          action: string
          actor_id: string
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          from_state?: string | null
          id?: string
          reason?: string | null
          target_id: string
          target_type: string
          to_state?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          from_state?: string | null
          id?: string
          reason?: string | null
          target_id?: string
          target_type?: string
          to_state?: string | null
        }
        Relationships: []
      }
      entity_members: {
        Row: {
          created_by: string | null
          entity_id: string
          entity_type: string
          id: string
          is_primary: boolean
          joined_at: string
          member_role: string
          user_id: string
        }
        Insert: {
          created_by?: string | null
          entity_id: string
          entity_type: string
          id?: string
          is_primary?: boolean
          joined_at?: string
          member_role: string
          user_id: string
        }
        Update: {
          created_by?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          is_primary?: boolean
          joined_at?: string
          member_role?: string
          user_id?: string
        }
        Relationships: []
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
            referencedRelation: "dancer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendees_dancer_id_fkey"
            columns: ["dancer_id"]
            isOneToOne: false
            referencedRelation: "public_visible_dancers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
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
      event_audit_p5: {
        Row: {
          actor_id: string | null
          after_state: Json
          before_state: Json | null
          command_kind: string
          command_payload: Json
          error_code: string | null
          error_message: string | null
          id: string
          idempotency_key: string | null
          outcome: string
          target_id: string
          target_kind: string
          ts: string
        }
        Insert: {
          actor_id?: string | null
          after_state: Json
          before_state?: Json | null
          command_kind: string
          command_payload: Json
          error_code?: string | null
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          outcome: string
          target_id: string
          target_kind: string
          ts?: string
        }
        Update: {
          actor_id?: string | null
          after_state?: Json
          before_state?: Json | null
          command_kind?: string
          command_payload?: Json
          error_code?: string | null
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          outcome?: string
          target_id?: string
          target_kind?: string
          ts?: string
        }
        Relationships: []
      }
      event_drafts_archive_2026_05_05: {
        Row: {
          base_event_updated_at: string | null
          created_at: string | null
          discarded_at: string | null
          editor_user_id: string | null
          event_id: string | null
          id: string | null
          payload: Json | null
          published_at: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          base_event_updated_at?: string | null
          created_at?: string | null
          discarded_at?: string | null
          editor_user_id?: string | null
          event_id?: string | null
          id?: string | null
          payload?: Json | null
          published_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          base_event_updated_at?: string | null
          created_at?: string | null
          discarded_at?: string | null
          editor_user_id?: string | null
          event_id?: string | null
          id?: string | null
          payload?: Json | null
          published_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      event_entities: {
        Row: {
          created_at: string
          entity_id: string
          event_id: string
          organiser_profile_id: string | null
          role: Database["public"]["Enums"]["event_entity_role"]
        }
        Insert: {
          created_at?: string
          entity_id: string
          event_id: string
          organiser_profile_id?: string | null
          role: Database["public"]["Enums"]["event_entity_role"]
        }
        Update: {
          created_at?: string
          entity_id?: string
          event_id?: string
          organiser_profile_id?: string | null
          role?: Database["public"]["Enums"]["event_entity_role"]
        }
        Relationships: [
          {
            foreignKeyName: "event_entities_event_id_fk"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_entities_organiser_profile_id_fkey"
            columns: ["organiser_profile_id"]
            isOneToOne: false
            referencedRelation: "organiser_admin_dashboard_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_entities_organiser_profile_id_fkey"
            columns: ["organiser_profile_id"]
            isOneToOne: false
            referencedRelation: "organiser_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_guest_list_entries: {
        Row: {
          created_at: string
          deleted_at: string | null
          deleted_reason: string | null
          event_id: string
          first_name: string
          id: string
          is_permanent: boolean
          occurrence_id: string | null
          qr_token: string | null
          status: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          deleted_reason?: string | null
          event_id: string
          first_name: string
          id?: string
          is_permanent?: boolean
          occurrence_id?: string | null
          qr_token?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          deleted_reason?: string | null
          event_id?: string
          first_name?: string
          id?: string
          is_permanent?: boolean
          occurrence_id?: string | null
          qr_token?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_guest_list_entries_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_guest_list_entries_occurrence_id_fkey"
            columns: ["occurrence_id"]
            isOneToOne: false
            referencedRelation: "calendar_feed"
            referencedColumns: ["row_id"]
          },
          {
            foreignKeyName: "event_guest_list_entries_occurrence_id_fkey"
            columns: ["occurrence_id"]
            isOneToOne: false
            referencedRelation: "calendar_occurrences"
            referencedColumns: ["id"]
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
      event_link_clicks: {
        Row: {
          clicked_at: string
          event_id: string
          id: string
          link_type: string
          source: string | null
          target_url: string | null
          user_agent: string | null
          viewer_session_id: string | null
        }
        Insert: {
          clicked_at?: string
          event_id: string
          id?: string
          link_type: string
          source?: string | null
          target_url?: string | null
          user_agent?: string | null
          viewer_session_id?: string | null
        }
        Update: {
          clicked_at?: string
          event_id?: string
          id?: string
          link_type?: string
          source?: string | null
          target_url?: string | null
          user_agent?: string | null
          viewer_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_link_clicks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_occurrence_added_session_p5: {
        Row: {
          created_at: string
          end_time: string | null
          id: string
          legacy_added_session_id: string | null
          level_keys: string[] | null
          occurrence_id: string
          room: string | null
          section_kind: string | null
          sort_order: number
          start_time: string | null
          style: string | null
          theme: string | null
          title: string
          track_id: string | null
          type: string
          updated_at: string
          venue_room_id: string | null
        }
        Insert: {
          created_at?: string
          end_time?: string | null
          id?: string
          legacy_added_session_id?: string | null
          level_keys?: string[] | null
          occurrence_id: string
          room?: string | null
          section_kind?: string | null
          sort_order?: number
          start_time?: string | null
          style?: string | null
          theme?: string | null
          title: string
          track_id?: string | null
          type: string
          updated_at?: string
          venue_room_id?: string | null
        }
        Update: {
          created_at?: string
          end_time?: string | null
          id?: string
          legacy_added_session_id?: string | null
          level_keys?: string[] | null
          occurrence_id?: string
          room?: string | null
          section_kind?: string | null
          sort_order?: number
          start_time?: string | null
          style?: string | null
          theme?: string | null
          title?: string
          track_id?: string | null
          type?: string
          updated_at?: string
          venue_room_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_occurrence_added_session_p5_occurrence_id_fkey"
            columns: ["occurrence_id"]
            isOneToOne: false
            referencedRelation: "event_occurrence_p5"
            referencedColumns: ["id"]
          },
        ]
      }
      event_occurrence_added_session_people_p5: {
        Row: {
          added_session_id: string
          created_at: string
          id: string
          level: string | null
          profile_id: string
          profile_type: string
          role: string
          sort_order: number
        }
        Insert: {
          added_session_id: string
          created_at?: string
          id?: string
          level?: string | null
          profile_id: string
          profile_type: string
          role: string
          sort_order?: number
        }
        Update: {
          added_session_id?: string
          created_at?: string
          id?: string
          level?: string | null
          profile_id?: string
          profile_type?: string
          role?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_occurrence_added_session_people_p5_added_session_id_fkey"
            columns: ["added_session_id"]
            isOneToOne: false
            referencedRelation: "event_occurrence_added_session_p5"
            referencedColumns: ["id"]
          },
        ]
      }
      event_occurrence_override_p5: {
        Row: {
          cancellation_reason_label: string | null
          city_id: string | null
          cover_image_url: string | null
          created_at: string
          custom_local_end_time: string | null
          custom_local_start_time: string | null
          description: string | null
          featured: boolean | null
          gallery: string[] | null
          level: string | null
          music_styles: string[] | null
          occurrence_id: string
          organiser_ids: string[] | null
          passes: Json | null
          promo_codes: Json | null
          ticket_url: string | null
          title: string | null
          updated_at: string
          venue_id: string | null
        }
        Insert: {
          cancellation_reason_label?: string | null
          city_id?: string | null
          cover_image_url?: string | null
          created_at?: string
          custom_local_end_time?: string | null
          custom_local_start_time?: string | null
          description?: string | null
          featured?: boolean | null
          gallery?: string[] | null
          level?: string | null
          music_styles?: string[] | null
          occurrence_id: string
          organiser_ids?: string[] | null
          passes?: Json | null
          promo_codes?: Json | null
          ticket_url?: string | null
          title?: string | null
          updated_at?: string
          venue_id?: string | null
        }
        Update: {
          cancellation_reason_label?: string | null
          city_id?: string | null
          cover_image_url?: string | null
          created_at?: string
          custom_local_end_time?: string | null
          custom_local_start_time?: string | null
          description?: string | null
          featured?: boolean | null
          gallery?: string[] | null
          level?: string | null
          music_styles?: string[] | null
          occurrence_id?: string
          organiser_ids?: string[] | null
          passes?: Json | null
          promo_codes?: Json | null
          ticket_url?: string | null
          title?: string | null
          updated_at?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_occurrence_override_p5_occurrence_id_fkey"
            columns: ["occurrence_id"]
            isOneToOne: true
            referencedRelation: "event_occurrence_p5"
            referencedColumns: ["id"]
          },
        ]
      }
      event_occurrence_p5: {
        Row: {
          created_at: string
          id: string
          legacy_occurrence_id: string | null
          lifecycle_status: string
          materialised_end_utc: string | null
          materialised_start_utc: string | null
          occurrence_date: string
          occurrence_index: number | null
          series_id: string
          updated_at: string
          v3_occurrence_id: string | null
          version: number
        }
        Insert: {
          created_at?: string
          id?: string
          legacy_occurrence_id?: string | null
          lifecycle_status?: string
          materialised_end_utc?: string | null
          materialised_start_utc?: string | null
          occurrence_date: string
          occurrence_index?: number | null
          series_id: string
          updated_at?: string
          v3_occurrence_id?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          id?: string
          legacy_occurrence_id?: string | null
          lifecycle_status?: string
          materialised_end_utc?: string | null
          materialised_start_utc?: string | null
          occurrence_date?: string
          occurrence_index?: number | null
          series_id?: string
          updated_at?: string
          v3_occurrence_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_occurrence_p5_legacy_occurrence_id_fkey"
            columns: ["legacy_occurrence_id"]
            isOneToOne: false
            referencedRelation: "calendar_feed"
            referencedColumns: ["row_id"]
          },
          {
            foreignKeyName: "event_occurrence_p5_legacy_occurrence_id_fkey"
            columns: ["legacy_occurrence_id"]
            isOneToOne: false
            referencedRelation: "calendar_occurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_occurrence_p5_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "event_series_p5"
            referencedColumns: ["id"]
          },
        ]
      }
      event_occurrence_session_override_p5: {
        Row: {
          cancellation_reason_label: string | null
          cancelled: boolean | null
          created_at: string
          end_time: string | null
          level_keys: string[] | null
          occurrence_id: string
          people_added: Json | null
          people_modified: Json | null
          people_removed: string[] | null
          program_item_id: string
          room: string | null
          start_time: string | null
          style: string | null
          theme: string | null
          title: string | null
          track_id: string | null
          type: string | null
          updated_at: string
          venue_room_id: string | null
        }
        Insert: {
          cancellation_reason_label?: string | null
          cancelled?: boolean | null
          created_at?: string
          end_time?: string | null
          level_keys?: string[] | null
          occurrence_id: string
          people_added?: Json | null
          people_modified?: Json | null
          people_removed?: string[] | null
          program_item_id: string
          room?: string | null
          start_time?: string | null
          style?: string | null
          theme?: string | null
          title?: string | null
          track_id?: string | null
          type?: string | null
          updated_at?: string
          venue_room_id?: string | null
        }
        Update: {
          cancellation_reason_label?: string | null
          cancelled?: boolean | null
          created_at?: string
          end_time?: string | null
          level_keys?: string[] | null
          occurrence_id?: string
          people_added?: Json | null
          people_modified?: Json | null
          people_removed?: string[] | null
          program_item_id?: string
          room?: string | null
          start_time?: string | null
          style?: string | null
          theme?: string | null
          title?: string | null
          track_id?: string | null
          type?: string | null
          updated_at?: string
          venue_room_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_occurrence_session_override_p5_occurrence_id_fkey"
            columns: ["occurrence_id"]
            isOneToOne: false
            referencedRelation: "event_occurrence_p5"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_occurrence_session_override_p5_program_item_id_fkey"
            columns: ["program_item_id"]
            isOneToOne: false
            referencedRelation: "event_series_program_item_p5"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "events"
            referencedColumns: ["id"]
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
            referencedRelation: "events"
            referencedColumns: ["id"]
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
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_program_days: {
        Row: {
          created_at: string
          event_date: string
          event_id: string
          id: string
          label: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_date: string
          event_id: string
          id?: string
          label?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_date?: string
          event_id?: string
          id?: string
          label?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_program_days_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_program_items: {
        Row: {
          created_at: string | null
          day: string | null
          day_id: string
          description: string | null
          end_time: string | null
          event_id: string | null
          id: string
          lane_index: number
          legacy_id: string | null
          levels: string[]
          parallel_group_id: string | null
          pass_tier_required: string[]
          requires_pre_registration: boolean
          room: string | null
          section_id: string
          sort_order: number
          start_time: string | null
          style: string | null
          theme: string | null
          title: string
          track_id: string | null
          type: string
          updated_at: string
          venue_room_id: string | null
        }
        Insert: {
          created_at?: string | null
          day?: string | null
          day_id: string
          description?: string | null
          end_time?: string | null
          event_id?: string | null
          id?: string
          lane_index?: number
          legacy_id?: string | null
          levels?: string[]
          parallel_group_id?: string | null
          pass_tier_required?: string[]
          requires_pre_registration?: boolean
          room?: string | null
          section_id: string
          sort_order?: number
          start_time?: string | null
          style?: string | null
          theme?: string | null
          title: string
          track_id?: string | null
          type: string
          updated_at?: string
          venue_room_id?: string | null
        }
        Update: {
          created_at?: string | null
          day?: string | null
          day_id?: string
          description?: string | null
          end_time?: string | null
          event_id?: string | null
          id?: string
          lane_index?: number
          legacy_id?: string | null
          levels?: string[]
          parallel_group_id?: string | null
          pass_tier_required?: string[]
          requires_pre_registration?: boolean
          room?: string | null
          section_id?: string
          sort_order?: number
          start_time?: string | null
          style?: string | null
          theme?: string | null
          title?: string
          track_id?: string | null
          type?: string
          updated_at?: string
          venue_room_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_program_items_day_id_fkey"
            columns: ["day_id"]
            isOneToOne: false
            referencedRelation: "event_program_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_program_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_program_items_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "event_program_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_program_items_venue_room_id_fkey"
            columns: ["venue_room_id"]
            isOneToOne: false
            referencedRelation: "venue_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      event_program_people: {
        Row: {
          created_at: string
          created_by: string | null
          display_name_override: string | null
          event_id: string
          id: string
          level: string | null
          profile_id: string
          profile_type: string
          program_item_id: string
          role: string
          sort_order: number
          source: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          display_name_override?: string | null
          event_id: string
          id?: string
          level?: string | null
          profile_id: string
          profile_type: string
          program_item_id: string
          role: string
          sort_order?: number
          source?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          display_name_override?: string | null
          event_id?: string
          id?: string
          level?: string | null
          profile_id?: string
          profile_type?: string
          program_item_id?: string
          role?: string
          sort_order?: number
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_program_people_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_program_people_profile_id_dancer_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "dancer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_program_people_profile_id_dancer_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_visible_dancers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_program_people_program_item_id_fkey"
            columns: ["program_item_id"]
            isOneToOne: false
            referencedRelation: "event_program_items"
            referencedColumns: ["id"]
          },
        ]
      }
      event_program_section_rooms: {
        Row: {
          created_at: string
          id: string
          section_id: string
          sort_order: number
          venue_room_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          section_id: string
          sort_order?: number
          venue_room_id: string
        }
        Update: {
          created_at?: string
          id?: string
          section_id?: string
          sort_order?: number
          venue_room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_program_section_rooms_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "event_program_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_program_section_rooms_venue_room_id_fkey"
            columns: ["venue_room_id"]
            isOneToOne: false
            referencedRelation: "venue_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      event_program_sections: {
        Row: {
          created_at: string
          day_id: string
          id: string
          kind: Database["public"]["Enums"]["event_program_section_kind"]
          label_override: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_id: string
          id?: string
          kind: Database["public"]["Enums"]["event_program_section_kind"]
          label_override?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["event_program_section_kind"]
          label_override?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_program_sections_day_id_fkey"
            columns: ["day_id"]
            isOneToOne: false
            referencedRelation: "event_program_days"
            referencedColumns: ["id"]
          },
        ]
      }
      event_program_trigger_audit: {
        Row: {
          action: string
          created_at: string
          day_id: string | null
          event_date: string | null
          event_id: string
          id: string
          item_legacy_id: string | null
          section_id: string | null
          section_kind:
            | Database["public"]["Enums"]["event_program_section_kind"]
            | null
        }
        Insert: {
          action: string
          created_at?: string
          day_id?: string | null
          event_date?: string | null
          event_id: string
          id?: string
          item_legacy_id?: string | null
          section_id?: string | null
          section_kind?:
            | Database["public"]["Enums"]["event_program_section_kind"]
            | null
        }
        Update: {
          action?: string
          created_at?: string
          day_id?: string | null
          event_date?: string | null
          event_id?: string
          id?: string
          item_legacy_id?: string | null
          section_id?: string | null
          section_kind?:
            | Database["public"]["Enums"]["event_program_section_kind"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "event_program_trigger_audit_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_promotions: {
        Row: {
          channel: string | null
          event_id: string
          id: string
          note: string | null
          promoted_at: string
          promoted_by: string | null
        }
        Insert: {
          channel?: string | null
          event_id: string
          id?: string
          note?: string | null
          promoted_at?: string
          promoted_by?: string | null
        }
        Update: {
          channel?: string | null
          event_id?: string
          id?: string
          note?: string | null
          promoted_at?: string
          promoted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_promotions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_raffle_draws: {
        Row: {
          claimed_at: string | null
          created_at: string
          drawn_at: string | null
          drawn_by: string | null
          entries_snapshot: Json | null
          event_id: string
          id: string
          is_active: boolean
          pick_method: string
          prior_draw_id: string | null
          reason: string | null
          winner_entry_id: string | null
        }
        Insert: {
          claimed_at?: string | null
          created_at?: string
          drawn_at?: string | null
          drawn_by?: string | null
          entries_snapshot?: Json | null
          event_id: string
          id?: string
          is_active?: boolean
          pick_method?: string
          prior_draw_id?: string | null
          reason?: string | null
          winner_entry_id?: string | null
        }
        Update: {
          claimed_at?: string | null
          created_at?: string
          drawn_at?: string | null
          drawn_by?: string | null
          entries_snapshot?: Json | null
          event_id?: string
          id?: string
          is_active?: boolean
          pick_method?: string
          prior_draw_id?: string | null
          reason?: string | null
          winner_entry_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_raffle_draws_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_raffle_draws_prior_draw_id_fkey"
            columns: ["prior_draw_id"]
            isOneToOne: false
            referencedRelation: "event_raffle_draws"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_raffle_draws_winner_entry_id_fkey"
            columns: ["winner_entry_id"]
            isOneToOne: false
            referencedRelation: "event_raffle_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      event_raffle_entries: {
        Row: {
          admin_note: string | null
          consent_at: string | null
          consent_version: string | null
          created_at: string
          deleted_at: string | null
          deleted_reason: string | null
          eligibility_override: boolean
          eligibility_override_at: string | null
          eligibility_override_by: string | null
          eligibility_override_reason: string | null
          event_id: string
          first_name: string | null
          id: string
          ineligible_at: string | null
          ineligible_by: string | null
          ineligible_notes: string | null
          ineligible_reason: string | null
          phone_e164: string | null
          qr_token: string | null
          session_id: string | null
          status: string
          wa_message_id: string | null
          wa_send_attempted_at: string | null
          wa_verified_at: string | null
          wa_verify_error: string | null
          wa_verify_status: string
        }
        Insert: {
          admin_note?: string | null
          consent_at?: string | null
          consent_version?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_reason?: string | null
          eligibility_override?: boolean
          eligibility_override_at?: string | null
          eligibility_override_by?: string | null
          eligibility_override_reason?: string | null
          event_id: string
          first_name?: string | null
          id?: string
          ineligible_at?: string | null
          ineligible_by?: string | null
          ineligible_notes?: string | null
          ineligible_reason?: string | null
          phone_e164?: string | null
          qr_token?: string | null
          session_id?: string | null
          status?: string
          wa_message_id?: string | null
          wa_send_attempted_at?: string | null
          wa_verified_at?: string | null
          wa_verify_error?: string | null
          wa_verify_status?: string
        }
        Update: {
          admin_note?: string | null
          consent_at?: string | null
          consent_version?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_reason?: string | null
          eligibility_override?: boolean
          eligibility_override_at?: string | null
          eligibility_override_by?: string | null
          eligibility_override_reason?: string | null
          event_id?: string
          first_name?: string | null
          id?: string
          ineligible_at?: string | null
          ineligible_by?: string | null
          ineligible_notes?: string | null
          ineligible_reason?: string | null
          phone_e164?: string | null
          qr_token?: string | null
          session_id?: string | null
          status?: string
          wa_message_id?: string | null
          wa_send_attempted_at?: string | null
          wa_verified_at?: string | null
          wa_verify_error?: string | null
          wa_verify_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_raffle_entries_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_raffle_winner_contacts: {
        Row: {
          channel: string
          contacted_at: string
          contacted_by: string | null
          draw_id: string
          entry_id: string
          id: string
          note: string | null
          outcome: string
        }
        Insert: {
          channel?: string
          contacted_at?: string
          contacted_by?: string | null
          draw_id: string
          entry_id: string
          id?: string
          note?: string | null
          outcome: string
        }
        Update: {
          channel?: string
          contacted_at?: string
          contacted_by?: string | null
          draw_id?: string
          entry_id?: string
          id?: string
          note?: string | null
          outcome?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_raffle_winner_contacts_draw_id_fkey"
            columns: ["draw_id"]
            isOneToOne: false
            referencedRelation: "event_raffle_draws"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_raffle_winner_contacts_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "event_raffle_entries"
            referencedColumns: ["id"]
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
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_rooms: {
        Row: {
          created_at: string
          created_by: string | null
          event_id: string
          id: string
          sort_order: number
          venue_room_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_id: string
          id?: string
          sort_order?: number
          venue_room_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_id?: string
          id?: string
          sort_order?: number
          venue_room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_rooms_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_rooms_venue_room_id_fkey"
            columns: ["venue_room_id"]
            isOneToOne: false
            referencedRelation: "venue_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      event_save_audit: {
        Row: {
          before_payload: Json | null
          diff_summary: Json
          error_code: string | null
          event_id: string
          id: string
          idempotency_token: string
          outcome: string
          payload_version: number
          program_diff: Json | null
          response_payload: Json | null
          saved_at: string
          saved_by: string | null
        }
        Insert: {
          before_payload?: Json | null
          diff_summary?: Json
          error_code?: string | null
          event_id: string
          id?: string
          idempotency_token: string
          outcome: string
          payload_version: number
          program_diff?: Json | null
          response_payload?: Json | null
          saved_at?: string
          saved_by?: string | null
        }
        Update: {
          before_payload?: Json | null
          diff_summary?: Json
          error_code?: string | null
          event_id?: string
          id?: string
          idempotency_token?: string
          outcome?: string
          payload_version?: number
          program_diff?: Json | null
          response_payload?: Json | null
          saved_at?: string
          saved_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_save_audit_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_series_organiser_p5: {
        Row: {
          created_at: string
          created_by: string | null
          is_primary: boolean
          ord: number
          organiser_id: string
          series_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          is_primary?: boolean
          ord?: number
          organiser_id: string
          series_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          is_primary?: boolean
          ord?: number
          organiser_id?: string
          series_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_series_organiser_p5_organiser_id_fkey"
            columns: ["organiser_id"]
            isOneToOne: false
            referencedRelation: "organiser_admin_dashboard_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_series_organiser_p5_organiser_id_fkey"
            columns: ["organiser_id"]
            isOneToOne: false
            referencedRelation: "organiser_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_series_organiser_p5_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "event_series_p5"
            referencedColumns: ["id"]
          },
        ]
      }
      event_series_p5: {
        Row: {
          category: string | null
          course_total_sessions: number | null
          created_at: string
          created_by: string | null
          default_city_id: string | null
          default_cover_image_url: string | null
          default_description: string | null
          default_duration: string | null
          default_level: string | null
          default_local_start_time: string | null
          default_music_styles: string[] | null
          default_start_date: string | null
          default_ticket_url: string | null
          default_venue_id: string | null
          facebook_url: string | null
          featured: boolean | null
          festival_id: string | null
          format: string | null
          gallery: string[] | null
          group_chat_url: string | null
          id: string
          instagram_url: string | null
          is_template: boolean
          legacy_event_id: string | null
          lifecycle_status: string
          livestream_url: string | null
          name: string
          organiser_card_slot_1: string | null
          organiser_card_slot_2: string | null
          organiser_ids: string[] | null
          passes: Json | null
          promo_codes: Json | null
          recurrence_rule: Json | null
          removed_dates: string[]
          slug: string | null
          tiktok_url: string | null
          timezone: string | null
          type: string | null
          updated_at: string
          v3_series_id: string | null
          version: number
          video_urls: string[] | null
          website: string | null
        }
        Insert: {
          category?: string | null
          course_total_sessions?: number | null
          created_at?: string
          created_by?: string | null
          default_city_id?: string | null
          default_cover_image_url?: string | null
          default_description?: string | null
          default_duration?: string | null
          default_level?: string | null
          default_local_start_time?: string | null
          default_music_styles?: string[] | null
          default_start_date?: string | null
          default_ticket_url?: string | null
          default_venue_id?: string | null
          facebook_url?: string | null
          featured?: boolean | null
          festival_id?: string | null
          format?: string | null
          gallery?: string[] | null
          group_chat_url?: string | null
          id?: string
          instagram_url?: string | null
          is_template?: boolean
          legacy_event_id?: string | null
          lifecycle_status?: string
          livestream_url?: string | null
          name: string
          organiser_card_slot_1?: string | null
          organiser_card_slot_2?: string | null
          organiser_ids?: string[] | null
          passes?: Json | null
          promo_codes?: Json | null
          recurrence_rule?: Json | null
          removed_dates?: string[]
          slug?: string | null
          tiktok_url?: string | null
          timezone?: string | null
          type?: string | null
          updated_at?: string
          v3_series_id?: string | null
          version?: number
          video_urls?: string[] | null
          website?: string | null
        }
        Update: {
          category?: string | null
          course_total_sessions?: number | null
          created_at?: string
          created_by?: string | null
          default_city_id?: string | null
          default_cover_image_url?: string | null
          default_description?: string | null
          default_duration?: string | null
          default_level?: string | null
          default_local_start_time?: string | null
          default_music_styles?: string[] | null
          default_start_date?: string | null
          default_ticket_url?: string | null
          default_venue_id?: string | null
          facebook_url?: string | null
          featured?: boolean | null
          festival_id?: string | null
          format?: string | null
          gallery?: string[] | null
          group_chat_url?: string | null
          id?: string
          instagram_url?: string | null
          is_template?: boolean
          legacy_event_id?: string | null
          lifecycle_status?: string
          livestream_url?: string | null
          name?: string
          organiser_card_slot_1?: string | null
          organiser_card_slot_2?: string | null
          organiser_ids?: string[] | null
          passes?: Json | null
          promo_codes?: Json | null
          recurrence_rule?: Json | null
          removed_dates?: string[]
          slug?: string | null
          tiktok_url?: string | null
          timezone?: string | null
          type?: string | null
          updated_at?: string
          v3_series_id?: string | null
          version?: number
          video_urls?: string[] | null
          website?: string | null
        }
        Relationships: []
      }
      event_series_program_day_p5: {
        Row: {
          created_at: string
          date_offset_days: number
          day_index: number
          id: string
          label: string | null
          series_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_offset_days?: number
          day_index: number
          id?: string
          label?: string | null
          series_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_offset_days?: number
          day_index?: number
          id?: string
          label?: string | null
          series_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_series_program_day_p5_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "event_series_p5"
            referencedColumns: ["id"]
          },
        ]
      }
      event_series_program_item_p5: {
        Row: {
          created_at: string
          end_time: string | null
          id: string
          legacy_program_item_id: string | null
          level_keys: string[] | null
          parallel_group_id: string | null
          room: string | null
          section_id: string
          series_id: string
          sort_order: number
          start_time: string | null
          style: string | null
          theme: string | null
          title: string
          track_id: string | null
          type: string
          updated_at: string
          venue_room_id: string | null
        }
        Insert: {
          created_at?: string
          end_time?: string | null
          id?: string
          legacy_program_item_id?: string | null
          level_keys?: string[] | null
          parallel_group_id?: string | null
          room?: string | null
          section_id: string
          series_id: string
          sort_order?: number
          start_time?: string | null
          style?: string | null
          theme?: string | null
          title: string
          track_id?: string | null
          type: string
          updated_at?: string
          venue_room_id?: string | null
        }
        Update: {
          created_at?: string
          end_time?: string | null
          id?: string
          legacy_program_item_id?: string | null
          level_keys?: string[] | null
          parallel_group_id?: string | null
          room?: string | null
          section_id?: string
          series_id?: string
          sort_order?: number
          start_time?: string | null
          style?: string | null
          theme?: string | null
          title?: string
          track_id?: string | null
          type?: string
          updated_at?: string
          venue_room_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_series_program_item_p5_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "event_series_program_section_p5"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_series_program_item_p5_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "event_series_p5"
            referencedColumns: ["id"]
          },
        ]
      }
      event_series_program_people_p5: {
        Row: {
          created_at: string
          id: string
          item_id: string
          level: string | null
          profile_id: string
          profile_type: string
          role: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          level?: string | null
          profile_id: string
          profile_type: string
          role: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          level?: string | null
          profile_id?: string
          profile_type?: string
          role?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_series_program_people_p5_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "event_series_program_item_p5"
            referencedColumns: ["id"]
          },
        ]
      }
      event_series_program_section_p5: {
        Row: {
          created_at: string
          day_id: string
          id: string
          kind: string
          label_override: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_id: string
          id?: string
          kind: string
          label_override?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_id?: string
          id?: string
          kind?: string
          label_override?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_series_program_section_p5_day_id_fkey"
            columns: ["day_id"]
            isOneToOne: false
            referencedRelation: "event_series_program_day_p5"
            referencedColumns: ["id"]
          },
        ]
      }
      event_time_derive_audit: {
        Row: {
          actor_uid: string | null
          client_end: string | null
          client_start: string | null
          derived_end: string
          derived_start: string
          event_id: string
          id: string
          notes: string | null
          occurred_at: string
          program_day_offset: number | null
          program_max_hhmm: string | null
          program_min_hhmm: string | null
          reason: string
        }
        Insert: {
          actor_uid?: string | null
          client_end?: string | null
          client_start?: string | null
          derived_end: string
          derived_start: string
          event_id: string
          id?: string
          notes?: string | null
          occurred_at?: string
          program_day_offset?: number | null
          program_max_hhmm?: string | null
          program_min_hhmm?: string | null
          reason: string
        }
        Update: {
          actor_uid?: string | null
          client_end?: string | null
          client_start?: string | null
          derived_end?: string
          derived_start?: string
          event_id?: string
          id?: string
          notes?: string | null
          occurred_at?: string
          program_day_offset?: number | null
          program_max_hhmm?: string | null
          program_min_hhmm?: string | null
          reason?: string
        }
        Relationships: []
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
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_vendor_booths: {
        Row: {
          booth_location: string | null
          booth_number: string | null
          created_at: string
          event_id: string
          exhibit_hours: Json | null
          id: string
          notes: string | null
          updated_at: string
          vendor_id: string
        }
        Insert: {
          booth_location?: string | null
          booth_number?: string | null
          created_at?: string
          event_id: string
          exhibit_hours?: Json | null
          id?: string
          notes?: string | null
          updated_at?: string
          vendor_id: string
        }
        Update: {
          booth_location?: string | null
          booth_number?: string | null
          created_at?: string
          event_id?: string
          exhibit_hours?: Json | null
          id?: string
          notes?: string | null
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_vendor_booths_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_vendor_booths_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      event_views: {
        Row: {
          event_id: string
          id: string
          occurrence_id: string | null
          source: string | null
          user_agent: string | null
          viewed_at: string
          viewer_session_id: string | null
        }
        Insert: {
          event_id: string
          id?: string
          occurrence_id?: string | null
          source?: string | null
          user_agent?: string | null
          viewed_at?: string
          viewer_session_id?: string | null
        }
        Update: {
          event_id?: string
          id?: string
          occurrence_id?: string | null
          source?: string | null
          user_agent?: string | null
          viewed_at?: string
          viewer_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_views_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          archived_at: string | null
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
          guest_list_capacity_max: number | null
          guestlist_config: string | null
          has_guestlist: boolean | null
          has_raffle: boolean
          id: string
          instagram_url: string | null
          is_active: boolean | null
          level: string | null
          lifecycle_status: string
          location: string | null
          meta_data: Json | null
          name: string | null
          organiser_card_slot_1: string | null
          organiser_card_slot_2: string | null
          parent_event_id: string | null
          payment_methods: string | null
          photographer_ids: string[] | null
          poster_url: string | null
          pricing: Json | null
          promo_codes: string | null
          raffle_capacity_max: number | null
          raffle_preset_id: string | null
          recurrence: Json | null
          schedule_type: string | null
          series_key: string | null
          show_cancelled_publicly: boolean
          slug: string | null
          source_occurrence_id: string | null
          start_time: string | null
          ticket_url: string | null
          tickets: string | null
          timezone: string | null
          type: string | null
          updated_at: string
          user_id: string | null
          venue_id: string | null
          waitlist_enabled: boolean
          website: string | null
        }
        Insert: {
          archived_at?: string | null
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
          guest_list_capacity_max?: number | null
          guestlist_config?: string | null
          has_guestlist?: boolean | null
          has_raffle?: boolean
          id?: string
          instagram_url?: string | null
          is_active?: boolean | null
          level?: string | null
          lifecycle_status?: string
          location?: string | null
          meta_data?: Json | null
          name?: string | null
          organiser_card_slot_1?: string | null
          organiser_card_slot_2?: string | null
          parent_event_id?: string | null
          payment_methods?: string | null
          photographer_ids?: string[] | null
          poster_url?: string | null
          pricing?: Json | null
          promo_codes?: string | null
          raffle_capacity_max?: number | null
          raffle_preset_id?: string | null
          recurrence?: Json | null
          schedule_type?: string | null
          series_key?: string | null
          show_cancelled_publicly?: boolean
          slug?: string | null
          source_occurrence_id?: string | null
          start_time?: string | null
          ticket_url?: string | null
          tickets?: string | null
          timezone?: string | null
          type?: string | null
          updated_at?: string
          user_id?: string | null
          venue_id?: string | null
          waitlist_enabled?: boolean
          website?: string | null
        }
        Update: {
          archived_at?: string | null
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
          guest_list_capacity_max?: number | null
          guestlist_config?: string | null
          has_guestlist?: boolean | null
          has_raffle?: boolean
          id?: string
          instagram_url?: string | null
          is_active?: boolean | null
          level?: string | null
          lifecycle_status?: string
          location?: string | null
          meta_data?: Json | null
          name?: string | null
          organiser_card_slot_1?: string | null
          organiser_card_slot_2?: string | null
          parent_event_id?: string | null
          payment_methods?: string | null
          photographer_ids?: string[] | null
          poster_url?: string | null
          pricing?: Json | null
          promo_codes?: string | null
          raffle_capacity_max?: number | null
          raffle_preset_id?: string | null
          recurrence?: Json | null
          schedule_type?: string | null
          series_key?: string | null
          show_cancelled_publicly?: boolean
          slug?: string | null
          source_occurrence_id?: string | null
          start_time?: string | null
          ticket_url?: string | null
          tickets?: string | null
          timezone?: string | null
          type?: string | null
          updated_at?: string
          user_id?: string | null
          venue_id?: string | null
          waitlist_enabled?: boolean
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
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_raffle_preset_id_fkey"
            columns: ["raffle_preset_id"]
            isOneToOne: false
            referencedRelation: "raffle_presets"
            referencedColumns: ["id"]
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
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      facility_options: {
        Row: {
          aliases: string[]
          created_at: string
          dancer_facing: boolean
          display_order: number
          emoji: string | null
          key: string
          label: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          aliases?: string[]
          created_at?: string
          dancer_facing?: boolean
          display_order?: number
          emoji?: string | null
          key: string
          label: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          aliases?: string[]
          created_at?: string
          dancer_facing?: boolean
          display_order?: number
          emoji?: string | null
          key?: string
          label?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
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
      filming_role_details: {
        Row: {
          business_name: string | null
          created_at: string | null
          equipment: string | null
          gallery_urls: string[] | null
          id: string
          languages: string[] | null
          legacy_videographer_id: string | null
          person_id: string
          rates_text: string | null
          reel_url: string | null
          updated_at: string | null
          videography_styles: string[] | null
        }
        Insert: {
          business_name?: string | null
          created_at?: string | null
          equipment?: string | null
          gallery_urls?: string[] | null
          id?: string
          languages?: string[] | null
          legacy_videographer_id?: string | null
          person_id: string
          rates_text?: string | null
          reel_url?: string | null
          updated_at?: string | null
          videography_styles?: string[] | null
        }
        Update: {
          business_name?: string | null
          created_at?: string | null
          equipment?: string | null
          gallery_urls?: string[] | null
          id?: string
          languages?: string[] | null
          legacy_videographer_id?: string | null
          person_id?: string
          rates_text?: string | null
          reel_url?: string | null
          updated_at?: string | null
          videography_styles?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "filming_role_details_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: true
            referencedRelation: "dancer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "filming_role_details_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: true
            referencedRelation: "public_visible_dancers"
            referencedColumns: ["id"]
          },
        ]
      }
      floor_type_options: {
        Row: {
          aliases: string[]
          created_at: string
          display_order: number
          key: string
          label: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          aliases?: string[]
          created_at?: string
          display_order?: number
          key: string
          label: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          aliases?: string[]
          created_at?: string
          display_order?: number
          key?: string
          label?: string
          updated_at?: string
          updated_by?: string | null
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
          person_entity_id: string | null
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
          person_entity_id?: string | null
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
          person_entity_id?: string | null
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
          {
            foreignKeyName: "guest_dancer_profiles_person_entity_id_fkey"
            columns: ["person_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_entry_erasure_tokens: {
        Row: {
          consumed_at: string | null
          entry_id: string
          entry_table: string
          event_id: string
          issued_at: string
          issued_by: string | null
          token: string
        }
        Insert: {
          consumed_at?: string | null
          entry_id: string
          entry_table: string
          event_id: string
          issued_at?: string
          issued_by?: string | null
          token?: string
        }
        Update: {
          consumed_at?: string | null
          entry_id?: string
          entry_table?: string
          event_id?: string
          issued_at?: string
          issued_by?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_entry_erasure_tokens_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_entry_phone_view_audit_v1: {
        Row: {
          client_ip: unknown
          entry_id: string
          event_id: string
          id: string
          viewed_at: string
          viewed_by: string
        }
        Insert: {
          client_ip?: unknown
          entry_id: string
          event_id: string
          id?: string
          viewed_at?: string
          viewed_by: string
        }
        Update: {
          client_ip?: unknown
          entry_id?: string
          event_id?: string
          id?: string
          viewed_at?: string
          viewed_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_entry_phone_view_audit_v1_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_list_standing_exclusions: {
        Row: {
          event_id: string
          excluded_at: string
          excluded_by: string | null
        }
        Insert: {
          event_id: string
          excluded_at?: string
          excluded_by?: string | null
        }
        Update: {
          event_id?: string
          excluded_at?: string
          excluded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guest_list_standing_exclusions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_list_standing_names: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: number
          name: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: number
          name: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: number
          name?: string
        }
        Relationships: []
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
      hosting_role_details: {
        Row: {
          created_at: string | null
          hosting_styles: string[] | null
          id: string
          notes: string | null
          person_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          hosting_styles?: string[] | null
          id?: string
          notes?: string | null
          person_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          hosting_styles?: string[] | null
          id?: string
          notes?: string | null
          person_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hosting_role_details_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: true
            referencedRelation: "dancer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hosting_role_details_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: true
            referencedRelation: "public_visible_dancers"
            referencedColumns: ["id"]
          },
        ]
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
      listing_request_email_log: {
        Row: {
          created_at: string
          error: string | null
          id: string
          provider_response: Json | null
          request_id: string | null
          status: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          provider_response?: Json | null
          request_id?: string | null
          status: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          provider_response?: Json | null
          request_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_request_email_log_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "listing_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_request_status_history: {
        Row: {
          changed_at: string
          from_status:
            | Database["public"]["Enums"]["listing_request_status"]
            | null
          id: string
          notes: string | null
          request_id: string
          to_status: Database["public"]["Enums"]["listing_request_status"]
          triggered_by: string
        }
        Insert: {
          changed_at?: string
          from_status?:
            | Database["public"]["Enums"]["listing_request_status"]
            | null
          id?: string
          notes?: string | null
          request_id: string
          to_status: Database["public"]["Enums"]["listing_request_status"]
          triggered_by?: string
        }
        Update: {
          changed_at?: string
          from_status?:
            | Database["public"]["Enums"]["listing_request_status"]
            | null
          id?: string
          notes?: string | null
          request_id?: string
          to_status?: Database["public"]["Enums"]["listing_request_status"]
          triggered_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_request_status_history_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "listing_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_request_throttle: {
        Row: {
          count: number
          ip: unknown
          window_start: string
        }
        Insert: {
          count?: number
          ip: unknown
          window_start?: string
        }
        Update: {
          count?: number
          ip?: unknown
          window_start?: string
        }
        Relationships: []
      }
      listing_requests: {
        Row: {
          created_at: string
          duplicate_of_request_id: string | null
          event_link: string
          id: string
          name: string
          phone: string
          published_at: string | null
          published_event_id: string | null
          section: Database["public"]["Enums"]["listing_request_section"]
          source_url: string | null
          status: Database["public"]["Enums"]["listing_request_status"]
          status_changed_at: string | null
          status_notes: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          duplicate_of_request_id?: string | null
          event_link: string
          id?: string
          name: string
          phone: string
          published_at?: string | null
          published_event_id?: string | null
          section: Database["public"]["Enums"]["listing_request_section"]
          source_url?: string | null
          status?: Database["public"]["Enums"]["listing_request_status"]
          status_changed_at?: string | null
          status_notes?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          duplicate_of_request_id?: string | null
          event_link?: string
          id?: string
          name?: string
          phone?: string
          published_at?: string | null
          published_event_id?: string | null
          section?: Database["public"]["Enums"]["listing_request_section"]
          source_url?: string | null
          status?: Database["public"]["Enums"]["listing_request_status"]
          status_changed_at?: string | null
          status_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_requests_duplicate_of_request_id_fkey"
            columns: ["duplicate_of_request_id"]
            isOneToOne: false
            referencedRelation: "listing_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_requests_published_event_id_fkey"
            columns: ["published_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      m3_dancer_survivor_sidecar_violation_log: {
        Row: {
          archived: boolean | null
          auth_uid: string | null
          caller_is_admin: boolean | null
          dancer_profile_id: string
          dancer_slug: string | null
          db_user: string
          diverged_columns: string[]
          fired_on_table: string
          id: number
          jwt_role: string | null
          legacy_values: Json | null
          observed_at: string
          request_method: string | null
          request_path: string | null
          sidecar_values: Json | null
          trigger_op: string
          txid: number
          violation_kind: string
        }
        Insert: {
          archived?: boolean | null
          auth_uid?: string | null
          caller_is_admin?: boolean | null
          dancer_profile_id: string
          dancer_slug?: string | null
          db_user?: string
          diverged_columns?: string[]
          fired_on_table: string
          id?: never
          jwt_role?: string | null
          legacy_values?: Json | null
          observed_at?: string
          request_method?: string | null
          request_path?: string | null
          sidecar_values?: Json | null
          trigger_op: string
          txid?: number
          violation_kind: string
        }
        Update: {
          archived?: boolean | null
          auth_uid?: string | null
          caller_is_admin?: boolean | null
          dancer_profile_id?: string
          dancer_slug?: string | null
          db_user?: string
          diverged_columns?: string[]
          fired_on_table?: string
          id?: never
          jwt_role?: string | null
          legacy_values?: Json | null
          observed_at?: string
          request_method?: string | null
          request_path?: string | null
          sidecar_values?: Json | null
          trigger_op?: string
          txid?: number
          violation_kind?: string
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
      occurrence_action_audit: {
        Row: {
          action: string
          actor_kind: string
          actor_uid: string | null
          after_state: Json | null
          before_state: Json | null
          correlation_id: string | null
          event_id: string | null
          id: number
          idempotency_key: string | null
          is_undoable: boolean
          logged_at: string
          occurrence_id: string | null
          reason: string | null
          undo_payload: Json | null
          undone_at: string | null
          undone_by: string | null
        }
        Insert: {
          action: string
          actor_kind?: string
          actor_uid?: string | null
          after_state?: Json | null
          before_state?: Json | null
          correlation_id?: string | null
          event_id?: string | null
          id?: number
          idempotency_key?: string | null
          is_undoable?: boolean
          logged_at?: string
          occurrence_id?: string | null
          reason?: string | null
          undo_payload?: Json | null
          undone_at?: string | null
          undone_by?: string | null
        }
        Update: {
          action?: string
          actor_kind?: string
          actor_uid?: string | null
          after_state?: Json | null
          before_state?: Json | null
          correlation_id?: string | null
          event_id?: string | null
          id?: number
          idempotency_key?: string | null
          is_undoable?: boolean
          logged_at?: string
          occurrence_id?: string | null
          reason?: string | null
          undo_payload?: Json | null
          undone_at?: string | null
          undone_by?: string | null
        }
        Relationships: []
      }
      occurrence_idempotency_keys: {
        Row: {
          actor_uid: string
          claimed_at: string
          completed_at: string | null
          key: string
        }
        Insert: {
          actor_uid: string
          claimed_at?: string
          completed_at?: string | null
          key: string
        }
        Update: {
          actor_uid?: string
          claimed_at?: string
          completed_at?: string | null
          key?: string
        }
        Relationships: []
      }
      occurrence_venue_drift_repair_audit_v1: {
        Row: {
          after_jsonb: Json
          before_jsonb: Json
          drift_kind: string
          id: number
          reason: string | null
          repaired_at: string
          repaired_by: string | null
          row_pk: string
          table_name: string
        }
        Insert: {
          after_jsonb: Json
          before_jsonb: Json
          drift_kind: string
          id?: number
          reason?: string | null
          repaired_at?: string
          repaired_by?: string | null
          row_pk: string
          table_name: string
        }
        Update: {
          after_jsonb?: Json
          before_jsonb?: Json
          drift_kind?: string
          id?: number
          reason?: string | null
          repaired_at?: string
          repaired_by?: string | null
          row_pk?: string
          table_name?: string
        }
        Relationships: []
      }
      occurrence_write_audit: {
        Row: {
          actor_uid: string | null
          duration_ms: number | null
          error_code: string | null
          error_message: string | null
          event_id: string | null
          function_name: string
          id: number
          ids_matched_count: number | null
          jwt_role: string | null
          logged_at: string
          occurrence_count: number | null
          replace_mode: boolean | null
          success: boolean
        }
        Insert: {
          actor_uid?: string | null
          duration_ms?: number | null
          error_code?: string | null
          error_message?: string | null
          event_id?: string | null
          function_name: string
          id?: never
          ids_matched_count?: number | null
          jwt_role?: string | null
          logged_at?: string
          occurrence_count?: number | null
          replace_mode?: boolean | null
          success: boolean
        }
        Update: {
          actor_uid?: string | null
          duration_ms?: number | null
          error_code?: string | null
          error_message?: string | null
          event_id?: string | null
          function_name?: string
          id?: never
          ids_matched_count?: number | null
          jwt_role?: string | null
          logged_at?: string
          occurrence_count?: number | null
          replace_mode?: boolean | null
          success?: boolean
        }
        Relationships: []
      }
      og_render: {
        Row: {
          attempts: number
          cover_hash: string | null
          cover_source_url: string | null
          created_at: string
          entity_id: string
          entity_type: string
          error: string | null
          image_url: string | null
          occurrence_id: string | null
          scrape_attempted_at: string | null
          scrape_request_id: number | null
          scraped_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          cover_hash?: string | null
          cover_source_url?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          error?: string | null
          image_url?: string | null
          occurrence_id?: string | null
          scrape_attempted_at?: string | null
          scrape_request_id?: number | null
          scraped_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          cover_hash?: string | null
          cover_source_url?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          error?: string | null
          image_url?: string | null
          occurrence_id?: string | null
          scrape_attempted_at?: string | null
          scrape_request_id?: number | null
          scraped_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "og_render_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "events"
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
      organiser_card_clicks: {
        Row: {
          clicked_at: string
          event_id: string
          id: string
          organiser_id: string
          source: string | null
          user_agent: string | null
          viewer_session_id: string | null
          zone: string
        }
        Insert: {
          clicked_at?: string
          event_id: string
          id?: string
          organiser_id: string
          source?: string | null
          user_agent?: string | null
          viewer_session_id?: string | null
          zone: string
        }
        Update: {
          clicked_at?: string
          event_id?: string
          id?: string
          organiser_id?: string
          source?: string | null
          user_agent?: string | null
          viewer_session_id?: string | null
          zone?: string
        }
        Relationships: [
          {
            foreignKeyName: "organiser_card_clicks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organiser_card_clicks_organiser_id_fkey"
            columns: ["organiser_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      organiser_profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          bio: string | null
          city_id: string | null
          claimed_by: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          founded_year: number | null
          gallery_urls: Json | null
          google_maps_url: string | null
          id: string
          instagram: string | null
          is_active: boolean | null
          lifecycle_status: string
          name: string
          organisation_category: string | null
          profile_source: string | null
          slug: string | null
          socials: Json | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          bio?: string | null
          city_id?: string | null
          claimed_by?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          founded_year?: number | null
          gallery_urls?: Json | null
          google_maps_url?: string | null
          id?: string
          instagram?: string | null
          is_active?: boolean | null
          lifecycle_status?: string
          name: string
          organisation_category?: string | null
          profile_source?: string | null
          slug?: string | null
          socials?: Json | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          bio?: string | null
          city_id?: string | null
          claimed_by?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          founded_year?: number | null
          gallery_urls?: Json | null
          google_maps_url?: string | null
          id?: string
          instagram?: string | null
          is_active?: boolean | null
          lifecycle_status?: string
          name?: string
          organisation_category?: string | null
          profile_source?: string | null
          slug?: string | null
          socials?: Json | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
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
          organiser_profile_id: string
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
          organiser_profile_id: string
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
          organiser_profile_id?: string
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
            foreignKeyName: "organiser_team_members_organiser_profile_id_fkey"
            columns: ["organiser_profile_id"]
            isOneToOne: false
            referencedRelation: "organiser_admin_dashboard_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organiser_team_members_organiser_profile_id_fkey"
            columns: ["organiser_profile_id"]
            isOneToOne: false
            referencedRelation: "organiser_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organiser_team_members_person_entity_id_fkey"
            columns: ["person_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      organising_role_details: {
        Row: {
          contact_phone: string | null
          created_at: string | null
          id: string
          leader_role: string | null
          legacy_entity_id: string | null
          organisation_name: string | null
          person_id: string
          updated_at: string | null
        }
        Insert: {
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          leader_role?: string | null
          legacy_entity_id?: string | null
          organisation_name?: string | null
          person_id: string
          updated_at?: string | null
        }
        Update: {
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          leader_role?: string | null
          legacy_entity_id?: string | null
          organisation_name?: string | null
          person_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organising_role_details_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: true
            referencedRelation: "dancer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organising_role_details_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: true
            referencedRelation: "public_visible_dancers"
            referencedColumns: ["id"]
          },
        ]
      }
      override_payload_strip_audit_v1: {
        Row: {
          after_payload: Json
          before_payload: Json
          event_id: string
          id: string
          occurrence_id: string
          stripped_at: string
          stripped_keys: string[]
        }
        Insert: {
          after_payload: Json
          before_payload: Json
          event_id: string
          id?: string
          occurrence_id: string
          stripped_at?: string
          stripped_keys: string[]
        }
        Update: {
          after_payload?: Json
          before_payload?: Json
          event_id?: string
          id?: string
          occurrence_id?: string
          stripped_at?: string
          stripped_keys?: string[]
        }
        Relationships: []
      }
      pending_canonical_keys: {
        Row: {
          first_seen_at: string
          key: string
          kind: string
          last_seen_at: string
          proposal_count: number
          resolved_at: string | null
          resolved_by: string | null
          resolved_to_key: string | null
          status: string
          venue_ids: string[]
        }
        Insert: {
          first_seen_at?: string
          key: string
          kind: string
          last_seen_at?: string
          proposal_count?: number
          resolved_at?: string | null
          resolved_by?: string | null
          resolved_to_key?: string | null
          status?: string
          venue_ids?: string[]
        }
        Update: {
          first_seen_at?: string
          key?: string
          kind?: string
          last_seen_at?: string
          proposal_count?: number
          resolved_at?: string | null
          resolved_by?: string | null
          resolved_to_key?: string | null
          status?: string
          venue_ids?: string[]
        }
        Relationships: []
      }
      pending_venue_rooms: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          raw_name: string
          resolved_at: string | null
          resolved_by: string | null
          source: string | null
          source_event_id: string | null
          status: string
          suggested_room_id: string | null
          venue_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          raw_name: string
          resolved_at?: string | null
          resolved_by?: string | null
          source?: string | null
          source_event_id?: string | null
          status?: string
          suggested_room_id?: string | null
          venue_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          raw_name?: string
          resolved_at?: string | null
          resolved_by?: string | null
          source?: string | null
          source_event_id?: string | null
          status?: string
          suggested_room_id?: string | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_venue_rooms_source_event_id_fkey"
            columns: ["source_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_venue_rooms_suggested_room_id_fkey"
            columns: ["suggested_room_id"]
            isOneToOne: false
            referencedRelation: "venue_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_venue_rooms_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "admin_venues_read"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_venue_rooms_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "admin_venues_read"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "pending_venue_rooms_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      performing_role_details: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          performance_styles: string[] | null
          person_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          performance_styles?: string[] | null
          person_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          performance_styles?: string[] | null
          person_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "performing_role_details_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: true
            referencedRelation: "dancer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performing_role_details_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: true
            referencedRelation: "public_visible_dancers"
            referencedColumns: ["id"]
          },
        ]
      }
      person: {
        Row: {
          archived_at: string | null
          auth_user_id: string | null
          claimed_by: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          dedup_instagram_normalized: string | null
          id: string
          is_active: boolean
          merged_into_id: string | null
          meta_data: Json
          primary_persona_id: string | null
          real_first_name: string | null
          real_surname: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          auth_user_id?: string | null
          claimed_by?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          dedup_instagram_normalized?: string | null
          id?: string
          is_active?: boolean
          merged_into_id?: string | null
          meta_data?: Json
          primary_persona_id?: string | null
          real_first_name?: string | null
          real_surname?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          auth_user_id?: string | null
          claimed_by?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          dedup_instagram_normalized?: string | null
          id?: string
          is_active?: boolean
          merged_into_id?: string | null
          meta_data?: Json
          primary_persona_id?: string | null
          real_first_name?: string | null
          real_surname?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "person_merged_into_id_fkey"
            columns: ["merged_into_id"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_primary_persona_id_fkey"
            columns: ["primary_persona_id"]
            isOneToOne: false
            referencedRelation: "dancer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_primary_persona_id_fkey"
            columns: ["primary_persona_id"]
            isOneToOne: false
            referencedRelation: "public_visible_dancers"
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
      person_merge_decisions: {
        Row: {
          created_at: string | null
          decided_at: string | null
          decided_by: string | null
          decision: string | null
          id: string
          notes: string | null
          profile_id_a: string
          profile_id_b: string
          source_table_a: string
          source_table_b: string
        }
        Insert: {
          created_at?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision?: string | null
          id?: string
          notes?: string | null
          profile_id_a: string
          profile_id_b: string
          source_table_a: string
          source_table_b: string
        }
        Update: {
          created_at?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision?: string | null
          id?: string
          notes?: string | null
          profile_id_a?: string
          profile_id_b?: string
          source_table_a?: string
          source_table_b?: string
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
            foreignKeyName: "person_merge_log_merged_into_id_fkey"
            columns: ["merged_into_id"]
            isOneToOne: false
            referencedRelation: "entities"
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
      person_roles: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          person_id: string
          role: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          person_id: string
          role: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          person_id?: string
          role?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "person_roles_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "dancer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_roles_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "public_visible_dancers"
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
      photographing_role_details: {
        Row: {
          business_name: string | null
          created_at: string | null
          equipment: string | null
          gallery_urls: string[] | null
          id: string
          languages: string[] | null
          person_id: string
          portfolio_url: string | null
          rates_text: string | null
          updated_at: string | null
        }
        Insert: {
          business_name?: string | null
          created_at?: string | null
          equipment?: string | null
          gallery_urls?: string[] | null
          id?: string
          languages?: string[] | null
          person_id: string
          portfolio_url?: string | null
          rates_text?: string | null
          updated_at?: string | null
        }
        Update: {
          business_name?: string | null
          created_at?: string | null
          equipment?: string | null
          gallery_urls?: string[] | null
          id?: string
          languages?: string[] | null
          person_id?: string
          portfolio_url?: string | null
          rates_text?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "photographing_role_details_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: true
            referencedRelation: "dancer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photographing_role_details_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: true
            referencedRelation: "public_visible_dancers"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_deal_desk_config: {
        Row: {
          context_md: string | null
          id: number
          updated_at: string | null
        }
        Insert: {
          context_md?: string | null
          id?: number
          updated_at?: string | null
        }
        Update: {
          context_md?: string | null
          id?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      pm_organiser_deadlines: {
        Row: {
          created_at: string
          created_by: string | null
          done: boolean
          done_at: string | null
          due_on: string | null
          id: string
          pipeline_id: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          done?: boolean
          done_at?: string | null
          due_on?: string | null
          id?: string
          pipeline_id: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          done?: boolean
          done_at?: string | null
          due_on?: string | null
          id?: string
          pipeline_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_organiser_deadlines_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pm_organiser_pipeline"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_organiser_notes: {
        Row: {
          channel: string
          created_at: string
          created_by: string | null
          happened_on: string
          id: string
          note: string
          pipeline_id: string
        }
        Insert: {
          channel?: string
          created_at?: string
          created_by?: string | null
          happened_on?: string
          id?: string
          note: string
          pipeline_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          created_by?: string | null
          happened_on?: string
          id?: string
          note?: string
          pipeline_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_organiser_notes_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pm_organiser_pipeline"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_organiser_pipeline: {
        Row: {
          chat_history: string | null
          chat_history_updated_at: string | null
          created_at: string
          created_by: string | null
          draft_message: string | null
          draft_updated_at: string | null
          goal: string | null
          id: string
          last_contact_at: string | null
          next_follow_up_at: string | null
          notes: string | null
          organiser_id: string | null
          organiser_name: string
          stage: string
          updated_at: string
        }
        Insert: {
          chat_history?: string | null
          chat_history_updated_at?: string | null
          created_at?: string
          created_by?: string | null
          draft_message?: string | null
          draft_updated_at?: string | null
          goal?: string | null
          id?: string
          last_contact_at?: string | null
          next_follow_up_at?: string | null
          notes?: string | null
          organiser_id?: string | null
          organiser_name: string
          stage?: string
          updated_at?: string
        }
        Update: {
          chat_history?: string | null
          chat_history_updated_at?: string | null
          created_at?: string
          created_by?: string | null
          draft_message?: string | null
          draft_updated_at?: string | null
          goal?: string | null
          id?: string
          last_contact_at?: string | null
          next_follow_up_at?: string | null
          notes?: string | null
          organiser_id?: string | null
          organiser_name?: string
          stage?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_organiser_pipeline_organiser_id_fkey"
            columns: ["organiser_id"]
            isOneToOne: false
            referencedRelation: "organiser_admin_dashboard_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_organiser_pipeline_organiser_id_fkey"
            columns: ["organiser_id"]
            isOneToOne: false
            referencedRelation: "organiser_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_talent_pipeline: {
        Row: {
          chat_history: string | null
          chat_history_updated_at: string | null
          created_at: string | null
          created_by: string | null
          draft_message: string | null
          draft_updated_at: string | null
          goal: string | null
          id: string
          last_contact_at: string | null
          next_follow_up_at: string | null
          notes: string | null
          stage: string | null
          talent_id: string | null
          talent_name: string | null
          updated_at: string | null
        }
        Insert: {
          chat_history?: string | null
          chat_history_updated_at?: string | null
          created_at?: string | null
          created_by?: string | null
          draft_message?: string | null
          draft_updated_at?: string | null
          goal?: string | null
          id?: string
          last_contact_at?: string | null
          next_follow_up_at?: string | null
          notes?: string | null
          stage?: string | null
          talent_id?: string | null
          talent_name?: string | null
          updated_at?: string | null
        }
        Update: {
          chat_history?: string | null
          chat_history_updated_at?: string | null
          created_at?: string | null
          created_by?: string | null
          draft_message?: string | null
          draft_updated_at?: string | null
          goal?: string | null
          id?: string
          last_contact_at?: string | null
          next_follow_up_at?: string | null
          notes?: string | null
          stage?: string | null
          talent_id?: string | null
          talent_name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pm_talent_pipeline_talent_id_fkey"
            columns: ["talent_id"]
            isOneToOne: false
            referencedRelation: "dancer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_talent_pipeline_talent_id_fkey"
            columns: ["talent_id"]
            isOneToOne: false
            referencedRelation: "public_visible_dancers"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_work_items: {
        Row: {
          component: string | null
          created_at: string
          created_by: string | null
          detail: string | null
          id: string
          item_type: string
          repo: string | null
          severity: string | null
          sort_order: number
          source: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          component?: string | null
          created_at?: string
          created_by?: string | null
          detail?: string | null
          id?: string
          item_type: string
          repo?: string | null
          severity?: string | null
          sort_order?: number
          source?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          component?: string | null
          created_at?: string
          created_by?: string | null
          detail?: string | null
          id?: string
          item_type?: string
          repo?: string | null
          severity?: string | null
          sort_order?: number
          source?: string | null
          status?: string
          title?: string
          updated_at?: string
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
      profile_view_events: {
        Row: {
          event_id: string | null
          id: string
          person_id: string
          profile_type: string
          source_context: string
          user_agent: string | null
          viewed_at: string
          viewer_session_id: string | null
        }
        Insert: {
          event_id?: string | null
          id?: string
          person_id: string
          profile_type: string
          source_context: string
          user_agent?: string | null
          viewed_at?: string
          viewer_session_id?: string | null
        }
        Update: {
          event_id?: string | null
          id?: string
          person_id?: string
          profile_type?: string
          source_context?: string
          user_agent?: string | null
          viewed_at?: string
          viewer_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_view_events_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      raffle_presets: {
        Row: {
          consent_version: string
          created_at: string
          created_by: string | null
          cutoff_offset_minutes: number
          id: string
          is_archived: boolean
          name: string
          prize_text: string
          show_winner_publicly: boolean
          slug: string
          updated_at: string
        }
        Insert: {
          consent_version?: string
          created_at?: string
          created_by?: string | null
          cutoff_offset_minutes: number
          id?: string
          is_archived?: boolean
          name: string
          prize_text: string
          show_winner_publicly?: boolean
          slug: string
          updated_at?: string
        }
        Update: {
          consent_version?: string
          created_at?: string
          created_by?: string | null
          cutoff_offset_minutes?: number
          id?: string
          is_archived?: boolean
          name?: string
          prize_text?: string
          show_winner_publicly?: boolean
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      raffle_submit_throttle: {
        Row: {
          count: number
          key_hash: string
          scope: string
          window_start: string
        }
        Insert: {
          count?: number
          key_hash: string
          scope: string
          window_start?: string
        }
        Update: {
          count?: number
          key_hash?: string
          scope?: string
          window_start?: string
        }
        Relationships: []
      }
      raffle_winners: {
        Row: {
          draw_id: string | null
          entry_id: string | null
          event_id: string
          first_name: string | null
          id: string
          logged_by: string | null
          note: string | null
          phone_e164: string
          series_key: string | null
          source: string
          venue_id: string | null
          won_at: string
        }
        Insert: {
          draw_id?: string | null
          entry_id?: string | null
          event_id: string
          first_name?: string | null
          id?: string
          logged_by?: string | null
          note?: string | null
          phone_e164: string
          series_key?: string | null
          source?: string
          venue_id?: string | null
          won_at?: string
        }
        Update: {
          draw_id?: string | null
          entry_id?: string | null
          event_id?: string
          first_name?: string | null
          id?: string
          logged_by?: string | null
          note?: string | null
          phone_e164?: string
          series_key?: string | null
          source?: string
          venue_id?: string | null
          won_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "raffle_winners_draw_id_fkey"
            columns: ["draw_id"]
            isOneToOne: false
            referencedRelation: "event_raffle_draws"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raffle_winners_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "event_raffle_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raffle_winners_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raffle_winners_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "admin_venues_read"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raffle_winners_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "admin_venues_read"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "raffle_winners_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      reference_data_audit: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: number
          key: string
          op: string
          payload_after: Json | null
          payload_before: Json | null
          table_name: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: never
          key: string
          op: string
          payload_after?: Json | null
          payload_before?: Json | null
          table_name: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: never
          key?: string
          op?: string
          payload_after?: Json | null
          payload_before?: Json | null
          table_name?: string
        }
        Relationships: []
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
      schema_migrations_audit: {
        Row: {
          actor: string
          commit_ref: string | null
          details: Json | null
          event_type: string
          id: number
          reason: string
          recorded_at: string
          remediation: string | null
          version_count: number | null
          version_range: string | null
        }
        Insert: {
          actor: string
          commit_ref?: string | null
          details?: Json | null
          event_type: string
          id?: number
          reason: string
          recorded_at?: string
          remediation?: string | null
          version_count?: number | null
          version_range?: string | null
        }
        Update: {
          actor?: string
          commit_ref?: string | null
          details?: Json | null
          event_type?: string
          id?: number
          reason?: string
          recorded_at?: string
          remediation?: string | null
          version_count?: number | null
          version_range?: string | null
        }
        Relationships: []
      }
      search_queries: {
        Row: {
          city_id: string | null
          id: string
          normalized_query: string | null
          query: string
          results_count: number | null
          searched_at: string
          searched_hour_bucket: string | null
          source: string
          user_agent: string | null
          viewer_session_id: string | null
        }
        Insert: {
          city_id?: string | null
          id?: string
          normalized_query?: string | null
          query: string
          results_count?: number | null
          searched_at?: string
          searched_hour_bucket?: string | null
          source?: string
          user_agent?: string | null
          viewer_session_id?: string | null
        }
        Update: {
          city_id?: string | null
          id?: string
          normalized_query?: string | null
          query?: string
          results_count?: number | null
          searched_at?: string
          searched_hour_bucket?: string | null
          source?: string
          user_agent?: string | null
          viewer_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "search_queries_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      search_result_clicks: {
        Row: {
          clicked_at: string
          clicked_hour_bucket: string | null
          entity_id: string
          entity_type: string
          id: string
          normalized_query: string | null
          position: number | null
          query: string
          source: string
          user_agent: string | null
          viewer_session_id: string | null
        }
        Insert: {
          clicked_at?: string
          clicked_hour_bucket?: string | null
          entity_id: string
          entity_type: string
          id?: string
          normalized_query?: string | null
          position?: number | null
          query: string
          source?: string
          user_agent?: string | null
          viewer_session_id?: string | null
        }
        Update: {
          clicked_at?: string
          clicked_hour_bucket?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          normalized_query?: string | null
          position?: number | null
          query?: string
          source?: string
          user_agent?: string | null
          viewer_session_id?: string | null
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
      teacher_role_details: {
        Row: {
          availability: Json | null
          created_at: string | null
          faq: Json | null
          id: string
          legacy_teacher_id: string | null
          offers_private: boolean | null
          partner_role: string | null
          person_id: string
          private_lesson_locations: string[] | null
          private_lesson_types: string[] | null
          private_travel_distance: string | null
          teaching_styles: string[] | null
          updated_at: string | null
          years_teaching: number | null
        }
        Insert: {
          availability?: Json | null
          created_at?: string | null
          faq?: Json | null
          id?: string
          legacy_teacher_id?: string | null
          offers_private?: boolean | null
          partner_role?: string | null
          person_id: string
          private_lesson_locations?: string[] | null
          private_lesson_types?: string[] | null
          private_travel_distance?: string | null
          teaching_styles?: string[] | null
          updated_at?: string | null
          years_teaching?: number | null
        }
        Update: {
          availability?: Json | null
          created_at?: string | null
          faq?: Json | null
          id?: string
          legacy_teacher_id?: string | null
          offers_private?: boolean | null
          partner_role?: string | null
          person_id?: string
          private_lesson_locations?: string[] | null
          private_lesson_types?: string[] | null
          private_travel_distance?: string | null
          teaching_styles?: string[] | null
          updated_at?: string | null
          years_teaching?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "teacher_role_details_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: true
            referencedRelation: "dancer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_role_details_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: true
            referencedRelation: "public_visible_dancers"
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
      user_venue_favourites: {
        Row: {
          created_at: string
          user_id: string
          venue_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
          venue_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_venue_favourites_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "admin_venues_read"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_venue_favourites_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "admin_venues_read"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "user_venue_favourites_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
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
      vendor_link_clicks: {
        Row: {
          clicked_at: string
          id: string
          link_type: string
          source: string | null
          target_url: string | null
          user_agent: string | null
          vendor_id: string
          viewer_session_id: string | null
        }
        Insert: {
          clicked_at?: string
          id?: string
          link_type: string
          source?: string | null
          target_url?: string | null
          user_agent?: string | null
          vendor_id: string
          viewer_session_id?: string | null
        }
        Update: {
          clicked_at?: string
          id?: string
          link_type?: string
          source?: string | null
          target_url?: string | null
          user_agent?: string | null
          vendor_id?: string
          viewer_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_link_clicks_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_team_members: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_leader: boolean
          member_profile_id: string
          role: string | null
          updated_at: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_leader?: boolean
          member_profile_id: string
          role?: string | null
          updated_at?: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_leader?: boolean
          member_profile_id?: string
          role?: string | null
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_team_members_member_profile_id_fkey"
            columns: ["member_profile_id"]
            isOneToOne: false
            referencedRelation: "member_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_team_members_member_profile_id_fkey"
            columns: ["member_profile_id"]
            isOneToOne: false
            referencedRelation: "member_profiles_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_team_members_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_team_members_backfill_audit: {
        Row: {
          attempted_at: string
          id: number
          raw: Json | null
          reason: string | null
          source: string | null
          vendor_id: string | null
        }
        Insert: {
          attempted_at?: string
          id?: number
          raw?: Json | null
          reason?: string | null
          source?: string | null
          vendor_id?: string | null
        }
        Update: {
          attempted_at?: string
          id?: number
          raw?: Json | null
          reason?: string | null
          source?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_team_members_backfill_audit_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
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
          updated_at: string
          user_id: string | null
          verified: boolean | null
          verified_at: string | null
          verified_by: string | null
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
          updated_at?: string
          user_id?: string | null
          verified?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
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
          updated_at?: string
          user_id?: string | null
          verified?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
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
        ]
      }
      venue_coords_backfill_audit: {
        Row: {
          actor: string | null
          attempted_at: string
          id: number
          lat: number | null
          lng: number | null
          ok: boolean
          reason: string | null
          source: string
          venue_id: string
        }
        Insert: {
          actor?: string | null
          attempted_at?: string
          id?: number
          lat?: number | null
          lng?: number | null
          ok: boolean
          reason?: string | null
          source: string
          venue_id: string
        }
        Update: {
          actor?: string | null
          attempted_at?: string
          id?: number
          lat?: number | null
          lng?: number | null
          ok?: boolean
          reason?: string | null
          source?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_coords_backfill_audit_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "admin_venues_read"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_coords_backfill_audit_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "admin_venues_read"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "venue_coords_backfill_audit_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_room_aliases: {
        Row: {
          alias: string
          canonical_room_id: string
          created_at: string
          created_by: string | null
          id: string
          venue_id: string
        }
        Insert: {
          alias: string
          canonical_room_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          venue_id: string
        }
        Update: {
          alias?: string
          canonical_room_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_room_aliases_canonical_room_id_fkey"
            columns: ["canonical_room_id"]
            isOneToOne: false
            referencedRelation: "venue_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_room_aliases_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "admin_venues_read"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_room_aliases_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "admin_venues_read"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "venue_room_aliases_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_rooms: {
        Row: {
          archived_at: string | null
          capacity: number | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          notes: string | null
          photo_url: string | null
          slug: string
          sort_order: number
          updated_at: string
          venue_id: string
        }
        Insert: {
          archived_at?: string | null
          capacity?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          notes?: string | null
          photo_url?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
          venue_id: string
        }
        Update: {
          archived_at?: string | null
          capacity?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          photo_url?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_rooms_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "admin_venues_read"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_rooms_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "admin_venues_read"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "venue_rooms_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
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
          food_situation: string | null
          gallery_urls: string[] | null
          google_maps_link: string | null
          google_maps_url: string | null
          hide_paid_parking: boolean | null
          id: string
          id_required: boolean | null
          instagram: string | null
          last_entry_time: string | null
          lat: number | null
          late_night_notes: string | null
          lng: number | null
          meta_data: Json | null
          name: string
          neighbourhood: string | null
          opening_hours: Json | null
          parking: string | null
          parking_cost_notes: string | null
          parking_json: Json | null
          phone: string | null
          photo_url: string[] | null
          postcode: string | null
          publish_state: string
          rules: string[] | null
          slug: string | null
          temperature_feel: string | null
          timezone: string | null
          transport: string | null
          transport_json: Json | null
          user_id: string
          venue_rating: number | null
          video_urls: string[] | null
          water_situation: string | null
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
          food_situation?: string | null
          gallery_urls?: string[] | null
          google_maps_link?: string | null
          google_maps_url?: string | null
          hide_paid_parking?: boolean | null
          id?: string
          id_required?: boolean | null
          instagram?: string | null
          last_entry_time?: string | null
          lat?: number | null
          late_night_notes?: string | null
          lng?: number | null
          meta_data?: Json | null
          name: string
          neighbourhood?: string | null
          opening_hours?: Json | null
          parking?: string | null
          parking_cost_notes?: string | null
          parking_json?: Json | null
          phone?: string | null
          photo_url?: string[] | null
          postcode?: string | null
          publish_state?: string
          rules?: string[] | null
          slug?: string | null
          temperature_feel?: string | null
          timezone?: string | null
          transport?: string | null
          transport_json?: Json | null
          user_id: string
          venue_rating?: number | null
          video_urls?: string[] | null
          water_situation?: string | null
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
          food_situation?: string | null
          gallery_urls?: string[] | null
          google_maps_link?: string | null
          google_maps_url?: string | null
          hide_paid_parking?: boolean | null
          id?: string
          id_required?: boolean | null
          instagram?: string | null
          last_entry_time?: string | null
          lat?: number | null
          late_night_notes?: string | null
          lng?: number | null
          meta_data?: Json | null
          name?: string
          neighbourhood?: string | null
          opening_hours?: Json | null
          parking?: string | null
          parking_cost_notes?: string | null
          parking_json?: Json | null
          phone?: string | null
          photo_url?: string[] | null
          postcode?: string | null
          publish_state?: string
          rules?: string[] | null
          slug?: string | null
          temperature_feel?: string | null
          timezone?: string | null
          transport?: string | null
          transport_json?: Json | null
          user_id?: string
          venue_rating?: number | null
          video_urls?: string[] | null
          water_situation?: string | null
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
        ]
      }
    }
    Views: {
      admin_contract_checks_registry_v1: {
        Row: {
          arguments: string | null
          description: string | null
          return_type: string | null
          rpc_name: string | null
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
            foreignKeyName: "fk_entities_city"
            columns: ["entity_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
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
            referencedRelation: "entities"
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
            referencedRelation: "events"
            referencedColumns: ["id"]
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
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      dj_profiles: {
        Row: {
          dj_name: string | null
          id: string | null
          name: string | null
          photo_url: string | null
          real_name: string | null
        }
        Relationships: []
      }
      event_profile_links: {
        Row: {
          archived_at: string | null
          created_at: string | null
          event_id: string | null
          id: string | null
          occurrence_id: string | null
          profile_id: string | null
          profile_type: string | null
          role: string | null
          status: string | null
        }
        Relationships: []
      }
      event_series: {
        Row: {
          id: string | null
          local_timezone: string | null
        }
        Insert: {
          id?: string | null
          local_timezone?: string | null
        }
        Update: {
          id?: string | null
          local_timezone?: string | null
        }
        Relationships: []
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
      organiser_admin_dashboard_v2: {
        Row: {
          avatar_url: string | null
          city_id: string | null
          city_name: string | null
          claimed_by: string | null
          contact_phone: string | null
          created_at: string | null
          created_by: string | null
          founded_year: number | null
          has_leader: boolean | null
          id: string | null
          instagram: string | null
          is_active: boolean | null
          leader_corruption: boolean | null
          leader_name: string | null
          lifecycle_status: string | null
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
        Relationships: []
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
      search_result_click_counts_30d: {
        Row: {
          clicks_30d: number | null
          entity_id: string | null
          entity_type: string | null
        }
        Relationships: []
      }
      teacher_profiles: {
        Row: {
          first_name: string | null
          id: string | null
          photo_url: string | null
          surname: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _arc_gates_internal_counts_v1: { Args: never; Returns: Json }
      _assert_can_edit_occurrence_p5: {
        Args: { p_actor: string; p_occurrence_id: string }
        Returns: undefined
      }
      _assert_can_edit_series_p5: {
        Args: { p_actor: string; p_series_id: string }
        Returns: undefined
      }
      _assert_vendor_has_active_leader_v1: {
        Args: { p_vendor_id: string }
        Returns: undefined
      }
      _build_override_identity_payload_v1: {
        Args: {
          p_cover: string
          p_description: string
          p_existing: Json
          p_level: string
          p_ticket: string
          p_title: string
        }
        Returns: Json
      }
      _can_act_as_organiser_p5: { Args: { p_actor: string }; Returns: boolean }
      _claim_entry_slot_v1: {
        Args: {
          p_event_id: string
          p_is_permanent?: boolean
          p_kind: string
          p_occurrence_id?: string
        }
        Returns: string
      }
      _cmd_occurrence_cancel_p5: {
        Args: { p_actor: string; p_occurrence_id: string; p_payload: Json }
        Returns: Json
      }
      _cmd_occurrence_set_override_p5: {
        Args: { p_actor: string; p_occurrence_id: string; p_payload: Json }
        Returns: Json
      }
      _cmd_occurrence_set_session_delta_p5: {
        Args: { p_actor: string; p_occurrence_id: string; p_payload: Json }
        Returns: Json
      }
      _cmd_occurrence_set_time_p5: {
        Args: { p_actor: string; p_occurrence_id: string; p_payload: Json }
        Returns: Json
      }
      _cmd_series_add_date_p5: {
        Args: { p_actor_id: string; p_payload: Json; p_series_id: string }
        Returns: Json
      }
      _cmd_series_apply_forward_from_p5: {
        Args: { p_actor: string; p_payload: Json; p_series_id: string }
        Returns: Json
      }
      _cmd_series_remove_date_p5: {
        Args: { p_actor_id: string; p_payload: Json; p_series_id: string }
        Returns: Json
      }
      _cmd_series_set_lifecycle_p5: {
        Args: { p_actor: string; p_payload: Json; p_series_id: string }
        Returns: Json
      }
      _cmd_series_set_program_p5: {
        Args: { p_actor: string; p_payload: Json; p_series_id: string }
        Returns: Json
      }
      _cmd_series_set_recurrence_p5: {
        Args: { p_actor: string; p_payload: Json; p_series_id: string }
        Returns: Json
      }
      _cmd_series_stop_repeating_p5: {
        Args: { p_actor: string; p_payload: Json; p_series_id: string }
        Returns: Json
      }
      _cmd_series_upsert_p5: {
        Args: { p_actor: string; p_payload: Json; p_series_id: string }
        Returns: Json
      }
      _command_audit_failure_p5: {
        Args: {
          p_actor: string
          p_audit_id: string
          p_before: Json
          p_command: Json
          p_idem: string
          p_kind: string
          p_sqlerrm: string
          p_sqlstate: string
          p_target_id: string
          p_target_kind: string
        }
        Returns: undefined
      }
      _command_result_err_p5: {
        Args: { p_code: string; p_contract?: string; p_message: string }
        Returns: Json
      }
      _command_result_ok_p5: {
        Args: { p_audit_id: string; p_data: Json; p_new_version: number }
        Returns: Json
      }
      _compute_effective_occurrence_p5: {
        Args: { p_occurrence_id: string }
        Returns: Json
      }
      _compute_series_occurrence_dates_p5_v1: {
        Args: { p_anchor_date?: string; p_series_id: string }
        Returns: string[]
      }
      _derive_event_organiser_ids: {
        Args: { p_event_id: string }
        Returns: string[]
      }
      _emit_cache_revalidation_v1: {
        Args: { p_entity_id: string; p_entity_type: string; p_extra?: Json }
        Returns: undefined
      }
      _ensure_festival_legacy_bridge_v1: {
        Args: { p_series_id: string }
        Returns: Json
      }
      _envelope_unpack_p5: {
        Args: { p_envelope: Json }
        Returns: Record<string, unknown>
      }
      _event_has_resolvable_organiser_v1: {
        Args: { p_event_id: string }
        Returns: boolean
      }
      _event_is_retention_dead_v1: {
        Args: { p_cutoff: string; p_event_id: string }
        Returns: boolean
      }
      _event_publish_blocking_reason_v1: {
        Args: { p_series_id: string }
        Returns: string
      }
      _event_series_p5_slugify_v1: {
        Args: { p_id: string; p_name: string }
        Returns: string
      }
      _event_view_legacy_compat_v1: { Args: { p_target: Json }; Returns: Json }
      _event_view_snapshot_compat_v1: {
        Args: { p_target: Json }
        Returns: Json
      }
      _festival_anchor_dates_p5: {
        Args: { p_series_id: string }
        Returns: {
          first_wall_start: string
          start_date: string
        }[]
      }
      _floor_test_probe: { Args: never; Returns: string }
      _get_occurrence_program_p5_native_v1: {
        Args: { p_occurrence_id: string }
        Returns: Json
      }
      _is_city_ambassador: {
        Args: { p_city_id: string; p_user: string }
        Returns: boolean
      }
      _is_entity_member: {
        Args: {
          p_id: string
          p_roles: string[]
          p_type: string
          p_user: string
        }
        Returns: boolean
      }
      _is_entity_owner_or_editor: {
        Args: { p_id: string; p_type: string; p_user: string }
        Returns: boolean
      }
      _log_legacy_read: { Args: { _surface: string }; Returns: undefined }
      _map_role_to_profile_type: { Args: { p_role: string }; Returns: string }
      _materialise_series_occurrences_p5_v1: {
        Args: { p_anchor_date?: string; p_series_id: string }
        Returns: Json
      }
      _member_profile_user_id: {
        Args: { p_member_profile_id: string }
        Returns: string
      }
      _mirror_legacy_lifecycle_to_p5_v1: {
        Args: { p_event_id: string }
        Returns: undefined
      }
      _mirror_p5_lifecycle_to_legacy_v1: {
        Args: { p_series_id: string }
        Returns: undefined
      }
      _mirror_p5_program_to_legacy_v1: {
        Args: { p_series_id: string }
        Returns: Json
      }
      _mirror_p5_session_override_to_legacy_v1: {
        Args: { p_p5_occurrence_id: string; p_p5_program_item_id: string }
        Returns: undefined
      }
      _mirror_series_p5_to_legacy_v1: {
        Args: { p_series_id: string }
        Returns: number
      }
      _moderate_entity: {
        Args: {
          p_action: string
          p_reason: string
          p_target_id: string
          p_target_type: string
          p_to_state: string
        }
        Returns: Json
      }
      _normalize_level_to_legacy_v1: {
        Args: { p_level: string }
        Returns: string
      }
      _normalize_program_people_role_v1: {
        Args: { p_profile_type: string; p_role: string }
        Returns: string
      }
      _occurrence_idempotent_check: {
        Args: { p_actor: string; p_key: string }
        Returns: boolean
      }
      _occurrence_idempotent_complete: {
        Args: { p_actor: string; p_key: string }
        Returns: undefined
      }
      _og_cover_token: { Args: { p_url: string }; Returns: string }
      _og_enqueue: {
        Args: {
          p_cover_source_url: string
          p_entity_id: string
          p_entity_type: string
          p_occurrence_id: string
        }
        Returns: undefined
      }
      _og_scrape: {
        Args: {
          p_entity_id: string
          p_entity_type: string
          p_occurrence_id: string
        }
        Returns: number
      }
      _og_scrape_drain: { Args: never; Returns: undefined }
      _og_sweep: { Args: never; Returns: undefined }
      _p5_native_people_v1: { Args: { p_people: Json }; Returns: Json }
      _p5_occ_wall_end_v1: {
        Args: {
          p_default_duration: string
          p_local_start: string
          p_m_end: string
          p_occ_date: string
          p_override_end: string
        }
        Returns: string
      }
      _p5_occ_wall_start_v1: {
        Args: { p_local_start: string; p_m_start: string; p_occ_date: string }
        Returns: string
      }
      _p5_occurrence_effective_headline_v1: {
        Args: { p_occurrence_id: string }
        Returns: {
          headline_end: string
          headline_start: string
        }[]
      }
      _p5_series_legacy_type_v1: {
        Args: { p_category: string; p_format: string }
        Returns: string
      }
      _p5_series_public_visibility_v1: {
        Args: { p_legacy_event_id: string; p_lifecycle_status: string }
        Returns: boolean
      }
      _people_read_internal_counts_v1: { Args: never; Returns: Json }
      _person_credited_event_ids_v1: {
        Args: { p_profile_id: string }
        Returns: string[]
      }
      _person_delete_blockers_v1: {
        Args: { p_person_id: string }
        Returns: Json
      }
      _person_lineup_visible_v1: {
        Args: { p_profile_id: string }
        Returns: boolean
      }
      _person_publicly_visible_v1: {
        Args: { p_person_id: string }
        Returns: boolean
      }
      _promote_waitlist_v1: {
        Args: { p_event_id: string; p_kind: string; p_occurrence_id?: string }
        Returns: number
      }
      _public_anchor_occurrence_p5_v1: {
        Args: { p_series_id: string }
        Returns: string
      }
      _public_event_promo_codes_v1: {
        Args: { p_event_id: string }
        Returns: Json
      }
      _public_featured_occurrence_p5_v1: {
        Args: { p_series_id: string }
        Returns: string
      }
      _public_time_agreement_sample_v1: {
        Args: { p_limit?: number }
        Returns: {
          canonical_start: string
          event_id: string
          occurrence_id: string
          series_name: string
        }[]
      }
      _purge_person_stub_v1: { Args: { p_person_id: string }; Returns: Json }
      _raffle_drawable_entries_v1: {
        Args: { p_event_id: string; p_exclude_entry_id?: string }
        Returns: {
          created_at: string
          eligibility_override: boolean
          entry_id: string
          first_name: string
          is_drawable: boolean
          phone_e164: string
          series_repeat: boolean
          wa_verify_status: string
        }[]
      }
      _raffle_entry_is_eligible_v1: {
        Args: {
          p_deleted_at: string
          p_eligibility_override: boolean
          p_ineligible_reason: string
          p_status: string
          p_wa_verify_status: string
        }
        Returns: boolean
      }
      _raffle_event_venue_v1: { Args: { p_event_id: string }; Returns: string }
      _raffle_record_draw_v1: {
        Args: {
          p_actor_id: string
          p_chosen: Json
          p_event_id: string
          p_pick_method: string
          p_pool: Json
          p_reason: string
          p_source: string
          p_winner_entry_id: string
        }
        Returns: {
          claimed_at: string | null
          created_at: string
          drawn_at: string | null
          drawn_by: string | null
          entries_snapshot: Json | null
          event_id: string
          id: string
          is_active: boolean
          pick_method: string
          prior_draw_id: string | null
          reason: string | null
          winner_entry_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "event_raffle_draws"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      _raffle_throttle_allow_v1: {
        Args: {
          p_key: string
          p_limit: number
          p_scope: string
          p_window: string
        }
        Returns: boolean
      }
      _recompute_occurrence_headline_time_from_sessions_v1: {
        Args: { p_occurrence_id: string }
        Returns: undefined
      }
      _reconcile_series_occurrences_after_rule_change_p5_v1: {
        Args: { p_old_rule: Json; p_series_id: string }
        Returns: Json
      }
      _resolve_event_program_day_section_v1: {
        Args: {
          p_event_date: string
          p_event_id: string
          p_kind: Database["public"]["Enums"]["event_program_section_kind"]
          p_legacy_id?: string
        }
        Returns: {
          day_id: string
          section_id: string
        }[]
      }
      _resolve_primary_organiser_v1: {
        Args: { p_event_id: string }
        Returns: {
          avatar_url: string
          id: string
          name: string
        }[]
      }
      _safe_text_to_time_p5: { Args: { p: string }; Returns: string }
      _secdef_probe: { Args: never; Returns: string }
      _seed_p5_program_from_legacy_v1: {
        Args: { p_series_id: string }
        Returns: Json
      }
      _self_serve_is_admin: { Args: never; Returns: boolean }
      _snapshot_occurrence_p5: {
        Args: { p_occurrence_id: string }
        Returns: Json
      }
      _snapshot_series_p5: { Args: { p_series_id: string }; Returns: Json }
      _strip_sql_comments_v1: { Args: { p_src: string }; Returns: string }
      _target_series_lifecycle_p5: { Args: { p_target: Json }; Returns: string }
      _validate_recurrence_payload_v1: {
        Args: { p_rule: Json }
        Returns: undefined
      }
      _validate_session_people_deltas_v1: {
        Args: { p_added: Json; p_modified: Json; p_removed: string[] }
        Returns: undefined
      }
      _write_entity_decision_audit: {
        Args: {
          p_action: string
          p_after: Json
          p_before: Json
          p_from: string
          p_reason: string
          p_target_id: string
          p_target_type: string
          p_to: string
        }
        Returns: string
      }
      account_exists_by_email: { Args: { p_email: string }; Returns: boolean }
      add_favourite_venue_v1: {
        Args: { p_venue_id: string }
        Returns: undefined
      }
      admin_add_entity_member_v1: {
        Args: {
          p_email: string
          p_entity_id: string
          p_entity_type: string
          p_is_primary?: boolean
          p_member_role: string
        }
        Returns: Json
      }
      admin_add_series_program_item_v1: {
        Args: { p_item_data: Json; p_section_id: string }
        Returns: Json
      }
      admin_alias_pending_facility_v1: {
        Args: {
          p_apply_to_venues?: boolean
          p_canonical_key: string
          p_key: string
        }
        Returns: undefined
      }
      admin_alias_pending_floor_type_v1: {
        Args: {
          p_apply_to_venues?: boolean
          p_canonical_key: string
          p_key: string
        }
        Returns: undefined
      }
      admin_api_consumer_usage_v1: {
        Args: { p_id: string; p_since?: string; p_until?: string }
        Returns: Json
      }
      admin_apply_guestlist_standing_v1: {
        Args: { p_event_id: string }
        Returns: Json
      }
      admin_approve_entity_v1: {
        Args: { p_reason?: string; p_target_id: string; p_target_type: string }
        Returns: Json
      }
      admin_archive_event_v1: { Args: { p_event_id: string }; Returns: Json }
      admin_archive_person_v1: { Args: { p_person_id: string }; Returns: Json }
      admin_archive_raffle_preset_v1: {
        Args: { p_preset_id: string }
        Returns: Json
      }
      admin_assign_raffle_preset_v1: {
        Args: { p_event_id: string; p_preset_id?: string }
        Returns: Json
      }
      admin_attach_vendor_to_event_v1: {
        Args: { p_booth?: Json; p_event_id: string; p_vendor_id: string }
        Returns: {
          booth_id: string
          created: boolean
        }[]
      }
      admin_backfill_p5_legacy_bridges_v1: {
        Args: { p_legacy_event_id?: string }
        Returns: Json
      }
      admin_bulk_apply_session_overrides_v1:
        | {
            Args: {
              p_event_id: string
              p_from_occurrence_id: string
              p_patch: Json
              p_program_item_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_event_id: string
              p_from_occurrence_id: string
              p_idempotency_key?: string
              p_patch: Json
              p_program_item_id: string
            }
            Returns: Json
          }
      admin_bulk_assign_raffle_preset_v1: {
        Args: { p_event_ids: string[]; p_preset_id?: string }
        Returns: Json
      }
      admin_bulk_cancel_session_v1: {
        Args: {
          p_event_id: string
          p_idempotency_key_prefix?: string
          p_occurrence_ids: string[]
          p_program_item_id: string
          p_reason_label: string
        }
        Returns: Json
      }
      admin_bulk_delete_draft_events: {
        Args: { p_reason?: string }
        Returns: Json
      }
      admin_bulk_occurrence_command_p5: {
        Args: { p_envelope: Json }
        Returns: Json
      }
      admin_bulk_patch_occurrences_v1: {
        Args: {
          p_event_id: string
          p_from_occurrence_id: string
          p_idempotency_key?: string
          p_patch: Json
        }
        Returns: Json
      }
      admin_check_for_unmigrated_schema_changes_v1: {
        Args: never
        Returns: Json
      }
      admin_check_person_instagram_dedup_v1: {
        Args: { p_exclude_person_id?: string; p_instagram: string }
        Returns: Json
      }
      admin_clear_all_session_overrides_v1:
        | { Args: { p_occurrence_id: string }; Returns: Json }
        | {
            Args: { p_idempotency_key?: string; p_occurrence_id: string }
            Returns: Json
          }
      admin_clear_occurrence_override_v1: {
        Args: {
          p_apply_to?: string
          p_idempotency_key?: string
          p_occurrence_id: string
        }
        Returns: Json
      }
      admin_clear_session_overrides_v1:
        | {
            Args: { p_occurrence_id: string; p_program_item_id: string }
            Returns: Json
          }
        | {
            Args: {
              p_idempotency_key?: string
              p_occurrence_id: string
              p_program_item_id: string
            }
            Returns: Json
          }
      admin_collapse_series_to_one_off_p5: {
        Args: { p_envelope: Json }
        Returns: Json
      }
      admin_convert_event_to_series_p5: {
        Args: { p_event_id: string }
        Returns: Json
      }
      admin_create_api_consumer_v1: {
        Args: {
          p_contact_email: string
          p_name: string
          p_notes?: string
          p_rate_limit?: number
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
      admin_create_occurrence_added_session_v1: {
        Args: {
          p_idempotency_key?: string
          p_occurrence_id: string
          p_payload: Json
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
      admin_create_person_v1: { Args: { p_payload: Json }; Returns: Json }
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
      admin_dancer_cohort_retention_v1: {
        Args: { p_months?: number }
        Returns: {
          cohort_month: string
          cohort_size: number
          month_offset: number
          retained_sessions: number
          retention_rate: number
        }[]
      }
      admin_dashboard_action_queue_v1: { Args: never; Returns: Json }
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
      admin_dashboard_people_health_v1: {
        Args: never
        Returns: {
          archived_count: number
          claimed_count: number
          new_last_28d_by_week: Json
          new_last_7d: number
          role: string
          total_count: number
          with_city_count: number
          with_instagram_count: number
          with_photo_count: number
        }[]
      }
      admin_dashboard_summary: {
        Args: never
        Returns: {
          draft_events_count: number
          events_missing_key_data_count: number
          incomplete_profiles_count: number
          last_event_audit_at: string
          published_events_count: number
          upcoming_events_count: number
        }[]
      }
      admin_delete_city_v1: { Args: { p_city_id: string }; Returns: Json }
      admin_delete_dancer_v1: { Args: { p_user_id: string }; Returns: Json }
      admin_delete_dj_v1: { Args: { p_entity_id: string }; Returns: Json }
      admin_delete_e2e_test_events_v1: { Args: never; Returns: number }
      admin_delete_event_v1: { Args: { p_event_id: string }; Returns: Json }
      admin_delete_facility_option_v1: {
        Args: { p_expected_updated_at: string; p_key: string }
        Returns: undefined
      }
      admin_delete_floor_type_option_v1: {
        Args: { p_expected_updated_at: string; p_key: string }
        Returns: undefined
      }
      admin_delete_occurrence_added_session_v1:
        | { Args: { p_id: string }; Returns: Json }
        | { Args: { p_id: string; p_idempotency_key?: string }; Returns: Json }
      admin_delete_organiser: {
        Args: { p_organiser_entity_id: string }
        Returns: Json
      }
      admin_delete_person_v1: { Args: { p_person_id: string }; Returns: Json }
      admin_delete_promo_code: { Args: { p_id: string }; Returns: undefined }
      admin_delete_series_program_item_v1: {
        Args: { p_item_id: string }
        Returns: Json
      }
      admin_delete_standard_class_session_v1: {
        Args: { p_session_id: string }
        Returns: boolean
      }
      admin_delete_vendor_v1: { Args: { p_entity_id: string }; Returns: Json }
      admin_delete_videographer_v1: {
        Args: { p_entity_id: string }
        Returns: Json
      }
      admin_detach_event_vendor_v1: {
        Args: { p_event_id: string; p_vendor_id: string }
        Returns: Json
      }
      admin_detach_vendor_from_event_v1: {
        Args: { p_event_id: string; p_vendor_id: string }
        Returns: Json
      }
      admin_draw_raffle_winner_v1: {
        Args: { p_event_id: string; p_reason?: string }
        Returns: Json
      }
      admin_duplicate_event_p5: { Args: { p_envelope: Json }; Returns: Json }
      admin_ensure_festival_legacy_bridge_v1: {
        Args: { p_series_id: string }
        Returns: Json
      }
      admin_ensure_series_legacy_bridge_v1: {
        Args: { p_series_id: string }
        Returns: Json
      }
      admin_ensure_series_program_scaffold_v1: {
        Args: { p_series_id: string }
        Returns: Json
      }
      admin_entity_lifecycle: {
        Args: {
          p_action: string
          p_entity_id: string
          p_entity_type: string
          p_reason: string
        }
        Returns: undefined
      }
      admin_error: {
        Args: {
          p_code: string
          p_detail?: string
          p_field?: string
          p_message: string
        }
        Returns: Json
      }
      admin_event_conflicts_v1: { Args: { p_series_id: string }; Returns: Json }
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
      admin_event_funnel_v1: {
        Args: { p_event_id: string; p_window?: string }
        Returns: Json
      }
      admin_event_link_clickout_top_v1: {
        Args: { p_limit?: number; p_window?: string }
        Returns: {
          click_through_rate: number
          event_id: string
          event_name: string
          instagram_clicks: number
          other_clicks: number
          share_clicks: number
          ticket_clicks: number
          total_clicks: number
          views_in_window: number
          whatsapp_clicks: number
        }[]
      }
      admin_event_profile_attribution_v1: {
        Args: { p_event_id: string; p_window?: string }
        Returns: {
          click_through_rate: number
          event_views: number
          person_id: string
          profile_label: string
          profile_type: string
          profile_views: number
        }[]
      }
      admin_event_publish: { Args: { p_event_id: string }; Returns: boolean }
      admin_event_ticket_link_health_v1: {
        Args: { p_window?: string }
        Returns: Json
      }
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
      admin_event_views_by_occurrence_v1: {
        Args: { p_event_id: string; p_window?: string }
        Returns: {
          instance_start: string
          occurrence_id: string
          total_views: number
          unique_sessions: number
        }[]
      }
      admin_event_views_daily_v1: {
        Args: { p_window?: string }
        Returns: {
          distinct_events: number
          total_views: number
          unique_sessions: number
          view_date: string
        }[]
      }
      admin_event_views_top_v1: {
        Args: { p_limit?: number; p_window?: string }
        Returns: {
          event_id: string
          event_name: string
          poster_url: string
          views: number
        }[]
      }
      admin_event_workspace: {
        Args: {
          p_cursor?: string
          p_direction?: string
          p_limit?: number
          p_series_id: string
        }
        Returns: Json
      }
      admin_event_workspace_p5: { Args: { p_series_id: string }; Returns: Json }
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
      admin_get_event_guest_list_config_v1: {
        Args: { p_event_id: string }
        Returns: Json
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
      admin_get_event_vendors_v1: {
        Args: { p_event_id: string }
        Returns: {
          booth_id: string
          booth_location: string
          booth_number: string
          business_name: string
          city: string
          created_at: string
          exhibit_hours: Json
          is_active: boolean
          notes: string
          photo_url: string
          updated_at: string
          vendor_id: string
        }[]
      }
      admin_get_function_body_v1: { Args: { p_name: string }; Returns: Json }
      admin_get_guestlist_standing_exclusion_v1: {
        Args: { p_event_id: string }
        Returns: Json
      }
      admin_get_listing_request_detail_v1: {
        Args: { p_id: string }
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
      admin_get_occurrence_audit_v1: {
        Args: {
          p_days?: number
          p_event_id: string
          p_limit?: number
          p_occurrence_id?: string
        }
        Returns: Json
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
      admin_get_person_v1: { Args: { p_person_id: string }; Returns: Json }
      admin_get_prev_raffle_config_v1: {
        Args: { p_before_date?: string; p_series_key: string }
        Returns: Json
      }
      admin_get_program_tree_v1: { Args: { p_event_id: string }; Returns: Json }
      admin_get_session_overrides_v1: {
        Args: { p_occurrence_id: string }
        Returns: Json
      }
      admin_get_session_people_v1: {
        Args: { p_event_id: string }
        Returns: Json
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
          claimed_email: string
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
          team_count: number
          user_id: string
          verified: boolean
          verified_at: string
          verified_by: string
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
          email: string
          entity_id: string
          facebook: string
          facilities_new: string[]
          faq_json: Json
          floor_type: string
          food_situation: string
          gallery_urls: string[]
          google_maps_link: string
          id: string
          id_required: boolean
          instagram: string
          last_entry_time: string
          lat: number
          late_night_notes: string
          lng: number
          meta_data: Json
          name: string
          opening_hours: Json
          parking_cost_notes: string
          parking_json: Json
          phone: string
          photo_url: string[]
          postcode: string
          publish_state: string
          rules: string[]
          timezone: string
          transport_json: Json
          user_id: string
          venue_rating: number
          video_urls: string[]
          water_situation: string
          website: string
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
      admin_issue_erasure_token_v1: {
        Args: { p_entry_id: string; p_entry_table: string }
        Returns: Json
      }
      admin_link_event_to_organiser_v1: {
        Args: { p_event_id: string; p_organiser_id: string }
        Returns: undefined
      }
      admin_link_program_item_person_v1: {
        Args: {
          p_op: string
          p_profile_id: string
          p_profile_type: string
          p_program_item_id: string
          p_role?: string
          p_sort_order?: number
        }
        Returns: Json
      }
      admin_link_role_to_person_v1: {
        Args: {
          p_person_entity_id: string
          p_profile_id: string
          p_role_type: string
        }
        Returns: Json
      }
      admin_link_session_people_v1: {
        Args: {
          p_action?: string
          p_profile_id: string
          p_profile_type: string
          p_program_item_id: string
          p_role?: string
        }
        Returns: Json
      }
      admin_list_ambassadors_v1: {
        Args: never
        Returns: {
          city_id: string
          city_name: string
          email: string
          joined_at: string
          member_id: string
          user_id: string
        }[]
      }
      admin_list_api_consumers_v1: {
        Args: never
        Returns: {
          contact_email: string
          created_at: string
          id: string
          is_active: boolean
          last_used_at: string
          lifecycle_status: string
          name: string
          notes: string
          prefix: string
          rate_limit_per_minute: number
          revoked_at: string
        }[]
      }
      admin_list_cancellation_reasons_v1: {
        Args: never
        Returns: {
          key: string
          label: string
          sort_order: number
        }[]
      }
      admin_list_contract_checks_v1: { Args: never; Returns: Json }
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
      admin_list_entity_decision_audit_v1: {
        Args: { p_limit?: number; p_target_id?: string; p_target_type?: string }
        Returns: {
          action: string
          actor_email: string
          actor_id: string
          created_at: string
          from_state: string
          id: string
          reason: string
          target_id: string
          target_type: string
          to_state: string
        }[]
      }
      admin_list_entity_members_v1: {
        Args: { p_entity_id: string; p_entity_type: string }
        Returns: {
          email: string
          id: string
          is_primary: boolean
          joined_at: string
          member_role: string
          user_id: string
        }[]
      }
      admin_list_event_occurrences_v1: {
        Args: { p_event_id: string }
        Returns: Json
      }
      admin_list_event_templates_v1: { Args: never; Returns: Json }
      admin_list_facility_options_v1: {
        Args: never
        Returns: {
          aliases: string[]
          dancer_facing: boolean
          display_order: number
          emoji: string
          key: string
          label: string
          updated_at: string
          updated_by: string
          usage_count: number
        }[]
      }
      admin_list_floor_type_options_v1: {
        Args: never
        Returns: {
          aliases: string[]
          display_order: number
          key: string
          label: string
          updated_at: string
          updated_by: string
          usage_count: number
        }[]
      }
      admin_list_future_occurrences_v1: {
        Args: {
          p_event_id: string
          p_from_occurrence_id?: string
          p_limit?: number
        }
        Returns: Json
      }
      admin_list_guest_list_entries_v1: {
        Args: { p_event_id: string; p_occurrence_id?: string }
        Returns: Json
      }
      admin_list_guest_list_events_v1: { Args: never; Returns: Json }
      admin_list_guestlist_standing_v1: { Args: never; Returns: Json }
      admin_list_listing_requests_v1: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_section?: string
          p_stale_only?: boolean
          p_status?: string
        }
        Returns: Json
      }
      admin_list_occurrences_for_event_v1: {
        Args: { p_event_id: string; p_include_past?: boolean; p_limit?: number }
        Returns: Json
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
      admin_list_organiser_profiles_v1: {
        Args: {
          p_include_inactive?: boolean
          p_limit?: number
          p_offset?: number
          p_search?: string
        }
        Returns: {
          avatar_url: string
          city_id: string
          city_name: string
          claimed_by: string
          contact_phone: string
          created_at: string
          has_leader: boolean
          id: string
          instagram: string
          is_active: boolean
          leader_corruption: boolean
          leader_name: string
          linked_event_count: number
          name: string
          organisation_category: string
          team_member_count: number
          updated_at: string
          website: string
        }[]
      }
      admin_list_pending_canonical_keys_v1: {
        Args: { p_kind?: string; p_status?: string }
        Returns: {
          first_seen_at: string
          key: string
          kind: string
          last_seen_at: string
          proposal_count: number
          resolved_at: string
          resolved_by: string
          resolved_to_key: string
          status: string
          venue_ids: string[]
        }[]
      }
      admin_list_pending_review_v1: {
        Args: {
          p_city_id?: string
          p_limit?: number
          p_offset?: number
          p_target_type?: string
        }
        Returns: {
          city_id: string
          city_name: string
          lifecycle_status: string
          name: string
          organiser_ids: string[]
          submitted_at: string
          target_id: string
          target_type: string
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
      admin_list_raffle_draws_v1: {
        Args: { p_event_id: string }
        Returns: Json
      }
      admin_list_raffle_entries_v1: {
        Args: { p_event_id: string }
        Returns: Json
      }
      admin_list_raffle_events_v1: { Args: never; Returns: Json }
      admin_list_raffle_picker_events_v1: {
        Args: { p_days_ahead?: number }
        Returns: Json
      }
      admin_list_raffle_picker_events_v2: {
        Args: { p_days_ahead?: number }
        Returns: Json
      }
      admin_list_raffle_presets_v1: {
        Args: { p_include_archived?: boolean }
        Returns: {
          consent_version: string
          created_at: string
          cutoff_offset_minutes: number
          id: string
          is_archived: boolean
          name: string
          prize_text: string
          show_winner_publicly: boolean
          slug: string
          total_usage_count: number
          updated_at: string
          usage_count: number
        }[]
      }
      admin_list_series_upcoming_event_ids_v1: {
        Args: { p_event_id: string }
        Returns: Json
      }
      admin_list_vendor_team_members_v1: {
        Args: { p_vendor_id: string }
        Returns: {
          avatar_url: string
          based_city_id: string
          city_name: string
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          is_leader: boolean
          member_profile_id: string
          role: string
          updated_at: string
          vendor_id: string
        }[]
      }
      admin_list_vendors_v1: {
        Args: { p_limit?: number; p_offset?: number; p_query?: string }
        Returns: {
          business_name: string
          city: string
          city_id: string
          claimed_email: string
          country: string
          display_name: string
          id: string
          is_active: boolean
          photo_url: string
          team_count: number
          user_id: string
          verified: boolean
        }[]
      }
      admin_list_venue_picker_options_v1: {
        Args: never
        Returns: {
          city_name: string
          id: string
          name: string
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
      admin_list_venues_v2: {
        Args: { p_limit?: number; p_offset?: number; p_query?: string }
        Returns: {
          address: string
          bar_available: boolean
          capacity: number
          city: string
          city_id: string
          cloakroom_available: boolean
          country: string
          created_at: string
          description: string
          display_name: string
          entity_id: string
          facilities_count: number
          facilities_new: string[]
          floor_type: string
          google_maps_link: string
          has_address: boolean
          has_facilities_min_3: boolean
          has_food_situation: boolean
          has_opening_hours: boolean
          has_parking: boolean
          has_photo: boolean
          has_transport: boolean
          has_water_situation: boolean
          id: string
          id_required: boolean
          is_active: boolean
          lat: number
          lng: number
          name: string
          opening_hours: Json
          parking_json: Json
          photo_url: string
          postcode: string
          publish_state: string
          total_score: number
          transport_json: Json
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
      admin_listing_request_kpis_v1: { Args: never; Returns: Json }
      admin_log_action: {
        Args: {
          p_action_category: string
          p_duration_ms?: number
          p_entity_display_name: string
          p_entity_id: string
          p_entity_type: string
          p_error_code?: string
          p_error_message?: string
          p_params: Json
          p_rpc_name: string
          p_snapshot_before: Json
          p_success: boolean
        }
        Returns: undefined
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
      admin_log_raffle_winner_contact_v1: {
        Args: {
          p_channel?: string
          p_draw_id: string
          p_note?: string
          p_outcome: string
        }
        Returns: Json
      }
      admin_log_raffle_winner_v1: {
        Args: { p_entry_id: string; p_note?: string }
        Returns: Json
      }
      admin_log_venue_coords_failure_v1: {
        Args: { p_reason: string; p_source: string; p_venue_id: string }
        Returns: Json
      }
      admin_manual_add_guest_list_entry_v1: {
        Args: {
          p_event_id: string
          p_first_name: string
          p_occurrence_id?: string
        }
        Returns: Json
      }
      admin_manual_add_raffle_entry_v1: {
        Args: {
          p_comp_note?: string
          p_event_id: string
          p_first_name: string
          p_phone_e164: string
        }
        Returns: Json
      }
      admin_mark_event_promoted_v1: {
        Args: { p_channel?: string; p_event_id: string; p_note?: string }
        Returns: Json
      }
      admin_mark_raffle_entry_eligible_v1: {
        Args: { p_entry_id: string }
        Returns: Json
      }
      admin_mark_raffle_entry_ineligible_v1: {
        Args: { p_entry_id: string; p_notes?: string; p_reason: string }
        Returns: Json
      }
      admin_mark_request_contacted_v1: {
        Args: { p_id: string; p_method?: string; p_note?: string }
        Returns: Json
      }
      admin_merge_person_entities_v1: {
        Args: { p_from_id: string; p_into_id: string }
        Returns: Json
      }
      admin_merge_venues_v1: {
        Args: {
          p_audit_reason?: string
          p_dry_run?: boolean
          p_source_venue_id: string
          p_target_venue_id: string
        }
        Returns: Json
      }
      admin_normalize_name: { Args: { p_name: string }; Returns: string }
      admin_organiser_card_clicks_summary_v1: {
        Args: { p_days?: number; p_organiser_id: string }
        Returns: Json
      }
      admin_organiser_run_stats_v1: {
        Args: { p_organiser_id: string }
        Returns: Json
      }
      admin_override_raffle_eligibility_v1: {
        Args: { p_entry_id: string; p_override: boolean; p_reason?: string }
        Returns: Json
      }
      admin_people_audit: {
        Args: never
        Returns: {
          linked: number
          orphan: number
          role: string
          role_only: number
        }[]
      }
      admin_person_activity_v1: {
        Args: {
          p_profile_id: string
          p_profile_type?: string
          p_window_days?: number
        }
        Returns: Json
      }
      admin_person_appearance_stats_v1: {
        Args: { p_profile_id: string; p_profile_type?: string }
        Returns: Json
      }
      admin_person_coperformance_network_v1: {
        Args: { p_profile_id: string; p_profile_type?: string }
        Returns: Json
      }
      admin_person_venue_network_v1: {
        Args: { p_profile_id: string; p_profile_type?: string }
        Returns: Json
      }
      admin_pick_raffle_winner_v1: {
        Args: { p_entry_id: string; p_event_id: string; p_reason?: string }
        Returns: Json
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
      admin_profile_views_top_v1: {
        Args: { p_limit?: number; p_window?: string }
        Returns: {
          avatar_url: string
          display_name: string
          last_viewed: string
          person_id: string
          profile_type: string
          views: number
        }[]
      }
      admin_promote_pending_facility_v1: {
        Args: {
          p_apply_to_venues?: boolean
          p_dancer_facing?: boolean
          p_display_order?: number
          p_emoji?: string
          p_key: string
          p_label: string
        }
        Returns: undefined
      }
      admin_promote_pending_floor_type_v1: {
        Args: {
          p_apply_to_venues?: boolean
          p_display_order?: number
          p_key: string
          p_label: string
        }
        Returns: undefined
      }
      admin_promote_waitlist_guest_list_entry_v1: {
        Args: { p_entry_id: string }
        Returns: Json
      }
      admin_promote_waitlist_raffle_entry_v1: {
        Args: { p_entry_id: string }
        Returns: Json
      }
      admin_promotion_radar_v1: {
        Args: { p_horizon_days?: number; p_window?: string }
        Returns: {
          clicks_window: number
          cover_url: string
          ctr: number
          days_since_promoted: number
          days_until: number
          engagement_score: number
          event_id: string
          event_kind: string
          is_ready: boolean
          last_promoted_at: string
          missing: string[]
          name: string
          next_occurrence_at: string
          priority_score: number
          staleness_score: number
          urgency_score: number
          views_window: number
        }[]
      }
      admin_publish_custom_date_series_v1: {
        Args: { p_occurrences: Json; p_series_id: string }
        Returns: Json
      }
      admin_recent_program_people_v1: {
        Args: { p_limit?: number; p_profile_type: string }
        Returns: Json
      }
      admin_record_merge_decision_v1: {
        Args: {
          p_decision: string
          p_notes?: string
          p_profile_id_a: string
          p_profile_id_b: string
          p_source_table_a: string
          p_source_table_b: string
        }
        Returns: {
          created_at: string | null
          decided_at: string | null
          decided_by: string | null
          decision: string | null
          id: string
          notes: string | null
          profile_id_a: string
          profile_id_b: string
          source_table_a: string
          source_table_b: string
        }
        SetofOptions: {
          from: "*"
          to: "person_merge_decisions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_record_pending_facility_keys_v1: {
        Args: { p_keys: string[] }
        Returns: number
      }
      admin_reject_entity_v1: {
        Args: { p_reason: string; p_target_id: string; p_target_type: string }
        Returns: Json
      }
      admin_reject_pending_canonical_key_v1: {
        Args: { p_key: string; p_kind: string }
        Returns: undefined
      }
      admin_remove_entity_member_v1: {
        Args: { p_member_id: string }
        Returns: Json
      }
      admin_remove_vendor_team_member_v1: {
        Args: { p_member_profile_id: string; p_vendor_id: string }
        Returns: Json
      }
      admin_rename_person_v1: {
        Args: { p_name: string; p_person_entity_id: string }
        Returns: Json
      }
      admin_reorder_program_item_v1: {
        Args: { p_direction: number; p_program_item_id: string }
        Returns: Json
      }
      admin_reset_occurrence_v1: {
        Args: {
          p_apply_to?: string
          p_idempotency_key?: string
          p_occurrence_id: string
        }
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
      admin_restore_raffle_preset_v1: {
        Args: { p_preset_id: string }
        Returns: Json
      }
      admin_reveal_guest_phone_v1: {
        Args: { p_entry_id: string }
        Returns: Json
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
      admin_revoke_api_consumer_v1: { Args: { p_id: string }; Returns: Json }
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
      admin_run_phase5_backfill_v1: { Args: never; Returns: Json }
      admin_save_city_aliases_v1: {
        Args: { p_aliases: string[]; p_city_id: string }
        Returns: Json
      }
      admin_save_city_v1: { Args: { p_payload: Json }; Returns: Json }
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
      admin_save_event_guest_list_config_v1: {
        Args: {
          p_capacity_max?: number
          p_config: Json
          p_event_id: string
          p_has_guestlist: boolean
          p_waitlist_enabled?: boolean
        }
        Returns: Json
      }
      admin_save_event_program_v1: {
        Args: {
          p_event_id: string
          p_event_payload: Json
          p_expected_updated_at: string
          p_idempotency_token: string
          p_payload_version: number
          p_session_people?: Json
        }
        Returns: Json
      }
      admin_save_event_v2: { Args: { p_payload: Json }; Returns: Json }
      admin_save_event_v2_impl: { Args: { p_payload: Json }; Returns: Json }
      admin_save_facility_option_v1: {
        Args: {
          p_aliases: string[]
          p_dancer_facing: boolean
          p_display_order: number
          p_emoji: string
          p_expected_updated_at: string
          p_key: string
          p_label: string
        }
        Returns: string
      }
      admin_save_floor_type_option_v1: {
        Args: {
          p_aliases: string[]
          p_display_order: number
          p_expected_updated_at: string
          p_key: string
          p_label: string
        }
        Returns: string
      }
      admin_save_guestlist_standing_v1: {
        Args: { p_names: string[] }
        Returns: Json
      }
      admin_save_occurrence_full_v1: {
        Args: {
          p_idempotency_key?: string
          p_occurrence_id: string
          p_payload: Json
        }
        Returns: Json
      }
      admin_save_occurrence_identity_p5_v1: {
        Args: { p_occurrence_id: string; p_patch: Json }
        Returns: Json
      }
      admin_save_occurrence_v1: {
        Args: {
          p_apply_to?: string
          p_idempotency_key?: string
          p_occurrence_id: string
          p_patch: Json
        }
        Returns: Json
      }
      admin_save_organiser_v1: {
        Args: {
          p_avatar_url?: string
          p_city_id?: string
          p_claimed_by?: string
          p_contact_phone?: string
          p_founded_year?: number
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
      admin_save_person_v1: {
        Args: { p_payload: Json; p_person_id: string }
        Returns: Json
      }
      admin_save_program_v2: {
        Args: {
          p_event_id: string
          p_event_payload: Json
          p_expected_updated_at: string
          p_idempotency_token: string
          p_payload_version: number
          p_program_tree?: Json
          p_session_people?: Json
          p_session_people_mode?: string
        }
        Returns: Json
      }
      admin_save_promo_code_v1: {
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
      admin_save_raffle_preset_v1: {
        Args: {
          p_consent_version?: string
          p_cutoff_offset_minutes?: number
          p_id?: string
          p_name?: string
          p_prize_text?: string
          p_show_winner_publicly?: boolean
          p_slug?: string
        }
        Returns: Json
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
      admin_seam_writer_candidates_v1: {
        Args: { p_columns: string[]; p_tables: string[] }
        Returns: Json
      }
      admin_search_events: {
        Args: { p_limit?: number; p_search_term: string }
        Returns: {
          id: string
          is_published: boolean
          name: string
          schedule_type: string
          start_time: string
        }[]
      }
      admin_search_orgs_v1: {
        Args: {
          p_include_inactive?: boolean
          p_limit?: number
          p_offset?: number
          p_query?: string
        }
        Returns: {
          avatar_url: string
          city_id: string
          id: string
          is_active: boolean
          lifecycle_status: string
          name: string
          slug: string
        }[]
      }
      admin_search_people_v1: {
        Args: {
          p_exclude_program_item_id?: string
          p_include_archived?: boolean
          p_limit?: number
          p_mode?: string
          p_offset?: number
          p_query?: string
          p_role?: string
        }
        Returns: {
          archived_at: string
          avatar_url: string
          based_city_id: string
          claimed_by: string
          created_at: string
          display_name: string
          first_name: string
          id: string
          is_active: boolean
          nationality: string
          photo_url: string
          profile_type: string
          roles: string[]
          surname: string
          updated_at: string
        }[]
      }
      admin_search_queries_top_v1: {
        Args: { p_limit?: number; p_window?: string; p_zero_only?: boolean }
        Returns: {
          avg_results: number
          last_searched_at: string
          normalized_query: string
          total_searches: number
          unique_sessions: number
        }[]
      }
      admin_search_queries_zero_with_city_v1: {
        Args: { p_limit?: number; p_window?: string }
        Returns: {
          city_id: string
          city_is_active: boolean
          city_name: string
          city_slug: string
          expansion_signal: boolean
          last_searched_at: string
          normalized_query: string
          total_searches: number
          unique_sessions: number
        }[]
      }
      admin_series_occurrence_stats_v1: {
        Args: { p_series_id: string }
        Returns: Json
      }
      admin_set_added_session_people_v1:
        | { Args: { p_id: string; p_people: Json }; Returns: Json }
        | {
            Args: { p_id: string; p_idempotency_key?: string; p_people: Json }
            Returns: Json
          }
      admin_set_event_rooms_v1: {
        Args: { p_event_id: string; p_rooms: Json }
        Returns: Json
      }
      admin_set_event_vendor_v1: {
        Args: { p_booth?: Json; p_event_id: string; p_vendor_id: string }
        Returns: Json
      }
      admin_set_feature_flag_v1: {
        Args: { p_enabled: boolean; p_key: string }
        Returns: Json
      }
      admin_set_festival_group_chat_url_v1: {
        Args: { p_series_id: string; p_url: string }
        Returns: Json
      }
      admin_set_guestlist_standing_exclusion_v1: {
        Args: { p_event_id: string; p_excluded: boolean }
        Returns: Json
      }
      admin_set_occurrence_cancellation_v1: {
        Args: {
          p_apply_to?: string
          p_cancelled: boolean
          p_idempotency_key?: string
          p_occurrence_id: string
          p_reason?: string
          p_reason_category?: string
        }
        Returns: Json
      }
      admin_set_occurrence_override_v1: {
        Args: {
          p_apply_to?: string
          p_idempotency_key?: string
          p_occurrence_id: string
          p_patch: Json
        }
        Returns: Json
      }
      admin_set_occurrence_time_v1: {
        Args: {
          p_apply_to?: string
          p_idempotency_key?: string
          p_instance_end: string
          p_instance_start: string
          p_occurrence_id: string
        }
        Returns: Json
      }
      admin_set_occurrence_venue_v1: {
        Args: {
          p_apply_to?: string
          p_idempotency_key?: string
          p_occurrence_id: string
          p_venue_id: string
        }
        Returns: Json
      }
      admin_set_organiser_lifecycle_v1: {
        Args: { p_organiser_id: string; p_status: string }
        Returns: Json
      }
      admin_set_parallel_group_v1: {
        Args: {
          p_event_id: string
          p_legacy_ids: string[]
          p_parallel_group_id: string
        }
        Returns: Json
      }
      admin_set_series_lifecycle_v1: {
        Args: { p_series_id: string; p_status: string }
        Returns: Json
      }
      admin_set_session_attribute_override_v1: {
        Args: {
          p_idempotency_key?: string
          p_occurrence_id: string
          p_patch: Json
          p_program_item_id: string
        }
        Returns: Json
      }
      admin_set_session_person_override_v1: {
        Args: {
          p_idempotency_key?: string
          p_occurrence_id: string
          p_op: string
          p_payload: Json
          p_program_item_id: string
        }
        Returns: Json
      }
      admin_set_vendor_team_v1: {
        Args: { p_members?: Json; p_vendor_id: string }
        Returns: {
          avatar_url: string
          based_city_id: string
          city_name: string
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          is_leader: boolean
          member_profile_id: string
          role: string
          updated_at: string
          vendor_id: string
        }[]
      }
      admin_set_vendor_verified_v1: {
        Args: { p_vendor_id: string; p_verified: boolean }
        Returns: {
          id: string
          verified: boolean
          verified_at: string
          verified_by: string
          verified_by_email: string
          verified_by_name: string
        }[]
      }
      admin_set_venue_coords_v1: {
        Args: {
          p_lat: number
          p_lng: number
          p_source: string
          p_venue_id: string
        }
        Returns: Json
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
      admin_soft_delete_guest_list_entry_v1: {
        Args: { p_entry_id: string; p_reason?: string }
        Returns: Json
      }
      admin_soft_delete_raffle_entry_v1: {
        Args: { p_entry_id: string; p_reason?: string }
        Returns: Json
      }
      admin_start_onboarding_v1: { Args: { p_id: string }; Returns: Json }
      admin_success: { Args: { p_data?: Json }; Returns: Json }
      admin_suggest_event_teachers_v1: {
        Args: { p_event_title: string; p_limit?: number }
        Returns: Json
      }
      admin_sync_event_links_to_event_row: {
        Args: { p_event_id: string }
        Returns: Json
      }
      admin_unarchive_event_v1: { Args: { p_event_id: string }; Returns: Json }
      admin_unarchive_person_v1: {
        Args: { p_person_id: string }
        Returns: Json
      }
      admin_undo_action_v1: {
        Args: { p_audit_id: number; p_idempotency_key?: string }
        Returns: Json
      }
      admin_unlink_event_from_organiser_v1: {
        Args: { p_event_id: string; p_organiser_id: string }
        Returns: undefined
      }
      admin_unlink_role_from_person_v1: {
        Args: {
          p_person_entity_id: string
          p_profile_id: string
          p_role: string
        }
        Returns: Json
      }
      admin_unlog_raffle_winner_v1: {
        Args: { p_entry_id: string }
        Returns: Json
      }
      admin_update_listing_request_status_v1: {
        Args: { p_id: string; p_note?: string; p_status: string }
        Returns: Json
      }
      admin_update_my_notes: { Args: { p_notes: string }; Returns: Json }
      admin_update_occurrence_added_session_v1:
        | { Args: { p_id: string; p_patch: Json }; Returns: Json }
        | {
            Args: { p_id: string; p_idempotency_key?: string; p_patch: Json }
            Returns: Json
          }
      admin_update_program_item_v1: {
        Args: { p_item_id: string; p_updates: Json }
        Returns: Json
      }
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
      admin_update_series_fields_v1: {
        Args: { p_legacy_event_id: string; p_updates: Json }
        Returns: Json
      }
      admin_update_session_person_role_v1: {
        Args: {
          p_profile_id: string
          p_profile_type: string
          p_program_item_id: string
          p_role: string
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
      admin_upsert_standard_class_session_v1: {
        Args: {
          p_end_time: string
          p_event_id: string
          p_legacy_id: string
          p_levels: string[]
          p_session_id: string
          p_start_time: string
          p_title: string
          p_type: string
        }
        Returns: string
      }
      admin_vendor_link_clickout_top_v1: {
        Args: { p_limit?: number; p_window?: string }
        Returns: {
          business_name: string
          facebook_clicks: number
          instagram_clicks: number
          other_clicks: number
          promo_copy_clicks: number
          public_email_clicks: number
          share_clicks: number
          total_clicks: number
          vendor_id: string
          website_clicks: number
          whatsapp_clicks: number
        }[]
      }
      admin_venue_completeness_v1: {
        Args: { p_entity_id: string }
        Returns: Json
      }
      admin_venue_people_network_v1: {
        Args: { p_venue_id: string }
        Returns: Json
      }
      admin_venue_snapshot_v1: { Args: { p_venue_id: string }; Returns: Json }
      apply_4tier_rls: {
        Args: {
          p_city_col: string
          p_entity_type: string
          p_id_col: string
          p_lifecycle_col: string
          p_preserve_open_when_off?: boolean
          p_table: string
        }
        Returns: undefined
      }
      apply_aggregate_write_p5: { Args: { p_envelope: Json }; Returns: Json }
      approve_city_request: {
        Args: {
          p_country_code?: string
          p_request_id: string
          p_timezone?: string
        }
        Returns: Json
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
      calendar_occurrence_has_overrides_v1: {
        Args: { p_occurrence_id: string }
        Returns: boolean
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
      check_admin_list_occurrences_null_venue_tolerance_v1: {
        Args: never
        Returns: Json
      }
      check_admin_secdef_contract_v1: { Args: never; Returns: Json }
      check_anon_grants_contract_v1: { Args: never; Returns: Json }
      check_arc_gates_v1: { Args: never; Returns: Json }
      check_cancelled_occurrence_visibility_v1: { Args: never; Returns: Json }
      check_command_audit_health_v1: { Args: never; Returns: Json }
      check_dancer_profiles_legacy_col_drift_v3: { Args: never; Returns: Json }
      check_entry_liveness_contract_v1: { Args: never; Returns: Json }
      check_epp_avatar_url_drift_v1: { Args: never; Returns: Json }
      check_epp_display_name_drift_v1: { Args: never; Returns: Json }
      check_epp_resolver_parity_v1: { Args: never; Returns: Json }
      check_event_attendees_fk_target_v1: { Args: never; Returns: Json }
      check_event_detail_organiser_resolves_v1: { Args: never; Returns: Json }
      check_event_editor_surface_drift_v1: { Args: never; Returns: Json }
      check_event_link_canonical_v1: { Args: never; Returns: Json }
      check_event_organiser_drift_v1: { Args: never; Returns: Json }
      check_event_program_duration_contract_v1: { Args: never; Returns: Json }
      check_event_program_people_display_name_contract_v1: {
        Args: never
        Returns: Json
      }
      check_event_program_room_contract_v1: { Args: never; Returns: Json }
      check_event_program_section_consistency_v1: { Args: never; Returns: Json }
      check_event_series_p5_slug_presence_v1: { Args: never; Returns: Json }
      check_event_tracking_health_v1: { Args: never; Returns: Json }
      check_events_time_constraint_health_v1: { Args: never; Returns: Json }
      check_festival_occurrence_span_v1: { Args: never; Returns: Json }
      check_festival_publish_readiness_v1: {
        Args: { p_series_id?: string }
        Returns: Json
      }
      check_festival_socials_p5_sourced_v1: { Args: never; Returns: Json }
      check_finite_course_phantom_tail_v1: { Args: never; Returns: Json }
      check_fk_indexes_v1: { Args: never; Returns: Json }
      check_get_calendar_events_v2_parity_v1: {
        Args: {
          p_city_slug?: string
          p_include_past?: boolean
          p_range_end?: string
          p_range_start?: string
          p_sample_size?: number
        }
        Returns: Json
      }
      check_get_latest_events_v2_parity_v1: {
        Args: { p_city_slug?: string; p_limit?: number; p_sample_size?: number }
        Returns: Json
      }
      check_get_public_events_list_v2_parity_v1: {
        Args: {
          p_city_slug?: string
          p_from_date?: string
          p_limit?: number
          p_sample_size?: number
          p_to_date?: string
        }
        Returns: Json
      }
      check_guest_entries_contract_v1: { Args: never; Returns: Json }
      check_guest_list_contract_v1: { Args: never; Returns: Json }
      check_idempotency_key_uniqueness_v1: { Args: never; Returns: Json }
      check_legacy_p5_orphan_drift_v1: { Args: never; Returns: Json }
      check_live_series_occurrence_horizon_v1: {
        Args: { p_threshold_days?: number }
        Returns: Json
      }
      check_merged_person_credits_v1: { Args: never; Returns: Json }
      check_migration_stamp_drift_v1: { Args: never; Returns: Json }
      check_my_profile_dedup_v1: {
        Args: { p_field: string; p_value: string }
        Returns: Json
      }
      check_no_materialised_utc_miscast_v1: { Args: never; Returns: Json }
      check_occurrence_added_session_contract_v1: { Args: never; Returns: Json }
      check_occurrence_instance_end_canonical_v1: { Args: never; Returns: Json }
      check_occurrence_instance_time_canonical_v1: {
        Args: never
        Returns: Json
      }
      check_occurrence_integrity_v1: { Args: never; Returns: Json }
      check_occurrence_p5_materialised_canonical_v1: {
        Args: never
        Returns: Json
      }
      check_occurrence_p5_unmaterialised_v1: { Args: never; Returns: Json }
      check_occurrence_program_format_v1: { Args: never; Returns: Json }
      check_occurrence_program_parity_v1: { Args: never; Returns: Json }
      check_occurrence_time_stamping_convention_v1: {
        Args: never
        Returns: Json
      }
      check_occurrence_venue_contract_v1: { Args: never; Returns: Json }
      check_og_render_health_v1: { Args: never; Returns: Json }
      check_organiser_display_name_drift_v1: { Args: never; Returns: Json }
      check_organiser_link_contract_v1: { Args: never; Returns: Json }
      check_override_mirror_ghost_v1: { Args: never; Returns: Json }
      check_override_payload_contract_v1: { Args: never; Returns: Json }
      check_override_payload_identity_sync_v1: { Args: never; Returns: Json }
      check_p5_legacy_added_session_parity_v1: { Args: never; Returns: Json }
      check_p5_legacy_date_sync_v1: { Args: never; Returns: Json }
      check_p5_legacy_program_drift_v1: { Args: never; Returns: Json }
      check_p5_legacy_program_parity_v1: { Args: never; Returns: Json }
      check_p5_orphan_series_v1: { Args: never; Returns: Json }
      check_p5_public_read_contract_v1: { Args: never; Returns: Json }
      check_p5_session_override_parity_v1: { Args: never; Returns: Json }
      check_parallel_group_contract_v1: { Args: never; Returns: Json }
      check_people_public_read_contract_v1: { Args: never; Returns: Json }
      check_per_date_program_canonical_consistency_v1: {
        Args: never
        Returns: Json
      }
      check_person_identity_drift_v1: { Args: never; Returns: Json }
      check_person_identity_foundation_v1: { Args: never; Returns: Json }
      check_person_substrate_consistency_v1: { Args: never; Returns: Json }
      check_phase5_1_schema_conformance_v1: { Args: never; Returns: Json }
      check_phase5_backfill_drift_v1: { Args: never; Returns: Json }
      check_program_data_store_drift_v1: { Args: never; Returns: Json }
      check_program_day_integrity_v1: { Args: never; Returns: Json }
      check_program_items_day_section_nullability_v1: {
        Args: never
        Returns: Json
      }
      check_program_people_role_contract_v1: { Args: never; Returns: Json }
      check_program_room_contract_v1: { Args: never; Returns: Json }
      check_program_save_v2_idempotency_v1: { Args: never; Returns: Json }
      check_public_time_pairing_contract_v1: { Args: never; Returns: Json }
      check_published_event_has_organiser_v1: { Args: never; Returns: Json }
      check_pure_p5_public_leak_v1: { Args: never; Returns: Json }
      check_raffle_capacity_contract_v1: { Args: never; Returns: Json }
      check_raffle_draw_snapshot_contract_v1: { Args: never; Returns: Json }
      check_raffle_winners_contract_v1: { Args: never; Returns: Json }
      check_replace_event_program_canvas_consistency_v1: {
        Args: never
        Returns: Json
      }
      check_reverse_orphan_occurrence_v1: { Args: never; Returns: Json }
      check_rpc_body_v1: { Args: { p_name: string }; Returns: Json }
      check_search_public_v4_parity_v1: {
        Args: {
          p_city_slug?: string
          p_include_past?: boolean
          p_query: string
          p_section_limit?: number
        }
        Returns: Json
      }
      check_search_public_v5_contract_v1: { Args: never; Returns: Json }
      check_security_phase2_3_policies_v1: { Args: never; Returns: Json }
      check_self_serve_contract_v1: { Args: never; Returns: Json }
      check_series_materialisation_contract_v1: { Args: never; Returns: Json }
      check_series_organiser_junction_parity_v1: { Args: never; Returns: Json }
      check_session_override_contract_v1: { Args: never; Returns: Json }
      check_session_override_mirror_parity_v1: { Args: never; Returns: Json }
      check_session_override_people_mirror_v1: { Args: never; Returns: Json }
      check_session_people_display_name_contract_v1: {
        Args: never
        Returns: Json
      }
      check_slug_resolver_p5_parity_v1: { Args: never; Returns: Json }
      check_teacher_dj_assignment_integrity_v1: { Args: never; Returns: Json }
      check_unmigrated_schema_changes_contract_v1: {
        Args: never
        Returns: Json
      }
      check_vendor_contract_v1: { Args: never; Returns: Json }
      check_vendor_link_consistency_v1: { Args: never; Returns: Json }
      check_vendor_team_contract_v1: { Args: never; Returns: Json }
      check_venue_coords_contract_v1: { Args: never; Returns: Json }
      check_venue_publish_gate_contract_v1: { Args: never; Returns: Json }
      claim_dancer_profile: { Args: { p_dancer_id: string }; Returns: string }
      claim_organiser_v1: {
        Args: { p_listing_request_id?: string; p_organiser_id: string }
        Returns: Json
      }
      claim_vendor_profile_for_current_user: {
        Args: { p_vendor_id: string }
        Returns: string
      }
      claim_vendor_v1: { Args: { p_vendor_id: string }; Returns: Json }
      cleanup_occurrence_write_audit: {
        Args: { p_retain_days?: number }
        Returns: number
      }
      compute_event_times_from_program_v1: {
        Args: { p_anchor_date: string; p_event: Json }
        Returns: Json
      }
      dancer_completeness: { Args: { p_user_id: string }; Returns: Json }
      dancer_erase_guest_entry_v1: { Args: { p_token: string }; Returns: Json }
      dancer_export_my_guest_entries_v1: {
        Args: { p_token: string }
        Returns: Json
      }
      dashboard_events_summary_dto: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: Json[]
      }
      debug_delete_test: { Args: { p_event_id: string }; Returns: Json }
      debug_name_test: { Args: { p_payload: Json }; Returns: Json }
      delete_venue_admin: {
        Args: { actor_user_id: string; p_entity_id: string }
        Returns: Json
      }
      derive_event_key_times_v1: {
        Args: { p_event_id: string; p_occurrence_id?: string }
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
      enumerate_series_dates_v1: {
        Args: { p_series_id: string; p_until: string }
        Returns: {
          occurrence_index: number
          occurrence_local_date: string
        }[]
      }
      event_program_room_drift_repair_queue_v1: { Args: never; Returns: Json }
      event_publish_readiness_v1: {
        Args: { p_event_id?: string; p_series_id: string }
        Returns: Json
      }
      event_view_p5: {
        Args: { p_target: Json; p_viewer?: Json }
        Returns: Json
      }
      find_venue_duplicates_v1: {
        Args: {
          p_country_code?: string
          p_exclude_entity_id?: string
          p_instagram?: string
          p_lat?: number
          p_lng?: number
          p_name?: string
        }
        Returns: {
          address: string
          city: string
          country: string
          distance_meters: number
          entity_id: string
          instagram: string
          match_reason: string
          match_score: number
          venue_name: string
        }[]
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
      get_all_profiles_v1: {
        Args: never
        Returns: {
          bio: string
          city_id: string
          city_name: string
          country_code: string
          display_name: string
          instagram: string
          is_active: boolean
          is_verified: boolean
          nationality: string
          person_entity_id: string
          photo_url: string
          profile_id: string
          role: string
          specialties: string[]
          website: string
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
          city_slug_param?: string
          p_include_past?: boolean
          range_end: string
          range_start: string
        }
        Returns: {
          category: string
          city_slug: string
          city_timezone: string
          class_end: string
          class_start: string
          cover_image_url: string
          end_time: string
          event_id: string
          format: string
          has_class: boolean
          has_party: boolean
          instance_date: string
          is_recurring: boolean
          key_times: Json
          location: string
          meta_data: Json
          name: string
          occurrence_ends_at: string
          occurrence_id: string
          occurrence_starts_at: string
          party_end: string
          party_start: string
          photo_url: string[]
          primary_organiser_name: string
          start_time: string
          type: string
          venue_lat: number
          venue_lng: number
        }[]
      }
      get_calendar_events_v2: {
        Args: {
          city_slug_param?: string
          p_include_past?: boolean
          range_end: string
          range_start: string
        }
        Returns: {
          cancellation_reason_label: string
          category: string
          city_slug: string
          city_timezone: string
          class_end: string
          class_start: string
          cover_image_url: string
          end_time: string
          event_id: string
          format: string
          has_class: boolean
          has_party: boolean
          instance_date: string
          is_cancelled: boolean
          is_recurring: boolean
          key_times: Json
          location: string
          meta_data: Json
          name: string
          occurrence_ends_at: string
          occurrence_id: string
          occurrence_starts_at: string
          original_class_end: string
          original_class_start: string
          original_party_end: string
          original_party_start: string
          party_end: string
          party_start: string
          photo_url: string[]
          primary_organiser_name: string
          slug: string
          start_time: string
          type: string
          venue_lat: number
          venue_lng: number
        }[]
      }
      get_current_user_organiser_entity_ids_v1: {
        Args: never
        Returns: {
          entity_id: string
        }[]
      }
      get_current_user_organiser_ids: { Args: never; Returns: string[] }
      get_current_user_vendor_ids_v1: {
        Args: never
        Returns: {
          vendor_id: string
        }[]
      }
      get_decrypted_secret: { Args: { secret_name: string }; Returns: string }
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
      get_event_attendance_counts: {
        Args: { p_event_ids: string[] }
        Returns: {
          event_id: string
          going_count: number
          interested_count: number
        }[]
      }
      get_event_attendance_counts_by_range: {
        Args: { p_city_slug?: string; p_from: string; p_to: string }
        Returns: {
          event_id: string
          going_count: number
        }[]
      }
      get_event_engagement: {
        Args: { p_event_id: string }
        Returns: {
          going_count: number
          interested_count: number
        }[]
      }
      get_event_guest_list: { Args: { p_event_id: string }; Returns: Json }
      get_event_page_detail: {
        Args: { p_event_id: string }
        Returns: {
          attendance: Json
          attendee_preview: Json
          balance: Json
          description: Json
          djs: Json
          event: Json
          occurrence: Json
          organiser: Json
          schedule: Json
          teachers: Json
          venue: Json
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
      get_event_program_sections_v1: {
        Args: { p_event_id: string }
        Returns: Json
      }
      get_event_program_v1: { Args: { p_event_id: string }; Returns: Json }
      get_event_raffle: {
        Args: { p_event_id: string; p_session_id?: string }
        Returns: Json
      }
      get_event_rooms_v1: { Args: { p_event_id: string }; Returns: Json }
      get_festival_attendance: { Args: { p_event_id: string }; Returns: Json }
      get_festival_attendance_batch: {
        Args: { p_event_ids: string[] }
        Returns: Json
      }
      get_latest_events_v1: {
        Args: { p_city_slug?: string; p_limit?: number }
        Returns: {
          category: string
          city_slug: string
          city_timezone: string
          cover_image_url: string
          created_at: string
          event_id: string
          format: string
          has_class: boolean
          has_party: boolean
          instance_date: string
          location: string
          name: string
          occurrence_id: string
          photo_url: string[]
          type: string
        }[]
      }
      get_latest_events_v2: {
        Args: { p_city_slug?: string; p_limit?: number }
        Returns: {
          city_slug: string
          city_timezone: string
          cover_image_url: string
          created_at: string
          event_id: string
          freshness_kind: string
          has_class: boolean
          has_party: boolean
          instance_date: string
          location: string
          name: string
          occurrence_id: string
          photo_url: string[]
          type: string
        }[]
      }
      get_map_events_v1: {
        Args: {
          city_slug_param?: string
          range_end?: string
          range_start?: string
        }
        Returns: {
          area: string
          cancellation_reason_label: string
          category: string
          city_slug: string
          class_end: string
          class_start: string
          cover_image_url: string
          created_at: string
          end_time: string
          event_id: string
          format: string
          freshness_kind: string
          has_class: boolean
          has_party: boolean
          instance_date: string
          is_cancelled: boolean
          lat: number
          lng: number
          name: string
          occurrence_id: string
          party_end: string
          party_start: string
          slug: string
          start_time: string
          type: string
          updated_at: string
          venue_name: string
        }[]
      }
      get_my_event_attendance_v1: {
        Args: never
        Returns: {
          event_id: string
          status: string
          updated_at: string
        }[]
      }
      get_occurrence_override_program_v1: {
        Args: { p_occurrence_id: string }
        Returns: Json
      }
      get_occurrence_program_v1: {
        Args: { p_occurrence_id: string }
        Returns: Json
      }
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
      get_og_image_v1: {
        Args: {
          p_cover_token: string
          p_entity_id: string
          p_entity_type: string
          p_occurrence_id: string
        }
        Returns: string
      }
      get_organiser_calendar_events_v1: {
        Args: {
          p_from?: string
          p_include_past?: boolean
          p_organiser_id: string
          p_to?: string
        }
        Returns: Json[]
      }
      get_organiser_event_counts: {
        Args: { p_city_slug?: string }
        Returns: {
          entity_id: string
          event_count: number
        }[]
      }
      get_organiser_last_event_dates_v1: {
        Args: never
        Returns: {
          entity_id: string
          last_event_date: string
        }[]
      }
      get_organiser_linked_events: {
        Args: { p_organiser_id: string }
        Returns: {
          id: string
          is_published: boolean
          name: string
          schedule_type: string
          start_time: string
        }[]
      }
      get_organiser_next_event_dates: {
        Args: never
        Returns: {
          entity_id: string
          next_event_date: string
        }[]
      }
      get_organiser_next_occurrences_v1: {
        Args: { p_organiser_id: string }
        Returns: {
          event_id: string
          name: string
          next_start: string
          occurrence_id: string
          poster_url: string
          slug: string
        }[]
      }
      get_popular_searches_v1: {
        Args: { p_city_slug?: string; p_limit?: number }
        Returns: {
          query: string
          search_count: number
        }[]
      }
      get_profile_event_appearances: {
        Args: { p_profile_id: string }
        Returns: {
          event_id: string
          item_day: string
          item_end_time: string
          item_start_time: string
          item_title: string
          item_type: string
          link_table: string
          program_item_id: string
          role: string
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
      get_profile_event_timeline_v2: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_person_id: string
          p_person_type: string
        }
        Returns: {
          event_id: string
          event_name: string
          event_start_time: string
          first_occurrence: string
          occurrence_count: number
          role: string
          venue_id: string
          venue_name: string
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
      get_public_dj_v1: { Args: { p_dj_id: string }; Returns: Json }
      get_public_event_detail: {
        Args: { p_event_id: string; p_occurrence_id?: string }
        Returns: Json
      }
      get_public_event_vendors_v1: {
        Args: { p_event_id: string }
        Returns: {
          booth_location: string
          booth_number: string
          business_name: string
          city: string
          exhibit_hours: Json
          has_promo_code: boolean
          photo_url: string
          product_categories: string[]
          vendor_id: string
          verified: boolean
        }[]
      }
      get_public_events_list_v1: {
        Args: {
          p_city_slug?: string
          p_from_date?: string
          p_limit?: number
          p_offset?: number
          p_organiser_id?: string
          p_to_date?: string
          p_type?: string
        }
        Returns: {
          category: string
          city_name: string
          city_slug: string
          city_timezone: string
          cover_image_url: string
          ends_at: string
          event_id: string
          format: string
          is_recurring: boolean
          name: string
          occurrence_date: string
          occurrence_id: string
          organiser_id: string
          organiser_name: string
          starts_at: string
          type: string
          venue_address: string
          venue_id: string
          venue_name: string
        }[]
      }
      get_public_events_list_v2: {
        Args: {
          p_city_slug?: string
          p_from_date?: string
          p_limit?: number
          p_offset?: number
          p_organiser_id?: string
          p_to_date?: string
          p_type?: string
        }
        Returns: {
          category: string
          city_name: string
          city_slug: string
          city_timezone: string
          cover_image_url: string
          ends_at: string
          event_id: string
          format: string
          is_recurring: boolean
          name: string
          occurrence_date: string
          occurrence_id: string
          organiser_id: string
          organiser_name: string
          starts_at: string
          type: string
          venue_address: string
          venue_id: string
          venue_name: string
        }[]
      }
      get_public_festival_detail: {
        Args: { p_event_id: string }
        Returns: Json
      }
      get_public_festival_detail_v2: {
        Args: { p_event_id: string }
        Returns: Json
      }
      get_public_festivals_list_v1: {
        Args: never
        Returns: {
          city: string
          event_id: string
          name: string
          poster_url: string
          start_date: string
          starts_at: string
        }[]
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
      get_public_teachers_list_v1: {
        Args: { p_city_slug?: string; p_limit?: number; p_offset?: number }
        Returns: {
          city: string
          city_id: string
          entity_id: string
          first_name: string
          hide_surname: boolean
          instagram: string
          languages: string[]
          nationality: string
          offers_group: boolean
          offers_private: boolean
          photo_url: string
          surname: string
          teaching_styles: string[]
          website: string
          years_teaching: number
        }[]
      }
      get_public_vendor_detail_v1: {
        Args: { p_id: string }
        Returns: {
          business_name: string
          city: string
          city_id: string
          country: string
          description: string
          facebook: string
          faq: string
          gallery_urls: string[]
          id: string
          instagram: string
          photo_url: string
          product_categories: string[]
          products: Json
          promo_code: string
          promo_discount_type: string
          promo_discount_value: number
          public_email: string
          ships_international: boolean
          short_description: string
          team: Json
          upcoming_events: string[]
          verified: boolean
          website: string
          whatsapp: string
        }[]
      }
      get_public_vendor_directory_v1: {
        Args: {
          p_category?: string
          p_city_id?: string
          p_limit?: number
          p_offset?: number
          p_query?: string
        }
        Returns: {
          business_name: string
          city: string
          city_id: string
          country: string
          has_promo_code: boolean
          id: string
          photo_url: string
          product_categories: string[]
          ships_international: boolean
          total_count: number
          upcoming_event_count: number
          verified: boolean
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
      get_public_venues_list_v1: { Args: never; Returns: Json[] }
      get_public_venues_list_v2: { Args: never; Returns: Json[] }
      get_public_venues_list_v3: { Args: never; Returns: Json[] }
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
      get_raffle_community_stats_v1: { Args: never; Returns: Json }
      get_raffle_entry_wa_status_v1: {
        Args: { p_entry_id: string; p_session_id: string }
        Returns: Json
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
      is_feature_enabled: { Args: { p_key: string }; Returns: boolean }
      is_standard_multi_day: {
        Args: { p_end: string; p_start: string }
        Returns: boolean
      }
      is_super_admin: { Args: { p_user_id?: string }; Returns: boolean }
      is_valid_city_slug: { Args: { p_slug: string }; Returns: boolean }
      is_venue_favourited_v1: { Args: { p_venue_id: string }; Returns: boolean }
      lineup_health_check_v1: {
        Args: never
        Returns: {
          event_id: string
          event_name: string
          health: string
          lifecycle_status: string
          orphan_program_items: number
          program_items_count: number
          program_people_count: number
        }[]
      }
      lineup_health_summary_v1: { Args: never; Returns: Json }
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
      list_my_favourite_venues_v1: {
        Args: never
        Returns: {
          city_name: string
          favourited_at: string
          image_url: Json
          name: string
          venue_id: string
        }[]
      }
      list_open_raffles_v1: {
        Args: never
        Returns: {
          consent_version: string
          cutoff_at: string
          cutoff_offset_minutes: number
          entry_count: number
          event_id: string
          prize_text: string
          start_time: string
          timezone: string
          title: string
          venue_name: string
        }[]
      }
      list_public_djs_v1: {
        Args: { p_city_id?: string; p_limit?: number }
        Returns: Json
      }
      list_public_image_refs_v1: {
        Args: never
        Returns: {
          ref_id: string
          source: string
          url: string
        }[]
      }
      listing_request_is_stale: {
        Args: {
          p_status: Database["public"]["Enums"]["listing_request_status"]
          p_status_changed_at: string
        }
        Returns: boolean
      }
      mark_migration_complete: {
        Args: { p_version: string }
        Returns: undefined
      }
      normalize_dance_role: { Args: { p_value: string }; Returns: string }
      normalize_event_instances: {
        Args: { p_event_row?: Json; p_instances: Json }
        Returns: Json
      }
      normalize_facility_keys: {
        Args: { p_keys: string[] }
        Returns: {
          canonical_keys: string[]
          dropped_keys: string[]
        }[]
      }
      normalize_floor_type_key: {
        Args: { p_key: string }
        Returns: {
          canonical_key: string
          dropped: boolean
        }[]
      }
      normalize_instagram_handle: { Args: { p_input: string }; Returns: string }
      normalize_instagram_handle_v1: {
        Args: { p_input: string }
        Returns: string
      }
      occurrence_command_p5: { Args: { p_envelope: Json }; Returns: Json }
      og_render_targets_v1: {
        Args: never
        Returns: {
          entity_id: string
          entity_type: string
          occurrence_id: string
        }[]
      }
      organiser_event_workspace_v1: {
        Args: { p_cursor?: string; p_limit?: number; p_series_id: string }
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
      override_payload_allowed_keys: { Args: never; Returns: string[] }
      person_merge_candidates_v1: {
        Args: never
        Returns: {
          decision: string
          decision_id: string
          name_a: string
          name_b: string
          photo_url_a: string
          photo_url_b: string
          profile_id_a: string
          profile_id_b: string
          source_table_a: string
          source_table_b: string
        }[]
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
      pm_add_deadline_v1: {
        Args: { p: Json }
        Returns: {
          created_at: string
          created_by: string | null
          done: boolean
          done_at: string | null
          due_on: string | null
          id: string
          pipeline_id: string
          title: string
        }
        SetofOptions: {
          from: "*"
          to: "pm_organiser_deadlines"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      pm_add_note_v1: {
        Args: { p: Json }
        Returns: {
          channel: string
          created_at: string
          created_by: string | null
          happened_on: string
          id: string
          note: string
          pipeline_id: string
        }
        SetofOptions: {
          from: "*"
          to: "pm_organiser_notes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      pm_get_chat_history_v1: {
        Args: { p_pipeline_id: string }
        Returns: string
      }
      pm_list_organisers_v1: { Args: never; Returns: Json }
      pm_list_pipeline_v1: {
        Args: never
        Returns: {
          chat_history: string | null
          chat_history_updated_at: string | null
          created_at: string
          created_by: string | null
          draft_message: string | null
          draft_updated_at: string | null
          goal: string | null
          id: string
          last_contact_at: string | null
          next_follow_up_at: string | null
          notes: string | null
          organiser_id: string | null
          organiser_name: string
          stage: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "pm_organiser_pipeline"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      pm_list_work_items_v1: {
        Args: never
        Returns: {
          component: string | null
          created_at: string
          created_by: string | null
          detail: string | null
          id: string
          item_type: string
          repo: string | null
          severity: string | null
          sort_order: number
          source: string | null
          status: string
          title: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "pm_work_items"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      pm_metrics_v1: { Args: never; Returns: Json }
      pm_organiser_detail_v1: { Args: { p_pipeline_id: string }; Returns: Json }
      pm_set_chat_history_v1: { Args: { p: Json }; Returns: Json }
      pm_toggle_deadline_v1: {
        Args: { p: Json }
        Returns: {
          created_at: string
          created_by: string | null
          done: boolean
          done_at: string | null
          due_on: string | null
          id: string
          pipeline_id: string
          title: string
        }
        SetofOptions: {
          from: "*"
          to: "pm_organiser_deadlines"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      pm_upsert_pipeline_v1: {
        Args: { p: Json }
        Returns: {
          chat_history: string | null
          chat_history_updated_at: string | null
          created_at: string
          created_by: string | null
          draft_message: string | null
          draft_updated_at: string | null
          goal: string | null
          id: string
          last_contact_at: string | null
          next_follow_up_at: string | null
          notes: string | null
          organiser_id: string | null
          organiser_name: string
          stage: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "pm_organiser_pipeline"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      pm_upsert_work_item_v1: {
        Args: { p: Json }
        Returns: {
          component: string | null
          created_at: string
          created_by: string | null
          detail: string | null
          id: string
          item_type: string
          repo: string | null
          severity: string | null
          sort_order: number
          source: string | null
          status: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "pm_work_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      profile_safe_to_delete_v1: {
        Args: { p_profile_id: string; p_profile_type: string }
        Returns: Json
      }
      program_item_rollover_date_v1: {
        Args: { p_event_start: string; p_item_start: string }
        Returns: string
      }
      propagate_event_venue_to_future_occurrences: {
        Args: {
          _event_id: string
          _from_occurrence_id: string
          _new_venue_id: string
        }
        Returns: number
      }
      public_api_check_rate_limit_v1: {
        Args: { p_consumer_id: string; p_limit: number }
        Returns: Json
      }
      public_api_log_request_v1: {
        Args: {
          p_consumer_id: string
          p_endpoint: string
          p_error_code?: string
          p_ip: string
          p_response_ms: number
          p_status_code: number
          p_user_agent: string
        }
        Returns: undefined
      }
      public_api_resolve_key_v1: {
        Args: { p_hash_hex: string }
        Returns: {
          consumer_id: string
          is_active: boolean
          lifecycle_status: string
          rate_limit_per_minute: number
        }[]
      }
      purge_old_guest_entries_v1: { Args: never; Returns: Json }
      raffle_effective_occurrence_v1: {
        Args: { p_event_id: string }
        Returns: {
          legacy_occurrence_id: string
          p5_occurrence_id: string
          source: string
          start_at_utc: string
          start_local_date: string
          start_local_hhmm: string
          timezone: string
        }[]
      }
      raffle_wa_claim_send_v1: {
        Args: { p_entry_id: string; p_session_id: string }
        Returns: Json
      }
      raffle_wa_record_send_result_v1: {
        Args: {
          p_entry_id: string
          p_error?: string
          p_result: string
          p_wa_message_id?: string
        }
        Returns: Json
      }
      raffle_wa_webhook_update_v1: {
        Args: {
          p_error_code?: number
          p_error_detail?: string
          p_status: string
          p_wa_message_id: string
        }
        Returns: Json
      }
      recompute_daily_health_metrics_v1: { Args: never; Returns: Json }
      recompute_event_occurrence_times_v1: {
        Args: { p_event_id: string }
        Returns: undefined
      }
      recompute_occurrence_times_v1: {
        Args: { p_occurrence_id: string }
        Returns: undefined
      }
      recompute_override_payload_program_for_event_v1: {
        Args: { p_event_id: string }
        Returns: undefined
      }
      recompute_override_payload_program_v1: {
        Args: { p_occurrence_id: string }
        Returns: undefined
      }
      record_admin_action_v1: {
        Args: {
          p_action_kind: string
          p_event_id?: string
          p_meta_data?: Json
          p_occurrence_id?: string
        }
        Returns: Json
      }
      record_client_error_v1: {
        Args: {
          p_context?: Json
          p_error_code: string
          p_error_message: string
          p_release?: string
          p_session_id?: string
          p_source: string
          p_user_agent?: string
        }
        Returns: undefined
      }
      record_event_link_click_v1: {
        Args: {
          p_event_id: string
          p_link_type: string
          p_session_id?: string
          p_source?: string
          p_target_url?: string
          p_user_agent?: string
        }
        Returns: undefined
      }
      record_event_view_v1: {
        Args: {
          p_event_id: string
          p_occurrence_id?: string
          p_source?: string
          p_user_agent?: string
          p_viewer_session_id: string
        }
        Returns: Json
      }
      record_organiser_card_click_v1: {
        Args: {
          p_event_id: string
          p_organiser_id: string
          p_session_id: string
          p_source: string
          p_user_agent: string
          p_zone: string
        }
        Returns: undefined
      }
      record_pending_canonical_key: {
        Args: { p_key: string; p_kind: string; p_venue_id: string }
        Returns: undefined
      }
      record_profile_view_v1: {
        Args: {
          p_context: string
          p_event_id: string
          p_person_id: string
          p_profile_type: string
          p_session_id: string
          p_user_agent: string
        }
        Returns: undefined
      }
      record_raffle_win_v1: {
        Args: {
          p_draw_id?: string
          p_entry_id: string
          p_event_id: string
          p_note?: string
          p_source: string
        }
        Returns: {
          draw_id: string | null
          entry_id: string | null
          event_id: string
          first_name: string | null
          id: string
          logged_by: string | null
          note: string | null
          phone_e164: string
          series_key: string | null
          source: string
          venue_id: string | null
          won_at: string
        }
        SetofOptions: {
          from: "*"
          to: "raffle_winners"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_search_query_v1: {
        Args: {
          p_city_id?: string
          p_query: string
          p_results_count?: number
          p_session_id?: string
          p_source?: string
          p_user_agent?: string
        }
        Returns: undefined
      }
      record_search_result_click_v1: {
        Args: {
          p_entity_id: string
          p_entity_type: string
          p_position?: number
          p_query: string
          p_session_id?: string
          p_source?: string
          p_user_agent?: string
        }
        Returns: undefined
      }
      record_vendor_link_click_v1: {
        Args: {
          p_link_type: string
          p_session_id?: string
          p_source?: string
          p_target_url?: string
          p_user_agent?: string
          p_vendor_id: string
        }
        Returns: undefined
      }
      reject_city_request: {
        Args: { p_reject_reason?: string; p_request_id: string }
        Returns: Json
      }
      remove_favourite_venue_v1: {
        Args: { p_venue_id: string }
        Returns: undefined
      }
      replace_event_program: {
        Args: { p_event_id: string; p_meta_data: Json }
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
      report_dancer_survivor_sidecar_violations_v1: {
        Args: never
        Returns: Json
      }
      resolve_city_id: {
        Args: { p_city?: string; p_city_slug?: string }
        Returns: string
      }
      resolve_epp_person_v1: {
        Args: {
          p_avatar_url_snapshot?: string
          p_display_name_override?: string
          p_profile_id: string
          p_profile_type: string
        }
        Returns: {
          avatar_url: string
          display_name: string
          id: string
          is_archived: boolean
          profile_type: string
        }[]
      }
      resolve_guest_assignments: {
        Args: { p_assignments: Json; p_event_id: string; p_timezone: string }
        Returns: {
          guest_profile_id: string
          occurrence_id: string
          role: string
        }[]
      }
      resolve_my_person_id_v1: { Args: never; Returns: string }
      resolve_person_v1: {
        Args: { p_id: string; p_kind: string }
        Returns: {
          avatar_url: string
          display_name: string
          id: string
          is_archived: boolean
          kind: string
          slug: string
        }[]
      }
      resolve_public_event_ref_v1: { Args: { p_param: string }; Returns: Json }
      resolve_venue_city: {
        Args: { p_fallback_city_id: string; p_venue_id: string }
        Returns: {
          city_id: string
          city_slug: string
        }[]
      }
      save_event_core: {
        Args: { p_event_core: Json; p_event_id: string }
        Returns: undefined
      }
      save_my_dancer_profile_v1: { Args: { p_payload: Json }; Returns: Json }
      save_my_organiser_profile_v1: { Args: { p_payload: Json }; Returns: Json }
      save_my_videographer_profile_v1: {
        Args: { p_payload: Json }
        Returns: Json
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
      search_public_v1: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          city_slug: string
          event_type: string
          id: string
          image_url: string
          kind: string
          match_rank: number
          start_time: string
          subtitle: string
          title: string
        }[]
      }
      search_public_v2: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          category: string
          city_slug: string
          event_type: string
          format: string
          id: string
          image_url: string
          kind: string
          match_rank: number
          start_time: string
          subtitle: string
          title: string
        }[]
      }
      search_public_v3: {
        Args: {
          p_city_slug?: string
          p_include_past?: boolean
          p_query: string
          p_section_limit?: number
        }
        Returns: Json
      }
      search_public_v4: {
        Args: {
          p_city_slug?: string
          p_include_past?: boolean
          p_query: string
          p_section_limit?: number
        }
        Returns: Json
      }
      search_public_v5: {
        Args: {
          p_category?: string[]
          p_city_slug?: string
          p_date_from?: string
          p_date_to?: string
          p_event_type?: string[]
          p_format?: string[]
          p_include_past?: boolean
          p_query: string
          p_section_limit?: number
          p_styles?: string[]
        }
        Returns: Json
      }
      self_heal_occurrence_integrity_v1: { Args: never; Returns: Json }
      series_command_p5: { Args: { p_envelope: Json }; Returns: Json }
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
      set_og_image_v1: {
        Args: {
          p_cover_source_url: string
          p_entity_id: string
          p_entity_type: string
          p_error?: string
          p_image_url: string
          p_occurrence_id: string
          p_status?: string
        }
        Returns: undefined
      }
      slugify_person_name: {
        Args: { p_id: string; p_name: string }
        Returns: string
      }
      stash_local_as_utc: {
        Args: { p_date: string; p_time: string }
        Returns: string
      }
      stash_local_as_utc_dur: {
        Args: { p_date: string; p_dur: string; p_start: string }
        Returns: string
      }
      stash_local_as_utc_end: {
        Args: { p_date: string; p_end: string; p_start: string }
        Returns: string
      }
      submit_guest_list_entry: {
        Args: { p_event_id: string; p_first_name: string }
        Returns: Json
      }
      submit_listing_request_v1: { Args: { p_payload: Json }; Returns: Json }
      submit_raffle_entry: {
        Args: {
          p_consent_version: string
          p_event_id: string
          p_first_name: string
          p_honeypot?: string
          p_phone_e164: string
          p_session_id?: string
        }
        Returns: Json
      }
      sync_standard_event_sessions: {
        Args: { p_event_id: string; p_key_times: Json }
        Returns: undefined
      }
      test_per_date_program_sync_mutation_v1: { Args: never; Returns: Json }
      test_per_occurrence_actor_kind_v1: { Args: never; Returns: Json }
      test_per_occurrence_v1: { Args: never; Returns: Json }
      topup_series_materialisation_horizon_v1: { Args: never; Returns: Json }
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
      upsert_venue_atomic: { Args: { payload: Json }; Returns: Json }
      uuid_to_bigint: { Args: { p_uuid: string }; Returns: number }
      validate_override_payload_v1: { Args: { p_payload: Json }; Returns: Json }
      venue_is_public: { Args: { p_publish_state: string }; Returns: boolean }
      would_violate_events_time_constraints: {
        Args: { p_end: string; p_start: string }
        Returns: boolean
      }
    }
    Enums: {
      event_entity_role: "organiser"
      event_program_section_kind:
        | "classes"
        | "masterclass"
        | "party"
        | "social"
        | "showcase"
        | "competition"
        | "concert"
        | "ceremony"
      listing_request_section:
        | "teachers_directory"
        | "teacher_detail"
        | "organisers_directory"
        | "organiser_detail"
        | "venue_detail"
      listing_request_status:
        | "new"
        | "contacted"
        | "onboarding"
        | "posted"
        | "archived"
        | "declined"
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
      event_entity_role: ["organiser"],
      event_program_section_kind: [
        "classes",
        "masterclass",
        "party",
        "social",
        "showcase",
        "competition",
        "concert",
        "ceremony",
      ],
      listing_request_section: [
        "teachers_directory",
        "teacher_detail",
        "organisers_directory",
        "organiser_detail",
        "venue_detail",
      ],
      listing_request_status: [
        "new",
        "contacted",
        "onboarding",
        "posted",
        "archived",
        "declined",
      ],
    },
  },
} as const
