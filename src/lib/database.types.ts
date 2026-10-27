export type AuctionStatus = 'draft' | 'active' | 'ended' | 'sold' | 'cancelled'

export type Profile = {
  id: string
  username: string | null
  display_name: string | null
  city: string | null
  /** Only present on own profile (rpc my_profile) */
  phone?: string | null
  phone_verified_at?: string | null
  avatar_url: string | null
  bio: string | null
  rating_avg: number
  rating_count: number
  is_admin?: boolean
  created_at: string
  updated_at: string
}

export type Category = {
  id: string
  name: string
  icon: string | null
  parent_id?: string | null
  sort_order?: number
  fee_percent?: number
}

export type SellerFee = {
  id: string
  auction_id: string
  seller_id: string
  sale_price: number
  fee_percent: number
  fee_amount: number
  status: 'pending' | 'paid' | 'cancelled' | 'waived'
  created_at: string
  /** Settlement (rozliczenie) the fee is paid in; null until the fees are settled */
  settlement_id: string | null
  /** 14 days after its settlement was issued (null before); past it the account is blocked */
  due_at: string | null
  paid_at: string | null
}

/** Fees are paid in settlements: at 20 zł, on the 1st of the month, or on request — one payment each */
export type FeeSettlement = {
  id: string
  number: string
  reason: 'threshold' | 'monthly' | 'on_request'
  amount: number
  fee_count: number
  status: 'pending' | 'paid' | 'cancelled'
  issued_at: string
  due_at: string
  paid_at: string | null
}

export type Auction = {
  id: string
  seller_id: string
  category_id: string | null
  title: string
  description: string
  image_urls: string[]
  starting_price: number
  reserve_price: number | null
  current_price: number
  bid_increment: number
  buy_now_price: number | null
  status: AuctionStatus
  starts_at: string
  ends_at: string
  winner_id: string | null
  city: string | null
  lat?: number | null
  lng?: number | null
  seller_notes?: SellerNote[] | null
  shipping_options: string[]
  watch_count: number
  bid_count: number
  /** 7 or 14 — used for auto-renew window */
  duration_days?: number | null
  /** If true and unsold at end → extend another duration_days */
  auto_renew?: boolean | null
  moderation_status?: 'approved' | 'pending_auto' | 'pending_review' | 'rejected'
  moderation_reasons?: string[]
  moderation_notes?: string | null
  /** Paid promotion (bidigo-backend V41): highlighted / on the home page until, last bump */
  promoted_until?: string | null
  homepage_until?: string | null
  bumped_at?: string | null
  created_at: string
  updated_at: string
  seller?: Profile | null
  category?: Category | null
}

export type SellerNote = {
  body: string
  created_at: string
}

export type SellerRating = {
  id: string
  auction_id: string
  seller_id: string
  buyer_id: string
  score: number
  comment: string | null
  created_at: string
}

export type AuctionComment = {
  id: string
  auction_id: string
  author_id: string
  body: string
  created_at: string
  /** null = root question; set = seller reply in that thread */
  parent_id?: string | null
  author?: Profile | null
}

export type Bid = {
  id: string
  auction_id: string
  bidder_id: string
  amount: number
  created_at: string
  bidder?: Profile | null
}

export type Conversation = {
  id: string
  auction_id: string
  buyer_id: string
  seller_id: string
  created_at: string
  buyer_last_read_at: string | null
  seller_last_read_at: string | null
}

export type Message = {
  id: string
  conversation_id: string
  sender_id: string
  body: string
  created_at: string
}

export type Database = {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile> & { id: string }; Update: Partial<Profile> }
      categories: { Row: Category; Insert: Category; Update: Partial<Category> }
      auctions: {
        Row: Auction
        Insert: Omit<Auction, 'id' | 'created_at' | 'updated_at' | 'bid_count' | 'watch_count' | 'seller' | 'category'> & {
          id?: string
          bid_count?: number
          watch_count?: number
        }
        Update: Partial<Auction>
      }
      bids: {
        Row: Bid
        Insert: Omit<Bid, 'id' | 'created_at' | 'bidder'>
        Update: Partial<Bid>
      }
      conversations: {
        Row: Conversation
        Insert: Omit<Conversation, 'id' | 'created_at'> & { id?: string }
        Update: Partial<Conversation>
      }
      messages: {
        Row: Message
        Insert: Omit<Message, 'id' | 'created_at'> & { id?: string }
        Update: Partial<Message>
      }
    }
    Functions: {
      place_bid: {
        Args: { p_auction_id: string; p_amount: number; p_max_amount?: number | null }
        Returns: Bid
      }
      append_seller_note: {
        Args: { p_auction_id: string; p_body: string }
        Returns: Auction
      }
      rate_seller: {
        Args: { p_auction_id: string; p_score: number; p_comment?: string | null }
        Returns: SellerRating
      }
      buy_now: {
        Args: { p_auction_id: string }
        Returns: Auction
      }
      close_expired_auctions: {
        Args: Record<string, never>
        Returns: number
      }
      get_or_create_conversation: {
        Args: { p_auction_id: string }
        Returns: Conversation
      }
      mark_conversation_read: {
        Args: { p_conversation_id: string }
        Returns: Conversation
      }
      unread_messages_count: {
        Args: Record<string, never>
        Returns: number
      }
      count_auctions: {
        Args: { p_query?: string | null; p_category_id?: string | null; p_status?: string | null }
        Returns: number
      }
      end_auction: {
        Args: { p_auction_id: string }
        Returns: Auction
      }
    }
  }
}

export type PromotionKind = 'bump' | 'highlight' | 'homepage'

/** public.promotion_packages — prices live in the database */
export type PromotionPackage = {
  id: string
  kind: PromotionKind
  name: string
  description: string
  days: number
  price: number
  sort_order: number
}

/** public.auction_promotions — one purchase of a package (paid only after Stripe's webhook) */
export type AuctionPromotion = {
  id: string
  number: string
  auction_id: string
  package_id: string
  kind: PromotionKind
  package_name: string
  days: number
  amount: number
  status: 'pending' | 'paid' | 'cancelled'
  created_at: string
  paid_at: string | null
  starts_at: string | null
  ends_at: string | null
  checkout_expires_at: string | null
  /** Paid while the same promotion was already running (V48): not applied, to refund */
  refund_needed?: boolean
  auction?: { title: string } | null
}
