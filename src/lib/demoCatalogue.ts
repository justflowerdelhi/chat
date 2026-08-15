export interface DemoCatalogueProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  occasion: string;
  imageUrl: string;
}

const BASE_URL = "https://chat.floraprise.com/catalogue";

export const DEMO_CATALOGUE: DemoCatalogueProduct[] = [
  {
    id: "image1",
    name: "Classic Red Roses",
    description: "12 fresh red roses with seasonal fillers, wrapped elegantly.",
    price: 1499,
    occasion: "love, anniversary, birthday",
    imageUrl: `${BASE_URL}/image1.jpeg`,
  },
  {
    id: "image2",
    name: "Pink Rose Romance",
    description: "Soft pink roses arranged with delicate fillers for a sweet romantic gift.",
    price: 1299,
    occasion: "love, birthday, anniversary",
    imageUrl: `${BASE_URL}/image2.jpeg`,
  },
  {
    id: "image3",
    name: "Sunshine Bouquet",
    description: "Bright yellow flowers with fresh green foliage, perfect for birthdays.",
    price: 999,
    occasion: "birthday, congratulations",
    imageUrl: `${BASE_URL}/image3.jpeg`,
  },
  {
    id: "image4",
    name: "White Lily Elegance",
    description: "Elegant white lilies with seasonal greens, fresh and sophisticated.",
    price: 1499,
    occasion: "birthday, congratulations, premium",
    imageUrl: `${BASE_URL}/image4.jpeg`,
  },
  {
    id: "image5",
    name: "Premium Yellow Bouquet",
    description: "A cheerful premium yellow flower arrangement, beautifully wrapped.",
    price: 1199,
    occasion: "birthday, congratulations, thank you",
    imageUrl: `${BASE_URL}/image5.jpeg`,
  },
  {
    id: "image6",
    name: "Pastel Garden Bouquet",
    description: "Soft pastel flowers in a graceful hand-tied garden-style arrangement.",
    price: 1399,
    occasion: "birthday, thank you, congratulations",
    imageUrl: `${BASE_URL}/image6.jpeg`,
  },
  {
    id: "image7",
    name: "Premium Mixed Flowers",
    description: "A colourful premium mix of seasonal flowers arranged for a special celebration.",
    price: 1799,
    occasion: "birthday, anniversary, congratulations",
    imageUrl: `${BASE_URL}/image7.jpeg`,
  },
  {
    id: "image8",
    name: "Royal Mixed Roses",
    description: "A luxurious arrangement of premium roses in beautiful mixed shades.",
    price: 2499,
    occasion: "anniversary, love, premium",
    imageUrl: `${BASE_URL}/image8.jpeg`,
  },
  {
    id: "image9",
    name: "Garden Celebration Bouquet",
    description: "A fresh garden-style bouquet made with colourful seasonal flowers.",
    price: 1599,
    occasion: "birthday, congratulations, thank you",
    imageUrl: `${BASE_URL}/image9.jpeg`,
  },
  {
    id: "image10",
    name: "Purple Flower Elegance",
    description: "Elegant purple flowers arranged in a sophisticated designer bouquet.",
    price: 1499,
    occasion: "birthday, congratulations, premium",
    imageUrl: `${BASE_URL}/image10.jpeg`,
  },
  {
    id: "image11",
    name: "Pink Celebration Bouquet",
    description: "Fresh pink blooms arranged beautifully for a cheerful celebration.",
    price: 1299,
    occasion: "birthday, love, congratulations",
    imageUrl: `${BASE_URL}/image11.jpeg`,
  },
  {
    id: "image12",
    name: "Premium Pink Flowers",
    description: "A premium pink flower arrangement for birthdays and special occasions.",
    price: 1799,
    occasion: "birthday, anniversary, premium",
    imageUrl: `${BASE_URL}/image12.jpeg`,
  },
  {
    id: "image13",
    name: "Romantic Red & Pink Bouquet",
    description: "A romantic combination of red and pink flowers, elegantly wrapped.",
    price: 1699,
    occasion: "love, anniversary, birthday",
    imageUrl: `${BASE_URL}/image13.jpeg`,
  },
  {
    id: "image14",
    name: "Purple Orchid Style Bouquet",
    description: "An elegant purple-toned arrangement with a premium designer look.",
    price: 1999,
    occasion: "premium, congratulations, anniversary",
    imageUrl: `${BASE_URL}/image14.jpeg`,
  },
  {
    id: "image15",
    name: "Yellow & White Celebration",
    description: "Fresh yellow and white flowers arranged for a bright, joyful gift.",
    price: 1299,
    occasion: "birthday, congratulations, thank you",
    imageUrl: `${BASE_URL}/image15.jpeg`,
  },
];

function extractBudget(text: string): number | null {
  const normalized = text.replace(/,/g, "");
  const match = normalized.match(/(?:₹|rs\.?|inr)?\s*(\d{3,6})/i);
  return match ? Number(match[1]) : null;
}

function occasionMatches(product: DemoCatalogueProduct, text: string): boolean {
  const lower = text.toLowerCase();

  const aliases: Record<string, string[]> = {
    birthday: ["birthday", "bday", "birth day"],
    anniversary: ["anniversary"],
    love: ["wife", "husband", "girlfriend", "boyfriend", "romantic", "love", "valentine"],
    congratulations: ["congratulations", "congrats", "new job", "promotion", "celebration"],
    thank: ["thank you", "thanks", "gratitude"],
  };

  return product.occasion.split(", ").some((occasion) =>
    (aliases[occasion] || [occasion]).some((word) => lower.includes(word))
  );
}

export function getDemoCatalogueRecommendations(message: string): DemoCatalogueProduct[] {
  const lower = message.toLowerCase();

  const catalogueIntent =
    /flower|bouquet|rose|lily|orchid|arrangement|design|catalog|show me|options|gift/.test(lower);

  if (!catalogueIntent) {
    return [];
  }

  const budget = extractBudget(message);

  let products = DEMO_CATALOGUE.filter((product) => {
    if (budget && product.price > budget) return false;
    return true;
  });

  const occasionProducts = products.filter((product) => occasionMatches(product, message));

  if (occasionProducts.length >= 3) {
    products = occasionProducts;
  } else if (occasionProducts.length > 0) {
    products = [...occasionProducts, ...products.filter((p) => !occasionProducts.includes(p))];
  }

  return products.slice(0, 3);
}
