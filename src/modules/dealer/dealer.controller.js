import * as CommonModel from "#shared/models/common.model.js";
import { successResponse, failureResponse } from "#shared/utils/apiResponse.js";
import { prepareFilterData } from "#shared/utils/filter.builder.js";
import { toMysqlDateTime } from "#shared/utils/dateTime.js";
import { validateBody } from "#shared/utils/bodyValidator.js";
import { isSuperAdminRole as isSuperAdmin } from "#shared/utils/role.utils.js";
import { env } from "#config/env.js";

const MODULE_TABLE = "dealers";

const default_columns = {
  // dealer_type: {
  //   table: "categories",
  //   alias: "pt",
  //   column: "categoryName",
  //   key2: "category_id",
  //   select: "",
  // },
};

const custom_columns = {
  company_id: {
    table: "company_master",
    alias: "dc",
    column: "company_name",
    key2: "company_id",
    select: "",
  },
  created_by: {
    table: "admin",
    alias: "ad",
    column: "name",
    key2: "adminID",
    select: "",
  },
  assigned_salesman: {
    table: "admin",
    alias: "asd",
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

const dealerValidationRules = {
  dealer_id: { label: "Dealer ID", type: "number" },
  name: { label: "Dealer Name", required: true },
  code: { label: "Dealer Code" },
  mobile: { label: "Mobile", type: "number" },
  email: { label: "E-mail" },
  gstin: { label: "GST IN", Type: "varchar" },
  credit_limit: { label: "Credit limit", type: "number" },
  created_date: { label: "Created date", type: "number" },
  modified_date: { label: "Modify date", type: "number" },
  status: { label: "status", type: "enum" },
  company_id: { label: "Company", type: "number" },
  created_by: { label: "Created By", type: "number" },
  modified_by: { label: "Modified By", type: "number" },
  assigned_salesman: { label: "Assigned by", type: "varchar" },
  dealer_type: {label: "Type", type: "varchar" },
  pan_number: { label: "Pan", type: "string" },
  
};

export const list = async (req, res) => {
  try {
    const {
      page = 1,
      searchText = "",
      getAll = "N",
      orderBy = "created_date",
      order = "DESC",
      filters = [],
    } = req.body;

    // const limit = 10;
    const limit = env.perPage;

    const currentPage = Number(page) || 1;
    const start = (currentPage - 1) * limit;

    const filterData = prepareFilterData({
      filters,
      searchText,
      other: {
        orderBy,
        order,
        searchColumns: [
          "t.name",
          "t.code",
          "t.mobile",
        ],
      },
      default_columns,
      custom_columns,
    });

    const { select, where, values, join, other } = filterData;
    // other.freeTextSearch = searchText;
    // other.searchColumns = [
    //   "t.name",
    //   "t.code",
    // ];

    if (!isSuperAdmin(req.user) && req.user.company_id) {
      where.push("t.company_id = ?");
      values.push(req.user.company_id);
    }

    const total = await CommonModel.getCountsByParameter({
      table: MODULE_TABLE,
      where,
      values,
      join,
      other,
    });

    const totalPages = Math.ceil(total / limit);
    const end = Math.min(start + limit, total);

    const dealerDetails = await CommonModel.GetMasterListDetails({
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
        data: dealerDetails,
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

export const getdealerDetails = async (req, res) => {
  try {
    const method = req.method.toUpperCase();
    const { id: dealer_id = null } = req.params;

    switch (method) {
      case "PUT": {
        const validation = validateBody(req.body, dealerValidationRules);
        if (!validation.isValid) {
          return failureResponse(res, {
            code: 2001,
            httpStatus: 400,
            message: validation.message,
          });
        }

        const data = validation.data;
        console.log("data : ", data);

        delete data.dealer_id;

        data.created_by = req.user.adminID;
        data.company_id = req.user.company_id;
        data.created_date = toMysqlDateTime();

        const result = await CommonModel.saveMasterDetails({
          table: MODULE_TABLE,
          data,
        });

        return successResponse(res, {
          code: 1001,
          httpStatus: 201,
          data: {
            insertId: result.insertId,
          },
        });
      }

      case "POST": {
        if (!dealer_id) {
          return failureResponse(res, {
            code: 2004,
            httpStatus: 404,
          });
        }

        const validation = validateBody(req.body, dealerValidationRules);
        if (!validation.isValid) {
          return failureResponse(res, {
            code: 2001,
            httpStatus: 400,
            message: validation.message,
          });
        }

        const data = validation.data;
        console.log("data : ", data);

        delete data.dealer_id;
        delete data.company_id;
        delete data.created_by;
        delete data.created_date;
        data.modified_by = req.user.adminID;
        data.modified_date = toMysqlDateTime();

        const where = { dealer_id };
        if (!isSuperAdmin(req.user) && req.user.company_id) {
          where.company_id = req.user.company_id;
        }

        const result = await CommonModel.updateMasterDetails({
          table: MODULE_TABLE,
          data,
          where,
        });

        if (!result.affectedRows) {
          return failureResponse(res, {
            code: 2004,
            httpStatus: 404,
          });
        }

        return successResponse(res, {
          code: 1002,
          httpStatus: 200,
          data: [],
        });
      }

      case "GET": {
        if (!dealer_id) {
          return failureResponse(res, {
            code: 2004,
            httpStatus: 404,
          });
        }

        const where = { dealer_id };
        if (!isSuperAdmin(req.user) && req.user.company_id) {
          where.company_id = req.user.company_id;
        }

        const details = await CommonModel.getMasterDetails(MODULE_TABLE, "*", where);

        if (!details.length) {
          return failureResponse(res, {
            code: 2004,
            httpStatus: 404,
          });
        }

        return successResponse(res, {
          code: 1004,
          httpStatus: 200,
          data: {
            data: details[0],
          },
        });
      }

      default:
        return failureResponse(res, {
          code: 2000,
          httpStatus: 405,
        });
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

    const where = { dealer_id: ids };
    if (!isSuperAdmin(req.user) && req.user.company_id) {

      where.company_id = req.user.company_id;
    }

    await CommonModel.deleteMasterDetails({
      table: MODULE_TABLE,
      where,
    });

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
