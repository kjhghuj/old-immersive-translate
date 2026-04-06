# Implementation Plan: AI Model Integration for Translation Extension

## Task Type
- [x] Fullstack (Backend AI Service + Frontend Configuration UI)

## Technical Solution

### Overview
Add a new translation service that integrates with user-configured AI models (OpenAI API, Claude API, or custom endpoints) to the existing browser extension. The solution follows the existing Service pattern in translationService.js.

### Architecture Changes

#### 1. Backend (src/background/)

**New File: `src/background/aiTranslationService.js`**
- Implements the Service base class interface
- Supports OpenAI API, Claude API, and custom OpenAI-compatible endpoints
- Handles streaming and non-streaming translation modes
- Implements retry logic and rate limiting

**Modified: `src/background/translationService.js`**
- Add AI service to serviceList
- Import and register the new AI translation service

**Modified: `src/background/background.js`**
- Add message handlers for AI-specific configuration
- Handle API key storage/retrieval (using chrome.storage.local)

#### 2. Frontend Configuration (src/options/)

**Modified: `src/options/options.js`**
- Add AI service configuration section
- API key input with encryption/masking
- Endpoint URL configuration
- Model selection dropdown
- Temperature/prompt customization options

**Modified: `src/options/options.html`**
- Add new tab for AI configuration
- Form elements for AI settings

#### 3. Configuration (src/lib/)

**Modified: `src/lib/config.js`**
- Add new configuration keys:
  - `aiServiceEnabled`: boolean
  - `aiServiceProvider`: 'openai' | 'claude' | 'custom'
  - `aiServiceApiKey`: encrypted string
  - `aiServiceEndpoint`: string (for custom endpoints)
  - `aiServiceModel`: string
  - `aiServiceTemperature`: number
  - `aiServiceSystemPrompt`: string

### Implementation Steps

#### Step 1: Create AI Translation Service
**File**: `src/background/aiTranslationService.js` (New)

```javascript
class AITranslationService extends Service {
  constructor() {
    super();
    this.name = 'ai';
    this.label = 'AI Model';
  }

  async translateHTML(targetLanguage, sourceArray2d, dontSortResults = false) {
    // Batch translate HTML content using AI API
  }

  async translateText(targetLanguage, sourceArray) {
    // Translate text array using AI API
  }

  async translateSingleText(targetLanguage, source) {
    // Single text translation with retry logic
  }

  async callAIAPI(messages, config) {
    // Generic API caller for OpenAI/Claude/custom endpoints
    // Handle streaming if enabled
    // Implement error handling and retries
  }
}
```

#### Step 2: Register Service
**File**: `src/background/translationService.js:L30-50`

Add AI service to serviceList registration.

#### Step 3: Add Configuration UI
**File**: `src/options/options.js:L300+` and `src/options/options.html`

- Add new "AI Translation" settings tab
- API key input (masked)
- Provider selection (OpenAI/Claude/Custom)
- Model selection dropdown
- Advanced options (temperature, custom prompt)
- Test connection button

#### Step 4: Update Config Schema
**File**: `src/lib/config.js:L50-100`

Add new configuration keys with defaults.

#### Step 5: Add Security Measures
**File**: `src/background/background.js:L100+`

- Secure API key storage using chrome.storage.local
- Add CSP headers for AI API endpoints
- Input validation for endpoint URLs
- Rate limiting per domain

### Key Files

| File | Operation | Description |
|------|-----------|-------------|
| src/background/aiTranslationService.js | Create | New AI translation service implementation |
| src/background/translationService.js | Modify | Register AI service in serviceList |
| src/background/background.js | Modify | Add message handlers for AI config |
| src/lib/config.js | Modify | Add AI configuration schema |
| src/options/options.js | Modify | Add AI settings UI logic |
| src/options/options.html | Modify | Add AI settings HTML |
| src/_locales/en/messages.json | Modify | Add AI-related i18n strings |

### Risks and Mitigation

| Risk | Mitigation |
|------|------------|
| API key exposure | Store in chrome.storage.local, never log or expose to content scripts |
| AI API rate limiting | Implement client-side rate limiting and exponential backoff |
| Large translation costs | Add token estimation and warning before translation |
| Streaming UI complexity | Start with non-streaming, add streaming as enhancement |
| CORS issues with AI APIs | Use background script for all API calls (avoids CORS) |
| AI response parsing | Robust error handling for malformed responses |

### Configuration Example

```javascript
// Default configuration additions
const defaultConfig = {
  // ... existing config ...
  aiServiceEnabled: false,
  aiServiceProvider: 'openai',
  aiServiceApiKey: '',
  aiServiceEndpoint: 'https://api.openai.com/v1',
  aiServiceModel: 'gpt-3.5-turbo',
  aiServiceTemperature: 0.3,
  aiServiceSystemPrompt: 'You are a translator. Translate the following text to {targetLanguage}. Preserve formatting.',
  aiServiceMaxTokens: 4096,
  aiServiceStreaming: false
}
```

### API Implementation Pattern

```javascript
// OpenAI API call pattern
async callOpenAI(text, targetLanguage, config) {
  const response = await fetch(`${config.endpoint}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: config.systemPrompt.replace('{targetLanguage}', targetLanguage) },
        { role: 'user', content: text }
      ],
      temperature: config.temperature,
      max_tokens: config.maxTokens
    })
  });
  // Handle response and extract translated text
}
```

### Testing Strategy

1. Unit test AI service with mocked API responses
2. Test configuration UI interactions
3. Test API key storage/retrieval
4. Test error handling (network failures, API errors)
5. Test rate limiting behavior
6. Integration test with real AI API (development key)

### Deployment Notes

- AI service is opt-in (disabled by default)
- Users must provide their own API key
- No AI service endpoints bundled with extension
- All AI calls made from background script only

---

**Plan generated and saved to `.claude/plan/ai-model-integration.md`**

**Please review the plan above. You can:**
- **Modify plan**: Tell me what needs adjustment, I'll update the plan
- **Execute plan**: Copy the following command to a new session

```
/ccg:execute .claude/plan/ai-model-integration.md
```
