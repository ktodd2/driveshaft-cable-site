import { createContext, useContext } from 'react'

// Public catalog/editorial data only. Never seed carts, identities or orders.
export const PublicDataContext = createContext(null)
export const usePublicData = () => useContext(PublicDataContext)
