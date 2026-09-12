"use server";

import { checkRateLimit, getClientIp } from "@/lib/rateLimiter";

export async function analyzePhotoServerAction(
  base64Data: string,
  mimeType: string
): Promise<{ subject: string; category: string; confidence: number; error?: string } | null> {
  const ip = await getClientIp();

  // Enforce rate limit: max 5 photo analysis requests per minute per IP
  const rateResult = checkRateLimit(ip, "analyze_photo", 5, 60000);
  if (!rateResult.success) {
    console.warn(`⚠️ Rate limit exceeded on analyze_photo for IP ${ip}`);
    return {
      subject: "Rate Limit Reached",
      category: "Environment",
      confidence: 0,
      error: `Rate limit reached: Max 5 photo analyses per minute. Please wait ${rateResult.retryAfterSeconds}s before trying again.`,
    };
  }

  // Validate payload size (max 5MB base64 string)
  if (!base64Data || typeof base64Data !== "string") {
    return null;
  }
  if (base64Data.length > 5 * 1024 * 1024) {
    return {
      subject: "Image Too Large",
      category: "Environment",
      confidence: 0,
      error: "Image payload exceeds 5MB. Please upload a smaller or compressed photo.",
    };
  }

  // Validate MIME type against whitelist
  const cleanMime = (mimeType || "image/jpeg").toLowerCase().trim();
  const allowedMimes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  if (!allowedMimes.includes(cleanMime)) {
    return {
      subject: "Invalid Image Type",
      category: "Environment",
      confidence: 0,
      error: "Unsupported image format. Allowed formats: JPEG, PNG, WEBP.",
    };
  }

  // Strip data URL prefix if present
  let cleanBase64 = base64Data;
  if (cleanBase64.includes(",")) {
    cleanBase64 = cleanBase64.split(",")[1];
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

  if (!apiKey || apiKey.includes("your_gemini")) {
    console.warn("⚠️ No GEMINI_API_KEY found in server environment");
    return null;
  }

  const models = ["gemini-2.5-flash", "gemini-flash-latest", "gemini-2.5-flash-lite"];

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
                      mimeType: cleanMime,
                      data: cleanBase64,
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
