"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// lambdas/tc-data/index.ts
var index_exports = {};
__export(index_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(index_exports);
var import_client_s3 = require("@aws-sdk/client-s3");
var XLSX = __toESM(require("xlsx"));

// lambdas/shared/response.ts
function success(body) {
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type,Authorization"
    },
    body: JSON.stringify(body)
  };
}
function error(statusCode, message) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type,Authorization"
    },
    body: JSON.stringify({ error: message })
  };
}

// lambdas/tc-data/index.ts
var s3 = new import_client_s3.S3Client({});
async function handler(event) {
  try {
    const bucket = process.env.EBC_DATA_BUCKET;
    const key = "tc-opportunities.xlsx";
    const accountId = event.queryStringParameters?.accountId;
    if (!bucket) {
      return error(500, "EBC_DATA_BUCKET not configured");
    }
    const command = new import_client_s3.GetObjectCommand({ Bucket: bucket, Key: key });
    const response = await s3.send(command);
    const buffer = await response.Body?.transformToByteArray();
    if (!buffer) {
      return error(404, "No T&C data found. Upload tc-opportunities.xlsx to the S3 bucket.");
    }
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);
    const opportunities = rows.map((row) => ({
      accountId: String(row["18 Character Account ID"] || ""),
      accountName: String(row["Account Name"] || ""),
      opportunityName: String(row["Opportunity Name"] || ""),
      productName: String(row["Product Name"] || ""),
      productFamily: String(row["Product Family"] || ""),
      stage: String(row["Stage"] || ""),
      forecastStatus: String(row["Forecast Status"] || ""),
      closeDate: String(row["Close Date"] || ""),
      amount: Number(row["Product Net Amount (converted)"] || 0),
      totalOpportunity: Number(row["Total Opportunity (converted)"] || 0),
      numberOfStudents: Number(row["Number of Students"] || 0),
      trainingDeliveryType: String(row["Training Delivery Type"] || ""),
      subscriptionType: String(row["Subscription Type"] || ""),
      isT2K: String(row["Is T2K"] || ""),
      geo: String(row["Geo"] || ""),
      segment: String(row["Segment"] || ""),
      skillBuilderAddOn: String(row["AWS Skill Builder Add On"] || "")
    }));
    if (accountId) {
      const accountOpps = opportunities.filter((o) => o.accountId === accountId);
      if (accountOpps.length === 0) {
        return success({ accountId, summary: null, message: "No T&C opportunities found for this account" });
      }
      const summary = {
        accountId,
        accountName: accountOpps[0].accountName,
        totalPipeline: accountOpps.filter((o) => !["Closed Won", "Closed Lost"].includes(o.stage)).reduce((sum, o) => sum + o.totalOpportunity, 0),
        openOpportunities: accountOpps.filter((o) => !["Closed Won", "Closed Lost"].includes(o.stage)).length,
        closedWonRevenue: accountOpps.filter((o) => o.stage === "Closed Won").reduce((sum, o) => sum + o.amount, 0),
        products: [...new Set(accountOpps.map((o) => o.productName).filter(Boolean))],
        subscriptionTypes: [...new Set(accountOpps.map((o) => o.subscriptionType).filter(Boolean))],
        totalStudents: accountOpps.reduce((sum, o) => sum + o.numberOfStudents, 0),
        isT2K: accountOpps.some((o) => o.isT2K === "true" || o.isT2K === "TRUE"),
        opportunities: accountOpps
      };
      return success({ accountId, summary });
    }
    const accountMap = /* @__PURE__ */ new Map();
    for (const opp of opportunities) {
      if (!opp.accountId) continue;
      if (!accountMap.has(opp.accountId)) accountMap.set(opp.accountId, []);
      accountMap.get(opp.accountId).push(opp);
    }
    const summaries = [...accountMap.entries()].map(([id, opps]) => ({
      accountId: id,
      accountName: opps[0].accountName,
      totalPipeline: opps.filter((o) => !["Closed Won", "Closed Lost"].includes(o.stage)).reduce((sum, o) => sum + o.totalOpportunity, 0),
      openOpportunities: opps.filter((o) => !["Closed Won", "Closed Lost"].includes(o.stage)).length,
      closedWonRevenue: opps.filter((o) => o.stage === "Closed Won").reduce((sum, o) => sum + o.amount, 0),
      products: [...new Set(opps.map((o) => o.productName).filter(Boolean))],
      subscriptionTypes: [...new Set(opps.map((o) => o.subscriptionType).filter(Boolean))],
      totalStudents: opps.reduce((sum, o) => sum + o.numberOfStudents, 0),
      isT2K: opps.some((o) => o.isT2K === "true" || o.isT2K === "TRUE"),
      opportunities: opps
    }));
    return success({
      totalAccounts: summaries.length,
      totalOpportunities: opportunities.length,
      summaries: summaries.sort((a, b) => b.totalPipeline - a.totalPipeline)
    });
  } catch (err) {
    const e = err;
    if (e.name === "NoSuchKey") {
      return error(404, "No T&C opportunities file found. Upload tc-opportunities.xlsx to the S3 bucket.");
    }
    console.error("Error reading T&C data:", err);
    return error(500, "Failed to read T&C data");
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
