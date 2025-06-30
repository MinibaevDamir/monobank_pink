import { useState, useEffect } from "react";
import {
  reactExtension,
  useApi,
  Banner,
  Button,
  Link,
  BlockStack,
  Spinner,
} from "@shopify/ui-extensions-react/checkout";

const THANK_YOU_PAGE_TARGET = "purchase.thank-you.block.render";

export default reactExtension(THANK_YOU_PAGE_TARGET, () => <App />);

function App() {
  const { query, orderConfirmation, cost } = useApi();

  const [paymentUrl, setPaymentUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  useEffect(() => {
    const order = orderConfirmation?.current.order;

    if (!order || !order.id) {
      setIsLoading(false);
      return;
    }

    const numericOrderId = order.id.match(/\d+/g).join("");

    const appBaseUrl = "https://monobank-proxy.doubletopiua433.workers.dev/";
    const paymentLinkEndpoint = `${appBaseUrl}${numericOrderId}?domain=monobank-pink.onrender.com`;

    console.log(
      `[Monobank App] Order ${numericOrderId} is unpaid. Fetching payment link...`,
    );

    function fetchPaymentLink(retries = 5, delay = 1500) {
      fetch(paymentLinkEndpoint, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })
        .then((response) => {
          console.log(
            `[Monobank App] Response: ${(response.data, response.status, retries)}`,
          );
          if (response.ok) {
            return response.json();
          }

          if (response.status >= 400 && retries > 0) {
            console.log(
              `[Monobank App] Link not ready (Status: ${response.status}). Retrying... (${retries} retries left)`,
            );

            setTimeout(() => fetchPaymentLink(retries - 1, delay), delay);

            return Promise.reject("Retrying...");
          }

          throw new Error(
            `Failed to fetch payment link. Final status: ${response.status}`,
          );
        })
        .then((data) => {
          if (data && data.paymentUrl) {
            console.log("[Monobank App] Payment link received.");
            setPaymentUrl(data.paymentUrl);
            setIsLoading(false);
            return;
          } else {
            throw new Error("Payment URL not found in API response.");
          }
        })
        .catch((err) => {
          if (err !== "Retrying...") {
            console.error(
              `[Monobank App] Could not retrieve payment link for order ${numericOrderId}.`,
              err,
            );
            setIsLoading(false);
            setError(
              "Не вдалося отримати посилання на оплату. Будь ласка, оновіть сторінку.",
            );
          }
        })
        .finally(() => {
          if (error || paymentUrl) {
            setIsLoading(false);
          }
        });
    }

    fetchPaymentLink();
  }, [query, orderConfirmation, cost]);

  if (isLoading) {
    return <Spinner />;
  }

  if (error) {
    return <Banner status="critical">{error}</Banner>;
  }

  if (paymentUrl) {
    return (
      <Banner title="Завершіть ваше замовлення" status="info">
        <BlockStack spacing="base">
          <Link external={true} to={paymentUrl}>
            <Button role="button">
              Перейти до оплати (₴{cost.totalAmount.current.amount})
            </Button>
          </Link>
          <Link to={paymentUrl} external={true}>
            (Якщо кнопка не працює, натисніть тут)
          </Link>
        </BlockStack>
      </Banner>
    );
  }

  return null;
}
