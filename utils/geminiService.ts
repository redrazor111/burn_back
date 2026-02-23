const VERCEL_API_URL = "https://is-it-good-pearl.vercel.app/api/analyze";

export const analyzeImageWithGemini = async (base64Data: string, isPro: boolean) => {
  try {
    const response = await fetch(VERCEL_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Data, isPro }),
    });

    if (!response.ok) throw new Error(`Server responded with ${response.status}`);
    const data = await response.json();
    return JSON.stringify(data);
  } catch (error: any) {
    console.error("Frontend Service Error:", error);

    const errorHasOccurred = "An Error has occurred."
    // Return a fallback object so the app doesn't crash
    return JSON.stringify({
      food: { status: "UNSAFE", summary: errorHasOccurred },
      skin: { status: "UNSAFE", summary: errorHasOccurred },
      makeup: { status: "UNSAFE", summary: errorHasOccurred },
      veg: { status: "UNSAFE", summary: errorHasOccurred },
      vegan: { status: "UNSAFE", summary: errorHasOccurred },
      halal: { status: "UNSAFE", summary: errorHasOccurred },
      alcohol: { status: "UNSAFE", summary: errorHasOccurred },
    });
  }
};