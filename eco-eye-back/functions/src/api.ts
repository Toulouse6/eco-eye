import { onRequest } from "firebase-functions/v2/https";
import OpenAI from "openai";
import cors from "cors";
import express, { Request, Response } from "express";
import rateLimit from "express-rate-limit";

// Express setup
const app = express();

app.use(
    cors({
        origin: ["https://eco-eye.web.app", "http://localhost:4200"],
        credentials: true,
    })
);

app.use(express.json({ limit: "6mb" }));

// Rate limit
const limiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: {
        error: "You've reached the limit. Please try again in an hour.",
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Health check
app.get("/", (_: Request, res: Response) => {
    res.send("Eco Eye API is alive!");
});

// Main endpoint
app.post("/generateReport", limiter, async (req: Request, res: Response) => {
    console.log("Received report request.");

    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    try {
        const {
            base64,
            mimeType = "image/jpeg",
            model,
            year,
        }: {
            base64: string;
            mimeType?: string;
            model: string;
            year: number;
        } = req.body;

        if (!base64 || typeof base64 !== "string") {
            return res.status(400).json({ error: "Missing or invalid 'base64'" });
        }

        if (!model || !year) {
            return res.status(400).json({ error: "Missing model or year." });
        }

        const prompt = `You are an eco vehicle analyst. Based on the following car model and year, generate a sustainable vehicle report.
Model: ${model}
Year: ${year}

Structure the response in JSON format with these keys:

{
  "overallGrade": "A+ to D (live eco score)",
  "fuelEfficiency": "e.g. 18 km/l or 5.2 L/100km",
  "energyConsumption": "e.g. 14.5 kWh/100km",
  "emissions": "e.g. Euro 6 or Tier 3 standard",
  "powerType": "Gasoline / Diesel / Hybrid / Electric",
  "batteryCapacity": "kWh value (only for hybrid/electric)",
  "co2": "grams per km (g/km)",
  "recyclability": "percentage, e.g. 82%",
  
  "tips": {
    "speed": "recommended cruising speed in km/h",
    "tirePressure": "recommended pressure in PSI",
    "idling": "maximum idle time in minutes",
    "funFact": "short and fun eco driving tip",
    "passengers": "recommended passenger range, e.g. 2–3"
  }
}

Only output pure JSON.`;

        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: prompt },
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Please create eco report" },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:${mimeType};base64,${base64}`,
                            },
                        },
                    ],
                },
            ],
            max_tokens: 1000,
        });

        // Cost tracking
        let totalCost = 0;
        const usage = response.usage;
        if (usage) {
            const inputCost = (usage.prompt_tokens || 0) * 0.005 / 1000;
            const outputCost = (usage.completion_tokens || 0) * 0.015 / 1000;
            totalCost = inputCost + outputCost;

            console.log(`Tokens: ${usage.prompt_tokens}/${usage.completion_tokens}`);
            console.log(`Estimated cost: $${totalCost.toFixed(6)}`);
        }

        const report = response.choices[0]?.message?.content || "No report returned.";
        res.status(200).json({ report, cost: totalCost.toFixed(6) });

    } catch (err: any) {
        console.error("Error in /generateReport:", err);

        if (err.response) {
            console.error("OpenAI API Error Response:", JSON.stringify(err.response.data || {}, null, 2));
        }

        res.status(500).json({
            error: "Failed to process report",
            details: err.message || "Unknown error",
        });
    }
});

// Export Firebase Function
export const generateReport = onRequest(
    {
        region: "us-central1",
        secrets: ["OPENAI_API_KEY"],
    },
    app
);
