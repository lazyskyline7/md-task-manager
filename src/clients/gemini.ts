/* eslint-disable @typescript-eslint/no-explicit-any */
import { GoogleGenAI } from '@google/genai';
import {
  GEMINI_JSON_SCHEMA,
  getGeminiSystemPrompt,
  AI_MODEL,
} from '../core/config.js';
import logger from '../core/logger.js';
import { Task } from '../core/types.js';

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
      model: AI_MODEL,
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
        logger.warnWithContext(
          {
            op: 'GEMINI_API',
            message: 'Invalid response structure',
          },
          responseData,
        );
        throw new Error(
          'AI returned an invalid task structure. Please try again.',
        );
      }
      logger.infoWithContext(
        {
          op: 'GEMINI_API',
          message: 'Task generated successfully',
        },
        responseData,
      );
      return responseData;
    } else {
      logger.warnWithContext({
        op: 'GEMINI_API',
        message: 'Empty response from AI',
      });
      throw new Error('AI returned an empty response. Please try again.');
    }
  } catch (error) {
    logger.errorWithContext({
      op: 'GEMINI_API',
      error,
    });
    throw new Error(
      `Failed to generate task details: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};
