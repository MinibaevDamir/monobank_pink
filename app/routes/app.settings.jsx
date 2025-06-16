// app/routes/app.settings.jsx
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useNavigation } from "@remix-run/react";
import { Page, Card, FormLayout, TextField, Button, Banner, Layout } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { encrypt, decrypt } from "../lib/crypto.server.js";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const { shop } = session;

  const settings = await prisma.monobankSetting.findUnique({ where: { shop } });
  let decryptedToken = "";
  if (settings && settings.apiToken && settings.iv) {
    decryptedToken = decrypt({ content: settings.apiToken, iv: settings.iv });
  }

  return json({ monobankToken: decryptedToken || "" });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const { shop } = session;

  const formData = await request.formData();
  const token = formData.get("monobankToken");

  if (typeof token !== "string") {
    return json({ error: "Invalid token format." }, { status: 400 });
  }

  if (token === "") {
    await prisma.monobankSetting.deleteMany({ where: { shop } });
    return json({ message: "Token has been cleared." });
  }

  const { iv, content } = encrypt(token);

  await prisma.monobankSetting.upsert({
    where: { shop },
    update: { apiToken: content, iv: iv },
    create: { shop, apiToken: content, iv: iv },
  });

  return json({ message: "Settings saved successfully!" });
};

export default function SettingsPage() {
  const loaderData = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();

  const isLoading = navigation.state === "submitting";

  return (
    <Page>
      <ui-title-bar title="Monobank Settings" />
      <Layout>
        <Layout.Section>
          {actionData?.message && (
            <div style={{ marginBottom: "1rem" }}>
              <Banner title={actionData.message} tone="success" onDismiss={() => {}} />
            </div>
          )}
          {actionData?.error && (
            <div style={{ marginBottom: "1rem" }}>
              <Banner title={actionData.error} tone="critical" onDismiss={() => {}} />
            </div>
          )}
          <Card>
            <Form method="post">
              <FormLayout>
                <TextField
                  label="Monobank API Token"
                  name="monobankToken"
                  defaultValue={loaderData.monobankToken}
                  helpText="Вставте ваш токен еквайрингу від Monobank."
                  autoComplete="off"
                  type="password"
                />
                <Button submit loading={isLoading} primary>
                  Зберегти
                </Button>
              </FormLayout>
            </Form>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}