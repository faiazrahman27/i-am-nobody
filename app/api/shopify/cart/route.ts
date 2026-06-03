import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CartLineInput = {
  merchandiseId: string;
  quantity: number;
};

type ShopifyCartCreateResponse = {
  data?: {
    cartCreate?: {
      cart?: {
        id: string;
        checkoutUrl: string;
      } | null;
      userErrors?: Array<{
        field?: string[] | null;
        message: string;
      }>;
    };
  };
  errors?: Array<{
    message?: string;
  }>;
};

const MAX_CART_LINES = 100;
const MAX_QUANTITY_PER_LINE = 99;
const SHOPIFY_VARIANT_GID_PATTERN = /^gid:\/\/shopify\/ProductVariant\/[0-9]+$/;

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function normalizeStoreDomain(rawDomain: string | undefined) {
  if (!rawDomain) return "";

  const domain = rawDomain
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();

  if (!/^[a-z0-9.-]+$/.test(domain)) return "";
  return domain;
}

function normalizeCartLines(rawLines: unknown): CartLineInput[] {
  if (!Array.isArray(rawLines)) return [];

  const merged = new Map<string, number>();

  rawLines.slice(0, MAX_CART_LINES).forEach((line) => {
    if (!line || typeof line !== "object") return;

    const record = line as Record<string, unknown>;
    const merchandiseId = typeof record.merchandiseId === "string" ? record.merchandiseId.trim() : "";
    const quantity = Number(record.quantity);

    if (!SHOPIFY_VARIANT_GID_PATTERN.test(merchandiseId)) return;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY_PER_LINE) return;

    const existingQuantity = merged.get(merchandiseId) || 0;
    merged.set(merchandiseId, Math.min(existingQuantity + quantity, MAX_QUANTITY_PER_LINE));
  });

  return Array.from(merged.entries()).map(([merchandiseId, quantity]) => ({
    merchandiseId,
    quantity,
  }));
}

function buildCartCreateMutation() {
  return `mutation IamNobodyCartCreate($input: CartInput!) {
    cartCreate(input: $input) {
      cart {
        id
        checkoutUrl
      }
      userErrors {
        field
        message
      }
    }
  }`;
}

export async function POST(request: NextRequest) {
  const storeDomain = normalizeStoreDomain(process.env.SHOPIFY_STORE_DOMAIN);
  const storefrontAccessToken = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN?.trim() || "";
  const apiVersion = process.env.SHOPIFY_API_VERSION?.trim() || "2025-10";

  if (!storeDomain || !storefrontAccessToken) {
    return jsonResponse(
      {
        error: "Shopify checkout is not configured.",
      },
      500
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonResponse(
      {
        error: "Invalid JSON body.",
      },
      400
    );
  }

  const rawLines = body && typeof body === "object" ? (body as Record<string, unknown>).lines : null;
  const lines = normalizeCartLines(rawLines);

  if (!lines.length) {
    return jsonResponse(
      {
        error: "Cart is empty or contains invalid items.",
      },
      400
    );
  }

  const endpoint = `https://${storeDomain}/api/${apiVersion}/graphql.json`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": storefrontAccessToken,
      },
      body: JSON.stringify({
        query: buildCartCreateMutation(),
        variables: {
          input: {
            lines,
          },
        },
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      return jsonResponse(
        {
          error: "Shopify cart creation failed.",
        },
        502
      );
    }

    const payload = (await response.json()) as ShopifyCartCreateResponse;

    if (payload.errors?.length) {
      return jsonResponse(
        {
          error: payload.errors[0]?.message || "Shopify returned an error.",
        },
        502
      );
    }

    const userErrors = payload.data?.cartCreate?.userErrors || [];

    if (userErrors.length) {
      return jsonResponse(
        {
          error: userErrors[0]?.message || "Shopify rejected the cart.",
          userErrors,
        },
        400
      );
    }

    const cart = payload.data?.cartCreate?.cart;

    if (!cart?.checkoutUrl) {
      return jsonResponse(
        {
          error: "Shopify did not return a checkout URL.",
        },
        502
      );
    }

    return jsonResponse({
      cartId: cart.id,
      checkoutUrl: cart.checkoutUrl,
    });
  } catch {
    return jsonResponse(
      {
        error: "Shopify cart creation failed.",
      },
      502
    );
  }
}
