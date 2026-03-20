const VERCEL_API_URL = "https://burn-back.vercel.app/api/analyze";

export const analyzeImageWithGemini = async (
  isPro: boolean,
  userContext: { gender: string; age: number; targetCalories: number },
  base64Data?: string,
  textQuery?: string
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
        userContext: userContext
      })
    });

    if (!response.ok) throw new Error(`Server responded with ${response.status}`);

    const data = await response.json();

    if (data.identifiedOptions) {
      data.identifiedOptions = data.identifiedOptions.map((opt: any) => ({
        ...opt,
        calories: opt.calories || 0,
        protein: opt.protein || 0,
        carbs: opt.carbs || 0,
      }));
    }

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
      ]
    });
  }
};