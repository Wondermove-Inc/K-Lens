const selectorParser = require("postcss-selector-parser");

module.exports = () => ({
  postcssPlugin: "remove-reference-at-rules",
  AtRule(atRule) {
    if (atRule.name !== "reference") {
      return;
    }

    const params = atRule.params.trim();

    if (params.startsWith('"') || params.startsWith("'")) {
      atRule.remove();
      return;
    }

    atRule.params = "";
  },
  Rule(rule) {
    if (!rule.selector || !rule.selector.includes("@reference")) {
      return;
    }

    const processor = selectorParser((selectors) => {
      selectors.walkComments((comment) => {
        if (comment.value.includes("@reference")) {
          comment.remove();
        }
      });
    });

    rule.selector = processor.processSync(rule.selector);
  },
});

module.exports.postcss = true;
