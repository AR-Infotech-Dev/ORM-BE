# flowups-BE Detailed Audit Explanation

हा document flowups-BE backend साठी आहे. भाषा जाणीवपूर्वक simple ठेवली आहे, म्हणजे issue काय आहे, का आहे, आणि fix कसं करायचं हे clear होईल.

## 1. Short Verdict

Backend आता आधीपेक्षा खूप चांगल्या structure मध्ये आहे कारण modules, shared utils, shared models, templates आणि path aliases add झाले आहेत.

पण अजून काही files खूप मोठ्या आहेत. काही controllers मध्ये API handling, DB query, business logic, email, export, notification हे सगळं एकत्र आहे. त्यामुळे project चालतो, पण future मध्ये maintain करायला risk आहे.

Current rating: **7.2/10**

Cleanup आणि service/model split केल्यावर realistic rating: **8.3/10 ते 8.6/10**

## 2. Rating Breakdown

| Area | Rating | Meaning |
| --- | ---: | --- |
| Folder structure | 8/10 | Module-wise structure चांगली आहे. Shared folder पण योग्य आहे. |
| Code reuse | 7/10 | CommonModel/filter builder आहे, पण controllers मध्ये अजून repeated list/create/update code आहे. |
| Maintainability | 6.8/10 | मोठे controllers आणि mixed responsibilities मुळे risk आहे. |
| API consistency | 7/10 | success/failure response centralized आहे, पण काही error handling/logging inconsistent आहे. |
| DB/query organization | 6.8/10 | काही modules मध्ये model आहे, काही controllers मध्ये direct SQL आहे. |
| Validation/security hygiene | 6.8/10 | validation आहे, पण सर्व modules मध्ये equally strong नाही. |
| Cleanup/dead code | 6.5/10 | debug logs, legacy script, commented old code आहेत. |

## 3. Current Backend Structure

Current structure generally अशी आहे:

```txt
src/
  app.js
  server.js
  config/
  middlewares/
  routes/
  socket/
  shared/
    models/
    utils/
  templates/
    emails/
    excels/
  modules/
    auth/
    customer/
    ticket/
    dashboard/
    reports/
    users/
    product/
    company/
    categories/
    menus/
    notifications/
    amc-reminders/
```

हे चांगलं आहे.

### Good Decisions Already Done

- `src/modules/*` module-wise आहे
- `src/shared/utils/*` मध्ये common utilities आहेत
- `src/shared/models/common.model.js` मध्ये common DB functions आहेत
- `src/templates/*` मध्ये email/excel templates आहेत
- `#modules/*`, `#shared/*`, `#config/*` aliases आहेत
- `auth` module rename/move झालं आहे
- `product-expiry-report` reports module खाली आहे

## 4. Main Problem: Controllers Too Big

Controller ideally काय करतो?

Controller should:

1. request वाचतो
2. validation call करतो
3. service function call करतो
4. response send करतो

पण सध्या काही controllers मध्ये हे सगळं एकाच file मध्ये आहे:

- DB queries
- business rules
- email send
- Excel generation
- notification
- token generation
- list filtering
- import/export

### Biggest Controller Files

| File | Approx Lines | Issue |
| --- | ---: | --- |
| `src/modules/users/users.controller.js` | 890+ | user CRUD, profile, password, markers, upload, validation, email सगळं एकत्र |
| `src/modules/amc-reminders/amc-reminder.controller.js` | 790+ | reminder list, email, ticket create, visits, activity, reports सगळं एकत्र |
| `src/modules/reports/reports.controller.js` | 790+ | customer report, performance report, export/send report, SQL सगळं एकत्र |
| `src/modules/categories/categories.controller.js` | 610+ | category tree/list/create/update/delete/menu definitions mixed |
| `src/modules/company/company.controller.js` | 500+ | company CRUD, SMTP test, upload settings mixed |
| `src/modules/dashboard/dashboard.model.js` | 400+ | many dashboard queries in one model |
| `src/modules/customer/customer.controller.js` | 380+ | customer CRUD + import/export |
| `src/modules/ticket/ticket-visits.controller.js` | 370+ | visit list/create/update/public visit flow/email mixed |

## 5. Service Layer म्हणजे BE मध्ये काय?

Backend मध्ये service म्हणजे business logic ठेवायची file.

Controller:

```js
export const list = async (req, res) => {
  const result = await ticketService.listTickets(req.body, req.user);
  return successResponse(res, { data: result });
};
```

Service:

```js
export async function listTickets(body, user) {
  const filters = buildTicketFilters(body, user);
  const rows = await ticketModel.list(filters);
  return { data: rows };
}
```

Model:

```js
export function list(filters) {
  return query("SELECT ...", values);
}
```

### Why Service Layer Useful?

जर controller मध्येच सगळं असेल तर:

- testing hard
- file मोठी होते
- reuse कमी
- bug fix करताना unrelated flow break होऊ शकतो

Service layer केल्यावर:

- controller छोटा
- business logic reusable
- model only DB काम करतो
- reports/email/notification organized होतात

## 6. Ideal Module Structure

### Simple CRUD Module

Example: Product

```txt
src/modules/product/
  product.routes.js
  product.controller.js
  product.service.js
  product.model.js
  product.validation.js
  product.filter.js
  product.constants.js
```

### Complex Module

Example: Ticket

```txt
src/modules/ticket/
  ticket.routes.js
  ticket.controller.js
  ticket.service.js
  ticket.model.js
  ticket.validation.js
  ticket.filter.js
  ticket.constants.js
  ticket.utils.js
  comments/
    ticket-comments.routes.js
    ticket-comments.controller.js
    ticket-comments.service.js
    ticket-comments.model.js
  visits/
    ticket-visits.routes.js
    ticket-visits.controller.js
    ticket-visits.service.js
    ticket-visits.model.js
  work-logs/
    ticket-work-logs.controller.js
    ticket-work-logs.service.js
    ticket-work-logs.model.js
```

Currently comments/visits/work logs files ticket folder मध्ये आहेत, ते ठीक आहे. पण service/model split अजून होऊ शकतं.

## 7. File Wise Detailed Improvements

## 7.1 `src/modules/users/users.controller.js`

Current:

- user list
- employee list
- create/update/get
- delete/status
- profile update
- password change
- markers/location
- menu/sidebar access
- email/account credentials

Problem:

- एक file 890+ lines आहे
- अनेक unrelated flows एकत्र आहेत
- direct SQL + CommonModel + response logic एकत्र आहे

Improve:

```txt
src/modules/users/
  users.controller.js
  users.service.js
  users.model.js
  users.validation.js
  users.filter.js
  user-profile.service.js
  user-location.service.js
```

Suggested split:

- `users.service.js`: list/create/update/delete business logic
- `users.model.js`: DB queries
- `user-profile.service.js`: profile/password flows
- `user-location.service.js`: markers/location flow
- `user-email.service.js`: credential email flow

Controller should become around 150-250 lines.

## 7.2 `src/modules/amc-reminders/amc-reminder.controller.js`

Current:

- AMC customer list
- reminder send
- reminder logs
- AMC call ticket create
- schedule visit
- AMC support report
- Excel/email report
- activity data

Problem:

- 790+ lines
- long SQL queries inside controller
- email/report/ticket/visit logic mixed

Improve:

```txt
src/modules/amc-reminders/
  amc-reminder.routes.js
  amc-reminder.controller.js
  amc-reminder.service.js
  amc-reminder.model.js
  amc-reminder-email.service.js
  amc-reminder-report.service.js
  amc-ticket.service.js
```

Suggested responsibility:

- controller: request/response only
- service: main AMC business flow
- model: AMC SQL queries
- email service: reminder email
- report service: support report/excel attachment
- ticket service: AMC ticket and visit creation

## 7.3 `src/modules/reports/reports.controller.js`

Current:

- customer report
- send customer report
- work/performance report
- activity timeline
- SQL queries
- report attachments

Problem:

- reports are different domains पण same controller मध्ये आहेत
- large SQL blocks controller मध्ये आहेत
- report export/send logic mixed आहे

Improve:

```txt
src/modules/reports/
  reports.routes.js
  customer-report/
    customer-report.controller.js
    customer-report.service.js
    customer-report.model.js
  work-report/
    work-report.controller.js
    work-report.service.js
    work-report.model.js
  performance-report/
    performance-report.controller.js
    performance-report.service.js
    performance-report.model.js
  product-expiry-report/
    product-expiry-report.controller.js
    product-expiry-report.service.js
    product-expiry-report.routes.js
```

Product expiry report already separate आहे. त्याच pattern ने customer/work/performance reports split करावेत.

## 7.4 `src/modules/categories/categories.controller.js`

Current:

- category list
- tree/list
- create/update
- delete/status
- category slug based operations
- menu/module definitions related logic

Problem:

- 610+ lines
- generic category logic and module definition logic mixed

Improve:

```txt
src/modules/categories/
  categories.controller.js
  categories.service.js
  categories.model.js
  categories.validation.js
  categories.constants.js
```

If module definition logic is separate domain:

```txt
src/modules/system/definitions.service.js
```

## 7.5 `src/modules/company/company.controller.js`

Current:

- company CRUD
- SMTP settings
- SMTP test
- logo/email settings

Problem:

- company entity and mail config business mixed

Improve:

```txt
src/modules/company/
  company.controller.js
  company.service.js
  company.model.js
  company-mail.service.js
```

`testSmtpConnection` related flow `company-mail.service.js` मध्ये ठेव.

## 7.6 `src/modules/customer/customer.controller.js`

Current:

- customer CRUD
- customer import/export Excel
- products JSON handling
- validations

Problem:

- import/export आणि CRUD एकत्र आहेत

Improve:

```txt
src/modules/customer/
  customer.controller.js
  customer.service.js
  customer.model.js
  customer.validation.js
  customer.import.service.js
  customer.export.service.js
  customer.utils.js
```

## 7.7 `src/modules/ticket/ticket.controller.js`

Current:

- ticket list
- create/update/read
- delete/status
- close feedback
- notification/email on changes

Good:

- ticket model आहे
- ticket utils आहेत
- validation आहे
- constants आहेत

Improve:

```txt
src/modules/ticket/
  ticket.controller.js
  ticket.service.js
  ticket.model.js
  ticket-notification.service.js
  ticket-email.service.js
```

Move:

- `notifyTicketUpdates` -> `ticket-notification.service.js`
- `closeTicketWithFeedback` -> `ticket.service.js` or `ticket-feedback.service.js`
- `sendEmailToClient` helper already utils मध्ये आहे, पण email flows service मध्ये येऊ शकतात

## 7.8 `src/modules/ticket/ticket-visits.controller.js`

Current:

- visit list
- visit create
- mark visited
- public visit token
- email notification

Problem:

- controller large आहे
- public visit and internal visit flow separate नाहीत

Improve:

```txt
src/modules/ticket/visits/
  ticket-visits.controller.js
  ticket-visits.service.js
  ticket-visits.model.js
  ticket-visit-email.service.js
```

## 7.9 `src/modules/ticket/ticket-work-logs.controller.js`

Current:

- work log list/create/update
- active work logic
- expected minutes summary

Improve:

```txt
src/modules/ticket/work-logs/
  ticket-work-logs.controller.js
  ticket-work-logs.service.js
  ticket-work-logs.model.js
```

## 7.10 `src/modules/dashboard/dashboard.model.js`

Current:

- many dashboard SQL queries in one model
- summary, ticket status, trends, AMC health, product expiry alerts

Problem:

- model is doing many dashboard domains

Improve:

```txt
src/modules/dashboard/
  dashboard.controller.js
  dashboard.service.js
  dashboard.model.js
  dashboard-ticket.model.js
  dashboard-amc.model.js
  dashboard-product.model.js
```

Or simpler:

```txt
src/modules/dashboard/models/
  ticket-dashboard.model.js
  amc-dashboard.model.js
  product-dashboard.model.js
```

## 8. CommonModel: Good But Needs Boundaries

Current:

```txt
src/shared/models/common.model.js
```

Good:

- common CRUD DB operations centralized
- repeated insert/update/delete/list कमी झाले

But:

- every complex query CommonModel मध्ये जबरदस्ती बसवू नये
- module-specific complex query module model मध्येच ठेवा

Rule:

- simple CRUD: CommonModel OK
- report/dashboard/complex joins: module-specific model better

Example:

```js
// OK in CommonModel
getMasterDetails("customer", "*", { customer_id })

// Better in module model
getCustomerSupportReport({ customerId, fromDate, companyId })
```

## 9. Filter Builder

Current:

```txt
src/shared/utils/filter.builder.js
```

Good:

- dynamic filters centralize झाले
- joins based on default/custom columns

Risk:

- operators limited आहेत
- SQL column names carefully whitelist करणे गरजेचे
- date/time timezone behavior consistently handle करणे गरजेचे

Improve:

- supported operators constants मध्ये define कर
- field whitelist strict ठेव
- tests add कर

Suggested:

```txt
src/shared/filters/
  filter.builder.js
  filter.operators.js
  filter.types.js
```

## 10. Validation

Current:

- `bodyValidator.js`
- `request.validator.js`
- module validation files आहेत

Issue:

- काही modules strong validation वापरतात
- काही routes direct body वापरतात

Improve:

- every create/update route ला validation mandatory करा
- list filters validate करा
- IDs validate करा

Example:

```js
const validation = validateBody(req.body, ticketValidationRules);
if (!validation.isValid) return failureResponse(...);
```

Better long-term:

- Joi already dependency मध्ये आहे
- Joi schemas per module use करू शकतो

## 11. Error Handling

Current:

Most controllers:

```js
try {
  ...
} catch (error) {
  return failureResponse(res, { code: 2008, httpStatus: 500, message: error.message });
}
```

Problem:

- repeated try/catch
- sometimes console.log(error)
- error logging consistent नाही

Improve:

- `asyncHandler` already exists
- routes/controllers मध्ये use करा

Example:

```js
export const list = asyncHandler(async (req, res) => {
  const result = await service.list(req.body, req.user);
  return successResponse(res, { data: result });
});
```

Global `errorHandler` then centralized response देऊ शकतो.

## 12. Logging

Debug logs found in:

- `src/middlewares/auth.middleware.js`
- `src/socket/index.js`
- `src/modules/auth/auth.controller.js`
- `src/modules/users/users.controller.js`
- `src/modules/amc-reminders/amc-reminder.controller.js`
- `src/modules/ticket/ticket.utils.js`
- `src/modules/ticket/ticket-visits.controller.js`
- `src/modules/notifications/notifications.controller.js`
- `src/modules/reports/product-expiry-report/product-expiry-report.controller.js`

Problem:

- production console noisy
- sensitive error details leak होऊ शकतात

Improve:

```txt
src/shared/utils/logger.js
```

Example:

```js
export const logger = {
  info: (...args) => {
    if (process.env.NODE_ENV !== "production") console.info(...args);
  },
  error: (...args) => {
    console.error(...args);
  },
};
```

Then replace:

```js
console.log(error);
```

with:

```js
logger.error("Auth middleware error", error);
```

## 13. Legacy Script Issue

File:

```txt
src/scripts/printRoutes.js
```

Current issue:

```js
import { legacyRoutes } from "#routes/legacy.routes.js";
```

But `legacy.routes.js` missing आहे.

Meaning:

- main app ठीक आहे
- only routes script broken आहे

Fix options:

1. script remove करा if unused
2. script update करा current Express router scan करण्यासाठी
3. `legacy.routes.js` restore करा if needed

Recommended:

- If migration done असेल, old legacy script remove करा or rewrite करा.

## 14. Templates

Current:

```txt
src/templates/emails/
src/templates/excels/
```

Good:

- HTML/email/excel templates code मधून separate आहेत
- `renderTemplate` use होत आहे

Improve:

- template names constants मध्ये ठेव
- missing template error friendly करा
- template data shape document करा

Suggested:

```txt
src/templates/TEMPLATE_KEYS.js
```

## 15. Reports Module

Reports हा backend मध्ये मोठा growth area आहे.

Current:

- `reports.controller.js` अजून मोठा आहे
- product expiry report separate आहे, good

Recommended reports structure:

```txt
src/modules/reports/
  reports.routes.js
  customer-report/
  work-report/
  performance-report/
  product-expiry-report/
```

Each report:

```txt
report.controller.js
report.service.js
report.model.js
report.validation.js
```

Why?

- each report independent होईल
- SQL/readability improve
- FE report changes easy to map

## 16. Auth Module

Current:

```txt
src/modules/auth/
  auth.controller.js
  auth.model.js
  auth.routes.js
  auth.service.js
```

Good:

- auth model renamed properly
- service already exists

Improve:

- auth.controller अजून 290+ lines आहे
- forgot password, login, logout, session, password update split करू शकतो

Suggested:

```txt
auth.service.js
auth-session.service.js
auth-password.service.js
```

Also:

- remove `console.log('error : ', error)`
- avoid exposing detailed auth errors

## 17. Socket Module

File:

```txt
src/socket/index.js
```

Issue:

- console logs with emojis
- production logging uncontrolled

Improve:

- logger use करा
- room naming helper already असेल तर centralize करा
- socket emit errors structured करा

## 18. Database Queries

Current:

- simple CRUD CommonModel
- complex SQL controllers/models मध्ये mixed

Good:

- query parameters mostly placeholders वापरतात

Risk:

- dynamic columns/orderBy safe whitelist शिवाय dangerous होऊ शकतात
- complex SQL in controllers hard to test

Improve:

- orderBy whitelist
- module model per complex query
- SQL builder helpers sparingly

## 19. Testing / Quality Scripts

Current package scripts:

```json
{
  "dev": "node --watch src/server.js",
  "start": "node src/server.js",
  "routes": "node src/scripts/printRoutes.js"
}
```

Missing:

- test script
- lint script
- format script
- check script

Recommended:

```json
{
  "check": "node --check src/server.js",
  "lint": "eslint src",
  "test": "node --test"
}
```

Note:

- `node --check src/server.js` only syntax checks one file. For full project, a small script can walk all `.js` files and run syntax/import checks.

## 20. Security/Production Hygiene

Check:

- `.env` should never be committed
- `LEGACY_ENCRYPTION_KEY` default value in `env.js` should be reviewed
- auth/session cookies should be secure in production
- CORS should be strict in production
- file uploads need type/size validation
- public visit/feedback tokens should expire or be single-use where possible
- error response should not expose SQL/internal stack

## 21. Practical Execution Plan

### Phase 1: Safe Cleanup

Low risk, quick wins:

1. Remove debug console logs.
2. Add `logger.js`.
3. Fix/remove `src/scripts/printRoutes.js`.
4. Add lint/check script.
5. Ensure `.env`, uploads, generated files are ignored.

### Phase 2: Service Layer For Biggest Controllers

Start with:

1. `reports.controller.js`
2. `amc-reminder.controller.js`
3. `users.controller.js`

Why these first?

- biggest files
- highest mixed responsibility
- most maintainability benefit

### Phase 3: Split Reports

1. Customer report
2. Work report
3. Performance report
4. Product expiry report already separate, keep/improve

### Phase 4: Ticket Submodule Services

1. Ticket service
2. Ticket notification service
3. Ticket visit service
4. Ticket work log service
5. Ticket comments service

### Phase 5: Standardize Patterns

1. All modules use controller/service/model pattern
2. All create/update use validation
3. All list endpoints use centralized filter builder or module-specific query model
4. All errors go through `failureResponse` or centralized error middleware

## 22. First File To Refactor

Best first file:

```txt
src/modules/reports/reports.controller.js
```

Why?

- reports are already naturally separable
- product expiry report already separate example आहे
- customer report/work report/performance report split केल्यावर structure clear होईल

Second:

```txt
src/modules/amc-reminders/amc-reminder.controller.js
```

Third:

```txt
src/modules/users/users.controller.js
```

## 23. Before/After Example

Before:

```txt
reports.controller.js
  - customer report SQL
  - customer report send email
  - performance report SQL
  - activity timeline SQL
  - work report SQL
```

After:

```txt
reports/
  customer-report/
    customer-report.controller.js
    customer-report.service.js
    customer-report.model.js
  performance-report/
    performance-report.controller.js
    performance-report.service.js
    performance-report.model.js
  work-report/
    work-report.controller.js
    work-report.service.js
    work-report.model.js
```

Controller example:

```js
export const getCustomerReport = asyncHandler(async (req, res) => {
  const report = await customerReportService.buildReport(req.body, req.user);
  return successResponse(res, { code: 1004, httpStatus: 200, data: report });
});
```

Service example:

```js
export async function buildReport(body, user) {
  const customer = await customerReportModel.getCustomer(body.customer_id, user);
  const tickets = await customerReportModel.getTickets(body, user);
  const summary = buildSummary(tickets);
  return { customer, tickets, summary };
}
```

Model example:

```js
export function getTickets(body, user) {
  return query("SELECT ... FROM tickets ...", values);
}
```

## 24. Final Simple Summary

flowups-BE चा base आता चांगला आहे.

आता मुख्य काम:

- मोठे controllers split कर
- service layer add कर
- complex SQL model files मध्ये move कर
- reports separate submodules मध्ये ठेव
- debug logs remove कर
- validation consistent कर
- broken legacy route script fix/remove कर
- lint/test/check scripts add कर

हे केलं की backend maintainability आणि scalability खूप improve होईल.

