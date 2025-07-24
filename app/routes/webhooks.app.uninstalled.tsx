import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { deleteSessions, findSessionsByShop } from "../db.server";

export const action = async (args: ActionFunctionArgs) => {
  const { shop, session, topic } = await authenticate.webhook(args.request, args.context);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Webhook requests can trigger multiple times and after an app has already been uninstalled.
  // If this webhook already ran, the session may have been deleted previously.
  if (session) {
    // Get all sessions for the shop
    const sessions = await findSessionsByShop(args.context, shop);
    const sessionIds = sessions.map(s => s.id);
    
    // Delete all sessions for the shop
    if (sessionIds.length > 0) {
      await deleteSessions(args.context, sessionIds);
    }
  }

  return new Response();
};