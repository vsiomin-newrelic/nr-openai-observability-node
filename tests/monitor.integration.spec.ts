import {
  ChatCompletionRequestMessageRoleEnum,
  Configuration,
  OpenAIApi,
} from 'openai';

import { monitorOpenAI } from '../src';
import {
  getSentEvent,
  sendEventMock,
} from './__mocks__/@newrelic/telemetry-sdk';
import { TestEnvironment } from './testEnvironment';

const question = 'Are you alive?';
const applicationName = 'Test';

jest.setTimeout(30 * 1000);

describe('monitorOpenAI', () => {
  let openAIApi: OpenAIApi;

  beforeEach(() => {
    openAIApi = new OpenAIApi(
      new Configuration({
        apiKey: TestEnvironment.openaiApiKey,
      }),
    );

    monitorOpenAI(openAIApi, {
      newRelicApiKey: TestEnvironment.newRelicApiKey,
      host: TestEnvironment.newRelicHost,
      applicationName,
    });

    sendEventMock.mockImplementation();
  });

  it('when monitoring createCompletion should send LlmCompletion event', async () => {
    const model = 'text-davinci-003';

    await openAIApi.createCompletion({
      prompt: question,
      model,
    });

    expect(getSentEvent(0)).toEqual({
      eventType: 'LlmCompletion',
      attributes: expect.objectContaining({
        model,
        applicationName,
        prompt: question,
        response_time: expect.any(Number),
        'usage.completion_tokens': 9,
        'usage.prompt_tokens': 4,
        'usage.total_tokens': 13,
        'choices.0.text': expect.any(String),
      }),
    });
  });

  describe('when monitoring createChatCompletion', () => {
    const model = 'gpt-4';

    beforeEach(async () => {
      const messages = [
        {
          role: ChatCompletionRequestMessageRoleEnum.User,
          content: question,
        },
      ];

      await openAIApi.createChatCompletion({
        messages,
        model,
      });
    });

    it('should send LlmChatCompletionMessage events', async () => {
      expect(getSentEvent(0)).toEqual({
        eventType: 'LlmChatCompletionMessage',
        attributes: {
          model,
          applicationName,
          sequence: 0,
          completion_id: expect.any(String),
          content: question,
          id: expect.any(String),
          role: ChatCompletionRequestMessageRoleEnum.User,
          vendor: 'openAI',
        },
      });

      expect(getSentEvent(1)).toEqual({
        eventType: 'LlmChatCompletionMessage',
        attributes: {
          model,
          applicationName,
          sequence: 1,
          completion_id: expect.any(String),
          content: expect.any(String),
          id: expect.any(String),
          role: ChatCompletionRequestMessageRoleEnum.Assistant,
          vendor: 'openAI',
        },
      });
    });

    it('should send LlmChatCompletionSummary event', async () => {
      expect(getSentEvent(2)).toEqual({
        eventType: 'LlmChatCompletionSummary',
        attributes: {
          model: 'gpt-4-0314',
          applicationName,
          id: expect.any(String),
          timestamp: expect.any(Number),
          created: expect.any(Number),
          vendor: 'openAI',
          finish_reason: 'stop',
          response_time: expect.any(Number),
          number_of_messages: 2,
          object: 'chat.completion',
          prompt_tokens: 11,
          total_tokens: expect.any(Number),
          usage_completion_tokens: expect.any(Number),
          api_key_last_four_digits: 'sk-8VS9',
        },
      });
    });
  });
});
