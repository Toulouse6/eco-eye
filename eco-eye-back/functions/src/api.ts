import { onRequest } from "firebase-functions/v2/https";
import cors from "cors";
import express, { Request, Response } from "express";
import rateLimit from "express-rate-limit";
const { Configuration, OpenAIApi } = require("openai");

// OpenAI
const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Express
export const app = express();
app.use(cors({
    origin: [
        "https://eco-eye.web.app",
        "http://localhost:4200",
        "https://toulouse6.github.io"
    ],
    credentials: true
}));

app.options("*", cors());
app.use(express.json({ limit: "6mb" }));

app.set('trust proxy', 1);

// Rate limiter
const limiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 30,
    message: { error: "You've reached the limit. Please try again in an hour." },
    standardHeaders: true,
    legacyHeaders: false,
});

app.get("/", (_req, res) => {
    res.status(200).send("Eco Eye API is alive!");
});


// Health check
app.get('/status', (_req, res) => {
    res.status(200).send({ status: 'ok' });
});

// Main endpoint
app.post("/generate", limiter, async (req: Request, res: Response) => {
    const { model, year }: { model: string; year: number } = req.body;
    console.log('Fetching report for', model, year);

    if (typeof model !== "string" || typeof year !== "number") {
        return res.status(400).json({ error: "Invalid model or year format." });
    }
    const prompt = `You are an eco vehicle analyst. Based on the following car model and year, generate a sustainable vehicle report.

Model: ${model}
Year: ${year}

Respond with strict JSON only. Do not include comments, explanations, markdown, or non-JSON formatting. If unsure, respond with the closest valid structure.

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
    "passengers": "recommended passenger range, e.g. 2–3 passengers",
    "funFact": "🌱  short and fun eco driving tip"
  }
}

Respond with only valid JSON. Do not include explanations, intro, or markdown.`;

    try {
        const response = await openai.createChatCompletion({
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: prompt },
                { role: "user", content: `Please create an eco report for ${model} ${year}` }
            ],
            max_tokens: 1000,
        });

        const content = response.data.choices[0]?.message?.content;
        if (!content || typeof content !== "string") {
            return res.status(500).json({
                error: "GPT response is missing or malformed",
                details: "No content returned from OpenAI"
            });
        }

        let parsed;
        try {
            parsed = JSON.parse(content);
        } catch (err: any) {
            return res.status(500).json({
                error: "Invalid GPT output format",
                details: err.message || String(err)
            });
        }

        return res.status(200).json({ report: parsed, cost: null });

    } catch (err: any) {
        console.error("OpenAI error:", err.response?.data || err.message || err);
        return res.status(500).json({
            error: "Failed to process report",
            details: err.message || "Unknown error"
        });
    }
})

// Export Firebase Function
export const generateReport = onRequest(
    {
        region: "us-central1",
        secrets: ["OPENAI_API_KEY"],
    },
    app
);