/** Product shape returned by /api/products (Drizzle camelCase columns). */
export type ApiProduct = {
  id: number;
  barcode: string;
  name: string;
  purchasePrice: number;
  sellPrice: number;
  unitPrice: number;
  quantity: number;
  createdAt: number;
  updatedAt: number;
};
