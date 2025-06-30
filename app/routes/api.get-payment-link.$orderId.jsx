import { json } from "@remix-run/node";
import prisma from "../db.server";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const options = async () => {
  return new Response(null, {
    status: 204,
    headers,
  });
};

export const loader = async ({ params }) => {
  const { orderId } = params;

  if (!orderId) {
    return json({ error: "Order ID is missing" }, { status: 400, headers });
  }

  let shopifyOrderIdAsBigInt;
  try {
    shopifyOrderIdAsBigInt = BigInt(orderId);
  } catch (e) {
    return json({ error: "Invalid Order ID format" }, { status: 400, headers });
  }

  for (let i = 0; i < 5; i++) {
    const payment = await prisma.pendingPayment.findUnique({
      where: { shopifyOrderId: shopifyOrderIdAsBigInt },
    });

    if (payment) {
      console.log(
        `[API] /get-payment-link/ Found payment link for order ${orderId}.`,
      );
      return json(
        { paymentUrl: payment.monobankPageUrl },
        {
          headers,
        },
      );
    }

    if (i < 4) {
      console.log(
        `[API] /get-payment-link/ Payment link for order ${orderId} not found. Retrying...`,
      );
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  console.warn(
    `[API] /get-payment-link/ Payment link not found for order ${orderId} after all retries.`,
  );
  return json(
    { error: "Payment link not found" },
    {
      status: 404,
      headers,
    },
  );
};
