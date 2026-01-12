/* eslint-disable @typescript-eslint/no-explicit-any */
import { GoogleGenAI } from '@google/genai';
import { GEMINI_JSON_SCHEMA, getGeminiSystemPrompt } from '../config.js';
import { logger } from '../logger.js';
import { Task } from '../types.js';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const getUserPrompt = (extractedTags: string[], userInput: string) =>
  `[PROVIDED_TAGS]: ${extractedTags.join(', ')} [USER_INPUT]: ${userInput} `;

// type guard to validate Gemini response
type AiGenTask = Omit<Task, 'completed' | 'tags'>;
const isValidResponse = (data: any): data is AiGenTask => {
  return (
    data &&
    typeof data.name === 'string' &&
    typeof data.description === 'string' &&
    typeof data.date === 'string' &&
    typeof data.time === 'string' &&
    typeof data.duration === 'string' &&
    typeof data.link === 'string'
  );
};
export const generateAiTask = async (
  userText: string,
  tags: string[],
  timezone: string,
): Promise<AiGenTask> => {
  const userPrompt = getUserPrompt(tags, userText);
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: GEMINI_JSON_SCHEMA,
        systemInstruction: {
          parts: [{ text: getGeminiSystemPrompt(timezone) }],
        },
      },
    });

    if (response && response.text) {
      // The response text is a JSON string, so we need to parse it
      const responseData = JSON.parse(response.text);

      if (!isValidResponse(responseData)) {
        logger.warn('Invalid response structure from Gemini:', responseData);
        throw new Error(
          'AI returned an invalid task structure. Please try again.',
        );
      }
      logger.info('ai gen task', responseData);
      return responseData;
    } else {
      logger.warn('Empty response from Gemini');
      throw new Error('AI returned an empty response. Please try again.');
    }
  } catch (error) {
    logger.error('Error generating task description:', error);
    throw new Error(
      `Failed to generate task details: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};
