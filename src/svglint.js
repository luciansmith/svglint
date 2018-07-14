/**
 * @fileoverview The SVGLint entry file.
 * This is the publicly exposed JS API, which the CLI also uses.
 * It exposes .lintSource() and .lintFile().
 * Main responsibility is handling the consumer<->Linting communication,
 *   and converting the user-provided config into an object of rules.
 */
const Linting = require("./lib/linting");
const parse = require("./lib/parse");
const loadRule = require("./lib/rule-loader");
const logger = require("./lib/logger.js")("");

/**
 * @typedef {Object<string,Object<string,*>|false>} RulesConfig
 * An object with each key representing a rule name, and each value representing
 *   a rule config.
 * If the rule config is set to `false`, then the rule is disabled (useful for
 *   e.g. overwriting presets).
 */
/**
 * @typedef {Object<string,Function|Function[]>} NormalizedRules
 * The RulesConfig after being normalized - each function is a rule.
 */
/**
 * @typedef {String[]} IgnoreList
 * An array of strings, each of which is a blob that represents files to ignore.
 * If any blob matches a file, the file is not linted.
 */
/**
 * @typedef Config
 * @property {RulesConfig} [rules={}] The rules to lint by
 * @property {IgnoreList} [ignore=[]] The blobs representing which files to ignore
 */
/**
 * @typedef NormalizedConfig
 * @property {NormalizedRules} rules The rules to lint by
 * @property {IgnoreList} ignore The blobs representing which files to ignore
 */

/** @type Config */
const DEFAULT_CONFIG = Object.freeze({
    useSvglintRc: true,
    rules: {},
    ignore: [],
});

/**
 * Normalizes a user-provided RulesConfig into a NormalizedRules.
 * Figures out which rules should be kept, and calls their generator with the
 *   user-provided config. The returned function is the actual linting func.
 * @param {RulesConfig} rulesConfig The user-provided config
 * @returns {NormalizedRules} The normalized rules
 */
function normalizeRules(rulesConfig) {
    /** @type {NormalizedRules} */
    const outp = {};
    Object.keys(rulesConfig)
        // make sure no disabled rules are allowed in
        .filter(k => rulesConfig[k] !== false)
        // then convert each rule config into a rule func
        .forEach(
            ruleName => {
                // TODO: error handling when invalid rule given
                /** @type {RuleModule} */
                let loadedRule;
                try {
                    loadedRule = loadRule(ruleName);
                } catch (e) {
                    logger.warn(`Unknown rule "${ruleName}".`);
                    return;
                }

                // handle the case where there are multiple configs for a single rule
                const config = rulesConfig[ruleName];
                if (config instanceof Array) {
                    /** @type {Array} */
                    outp[ruleName] = config.map(
                        config => loadedRule.generate(config)
                    );
                } else {
                    outp[ruleName] = loadedRule.generate(config);
                }
            }
        );
    return outp;
}

/**
 * Normalizes a user-provided config to make sure it has every property we need.
 * Also handles merging with defaults.
 * @param {Config} config The user-provided config
 * @returns {NormalizedConfig} The normalized config
 */
function normalizeConfig(config) {
    const defaulted = Object.assign({},
        DEFAULT_CONFIG,
        config,
    );
    /** @type NormalizedConfig */
    const outp = {
        rules: normalizeRules(defaulted.rules),
        ignore: defaulted.ignore,
    };
    return outp;
}

/**
 * The main function. Lints the provided AST using the user-provided config.
 * @param {String} file The file we are linting
 * @param {AST} AST The AST to lint
 * @param {Config} config The user-provided config to lint by
 * @returns {Linting} The linting that represents the result
 */
function lint(file, ast, config) {
    const conf = normalizeConfig(config);
    return new Linting(file, ast, conf.rules);
}

module.exports = {
    /**
     * Lints a single SVG string.
     * The function returns before the Linting is finished.
     * You should listen to Linting.on("done") to wait for the result.
     * @param {String} source The SVG to lint
     * @param {Config} config The config to lint by
     * @return {Linting} The Linting that represents the result
     */
    lintSource(source, config) {
        const ast = parse.parseSource(source);
        return lint(null, ast, config);
    },

    /**
     * Lints a single file.
     * The returned Promise resolves before the Linting is finished.
     * You should listen to Linting.on("done") to wait for the result.
     * @param {String} file The file path to lint
     * @param {Config} config The config to lint by
     * @returns {Promise<Linting>} Resolves to the Linting that represents the result
     */
    async lintFile(file, config) {
        const ast = await parse.parseFile(file);
        return lint(file, ast, config);
    }
};
