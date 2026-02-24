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
      attendees: {
        Row: {
          created_at: string | null
          event_id: string
          hide_identity: boolean | null
          status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_id: string
          hide_identity?: boolean | null
          status?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_id?: string
          hide_identity?: boolean | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cities: {
        Row: {
          country_code: string
          created_at: string | null
          header_image_url: string | null
          id: string
          is_active: boolean | null
          name: string
          slug: string
          timezone: string
        }
        Insert: {
          country_code: string
          created_at?: string | null
          header_image_url?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          slug: string
          timezone?: string
        }
        Update: {
          country_code?: string
          created_at?: string | null
          header_image_url?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          slug?: string
          timezone?: string
        }
        Relationships: []
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
      dancers: {
        Row: {
          achievements: string[] | null
          city: string
          city_id: string
          created_at: string | null
          dancing_start_date: string | null
          facebook: string | null
          favorite_songs: string[] | null
          favorite_styles: string[] | null
          festival_plans: Json | null
          first_name: string
          gallery_urls: string[] | null
          hide_surname: boolean | null
          id: string
          instagram: string | null
          is_public: boolean | null
          looking_for_partner: boolean | null
          meta_data: Json | null
          nationality: string | null
          partner_details: Json | null
          partner_practice_goals: string[] | null
          partner_role: string | null
          partner_search_level: string[] | null
          partner_search_role: string | null
          photo_url: string[] | null
          surname: string | null
          user_id: string
          verified: boolean | null
          website: string | null
          whatsapp: string | null
          years_dancing: string | null
        }
        Insert: {
          achievements?: string[] | null
          city: string
          city_id: string
          created_at?: string | null
          dancing_start_date?: string | null
          facebook?: string | null
          favorite_songs?: string[] | null
          favorite_styles?: string[] | null
          festival_plans?: Json | null
          first_name: string
          gallery_urls?: string[] | null
          hide_surname?: boolean | null
          id?: string
          instagram?: string | null
          is_public?: boolean | null
          looking_for_partner?: boolean | null
          meta_data?: Json | null
          nationality?: string | null
          partner_details?: Json | null
          partner_practice_goals?: string[] | null
          partner_role?: string | null
          partner_search_level?: string[] | null
          partner_search_role?: string | null
          photo_url?: string[] | null
          surname?: string | null
          user_id: string
          verified?: boolean | null
          website?: string | null
          whatsapp?: string | null
          years_dancing?: string | null
        }
        Update: {
          achievements?: string[] | null
          city?: string
          city_id?: string
          created_at?: string | null
          dancing_start_date?: string | null
          facebook?: string | null
          favorite_songs?: string[] | null
          favorite_styles?: string[] | null
          festival_plans?: Json | null
          first_name?: string
          gallery_urls?: string[] | null
          hide_surname?: boolean | null
          id?: string
          instagram?: string | null
          is_public?: boolean | null
          looking_for_partner?: boolean | null
          meta_data?: Json | null
          nationality?: string | null
          partner_details?: Json | null
          partner_practice_goals?: string[] | null
          partner_role?: string | null
          partner_search_level?: string[] | null
          partner_search_role?: string | null
          photo_url?: string[] | null
          surname?: string | null
          user_id?: string
          verified?: boolean | null
          website?: string | null
          whatsapp?: string | null
          years_dancing?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dancers_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
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
          created_at: string | null
          dj_name: string
          public_email: string | null
          facebook: string | null
          faq: string | null
          first_name: string | null
          gallery_urls: string[] | null
          genres: string[] | null
          hide_real_name: boolean | null
          id: string
          instagram: string | null
          meta_data: Json | null
          mixcloud: string | null
          music_styles: string[] | null
          name: string | null
          nationality: string | null
          phone: string | null
          photo_url: string[] | null
          real_name: string | null
          sample_mix_urls: string[] | null
          soundcloud: string | null
          surname: string | null
          user_id: string | null
          verified: boolean | null
          website: string | null
          youtube: string | null
          youtube_url: string | null
        }
        Insert: {
          bio?: string | null
          booking_email?: string | null
          city?: string | null
          city_id?: string | null
          country?: string | null
          created_at?: string | null
          dj_name: string
          public_email?: string | null
          facebook?: string | null
          faq?: string | null
          first_name?: string | null
          gallery_urls?: string[] | null
          genres?: string[] | null
          hide_real_name?: boolean | null
          id?: string
          instagram?: string | null
          meta_data?: Json | null
          mixcloud?: string | null
          music_styles?: string[] | null
          name?: string | null
          nationality?: string | null
          phone?: string | null
          photo_url?: string[] | null
          real_name?: string | null
          sample_mix_urls?: string[] | null
          soundcloud?: string | null
          surname?: string | null
          user_id?: string | null
          verified?: boolean | null
          website?: string | null
          youtube?: string | null
          youtube_url?: string | null
        }
        Update: {
          bio?: string | null
          booking_email?: string | null
          city?: string | null
          city_id?: string | null
          country?: string | null
          created_at?: string | null
          dj_name?: string
          public_email?: string | null
          facebook?: string | null
          faq?: string | null
          first_name?: string | null
          gallery_urls?: string[] | null
          genres?: string[] | null
          hide_real_name?: boolean | null
          id?: string
          instagram?: string | null
          meta_data?: Json | null
          mixcloud?: string | null
          music_styles?: string[] | null
          name?: string | null
          nationality?: string | null
          phone?: string | null
          photo_url?: string[] | null
          real_name?: string | null
          sample_mix_urls?: string[] | null
          soundcloud?: string | null
          surname?: string | null
          user_id?: string | null
          verified?: boolean | null
          website?: string | null
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
          facilities: Json | null
          floor_type: Json | null
          gallery_urls: Json | null
          google_maps_url: string | null
          id: string
          instagram: string | null
          name: string
          opening_hours: Json | null
          parking: string | null
          socials: Json | null
          type: string
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
          facilities?: Json | null
          floor_type?: Json | null
          gallery_urls?: Json | null
          google_maps_url?: string | null
          id?: string
          instagram?: string | null
          name: string
          opening_hours?: Json | null
          parking?: string | null
          socials?: Json | null
          type: string
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
          facilities?: Json | null
          floor_type?: Json | null
          gallery_urls?: Json | null
          google_maps_url?: string | null
          id?: string
          instagram?: string | null
          name?: string
          opening_hours?: Json | null
          parking?: string | null
          socials?: Json | null
          type?: string
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
            referencedRelation: "dancers"
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
      event_djs: {
        Row: {
          created_at: string | null
          dj_id: string
          event_id: string
        }
        Insert: {
          created_at?: string | null
          dj_id: string
          event_id: string
        }
        Update: {
          created_at?: string | null
          dj_id?: string
          event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_djs_dj_id_fkey"
            columns: ["dj_id"]
            isOneToOne: false
            referencedRelation: "dj_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_djs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_entities: {
        Row: {
          created_at: string
          entity_id: string
          event_id: string
          role: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          event_id: string
          role: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          event_id?: string
          role?: string
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
            foreignKeyName: "event_entities_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_organisers: {
        Row: {
          added_by_admin: boolean | null
          created_at: string | null
          event_id: string
          organiser_id: string
        }
        Insert: {
          added_by_admin?: boolean | null
          created_at?: string | null
          event_id: string
          organiser_id: string
        }
        Update: {
          added_by_admin?: boolean | null
          created_at?: string | null
          event_id?: string
          organiser_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_organisers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_organisers_organiser_id_fkey"
            columns: ["organiser_id"]
            isOneToOne: false
            referencedRelation: "organisers"
            referencedColumns: ["id"]
          },
        ]
      }
      event_participants: {
        Row: {
          created_at: string | null
          event_id: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_id: string
          status: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_id?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
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
            referencedRelation: "events"
            referencedColumns: ["id"]
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
            referencedRelation: "events"
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
      event_special_guests: {
        Row: {
          created_at: string | null
          dancer_id: string | null
          event_id: string
          guest_name: string
          guest_nationality: string | null
          guest_photo_url: string | null
          id: string
          is_highlighted: boolean | null
        }
        Insert: {
          created_at?: string | null
          dancer_id?: string | null
          event_id: string
          guest_name: string
          guest_nationality?: string | null
          guest_photo_url?: string | null
          id?: string
          is_highlighted?: boolean | null
        }
        Update: {
          created_at?: string | null
          dancer_id?: string | null
          event_id?: string
          guest_name?: string
          guest_nationality?: string | null
          guest_photo_url?: string | null
          id?: string
          is_highlighted?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "event_special_guests_dancer_id_fkey"
            columns: ["dancer_id"]
            isOneToOne: false
            referencedRelation: "dancers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_special_guests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_teachers: {
        Row: {
          created_at: string | null
          event_id: string
          teacher_id: string
        }
        Insert: {
          created_at?: string | null
          event_id: string
          teacher_id: string
        }
        Update: {
          created_at?: string | null
          event_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_teachers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_teachers_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher_profiles"
            referencedColumns: ["id"]
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
          cover_image_url: string | null
          created_at: string | null
          created_by: string | null
          dancer_ids: string[] | null
          date: string | null
          description: string | null
          dj_ids: string[] | null
          end_time: string | null
          facebook_url: string | null
          faq: string | null
          festival_config: Json | null
          gallery_urls: string[] | null
          guestlist_config: string | null
          has_guestlist: boolean | null
          has_raffle: boolean | null
          id: string
          instagram_url: string | null
          instances: Json | null
          is_active: boolean | null
          is_published: boolean | null
          key_times: string | null
          lifecycle_status: string
          location: string | null
          meta_data: Json | null
          name: string
          organiser_id: string | null
          organiser_ids: string[] | null
          payment_methods: string | null
          photo_url: string[] | null
          photographer_ids: string[] | null
          pricing: Json | null
          promo_codes: string | null
          raffle_config: string | null
          recurrence: Json | null
          schedule_type: string | null
          start_time: string | null
          teacher_ids: string[] | null
          ticket_url: string | null
          tickets: string | null
          timezone: string | null
          type: string | null
          updated_at: string
          user_id: string | null
          vendor_ids: string[] | null
          venue_id: string | null
          videographer_ids: string[] | null
          website: string | null
        }
        Insert: {
          attendance_count?: number | null
          city?: string | null
          city_id?: string | null
          city_slug?: string | null
          country?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          created_by?: string | null
          dancer_ids?: string[] | null
          date?: string | null
          description?: string | null
          dj_ids?: string[] | null
          end_time?: string | null
          facebook_url?: string | null
          faq?: string | null
          festival_config?: Json | null
          gallery_urls?: string[] | null
          guestlist_config?: string | null
          has_guestlist?: boolean | null
          has_raffle?: boolean | null
          id?: string
          instagram_url?: string | null
          instances?: Json | null
          is_active?: boolean | null
          is_published?: boolean | null
          key_times?: string | null
          lifecycle_status?: string
          location?: string | null
          meta_data?: Json | null
          name: string
          organiser_id?: string | null
          organiser_ids?: string[] | null
          payment_methods?: string | null
          photo_url?: string[] | null
          photographer_ids?: string[] | null
          pricing?: Json | null
          promo_codes?: string | null
          raffle_config?: string | null
          recurrence?: Json | null
          schedule_type?: string | null
          start_time?: string | null
          teacher_ids?: string[] | null
          ticket_url?: string | null
          tickets?: string | null
          timezone?: string | null
          type?: string | null
          updated_at?: string
          user_id?: string | null
          vendor_ids?: string[] | null
          venue_id?: string | null
          videographer_ids?: string[] | null
          website?: string | null
        }
        Update: {
          attendance_count?: number | null
          city?: string | null
          city_id?: string | null
          city_slug?: string | null
          country?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          created_by?: string | null
          dancer_ids?: string[] | null
          date?: string | null
          description?: string | null
          dj_ids?: string[] | null
          end_time?: string | null
          facebook_url?: string | null
          faq?: string | null
          festival_config?: Json | null
          gallery_urls?: string[] | null
          guestlist_config?: string | null
          has_guestlist?: boolean | null
          has_raffle?: boolean | null
          id?: string
          instagram_url?: string | null
          instances?: Json | null
          is_active?: boolean | null
          is_published?: boolean | null
          key_times?: string | null
          lifecycle_status?: string
          location?: string | null
          meta_data?: Json | null
          name?: string
          organiser_id?: string | null
          organiser_ids?: string[] | null
          payment_methods?: string | null
          photo_url?: string[] | null
          photographer_ids?: string[] | null
          pricing?: Json | null
          promo_codes?: string | null
          raffle_config?: string | null
          recurrence?: Json | null
          schedule_type?: string | null
          start_time?: string | null
          teacher_ids?: string[] | null
          ticket_url?: string | null
          tickets?: string | null
          timezone?: string | null
          type?: string | null
          updated_at?: string
          user_id?: string | null
          vendor_ids?: string[] | null
          venue_id?: string | null
          videographer_ids?: string[] | null
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
            foreignKeyName: "events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      organisers: {
        Row: {
          bio: string | null
          business_name: string | null
          category: string | null
          city: string | null
          city_id: string | null
          created_at: string | null
          public_email: string | null
          facebook: string | null
          faq: string | null
          first_name: string | null
          gallery_urls: string[] | null
          id: string
          instagram: string | null
          meta_data: Json | null
          name: string
          nationality: string | null
          organisation_name: string | null
          phone: string | null
          photo_url: string[] | null
          promo_video_urls: string[] | null
          surname: string | null
          team: Json | null
          team_members: string | null
          user_id: string | null
          verified: boolean | null
          website: string | null
        }
        Insert: {
          bio?: string | null
          business_name?: string | null
          category?: string | null
          city?: string | null
          city_id?: string | null
          created_at?: string | null
          public_email?: string | null
          facebook?: string | null
          faq?: string | null
          first_name?: string | null
          gallery_urls?: string[] | null
          id?: string
          instagram?: string | null
          meta_data?: Json | null
          name: string
          nationality?: string | null
          organisation_name?: string | null
          phone?: string | null
          photo_url?: string[] | null
          promo_video_urls?: string[] | null
          surname?: string | null
          team?: Json | null
          team_members?: string | null
          user_id?: string | null
          verified?: boolean | null
          website?: string | null
        }
        Update: {
          bio?: string | null
          business_name?: string | null
          category?: string | null
          city?: string | null
          city_id?: string | null
          created_at?: string | null
          public_email?: string | null
          facebook?: string | null
          faq?: string | null
          first_name?: string | null
          gallery_urls?: string[] | null
          id?: string
          instagram?: string | null
          meta_data?: Json | null
          name?: string
          nationality?: string | null
          organisation_name?: string | null
          phone?: string | null
          photo_url?: string[] | null
          promo_video_urls?: string[] | null
          surname?: string | null
          team?: Json | null
          team_members?: string | null
          user_id?: string | null
          verified?: boolean | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organisers_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
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
          country_code?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_admin?: boolean | null
          username?: string | null
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
      teacher_profiles: {
        Row: {
          availability: string | null
          city: string | null
          city_id: string | null
          country: string | null
          created_at: string | null
          public_email: string | null
          facebook: string | null
          faq: string | null
          first_name: string | null
          gallery_urls: string[] | null
          hide_surname: boolean | null
          id: string
          instagram: string | null
          journey: string | null
          languages: string[] | null
          meta_data: Json | null
          nationality: string | null
          offers_group: boolean | null
          offers_private: boolean | null
          phone: string | null
          photo_url: string[] | null
          private_lesson_locations: string[] | null
          private_lesson_types: string[] | null
          private_travel_distance: number | null
          surname: string | null
          teaching_styles: string[] | null
          travel_willingness: string | null
          user_id: string | null
          verified: boolean | null
          website: string | null
          years_teaching: number | null
        }
        Insert: {
          availability?: string | null
          city?: string | null
          city_id?: string | null
          country?: string | null
          created_at?: string | null
          public_email?: string | null
          facebook?: string | null
          faq?: string | null
          first_name?: string | null
          gallery_urls?: string[] | null
          hide_surname?: boolean | null
          id?: string
          instagram?: string | null
          journey?: string | null
          languages?: string[] | null
          meta_data?: Json | null
          nationality?: string | null
          offers_group?: boolean | null
          offers_private?: boolean | null
          phone?: string | null
          photo_url?: string[] | null
          private_lesson_locations?: string[] | null
          private_lesson_types?: string[] | null
          private_travel_distance?: number | null
          surname?: string | null
          teaching_styles?: string[] | null
          travel_willingness?: string | null
          user_id?: string | null
          verified?: boolean | null
          website?: string | null
          years_teaching?: number | null
        }
        Update: {
          availability?: string | null
          city?: string | null
          city_id?: string | null
          country?: string | null
          created_at?: string | null
          public_email?: string | null
          facebook?: string | null
          faq?: string | null
          first_name?: string | null
          gallery_urls?: string[] | null
          hide_surname?: boolean | null
          id?: string
          instagram?: string | null
          journey?: string | null
          languages?: string[] | null
          meta_data?: Json | null
          nationality?: string | null
          offers_group?: boolean | null
          offers_private?: boolean | null
          phone?: string | null
          photo_url?: string[] | null
          private_lesson_locations?: string[] | null
          private_lesson_types?: string[] | null
          private_travel_distance?: number | null
          surname?: string | null
          teaching_styles?: string[] | null
          travel_willingness?: string | null
          user_id?: string | null
          verified?: boolean | null
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
        ]
      }
      teachers: {
        Row: {
          bio: string | null
          certifications: string | null
          created_at: string | null
          is_verified: boolean | null
          stage_name: string | null
          user_id: string
        }
        Insert: {
          bio?: string | null
          certifications?: string | null
          created_at?: string | null
          is_verified?: boolean | null
          stage_name?: string | null
          user_id: string
        }
        Update: {
          bio?: string | null
          certifications?: string | null
          created_at?: string | null
          is_verified?: boolean | null
          stage_name?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teachers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          business_name: string | null
          city: string | null
          city_id: string | null
          created_at: string
          public_email: string | null
          facebook: string | null
          faq: string | null
          id: string
          instagram: string | null
          meta_data: Json | null
          photo_url: string[] | null
          product_categories: string[] | null
          products: Json | null
          promo_code: string | null
          promo_discount_type: string | null
          promo_discount_value: number | null
          ships_international: boolean | null
          team: Json | null
          upcoming_events: string[] | null
          user_id: string | null
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          business_name?: string | null
          city?: string | null
          city_id?: string | null
          created_at?: string
          public_email?: string | null
          facebook?: string | null
          faq?: string | null
          id?: string
          instagram?: string | null
          meta_data?: Json | null
          photo_url?: string[] | null
          product_categories?: string[] | null
          products?: Json | null
          promo_code?: string | null
          promo_discount_type?: string | null
          promo_discount_value?: number | null
          ships_international?: boolean | null
          team?: Json | null
          upcoming_events?: string[] | null
          user_id?: string | null
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          business_name?: string | null
          city?: string | null
          city_id?: string | null
          created_at?: string
          public_email?: string | null
          facebook?: string | null
          faq?: string | null
          id?: string
          instagram?: string | null
          meta_data?: Json | null
          photo_url?: string[] | null
          product_categories?: string[] | null
          products?: Json | null
          promo_code?: string | null
          promo_discount_type?: string | null
          promo_discount_value?: number | null
          ships_international?: boolean | null
          team?: Json | null
          upcoming_events?: string[] | null
          user_id?: string | null
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
        ]
      }
      venues: {
        Row: {
          address: string | null
          capacity: number | null
          city: string | null
          city_id: string | null
          country: string | null
          created_at: string | null
          description: string | null
          email: string | null
          facebook: string | null
          facilities: Json | null
          faq: string | null
          floor_type: Json | null
          gallery_urls: string[] | null
          google_maps_url: string | null
          hide_paid_parking: boolean | null
          id: string
          instagram: string | null
          meta_data: Json | null
          name: string
          opening_hours: Json | null
          parking: string | null
          phone: string | null
          photo_url: string[] | null
          rules: string[] | null
          timezone: string | null
          transport: string | null
          user_id: string
          website: string | null
        }
        Insert: {
          address?: string | null
          capacity?: number | null
          city?: string | null
          city_id?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          email?: string | null
          facebook?: string | null
          facilities?: Json | null
          faq?: string | null
          floor_type?: Json | null
          gallery_urls?: string[] | null
          google_maps_url?: string | null
          hide_paid_parking?: boolean | null
          id?: string
          instagram?: string | null
          meta_data?: Json | null
          name: string
          opening_hours?: Json | null
          parking?: string | null
          phone?: string | null
          photo_url?: string[] | null
          rules?: string[] | null
          timezone?: string | null
          transport?: string | null
          user_id: string
          website?: string | null
        }
        Update: {
          address?: string | null
          capacity?: number | null
          city?: string | null
          city_id?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          email?: string | null
          facebook?: string | null
          facilities?: Json | null
          faq?: string | null
          floor_type?: Json | null
          gallery_urls?: string[] | null
          google_maps_url?: string | null
          hide_paid_parking?: boolean | null
          id?: string
          instagram?: string | null
          meta_data?: Json | null
          name?: string
          opening_hours?: Json | null
          parking?: string | null
          phone?: string | null
          photo_url?: string[] | null
          rules?: string[] | null
          timezone?: string | null
          transport?: string | null
          user_id?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "venues_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      videographers: {
        Row: {
          bio: string | null
          business_name: string | null
          city: string | null
          city_id: string | null
          created_at: string
          public_email: string | null
          facebook: string | null
          faq: string | null
          first_name: string | null
          gallery_urls: string[] | null
          id: string
          instagram: string | null
          meta_data: Json | null
          phone: string | null
          photo_url: string[] | null
          surname: string | null
          team: Json | null
          user_id: string | null
          verified: boolean | null
          videography_styles: string[] | null
          website: string | null
        }
        Insert: {
          bio?: string | null
          business_name?: string | null
          city?: string | null
          city_id?: string | null
          created_at?: string
          public_email?: string | null
          facebook?: string | null
          faq?: string | null
          first_name?: string | null
          gallery_urls?: string[] | null
          id?: string
          instagram?: string | null
          meta_data?: Json | null
          phone?: string | null
          photo_url?: string[] | null
          surname?: string | null
          team?: Json | null
          user_id?: string | null
          verified?: boolean | null
          videography_styles?: string[] | null
          website?: string | null
        }
        Update: {
          bio?: string | null
          business_name?: string | null
          city?: string | null
          city_id?: string | null
          created_at?: string
          public_email?: string | null
          facebook?: string | null
          faq?: string | null
          first_name?: string | null
          gallery_urls?: string[] | null
          id?: string
          instagram?: string | null
          meta_data?: Json | null
          phone?: string | null
          photo_url?: string[] | null
          surname?: string | null
          team?: Json | null
          user_id?: string | null
          verified?: boolean | null
          videography_styles?: string[] | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "videographers_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      admin_unresolved_city_mappings_v: {
        Row: {
          city: string | null
          city_id_text: string | null
          city_slug: string | null
          entity_id: string | null
          entity_type: string | null
          issue: string | null
          legacy_city: string | null
        }
        Relationships: []
      }
      v_city_unresolved_rows: {
        Row: {
          city_slug: string | null
          city_text: string | null
          current_city_id: string | null
          resolved_city_id: string | null
          row_id: string | null
          table_name: string | null
        }
        Relationships: []
      }
      v_city_unresolved_summary: {
        Row: {
          backfillable_rows: number | null
          table_name: string | null
          total_rows: number | null
          unresolved_rows: number | null
        }
        Relationships: []
      }
    }
    Functions: {
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
      admin_normalize_name: { Args: { p_name: string }; Returns: string }
      admin_profile_exists: {
        Args: { p_profile_id: string; p_profile_type: string }
        Returns: boolean
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
      admin_sync_event_links_to_event_row: {
        Args: { p_event_id: string }
        Returns: Json
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
      get_active_cities: {
        Args: never
        Returns: {
          country_code: string
          event_count: number
          name: string
          slug: string
        }[]
      }
      get_calendar_events:
        | {
            Args: { range_end: string; range_start: string }
            Returns: {
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
              photo_url: string[]
              start_time: string
              type: string
            }[]
          }
        | {
            Args: {
              city_slug_param?: string
              range_end: string
              range_start: string
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
      get_event_detail: {
        Args: { p_event_id: string }
        Returns: {
          djs: Json
          event: Json
          organisers: Json
          teachers: Json
          venue: Json
          venue_entity: Json
        }[]
      }
      get_event_engagement: {
        Args: { p_event_id: string }
        Returns: {
          going_count: number
          interested_count: number
        }[]
      }
      get_event_attendance_counts: {
        Args: { p_event_ids: string[] }
        Returns: {
          event_id: string
          interested_count: number
          going_count: number
        }[]
      }
      set_attendance: {
        Args: { p_event_id: string; p_status?: string | null }
        Returns: {
          created_at: string | null
          event_id: string
          status: string
          updated_at: string | null
          user_id: string
        }
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
      get_organiser_event_counts: {
        Args: { p_city_slug?: string }
        Returns: {
          entity_id: string
          event_count: number
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
      is_current_user_admin: { Args: never; Returns: boolean }
      is_valid_city_slug: { Args: { p_slug: string }; Returns: boolean }
      resolve_city_id: {
        Args: { p_city?: string; p_city_slug?: string }
        Returns: string
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
