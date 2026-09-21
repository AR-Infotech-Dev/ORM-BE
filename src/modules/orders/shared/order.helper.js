import { validateBody } from "#shared/utils/bodyValidator.js";
const allowedStatuses = ["draft", "waiting", "approved", "dispatched", "delivered"];
const orderValidationRules = {
  order_id: { label: "Order ID", type: "number" },
  order_no: { label: "Order No" },
  company_id: { label: "Company Id", type: "number" },
  dealer_id: { label: "Customer", type: "number", required: true },
  order_date: { label: "Order Date", required: true },
  order_status: { label: "Order Status" },
  subtotal: { label: "Subtotal", type: "number" },
  tax_amount: { label: "Tax Amount", type: "number" },
  total_amount: { label: "Total Amount", type: "number" },
  status: { label: "Status" },
  created_by: { label: "Created By", type: "number" },
  modified_by: { label: "Modified By", type: "number" },
};
const toNumber = (value, fallback = 0) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};
const firstValidString = (...values) => {
  const value = values.find((item) => item !== undefined && item !== null && String(item).trim() !== "");
  return value === undefined ? null : String(value).trim();
};
const normalizeEnum = (value, allowedValues, fallback) => {
  const normalized = String(value || "").toLowerCase().trim().replace(/\s+/g, "_");
  return allowedValues.includes(normalized) ? normalized : fallback;
};
const buildOrderNo = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `SSO-${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
};
export const normalizePayload = (body = {}, user = {}) => {
  const order = body.order && typeof body.order === "object" ? body.order : body;
  const items = Array.isArray(body.items) ? body.items : [];
  const summary = body.summary && typeof body.summary === "object" ? body.summary : {};
  const orderDate = firstValidString(order.order_date);
  const orderMonth = firstValidString(order.order_month) || (orderDate ? orderDate.slice(0, 7) : null);
  const validItems = items
    .map((item) => {
      const productId = toNumber(item.product_id, 0);
      const qty = toNumber(item.qty ?? item.order_qty, 0);
      const rate = toNumber(item.rate ?? item.unit_rate ?? item.unitRate, 0);
      const discount = toNumber(item.discount, 0);
      const gst = toNumber(item.gst ?? item.tax_rate, 0);
      const itemName = firstValidString(
        item.item_name,
        item.product_name,
        item.product,
        item.name
      );
      // ✅ Gross amount
      const grossAmount = qty * rate;
      // ✅ Discount is percentage
      const discountAmount = grossAmount * (discount / 100);
      // ✅ Amount after discount
      const taxableAmount = Math.max(grossAmount - discountAmount, 0);
      // ✅ GST
      const taxAmount = toNumber(item.tax_amount ?? item.gst_amount, taxableAmount * (gst / 100));
      // ✅ Final amount
      const amount = toNumber(item.amount ?? item.line_value, taxableAmount + taxAmount);
      return {
        product_id: productId,
        item_name: itemName,
        qty,
        unit: firstValidString(item.unit),
        rate,
        discount,
        amount,
        tax_amount: taxAmount,
        gst,
      };
    })
    .filter( (item) => item.product_id > 0 );

  const subtotal = validItems.reduce((total, item) => {
    const grossAmount = toNumber(item.qty) * toNumber(item.rate);
    const discountAmount = grossAmount * (toNumber(item.discount) / 100);
    const taxableAmount = Math.max(grossAmount - discountAmount, 0);
    return total + taxableAmount;
  }, 0);

  const calculatedTax = validItems.reduce((total, item) => total + toNumber(item.tax_amount), 0);
  const calculatedValue = validItems.reduce((total, item) => total + toNumber(item.amount), 0);
  const grandTotal = calculatedValue;

  const normalizedOrder = {
    order_id: order.order_id || null,
    dealer_id: toNumber(order.dealer_id, 0),
    order_no: firstValidString(order.order_no) || buildOrderNo(),
    order_date: order.order_date,
    subtotal: toNumber(order.subtotal ?? summary.subtotal, subtotal),
    tax_amount: toNumber(order.tax_amount ?? summary.gstAmount, calculatedTax),
    total_amount: toNumber(order.total_amount ?? summary.grandTotal, grandTotal),
    company_id: toNumber(order.company_id || user?.company_id, 0),
    order_status: normalizeEnum(order.order_status, allowedStatuses, "draft"),
    status: firstValidString(order.status) || "active"
  };
  return { order: normalizedOrder, items: validItems };
};
export const validateOrderPayload = (order, items) => {
  const validation = validateBody(order, orderValidationRules);
  if (!validation.isValid) {
    return validation.message;
  }
  
  return "";
};




