# PromptBuilder

Fluent interface for composing AI prompts with standard rules, roles, tasks, and custom sections.

## Features

- Immutable builder pattern (each method returns new instance)
- Type-safe fluent interface
- Modular rule composition
- 97% test coverage
- 129 lines of code

## Usage

### Basic Example

```typescript
import { PromptBuilder } from './builder';

const prompt = new PromptBuilder()
  .withStandardRules()
  .withRole('ObserveAgent@DAIVE - Kubernetes Expert')
  .withTask('Observe Kubernetes cluster state and collect symptoms.')
  .build();
```

### Custom Rules

```typescript
// Use only specific rules
const prompt = new PromptBuilder()
  .withLanguageRules()
  .withEmojiProhibition()
  .withRole('Agent')
  .build();
```

### Custom Sections

```typescript
const prompt = new PromptBuilder()
  .withStandardRules()
  .withRole('HypothesizeAgent@DAIVE')
  .withTask('Formulate hypotheses based on symptoms')
  .withSection('ALGORITHM', '1. Analyze symptoms\n2. Form hypotheses')
  .withSection('OUTPUT_FORMAT', 'JSON with confidence scores')
  .build();
```

### Raw Content

```typescript
const prompt = new PromptBuilder()
  .withRole('Agent')
  .withTask('Task description')
  .withRawContent('Always respond in the same language as the user.')
  .build();
```

## Methods

| Method | Description |
|--------|-------------|
| `withStandardRules()` | Adds language + emoji + output format rules |
| `withLanguageRules()` | Adds language instruction only |
| `withEmojiProhibition()` | Adds emoji prohibition only |
| `withOutputFormat()` | Adds output format rules only |
| `withRole(role: string)` | Sets [ROLE] section |
| `withTask(task: string)` | Sets [TASK] section |
| `withSection(name, content)` | Adds custom section |
| `withRawContent(content)` | Adds raw content |
| `build()` | Returns final prompt string |

## Output Structure

Prompts are assembled in this order:

1. Standard rules (language, emoji, output format)
2. Role section `[ROLE] Agent@DAIVE`
3. Task section `[TASK]\nDescription`
4. Custom sections `[NAME]\nContent`
5. Raw content (no formatting)

## Immutability

Each method returns a new instance:

```typescript
const builder1 = new PromptBuilder().withRole('Agent1');
const builder2 = builder1.withTask('Task'); // builder1 unchanged

console.log(builder1.build()); // Only role
console.log(builder2.build()); // Role + task
```

## Testing

- 36 test cases
- 97.14% statement coverage
- 92.3% branch coverage
- 100% function coverage
