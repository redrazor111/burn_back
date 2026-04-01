import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const API_KEY = process.env.GEMINI_API_KEY;
  const genAI = new GoogleGenerativeAI(API_KEY!);

  try {
    const { base64Data, textQuery } = req.body;
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
      generationConfig: { responseMimeType: "application/json" },
    });

    let contentParts: any[] = [];
    let sourceDescription = "the user's description";

    if (base64Data) {
      const base64Content = base64Data.includes(",") ? base64Data.split(",")[1] : base64Data;
      contentParts.push({ inlineData: { data: base64Content, mimeType: "image/jpeg" } });
      sourceDescription = "the food in the image";
    }

    const prompt = `
      Analyze ${sourceDescription}. ${textQuery ? `User specifically described: "${textQuery}"` : ""}
      Provide 3 distinct possible interpretations/portion sizes.

      IMPORTANT:
      - Return ONLY valid JSON.
      - All numeric values (calories, protein, carbs) MUST be integers (whole numbers).
      - If a value has a decimal, round it to the nearest whole number.
      - Values MUST be numbers, NOT strings.

      JSON Structure:
      {
        "identifiedOptions": [
          {"name": "Food Name", "calories": 250, "protein": 20, "carbs": 30}
        ]
      }`;

    contentParts.unshift(prompt);

    const result = await model.generateContent(contentParts);
    const responseText = result.response.text();
    return res.status(200).json(JSON.parse(responseText));

  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}