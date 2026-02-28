import { GoogleGenerativeAI } from "@google/generative-ai";

export const config = {
  maxDuration: 30,
};

export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: "Server configuration missing API Key" });

  try {
    const { base64Data, isPro, userContext } = req.body;

    const {
      gender = "Male",
      age = "25",
      targetCalories = "2000",
      weight = "70"
    } = userContext || {};

    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
      generationConfig: { responseMimeType: "application/json" },
    });

    const base64Content = base64Data.includes(",") ? base64Data.split(",")[1] : base64Data;
    const imagePart = { inlineData: { data: base64Content, mimeType: "image/jpeg" } };

    const dynamicInstructions = isPro
      ? "Calculate the exact duration for ALL 10 activities based on the calories identified."
      : "ONLY calculate the duration for Activity 1 and 2. For activities 3-10, use the exact placeholder values provided in the JSON structure below.";

    // THE SCIENTIFIC PROMPT USING WEIGHT
    const prompt = `
    USER CONTEXT:
    - User Profile: ${age} year old ${gender}.
    - User Weight: ${weight} kg.
    - Daily Calorie Target: ${targetCalories} cal.

    INSTRUCTIONS:
    1. Identify the meal or food items in the image.
    2. Provide a best estimate of the total calories as a plain integer.
    3. ${dynamicInstructions}

    4. SCIENTIFIC EXERCISE CALCULATION:
       Calculate the EXACT duration (in minutes) required to burn the estimated calories for this specific meal.
       You MUST use the standard Metabolic Equivalent of Task (MET) formula:
       Calories per Minute = (MET * ${weight} * 3.5) / 200.
       Duration (Minutes) = Total_Meal_Calories / Calories_per_Minute.

       Use these specific MET values:
       - Running (moderate): 10.0
       - Walking (brisk): 3.5
       - Weight Training: 6.0
       - Cycling (steady): 7.5
       - Swimming (laps): 8.0
       - HIIT: 11.0
       - Yoga: 2.5
       - Rowing: 7.0
       - Jump Rope: 12.0
       - Hiking (uphill): 6.5

    5. STATUS LABELS:
       - 'HEALTHY' if the food is < 400 cal.
       - 'MODERATE' if the food is 400-800 cal.
       - 'UNHEALTHY' if the food is > 800 cal.

    6. SUMMARY CONTENT:
       The "summary" string MUST start with the calculation result (e.g., "42 minutes") followed by a short, personalized fitness tip for a ${age}yo ${gender} weighing ${weight}kg.

    Return ONLY this JSON structure:
    {
      "identifiedProduct": "string",
      "calories": 0,
      "activity1": {"status": "HEALTHY | MODERATE | UNHEALTHY", "summary": "string"},
      "activity2": {"status": "HEALTHY | MODERATE | UNHEALTHY", "summary": "string"},
      "activity3": ${isPro ? `{"status": "string", "summary": "string"}` : `{"status": "WAITING", "summary": "Premium Feature"}`},
      "activity4": ${isPro ? `{"status": "string", "summary": "string"}` : `{"status": "WAITING", "summary": "Premium Feature"}`},
      "activity5": ${isPro ? `{"status": "string", "summary": "string"}` : `{"status": "WAITING", "summary": "Premium Feature"}`},
      "activity6": ${isPro ? `{"status": "string", "summary": "string"}` : `{"status": "WAITING", "summary": "Premium Feature"}`},
      "activity7": ${isPro ? `{"status": "string", "summary": "string"}` : `{"status": "WAITING", "summary": "Premium Feature"}`},
      "activity8": ${isPro ? `{"status": "string", "summary": "string"}` : `{"status": "WAITING", "summary": "Premium Feature"}`},
      "activity9": ${isPro ? `{"status": "string", "summary": "string"}` : `{"status": "WAITING", "summary": "Premium Feature"}`},
      "activity10": ${isPro ? `{"status": "string", "summary": "string"}` : `{"status": "WAITING", "summary": "Premium Feature"}`},
      "recommendations": ["Product 1", "Product 2", "Product 3", "Product 4", "Product 5", "Product 6", "Product 7", "Product 8", "Product 9", "Product 10"]
    }
    `;

    const result = await model.generateContent([prompt, imagePart]);
    const text = (await result.response).text();
    return res.status(200).json(JSON.parse(text));
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}