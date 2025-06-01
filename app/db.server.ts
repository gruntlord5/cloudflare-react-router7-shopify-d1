import { D1Database } from "@cloudflare/workers-types";
import { Session } from "@shopify/shopify-api";

export interface DatabaseContext {
  db?: D1Database;
  cloudflare?: {
    env?: {
      DB?: D1Database;
    };
  };
}

// Get database from context with fallback
export function getDatabaseFromContext(context: DatabaseContext): D1Database {
  const db = context?.db || context?.cloudflare?.env?.DB;
  
  if (!db || typeof db.prepare !== 'function') {
    throw new Error('D1Database is not available in context');
  }
  
  return db;
}

// Initialize the Shopify sessions table
export async function initializeShopifySessionsTable(context: DatabaseContext): Promise<boolean> {
  try {
    const db = getDatabaseFromContext(context);
    
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS shopify_sessions (
        id TEXT PRIMARY KEY,
        shop TEXT NOT NULL,
        state TEXT,
        isOnline INTEGER,
        scope TEXT,
        accessToken TEXT,
        expires INTEGER,
        onlineAccessInfo TEXT
      )
    `).run();
    
    console.log("Shopify sessions table initialized successfully");
    return true;
  } catch (error) {
    console.error("Failed to initialize Shopify sessions table:", error);
    return false;
  }
}

// Store a session in the database
export async function storeSession(context: DatabaseContext, session: Session): Promise<boolean> {
  try {
    const db = getDatabaseFromContext(context);
    
    await db.prepare(`
      INSERT OR REPLACE INTO shopify_sessions 
      (id, shop, state, isOnline, scope, accessToken, expires, onlineAccessInfo) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      session.id,
      session.shop,
      session.state,
      session.isOnline ? 1 : 0,
      session.scope,
      session.accessToken,
      session.expires ? session.expires.getTime() : null,
      session.onlineAccessInfo ? JSON.stringify(session.onlineAccessInfo) : null
    ).run();
    
    return true;
  } catch (error) {
    console.error("Failed to store session:", error);
    return false;
  }
}

// Load a session from the database
export async function loadSession(context: DatabaseContext, id: string): Promise<Session | undefined> {
  try {
    const db = getDatabaseFromContext(context);
    
    const result = await db.prepare("SELECT * FROM shopify_sessions WHERE id = ?").bind(id).first();
    
    if (!result) return undefined;
    
    return reconstructSession(result);
  } catch (error) {
    console.error("Failed to load session:", error);
    return undefined;
  }
}

// Delete a session from the database
export async function deleteSession(context: DatabaseContext, id: string): Promise<boolean> {
  try {
    const db = getDatabaseFromContext(context);
    
    await db.prepare("DELETE FROM shopify_sessions WHERE id = ?").bind(id).run();
    return true;
  } catch (error) {
    console.error("Failed to delete session:", error);
    return false;
  }
}

// Delete multiple sessions from the database
export async function deleteSessions(context: DatabaseContext, ids: string[]): Promise<boolean> {
  try {
    const db = getDatabaseFromContext(context);
    
    // Use a more efficient batch delete approach
    if (ids.length === 0) return true;
    
    const placeholders = ids.map(() => '?').join(',');
    await db.prepare(`DELETE FROM shopify_sessions WHERE id IN (${placeholders})`).bind(...ids).run();
    
    return true;
  } catch (error) {
    console.error("Failed to delete sessions:", error);
    return false;
  }
}

// Find all sessions for a shop
export async function findSessionsByShop(context: DatabaseContext, shop: string): Promise<Session[]> {
  try {
    const db = getDatabaseFromContext(context);
    
    const results = await db.prepare("SELECT * FROM shopify_sessions WHERE shop = ?").bind(shop).all();
    
    return results.results.map(result => reconstructSession(result));
  } catch (error) {
    console.error("Failed to find sessions by shop:", error);
    return [];
  }
}

// Helper function to reconstruct a Session object from database result
function reconstructSession(result: any): Session {
  const session = new Session({
    id: result.id as string,
    shop: result.shop as string,
    state: result.state as string,
    isOnline: Boolean(result.isOnline),
  });

  session.scope = result.scope as string;
  session.accessToken = result.accessToken as string;
  
  if (result.expires) {
    session.expires = new Date(result.expires as number);
  }
  
  if (result.onlineAccessInfo) {
    session.onlineAccessInfo = JSON.parse(result.onlineAccessInfo as string);
  }
  
  return session;
}