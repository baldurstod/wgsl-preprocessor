const includes = new Map<string, string>();


//const preprocessorSymbols = /#([^\s]*)(\s*)/gm
const PRAGMA_REGEX = /#pragma (\w+)/;

interface Condition {
	isTrue: (defines: Map<string, string>) => boolean;
}

class SimpleCondition implements Condition {
	#condition: string;

	constructor(condition: string) {
		this.#condition = condition;
	}

	isTrue(): boolean {
		return true;
	}
}

class IsDefinedCondition implements Condition {
	#condition: string;

	constructor(condition: string) {
		this.#condition = condition;
	}

	isTrue(defines: Map<string, string>): boolean {
		return defines.has(this.#condition);
	}
}

class AndCondition implements Condition {
	#condition1: Condition;
	#condition2: Condition;

	constructor(condition1: Condition, condition2: Condition) {
		this.#condition1 = condition1;
		this.#condition2 = condition2;
	}

	isTrue(defines: Map<string, string>): boolean {
		if (!this.#condition1.isTrue(defines)) {
			return false;
		}
		return this.#condition2.isTrue(defines);
	}
}

class TrueCondition implements Condition {
	isTrue(): boolean {
		return true;
	}
}

class ConditionIsFalse implements Condition {
	#condition: Condition;

	constructor(condition: Condition) {
		this.#condition = condition;
	}

	isTrue(defines: Map<string, string>): boolean {
		return !this.#condition.isTrue(defines);
	}
}

let branchId = 0;
class Branch {
	#condition: Condition;
	#lines: (string | Branch)[] = [];
	#currentSubBranch: Branch | null = null;
	readonly branchId = String(branchId++);

	constructor(condition: Condition) {
		this.#condition = condition;
	}

	addLine(line: string): boolean {
		const preprocessorSymbols = /#([^\s]*)\s*(.*)/g
		// If we are in a subbranch, pass the line to the subbranch
		if (this.#currentSubBranch) {
			if (this.#currentSubBranch.addLine(line)) {
				return true;
			}
		}

		const matchedSymbol = preprocessorSymbols.exec(line);
		if (matchedSymbol) {
			switch (matchedSymbol[1]) {
				case 'ifdef':
					this.#currentSubBranch = new Branch(new IsDefinedCondition(matchedSymbol[2]!));
					this.#lines.push(this.#currentSubBranch);
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
				return this.#currentSubBranch.addLine(line);
			} else {
				this.#lines.push(line);
				return true;
			}
		}
	}

	out(out: string[] = [], defines: Map<string, string>): void {
		if (!this.#condition.isTrue(defines)) {
			return;
		}
		for (const line of this.#lines) {
			if (typeof line == 'string') {
				out.push(line);
			} else {
				line.out(out, defines);
			}
		}
	}
}

export function addWgslInclude(name: string, source: string): void {
	includes.set(name, source);
}

export function preprocessWgsl(source: string, defines: Map<string, string> = new Map<string, string>()): string {
	const outArray = expandIncludes(source);

	const result = preprocess(outArray, defines);

	return result.join('\n');
}

function preprocess(lines: string[], defines: Map<string, string>): string[] {
	let depth = 0;
	const branch = new Branch(new TrueCondition());
	for (let i = 0, l = lines.length; i < l; ++i) {
		//const line = lines[i]!;
		branch.addLine(lines[i]!);
		/*
		const matchedSymbols = line.matchAll(preprocessorSymbols);
		for (const matchedSymbol of matchedSymbols) {
			console.info(line, matchedSymbol);
		}
		*/
	}

	const result: string[] = [];
	branch.out(result, defines);
	return result;
}

function expandIncludes(source: string): string[] {
	const lines = source.split('\n');

	const allIncludes = new Set<string>();
	let compileRow = 1;
	const outArray: string[] = [];
	const sourceRowToInclude = new Map<number, [string, number]>();
	const sizeOfSourceRow = [];

	for (let i = 0; i < lines.length; ++i) {
		const line = lines[i]!;
		let actualSize = 1;

		if (line.trim().startsWith('#include')) {
			const includeName = line.replace('#include', '').trim();
			const include = getInclude(includeName, sourceRowToInclude, compileRow, new Set(), allIncludes);
			if (include) {
				sourceRowToInclude.set(compileRow, [includeName, include.length]);
				outArray.push(...include);
				compileRow += include.length;
				actualSize = include.length;
			} else {
				if (include === undefined) {
					console.error(`Include not found : ${line}`)
				}
			}
		} else {
			outArray.push(line);
			++compileRow;
		}
		sizeOfSourceRow[i] = actualSize;
	}
	return outArray;
}

function getInclude(includeName: string, sourceRowToInclude: Map<number, [string, number]>, compileRow = 0, recursion = new Set<string>(), allIncludes = new Set<string>()): string[] | null {
	//this.#includes.add(includeName);
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
	includeLineArray.unshift('');//Add an empty line to insure nested include won't occupy the same line #
	const outArray: string[] = [];
	for (let i = 0, l = includeLineArray.length; i < l; ++i) {
		const line = includeLineArray[i]!;
		if (line.trim().startsWith('#include')) {
			const includeName = line.replace('#include', '').trim();
			const include = getInclude(includeName, sourceRowToInclude, compileRow + i, recursion, allIncludes);
			if (include) {
				sourceRowToInclude.set(compileRow, [includeName, include.length]);
				outArray.push(...include);
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
		outArray.push(line);
		++compileRow;
	}
	allIncludes.add(includeName);
	return outArray;
}
