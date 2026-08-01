import * as CommonModel from "#shared/models/common.model.js";
import { successResponse, failureResponse } from "#shared/utils/apiResponse.js";
import { prepareFilterData } from "#shared/utils/filter.builder.js";
import { validate } from "#shared/utils/request.validator.js";
import { toMysqlDateTime } from "#shared/utils/dateTime.js";
import { buildTablePayload } from "#shared/utils/tablePayload.js";
import Joi from "joi";
import { sendEmail } from "#shared/utils/email.js";
import { env } from "#config/env.js";
import { renderTemplate } from "#shared/utils/templateMaker.js";
import { hashPassword, verifyPassword } from "#shared/utils/password.js";
import { DB_PREFIX, query } from "#config/database.js";
import { getUserCompanyId, isSuperAdminRole } from "#shared/utils/role.utils.js";

// TENANT SYNC 
import { syncToTenant } from "#shared/utils/tenantSync.js";

const MODULE_TABLE = "admin";

const sanitizeSqlPayload = (payload = {}) =>
    Object.entries(payload).reduce((data, [key, value]) => {
        data[key] = value === undefined ? null : value;
        return data;
    }, {});

const normalizeJsonValue = (value) => {
    if (value === undefined || value === null || value === "") {
        return null;
    }

    if (typeof value === "string") {
        return value;
    }

    return JSON.stringify(value);
};

// ======================================================
// LIST USERS
// ======================================================
const default_columns = {
    roleID: {
        table: "user_role_master",
        alias: "r",
        column: "roleName",
        key2: "roleID",
        select: "",
    },
    default_company: {
        table: "company_master",
        alias: "dc",
        column: "company_name",
        key2: "company_id",
        select: "",
    },
    reporting_to: {
        table: "admin",
        alias: "rp",
        column: "name",
        key2: "adminID",
        select: "",
    },
};

const custom_columns = {
    modified_by: {
        table: "admin",
        alias: "am",
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
};

const getHierarchy = async (parentId) => {

    const users = await CommonModel.GetMasterListDetails({
        select: `
      t.adminID,
      t.name,
      t.email,
      t.contactNo,
      t.reporting_to,
      t.status,
      t.roleID,
      r.roleName`,
        table: MODULE_TABLE,
        where: ["t.reporting_to = ?"],
        values: [parentId],
        join: [
            {
                type: "LEFT JOIN",
                table: "user_role_master",
                alias: "r",
                key1: "roleID",
                key2: "roleID",
            },
        ],
    });
    for (const user of users) {
        user.children = await getHierarchy(user.adminID);
    }
    return users;
};

export const list = async (req, res) => {
    try {
        const {
            page = 1,
            searchText = "",
            getAll = "N",
            orderBy = "created_date",
            order = "DESC",
            company_id = null,
            filters,
            depth,
        } = req.body;

        const limit = env.perPage;
        const currentPage = Number(page) || 1;
        const start = (currentPage - 1) * limit;

        const other1 = {
            orderBy,
            order,
            searchColumns: ["ad.name", "am.name", "r.roleName", 't.userName', "t.email"],
        };

        const filterData = prepareFilterData({
            filters,
            searchText,
            other: other1,
            default_columns,
            custom_columns,
        });

        const { select, where, values, join, other } = filterData;
        const scopedCompanyId = isSuperAdminRole(req.user?.role_slug)
            ? null
            : getUserCompanyId(req.user);

        // where.push("t.company_id = ?");
        // values.push(scopedCompanyId);

        if (depth === "all") {
            const hierarchy = await getHierarchy(req.user.adminID);

            return successResponse(res, {
                code: 1004,
                httpStatus: 200,
                data: {
                    data: hierarchy,
                },
            });
        }

        where.push("t.reporting_to = ?");
        values.push(req.user.adminID);

        // if (scopedCompanyId) {
        // }

        const total = await CommonModel.getCountsByParameter({
            table: MODULE_TABLE,
            where,
            values,
            join,
            other,
        });

        const totalPages = Math.ceil(total / limit);

        let end = start + limit;
        if (end > total) end = total;

        let data = [];

        if (getAll === "Y") {
            data = await CommonModel.GetMasterListDetails({
                select,
                table: MODULE_TABLE,
                where,
                values,
                join,
                other,
            });
        } else {
            data = await CommonModel.GetMasterListDetails({
                select,
                table: MODULE_TABLE,
                where,
                values,
                limit,
                start,
                join,
                other,
            });
        }

        // Fetch children upto 2 levels
        for (const member of data) {

            // Level 1 Children
            const children = await CommonModel.GetMasterListDetails({
                select,
                table: MODULE_TABLE,
                where: ["t.reporting_to = ?"],
                values: [member.adminID],
                join,
                other,
            });

            member.children = children;

            // Level 2 Children
            for (const child of children) {

                const grandChildren = await CommonModel.GetMasterListDetails({
                    select,
                    table: MODULE_TABLE,
                    where: ["t.reporting_to = ?"],
                    values: [child.adminID],
                    join,
                    other,
                });

                child.children = grandChildren;
            }
        }

        console.log(data);

        return successResponse(res, {
            code: 1004,
            httpStatus: 200,
            data: {
                data,
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

// ======================================================
// GET MEMBER DETAILS
// ======================================================
export const getMemberDetails = async (req, res) => {
    try {
        const { userID } = req.params;
        const member = await CommonModel.GetMasterListDetails({
            table: MODULE_TABLE,
            select: `
                t.adminID,
                t.name,
                t.email,
                t.contactNo,
                t.status,
                t.reporting_to,
                t.roleID,
                r.roleName,
                rt.name as reporting_to_name
            `,
            where: [
                "t.adminID = ?"
            ],
            values: [
                userID
            ],
            join: [
                {
                    type: "LEFT JOIN",
                    table: "user_role_master",
                    alias: "r",
                    key1: "roleID",
                    key2: "roleID",
                },
                {
                    type: "LEFT JOIN",
                    table: "admin",
                    alias: "rt",
                    key1: "reporting_to",
                    key2: "adminID",
                },
            ]
        });
        return successResponse(res, {
            code: 1004,
            httpStatus: 200,
            data: {
                data: member[0] || {}
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