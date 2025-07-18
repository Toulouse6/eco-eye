import { onRequest } from "firebase-functions/v2/https";
import cors from "cors";
import express, { Request, Response } from "express";
import rateLimit from "express-rate-limit";
const { Configuration, OpenAIApi } = require("openai");
import * as admin from "firebase-admin";

// OpenAI setup
const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Firebase Admin setup
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: process.env.GCLOUD_PROJECT,
    });
}

const db = admin.firestore();

// Express setup
export const app = express();

app.use(cors({
    origin: [
        "https://eco-eye.web.app",
        "http://localhost:4200",
        "https://toulouse6.github.io"
    ],
    credentials: true,
}));
app.options("*", cors());
app.use(express.json({ limit: "6mb" }));

// Rate limiter
const limiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 30,
    message: {
        error: "You've reached the limit. Please try again in an hour.",
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Health check
app.get("/status", (_req, res) => {
    res.json({ status: "ok", timestamp: Date.now() });
});

app.get("/", (_req, res) => {
    res.status(200).send("Eco Eye API is alive!");
});

// Model metadata endpoint
app.get("/models", async (_req, res) => {
    try {
        const doc = await db.collection("eco-meta").doc("modelMap").get();
        if (!doc.exists) return res.status(404).json({ error: "Model map not found." });
        res.status(200).json(doc.data());
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch models.", details: String(err) });
    }
});

// Main endpoint
app.post("/generate", limiter, async (req: Request, res: Response) => {
    const { model, year }: { model: string; year: number } = req.body;
    const modelKey = model.trim().toLowerCase().replace(/\s+/g, "_");

    if (typeof model !== "string" || typeof year !== "number") {
        return res.status(400).json({ error: "Invalid model or year format." });
    }

    // Test Firestore
    try {
        await db.collection("eco-reports").doc("test-access").set({ init: "ok" }, { merge: true });
    } catch (err) {
        if (err instanceof Error) {
            return res.status(500).json({
                error: "Failed to process report",
                details: err.message,
            });
        }

        return res.status(500).json({
            error: "Failed to process report",
            details: "Unknown error",
        });
    }

    console.log("📍 Ensuring parent doc exists...");
    await db.collection("eco-reports").doc(modelKey).set({}, { merge: true });
    console.log("✅ Parent doc ready.");

    const docRef = db
        .collection("eco-reports")
        .doc(modelKey)
        .collection("years")
        .doc(year.toString());

    let cachedDoc;

    try {
        cachedDoc = await docRef.get();
        console.log("📄 Retrieved Firestore doc:", cachedDoc.exists);
    } catch (err) {
        console.error("❌ Firestore .get() failed:", err);
        return res.status(500).json({
            error: "Firestore .get() failure",
            details: err instanceof Error ? err.message : "Unknown read error"
        });
    }

    // Return cached if available
    if (cachedDoc.exists) {
        return res.status(200).json({ report: cachedDoc.data(), cost: null });
    }

    const prompt = `You are an eco vehicle analyst. Based on the following car model and year, generate a sustainable vehicle report.

Model: ${model}
Year: ${year}

Respond in strict JSON format with the following keys:

{
  "overallGrade": "A+ to D (live eco score)",
  "fuelEfficiency": "e.g. 18 km/l or 5.2 L/100km (set to 'N/A' if Electric)",
  "energyConsumption": "e.g. 14.5 kWh/100km",
  "emissions": "e.g. Euro 6 or Tier 3 standard (set to 'Zero Tailpipe Emissions' if Electric)",
  "powerType": "Gasoline / Diesel / Hybrid / Electric",
  "batteryCapacity": "kWh value (only for hybrid/electric)",
  "co2": "grams per km (g/km), or 'Zero Tailpipe Emissions' if Electric",
  "recyclability": "percentage, e.g. 82%",
  "estimatedRange": "calculated from batteryCapacity and energyConsumption in km (e.g. 528 km)",
  "chargingTime": "estimated full charge time in hours based on 11 kW charger (e.g. 9 hours)",
  "energySaved": "estimated g CO₂ avoided based on electric vs ICE",
  "tips": {
    "speed": "recommended cruising speed in km/h",
    "tirePressure": "recommended pressure in PSI",
    "idling": "maximum idle time in minutes, e.g. 2–3 minutes or 'N/A' if Electric",
    "funFact": "short and fun eco driving tip",
    "passengers": "recommended passenger range, e.g. 2–3 passengers"
  }
}

Respond with only valid JSON. Do not include explanations, intro, or markdown.`;

    try {
        const response = await openai.createChatCompletion({
            model: "gpt-4",
            messages: [
                { role: "system", content: prompt },
                { role: "user", content: `Please create an eco report for ${model} ${year}` }
            ],
            max_tokens: 1000,
        });

        const content = response.data.choices[0]?.message?.content;

        const parsed = JSON.parse(content);
        await docRef.set(parsed);

        // 📘 Optionally cache model-year list
        await db.collection("eco-meta").doc("modelMap").set({
            [modelKey]: admin.firestore.FieldValue.arrayUnion(year)
        }, { merge: true });

        return res.status(200).json({ report: parsed, cost: null });

    } catch (err: any) {
        return res.status(500).json({
            error: "Failed to process report",
            details: err.message || "Unknown error",
        });
    }
});

// Export function
export const generateReport = onRequest(
    {
        region: "us-central1",
        secrets: ["OPENAI_API_KEY"],
    },
    app
);
