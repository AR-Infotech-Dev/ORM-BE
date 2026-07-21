import express from "express";
import * as visitController from "./visit.controller.js";
import { requirePermission } from "#middlewares/permissions.middleware.js";

const visitRoutes = express.Router();
visitRoutes.post( "/", requirePermission(["visits", "visit"], "view"), visitController.list);
visitRoutes.post( "/delete",requirePermission(["visits", "visit"], "delete"), visitController.changeStatus);
visitRoutes.put("/create",requirePermission(["visits", "visit"], "create"), visitController.getVisitDetails);
visitRoutes.get( "/:id",requirePermission(["visits", "visit"], "view"),visitController.getVisitDetails);
visitRoutes.post("/:id",requirePermission(["visits", "visit"], "edit"),visitController.getVisitDetails);

export default visitRoutes;