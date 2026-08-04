import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("admin"),
  createdAt: integer("created_at").notNull(), // unix ms
});

export const products = sqliteTable(
  "products",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    barcode: text("barcode").notNull(), // 13-digit EAN-13
    name: text("name").notNull(),
    purchasePrice: integer("purchase_price").notNull(), // سعر الشراء
    sellPrice: integer("sell_price").notNull(), // سعر البيع
    unitPrice: integer("unit_price").notNull(), // سعر المفرد
    quantity: integer("quantity").notNull().default(0),
    createdAt: integer("created_at").notNull(), // unix ms
    updatedAt: integer("updated_at").notNull(), // unix ms
  },
  (t) => [
    uniqueIndex("products_barcode_unique").on(t.barcode),
    index("products_name_idx").on(t.name),
  ],
);

export type User = typeof users.$inferSelect;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
