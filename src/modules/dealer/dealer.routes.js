import express from "express";
import * as dealerController from "./dealer.controller.js";
import { requirePermission } from "#middlewares/permissions.middleware.js";

const dealerRoute = express.Router();

dealerRoute.post("/", requirePermission(["dealers", "dealer"], "view"), dealerController.list);
dealerRoute.post("/delete", requirePermission(["dealers", "dealer"], "delete"), dealerController.changeStatus);
dealerRoute.put("/create", requirePermission(["dealers", "dealer"], "create"), dealerController.getdealerDetails);
dealerRoute.get("/:id", requirePermission(["dealers", "dealer"], "view"), dealerController.getdealerDetails);
dealerRoute.post("/:id", requirePermission(["dealers", "dealer"], "edit"), dealerController.getdealerDetails);


export default dealerRoute;
