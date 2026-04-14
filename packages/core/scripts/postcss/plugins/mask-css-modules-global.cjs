const selectorParser = require("postcss-selector-parser");
const { GLOBAL_PSEUDO_PLACEHOLDER } = require("./constants.cjs");

module.exports = () => ({
  postcssPlugin: "mask-css-modules-global",
  AtRule(atRule) {
    if (atRule.name === "reference") {
      atRule.remove();
    }
  },
  Rule(rule) {
    if (!rule.selector || !rule.selector.includes(":global")) {
      return;
    }

    const processor = selectorParser((selectors) => {
      selectors.walkPseudos((pseudo) => {
        if (pseudo.value !== ":global") {
          return;
        }

        pseudo.value = GLOBAL_PSEUDO_PLACEHOLDER;

        if (pseudo.nodes && pseudo.nodes.length > 0) {
          const root = pseudo.nodes[0];

          if (!root || root.type !== "selector") {
            return;
          }

          const nesting = selectorParser.nesting();
          nesting.replaceWith(root.clone());
          root.replaceWith(nesting);
        }
      });
    });

    rule.selector = processor.processSync(rule.selector);
  },
});

module.exports.postcss = true;
