import express from 'express';
import * as myTeamController from './myTeams.controller.js';
import { requirePermission } from '#middlewares/permissions.middleware.js';
import { tenantDbMiddleware } from '#middlewares/ownDB.middleware.js';

const myTeamsRoutes = express.Router();

myTeamsRoutes.post('/', requirePermission(['myTeams'], 'view'), myTeamController.list);

myTeamsRoutes.get(
    '/member-details/:userID',
    requirePermission(['myTeams'], 'view'),
    myTeamController.getMemberDetails
);

export default myTeamsRoutes;