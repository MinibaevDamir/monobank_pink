// app/routes/app.settings.jsx
import { json } from "@remix-run/node";
import {
  useLoaderData,
  useActionData,
  Form,
  useNavigation,
} from "@remix-run/react";
import { useState, useCallback } from "react";
import {
  Page,
  Card,
  FormLayout,
  TextField,
  Button,
  Banner,
  Layout,
  Text,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { encrypt, decrypt } from "../lib/crypto.server.js";
import { validateLicenseKey } from "../lib/google-sheets.server.js";


export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const { shop } = session;
  const settings = await prisma.monobankSetting.findUnique({ where: { shop } });
  let decryptedToken = "";
  if (settings && settings.apiToken && settings.iv) {
    decryptedToken = decrypt({ content: settings.apiToken, iv: settings.iv });
  }
  return json({
    monobankToken: decryptedToken || "",
    gatewayName: settings?.gatewayName || "",
    activationStatus: settings?.activationStatus || "inactive",
    activatedKey: settings?.activatedKey || "",
  });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const { shop } = session;
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  if (actionType === "activate") {
    const activationKey = formData.get("activationKey");
    if (!activationKey) {
      return json({ error: "Ключ активації не може бути порожнім." });
    }
    const license = await validateLicenseKey(activationKey);
    if (!license.valid) {
      if (license.reason === "expired")
        return json({ error: "Термін дії цього ключа активації закінчився." });
      return json({ error: "Ключ не знайдено або недійсний." });
    }
    await prisma.monobankSetting.upsert({
      where: { shop },
      update: { activationStatus: "active", activatedKey: activationKey },
      create: { shop, activationStatus: "active", activatedKey: activationKey },
    });
    return json({ message: "Додаток успішно активовано!" });
  }

  if (actionType === "saveSettings") {
    const token = formData.get("monobankToken");
    const gatewayName = formData.get("gatewayName");

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
      update: { apiToken: content, iv: iv, gatewayName: gatewayName || null },
      create: {
        shop,
        apiToken: content,
        iv: iv,
        gatewayName: gatewayName || null,
      },
    });
    return json({ message: "Settings saved successfully!" });
  }

  return json({ error: "Невідома дія." }, { status: 400 });
};

export default function SettingsPage() {
  const loaderData = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();

  const [tokenValue, setTokenValue] = useState(loaderData.monobankToken);
  const [gatewayValue, setGatewayName] = useState(loaderData.gatewayName);

  const [activationKeyValue, setActivationKeyValue] = useState("");
  const handleActivationKeyChange = useCallback(
    (value) => setActivationKeyValue(value),
    [],
  );
  const isAppActive = loaderData.activationStatus === "active";

  const handleTokenChange = useCallback(
    (newValue) => setTokenValue(newValue),
    [],
  );
  const handleGatewayChange = useCallback(
    (newValue) => setGatewayName(newValue),
    [],
  );

  const isLoading = navigation.state === "submitting";

  return (
    <Page>
      <ui-title-bar title="Monobank Settings" />
      <Layout>
        {actionData?.message && (
          <Layout.Section>
            <Banner
              title={actionData.message}
              tone="success"
              onDismiss={() => {}}
            />
          </Layout.Section>
        )}
        {actionData?.error && (
          <Layout.Section>
            <Banner
              title={actionData.error}
              tone="critical"
              onDismiss={() => {}}
            />
          </Layout.Section>
        )}

        {!isAppActive && (
          <Layout.Section>
            <Card>
              <Form method="post">
                <FormLayout>
                  <input type="hidden" name="actionType" value="activate" />
                  <Text variant="headingMd" as="h2">
                    Активація додатку
                  </Text>
                  <TextField
                    label="Ключ активації"
                    name="activationKey"
                    value={activationKeyValue}
                    onChange={handleActivationKeyChange}
                    helpText="Введіть ключ, який ви отримали від менеджера."
                    autoComplete="off"
                  />
                  <Button submit loading={isLoading} primary>
                    Активувати
                  </Button>
                </FormLayout>
              </Form>
            </Card>
          </Layout.Section>
        )}

        {isAppActive && (
          <Layout.Section>
            <Card>
              <Form method="post">
                <FormLayout>
                  <input type="hidden" name="actionType" value="saveSettings" />
                  <TextField
                    label="Monobank API Token"
                    name="monobankToken"
                    value={tokenValue}
                    onChange={handleTokenChange}
                    helpText="Вставте ваш токен еквайрингу від Monobank."
                    autoComplete="off"
                    type="password"
                  />
                  <TextField
                    label="Назва платіжного методу"
                    name="gatewayName"
                    value={gatewayValue}
                    onChange={handleGatewayChange}
                    helpText="Введіть точну назву вашого ручного способу оплати, наприклад 'Оплата карткою (Mono)'. Це потрібно для коректної обробки замовлень."
                    autoComplete="off"
                  />
                  <Button submit loading={isLoading} primary>
                    Зберегти
                  </Button>
                </FormLayout>
              </Form>
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}
