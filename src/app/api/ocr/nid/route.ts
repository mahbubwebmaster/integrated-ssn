import { NextResponse } from "next/server";

interface ExtractedNidData {
  nameBn: string;
  nameEn: string;
  fatherName: string;
  dateOfBirth: string; // YYYY-MM-DD
  nid: string;
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

Return ONLY valid JSON matching this structure without Markdown formatting or extra text:
{
  "nameBn": "string",
  "nameEn": "string",
  "fatherName": "string",
  "dateOfBirth": "YYYY-MM-DD",
  "nid": "string"
}
If any field cannot be found or is unclear, return empty string "" for that field.`;

    const modelsToTry = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"];
    let rawText = "";
    let lastError = "";

    for (const model of modelsToTry) {
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
                    { text: prompt },
                    {
                      inline_data: {
                        mime_type: mimeType,
                        data: base64Data,
                      },
                    },
                  ],
                },
              ],
              generationConfig: {
                temperature: 0.1,
                response_mime_type: "application/json",
              },
            }),
          }
        );

        if (!response.ok) {
          const errBody = await response.text();
          lastError = `Model ${model} returned ${response.status}: ${errBody}`;
          continue;
        }

        const resData = await response.json();
        const candidateText =
          resData.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (candidateText) {
          rawText = candidateText;
          break;
        }
      } catch (callErr: any) {
        lastError = callErr?.message || String(callErr);
      }
    }

    if (!rawText) {
      throw new Error(lastError || "Gemini API থেকে কোনো ফলাফল পাওয়া যায়নি।");
    }

    // Clean up response if wrapped in markdown code blocks
    let cleaned = rawText.trim();
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    const parsed = JSON.parse(cleaned);

    const result: ExtractedNidData = {
      nameBn: typeof parsed.nameBn === "string" ? parsed.nameBn.trim() : "",
      nameEn: typeof parsed.nameEn === "string" ? parsed.nameEn.trim() : "",
      fatherName: typeof parsed.fatherName === "string" ? parsed.fatherName.trim() : "",
      dateOfBirth: typeof parsed.dateOfBirth === "string" ? parsed.dateOfBirth.trim() : "",
      nid: typeof parsed.nid === "string" ? parsed.nid.replace(/\D/g, "") : "",
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
