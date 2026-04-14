const selectorParser = require("postcss-selector-parser");

module.exports = () => ({
  postcssPlugin: "resolve-global-selectors",
  Rule(rule) {
    if (!rule.selector || !rule.selector.includes(":global")) {
      return;
    }

    const processor = selectorParser((selectors) => {
      selectors.walkPseudos((pseudo) => {
        if (pseudo.value !== ":global") {
          return;
        }

        if (pseudo.nodes && pseudo.nodes.length > 0) {
          const selector = pseudo.nodes[0];

          if (selector && selector.type === "selector") {
            const cloning = selector.clone();
            pseudo.replaceWith(
              selectorParser.nesting({
                value: "&",
                nodes: [cloning],
              }),
            );
            return;
          }
        }

        pseudo.value = ":-tw-global";
      });
    });

    rule.selector = processor.processSync(rule.selector);
  },
});

module.exports.postcss = true;
