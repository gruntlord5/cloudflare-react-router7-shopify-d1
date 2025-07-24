// Database configuration
export const DATABASE_CONFIG = [
  { key: 'DB', name: 'Primary Database', tableName: 'example_table_db1', settingKey: 'test_checkbox_db1' },
  { key: 'DB2', name: 'Secondary Database', tableName: 'example_table_db2', settingKey: 'test_checkbox_db2' },
  { key: 'DB3', name: 'Tertiary Database', tableName: 'example_table_db3', settingKey: 'test_checkbox_db3' }
] as const;

export type DatabaseKey = typeof DATABASE_CONFIG[number]['key'];
export type DatabaseConfig = typeof DATABASE_CONFIG[number];

/**
 * Helper function to get database from context by key
 * @param context - React Router context
 * @param dbKey - Database key (DB, DB2, DB3)
 */
function getDatabaseFromContext(context: any, dbKey: string): D1Database | null {
  // Try direct access first, then nested cloudflare.env access
  return context?.[dbKey.toLowerCase()] || context?.cloudflare?.env?.[dbKey] || null;
}

/**
 * Helper function to initialize a database table
 * @param db - D1 Database instance
 * @param tableName - Name of the table to create
 * @param schema - Table schema definition
 */
async function createTableIfNotExists(db: D1Database, tableName: string, schema: string): Promise<boolean> {
  if (!db || typeof db.prepare !== 'function') {
    throw new Error('D1Database is not available');
  }

  try {
    await db.prepare(`CREATE TABLE IF NOT EXISTS ${tableName} (${schema})`).run();
    return true;
  } catch (error) {
    console.error(`Failed to create table ${tableName}:`, error);
    throw error;
  }
}

/**
 * Helper function to get a setting from the database
 * @param db - D1 Database instance
 * @param tableName - Name of the table
 * @param key - Setting key to retrieve
 */
async function getSetting(db: D1Database, tableName: string, key: string): Promise<any> {
  if (!db || typeof db.prepare !== 'function') {
    throw new Error('D1Database is not available');
  }

  try {
    const result = await db.prepare(`SELECT * FROM ${tableName} WHERE key = ?`).bind(key).first();
    return result;
  } catch (error) {
    console.error(`Failed to get setting ${key}:`, error);
    throw error;
  }
}

/**
 * Helper function to get all settings from the database
 * @param db - D1 Database instance
 * @param tableName - Name of the table
 */
async function getAllSettings(db: D1Database, tableName: string): Promise<D1Result<any>> {
  if (!db || typeof db.prepare !== 'function') {
    throw new Error('D1Database is not available');
  }

  try {
    const result = await db.prepare(`SELECT * FROM ${tableName} ORDER BY updated_at DESC`).all();
    return result;
  } catch (error) {
    console.error(`Failed to get all settings:`, error);
    throw error;
  }
}

/**
 * Helper function to update a setting in the database
 * @param db - D1 Database instance
 * @param tableName - Name of the table
 * @param key - Setting key
 * @param value - Setting value
 */
async function updateSetting(db: D1Database, tableName: string, key: string, value: string): Promise<boolean> {
  if (!db || typeof db.prepare !== 'function') {
    throw new Error('D1Database is not available');
  }

  try {
    const timestamp = Date.now();
    await db.prepare(`INSERT OR REPLACE INTO ${tableName} (key, value, updated_at) VALUES (?, ?, ?)`)
      .bind(key, value, timestamp)
      .run();
    return true;
  } catch (error) {
    console.error(`Failed to update setting ${key}:`, error);
    throw error;
  }
}

/**
 * Load settings for a specific database
 * @param context - React Router context
 * @param config - Database configuration object
 */
export async function loadDatabaseSettings(context: any, config: DatabaseConfig) {
  const db = getDatabaseFromContext(context, config.key);
  
  let data = {
    key: config.key,
    name: config.name,
    tableName: config.tableName,
    isChecked: false,
    dbAvailable: false,
    allSettings: [],
    error: null as string | null
  };

  if (!db || typeof db.prepare !== 'function') {
    data.error = `${config.name} is not available`;
    return data;
  }

  try {
    // Create the settings table if it doesn't exist
    await createTableIfNotExists(
      db,
      config.tableName,
      'key TEXT PRIMARY KEY, value TEXT, updated_at INTEGER'
    );
    
    // Retrieve the current value of the checkbox setting
    const result = await getSetting(db, config.tableName, config.settingKey);
    console.log(`Loading setting for ${config.key}:`, result);
    
    // Convert string value to boolean
    const isChecked = result && result.value === "true";
    console.log(`Converted isChecked for ${config.key}:`, isChecked);
    
    // Fetch all settings to display in the UI table
    const allSettings = await getAllSettings(db, config.tableName);
    
    // Update response data
    data = {
      ...data,
      isChecked,
      dbAvailable: true,
      allSettings: allSettings.results || [],
      error: null
    };
  } catch (error) {
    console.error(`Database error for ${config.name}:`, error);
    data.error = error instanceof Error ? error.message : String(error);
  }
  
  return data;
}

/**
 * Load settings for all configured databases
 * @param context - React Router context
 */
export async function loadAllDatabaseSettings(context: any) {
  const databases = await Promise.all(
    DATABASE_CONFIG.map(config => loadDatabaseSettings(context, config))
  );
  
  return databases;
}

/**
 * Update a setting for a specific database
 * @param context - React Router context
 * @param dbKey - Database key
 * @param isChecked - New checkbox state
 */
export async function updateDatabaseSetting(context: any, dbKey: string, isChecked: boolean) {
  const config = DATABASE_CONFIG.find(c => c.key === dbKey);
  if (!config) {
    return { success: false, error: "Invalid database key" };
  }

  const db = getDatabaseFromContext(context, config.key);
  
  if (!db || typeof db.prepare !== 'function') {
    return { success: false, error: `${config.name} is not available` };
  }

  try {
    // Update the setting using direct database calls
    const valueToSave = isChecked ? "true" : "false";
    console.log(`Saving setting for ${config.key}: ${valueToSave}`);
    await updateSetting(db, config.tableName, config.settingKey, valueToSave);
    
    // Fetch the updated settings list
    const allSettings = await getAllSettings(db, config.tableName);
    
    // Return success response with updated data
    return { 
      success: true,
      dbKey,
      isChecked,
      allSettings: allSettings.results || []
    };
  } catch (error) {
    console.error(`Database error saving setting for ${config.name}:`, error);
    return { 
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Get configuration for a specific database
 * @param dbKey - Database key
 */
export function getDatabaseConfig(dbKey: string): DatabaseConfig | undefined {
  return DATABASE_CONFIG.find(config => config.key === dbKey);
}

/**
 * Check if a database is available in the context
 * @param context - React Router context
 * @param dbKey - Database key
 */
export function isDatabaseAvailable(context: any, dbKey: string): boolean {
  const db = getDatabaseFromContext(context, dbKey);
  return !!(db && typeof db.prepare === 'function');
}

/**
 * Get debug information about available databases
 * @param context - React Router context
 */
export function getDatabaseDebugInfo(context: any) {
  return {
    contextKeys: Object.keys(context || {}),
    hasDb: !!context?.db,
    hasDb2: !!context?.db2,
    hasDb3: !!context?.db3,
    hasCloudflare: !!context?.cloudflare,
    cloudflareKeys: Object.keys(context?.cloudflare || {}),
    hasEnv: !!context?.cloudflare?.env,
    envKeys: Object.keys(context?.cloudflare?.env || {}),
    cloudflareDbTypes: {
      DB: typeof context?.cloudflare?.env?.DB,
      DB2: typeof context?.cloudflare?.env?.DB2,
      DB3: typeof context?.cloudflare?.env?.DB3,
    },
    directDbTypes: {
      db: typeof context?.db,
      db2: typeof context?.db2,
      db3: typeof context?.db3,
    }
  };
}