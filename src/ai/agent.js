// EVOS Browser - AI Agent
// ReAct-style agent that uses tools to accomplish tasks

const { llmEngine } = require('./llm-engine');
const { browserTools } = require('./tools');
const { aiMemory } = require('./memory');
const { AGENT_CONFIG } = require('./config');

class AIAgent {
  constructor() {
    this.conversationHistory = [];
    this.currentTask = null;
    this.isProcessing = false;
    this.browserContext = null;
  }

  // Set browser context for tools
  setBrowserContext(context) {
    this.browserContext = context;
    browserTools.setBrowserContext(context);
  }

  // System prompt for the agent
  getSystemPrompt() {
    const toolsDescription = browserTools.getToolDefinitions().map(t => 
      `- ${t.name}: ${t.description}`
    ).join('\n');

    return `You are EVOS AI, an intelligent browser assistant. You help users navigate the web, find information, and automate tasks.

You have access to these tools:
${toolsDescription}

When the user asks you to do something, think step by step:
1. First, understand what the user wants
2. Plan the steps needed to accomplish the task
3. Use the appropriate tools to execute each step
4. Report the results to the user

To use a tool, respond with a JSON block like this:
\`\`\`json
{
  "thought": "I need to search for this information",
  "action": "search_web",
  "params": {
    "query": "your search query"
  }
}
\`\`\`

When you have completed the task or want to respond to the user, use the answer_user tool:
\`\`\`json
{
  "thought": "I have found the information the user requested",
  "action": "answer_user",
  "params": {
    "message": "Here is what I found..."
  }
}
\`\`\`

Important rules:
- Always use tools to interact with web pages - don't make up information
- Be concise and helpful in your responses
- If you encounter an error, try alternative approaches
- Remember context from the conversation
- Always end with answer_user when you're done`;
  }

  // Parse action from LLM response
  parseAction(response) {
    try {
      // Look for JSON in the response
      const jsonMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]);
        return {
          thought: parsed.thought || '',
          action: parsed.action,
          params: parsed.params || {}
        };
      }

      // Try to find raw JSON
      const rawJsonMatch = response.match(/\{[\s\S]*"action"[\s\S]*\}/);
      if (rawJsonMatch) {
        const parsed = JSON.parse(rawJsonMatch[0]);
        return {
          thought: parsed.thought || '',
          action: parsed.action,
          params: parsed.params || {}
        };
      }

      // No action found - treat as direct response
      return {
        thought: 'Responding directly to user',
        action: 'answer_user',
        params: { message: response }
      };
    } catch (error) {
      console.error('[Agent] Failed to parse action:', error);
      return {
        thought: 'Responding directly to user',
        action: 'answer_user',
        params: { message: response }
      };
    }
  }

  // Execute a single step
  async executeStep(userMessage, observations = []) {
    // Build messages for the LLM
    let prompt = '';
    
    // Add conversation context
    const recentHistory = this.conversationHistory.slice(-6);
    for (const msg of recentHistory) {
      prompt += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n\n`;
    }
    
    // Add current user message if not in history
    if (!recentHistory.some(m => m.content === userMessage && m.role === 'user')) {
      prompt += `User: ${userMessage}\n\n`;
    }
    
    // Add observations from previous actions
    if (observations.length > 0) {
      prompt += 'Previous observations:\n';
      for (const obs of observations) {
        prompt += `- Action: ${obs.action} → Result: ${JSON.stringify(obs.result).substring(0, 500)}\n`;
      }
      prompt += '\n';
    }
    
    prompt += 'Assistant: ';

    // Get memory context
    const memoryContext = await aiMemory.getContext(userMessage);
    
    // Full system prompt
    const fullSystemPrompt = this.getSystemPrompt() + 
      (memoryContext ? `\n\nMemory context:\n${memoryContext}` : '');

    // Generate response
    const response = await llmEngine.chat(
      [{ role: 'user', content: prompt }],
      fullSystemPrompt
    );

    return this.parseAction(response);
  }

  // Run the agent on a task
  async run(userMessage, onProgress = null) {
    if (this.isProcessing) {
      return { error: 'Agent is already processing a task' };
    }

    this.isProcessing = true;
    this.currentTask = userMessage;
    
    // Add user message to history
    this.conversationHistory.push({
      role: 'user',
      content: userMessage,
      timestamp: Date.now()
    });

    const observations = [];
    let step = 0;
    let finalResponse = null;

    try {
      while (step < AGENT_CONFIG.maxSteps) {
        step++;
        
        if (onProgress) {
          onProgress({ type: 'thinking', step, message: 'Thinking...' });
        }

        // Execute step
        const action = await this.executeStep(userMessage, observations);
        
        console.log(`[Agent] Step ${step}:`, action);

        if (onProgress) {
          onProgress({ 
            type: 'action', 
            step, 
            thought: action.thought,
            action: action.action,
            params: action.params
          });
        }

        // Check if this is the final answer
        if (action.action === 'answer_user') {
          finalResponse = action.params.message;
          break;
        }

        // Execute the tool
        try {
          const result = await browserTools.executeTool(action.action, action.params);
          
          observations.push({
            action: action.action,
            params: action.params,
            result: result
          });

          if (onProgress) {
            onProgress({ 
              type: 'observation', 
              step, 
              action: action.action,
              result: result
            });
          }

          // Check if the action result is final
          if (result.final) {
            finalResponse = result.message;
            break;
          }
        } catch (toolError) {
          console.error(`[Agent] Tool error:`, toolError);
          observations.push({
            action: action.action,
            params: action.params,
            result: { error: toolError.message }
          });
        }
      }

      // If we hit max steps without a final answer
      if (!finalResponse) {
        finalResponse = "I've been working on this task but haven't been able to complete it. Could you provide more details or try rephrasing your request?";
      }

      // Add response to history
      this.conversationHistory.push({
        role: 'assistant',
        content: finalResponse,
        timestamp: Date.now()
      });

      // Remember this interaction
      await aiMemory.rememberInteraction(userMessage, finalResponse);

      return {
        success: true,
        response: finalResponse,
        steps: step,
        observations: observations
      };

    } catch (error) {
      console.error('[Agent] Error:', error);
      return {
        success: false,
        error: error.message,
        steps: step,
        observations: observations
      };
    } finally {
      this.isProcessing = false;
      this.currentTask = null;
    }
  }

  // Simple chat without tools
  async chat(message) {
    // Add to history
    this.conversationHistory.push({
      role: 'user',
      content: message,
      timestamp: Date.now()
    });

    // Simple prompt for chat
    const systemPrompt = `You are EVOS AI, a helpful browser assistant built into the EVOS web browser.

When the user's message includes [Current page:...] information, use it to answer questions about what they're viewing.
Be concise, helpful, and accurate. If you see page content, analyze it and respond based on what you can see.
If asked about a page but no content is provided, explain that you need the page content to be extracted first.`;
    
    const response = await llmEngine.chat(
      this.conversationHistory.slice(-10),
      systemPrompt
    );

    // Add response to history
    this.conversationHistory.push({
      role: 'assistant',
      content: response,
      timestamp: Date.now()
    });

    return response;
  }

  // Stream a chat response
  async *chatStream(message) {
    // Add to history
    this.conversationHistory.push({
      role: 'user',
      content: message,
      timestamp: Date.now()
    });

    const systemPrompt = `You are EVOS AI, a helpful browser assistant. Be concise and helpful.`;
    
    // Build prompt
    let prompt = '';
    for (const msg of this.conversationHistory.slice(-10)) {
      prompt += `<|im_start|>${msg.role}\n${msg.content}<|im_end|>\n`;
    }
    prompt += '<|im_start|>assistant\n';

    let fullResponse = '';
    
    for await (const chunk of llmEngine.generateStream(prompt)) {
      fullResponse += chunk;
      yield chunk;
    }

    // Add response to history
    this.conversationHistory.push({
      role: 'assistant',
      content: fullResponse,
      timestamp: Date.now()
    });
  }

  // Clear conversation history
  clearHistory() {
    this.conversationHistory = [];
    llmEngine.resetSession();
  }

  // Get conversation history
  getHistory() {
    return this.conversationHistory;
  }

  // Get agent status
  getStatus() {
    return {
      isProcessing: this.isProcessing,
      currentTask: this.currentTask,
      historyLength: this.conversationHistory.length,
      llmStatus: llmEngine.getInfo()
    };
  }
}

// Singleton instance
const aiAgent = new AIAgent();

module.exports = { AIAgent, aiAgent };
