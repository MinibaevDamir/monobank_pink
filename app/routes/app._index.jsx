// app/routes/app._index.jsx
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Banner,
  Link,
  Text,
  BlockStack,
} from "@shopify/polaris";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const { shop } = session;

  const settings = await prisma.monobankSetting.findUnique({
    where: { shop },
  });

  const isAppActive = settings?.activationStatus === "active";

  return json({
    isAppActive,
    isTokenSet: !!settings,
  });
};

export default function Index() {
  const { isAppActive, isTokenSet } = useLoaderData();
  let statusContent;

  if (!isAppActive) {
    statusContent = (
      <Banner
        title="Додаток не активовано"
        tone="critical"
        action={{ content: "Активувати зараз", url: "/app/settings" }}
      >
        <p>Будь ласка, введіть ваш ключ активації на сторінці налаштувань.</p>
      </Banner>
    );
  } else if (!isTokenSet) {
    statusContent = (
      <Banner
        title="Додаток активовано, але потребує налаштування"
        tone="warning"
        action={{ content: "Перейти до налаштувань", url: "/app/settings" }}
      >
        <p>Будь ласка, додайте ваш API токен Monobank.</p>
      </Banner>
    );
  } else {
    statusContent = (
      <Banner
        title="Додаток активовано та готовий до роботи"
        tone="success"
        action={{ content: "Переглянути налаштування", url: "/app/settings" }}
      />
    );
  }

  return (
    <Page>
      <ui-title-bar title="Monobank Integration" />
      <Layout>
        <Layout.Section>{statusContent}</Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Вітаємо у додатку інтеграції з Monobank!
              </Text>
              <Text as="p">
                Цей додаток дозволяє автоматизувати прийом платежів через
                еквайринг Monobank для замовлень, оформлених з ручним способом
                оплати.
              </Text>
              <Text as="p">
                Поточний статус налаштувань ви можете бачити у повідомленні
                вище. Для зміни налаштувань перейдіть на сторінку{" "}
                <Link url="/app/settings">Налаштування</Link>.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
