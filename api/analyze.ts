// api/analyze.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

export const config = {
  maxDuration: 30,
};

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: "Server configuration missing API Key" });
  }

  try {
    const { base64Data, isPro } = req.body;

    const genAI = new GoogleGenerativeAI(API_KEY);
    // Note: Ensure you use a valid model name like "gemini-1.5-flash"
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" },
    });

    const base64Content = base64Data.includes(",") ? base64Data.split(",")[1] : base64Data;
    const imagePart = { inlineData: { data: base64Content, mimeType: "image/jpeg" } };

    const prompt = `
    1. Identify the meal/food items in the image and provide a best guess for total calories.
    2. Calculate exactly how much of the following 10 activities are needed to burn that specific calorie count.
    3. The 10 activities must be:
       - Activity 1: Running (moderate pace)
       - Activity 2: Walking (brisk)
       - Activity 3: Weight Training (high intensity)
       - Activity 4: Cycling
       - Activity 5: Swimming
       - Activity 6: HIIT/Exercise Class
       - Activity 7: Yoga/Pilates
       - Activity 8: Rowing
       - Activity 9: Jump Rope
       - Activity 10: Hiking

    4. For each activity:
       - Status should be 'SAFE' if the food is healthy, 'CAUTION' if moderately processed, or 'UNSAFE' if it's very high calorie/junk.
       - Summary should state the duration (e.g., "45 minutes") and a brief tip on form or benefit.

    5. RECOMMENDATIONS:
       - Provide a list of 10 Amazon products related to the meal or fitness gear (e.g., "Food scale", "Running shoes", "Healthy cookbook").

    Return ONLY this JSON structure:
    {
      "identifiedProduct": "Meal Name (Total Estimated Calories)",
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
    const response = await result.response;
    const text = response.text();

    return res.status(200).json(JSON.parse(text));

  } catch (error: any) {
    console.error("Vercel Backend Error:", error);
    return res.status(500).json({ error: error.message });
  }
}