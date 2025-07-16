import { onRequest } from "firebase-functions/v2/https";
import OpenAI from "openai";
import cors from "cors";
import express, { Request, Response } from "express";
import rateLimit from "express-rate-limit";

// Express setup
const app = express();

app.use(cors({
    origin: ["https://eco-eye.web.app", "http://localhost:4200"],
    credentials: true,
}));
app.options("*", cors());

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
app.post("/", limiter, async (req: Request, res: Response) => {
    console.log("Received report request.");

    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    const { model, year }: { model: string; year: number } = req.body;

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

Only output pure JSON.
Do not include any explanation or text outside the JSON. Only return pure JSON.`;

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: prompt },
                {
                    role: "user",
                    content: `Please create an eco report for ${model} ${year}`
                },
            ],
            max_tokens: 1000,
        });

        const content = response.choices[0]?.message?.content;
        const json = JSON.parse(content || '{}');

        return res.status(200).json({
            report: json,
            cost: null
        });

    } catch (err: any) {
        console.error("Failed to process report:", err);
        return res.status(500).json({
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