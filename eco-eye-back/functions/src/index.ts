import { onRequest } from "firebase-functions/v2/https";
import { app as generateReportApp } from "./api";

export const generateReport = onRequest(
  {
    region: "us-central1",
    secrets: ["OPENAI_API_KEY"],
  },
  generateReportApp
);

