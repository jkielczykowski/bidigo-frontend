import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'

/** public.feature_flags (bidigo-backend V49): switches the admin flips in bidigo-admin without a deploy. */
type Features = { promotions: boolean }

// Until the flags arrive nothing optional is shown; if they can't be read, everything is (the
// database still refuses what is switched off)
const FeaturesContext = createContext<Features>({ promotions: false })

export function FeaturesProvider({ children }: { children: ReactNode }) {
  const [features, setFeatures] = useState<Features>({ promotions: false })

  useEffect(() => {
    // Read once per page load: a change in the admin panel shows after a refresh
    void supabase
      .from('feature_flags')
      .select('key, enabled')
      .then(({ data, error }) => {
        const flags = new Map(((data as { key: string; enabled: boolean }[] | null) ?? []).map((f) => [f.key, f.enabled]))
        setFeatures({ promotions: error ? true : flags.get('promotions') !== false })
      })
  }, [])

  return <FeaturesContext.Provider value={features}>{children}</FeaturesContext.Provider>
}

/** Paid promotion of auctions: "Promuj", packages, "Promowane" badges, the home section, the history */
export function usePromotionsEnabled() {
  return useContext(FeaturesContext).promotions
}
