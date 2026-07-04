use super::AgentOutputParser;
use crate::domain::{AgentEvent, NoticeLevel};
use serde_json::Value;

type EventMapper = fn(Value) -> Vec<AgentEvent>;

pub fn codex_parser() -> Box<dyn AgentOutputParser> {
    Box::new(JsonLineParser::new(map_codex_event))
}

pub fn claude_parser() -> Box<dyn AgentOutputParser> {
    Box::new(JsonLineParser::new(map_claude_event))
}

pub fn kimi_parser() -> Box<dyn AgentOutputParser> {
    Box::new(JsonLineParser::new(map_kimi_event))
}

struct JsonLineParser {
    buffer: String,
    mapper: EventMapper,
}

impl JsonLineParser {
    fn new(mapper: EventMapper) -> Self {
        Self {
            buffer: String::new(),
            mapper,
        }
    }

    fn parse_line(&self, line: &str) -> Vec<AgentEvent> {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            return Vec::new();
        }

        match serde_json::from_str::<Value>(trimmed) {
            Ok(value) => (self.mapper)(value),
            Err(err) => vec![notice(
                NoticeLevel::Warning,
                format!("malformed structured event: {err}"),
            )],
        }
    }
}

impl AgentOutputParser for JsonLineParser {
    fn parse_chunk(&mut self, chunk: &[u8]) -> Vec<AgentEvent> {
        self.buffer.push_str(&String::from_utf8_lossy(chunk));
        let mut events = Vec::new();

        while let Some(index) = self.buffer.find('\n') {
            let line = self.buffer[..index].trim_end_matches('\r').to_string();
            self.buffer.drain(..=index);
            events.extend(self.parse_line(&line));
        }

        events
    }

    fn flush(&mut self) -> Vec<AgentEvent> {
        if self.buffer.trim().is_empty() {
            self.buffer.clear();
            return Vec::new();
        }

        let line = std::mem::take(&mut self.buffer);
        self.parse_line(&line)
    }
}

fn map_codex_event(value: Value) -> Vec<AgentEvent> {
    let kind = event_kind(&value);
    let item = value.get("item").unwrap_or(&value);
    let item_kind = event_kind(item);

    if is_started(&kind) || is_started(&item_kind) {
        return vec![AgentEvent::SessionStarted {
            agent_session_id: session_id(&value).or_else(|| session_id(item)),
        }];
    }

    if is_tool_result(&kind) || is_tool_result(&item_kind) {
        return vec![tool_result(&value, item)];
    }

    if is_tool_call(&kind) || is_tool_call(&item_kind) {
        return vec![tool_call(&value, item)];
    }

    let event_role = role(item).or_else(|| role(&value));
    if event_role.as_deref() == Some("user") {
        if let Some(text) = text_value(item).or_else(|| text_value(&value)) {
            return vec![AgentEvent::UserMessage { text }];
        }
    }

    if is_assistant_delta(&kind) {
        if let Some(text) = text_value(&value) {
            return vec![AgentEvent::AssistantDelta { text }];
        }
    }

    if event_role.as_deref() == Some("assistant")
        || is_assistant_message(&kind)
        || is_assistant_message(&item_kind)
    {
        if let Some(text) = text_value(item).or_else(|| text_value(&value)) {
            return vec![AgentEvent::AssistantMessage { text }];
        }
    }

    if is_completed(&kind) {
        return vec![AgentEvent::Completed {
            exit_code: exit_code(&value),
        }];
    }

    unknown_notice("codex", &kind)
}

fn map_claude_event(value: Value) -> Vec<AgentEvent> {
    let kind = event_kind(&value);
    match kind.as_str() {
        "system" if subtype(&value).as_deref() == Some("init") => {
            vec![AgentEvent::SessionStarted {
                agent_session_id: session_id(&value),
            }]
        }
        "assistant" => claude_assistant_events(&value),
        "user" => claude_user_events(&value),
        "result" => {
            let mut events = Vec::new();
            if let Some(text) = string_field(&value, &["result"]) {
                events.push(AgentEvent::AssistantMessage { text });
            }
            events.push(AgentEvent::Completed {
                exit_code: exit_code(&value),
            });
            events
        }
        "error" => vec![notice(
            NoticeLevel::Error,
            text_value(&value).unwrap_or_else(|| "Claude stream error".to_string()),
        )],
        _ => unknown_notice("claude", &kind),
    }
}

fn map_kimi_event(value: Value) -> Vec<AgentEvent> {
    let kind = event_kind(&value);
    if is_started(&kind) {
        return vec![AgentEvent::SessionStarted {
            agent_session_id: session_id(&value),
        }];
    }
    if is_tool_result(&kind) {
        return vec![tool_result(&value, &value)];
    }
    if is_tool_call(&kind) {
        return vec![tool_call(&value, &value)];
    }
    if is_assistant_delta(&kind) {
        if let Some(text) = text_value(&value) {
            return vec![AgentEvent::AssistantDelta { text }];
        }
    }
    if is_completed(&kind) {
        return vec![AgentEvent::Completed {
            exit_code: exit_code(&value),
        }];
    }

    match role(&value).as_deref() {
        Some("user") => text_value(&value)
            .map(|text| vec![AgentEvent::UserMessage { text }])
            .unwrap_or_else(|| unknown_notice("kimi", &kind)),
        Some("assistant") => text_value(&value)
            .map(|text| vec![AgentEvent::AssistantMessage { text }])
            .unwrap_or_else(|| unknown_notice("kimi", &kind)),
        _ if is_assistant_message(&kind) => text_value(&value)
            .map(|text| vec![AgentEvent::AssistantMessage { text }])
            .unwrap_or_else(|| unknown_notice("kimi", &kind)),
        _ => unknown_notice("kimi", &kind),
    }
}

fn claude_assistant_events(value: &Value) -> Vec<AgentEvent> {
    content_blocks(value)
        .into_iter()
        .filter_map(|block| match string_field(block, &["type"]).as_deref() {
            Some("text") => {
                string_field(block, &["text"]).map(|text| AgentEvent::AssistantMessage { text })
            }
            Some("tool_use") => Some(tool_call(value, block)),
            _ => None,
        })
        .collect()
}

fn claude_user_events(value: &Value) -> Vec<AgentEvent> {
    content_blocks(value)
        .into_iter()
        .filter_map(|block| match string_field(block, &["type"]).as_deref() {
            Some("tool_result") => Some(tool_result(value, block)),
            Some("text") => {
                string_field(block, &["text"]).map(|text| AgentEvent::UserMessage { text })
            }
            _ => None,
        })
        .collect()
}

fn content_blocks(value: &Value) -> Vec<&Value> {
    value
        .get("message")
        .and_then(|message| message.get("content"))
        .or_else(|| value.get("content"))
        .and_then(Value::as_array)
        .map(|items| items.iter().collect())
        .unwrap_or_default()
}

fn tool_call(parent: &Value, item: &Value) -> AgentEvent {
    let name = string_field(item, &["name", "tool_name"])
        .or_else(|| string_field(parent, &["name", "tool_name"]))
        .unwrap_or_else(|| "tool".to_string());
    let input = item
        .get("input")
        .cloned()
        .or_else(|| parent.get("input").cloned())
        .or_else(|| parse_json_string(item.get("arguments")))
        .or_else(|| parse_json_string(parent.get("arguments")))
        .unwrap_or(Value::Null);

    AgentEvent::ToolCall { name, input }
}

fn tool_result(parent: &Value, item: &Value) -> AgentEvent {
    let name = string_field(item, &["name", "tool_name", "tool_use_id", "call_id"])
        .or_else(|| string_field(parent, &["name", "tool_name", "tool_use_id", "call_id"]))
        .unwrap_or_else(|| "tool".to_string());
    let output = text_value(item)
        .or_else(|| text_value(parent))
        .unwrap_or_default();
    let is_error = item
        .get("is_error")
        .or_else(|| parent.get("is_error"))
        .and_then(Value::as_bool)
        .unwrap_or(false);

    AgentEvent::ToolResult {
        name,
        output,
        is_error,
    }
}

fn text_value(value: &Value) -> Option<String> {
    string_field(value, &["delta", "text", "output", "result", "content"]).or_else(|| {
        value
            .get("message")
            .and_then(|message| {
                string_field(message, &["text", "content"]).or_else(|| {
                    message
                        .get("content")
                        .and_then(Value::as_array)
                        .map(|blocks| text_from_blocks(blocks))
                })
            })
            .filter(|text| !text.is_empty())
    })
}

fn text_from_blocks(blocks: &[Value]) -> String {
    blocks
        .iter()
        .filter_map(|block| {
            string_field(block, &["text"])
                .or_else(|| string_field(block, &["content"]))
                .or_else(|| string_field(block, &["output"]))
        })
        .collect::<Vec<_>>()
        .join("")
}

fn string_field(value: &Value, keys: &[&str]) -> Option<String> {
    keys.iter()
        .find_map(|key| value.get(*key))
        .and_then(|field| match field {
            Value::String(text) => Some(text.clone()),
            Value::Number(number) => Some(number.to_string()),
            Value::Bool(flag) => Some(flag.to_string()),
            _ => None,
        })
}

fn parse_json_string(value: Option<&Value>) -> Option<Value> {
    let text = value?.as_str()?;
    serde_json::from_str(text).ok()
}

fn event_kind(value: &Value) -> String {
    string_field(value, &["type", "event", "kind"]).unwrap_or_else(|| "unknown".to_string())
}

fn subtype(value: &Value) -> Option<String> {
    string_field(value, &["subtype"])
}

fn role(value: &Value) -> Option<String> {
    string_field(value, &["role"]).or_else(|| {
        value
            .get("message")
            .and_then(|message| string_field(message, &["role"]))
    })
}

fn session_id(value: &Value) -> Option<String> {
    string_field(
        value,
        &[
            "session_id",
            "agent_session_id",
            "thread_id",
            "conversation_id",
        ],
    )
}

fn exit_code(value: &Value) -> Option<i32> {
    value
        .get("exit_code")
        .or_else(|| value.get("code"))
        .and_then(Value::as_i64)
        .and_then(|code| i32::try_from(code).ok())
}

fn is_started(kind: &str) -> bool {
    (kind.contains("session") || kind.contains("thread")) && kind.contains("start")
}

fn is_tool_call(kind: &str) -> bool {
    kind.contains("tool_call")
        || kind.contains("tool_use")
        || kind.contains("function_call")
        || kind == "tool_call"
}

fn is_tool_result(kind: &str) -> bool {
    kind.contains("tool_result")
        || kind.contains("tool_output")
        || kind.contains("function_call_output")
}

fn is_assistant_delta(kind: &str) -> bool {
    kind.contains("assistant") && (kind.contains("delta") || kind.contains("chunk"))
}

fn is_assistant_message(kind: &str) -> bool {
    kind.contains("assistant") || kind == "message"
}

fn is_completed(kind: &str) -> bool {
    kind.contains("completed") || kind == "done" || kind == "result"
}

fn notice(level: NoticeLevel, text: String) -> AgentEvent {
    AgentEvent::Notice { level, text }
}

fn unknown_notice(agent: &str, kind: &str) -> Vec<AgentEvent> {
    vec![notice(
        NoticeLevel::Info,
        format!("unhandled {agent} event: {kind}"),
    )]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn codex_fixture_maps_normalized_events() {
        let events = parse_all(
            codex_parser(),
            include_str!("../tests/fixtures/codex_stream.jsonl"),
        );

        assert!(events.iter().any(|event| {
            matches!(
                event,
                AgentEvent::SessionStarted {
                    agent_session_id: Some(id)
                } if id == "codex-thread-1"
            )
        }));
        assert!(events.iter().any(|event| {
            matches!(event, AgentEvent::AssistantDelta { text } if text.contains("inspect"))
        }));
        assert!(events.iter().any(|event| {
            matches!(event, AgentEvent::ToolCall { name, .. } if name == "shell")
        }));
        assert!(events.iter().any(|event| {
            matches!(
                event,
                AgentEvent::ToolResult {
                    name,
                    output,
                    is_error: false
                } if name == "shell" && output == "28 passed"
            )
        }));
        assert!(events.iter().any(|event| {
            matches!(event, AgentEvent::AssistantMessage { text } if text == "Tests passed.")
        }));
        assert!(events
            .iter()
            .any(|event| matches!(event, AgentEvent::Completed { exit_code: Some(0) })));
    }

    #[test]
    fn claude_fixture_maps_tool_use_and_result() {
        let events = parse_all(
            claude_parser(),
            include_str!("../tests/fixtures/claude_stream.jsonl"),
        );

        assert!(events.iter().any(|event| {
            matches!(
                event,
                AgentEvent::SessionStarted {
                    agent_session_id: Some(id)
                } if id == "claude-session-1"
            )
        }));
        assert!(events.iter().any(|event| {
            matches!(event, AgentEvent::ToolCall { name, input } if name == "Read" && input["file_path"] == "src/App.tsx")
        }));
        assert!(events.iter().any(|event| {
            matches!(event, AgentEvent::ToolResult { output, .. } if output == "function App() {}")
        }));
        assert!(events
            .iter()
            .any(|event| matches!(event, AgentEvent::Completed { exit_code: None })));
    }

    #[test]
    fn kimi_fixture_maps_stream_events() {
        let events = parse_all(
            kimi_parser(),
            include_str!("../tests/fixtures/kimi_stream.jsonl"),
        );

        assert!(events.iter().any(|event| {
            matches!(
                event,
                AgentEvent::SessionStarted {
                    agent_session_id: Some(id)
                } if id == "kimi-session-1"
            )
        }));
        assert!(events.iter().any(|event| {
            matches!(event, AgentEvent::AssistantDelta { text } if text.contains("workspace"))
        }));
        assert!(events.iter().any(|event| {
            matches!(event, AgentEvent::ToolResult { name, output, .. } if name == "shell" && output.contains("src-tauri"))
        }));
        assert!(events
            .iter()
            .any(|event| matches!(event, AgentEvent::Completed { exit_code: Some(0) })));
    }

    #[test]
    fn parser_buffers_partial_json_lines() {
        let mut parser = codex_parser();
        let first = parser.parse_chunk(br#"{"type":"thread.started","#);
        assert!(first.is_empty());

        let second = parser.parse_chunk(
            br#""thread_id":"partial"}
"#,
        );
        assert!(second.iter().any(|event| {
            matches!(
                event,
                AgentEvent::SessionStarted {
                    agent_session_id: Some(id)
                } if id == "partial"
            )
        }));
    }

    #[test]
    fn codex_message_role_user_maps_to_user_message() {
        let mut parser = codex_parser();
        let events = parser.parse_chunk(
            br#"{"type":"message","role":"user","content":"hello"}
"#,
        );

        assert!(events
            .iter()
            .any(|event| matches!(event, AgentEvent::UserMessage { text } if text == "hello")));
    }

    #[test]
    fn malformed_json_becomes_warning_notice() {
        let mut parser = kimi_parser();
        let events = parser.parse_chunk(b"{not json}\n");

        assert!(events.iter().any(|event| {
            matches!(
                event,
                AgentEvent::Notice {
                    level: NoticeLevel::Warning,
                    text
                } if text.contains("malformed structured event")
            )
        }));
    }

    fn parse_all(mut parser: Box<dyn AgentOutputParser>, fixture: &str) -> Vec<AgentEvent> {
        let mut events = parser.parse_chunk(fixture.as_bytes());
        events.extend(parser.flush());
        events
    }
}
