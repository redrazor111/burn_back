import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const API_KEY = process.env.GEMINI_API_KEY;
  const genAI = new GoogleGenerativeAI(API_KEY!);

  try {
    const { base64Data, textQuery, userContext, isDietPlan = false } = req.body;

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

    const prompt = isDietPlan
      ? `You are an expert health coach and nutritionist.
        Task: Generate a ${userContext.duration} plan for: ${userContext.generateType.toUpperCase()}.

        User Profile & Goals:
        - Target: ${userContext.targetCalories} kcal/day
        - Protein: ${userContext.targetProtein}g/day
        - Dietary Requirements: ${userContext.dietaryRestrictions} (STRICT: All meals must be 100% compliant)
        - Weight: ${userContext.weight}kg

        STRICT DURATION RULES:
        1. If duration is "Daily": Both "standardPlan.days" and "trainingProgram.days" MUST contain exactly 1 day.
        2. If duration is "Weekly": Both "standardPlan.days" and "trainingProgram.days" MUST contain exactly 7 days.

        STRICT JSON STRUCTURE INSTRUCTIONS:
        1. If 'Meal' or 'Both': Return "standardPlan":
          {
            "generatedDuration": "${userContext.duration}",
            "days": [
              {
                "dayName": "Day X",
                "totalCalories": number,
                "totalProtein": number,
                "meals": [
                  {
                    "mealName": string,
                    "mealCalories": number,
                    "mealProtein": number,
                    "items": [
                      { "itemName": string, "quantity": string, "calories": number, "protein": number }
                    ]
                  }
                ]
              }
            ]
          }

        2. If 'Training' or 'Both': Return "trainingProgram":
          {
            "generatedDuration": "${userContext.duration}",
            "days": [
              {
                "dayName": "Day X",
                "title": string,
                "exercises": string[]
              }
            ]
          }

        3. If a type is NOT requested, set that root key to null.
        4. All numeric values MUST be integers. Use "items" array for meals, NOT "dishes".

        Return ONLY valid JSON.`
      : `Analyze ${sourceDescription}. ${textQuery ? `User specifically described: "${textQuery}"` : ""}
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
    const parsedData = JSON.parse(responseText);

    return res.status(200).json({
      identifiedOptions: parsedData.identifiedOptions || [],
      standardPlan: parsedData.standardPlan || null,
      trainingProgram: parsedData.trainingProgram || null
    });
  } catch (error: any) {
    console.error("Backend Error:", error);
    return res.status(500).json({ error: error.message });
  }
}