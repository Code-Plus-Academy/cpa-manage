const { OpenAI } = require('openai');

/**
 * Multi-Provider AI Service
 * Supports switching AI providers via process.env.AI_PROVIDER ('nvidia', 'openai', 'gemini')
 */

function getAIClient() {
  const provider = (process.env.AI_PROVIDER || 'nvidia').toLowerCase();

  if (provider === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not configured in .env');
    return {
      client: new OpenAI({ apiKey }),
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    };
  }

  if (provider === 'gemini') {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured in .env');
    return {
      client: new OpenAI({
        apiKey,
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      }),
      model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    };
  }

  // Default: NVIDIA NIM
  const apiKey = process.env.NVIDIA_API_KEY || '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';
  const baseURL = process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1';
  const model = process.env.NVIDIA_MODEL || 'meta/llama-3.3-70b-instruct';

  return {
    client: new OpenAI({ apiKey, baseURL }),
    model,
  };
}

async function refineJustification({ raw_notes, case_type = 'moderation' }) {
  try {
    const { client, model } = getAIClient();

    const systemPrompt = `You are an expert Trust & Safety Legal Compliance Assistant for Code+ Academy.
Your task is to transform informal, raw admin notes into a concise, professional, legally sound, and formal moderation statement for platform compliance records.
Maintain all specific facts, reasons, and actions mentioned.
Do NOT include conversational filler, greetings, or commentary. Output ONLY the refined justification text.`;

    const userPrompt = `Case Category: ${case_type.toUpperCase()}
Raw Admin Notes: "${raw_notes}"

Please refine this into a formal, professional moderation justification statement:`;

    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      top_p: 0.7,
      max_tokens: 1024,
      stream: false,
    });

    const refinedText = completion.choices[0]?.message?.content?.trim();
    if (!refinedText) {
      throw new Error('AI returned an empty response.');
    }

    return refinedText;
  } catch (err) {
    console.error('[AIService] Failed to call AI provider:', err.message);
    // Fallback if API key fails or network error
    const typePrefix = case_type ? `[${case_type.toUpperCase()}] ` : '';
    return `${typePrefix}Upon administrative moderation review, the reported material has been evaluated under Code+ Academy terms. Justification: ${raw_notes.trim()}. Corrective action applied pursuant to platform compliance guidelines.`;
  }
}

module.exports = {
  refineJustification,
  getAIClient,
};
