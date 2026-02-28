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
      : "ONLY calculate the duration for Activity 1 (Running) and Activity 2 (Walking). For activities 3-10, use the 'WAITING' status and 'Premium Feature' summary.";

    const prompt = `
    USER CONTEXT:
    - Profile: ${age} year old ${gender}, weight ${weight} kg.
    - Daily Target: ${targetCalories} cal.

    INSTRUCTIONS:
    1. Identify the meal/food items. Provide THREE distinct possible interpretations (e.g., if it's a burger, Interpretation 1 might be 'Cheese Burger', Interpretation 2 'Veggie Burger', Interpretation 3 'Double Beef Burger').
    2. For EACH interpretation, estimate the total calories.
    3. ${dynamicInstructions}

    4. MATHEMATICAL FORMULA:
       (Use the calories from Interpretation 1 for the activity calculations below).
       Step A: Calories_Per_Minute = (MET * ${weight} * 3.5) / 200
       Step B: Duration_Minutes = Interpretation_1_Calories / Calories_Per_Minute

    5. JSON CONTENT RULES:
       - identifiedOptions: An array of 3 objects, each with "name" and "calories".
       - activity[X].summary: Use the calories from interpreted option 1.

    Return ONLY this JSON:
    {
      "identifiedOptions": [
        {"name": "Interpretation 1", "calories": 0},
        {"name": "Interpretation 2", "calories": 0},
        {"name": "Interpretation 3", "calories": 0}
      ],
      "calories": 0,
      "activity1": {"status": "string", "summary": "string"},
      "activity2": {"status": "string", "summary": "string"},
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