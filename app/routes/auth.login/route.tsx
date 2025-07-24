import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData } from "react-router";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { login } from "../../shopify.server";
import { loginErrorMessage } from "./error.server";

export const loader = async (args: LoaderFunctionArgs) => {
  const errors = loginErrorMessage(await login(args.request, args.context));

  return { errors };
};

export const action = async (args: ActionFunctionArgs) => {
  const errors = loginErrorMessage(await login(args.request, args.context));

  return {
    errors,
  };
};

export default function Auth() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [shop, setShop] = useState("");
  const { errors } = actionData || loaderData;

  return (
    <AppProvider embedded={false}>
      <s-page>
        <Form method="post">
          <s-section heading="Log in">
            <s-text-field
              type="text"
              name="shop"
              label="Shop domain"
              helpText="example.myshopify.com"
              value={shop}
              onChange={setShop}
              autoComplete="on"
              error={errors.shop}
            ></s-text-field>
            <s-button submit>Log in</s-button>
          </s-section>
        </Form>
      </s-page>
    </AppProvider>
  );
}