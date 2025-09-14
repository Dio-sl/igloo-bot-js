// src/database/migrations/002_add_shop_tables.js

/**
 * Add shop tables migration
 */
module.exports = {
  name: 'Add Shop Tables',
  
  /**
   * Apply the migration
   * @param {Object} db - Database connection
   * @returns {Promise<void>}
   */
  async up(db) {
    // Create products table
    await db.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        price DECIMAL(10, 2) NOT NULL,
        image_url TEXT,
        stock INTEGER DEFAULT -1,
        enabled BOOLEAN DEFAULT true,
        category VARCHAR(50),
        roles JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_products_guild_id ON products(guild_id);
      CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
    `);
    
    // Create orders table
    await db.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        order_id VARCHAR(20) UNIQUE NOT NULL,
        guild_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        total DECIMAL(10, 2) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        payment_id VARCHAR(100),
        payment_method VARCHAR(50),
        payment_status VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_orders_guild_id ON orders(guild_id);
      CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
      CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
    `);
    
    // Create order_items table
    await db.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
        quantity INTEGER NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        total DECIMAL(10, 2) NOT NULL,
        delivered BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
      CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
    `);
    
    // Create coupons table
    await db.query(`
      CREATE TABLE IF NOT EXISTS coupons (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        code VARCHAR(50) NOT NULL,
        discount_type VARCHAR(20) NOT NULL,
        discount_amount DECIMAL(10, 2) NOT NULL,
        starts_at TIMESTAMP,
        expires_at TIMESTAMP,
        max_uses INTEGER DEFAULT -1,
        used_count INTEGER DEFAULT 0,
        min_order_amount DECIMAL(10, 2) DEFAULT 0,
        products JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_coupons_guild_id ON coupons(guild_id);
      CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_coupons_guild_code ON coupons(guild_id, code);
    `);
  },
  
  /**
   * Revert the migration
   * @param {Object} db - Database connection
   * @returns {Promise<void>}
   */
  async down(db) {
    // Drop tables in reverse order to avoid foreign key conflicts
    await db.query(`
      DROP TABLE IF EXISTS coupons;
      DROP TABLE IF EXISTS order_items;
      DROP TABLE IF EXISTS orders;
      DROP TABLE IF EXISTS products;
    `);
  }
};