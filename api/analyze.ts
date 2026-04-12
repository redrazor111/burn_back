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
      ? `You are an expert nutritionist. Generate a 1-day meal plan for a ${userContext?.dietPreference || 'Meat'} diet.

         DIETARY RULES:
         - If 'Meat': Include lean proteins like chicken, beef, or fish.
         - If 'Veg': No meat or fish. Include eggs and dairy.
         - If 'Vegan': No animal products at all (No meat, fish, eggs, or dairy).

         GOALS:
         - Target: ${userContext?.targetCalories} calories
         - Target Protein: ${userContext?.targetProtein}g

         Output 3 distinct versions: Standard (hits goals), Larger (+15% cals), and Smaller (-15% cals).
         Return ONLY JSON. Nutrition values MUST be whole number integers.

         Structure:
         {
           "mealPlans": [
             {
               "description": "Portion Size: Standard",
               "meals": [{"name": "Meal Name", "calories": 0, "protein": 0, "carbs": 0}],
               "totalCalories": 0,
               "totalProtein": 0
             }
           ]
         }`
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

    // Safety return ensuring both keys exist for the frontend
    return res.status(200).json({
      identifiedOptions: parsedData.identifiedOptions || [],
      mealPlans: parsedData.mealPlans || []
    });

  } catch (error: any) {
    console.error("Backend Error:", error);
    return res.status(500).json({ error: error.message });
  }
}