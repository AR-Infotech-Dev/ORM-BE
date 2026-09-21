import * as CommonModel from "#shared/models/common.model.js";
import { query, DB_PREFIX } from "#config/database.js";
import { successResponse, failureResponse } from "#shared/utils/apiResponse.js";
import { prepareFilterData } from "#shared/utils/filter.builder.js";
import { toMysqlDateTime } from "#shared/utils/dateTime.js";
// import { isSuperAdminRole as isSuperAdmin } from "#shared/utils/role.utils.js";
import { env } from "#config/env.js";
import { normalizePayload, validateOrderPayload } from "../shared/order.helper.js";

const MODULE_TABLE = "orders";
const ORDERS_LINE_TABLE = "order_items";
const default_columns = {};
const custom_columns = {
  // dealer_id: {
  //   table: "dealers",
  //   alias: "d",
  //   column: "name",
  //   key2: "dealer_id",
  //   select: "d.mobile AS dealer_mobile, d.email AS dealer_email",
  // },
  order_status: {
    table: "categories",
    alias: "ct",
    column: "categoryName",
    key2: "slug",
    select: "ct.cat_color as order_status_color",
  },
  company_id: {
    table: "company_master",
    alias: "dc",
    column: "company_name",
    key2: "company_id",
    select: "",
  },

  sales_person: {
    table: "admin",
    alias: "sp",
    column: "name",
    key2: "adminID",
    select: "",
  },

  created_by: {
    table: "admin",
    alias: "ad",
    column: "name",
    key2: "adminID",
    select: "",
  },
  modified_by: {
    table: "admin",
    alias: "am",
    column: "name",
    key2: "adminID",
    select: "",
  },
};
export const allowedStatuses = ["draft", "waiting", "approved", "dispatched", "delivered"];
// export const allowedPriorities = ["low", "normal", "high", "urgent"];

export const orderValidationRules = {
  order_id: { label: "Order ID", type: "number" },
  dealer_id: { label: "Dealer", type: "number", required: true },
  
  sales_person: { label: "Sales Person", type: "number" },

  order_no: { label: "Order No" },
  order_date: { label: "Order Date", required: true },
  subtotal: { label: "Subtotal", type: "number" },
  tax_amount: { label: "Tax Amount", type: "number" },
  total_amount: { label: "Total Amount", type: "number" },
  company_id: { label: "Company Id", type: "number" },
  order_status: { label: "Order Status" },
  status: { label: "Status" },
  created_by: { label: "Created By", type: "number" },
  modified_by: { label: "Modified By", type: "number" },
};

const saveOrderItems = async ({ orderId, companyId, userId, items }) => {
  await CommonModel.deleteMasterDetails({ table: ORDERS_LINE_TABLE, where: { order_id: orderId } });
  for (const item of items) {
    
    // console.log("INSERTING ITEM:", item);
    await CommonModel.saveMasterDetails({
      table: ORDERS_LINE_TABLE,
      data: {
        company_id: companyId,
        order_id: orderId,
        ...item,
        created_by: userId,
        created_date: toMysqlDateTime(),
        // status: "active",
      },
    });
  }
};

export const list = async (req, res) => {
  try {
    const { page = 1, searchText = "", getAll = "N", orderBy = "created_date", order = "DESC", filters = [], } = req.body;
    const limit = env.perPage;
    const currentPage = Number(page) || 1;
    const start = (currentPage - 1) * limit;
    const filterData = prepareFilterData({
      filters,
      searchText,
      other: {
        orderBy,
        order,
        searchColumns: ["order_no", "dealer_name"],
      },
      default_columns,
      custom_columns,
    });

    const { select, where, values, join, other } = filterData;
    where.push("t.status <> 'delete'");
    // other.freeTextSearch = searchText;
    // other.searchColumns = ["t.order_no"];


    // if (!isSuperAdmin(req.user) && req.user.company_id) {
    //   where.push("t.company_id = ?");
    //   values.push(req.user.company_id);
    // }

    const total = await CommonModel.getCountsByParameter({
      table: MODULE_TABLE,
      where,
      values,
      join,
      other,
    });

    const totalPages = Math.ceil(total / limit);
    const end = Math.min(start + limit, total);

    const orderList = await CommonModel.GetMasterListDetails({
      select,
      table: MODULE_TABLE,
      where,
      values,
      limit: getAll === "Y" ? "" : limit,
      start,
      join,
      other,
    });

    return successResponse(res, {
      code: 1004,
      httpStatus: 200,
      data: {
        data: orderList,
        pagination: {
          total,
          page: currentPage,
          limit,
          totalPages,
          start: total === 0 ? 0 : start + 1,
          end,
        },
      },
    });
  } catch (error) {
    return failureResponse(res, {
      code: 2008,
      httpStatus: 500,
      message: error.message,
    });
  }
};

export const getOrderDetails = async (req, res) => {
  try {
    const method = req.method.toUpperCase();
    const { id: order_id = null } = req.params;
    const userId = req.user.adminID;

    switch (method) {
      case "PUT": {
        const { order, items } = normalizePayload(req.body, req.user);; 

        const payloadError = validateOrderPayload(order, items);
        if (payloadError) {
          return failureResponse(res, { code: 2001, httpStatus: 400, message: payloadError });
        }
        const data = { ...order };
        const dealerDetails = await CommonModel.getMasterDetails("dealers", "dealer_id,name", { dealer_id: data.dealer_id });
        const dealerName = dealerDetails?.[0]?.name || "-";

        delete data.order_id;

        data.dealer_name = dealerName;
        data.created_by = userId;
        data.sales_person = userId;
        data.created_date = toMysqlDateTime();

        const result = await CommonModel.saveMasterDetails({ table: MODULE_TABLE, data });

        // ****************************************************************
        await saveOrderItems({ orderId: result.insertId, companyId: data.company_id, userId, items });

        return successResponse(res, {
          code: 1001,
          httpStatus: 201,
          data: { insertId: result.insertId, order_id: result.insertId },
          message: "Order created successfully",
        });
      }

      case "POST": {
        if (!order_id) {
          return failureResponse(res, { code: 2004, httpStatus: 404 });
        }
        const { order, items } = normalizePayload(req.body, req.user);
        // console.log(items);
       
        const payloadError = validateOrderPayload(order, items);
        if (payloadError) {
          return failureResponse(res, { code: 2001, httpStatus: 400, message: payloadError });
        }
        const where = { order_id };
        // if (!isSuperAdmin(req.user) && req.user.company_id) {
        //   where.company_id = req.user.company_id;
        // }
        const data = { ...order };
        delete data.order_id;
        delete data.company_id;
        delete data.created_by;
        delete data.created_date;

        data.modified_by = userId;
        data.modified_date = toMysqlDateTime();

        const result = await CommonModel.updateMasterDetails({ table: MODULE_TABLE, data, where });
        if (!result.affectedRows) {
          return failureResponse(res, { code: 2004, httpStatus: 404 });
        }

        await saveOrderItems({ orderId: order_id, companyId: order.company_id, userId, items });

        return successResponse(res, {
          code: 1002,
          httpStatus: 200,
          data: { order_id },
          message: "Order updated successfully",
        });
      }

      case "GET": {
        if (!order_id) {
          return failureResponse(res, { code: 2004, httpStatus: 404 });
        }

        const where = { order_id };
        // if (!isSuperAdmin(req.user) && req.user.company_id) {
        //    where.company_id = req.user.company_id;
        // }

        const details = await CommonModel.getMasterDetails(MODULE_TABLE, "*", where);
        if (!details.length) {
          return failureResponse(res, { code: 2004, httpStatus: 404 });
        }

        const items = await query(
          `SELECT oi.*, p.product_name, p.sale_price, p.tax_rate, p.unit
           FROM ${DB_PREFIX}${ORDERS_LINE_TABLE} oi
           LEFT JOIN ${DB_PREFIX}products p ON oi.product_id = p.product_id
           WHERE oi.order_id = ?
           ORDER BY oi.item_id ASC`,
          [order_id]
        );

        return successResponse(res, {
          code: 1004,
          httpStatus: 200,
          data: { data: { ...details[0], items } },
        });
      }

      default:
        return failureResponse(res, { code: 2000, httpStatus: 405 });
    }
  } catch (error) {
    return failureResponse(res, {
      code: 2008,
      httpStatus: 500,
      message: error.message,
    });
  }
};

export const changeStatus = async (req, res) => {
  try {
    const { action = "", ids = [] } = req.body;

    if (action.trim().toLowerCase() !== "delete") {
      return failureResponse(res, {
        code: 2000,
        httpStatus: 400,
        message: "Invalid action",
      });
    }

    if (!Array.isArray(ids) || !ids.length) {
      return failureResponse(res, {
        code: 2001,
        httpStatus: 400,
        message: "ids are required",
      });
    }

    const where = { order_id: ids };
    // if (!isSuperAdmin(req.user) && req.user.company_id) {
    //   where.company_id = req.user.company_id;
    // }

    const placeholders = ids.map(() => "?").join(",");
    const orderParams = ["delete", req.user.adminID, toMysqlDateTime(), ...ids];
    let orderSql = `UPDATE ${DB_PREFIX}${MODULE_TABLE} SET status = ?, modified_by = ?, modified_date = ? WHERE order_id IN (${placeholders})`;

    // if (!isSuperAdmin(req.user) && req.user.company_id) {
    //   orderSql += " AND company_id = ?";
    //   orderParams.push(req.user.company_id);
    // }

    await query(orderSql, orderParams);

    await query(
      `UPDATE ${DB_PREFIX}${ORDERS_LINE_TABLE} SET modified_by = ?, modified_date = ? WHERE order_id IN (${placeholders})`,
      [req.user.adminID, toMysqlDateTime(), ...ids]
    );

    return successResponse(res, {
      code: 1003,
      httpStatus: 200,
      data: [],
    });
  } catch (error) {
    return failureResponse(res, {
      code: 2008,
      httpStatus: 500,
      message: error.message,
    });
  }
};







