"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// lambdas/ebc-data/index.ts
var index_exports = {};
__export(index_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(index_exports);
var import_client_s3 = require("@aws-sdk/client-s3");

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

// lambdas/ebc-data/index.ts
var s3 = new import_client_s3.S3Client({});
async function handler(event) {
  try {
    const bucket = process.env.EBC_DATA_BUCKET;
    const key = process.env.EBC_DATA_KEY || "ebc-calendar.csv";
    if (!bucket) {
      return error(500, "EBC_DATA_BUCKET not configured");
    }
    const command = new import_client_s3.GetObjectCommand({ Bucket: bucket, Key: key });
    const response = await s3.send(command);
    const csvText = await response.Body?.transformToString("utf-8");
    if (!csvText) {
      return error(404, "No EBC data found. Upload a CSV to the S3 bucket.");
    }
    return success({ csv: csvText });
  } catch (err) {
    const e = err;
    if (e.name === "NoSuchKey") {
      return error(404, 'No EBC calendar CSV found in S3. Upload your file as "ebc-calendar.csv" to the bucket.');
    }
    console.error("Error reading EBC data:", err);
    return error(500, "Failed to read EBC data from S3");
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
