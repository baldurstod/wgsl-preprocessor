const includes = new Map();
const PRAGMA_REGEX = /#pragma (\w+)/;
class IsDefinedCondition {
    #condition;
    constructor(condition) {
        this.#condition = condition;
    }
    isTrue(defines) {
        return defines.has(this.#condition);
    }
}
class TrueCondition {
    isTrue() {
        return true;
    }
}
class FlipCondition {
    #condition;
    constructor(condition) {
        this.#condition = condition;
    }
    isTrue(defines) {
        return !this.#condition.isTrue(defines);
    }
}
let branchId = 0;
class Branch {
    isBranch = true;
    condition;
    #lines = [];
    #currentSubBranch = null;
    branchId = String(branchId++);
    constructor(condition) {
        this.condition = condition;
    }
    addLine(line) {
        const preprocessorSymbols = /#([^\s]*)\s*(.*)/g;
        // If we are in a subbranch, pass the line to the subbranch
        if (this.#currentSubBranch) {
            if (this.#currentSubBranch.addLine(line)) {
                return true;
            }
        }
        const matchedSymbol = preprocessorSymbols.exec(line.line);
        if (matchedSymbol) {
            switch (matchedSymbol[1]) {
                case 'ifdef':
                    this.#currentSubBranch = new Branch(new IsDefinedCondition(matchedSymbol[2]));
                    this.#lines.push(this.#currentSubBranch);
                    return true;
                case 'else':
                    if (this.#currentSubBranch) {
                        this.#currentSubBranch = new Branch(new FlipCondition(this.#currentSubBranch.condition));
                        this.#lines.push(this.#currentSubBranch);
                    }
                    else {
                        return false;
                    }
                    return true;
                case 'endif':
                    if (this.#currentSubBranch) {
                        this.#currentSubBranch = null;
                        return true;
                    }
                    else {
                        return false;
                    }
                default:
                    // This is probably an error
                    this.#lines.push(line);
                    return true;
            }
        }
        else {
            if (this.#currentSubBranch) {
                return this.#currentSubBranch.addLine(line);
            }
            else {
                this.#lines.push(line);
                return true;
            }
        }
    }
    out(out = [], defines) {
        if (!this.condition.isTrue(defines)) {
            return;
        }
        for (const line of this.#lines) {
            if (line.isBranch) {
                line.out(out, defines);
            }
            else {
                out.push(line);
            }
        }
    }
}
function addWgslInclude(name, source) {
    includes.set(name, source);
}
function preprocessWgsl(source, defines = new Map()) {
    const expandedArray = expandIncludes(source);
    const processedArray = preprocess(expandedArray, defines);
    const finalArray = [];
    for (const line of processedArray) {
        finalArray.push(line.line);
    }
    return finalArray.join('\n');
}
function preprocessWgslLineMap(source, defines = new Map()) {
    const expandedArray = expandIncludes(source);
    const processedArray = preprocess(expandedArray, defines);
    const finalArray = [];
    for (const line of processedArray) {
        finalArray.push(line.line);
    }
    return [finalArray.join('\n'), processedArray];
}
function preprocess(lines, defines) {
    const branch = new Branch(new TrueCondition());
    for (let i = 0, l = lines.length; i < l; ++i) {
        branch.addLine(lines[i]);
    }
    const result = [];
    branch.out(result, defines);
    return result;
}
function expandIncludes(source) {
    const lines = source.split('\n');
    const allIncludes = new Set();
    let compileRow = 1;
    const outArray = [];
    const sourceRowToInclude = new Map();
    for (let i = 0; i < lines.length; ++i) {
        const line = lines[i];
        if (line.trim().startsWith('#include')) {
            const includeName = line.replace('#include', '').trim();
            const include = getInclude(includeName, sourceRowToInclude, compileRow, new Set(), allIncludes);
            if (include) {
                sourceRowToInclude.set(compileRow, [includeName, include.length]);
                for (let j = 0; j < include.length; j++) {
                    const includeLine = include[j];
                    outArray.push({ line: includeLine.line, originalLine: i + 1, includeLine });
                }
                compileRow += include.length;
                include.length;
            }
            else {
                if (include === undefined) {
                    console.error(`Include not found : ${line}`);
                }
            }
        }
        else {
            outArray.push({ line, originalLine: i + 1, });
            ++compileRow;
        }
    }
    return outArray;
}
function getInclude(includeName, sourceRowToInclude, compileRow = 0, recursion = new Set(), allIncludes = new Set()) {
    if (recursion.has(includeName)) {
        console.error('Include recursion in ' + includeName);
        return null;
    }
    recursion.add(includeName);
    const include = includes.get(includeName);
    if (include == undefined) {
        return null;
    }
    const includeLineArray = include.trim().split('\n');
    //includeLineArray.unshift('');//Add an empty line to ensure nested include won't occupy the same line #
    const outArray = [];
    for (let i = 0, l = includeLineArray.length; i < l; ++i) {
        const line = includeLineArray[i];
        if (line.trim().startsWith('#include')) {
            const nestedIncludeName = line.replace('#include', '').trim();
            const include = getInclude(nestedIncludeName, sourceRowToInclude, compileRow + i, recursion, allIncludes);
            if (include) {
                sourceRowToInclude.set(compileRow, [nestedIncludeName, include.length]);
                for (let j = 0; j < include.length; j++) {
                    const includeLine = include[j];
                    outArray.push({ sourceName: includeName, line: includeLine.line, originalLine: i + 1, includeLine });
                }
                compileRow += include.length;
            }
            continue;
        }
        if (line.trim().startsWith('#pragma')) {
            const result = PRAGMA_REGEX.exec(line);
            if (result && result[1] == 'once') {
                if (allIncludes.has(includeName)) {
                    return null;
                }
                continue;
            }
        }
        outArray.push({ sourceName: includeName, line, originalLine: i + 1, });
        ++compileRow;
    }
    allIncludes.add(includeName);
    return outArray;
}

export { addWgslInclude, preprocessWgsl, preprocessWgslLineMap };
