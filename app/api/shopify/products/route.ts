import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ShopifyMoney = {
  amount: string;
  currencyCode: string;
};

type ShopifyImage = {
  url: string;
  altText: string | null;
};

type ShopifyProductNode = {
  id: string;
  handle: string;
  title: string;
  description: string;
  availableForSale: boolean;
  onlineStoreUrl: string | null;
  featuredImage: ShopifyImage | null;
  priceRange: {
    minVariantPrice: ShopifyMoney;
  };
  compareAtPriceRange: {
    minVariantPrice: ShopifyMoney;
  };
  variants: {
    nodes: Array<{
      id: string;
      availableForSale: boolean;
    }>;
  };
};

type ShopifyGraphQLResponse = {
  data?: Record<string, ShopifyProductNode | null>;
  errors?: Array<{ message?: string }>;
};

const HANDLE_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const MAX_HANDLES = 60;

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

function getRequestedHandles(request: NextRequest) {
  const rawHandles = request.nextUrl.searchParams.get("handles") || "";

  return Array.from(
    new Set(
      rawHandles
        .split(",")
        .map((handle) => handle.trim().toLowerCase())
        .filter((handle) => HANDLE_PATTERN.test(handle))
    )
  ).slice(0, MAX_HANDLES);
}

function buildProductsQuery(handles: string[]) {
  const productQueries = handles
    .map(
      (handle, index) => `p${index}: productByHandle(handle: ${JSON.stringify(handle)}) {
        id
        handle
        title
        description
        availableForSale
        onlineStoreUrl
        featuredImage {
          url(transform: { maxWidth: 900 })
          altText
        }
        priceRange {
          minVariantPrice {
            amount
            currencyCode
          }
        }
        compareAtPriceRange {
          minVariantPrice {
            amount
            currencyCode
          }
        }
        variants(first: 1) {
          nodes {
            id
            availableForSale
          }
        }
      }`
    )
    .join("\n");

  return `query IamNobodyProducts {
    ${productQueries}
  }`;
}

function normalizeProducts(data: Record<string, ShopifyProductNode | null> | undefined) {
  const products: Record<string, unknown> = {};

  if (!data) return products;

  Object.values(data).forEach((product) => {
    if (!product || !product.handle) return;

    const firstVariant = product.variants.nodes[0] || null;
    const compareAtPrice = product.compareAtPriceRange.minVariantPrice;
    const price = product.priceRange.minVariantPrice;
    const hasRealCompareAt =
      compareAtPrice &&
      Number(compareAtPrice.amount) > 0 &&
      Number(compareAtPrice.amount) > Number(price.amount);

    products[product.handle] = {
      id: product.id,
      handle: product.handle,
      title: product.title,
      description: product.description,
      availableForSale: product.availableForSale,
      onlineStoreUrl: product.onlineStoreUrl,
      image: product.featuredImage
        ? {
            url: product.featuredImage.url,
            altText: product.featuredImage.altText,
          }
        : null,
      price,
      compareAtPrice: hasRealCompareAt ? compareAtPrice : null,
      firstVariantId: firstVariant?.id || null,
      firstVariantAvailable: firstVariant?.availableForSale || false,
    };
  });

  return products;
}

export async function GET(request: NextRequest) {
  const storeDomain = normalizeStoreDomain(process.env.SHOPIFY_STORE_DOMAIN);
  const storefrontAccessToken = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN?.trim() || "";
  const apiVersion = process.env.SHOPIFY_API_VERSION?.trim() || "2025-10";
  const handles = getRequestedHandles(request);

  if (!handles.length) {
    return jsonResponse({
      configured: Boolean(storeDomain && storefrontAccessToken),
      storeDomain,
      products: {},
    });
  }

  if (!storeDomain || !storefrontAccessToken) {
    return jsonResponse({
      configured: false,
      storeDomain: "",
      products: {},
    });
  }

  const endpoint = `https://${storeDomain}/api/${apiVersion}/graphql.json`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": storefrontAccessToken,
      },
      body: JSON.stringify({ query: buildProductsQuery(handles) }),
      cache: "no-store",
    });

    if (!response.ok) {
      return jsonResponse(
        {
          configured: true,
          storeDomain,
          products: {},
          error: "Shopify product lookup failed.",
        },
        502
      );
    }

    const payload = (await response.json()) as ShopifyGraphQLResponse;

    if (payload.errors?.length) {
      return jsonResponse(
        {
          configured: true,
          storeDomain,
          products: {},
          error: payload.errors[0]?.message || "Shopify returned an error.",
        },
        502
      );
    }

    return jsonResponse({
      configured: true,
      storeDomain,
      products: normalizeProducts(payload.data),
    });
  } catch {
    return jsonResponse(
      {
        configured: true,
        storeDomain,
        products: {},
        error: "Shopify product lookup failed.",
      },
      502
    );
  }
}
