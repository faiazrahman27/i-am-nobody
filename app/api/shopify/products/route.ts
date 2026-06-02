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

type ShopifySelectedOption = {
  name: string;
  value: string;
};

type ShopifyVariantNode = {
  id: string;
  title: string;
  availableForSale: boolean;
  sku: string | null;
  selectedOptions: ShopifySelectedOption[];
  image: ShopifyImage | null;
  price: ShopifyMoney;
  compareAtPrice: ShopifyMoney | null;
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
    nodes: ShopifyVariantNode[];
  };
};

type ShopifyGraphQLResponse = {
  data?: Record<string, ShopifyProductNode | null>;
  errors?: Array<{ message?: string }>;
};

const HANDLE_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const MAX_HANDLES = 60;
const MAX_VARIANTS_PER_PRODUCT = 100;
const SHOPIFY_IMAGE_MAX_WIDTH = 2400;

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
          url(transform: { maxWidth: ${SHOPIFY_IMAGE_MAX_WIDTH} })
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
        variants(first: ${MAX_VARIANTS_PER_PRODUCT}) {
          nodes {
            id
            title
            availableForSale
            sku
            selectedOptions {
              name
              value
            }
            image {
              url(transform: { maxWidth: ${SHOPIFY_IMAGE_MAX_WIDTH} })
              altText
            }
            price {
              amount
              currencyCode
            }
            compareAtPrice {
              amount
              currencyCode
            }
          }
        }
      }`
    )
    .join("\n");

  return `query IamNobodyProducts {
    ${productQueries}
  }`;
}

function hasRealCompareAt(compareAtPrice: ShopifyMoney | null | undefined, price: ShopifyMoney | null | undefined) {
  if (!compareAtPrice || !price) return false;

  const compareAmount = Number(compareAtPrice.amount);
  const priceAmount = Number(price.amount);

  return (
    Number.isFinite(compareAmount) &&
    Number.isFinite(priceAmount) &&
    compareAmount > 0 &&
    compareAmount > priceAmount
  );
}

function normalizeProducts(data: Record<string, ShopifyProductNode | null> | undefined) {
  const products: Record<string, unknown> = {};

  if (!data) return products;

  Object.values(data).forEach((product) => {
    if (!product || !product.handle) return;

    const firstVariant = product.variants.nodes[0] || null;
    const compareAtPrice = product.compareAtPriceRange.minVariantPrice;
    const price = product.priceRange.minVariantPrice;

    const variants = product.variants.nodes.map((variant) => ({
      id: variant.id,
      title: variant.title,
      availableForSale: variant.availableForSale,
      sku: variant.sku,
      selectedOptions: variant.selectedOptions || [],
      image: variant.image
        ? {
            url: variant.image.url,
            altText: variant.image.altText,
          }
        : null,
      price: variant.price,
      compareAtPrice: hasRealCompareAt(variant.compareAtPrice, variant.price)
        ? variant.compareAtPrice
        : null,
    }));

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
      compareAtPrice: hasRealCompareAt(compareAtPrice, price) ? compareAtPrice : null,
      firstVariantId: firstVariant?.id || null,
      firstVariantAvailable: firstVariant?.availableForSale || false,
      variants,
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
