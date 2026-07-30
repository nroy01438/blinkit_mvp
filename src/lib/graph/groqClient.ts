import "server-only";
import Groq from "groq-sdk";

let client: Groq | null = null;

function getClient() {
  if (!client) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("GROQ_API_KEY is not set");
    client = new Groq({ apiKey });
  }
  return client;
}

export const GROQ_MODEL = "llama-3.3-70b-versatile";

export async function callGroqJson(systemPrompt: string, userPrompt: string, timeoutMs = 9000): Promise<string> {
  const groq = getClient();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const completion = await groq.chat.completions.create(
      {
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 2048,
      },
      { signal: controller.signal }
    );
    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error("Empty response from Groq");
    return content;
  } finally {
    clearTimeout(timer);
  }
}
