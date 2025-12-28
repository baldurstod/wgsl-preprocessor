import { evaluateExpression, replaceDefine } from './expression';
export { evaluateExpression };

const includes = new Map<string, string>();

const PRAGMA_REGEX = /#pragma (\w+)/;

interface Condition {
	isTrue: () => boolean;
}

class ExpressionCondition implements Condition {
	#expression: string;
	#defines: Map<string, string>;
	#result?: boolean;

	constructor(expression: string, readonly defines: Map<string, string>) {
		this.#expression = expression;
		this.#defines = new Map(defines);
	}

	isTrue(): boolean {
		if (this.#result === undefined) {
			this.#result = evaluateExpression(this.#expression, this.#defines) == true;
		}

		return this.#result;
	}
}

class AndCondition implements Condition {
	#condition1: Condition;
	#condition2: Condition;

	constructor(condition1: Condition, condition2: Condition) {
		this.#condition1 = condition1;
		this.#condition2 = condition2;
	}

	isTrue(): boolean {
		if (!this.#condition1.isTrue()) {
			return false;
		}
		return this.#condition2.isTrue();
	}
}

class TrueCondition implements Condition {
	isTrue(): boolean {
		return true;
	}
}

class FalseCondition implements Condition {
	isTrue(): boolean {
		return false;
	}
}

class ElseCondition implements Condition {
	#previousBranch: Branch

	constructor(previousBranch: Branch) {
		this.#previousBranch = previousBranch;
	}

	isTrue(): boolean {
		let previousBranch: Branch | null = this.#previousBranch;
		while (previousBranch) {
			if (previousBranch.isTrue()) {
				return false;
			}

			previousBranch = previousBranch.previousSibling;
		}
		return true;
	}
}

let branchId = 0;
class Branch {
	isBranch = true as const;
	readonly parent: Branch | null;
	readonly condition: Condition;
	#lines: (FinalLine | Branch)[] = [];
	#currentSubBranch: Branch | null = null;
	readonly previousSibling: Branch | null = null;
	readonly branchId = String(branchId++);

	constructor(parent: Branch | null, previousSibling: Branch | null, condition: Condition) {
		this.parent = parent;
		this.condition = condition;
		this.previousSibling = previousSibling;
	}

	isTrue(): boolean {
		return (this.parent?.isTrue() ?? true) && this.condition.isTrue();
	}

	addLine(line: FinalLine, defines: Map<string, string>): boolean {
		const preprocessorSymbols = /^\s*#([\S]*)\s*(.*)/g
		// If we are in a subbranch, pass the line to the subbranch
		if (this.#currentSubBranch) {
			if (this.#currentSubBranch.addLine(line, defines)) {
				return true;
			}
		}

		// Remove line comments
		line.line = line.line.replace(/\/\/.*/, '').trimEnd();

		const matchedSymbol = preprocessorSymbols.exec(line.line);
		if (matchedSymbol) {
			switch (matchedSymbol[1]) {
				// #define. defines are defined for the subsequent lines
				case 'define':
					if (this.isTrue()) {
						const defineSymbols = /#([^\s]*)\s*([^\s]*)\s*(.*)/g.exec(line.line);
						if (defineSymbols && defineSymbols.length > 3) {
							defines.set(defineSymbols[2]!, defineSymbols[3]!);
						}
					}
					return true;
				case 'undef':
					if (this.isTrue()) {
						const undefSymbols = /#([^\s]*)\s*([^\s]*)/g.exec(line.line);
						if (undefSymbols && undefSymbols.length > 2) {
							defines.delete(undefSymbols[2]!);
						}
					}
					return true;
				case 'ifdef':
				case 'ifndef':
					const ifDef = matchedSymbol[1] === 'ifdef';
					if (defines.has(matchedSymbol[2]!)) {
						this.#currentSubBranch = new Branch(this, null, ifDef ? new TrueCondition() : new FalseCondition());
					} else {
						this.#currentSubBranch = new Branch(this, null, ifDef ? new FalseCondition() : new TrueCondition());
					}
					this.#lines.push(this.#currentSubBranch);
					return true;
				case 'if':
					this.#currentSubBranch = new Branch(this, null, new ExpressionCondition(matchedSymbol[2]!, defines));
					this.#lines.push(this.#currentSubBranch);
					return true;
				case 'else':
					if (this.#currentSubBranch) {
						this.#currentSubBranch = new Branch(this, this.#currentSubBranch, new ElseCondition(this.#currentSubBranch));
						this.#lines.push(this.#currentSubBranch);
					} else {
						return false;
					}
					return true;
				case 'elif':
					if (this.#currentSubBranch) {
						this.#currentSubBranch = new Branch(this, null, new AndCondition(new ExpressionCondition(matchedSymbol[2]!, defines), new ElseCondition(this.#currentSubBranch)));
						this.#lines.push(this.#currentSubBranch);
					} else {
						return false;
					}
					return true;
				case 'elifdef':
				case 'elifndef':
					if (this.#currentSubBranch) {
						const elifDef = matchedSymbol[1] === 'elifdef';
						if (defines.has(matchedSymbol[2]!)) {
							this.#currentSubBranch = new Branch(this, this.#currentSubBranch, new AndCondition(elifDef ? new TrueCondition() : new FalseCondition(), new ElseCondition(this.#currentSubBranch)));
						} else {
							this.#currentSubBranch = new Branch(this, this.#currentSubBranch, new AndCondition(elifDef ? new FalseCondition() : new TrueCondition(), new ElseCondition(this.#currentSubBranch)));
						}
						this.#lines.push(this.#currentSubBranch);
					} else {
						return false;
					}
					return true;
				case 'endif':
					if (this.#currentSubBranch) {
						this.#currentSubBranch = null;
						return true;
					} else {
						return false;
					}
				default:
					// This is probably an error
					this.#lines.push(line);
					return true;
					break;
			}
		} else {
			if (this.#currentSubBranch) {
				return this.#currentSubBranch.addLine(line, defines);
			} else {
				line.line = replaceDefine(line.line, defines);
				this.#lines.push(line);
				return true;
			}
		}
	}

	out(out: FinalLine[] = []): void {
		if (!this.isTrue()) {
			return;
		}
		for (const line of this.#lines) {
			if ((line as Branch).isBranch) {
				(line as Branch).out(out);
			} else {
				out.push(line as FinalLine);
			}
		}
	}
}

export type FinalLine = {
	sourceName?: string;
	line: string;
	originLine: number;
	includeLine?: FinalLine;
}

export class WgslPreprocessor {

	static setWgslInclude(name: string, source: string): void {
		includes.set(name, source);
	}

	static getWgslInclude(name: string): string | undefined {
		return includes.get(name);
	}

	static preprocessWgsl(source: string, defines: Map<string, string> = new Map<string, string>()): string {
		const expandedArray = expandIncludes(source);

		const processedArray = preprocess(expandedArray, defines);

		const locations = new Map<string, number>();
		const locationRegEx = /@location\((\D\w*)\)/g;
		const locationRegExSingle = /@location\((\D\w*)\)/;

		const finalArray: string[] = [];
		for (const line of processedArray) {
			let currentLine = line.line;

			// Note: we don't use matchAll cause we update the line
			while (true) {
				const result = locationRegEx.exec(currentLine);

				if (!result || result.length < 2) {
					finalArray.push(currentLine);
					break;
				}

				const locationName = result[1]!
				let currentLocation = locations.get(locationName);
				if (currentLocation === undefined) {
					currentLocation = 0;
					locations.set(locationName, 0);
				}

				currentLine = currentLine.replace(locationRegExSingle, `@location(${currentLocation})`);
				++currentLocation;
				locations.set(locationName, currentLocation);
			}
		}
		return finalArray.join('\n');
	}

	static getIncludeList(source: string, defines: Map<string, string> = new Map<string, string>()): Set<string> {
		const expandedArray = expandIncludes(source);

		const processedArray = preprocess(expandedArray, defines);

		const includes = new Set<string>();

		function addInclude(line: FinalLine): void {
			if (line.sourceName) {
				includes.add(line.sourceName);
			}

			if (line.includeLine) {
				addInclude(line.includeLine);
			}
		}

		for (const line of processedArray) {
			addInclude(line);
		}
		return includes;
	}

	static preprocessWgslSourceMap(source: string, defines: Map<string, string> = new Map<string, string>()): FinalLine[] {
		const expandedArray = expandIncludes(source);

		const processedArray = preprocess(expandedArray, defines);

		return processedArray;
	}
}

function preprocess(lines: FinalLine[], defines: Map<string, string>): FinalLine[] {
	const branch = new Branch(null, null, new TrueCondition());
	const def = new Map(defines);
	for (let i = 0, l = lines.length; i < l; ++i) {
		branch.addLine(lines[i]!, def);
	}

	const result: FinalLine[] = [];
	branch.out(result);
	return result;
}

function expandIncludes(source: string): FinalLine[] {
	const lines = source.split('\n');

	const allIncludes = new Set<string>();
	const outArray: FinalLine[] = [];
	const sizeOfSourceRow = [];

	for (let i = 0; i < lines.length; ++i) {
		const line = lines[i]!;
		let actualSize = 1;

		if (line.trim().startsWith('#include')) {
			const includeName = line.replace('#include', '').trim();
			const include = getInclude(includeName, new Set(), allIncludes);
			if (include) {
				for (const includeLine of include) {
					outArray.push({ line: includeLine.line, originLine: i, includeLine });

				}
				actualSize = include.length;
			} else {
				if (include === undefined) {
					console.error(`Include not found : ${line}`)
				}
			}
		} else {
			outArray.push({ line, originLine: i, });
		}
		sizeOfSourceRow[i] = actualSize;
	}
	return outArray;
}

function getInclude(includeName: string, recursion = new Set<string>(), allIncludes = new Set<string>()): FinalLine[] | null {
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
	const outArray: FinalLine[] = [];
	for (let i = 0, l = includeLineArray.length; i < l; ++i) {
		const line = includeLineArray[i]!;
		if (line.trim().startsWith('#include')) {
			const nestedIncludeName = line.replace('#include', '').trim();
			const include = getInclude(nestedIncludeName, recursion, allIncludes);
			if (include) {
				for (const includeLine of include) {
					outArray.push({ sourceName: includeName, line: includeLine.line, originLine: i, includeLine });
				}
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
		outArray.push({ sourceName: includeName, line, originLine: i, });
	}
	allIncludes.add(includeName);
	return outArray;
}
