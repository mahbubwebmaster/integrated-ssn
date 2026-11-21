import { NextResponse } from "next/server";

interface ExtractedNidData {
  nameBn: string;
  nameEn: string;
  fatherName: string;
  dateOfBirth: string; // YYYY-MM-DD
  nid: string;
  gender?: "Male" | "Female" | "Other";
}

export async function POST(request: Request) {
  try {
    let base64Data = "";
    let mimeType = "image/jpeg";
    let clientApiKey = "";
    let isDemo = false;

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = await request.json();
      base64Data = body.imageBase64 || "";
      mimeType = body.mimeType || "image/jpeg";
      clientApiKey = body.apiKey || "";
      isDemo = Boolean(body.isDemo);
    } else if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      clientApiKey = (formData.get("apiKey") as string) || "";
      isDemo = formData.get("isDemo") === "true";

      if (file) {
        mimeType = file.type || "image/jpeg";
        const bytes = await file.arrayBuffer();
        base64Data = Buffer.from(bytes).toString("base64");
      }
    }

    // Support demo mode for instant testing without an API key
    if (isDemo) {
      const demoData: ExtractedNidData = {
        nameBn: "মোছাঃ রোকেয়া বেগম",
        nameEn: "Most. Rokeya Begum",
        fatherName: "মোঃ আব্দুল হক",
        dateOfBirth: "1972-04-15",
        nid: "19726815801234567",
        gender: "Female",
      };
      return NextResponse.json({
        success: true,
        data: demoData,
        source: "demo",
        message: "ডেমো এনআইডি থেকে তথ্য সফলভাবে প্রস্তুত করা হয়েছে।",
      });
    }

    // If data URL prefix was included (data:image/png;base64,...), strip it
    if (base64Data.includes(";base64,")) {
      const parts = base64Data.split(";base64,");
      const mimeMatch = parts[0].match(/data:(.*?);/);
      if (mimeMatch && mimeMatch[1]) {
        mimeType = mimeMatch[1];
      }
      base64Data = parts[1];
    }

    if (!base64Data) {
      return NextResponse.json(
        { success: false, error: "এনআইডি কার্ডের ছবি পাওয়া যায়নি (Image data is missing)." },
        { status: 400 }
      );
    }

    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      clientApiKey ||
      request.headers.get("x-gemini-key") ||
      "";

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          requiresApiKey: true,
          error: "NO_API_KEY",
          message:
            "এনআইডি স্ক্যান করতে Gemini API Key প্রয়োজন। আপনার .env ফাইলে GEMINI_API_KEY যুক্ত করুন অথবা স্ক্যানারে কী প্রদান করুন।",
        },
        { status: 400 }
      );
    }

    // Call Gemini 2.0 Flash (or 1.5-flash fallback) with Vision
    const prompt = `You are an expert OCR and data extraction system for Bangladeshi National ID (NID) cards.
Analyze this image of a Bangladesh National ID card (smart card or old laminated card - front side).
Extract the following 5 fields accurately:
1. "nameBn": Citizen's Bengali Name (e.g. from 'নাম: ...')
2. "nameEn": Citizen's English Name (e.g. from 'Name: ...')
3. "fatherName": Citizen's Father's Name in Bengali (e.g. from 'পিতা: ...')
4. "dateOfBirth": Date of Birth formatted as strictly YYYY-MM-DD. Convert English or Bengali date text (e.g. '15 Apr 1972' or '১৫ এপ্রিল ১৯৭২' or '1972/04/15') into ISO 'YYYY-MM-DD'.
5. "nid": National ID Number without spaces or hyphens (digits only, e.g. 10 digits smart card, or 13 or 17 digits old NID).
6. "gender": Citizen's Gender ('Male' or 'Female' or 'Other'). Deduce from title/name cues (e.g., 'মোসাঃ', 'মোছাঃ', 'বেগম', 'খাতুন' -> Female, 'মোঃ', 'মোহাম্মদ', 'আলী' -> Male) or card indicators.

Return ONLY valid JSON matching this structure without Markdown formatting or extra text:
{
  "nameBn": "string",
  "nameEn": "string",
  "fatherName": "string",
  "dateOfBirth": "YYYY-MM-DD",
  "nid": "string",
  "gender": "Male" | "Female" | "Other"
}
If any field cannot be found or is unclear, return empty string "" for that field.`;

    const modelsToTry = [
      "gemini-flash-lite-latest",
      "gemini-3.5-flash-lite",
      "gemini-3.1-flash-lite",
      "gemini-flash-latest",
    ];
    let rawText = "";
    const errors: string[] = [];

    const safeMimeType =
      mimeType === "image/jpg"
        ? "image/jpeg"
        : mimeType || "image/jpeg";

    for (const model of modelsToTry) {
      try {
        console.log(`[OCR] Trying model: ${model}`);
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey.trim(),
            },
            signal: AbortSignal.timeout(12000), // 12-second hard limit per model
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { text: prompt },
                    {
                      inlineData: {
                        mimeType: safeMimeType,
                        data: base64Data,
                      },
                    },
                  ],
                },
              ],
              generationConfig: {
                temperature: 0.1,
              },
            }),
          }
        );

        if (!response.ok) {
          const errBody = await response.text();
          console.error(`[OCR] Model ${model} failed (${response.status}):`, errBody);
          errors.push(`${model} (${response.status}): ${errBody}`);
          continue;
        }

        const resData = await response.json();
        const candidateText =
          resData.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (candidateText) {
          rawText = candidateText;
          console.log(`[OCR] Successfully generated content using ${model}`);
          break;
        }
      } catch (callErr: any) {
        const msg = callErr?.message || String(callErr);
        console.error(`[OCR] Model ${model} exception:`, msg);
        errors.push(`${model} exception: ${msg}`);
      }
    }

    if (!rawText) {
      const isKeyInvalid = errors.some(
        (e) => e.includes("API_KEY_INVALID") || e.includes("API key not valid")
      );
      const isQuota = errors.some(
        (e) => e.includes("RESOURCE_EXHAUSTED") || e.includes("quota")
      );

      let friendlyError = "Gemini API থেকে এনআইডি তথ্য এক্সট্রাক্ট করা যায়নি।";
      if (isKeyInvalid) {
        friendlyError =
          "প্রদত্ত Gemini API Key-টি সঠিক নয় (Invalid API Key)। অনুগ্রহ করে Google AI Studio থেকে নতুন কী কপি করে প্রদান করুন।";
      } else if (isQuota) {
        friendlyError =
          "আপনার Gemini API-এর অনুরোধের সীমা অতিক্রান্ত হয়েছে (Quota Exceeded)। অনুগ্রহ করে কিছুক্ষণ পর চেষ্টা করুন।";
      } else if (errors.length > 0) {
        friendlyError = errors[0];
      }
      throw new Error(friendlyError);
    }

    // Clean up response: find JSON object enclosed in { ... }
    let cleaned = rawText.trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    } else {
      if (cleaned.startsWith("```json")) {
        cleaned = cleaned.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      } else if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
      }
    }

    const parsed = JSON.parse(cleaned);

    const result: ExtractedNidData = {
      nameBn: typeof parsed.nameBn === "string" ? parsed.nameBn.trim() : "",
      nameEn: typeof parsed.nameEn === "string" ? parsed.nameEn.trim() : "",
      fatherName: typeof parsed.fatherName === "string" ? parsed.fatherName.trim() : "",
      dateOfBirth: typeof parsed.dateOfBirth === "string" ? parsed.dateOfBirth.trim() : "",
      nid: typeof parsed.nid === "string" ? parsed.nid.replace(/\D/g, "") : "",
      gender: parsed.gender === "Male" || parsed.gender === "Female" ? parsed.gender : undefined,
    };

    return NextResponse.json({
      success: true,
      data: result,
      source: "gemini-vision",
      message: "এনআইডি কার্ড থেকে সফলভাবে তথ্য এক্সট্রাক্ট করা হয়েছে।",
    });
  } catch (error: any) {
    console.error("NID OCR API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "এনআইডি ছবি প্রসেস করার সময় ত্রুটি হয়েছে।",
      },
      { status: 500 }
    );
  }
}
