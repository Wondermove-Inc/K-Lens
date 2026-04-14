const selectorParser = require("postcss-selector-parser");
const { GLOBAL_PSEUDO_PLACEHOLDER } = require("./constants.cjs");

module.exports = () => ({
  postcssPlugin: "unmask-css-modules-global",
  Rule(rule) {
    if (!rule.selector || !rule.selector.includes(GLOBAL_PSEUDO_PLACEHOLDER)) {
      return;
    }

    const processor = selectorParser((selectors) => {
      selectors.walkPseudos((pseudo) => {
        if (pseudo.value !== GLOBAL_PSEUDO_PLACEHOLDER) {
          return;
        }

        pseudo.value = ":global";
      });
    });

    rule.selector = processor.processSync(rule.selector);
  },
});

module.exports.postcss = true;
