// src/database/Schema.js
const { logger } = require('../utils/logger');

/**
 * Schema - Handles database schema migrations
 */
class Schema {
  /**
   * Create a new Schema instance
   * @param {Object} db - Database connection
   */
  constructor(db) {
    this.db = db;
    this.migrations = [
      require('./migrations/001_initial_schema'),
      require('./migrations/002_add_shop_tables'),
      require('./migrations/003_add_payment_settings'),
    ];
  }

  /**
   * Run all pending migrations
   * @returns {Promise<void>}
   */
  async migrate() {
    try {
      // Create schema_versions table if it doesn't exist
      await this.db.query(`
        CREATE TABLE IF NOT EXISTS schema_versions (
          id SERIAL PRIMARY KEY,
          version INTEGER NOT NULL,
          applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Get current version
      const currentVersion = await this.getCurrentVersion();
      
      // Apply pending migrations
      for (let i = currentVersion; i < this.migrations.length; i++) {
        const migration = this.migrations[i];
        const version = i + 1;
        
        logger.info(`Applying migration ${version}: ${migration.name}`);
        
        try {
          // Start transaction
          await this.db.query('BEGIN');
          
          // Apply migration
          await migration.up(this.db);
          
          // Update schema version
          await this.setVersion(version);
          
          // Commit transaction
          await this.db.query('COMMIT');
          
          logger.info(`Migration ${version} applied successfully`);
        } catch (error) {
          // Rollback transaction on error
          await this.db.query('ROLLBACK');
          
          logger.error(`Migration ${version} failed:`, error);
          throw new Error(`Migration ${version} failed: ${error.message}`);
        }
      }
      
      logger.info('All migrations applied successfully');
    } catch (error) {
      logger.error('Migration process failed:', error);
      throw error;
    }
  }

  /**
   * Get current schema version
   * @returns {Promise<number>} Current version number (0 if no migrations applied)
   */
  async getCurrentVersion() {
    try {
      const result = await this.db.query(`
        SELECT version FROM schema_versions 
        ORDER BY version DESC 
        LIMIT 1
      `);
      
      if (result.rows.length === 0) {
        return 0;
      }
      
      return parseInt(result.rows[0].version, 10);
    } catch (error) {
      // If table doesn't exist yet, return 0
      if (error.message.includes('relation "schema_versions" does not exist')) {
        return 0;
      }
      
      logger.error('Error getting schema version:', error);
      throw error;
    }
  }

  /**
   * Set schema version
   * @param {number} version - New version number
   * @returns {Promise<void>}
   */
  async setVersion(version) {
    try {
      await this.db.query(`
        INSERT INTO schema_versions (version) 
        VALUES ($1)
      `, [version]);
      
      logger.info(`Schema version set to ${version}`);
    } catch (error) {
      logger.error('Error setting schema version:', error);
      throw error;
    }
  }
}

module.exports = Schema;