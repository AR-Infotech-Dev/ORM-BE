import * as CommonModel from "#shared/models/common.model.js";
import { successResponse, failureResponse } from "#shared/utils/apiResponse.js";
import { prepareFilterData } from "#shared/utils/filter.builder.js";
import { toMysqlDateTime } from "#shared/utils/dateTime.js";
import { validateBody } from "#shared/utils/bodyValidator.js";
import { isSuperAdminRole as isSuperAdmin } from "#shared/utils/role.utils.js";
import { env } from "#config/env.js";

const MODULE_TABLE = "visits";
const default_columns = {};
const custom_columns = {
  // dealer_id: {
  //   table: "dealers",
  //   alias: "dm",
  //   column: "dealer_name",
  //   key2: "dealer_id",
  //   select: "",
  // },

  company_id: {
    table: "company_master",
    alias: "dc",
    column: "company_name",
    key2: "company_id",
    select: "",
  },

  user_id: {
    table: "admin",
    alias: "au",
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

const visitValidationRules = {
  visit_id: { label: "Visit ID", type: "number", },
  dealer_id: { label: "Dealer", required: true, type: "number", },
  user_id: { label: "User", type: "number", },
  latitude: { label: "Latitude", },
  longitude: { label: "Longitude", },
  notes: { label: "Notes", },
  visit_date: { label: "Visit Date", required: true, },
  visit_status: { label: "Visit Status", required: true, },
  company_id: { label: "Company", type: "number", },
  created_by: { label: "Created By", type: "number", },
  modified_by: { label: "Modified By", type: "number", },
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
          "visit_status",
          "notes",
        ],
      },
      default_columns,
      custom_columns,
    });

    const { select, where, values, join, other } = filterData;

    other.freeTextSearch = searchText;

    other.searchColumns = [
      "t.visit_status",
      "t.notes",
    ];

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

    const visitDetails = await CommonModel.GetMasterListDetails({
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
        data: visitDetails,
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
    console.log(error);

    return failureResponse(res, {
      code: 2008,
      httpStatus: 500,
      message: error.message,
    });
  }
};
export const getVisitDetails = async (req, res) => {
  try {
    const method = req.method.toUpperCase();
    const { id: visit_id = null } = req.params;

    switch (method) {
      case "PUT": {
        const validation = validateBody(req.body, visitValidationRules);

        if (!validation.isValid) {
          return failureResponse(res, {
            code: 2001,
            httpStatus: 400,
            message: validation.message,
          });
        }

        const data = validation.data;
        delete data.visit_id;
        delete data.company_id;
        delete data.created_by;
        delete data.created_date;
        delete data.modified_by;
        delete data.modified_date;

        data.user_id = req.user.adminID;
        data.company_id = req.user.company_id;
        data.created_by = req.user.adminID;
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
        if (!visit_id) {
          return failureResponse(res, {
            code: 2004,
            httpStatus: 404,
          });
        }

        const validation = validateBody(req.body, visitValidationRules);

        if (!validation.isValid) {
          return failureResponse(res, {
            code: 2001,
            httpStatus: 400,
            message: validation.message,
          });
        }

        const data = validation.data;

        delete data.visit_id;
        delete data.company_id;
        delete data.created_by;
        delete data.created_date;
        data.modified_by = req.user.adminID;
        data.modified_date = toMysqlDateTime();

        const where = {
          visit_id,
        };

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
        if (!visit_id) {
          return failureResponse(res, {
            code: 2004,
            httpStatus: 404,
          });
        }

        const where = {
          visit_id,
        };

        if (!isSuperAdmin(req.user) && req.user.company_id) {
          where.company_id = req.user.company_id;
        }

        const details = await CommonModel.getMasterDetails(
          MODULE_TABLE,
          "*",
          where
        );

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

    const where = {
      visit_id: ids,
    };

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