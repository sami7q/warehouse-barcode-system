import { z } from "zod";

const nonNegativeInt = z
  .number({ error: "يجب إدخال رقم" })
  .int("يجب أن يكون رقماً صحيحاً")
  .nonnegative("لا يمكن أن يكون سالباً");

/** POST /api/products body. `barcode` optional: empty → auto-generate EAN-13. */
export const productCreateSchema = z.object({
  name: z.string({ error: "أدخل اسم المنتج" }).trim().min(1, "أدخل اسم المنتج"),
  purchase_price: nonNegativeInt,
  sell_price: nonNegativeInt,
  unit_price: nonNegativeInt,
  quantity: nonNegativeInt,
  barcode: z
    .string()
    .trim()
    .regex(/^\d{4,13}$/, "الباركود يجب أن يكون أرقاماً فقط (4–13 خانة)")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export type ProductCreateInput = z.infer<typeof productCreateSchema>;

/** PUT /api/products/:id body. */
export const productUpdateSchema = z.object({
  name: z.string().trim().min(1, "أدخل اسم المنتج"),
  purchase_price: nonNegativeInt,
  sell_price: nonNegativeInt,
  unit_price: nonNegativeInt,
  quantity: nonNegativeInt,
  barcode: z
    .string()
    .trim()
    .regex(/^\d{4,13}$/, "الباركود يجب أن يكون أرقاماً فقط (4–13 خانة)")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;

export const loginSchema = z.object({
  email: z.email("أدخل بريداً إلكترونياً صحيحاً"),
  password: z.string().min(1, "أدخل كلمة المرور"),
});
