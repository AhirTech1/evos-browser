"""
EVOS AI - Agent System
ReAct-style agent that can plan and execute multi-step tasks
"""
import asyncio
import json
from typing import Dict, Any, List, Optional, Callable, Awaitable
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum

from llm_engine import llm_engine
from tools import BrowserTools, ToolResult


class AgentState(str, Enum):
    IDLE = "idle"
    THINKING = "thinking"
    ACTING = "acting"
    WAITING = "waiting"
    COMPLETED = "completed"
    ERROR = "error"


@dataclass
class AgentStep:
    step_number: int
    thought: str
    action: Optional[str] = None
    action_input: Optional[Dict[str, Any]] = None
    observation: Optional[str] = None
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class AgentTask:
    task_id: str
    description: str
    context: Dict[str, Any]
    steps: List[AgentStep] = field(default_factory=list)
    state: AgentState = AgentState.IDLE
    result: Optional[Any] = None
    error: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    completed_at: Optional[datetime] = None


class Agent:
    """
    AI Agent that uses ReAct (Reasoning + Acting) pattern
    to accomplish tasks through tool use.
    """
    
    SYSTEM_PROMPT = """You are EVOS, an intelligent browser agent. You help users accomplish tasks on web pages by using available tools.

You follow the ReAct pattern:
1. THOUGHT: Analyze the current situation and decide what to do next
2. ACTION: Choose and execute a tool
3. OBSERVATION: Analyze the result
4. Repeat until task is complete

Current page context:
URL: {url}
Title: {title}
Page content summary: {content_summary}

Interactive elements on page:
{interactive_elements}

{tools}

IMPORTANT RULES:
- Always think step by step
- Use the most specific tool for each action
- If something fails, try an alternative approach
- When the task is complete, use the "answer_user" tool
- Keep responses concise and focused

Respond in this JSON format:
{{
    "thought": "Your reasoning about what to do",
    "action": "tool_name",
    "action_input": {{"param1": "value1"}}
}}

Or if you're done:
{{
    "thought": "Task completed because...",
    "action": "answer_user",
    "action_input": {{"message": "Here's what I found/did..."}}
}}"""

    def __init__(self, max_steps: int = 10):
        self.max_steps = max_steps
        self.current_task: Optional[AgentTask] = None
        self.tool_executor: Optional[Callable[[str, Dict], Awaitable[ToolResult]]] = None
        
    def set_tool_executor(self, executor: Callable[[str, Dict], Awaitable[ToolResult]]):
        """Set the function that executes tools in the browser"""
        self.tool_executor = executor
    
    async def run(
        self,
        task_description: str,
        context: Dict[str, Any],
        on_step: Optional[Callable[[AgentStep], Awaitable[None]]] = None
    ) -> AgentTask:
        """
        Run the agent to complete a task
        
        Args:
            task_description: What the user wants to accomplish
            context: Current page context (url, title, content, etc.)
            on_step: Callback for each step (for streaming updates)
        
        Returns:
            AgentTask with results
        """
        import uuid
        
        task = AgentTask(
            task_id=str(uuid.uuid4()),
            description=task_description,
            context=context,
            state=AgentState.THINKING
        )
        self.current_task = task
        
        # Get interactive elements from context
        interactive_elements = context.get("interactive_elements", [])
        elements_str = self._format_elements(interactive_elements[:30])  # Limit to 30
        
        # Build system prompt
        system_prompt = self.SYSTEM_PROMPT.format(
            url=context.get("url", "unknown"),
            title=context.get("title", "unknown"),
            content_summary=self._summarize_content(context.get("content", "")),
            interactive_elements=elements_str,
            tools=BrowserTools.format_tools_for_prompt()
        )
        
        # Conversation history for multi-turn
        messages = [
            f"User task: {task_description}\n\nBegin by analyzing the page and planning your approach."
        ]
        
        for step_num in range(1, self.max_steps + 1):
            task.state = AgentState.THINKING
            
            # Build prompt with history
            prompt = "\n\n".join(messages)
            
            # Get LLM response
            response = await llm_engine.generate(
                prompt=prompt,
                system_prompt=system_prompt,
                temperature=0.3,
                max_tokens=1024
            )
            
            # Parse response
            step = self._parse_response(response, step_num)
            task.steps.append(step)
            
            if on_step:
                await on_step(step)
            
            # Check if done
            if step.action == "answer_user":
                task.state = AgentState.COMPLETED
                task.result = step.action_input.get("message", "Task completed")
                task.completed_at = datetime.now()
                break
            
            # Execute action
            if step.action and self.tool_executor:
                task.state = AgentState.ACTING
                
                try:
                    result = await self.tool_executor(step.action, step.action_input or {})
                    step.observation = json.dumps(result.__dict__ if hasattr(result, '__dict__') else result)
                except Exception as e:
                    step.observation = f"Error executing {step.action}: {str(e)}"
                    task.state = AgentState.ERROR
                
                # Add observation to history
                messages.append(f"Step {step_num}:\nThought: {step.thought}\nAction: {step.action}\nAction Input: {json.dumps(step.action_input)}\nObservation: {step.observation}")
            
            # Check for errors
            if step.action is None:
                messages.append(f"Your response wasn't valid JSON. Please respond with proper JSON format.")
        
        if task.state != AgentState.COMPLETED:
            task.state = AgentState.ERROR
            task.error = "Max steps reached without completing task"
        
        return task
    
    def _parse_response(self, response: str, step_num: int) -> AgentStep:
        """Parse LLM response into an AgentStep"""
        step = AgentStep(step_number=step_num, thought="")
        
        try:
            # Find JSON in response
            start = response.find("{")
            end = response.rfind("}") + 1
            
            if start >= 0 and end > start:
                json_str = response[start:end]
                data = json.loads(json_str)
                
                step.thought = data.get("thought", "")
                step.action = data.get("action")
                step.action_input = data.get("action_input", {})
            else:
                step.thought = response
        except json.JSONDecodeError:
            step.thought = response
        
        return step
    
    def _format_elements(self, elements: List[Dict]) -> str:
        """Format interactive elements for the prompt"""
        if not elements:
            return "No interactive elements detected"
        
        lines = []
        for el in elements:
            desc = f"[{el.get('tag', '?')}]"
            if el.get('text'):
                desc += f" '{el['text'][:50]}'"
            if el.get('id'):
                desc += f" id={el['id']}"
            if el.get('name'):
                desc += f" name={el['name']}"
            if el.get('type'):
                desc += f" type={el['type']}"
            if el.get('href'):
                desc += f" -> {el['href'][:50]}"
            lines.append(desc)
        
        return "\n".join(lines)
    
    def _summarize_content(self, content: str, max_length: int = 2000) -> str:
        """Summarize page content for the prompt"""
        if not content:
            return "No content available"
        
        # Clean and truncate
        content = " ".join(content.split())
        if len(content) > max_length:
            content = content[:max_length] + "..."
        
        return content
    
    async def stop(self):
        """Stop the current task"""
        if self.current_task:
            self.current_task.state = AgentState.ERROR
            self.current_task.error = "Task cancelled by user"


class SimpleAgent:
    """
    A simpler agent for quick one-shot tasks
    """
    
    SYSTEM_PROMPT = """You are EVOS, a helpful browser assistant. Analyze the user's request and the current page to provide a helpful response.

Current page:
URL: {url}
Title: {title}
Content: {content}

If the user asks you to do something on the page, respond with a JSON command:
{{"command": "tool_name", "params": {{...}}}}

Available commands: navigate, click, type_text, scroll, extract_text, extract_links

If the user asks a question, just answer it directly based on the page content.

Be concise and helpful."""

    async def quick_response(
        self,
        message: str,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Get a quick response for simple queries"""
        
        system_prompt = self.SYSTEM_PROMPT.format(
            url=context.get("url", ""),
            title=context.get("title", ""),
            content=context.get("content", "")[:3000]
        )
        
        response = await llm_engine.generate(
            prompt=message,
            system_prompt=system_prompt,
            temperature=0.5,
            max_tokens=512
        )
        
        # Check if response contains a command
        try:
            if "{" in response and "command" in response:
                start = response.find("{")
                end = response.rfind("}") + 1
                data = json.loads(response[start:end])
                return {
                    "type": "command",
                    "command": data.get("command"),
                    "params": data.get("params", {}),
                    "message": response[:start].strip() if start > 0 else ""
                }
        except:
            pass
        
        return {
            "type": "text",
            "message": response
        }


# Singleton instances
agent = Agent()
simple_agent = SimpleAgent()
