export interface CartLineInput {
  variantId: string;
  quantity: number;
}

export interface PricedCartLine {
  variantId: string;
  productId: string;
  printifyVariantId: string;
  title: string;
  sku: string | null;
  quantity: number;
  unitPriceCents: number;
  currency: string;
}

export interface PricedCart {
  lines: PricedCartLine[];
  totalCents: number;
  currency: string;
}