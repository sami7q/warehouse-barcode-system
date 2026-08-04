import { z } from "zod";

/** Upper bounds — reject absurd values cleanly instead of storing them. */
export const MAX_NAME_LENGTH = 200;
export const MAX_MONEY_VALUE = 1_000_000_000; // 10^9, far above any real price
export const MAX_QUANTITY = 1_000_000;

const nonNegativeInt = (max: number) =>
  z
    .number({ error: "يجب إدخال رقم" })
    .int("يجب أن يكون رقماً صحيحاً")
    .nonnegative("لا يمكن أن يكون سالباً")
    .max(max, "القيمة المدخلة كبيرة جداً");

const nameField = z
  .string({ error: "أدخل اسم المنتج" })
  .trim()
  .min(1, "أدخل اسم المنتج")
  .max(MAX_NAME_LENGTH, `اسم المنتج يجب ألا يتجاوز ${MAX_NAME_LENGTH} حرفاً`);

const barcodeField = z
  .string()
  .trim()
  .regex(/^\d{4,13}$/, "الباركود يجب أن يكون أرقاماً فقط (4–13 خانة)")
  .optional()
  .or(z.literal("").transform(() => undefined));

/** POST /api/products body. `barcode` optional: empty → auto-generate EAN-13. */
export const productCreateSchema = z.object({
  name: nameField,
  purchase_price: nonNegativeInt(MAX_MONEY_VALUE),
  sell_price: nonNegativeInt(MAX_MONEY_VALUE),
  unit_price: nonNegativeInt(MAX_MONEY_VALUE),
  quantity: nonNegativeInt(MAX_QUANTITY),
  barcode: barcodeField,
});

export type ProductCreateInput = z.infer<typeof productCreateSchema>;

/** PUT /api/products/:id body. */
export const productUpdateSchema = z.object({
  name: nameField,
  purchase_price: nonNegativeInt(MAX_MONEY_VALUE),
  sell_price: nonNegativeInt(MAX_MONEY_VALUE),
  unit_price: nonNegativeInt(MAX_MONEY_VALUE),
  quantity: nonNegativeInt(MAX_QUANTITY),
  barcode: barcodeField,
});

export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;

export const loginSchema = z.object({
  email: z.email("أدخل بريداً إلكترونياً صحيحاً"),
  password: z.string().min(1, "أدخل كلمة المرور"),
});
