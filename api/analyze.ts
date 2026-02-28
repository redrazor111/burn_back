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
    // 1. EXTRACT NEW USER CONTEXT FIELDS
    const { base64Data, isPro, userContext } = req.body;
    const { gender = "unknown", age = "unknown", targetCalories = "2000" } = userContext || {};

    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash", // Note: Ensure you are using a valid model string like gemini-2.0-flash
      generationConfig: { responseMimeType: "application/json" },
    });

    const base64Content = base64Data.includes(",") ? base64Data.split(",")[1] : base64Data;
    const imagePart = { inlineData: { data: base64Content, mimeType: "image/jpeg" } };

    const dynamicInstructions = isPro
      ? "Calculate the duration for ALL 10 activities."
      : "ONLY calculate the duration for Activity 1 and 2. For activities 3-10, use the exact placeholder values provided in the JSON structure below.";

    // 2. UPDATE PROMPT WITH USER CONTEXT
    const prompt = `
    USER CONTEXT:
    - User Profile: ${age} year old ${gender}.
    - Daily Calorie Target: ${targetCalories} cal.

    INSTRUCTIONS:
    1. Identify the meal or food items in the image.
    2. Provide a best estimate of the total calories as a plain integer.
    3. ${dynamicInstructions}

    4. PERSONALIZED CALCULATION:
       When calculating exercise durations, adjust the time based specifically on a ${age} year old ${gender}. Use standard MET (Metabolic Equivalent of Task) values tailored to this demographic.

    5. STATUS LABELS:
       - Use 'HEALTHY' if the food fits well within a ${targetCalories} cal daily limit and is nutritious.
       - Use 'MODERATE' if the food has average processing or balanced calories.
       - Use 'UNHEALTHY' if the food makes hitting a ${targetCalories} cal goal difficult or is highly processed.

    6. ACTIVITIES MAPPING:
       - Activity 1: Running (moderate pace)
       - Activity 2: Walking (brisk pace)
       - Activity 3: Weight Training (high intensity)
       - Activity 4: Cycling (steady pace)
       - Activity 5: Swimming (laps)
       - Activity 6: HIIT/Exercise Class
       - Activity 7: Yoga/Pilates
       - Activity 8: Rowing
       - Activity 9: Jump Rope
       - Activity 10: Hiking (uphill)

    7. SUMMARY CONTENT:
       - Start with the duration (e.g., "42 minutes") followed by a short helpful tip personalized for a ${age}yo ${gender}.

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
    const response = await result.response;
    const text = response.text();

    return res.status(200).json(JSON.parse(text));

  } catch (error: any) {
    console.error("Vercel Backend Error:", error);
    return res.status(500).json({ error: error.message });
  }
}