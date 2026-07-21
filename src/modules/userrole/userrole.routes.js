import express from "express";
import * as userroleController from "./userrole.controller.js";
import { requirePermission } from "#middlewares/permissions.middleware.js";

const userroleRoutes = express.Router();

userroleRoutes.post("/", requirePermission(["userroles", "userrole"], "view"), userroleController.list);
userroleRoutes.post("/delete", requirePermission(["userroles", "userrole"], "delete"), userroleController.changeStatus);
userroleRoutes.put("/create", requirePermission(["userroles", "userrole"], "create"), userroleController.getUserRoleDetails);
userroleRoutes.get("/:id", requirePermission(["userroles", "userrole"], "view"), userroleController.getUserRoleDetails);
userroleRoutes.post("/:id", requirePermission(["userroles", "userrole"], "edit"), userroleController.getUserRoleDetails);

export default userroleRoutes;
