import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const action = async (args: ActionFunctionArgs) => {
    const { payload, session, topic, shop } = await authenticate.webhook(args.request, args.context);

    console.log(`Received ${topic} webhook for ${shop}`, payload);

    // Handle scope update logic here if needed
    // For example, you might want to update the session with new scopes

    return new Response();
};