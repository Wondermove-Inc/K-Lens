# @skuberplus/react-application

## Usage

```sh
npm install @skuberplus/react-application
```

```typescript
import { reactApplicationFeature } from "@skuberplus/react-application";
import { registerFeature } from "@skuberplus/feature-core";
import { createContainer } from "@ogre-tools/injectable";

const di = createContainer("some-container");

registerFeature(di, reactApplicationRootFeature);
```

## Extendability
