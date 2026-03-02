import { GoogleGenerativeAI } from "@google/generative-ai";

export const config = {
  maxDuration: 30,
};

export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: "API Key missing" });

  try {
    const { base64Data } = req.body;
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
      generationConfig: { responseMimeType: "application/json" },
    });

    const base64Content = base64Data.includes(",") ? base64Data.split(",")[1] : base64Data;
    const imagePart = { inlineData: { data: base64Content, mimeType: "image/jpeg" } };

    const prompt = `
    INSTRUCTIONS:
    1. Analyze the food in the image.
    2. Provide FIVE (5) distinct possible interpretations of this meal.
    3. Include variations in preparation, portion size, or specific ingredients (e.g., 'Grilled Chicken Breast - 200g', 'Fried Chicken Thighs', 'Chicken Salad no dressing', etc.)
    4. For each, provide a realistic estimated calorie count.

    Return ONLY this JSON:
    {
      "identifiedOptions": [
        {"name": "Option 1", "calories": 0},
        {"name": "Option 2", "calories": 0},
        {"name": "Option 3", "calories": 0},
        {"name": "Option 4", "calories": 0},
        {"name": "Option 5", "calories": 0}
      ]
    }
    `;

    const result = await model.generateContent([prompt, imagePart]);
    const text = (await result.response).text();
    return res.status(200).json(JSON.parse(text));
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}