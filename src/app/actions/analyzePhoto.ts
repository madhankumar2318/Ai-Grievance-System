"use server";

export async function analyzePhotoServerAction(
  base64Data: string,
  mimeType: string
): Promise<{ subject: string; category: string; confidence: number } | null> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

  if (!apiKey || apiKey.includes("your_gemini")) {
    console.warn("⚠️ No GEMINI_API_KEY found in server environment");
    return null;
  }

  const models = ["gemini-1.5-flash", "gemini-2.0-flash"];

  for (const model of models) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    inlineData: {
                      mimeType: mimeType || "image/jpeg",
                      data: base64Data,
                    },
                  },
                  {
                    text: `Analyze this photo of a civic, municipal, or environmental grievance issue in detail.
Accurately identify what is shown in the image (for example:
- Industrial Air Pollution & Factory Smoke Emission
- Severe Road Pothole & Asphalt Damage
- Public Garbage Dumping & Solid Waste Accumulation
- Environmental Water Body Pollution & Sewage Dumping
- Exposed Electrical Wires & Public Safety Hazard
- Broken Streetlight & Night Hazard).

Return ONLY a JSON object with this exact structure:
{
  "subject": "Clear, precise title describing the issue shown",
  "category": "Environment" | "Infrastructure" | "Safety" | "Public Health" | "Administrative" | "Other",
  "confidence": 95
}`,
                  },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: "application/json",
            },
          }),
        }
      );

      if (response.ok) {
        const resData = await response.json();
        const text = resData?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          let jsonText = text.trim();
          if (jsonText.startsWith("```json")) jsonText = jsonText.substring(7);
          if (jsonText.endsWith("```")) jsonText = jsonText.substring(0, jsonText.length - 3);

          const parsed = JSON.parse(jsonText.trim());
          if (parsed.subject && parsed.category) {
            return {
              subject: parsed.subject,
              category: parsed.category,
              confidence: parsed.confidence || 96,
            };
          }
        }
      } else {
        const errText = await response.text();
        console.warn(`⚠️ Gemini model ${model} returned status ${response.status}:`, errText);
      }
    } catch (err) {
      console.warn(`⚠️ Error calling Gemini model ${model}:`, err);
    }
  }

  return null;
}
