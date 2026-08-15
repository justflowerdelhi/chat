import type { DemoCatalogueProduct } from "@/lib/demoCatalogue";

export type CatalogueProduct = DemoCatalogueProduct;

const JUSTFLOWER_CATALOGUE_URL =
  "https://justflower.in/api/flora-catalogue.asp";

interface JustFlowerProduct {
  id: string;
  code: string;
  name: string;
  description: string;
  offer?: string;
  price: number;
  image: string;
  url: string;
  category?: string;
  city?: string;
  specialCity?: string;
  tags?: string;
}

function extractBudget(text: string): number | null {
  const normalized = text.replace(/,/g, "");
  const match =
    normalized.match(/(?:₹|rs\.?|inr)\s*(\d{3,6})/i) ||
    normalized.match(/\b(?:around|under|within|upto|up to|budget|in)\s*(?:₹|rs\.?|inr)?\s*(\d{3,6})\b/i) ||
    normalized.match(/\b(\d{3,6})\s*(?:rs|rupees|inr)\b/i);
  return match ? Number(match[1]) : null;
}

function catalogueIntent(text: string): boolean {
  return /\b(bouquet|bouquets|flower|flowers|floral|rose|roses|lily|lilies|orchid|orchids|arrangement|arrangements|photo|photos|pic|pics|picture|pictures|image|images|catalog|catalogue|design|designs|show|options|gift|gifts)\b/i.test(text);
}

function matchesText(product: JustFlowerProduct, text: string): boolean {
  const haystack = [
    product.name,
    product.description,
    product.category,
    product.tags,
    product.code,
  ].filter(Boolean).join(" ").toLowerCase();

  const words = text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

  const meaningful = words.filter(
    (w) => w.length >= 4 &&
      !["show","some","want","need","give","please","under","within","around","budget","flower","flowers","bouquet","bouquets","gift","gifts","photo","photos","design","designs"].includes(w)
  );

  return meaningful.some((w) => haystack.includes(w));
}

async function fetchJustFlowerCatalogue(): Promise<JustFlowerProduct[]> {
  const response = await fetch(JUSTFLOWER_CATALOGUE_URL, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`JustFlower catalogue HTTP ${response.status}`);
  }

  const data = (await response.json()) as {
    success?: boolean;
    products?: JustFlowerProduct[];
  };

  if (!data.success || !Array.isArray(data.products)) {
    throw new Error("Invalid JustFlower catalogue response");
  }

  return data.products.filter(
    (p) =>
      typeof p.name === "string" &&
      p.name.trim().length > 0 &&
      typeof p.price === "number" &&
      p.price > 0 &&
      typeof p.image === "string" &&
      p.image.length > 0
  );
}

export async function getJustFlowerCatalogueRecommendations(
  message: string
): Promise<CatalogueProduct[]> {
  if (!catalogueIntent(message)) return [];

  try {
    const products = await fetchJustFlowerCatalogue();
    const budget = extractBudget(message);
    const text = message.toLowerCase();

    let candidates = products;

    if (budget) {
      const around = /\b(around|about|near|approx|approximately)\b/.test(text);
      const filtered = around
        ? candidates.filter(
            (p) => p.price >= Math.max(0, budget - 300) && p.price <= budget + 300
          )
        : candidates.filter((p) => p.price <= budget);

      candidates = filtered.length
        ? filtered
        : [...candidates].sort(
            (a, b) => Math.abs(a.price - budget) - Math.abs(b.price - budget)
          );
    }

    const tagged = candidates.filter((p) => matchesText(p, message));
    if (tagged.length) candidates = tagged;

    return candidates.slice(0, 3).map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price: p.price,
      occasion: p.tags || p.category || "",
      imageUrl: p.image,
    }));
  } catch (error) {
    console.error("JustFlower catalogue unavailable; using demo catalogue:", error);
    return [];
  }
}
