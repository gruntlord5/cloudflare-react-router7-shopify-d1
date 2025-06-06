import "@brandboostinggmbh/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@brandboostinggmbh/shopify-app-react-router/server";
import { D1Database } from "@cloudflare/workers-types";
import { Session } from "@shopify/shopify-api";
import { SessionStorage } from "@shopify/shopify-app-session-storage";
import type { AppLoadContext } from "react-router";

// Define type for the global DB
declare global {
  var shopifyDb: D1Database | undefined;
  var shopifyAppInstance: ReturnType<typeof shopifyApp> | undefined;
}

// Create a D1 session storage adapter
class D1SessionStorage implements SessionStorage {
  async storeSession(session: Session): Promise<boolean> {
    const db = globalThis.shopifyDb;
    if (!db) {
      console.error("D1 database not initialized");
      return false;
    }

    try {
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

  async loadSession(id: string): Promise<Session | undefined> {
    const db = globalThis.shopifyDb;
    if (!db) {
      console.error("D1 database not initialized");
      return undefined;
    }

    try {
      const result = await db.prepare(`
        SELECT * FROM shopify_sessions WHERE id = ?
      `).bind(id).first();
      
      if (!result) return undefined;
      
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
    } catch (error) {
      console.error("Failed to load session:", error);
      return undefined;
    }
  }

  async deleteSession(id: string): Promise<boolean> {
    const db = globalThis.shopifyDb;
    if (!db) {
      console.error("D1 database not initialized");
      return false;
    }

    try {
      await db.prepare(`
        DELETE FROM shopify_sessions WHERE id = ?
      `).bind(id).run();
      return true;
    } catch (error) {
      console.error("Failed to delete session:", error);
      return false;
    }
  }

  async deleteSessions(ids: string[]): Promise<boolean> {
    const db = globalThis.shopifyDb;
    if (!db) {
      console.error("D1 database not initialized");
      return false;
    }

    try {
      for (const id of ids) {
        await this.deleteSession(id);
      }
      return true;
    } catch (error) {
      console.error("Failed to delete sessions:", error);
      return false;
    }
  }

  async findSessionsByShop(shop: string): Promise<Session[]> {
    const db = globalThis.shopifyDb;
    if (!db) {
      console.error("D1 database not initialized");
      return [];
    }

    try {
      const results = await db.prepare(`
        SELECT * FROM shopify_sessions WHERE shop = ?
      `).bind(shop).all();
      
      return results.results.map(result => {
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
      });
    } catch (error) {
      console.error("Failed to find sessions by shop:", error);
      return [];
    }
  }
}

// Create a single instance of the session storage
const sessionStorage = new D1SessionStorage();

// Function to get or create the Shopify app instance
function getShopifyApp() {
  if (!globalThis.shopifyAppInstance) {
    globalThis.shopifyAppInstance = shopifyApp({
      apiKey: process.env.SHOPIFY_API_KEY,
      apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
      apiVersion: ApiVersion.January25,
      scopes: process.env.SCOPES?.split(","),
      appUrl: process.env.SHOPIFY_APP_URL || "",
      authPathPrefix: "/auth",
      sessionStorage,
      distribution: AppDistribution.AppStore,
      future: {
        unstable_newEmbeddedAuthStrategy: true,
        removeRest: true,
      },
      ...(process.env.SHOP_CUSTOM_DOMAIN
        ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
        : {}),
    });
  }
  return globalThis.shopifyAppInstance;
}

// Function to set up database from context
export function setupShopifyDb(context: AppLoadContext) {
  if (!globalThis.shopifyDb) {
    globalThis.shopifyDb = context.db || context.cloudflare?.env?.DB;
    if (globalThis.shopifyDb) {
      initializeDb(globalThis.shopifyDb).catch(console.error);
    }
  }
}

export const apiVersion = ApiVersion.January25;

// Updated exports that set up database from context
export const addDocumentResponseHeaders = (response: Response, request: Request, context: AppLoadContext) => {
  setupShopifyDb(context);
  return getShopifyApp().addDocumentResponseHeaders(response, request);
};

export const authenticate = {
  admin: (request: Request, context: AppLoadContext) => {
    setupShopifyDb(context);
    return getShopifyApp().authenticate.admin(request);
  },
  public: (request: Request, context: AppLoadContext) => {
    setupShopifyDb(context);
    return getShopifyApp().authenticate.public(request);
  }
};

export const unauthenticated = {
  admin: (request: Request, context: AppLoadContext) => {
    setupShopifyDb(context);
    return getShopifyApp().unauthenticated.admin(request);
  },
  public: (request: Request, context: AppLoadContext) => {
    setupShopifyDb(context);
    return getShopifyApp().unauthenticated.public(request);
  }
};

export const login = (request: Request, context: AppLoadContext) => {
  setupShopifyDb(context);
  return getShopifyApp().login(request);
};

export const registerWebhooks = (request: Request, context: AppLoadContext) => {
  setupShopifyDb(context);
  return getShopifyApp().registerWebhooks(request);
};

// Function to initialize the database for the session storage
export async function initializeDb(db: D1Database) {
  try {
    // Create the sessions table if it doesn't exist - all on one line
    await db.exec(`CREATE TABLE IF NOT EXISTS shopify_sessions (id TEXT PRIMARY KEY, shop TEXT NOT NULL, state TEXT, isOnline INTEGER, scope TEXT, accessToken TEXT, expires INTEGER, onlineAccessInfo TEXT)`);

    console.log("D1 database initialized successfully for session storage");
    return true;
  } catch (error) {
    console.error("Failed to initialize D1 database:", error);
    return false;
  }
}

// Helper function for backwards compatibility
export function getShopifyHelpers(context: AppLoadContext) {
  setupShopifyDb(context);
  return {
    shopify: getShopifyApp(),
  };
}

export default {
  apiVersion,
  authenticate,
  unauthenticated,
  login,
  registerWebhooks,
  addDocumentResponseHeaders
};