import { supabase } from './supabase'

/**
 * Fetch all products with inventory information
 */
export async function getProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching products:', error)
    throw error
  }

  return data
}

/**
 * Fetch a single product by slug
 */
export async function getProductBySlug(slug) {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (error) {
    console.error('Error fetching product:', error)
    throw error
  }

  return data
}

/**
 * Fetch a single product by ID
 */
export async function getProductById(id) {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching product:', error)
    throw error
  }

  return data
}

/**
 * Check if enough stock is available for a product
 */
export async function checkStockAvailable(productId, quantity) {
  const { data, error } = await supabase
    .rpc('check_stock_available', {
      p_product_id: productId,
      p_quantity: quantity
    })

  if (error) {
    console.error('Error checking stock:', error)
    throw error
  }

  return data
}

/**
 * Deduct inventory for an order (called after payment)
 */
export async function deductInventory(productId, quantity, orderId) {
  const { data, error } = await supabase
    .rpc('deduct_inventory', {
      p_product_id: productId,
      p_quantity: quantity,
      p_order_id: orderId
    })

  if (error) {
    console.error('Error deducting inventory:', error)
    throw error
  }

  return data
}

/**
 * Add inventory (admin only)
 */
export async function addInventory(productId, quantity, reason, notes = null, adminUserId = null) {
  const { data, error } = await supabase
    .rpc('add_inventory', {
      p_product_id: productId,
      p_quantity: quantity,
      p_reason: reason,
      p_notes: notes,
      p_admin_user_id: adminUserId
    })

  if (error) {
    console.error('Error adding inventory:', error)
    throw error
  }

  return data
}

/**
 * Set inventory to a specific amount (admin only)
 */
export async function setInventory(productId, newQuantity, reason, notes = null, adminUserId = null) {
  const { data, error } = await supabase
    .rpc('set_inventory', {
      p_product_id: productId,
      p_new_quantity: newQuantity,
      p_reason: reason,
      p_notes: notes,
      p_admin_user_id: adminUserId
    })

  if (error) {
    console.error('Error setting inventory:', error)
    throw error
  }

  return data
}

/**
 * Get inventory history log for a product
 */
export async function getInventoryLog(productId = null, limit = 100) {
  let query = supabase
    .from('inventory_log')
    .select(`
      *,
      product:products(name, sku),
      admin_user:admin_users(name, email)
    `)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (productId) {
    query = query.eq('product_id', productId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching inventory log:', error)
    throw error
  }

  return data
}

/**
 * Get low stock products
 */
export async function getLowStockProducts() {
  const { data, error } = await supabase
    .from('low_stock_products')
    .select('*')

  if (error) {
    console.error('Error fetching low stock products:', error)
    throw error
  }

  return data
}

/**
 * Get all products for admin (including inactive)
 */
export async function getAllProductsAdmin() {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching products:', error)
    throw error
  }

  return data
}

/**
 * Update product inventory settings
 */
export async function updateProductInventory(productId, updates) {
  const { data, error } = await supabase
    .from('products')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', productId)
    .select()
    .single()

  if (error) {
    console.error('Error updating product:', error)
    throw error
  }

  return data
}
