const VERCEL_API_URL = "https://burn-back.vercel.app/api/analyze";

export const analyzeImageWithGemini = async (base64Data: string, isPro: boolean) => {
  try {
    const response = await fetch(VERCEL_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Data, isPro }),
    });

    if (!response.ok) throw new Error(`Server responded with ${response.status}`);

    const data = await response.json();
    // We return the stringified data because your CameraScreen component
    // calls JSON.parse() on the result of this function.
    return JSON.stringify(data);

  } catch (error: any) {
    console.error("Frontend Service Error:", error);

    const errorMsg = "Service temporarily unavailable.";

    // Updated fallback to match your 10 activity structure
    return JSON.stringify({
      identifiedProduct: "Analysis Failed",
      activity1: { status: "UNSAFE", summary: errorMsg },
      activity2: { status: "UNSAFE", summary: errorMsg },
      activity3: { status: "UNSAFE", summary: errorMsg },
      activity4: { status: "UNSAFE", summary: errorMsg },
      activity5: { status: "UNSAFE", summary: errorMsg },
      activity6: { status: "UNSAFE", summary: errorMsg },
      activity7: { status: "UNSAFE", summary: errorMsg },
      activity8: { status: "UNSAFE", summary: errorMsg },
      activity9: { status: "UNSAFE", summary: errorMsg },
      activity10: { status: "UNSAFE", summary: errorMsg },
      recommendations: []
    });
  }
};