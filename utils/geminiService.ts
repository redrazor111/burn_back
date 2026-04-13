const VERCEL_API_URL = "https://burn-back.vercel.app/api/analyze";

export const analyzeImageWithGemini = async (
  isPro: boolean,
  userContext: {
    gender: string;
    age: number,
    targetCalories: number;
    targetProtein: number;
    weight?: number;
    dietaryRestrictions?: string;
    duration?: string;
    generateType?: string;
  },
  base64Data?: string,
  textQuery?: string,
  isDietPlan: boolean = false
) => {
  try {
    const response = await fetch(VERCEL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        base64Data: base64Data || null,
        textQuery: textQuery || null,
        isPro: isPro,
        userContext: userContext,
        isDietPlan
      })
    });

    if (!response.ok) throw new Error(`Server responded with ${response.status}`);

    const data = await response.json();
    console.log(JSON.stringify(data))
    return JSON.stringify(data);
  } catch (error: any) {
    console.error("Frontend Service Error:", error);

    return JSON.stringify({
      identifiedOptions: [
        {
          name: "Service unavailable - Please retry",
          calories: 0,
          protein: 0,
          carbs: 0
        }
      ],
      standardPlan: null,
      trainingProgram: null
    });
  }
};