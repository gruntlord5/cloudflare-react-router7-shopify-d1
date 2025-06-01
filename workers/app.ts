import { createRequestHandler } from "react-router";
import { initializeShopifySessionsTable } from "../app/db.server";

// Define your Env type with all your bindings
interface Env {
  DB: D1Database;
  DB2?: D1Database;  // Optional secondary database
  DB3?: D1Database;  // Optional tertiary database
  SHOPIFY_API_KEY: string;
  SHOPIFY_API_SECRET: string;
  SHOPIFY_APP_URL: string;
  SCOPES?: string;
  SHOP_CUSTOM_DOMAIN?: string;
}

declare module "react-router" {
  export interface AppLoadContext {
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
    db: D1Database;
    db2?: D1Database;  // Optional secondary database
    db3?: D1Database;  // Optional tertiary database
  }
}

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    try {
      // Create the load context that includes direct access to all bindings
      const loadContext = {
        cloudflare: {
          env,
          ctx,
        },
        // Pass databases directly in context
        db: env.DB,
        db2: env.DB2,  // Will be undefined if not bound
        db3: env.DB3,  // Will be undefined if not bound
      };

      // Initialize Shopify sessions table on startup
      try {
        await initializeShopifySessionsTable(loadContext);
      } catch (error) {
        console.error('Failed to initialize Shopify sessions table:', error);
      }
      
      return requestHandler(request, loadContext);
    } catch (error) {
      console.error('Worker error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;