# @skuberplus/keyboard-shortcuts

This Feature enables keyboard shortcuts in Lens

## Usage

```sh
npm install @skuberplus/keyboard-shortcuts
```

```typescript
import { keyboardShortcutsFeature } from "@skuberplus/keyboard-shortcuts";
import { registerFeature } from "@skuberplus/feature-core";
import { createContainer } from "@ogre-tools/injectable";

const di = createContainer("some-container");

registerFeature(di, keyboardShortcutsFeature);
```

## Extendability
