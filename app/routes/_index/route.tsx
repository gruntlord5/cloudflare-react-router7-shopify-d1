import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { Form, useLoaderData, useNavigate } from "react-router";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { login } from "../../shopify.server";

const APP_NAME = "Shopify App Template - Cloudflare Workers";
const APP_HANDLE = "cf-worker-shopify";


export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  return (
    <AppProvider embedded={false}>
      <s-page>
        <s-section heading="Welcome to Shopify App Template - Cloudflare Workers">
          <s-paragraph>
            This is an example of what your domain would look like if a user visits from outside of Shopify App Bridge. You can customize this page to your liking, just make sure to enter the
            information for your application and remove this placeholder.
          </s-paragraph>
          <div style={{ 
            textAlign: 'center',
            padding: '20px 0'
          }}>
            <a href="https://deploy.workers.cloudflare.com/?url=https://github.com/gruntlord5/cloudflare-worker-shopifyd1/">
              <img src="https://deploy.workers.cloudflare.com/button" alt="Deploy to Cloudflare"/>
            </a>
          </div>
          <s-paragraph>
            Just enter your shopify domain below and click log in. For example{' '}
            <s-link href="https://admin.shopify.com/apps/bulk-product-categories/app">
              example-store.myshopify.com
            </s-link>.
          </s-paragraph>
        </s-section>

        {showForm && (
          <s-section heading="Log in">
            <Form method="post" action="/auth/login">
              <s-stack direction="block" gap="base">
                <s-text-field
                  label="Shop domain"
                  type="text"
                  name="shop"
                  helpText="e.g: example-store.myshopify.com"
                  autoComplete="off"
                />
                <s-button submit primary>
                  Log in
                </s-button>
              </s-stack>
            </Form>
          </s-section>
        )}

        <s-section heading="Privacy Policy">
          <s-paragraph>
            For information about how we handle your data, please review our{' '}
            <s-link onClick={() => navigate('/privacypolicy')}>
              Privacy Policy
            </s-link>.
          </s-paragraph>
        </s-section>
      </s-page>
    </AppProvider>
  );
}